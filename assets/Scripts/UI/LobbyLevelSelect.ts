import {
    _decorator,
    Button,
    Component,
    director,
    instantiate,
    JsonAsset,
    Label,
    Node,
    resources,
    UITransform,
} from 'cc';
import { MazeLevelData } from '../Maze/MazeData';
import { LevelProgress } from '../Manager/LevelProgress';
import { GameAudio } from '../Manager/GameAudio';

const { ccclass, property } = _decorator;

interface LobbyLevelEntry {
    name: string;
    data: MazeLevelData;
}

@ccclass('LobbyLevelSelect')
export class LobbyLevelSelect extends Component {
    @property gameSceneName = 'ingame';

    @property({ min: 1, step: 1, tooltip: 'Số cột trong danh sách level.' })
    levelColumns = 2;

    @property({ tooltip: 'Khoảng cách ngang giữa tâm hai button level.' })
    levelSpacingX = 360;

    @property({ tooltip: 'Khoảng cách dọc giữa tâm hai hàng button level.' })
    levelSpacingY = 100;

    @property(Button) playButton: Button = null;
    @property(Button) levelButton: Button = null;
    @property(Button) guideButton: Button = null;
    @property(Node) levelPopup: Node = null;
    @property(Node) guidePopup: Node = null;
    @property(Node) levelContent: Node = null;
    @property(Node) levelButtonTemplate: Node = null;
    @property(Button) levelCloseButton: Button = null;
    @property(Button) guideCloseButton: Button = null;

    private levels: LobbyLevelEntry[] = [];

    onLoad(): void {
        GameAudio.ensure();
    }

    start(): void {
        if (!this.hasRequiredReferences()) {
            console.error('LobbyLevelSelect: chưa gán đủ reference trong Inspector.');
            return;
        }

        this.bindClick(this.playButton, () => this.playSelectedLevel());
        this.bindClick(this.levelButton, () => this.openPopup(this.levelPopup));
        this.bindClick(this.guideButton, () => this.openPopup(this.guidePopup));
        this.bindClick(this.levelCloseButton, () => this.levelPopup.active = false);
        this.bindClick(this.guideCloseButton, () => this.guidePopup.active = false);
        this.loadLevels();
    }

    private hasRequiredReferences(): boolean {
        return !!this.playButton
            && !!this.levelButton
            && !!this.guideButton
            && !!this.levelPopup
            && !!this.guidePopup
            && !!this.levelContent
            && !!this.levelButtonTemplate
            && !!this.levelCloseButton
            && !!this.guideCloseButton;
    }

    private loadLevels(): void {
        resources.loadDir('levels', JsonAsset, (error, assets) => {
            if (error) {
                console.error('LobbyLevelSelect: không thể đọc resources/levels.', error);
                return;
            }

            this.levels = assets
                .map(asset => ({ name: asset.name, data: asset.json as MazeLevelData }))
                .filter(level => /^level_\d+$/i.test(level.name))
                .sort((a, b) => Number(a.data.levelId) - Number(b.data.levelId));

            LevelProgress.setAvailableLevels(this.levels.map(level => level.name));
            this.playButton.interactable = this.getLatestUnlockedLevel() !== null;
            this.refreshLevelList();
        });
    }

    private refreshLevelList(): void {
        for (const child of [...this.levelContent.children]) {
            if (child !== this.levelButtonTemplate) child.destroy();
        }

        const selectableLevels = [...this.levels]
            .sort((a, b) => Number(b.data.levelId) - Number(a.data.levelId));
        const latestUnlocked = this.getLatestUnlockedLevel()?.name;

        const columns = Math.max(1, Math.floor(this.levelColumns));
        const rowCount = Math.ceil(selectableLevels.length / columns);
        const contentHeight = Math.max(
            610,
            130 + Math.max(0, rowCount - 1) * this.levelSpacingY,
        );
        this.levelContent.getComponent(UITransform)?.setContentSize(580, contentHeight);

        selectableLevels.forEach((level, index) => {
            const disc = instantiate(this.levelButtonTemplate);
            disc.name = `LevelButton_${level.data.levelId}`;
            disc.active = true;
            const row = Math.floor(index / columns);
            const col = index % columns;
            disc.setPosition(
                (col - (columns - 1) / 2) * this.levelSpacingX,
                -60 - row * this.levelSpacingY,
                0,
            );
            this.levelContent.addChild(disc);

            const unlocked = LevelProgress.isUnlocked(level.name);
            const newest = level.name === latestUnlocked;
            const label = disc.getComponentInChildren(Label);
            if (label) {
                label.string = unlocked
                    ? `${newest ? 'Newest: ' : ''}Level ${level.data.levelId}`
                    : `🔒 Level ${level.data.levelId}`;
            }
            const button = disc.getComponent(Button);
            if (button) button.interactable = unlocked;
            if (unlocked) this.bindClick(button, () => this.openLevel(level.name));
        });
    }

    private playSelectedLevel(): void {
        const selectedName = LevelProgress.getSelectedLevel();
        const selected = this.levels.find(level => level.name === selectedName);
        if (selected) {
            this.openLevel(selected.name);
            return;
        }

        const latest = this.getLatestUnlockedLevel();
        if (latest) this.openLevel(latest.name);
    }

    private getLatestUnlockedLevel(): LobbyLevelEntry | null {
        const unlocked = this.levels.filter(level => LevelProgress.isUnlocked(level.name));
        if (unlocked.length === 0) return null;
        return unlocked.reduce((latest, level) =>
            Number(level.data.levelId) > Number(latest.data.levelId) ? level : latest);
    }

    private openLevel(levelName: string): void {
        if (LevelProgress.selectLevel(levelName)) director.loadScene(this.gameSceneName);
    }

    private openPopup(popup: Node): void {
        if (!popup) return;
        this.levelPopup.active = popup === this.levelPopup;
        this.guidePopup.active = popup === this.guidePopup;
        if (popup === this.levelPopup) this.refreshLevelList();
    }

    private bindClick(button: Button | null, callback: () => void): void {
        if (!button) return;
        button.node.off(Button.EventType.CLICK, undefined, this);
        button.node.on(Button.EventType.CLICK, () => {
            GameAudio.playClick();
            callback();
        }, this);
    }
}
