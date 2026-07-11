import {
    _decorator,
    Component,
    Node,
    Prefab,
    Sprite,
    SpriteFrame,
    UITransform,
    instantiate,
    Vec3,
} from 'cc';
import { FlowCurve, MazeLevelData, WallState } from './MazeData';
import { Dir, DIR_OFFSETS } from './MazeConstants';
import { WaterFrameAnimator } from './WaterFrameAnimator';
import { WallTheme } from './WallTheme';
const { ccclass, property } = _decorator;

@ccclass('MazeBuilder')
export class MazeBuilder extends Component {
    @property(Prefab) mazeBgPrefab: Prefab = null;
    @property(Prefab) landPrefab: Prefab = null;    // ô sàn (Land, 128x128) — ô đi bộ
    @property(Prefab) flowPrefab: Prefab = null;    // ô nước (Flow, 128x128) — ô dòng chảy
    @property(Prefab) wallHPrefab: Prefab = null;   // tường ngang (Wall-Horizontal) — cạnh trên/dưới
    @property(Prefab) wallVPrefab: Prefab = null;    // tường dọc  (Wall-Vertical)   — cạnh trái/phải
    @property(SpriteFrame) flowArrowRight: SpriteFrame = null;
    @property(SpriteFrame) flowArrowDown: SpriteFrame = null;
    @property(SpriteFrame) flowArrowRightDown: SpriteFrame = null;
    @property(SpriteFrame) flowArrowLeftDown: SpriteFrame = null;
    @property(Node)   mazeRoot: Node = null;         // để trống = dùng chính node này

    readonly CELL_SIZE = 128;
    readonly WALL_THICKNESS = 32;
    // Nền bg-map lớn hơn lưới ô để tạo khung viền bao quanh maze
    readonly BG_PADDING_X = 176;
    readonly BG_PADDING_Y = 152;

    build(data: MazeLevelData): Node {
        const root = this.mazeRoot ?? this.node;
        root.removeAllChildren();

        if (!this.mazeBgPrefab || !this.landPrefab || !this.flowPrefab
            || !this.wallHPrefab || !this.wallVPrefab) {
            throw new Error('MazeBuilder is missing background, terrain, or wall prefabs.');
        }

        const mazeBackground = instantiate(this.mazeBgPrefab);
        mazeBackground.name = 'MazeBg';
        this.setLayerRecursively(mazeBackground, root.layer);
        this.resizeMazeBackground(mazeBackground, data.rows, data.cols);
        root.addChild(mazeBackground);

        const terrainRoot = new Node('Terrain');
        const wallsRoot = new Node('Walls');
        terrainRoot.layer = root.layer;
        wallsRoot.layer = root.layer;
        root.addChild(terrainRoot);
        root.addChild(wallsRoot);

        // PASS 1 — TERRAIN (đáy): vẽ hết nền Flow / Land trước
        for (const cell of data.cells) {
            const pos = this.cellPos(cell.row, cell.col);
            // Mỗi ô là Land (đi bộ) HOẶC Flow (nước) — chọn prefab theo cell.flow
            const tilePrefab = cell.flow !== undefined ? this.flowPrefab : this.landPrefab;
            const tile = instantiate(tilePrefab);
            tile.name = cell.flow !== undefined
                ? `Flow_${cell.row}_${cell.col}`
                : `Land_${cell.row}_${cell.col}`;
            if (cell.flow !== undefined) {
                tile.setRotationFromEuler(0, 0, this.flowToAngle(cell.flow));
                const animator = tile.getComponent(WaterFrameAnimator)
                    ?? tile.addComponent(WaterFrameAnimator);
                animator.configure((cell.row * data.cols + cell.col) * 0.017);
            }
            tile.setPosition(pos);
            terrainRoot.addChild(tile);
        }

        // Arrow nằm trên texture nước nhưng vẫn dưới Item / Wall / Turtle.
        // Hướng vào được suy ra từ ô Flow liền trước để tự chọn sprite cong tại chỗ rẽ.
        this.buildFlowDirectionOverlay(data, terrainRoot);

        // PASS 2 — WALL (trên cùng): vẽ hết tường sau, để luôn nổi trên nền
        for (const cell of data.cells) {
            const pos = this.cellPos(cell.row, cell.col);
            // Cạnh chung chỉ vẽ 1 lần: tường Trên + Trái cho mọi ô
            if (cell.walls[0] !== WallState.NONE) {
                this.spawnWall(wallsRoot, pos, 'up', `Wall_up_${cell.row}_${cell.col}`, cell.row === 0);
            }
            if (cell.walls[3] !== WallState.NONE) {
                this.spawnWall(wallsRoot, pos, 'left', `Wall_left_${cell.row}_${cell.col}`, cell.col === 0);
            }
            // Viền ngoài cùng: cạnh Dưới hàng cuối, cạnh Phải cột cuối
            if (cell.row === data.rows - 1 && cell.walls[2] !== WallState.NONE) {
                this.spawnWall(wallsRoot, pos, 'down', `Wall_up_${data.rows}_${cell.col}`, true);
            }
            if (cell.col === data.cols - 1 && cell.walls[1] !== WallState.NONE) {
                this.spawnWall(wallsRoot, pos, 'right', `Wall_left_${cell.row}_${data.cols}`, true);
            }
        }

        return root;
    }

    // row tăng xuống dưới => y âm dần
    cellPos(row: number, col: number): Vec3 {
        return new Vec3(col * this.CELL_SIZE, -row * this.CELL_SIZE, 0);
    }

    // Tường ngang: 128x32. Tường dọc: 32x128.
    private spawnWall(
        root: Node,
        basePos: Vec3,
        side: 'up' | 'down' | 'left' | 'right',
        nodeName: string,
        isBoundary: boolean,
    ) {
        const half = this.CELL_SIZE / 2;
        const isHorizontal = side === 'up' || side === 'down';
        let prefab: Prefab;
        let offset: Vec3;
        switch (side) {
            case 'up':    prefab = this.wallHPrefab; offset = new Vec3(0, half, 0); break;
            case 'down':  prefab = this.wallHPrefab; offset = new Vec3(0, -half, 0); break;
            case 'left':  prefab = this.wallVPrefab; offset = new Vec3(-half, 0, 0); break;
            case 'right': prefab = this.wallVPrefab; offset = new Vec3(half, 0, 0); break;
        }

        const wall = instantiate(prefab);
        wall.name = nodeName;
        // Hai prefab đã có orientation đúng; giữ nguyên rotation gốc của prefab.
        this.setWallSizeRecursively(wall);
        wall.addComponent(WallTheme).configure(isBoundary);

        wall.setPosition(basePos.clone().add(offset));
        root.addChild(wall);
    }

    /** Flow prefab mặc định hướng sang phải. Dir: Up=0, Right=1, Down=2, Left=3. */
    private flowToAngle(flow: number): number {
        switch (flow) {
            case 0: return 90;
            case 1: return 0;
            case 2: return -90;
            case 3: return 180;
            default: return 0;
        }
    }

    private buildFlowDirectionOverlay(data: MazeLevelData, terrainRoot: Node): void {
        if (!this.flowArrowRight || !this.flowArrowDown
            || !this.flowArrowRightDown || !this.flowArrowLeftDown) {
            console.error('MazeBuilder is missing one or more Flow arrow SpriteFrames.');
            return;
        }

        const arrowRoot = new Node('FlowDirectionArrows');
        arrowRoot.layer = terrainRoot.layer;
        terrainRoot.addChild(arrowRoot);

        for (const cell of data.cells) {
            if (cell.flow === undefined) continue;

            const incoming = this.findIncomingFlowDirection(data, cell.row, cell.col);
            const visual = this.getFlowArrowVisual(
                incoming,
                cell.flow,
                cell.flowCurve,
                this.flowArrowRight,
                this.flowArrowDown,
                this.flowArrowRightDown,
                this.flowArrowLeftDown,
            );
            const arrow = new Node(`FlowArrow_${cell.row}_${cell.col}`);
            arrow.layer = terrainRoot.layer;
            arrow.setPosition(this.cellPos(cell.row, cell.col));
            arrow.setRotationFromEuler(0, 0, visual.angle);
            arrowRoot.addChild(arrow);

            const sprite = arrow.addComponent(Sprite);
            sprite.spriteFrame = visual.frame;
            sprite.sizeMode = Sprite.SizeMode.RAW;
        }
    }

    private findIncomingFlowDirection(
        data: MazeLevelData,
        row: number,
        col: number,
    ): Dir | null {
        for (let direction = 0; direction < 4; direction++) {
            const dir = direction as Dir;
            const [dr, dc] = DIR_OFFSETS[dir];
            const previousRow = row - dr;
            const previousCol = col - dc;
            if (previousRow < 0 || previousRow >= data.rows
                || previousCol < 0 || previousCol >= data.cols) continue;

            const previous = data.cells[previousRow * data.cols + previousCol];
            if (previous?.flow === dir) return dir;
        }
        return null;
    }

    private getFlowArrowVisual(
        incoming: Dir | null,
        outgoing: Dir,
        curve: FlowCurve | undefined,
        right: SpriteFrame,
        down: SpriteFrame,
        rightDown: SpriteFrame,
        leftDown: SpriteFrame,
    ): { frame: SpriteFrame; angle: number } {
        // Hai sprite gốc + xoay 180° tạo đủ bốn góc cua.
        if (curve === 'rightDown') return { frame: rightDown, angle: 0 };
        if (curve === 'leftDown') return { frame: leftDown, angle: 0 };
        if (curve === 'rightUp') return { frame: leftDown, angle: 180 };
        if (curve === 'leftUp') return { frame: rightDown, angle: 180 };

        // Fallback cho JSON cũ chưa khai báo flowCurve.
        if (incoming !== null && incoming !== outgoing
            && ((incoming + 2) % 4) !== outgoing) {
            const clockwiseTurns: Array<[Dir, Dir, number]> = [
                [1, 2, 0], [0, 1, 90], [3, 0, 180], [2, 3, -90],
            ];
            const counterClockwiseTurns: Array<[Dir, Dir, number]> = [
                [3, 2, 0], [2, 1, 90], [1, 0, 180], [0, 3, -90],
            ];
            const clockwise = clockwiseTurns.find(([from, to]) =>
                from === incoming && to === outgoing);
            if (clockwise) return { frame: rightDown, angle: clockwise[2] };

            const counterClockwise = counterClockwiseTurns.find(([from, to]) =>
                from === incoming && to === outgoing);
            if (counterClockwise) {
                return { frame: leftDown, angle: counterClockwise[2] };
            }
        }

        if (outgoing === 0) return { frame: down, angle: 180 };
        if (outgoing === 2) return { frame: down, angle: 0 };
        return { frame: right, angle: outgoing === 1 ? 0 : 180 };
    }

    private setWallSizeRecursively(node: Node): void {
        const transform = node.getComponent(UITransform);
        if (transform) transform.setContentSize(this.CELL_SIZE, this.WALL_THICKNESS);
        for (const child of node.children) this.setWallSizeRecursively(child);
    }

    private resizeMazeBackground(background: Node, rows: number, cols: number): void {
        const width = cols * this.CELL_SIZE + this.BG_PADDING_X;
        const height = rows * this.CELL_SIZE + this.BG_PADDING_Y;
        this.setSizeRecursively(background, width, height);
        background.setPosition(
            (cols - 1) * this.CELL_SIZE / 2,
            -(rows - 1) * this.CELL_SIZE / 2,
            0,
        );
    }

    private setSizeRecursively(node: Node, width: number, height: number): void {
        const transform = node.getComponent(UITransform);
        if (transform) transform.setContentSize(width, height);
        for (const child of node.children) this.setSizeRecursively(child, width, height);
    }

    private setLayerRecursively(node: Node, layer: number): void {
        node.layer = layer;
        for (const child of node.children) this.setLayerRecursively(child, layer);
    }
}
