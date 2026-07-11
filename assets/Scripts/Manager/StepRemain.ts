import { _decorator, Component, JsonAsset, Label, resources } from 'cc';
import { MazeLevelData } from '../Maze/MazeData';
import { GameState } from './GameState';
import { TurnManager } from './TurnManager';
const { ccclass, property } = _decorator;

@ccclass('StepRemain')
export class StepRemain extends Component {
    @property(Label) stepRemain: Label = null;
    @property levelName = 'level_01';

    private maxSteps = 0;
    private stepsUsed = 0;

    onEnable() {
        TurnManager.eventTarget.on('state-changed', this.onStateChanged, this);
        TurnManager.eventTarget.on('turtle-moved', this.onStateChanged, this);
    }

    onDisable() {
        TurnManager.eventTarget.off('state-changed', this.onStateChanged, this);
        TurnManager.eventTarget.off('turtle-moved', this.onStateChanged, this);
    }

    start() {
        this.render();
        resources.load(`levels/${this.levelName}`, JsonAsset, (err, asset) => {
            if (err) {
                console.error(`StepRemain cannot load ${this.levelName}`, err);
                return;
            }
            this.maxSteps = (asset.json as MazeLevelData).winCondition.maxSteps;
            this.render();
        });
    }

    private onStateChanged(state: GameState) {
        this.stepsUsed = state.stepsUsed;
        this.render();
    }

    private render() {
        if (this.stepRemain) {
            const remain = Math.max(0, this.maxSteps - this.stepsUsed);
            this.stepRemain.string = this.maxSteps > 0
                ? `Remain: ${remain}/${this.maxSteps}`
                : 'Remain: --/--';
        }
    }
}
