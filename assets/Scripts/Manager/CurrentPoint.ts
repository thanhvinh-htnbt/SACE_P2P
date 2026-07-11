import { _decorator, Component, Label } from 'cc';
import { GameState } from './GameState';
import { TurnManager } from './TurnManager';
const { ccclass, property } = _decorator;

@ccclass('CurrentPoint')
export class CurrentPoint extends Component {
    @property(Label) currentPoint: Label = null;
    private point = 0;

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
            this.currentPoint.string = `Point: ${this.point}`;
        }
    }
}
