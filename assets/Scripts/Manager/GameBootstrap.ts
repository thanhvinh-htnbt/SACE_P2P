import { _decorator, Component, JsonAsset, Node, Prefab, instantiate, resources } from 'cc';
import { TurnManager } from '../Manager/TurnManager';
import { MazeLevelData } from '../Maze/MazeData';
const { ccclass, property } = _decorator;

const CELL_SIZE = 128;

@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
    @property(Prefab) levelPrefab: Prefab = null;
    @property(Node) levelHost: Node = null;
    @property(Node) turtleNode: Node = null;
    @property(TurnManager) turnManager: TurnManager = null;
    @property levelName: string = 'level_01';

    start() {
        if (!this.levelPrefab) {
            console.error('GameBootstrap is missing levelPrefab');
            return;
        }

        const levelNode = instantiate(this.levelPrefab);
        (this.levelHost ?? this.node).addChild(levelNode);

        // Prefab tĩnh đã chứa sẵn Terrain/Walls.
        if (!this.turtleNode) {
            console.error('GameBootstrap is missing turtleNode');
            return;
        }

        // Map là prefab tĩnh. Đưa rùa vào map ngay để luôn render trên cùng.
        this.turtleNode.setParent(levelNode, false);

        // JSON chỉ cung cấp start và gameplay data, không dùng để dựng map.
        resources.load(`levels/${this.levelName}`, JsonAsset, (err, asset) => {
            if (err) { console.error(err); return; }
            const data = asset.json as MazeLevelData;

            this.turtleNode.setPosition(
                data.start.col * CELL_SIZE,
                -data.start.row * CELL_SIZE,
                0,
            );
            // this.turnManager.init(data);
        });
    }
}
