import { _decorator, Component, Node, Prefab, instantiate, Vec3 } from 'cc';
import { MazeLevelData } from './MazeData';
import { Dir } from './MazeConstants';
const { ccclass, property } = _decorator;

@ccclass('MazeBuilder')
export class MazeBuilder extends Component {
    @property(Prefab) floorTilePrefab: Prefab = null;
    @property(Prefab) wallPrefab: Prefab = null;
    @property(Node) mazeRoot: Node = null;

    readonly CELL_SIZE = 64;

    build(data: MazeLevelData) {
        this.mazeRoot.removeAllChildren();

        for (const cell of data.cells) {
            const pos = new Vec3(cell.col * this.CELL_SIZE, -cell.row * this.CELL_SIZE, 0);

            const floor = instantiate(this.floorTilePrefab);
            floor.setPosition(pos);
            this.mazeRoot.addChild(floor);

            // Chỉ vẽ tường Up và Left để tránh vẽ trùng giữa 2 ô kề nhau
            if (cell.walls[0]) this.spawnWall(pos, 'up');
            if (cell.walls[3]) this.spawnWall(pos, 'left');
        }
    }

    private spawnWall(basePos: Vec3, side: 'up' | 'left') {
        const wall = instantiate(this.wallPrefab);
        const offset = side === 'up'
            ? new Vec3(0, this.CELL_SIZE / 2, 0)
            : new Vec3(-this.CELL_SIZE / 2, 0, 0);

        const finalPos = basePos.clone().add(offset); // clone trước khi add
        wall.setPosition(finalPos);

        if (side === 'up') wall.angle = 0; else wall.angle = 90;
        this.mazeRoot.addChild(wall);
    }
}