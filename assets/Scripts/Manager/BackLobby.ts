import { _decorator, Button, Component, director } from 'cc';
import { GameAudio } from './GameAudio';
const { ccclass, property } = _decorator;

@ccclass('BackLobby')
export class BackLobby extends Component {
    @property sceneName = 'lobby';

    onEnable() {
        this.node.on(Button.EventType.CLICK, this.backToLobby, this);
    }

    onDisable() {
        this.node.off(Button.EventType.CLICK, this.backToLobby, this);
    }

    backToLobby() {
        GameAudio.playClick();
        director.loadScene(this.sceneName);
    }
}
