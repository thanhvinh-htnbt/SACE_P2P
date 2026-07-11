import { _decorator, director, Label } from 'cc';
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

    @property({ type: Label, tooltip: 'Label hiển thị điểm tổng của màn vừa xong.' })
    lbYourPoint: Label = null;

    /** GameBootstrap gọi trước khi show dialog: totalScore = stepRemain + pointCollected. */
    setFinalScore(score: number, maxPoint: number): void {
        if (this.lbYourPoint) this.lbYourPoint.string = `Your point: ${score}/${maxPoint}`;
    }

    /** Gắn với Click Event của nút Back to Lobby. */
    onBackToLobbyClicked(): void {
        GameAudio.playClick();
        director.loadScene(this.lobbySceneName);
    }

    /** Gắn với Click Event của nút Retry: chơi lại đúng màn hiện tại. */
    onRetryClicked(): void {
        GameAudio.playClick();
        director.loadScene(director.getScene().name);
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
