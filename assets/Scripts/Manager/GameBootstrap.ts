import { _decorator, Component, JsonAsset, resources } from 'cc';
import { MazeBuilder } from '../Maze/MazeBuilder';
import { TurnManager } from '../Manager/TurnManager';
import { MazeLevelData } from '../Maze/MazeData';
const { ccclass, property } = _decorator;

@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
    @property(MazeBuilder) mazeBuilder: MazeBuilder = null;
    @property(TurnManager) turnManager: TurnManager = null;
    @property levelName: string = 'level_01';

    start() {
        resources.load(`levels/${this.levelName}`, JsonAsset, (err, asset) => {
            if (err) { console.error(err); return; }
            const data = asset.json as MazeLevelData;

            this.mazeBuilder.build(data);
            this.turnManager.init(data);
        });
    }
}