import { _decorator, Button, Component, director, Node } from 'cc';
import { GameAudio } from './GameAudio';
import { ConfirmBackToLobbyDialog } from '../UI/Dialog/ConfirmBackToLobbyDialog';
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
        const dialogNode = this.findNodeByName(this.node.scene, 'BackLobbyDialog');
        if (!dialogNode) {
            console.error('BackLobby: cannot find BackLobbyDialog node in scene');
            director.loadScene(this.sceneName);
            return;
        }
        dialogNode.active = true;
        const dialog = dialogNode.getComponent(ConfirmBackToLobbyDialog);
        if (dialog) dialog.showImmediately();
        else console.error('BackLobbyDialog is missing ConfirmBackToLobbyDialog component');
    }

    private findNodeByName(node: Node, name: string): Node | null {
        if (!node) return null;
        if (node.name === name) return node;
        for (const child of node.children) {
            const result = this.findNodeByName(child, name);
            if (result) return result;
        }
        return null;
    }
}
