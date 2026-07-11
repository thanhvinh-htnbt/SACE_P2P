import { _decorator, director } from 'cc';
import { PopupDialog } from './PopupDialog';
import { GameAudio } from '../../Manager/GameAudio';

const { ccclass, property } = _decorator;

@ccclass('YouLoseDialog')
export class YouLoseDialog extends PopupDialog {
    @property({ tooltip: 'Tên scene lobby trong Build Settings.' })
    lobbySceneName = 'lobby';

    @property({ tooltip: 'Gameplay scene name in Build Settings.' })
    gameSceneName = 'ingame';

    /** Gắn với Click Event của nút Back to Lobby. */
    onBackToLobbyClicked(): void {
        GameAudio.playClick();
        director.loadScene(this.lobbySceneName);
    }

    /** Gắn với Click Event của nút Play Again. */
    onPlayAgainClicked(): void {
        GameAudio.playClick();
        const currentSceneName = director.getScene()?.name;
        if (!currentSceneName) {
            console.error('YouLoseDialog: không tìm thấy scene hiện tại để chơi lại.');
            return;
        }

        director.loadScene(this.gameSceneName);
    }
}
