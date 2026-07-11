import { _decorator, director } from 'cc';
import { PopupDialog } from './PopupDialog';
import { LevelProgress } from '../../Manager/LevelProgress';
import { GameAudio } from '../../Manager/GameAudio';

const { ccclass, property } = _decorator;

@ccclass('YouWinDialog')
export class YouWinDialog extends PopupDialog {
    @property({ tooltip: 'Tên scene lobby trong Build Settings.' })
    lobbySceneName = 'lobby';

    @property({ tooltip: 'Tên scene của màn tiếp theo trong Build Settings.' })
    nextLevelSceneName = 'ingame';

    /** Gắn với Click Event của nút Back to Lobby. */
    onBackToLobbyClicked(): void {
        GameAudio.playClick();
        director.loadScene(this.lobbySceneName);
    }

    /** Gắn với Click Event của nút Next Level. */
    onNextLevelClicked(): void {
        GameAudio.playClick();
        if (!this.nextLevelSceneName.trim()) {
            console.error('YouWinDialog: nextLevelSceneName chưa được cấu hình.');
            return;
        }

        const nextLevel = LevelProgress.selectNextLevel();
        if (!nextLevel) {
            // Màn cuối không có level kế tiếp, quay về danh sách màn.
            director.loadScene(this.lobbySceneName);
            return;
        }

        director.loadScene(this.nextLevelSceneName);
    }
}
