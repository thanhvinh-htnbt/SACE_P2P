import { _decorator, director } from 'cc';
import { PopupDialog } from './PopupDialog';

const { ccclass, property } = _decorator;

@ccclass('YouLoseDialog')
export class YouLoseDialog extends PopupDialog {
    @property({ tooltip: 'Tên scene lobby trong Build Settings.' })
    lobbySceneName = 'lobby';

    /** Gắn với Click Event của nút Back to Lobby. */
    onBackToLobbyClicked(): void {
        director.loadScene(this.lobbySceneName);
    }

    /** Gắn với Click Event của nút Play Again. */
    onPlayAgainClicked(): void {
        const currentSceneName = director.getScene()?.name;
        if (!currentSceneName) {
            console.error('YouLoseDialog: không tìm thấy scene hiện tại để chơi lại.');
            return;
        }

        director.loadScene(currentSceneName);
    }
}
