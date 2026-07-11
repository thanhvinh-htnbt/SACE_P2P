import { _decorator, Button, Component, director } from 'cc';
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
        director.loadScene(this.sceneName);
    }
}
