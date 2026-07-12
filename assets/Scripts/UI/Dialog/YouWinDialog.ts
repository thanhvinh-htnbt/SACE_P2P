import { _decorator, director, JsonAsset, Label, resources } from 'cc';
import { PopupDialog } from './PopupDialog';
import { LevelProgress } from '../../Manager/LevelProgress';
import { GameAudio } from '../../Manager/GameAudio';

const { ccclass, property } = _decorator;

@ccclass('YouWinDialog')
export class YouWinDialog extends PopupDialog {
    private isLoadingNextLevel = false;
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
        if (this.isLoadingNextLevel) return;
        GameAudio.playClick();
        if (!this.nextLevelSceneName.trim()) {
            console.error('YouWinDialog: nextLevelSceneName chưa được cấu hình.');
            return;
        }

        this.isLoadingNextLevel = true;
        this.ensureLevelOrder(() => {
            LevelProgress.completeLevel(LevelProgress.getSelectedLevel());
            const nextLevel = LevelProgress.selectNextLevel();
            this.isLoadingNextLevel = false;
            if (!nextLevel) {
            // Màn cuối không có level kế tiếp, quay về danh sách màn.
                director.loadScene(this.lobbySceneName);
                return;
            }

            director.loadScene(this.nextLevelSceneName);
        });
    }

    private ensureLevelOrder(onReady: () => void): void {
        if (LevelProgress.getAvailableLevels().length > 0) {
            onReady();
            return;
        }

        resources.loadDir('levels', JsonAsset, (error, assets) => {
            if (error) {
                this.isLoadingNextLevel = false;
                console.error('YouWinDialog cannot load level list in build.', error);
                return;
            }
            LevelProgress.setAvailableLevels(assets.map(asset => asset.name));
            onReady();
        });
    }
}
