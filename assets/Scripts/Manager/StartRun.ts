import { _decorator, Button, Component, EventTarget, Label } from 'cc';
import { TurnManager, TurnPhase } from './TurnManager';
import { GameAudio } from './GameAudio';
const { ccclass } = _decorator;

@ccclass('StartRun')
export class StartRun extends Component {
    static readonly eventTarget = new EventTarget();

    private button: Button = null;
    private label: Label = null;

    onLoad() {
        this.button = this.getComponent(Button);
        this.label = this.getComponentInChildren(Label);
        if (this.button) this.button.interactable = false;
    }

    onEnable() {
        this.node.on(Button.EventType.CLICK, this.onStart, this);
        TurnManager.eventTarget.on('phase-changed', this.onPhaseChanged, this);
    }

    onDisable() {
        this.node.off(Button.EventType.CLICK, this.onStart, this);
        TurnManager.eventTarget.off('phase-changed', this.onPhaseChanged, this);
    }

    private onStart() {
        if (this.button && !this.button.interactable) return;
        GameAudio.playClick();
        if (this.button) this.button.interactable = false;
        StartRun.eventTarget.emit('start-run');
    }

    private onPhaseChanged(phase: TurnPhase) {
        if (this.button) this.button.interactable = phase === TurnPhase.PlacingItem;
        if (this.label) {
            this.label.string = phase === TurnPhase.PlacingItem
                ? 'START'
                : phase === TurnPhase.TurtleMoving ? 'RUNNING' : 'DONE';
        }
    }
}
