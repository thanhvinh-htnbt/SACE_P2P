import { _decorator, Component, JsonAsset, Label, resources } from 'cc';
import { MazeLevelData } from '../Maze/MazeData';
import { GameState } from './GameState';
import { TurnManager } from './TurnManager';
import { LevelProgress } from './LevelProgress';
const { ccclass, property } = _decorator;

@ccclass('CurrentPoint')
export class CurrentPoint extends Component {
    @property(Label) currentPoint: Label = null;

    private point = 0;
    private aim = 0;

    onEnable() {
        TurnManager.eventTarget.on('state-changed', this.onStateChanged, this);
        TurnManager.eventTarget.on('food-collected', this.onFoodCollected, this);
    }

    onDisable() {
        TurnManager.eventTarget.off('state-changed', this.onStateChanged, this);
        TurnManager.eventTarget.off('food-collected', this.onFoodCollected, this);
    }

    start() {
        this.render();
        const levelName = LevelProgress.getSelectedLevel();
        resources.load(`levels/${levelName}`, JsonAsset, (err, asset) => {
            if (err) {
                console.error(`CurrentPoint cannot load ${levelName}`, err);
                return;
            }
            this.aim = (asset.json as MazeLevelData).winCondition.targetScore;
            this.render();
        });
    }

    private onStateChanged(state: GameState) {
        this.point = state.scoreCollected;
        this.render();
    }

    private onFoodCollected(score: number) {
        this.point = score;
        this.render();
    }

    private render() {
        if (this.currentPoint) {
            this.currentPoint.string = this.aim > 0
                ? `Point: ${this.point}/${this.aim}`
                : `Point: ${this.point}/--`;
        }
    }
}
