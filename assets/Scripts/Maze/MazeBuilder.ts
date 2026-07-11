import { _decorator, Component, Node, Prefab, UITransform, instantiate, Vec3 } from 'cc';
import { MazeLevelData, WallState } from './MazeData';
const { ccclass, property } = _decorator;

@ccclass('MazeBuilder')
export class MazeBuilder extends Component {
    @property(Prefab) landPrefab: Prefab = null;    // ô sàn (Land, 128x128) — ô đi bộ
    @property(Prefab) flowPrefab: Prefab = null;    // ô nước (Flow, 128x128) — ô dòng chảy
    @property(Prefab) wallHPrefab: Prefab = null;   // tường ngang (Wall-Horizontal) — cạnh trên/dưới
    @property(Prefab) wallVPrefab: Prefab = null;    // tường dọc  (Wall-Vertical)   — cạnh trái/phải
    @property(Node)   mazeRoot: Node = null;         // để trống = dùng chính node này

    readonly CELL_SIZE = 128;
    readonly WALL_THICKNESS = 8;

    build(data: MazeLevelData) {
        const root = this.mazeRoot ?? this.node;
        root.removeAllChildren();

        // PASS 1 — TERRAIN (đáy): vẽ hết nền Flow / Land trước
        for (const cell of data.cells) {
            const pos = this.cellPos(cell.row, cell.col);
            // Mỗi ô là Land (đi bộ) HOẶC Flow (nước) — chọn prefab theo cell.flow
            const tilePrefab = cell.flow !== undefined ? this.flowPrefab : this.landPrefab;
            const tile = instantiate(tilePrefab);
            tile.setPosition(pos);
            root.addChild(tile);
        }

        // PASS 2 — WALL (trên cùng): vẽ hết tường sau, để luôn nổi trên nền
        for (const cell of data.cells) {
            const pos = this.cellPos(cell.row, cell.col);
            // Cạnh chung chỉ vẽ 1 lần: tường Trên + Trái cho mọi ô
            if (cell.walls[0] !== WallState.NONE) this.spawnWall(root, pos, 'up');
            if (cell.walls[3] !== WallState.NONE) this.spawnWall(root, pos, 'left');
            // Viền ngoài cùng: cạnh Dưới hàng cuối, cạnh Phải cột cuối
            if (cell.row === data.rows - 1 && cell.walls[2] !== WallState.NONE) this.spawnWall(root, pos, 'down');
            if (cell.col === data.cols - 1 && cell.walls[1] !== WallState.NONE) this.spawnWall(root, pos, 'right');
        }
    }

    // row tăng xuống dưới => y âm dần
    private cellPos(row: number, col: number): Vec3 {
        return new Vec3(col * this.CELL_SIZE, -row * this.CELL_SIZE, 0);
    }

    // Tường ngang: 128x8. Tường dọc: 8x128.
    private spawnWall(root: Node, basePos: Vec3, side: 'up' | 'down' | 'left' | 'right') {
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
        wall.setRotationFromEuler(0, 0, 0);

        const transform = wall.getComponent(UITransform);
        if (transform) {
            transform.setContentSize(
                isHorizontal ? this.CELL_SIZE : this.WALL_THICKNESS,
                isHorizontal ? this.WALL_THICKNESS : this.CELL_SIZE,
            );
        }

        wall.setPosition(basePos.clone().add(offset));
        root.addChild(wall);
    }
}
