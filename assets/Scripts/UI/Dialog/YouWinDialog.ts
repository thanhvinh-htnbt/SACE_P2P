import { _decorator, director } from 'cc';
import { PopupDialog } from './PopupDialog';

const { ccclass, property } = _decorator;

@ccclass('YouWinDialog')
export class YouWinDialog extends PopupDialog {
    @property({ tooltip: 'Tên scene lobby trong Build Settings.' })
    lobbySceneName = 'lobby';

    @property({ tooltip: 'Tên scene của màn tiếp theo trong Build Settings.' })
    nextLevelSceneName = 'ingame';

    /** Gắn với Click Event của nút Back to Lobby. */
    onBackToLobbyClicked(): void {
        director.loadScene(this.lobbySceneName);
    }

    /** Gắn với Click Event của nút Next Level. */
    onNextLevelClicked(): void {
        if (!this.nextLevelSceneName.trim()) {
            console.error('YouWinDialog: nextLevelSceneName chưa được cấu hình.');
            return;
        }

        director.loadScene(this.nextLevelSceneName);
    }
}
