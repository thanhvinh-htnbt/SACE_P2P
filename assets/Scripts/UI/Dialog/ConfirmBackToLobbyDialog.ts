import { _decorator, director } from 'cc';
import { PopupDialog } from './PopupDialog';
import { GameAudio } from '../../Manager/GameAudio';

const { ccclass, property } = _decorator;

@ccclass('ConfirmBackToLobbyDialog')
export class ConfirmBackToLobbyDialog extends PopupDialog {
    @property({ tooltip: 'Tên scene lobby trong Build Settings.' })
    lobbySceneName = 'lobby';

    /** Gắn với Click Event của nút Cancel. */
    onCancelClicked(): void {
        GameAudio.playClick();
        this.hide();
    }

    /** Gắn với Click Event của nút Confirm. */
    onConfirmClicked(): void {
        GameAudio.playClick();
        director.loadScene(this.lobbySceneName);
    }
}
