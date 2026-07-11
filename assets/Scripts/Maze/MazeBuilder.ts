import {
    _decorator,
    Component,
    Node,
    Prefab,
    UITransform,
    instantiate,
    Vec3,
} from 'cc';
import { MazeLevelData, WallState } from './MazeData';
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
