import { _decorator, director } from 'cc';
import { PopupDialog } from './PopupDialog';

const { ccclass, property } = _decorator;

@ccclass('ConfirmBackToLobbyDialog')
export class ConfirmBackToLobbyDialog extends PopupDialog {
    @property({ tooltip: 'Tên scene lobby trong Build Settings.' })
    lobbySceneName = 'lobby';

    /** Gắn với Click Event của nút Cancel. */
    onCancelClicked(): void {
        this.hide();
    }

    /** Gắn với Click Event của nút Confirm. */
    onConfirmClicked(): void {
        director.loadScene(this.lobbySceneName);
    }
}
