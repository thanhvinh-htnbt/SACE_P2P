import { _decorator, Component, JsonAsset, Node, Prefab, instantiate, resources } from 'cc';
import { MazeBuilder } from '../Maze/MazeBuilder';
import { TurnManager } from '../Manager/TurnManager';
import { MazeLevelData } from '../Maze/MazeData';
const { ccclass, property } = _decorator;

@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
    @property(Prefab) levelPrefab: Prefab = null;
    //  @property(Prefab) levelPrefab: Prefab = null;
    @property(Node) levelHost: Node = null;
    @property(Node) turtleNode: Node = null;
    @property(TurnManager) turnManager: TurnManager = null;
    @property levelName: string = 'level_01';

    start() {
        resources.load(`levels/${this.levelName}`, JsonAsset, (err, asset) => {
            if (err) { console.error(err); return; }
            const data = asset.json as MazeLevelData;

            const levelNode = instantiate(this.levelPrefab);
            const mazeBuilder = levelNode.getComponent(MazeBuilder);
            if (!mazeBuilder) {
                console.error('Level prefab is missing MazeBuilder');
                return;
            }

            (this.levelHost ?? this.node).addChild(levelNode);
            mazeBuilder.build(data);

            if (!this.turtleNode) {
                console.error('GameBootstrap is missing turtleNode');
                return;
            }

            this.turtleNode.setParent(levelNode, false);
            this.turtleNode.setPosition(mazeBuilder.cellPos(data.start.row, data.start.col));
            // this.turnManager.init(data);
        });
    }
}
