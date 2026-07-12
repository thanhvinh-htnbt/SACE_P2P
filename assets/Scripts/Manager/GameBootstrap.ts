import {
    _decorator,
    Component,
    Color,
    JsonAsset,
    Label,
    Node,
    Prefab,
    Sprite,
    SpriteFrame,
    Tween,
    UITransform,
    UIOpacity,
    Vec3,
    instantiate,
    resources,
    tween,
} from 'cc';
import { TurnManager } from '../Manager/TurnManager';
import { GameState } from '../Manager/GameState';
import { ItemType, MazeLevelData } from '../Maze/MazeData';
import { MazeBuilder } from '../Maze/MazeBuilder';
import { BrokenWall } from '../Player/TurtleAgent';
import { BreakableWallView } from '../Maze/BreakableWallView';
import { StartRun } from './StartRun';
import { GameAudio } from './GameAudio';
import { TurtleFrameAnimator } from '../Player/TurtleFrameAnimator';
import { LevelProgress } from './LevelProgress';
import { PopupDialog } from '../UI/Dialog/PopupDialog';
import { YouWinDialog } from '../UI/Dialog/YouWinDialog';
import { GoalAnimator } from '../Maze/GoalAnimator';
import { ItemValueBadge } from '../Maze/ItemValueBadge';
const { ccclass, property } = _decorator;

const CELL_SIZE = 128;
const VIEWPORT_ROWS = 6;
const VIEWPORT_COLS = 8;
// Dịch level sang phải-xuống để chừa chỗ cho khung bg-map quanh maze.
const LEVEL_OFFSET_X = 175;
const LEVEL_OFFSET_Y = -125;
const MOVE_TWEEN_DURATION = 0.45;
const FLOW_TWEEN_DURATION = 0.28;
const POINT_ITEM_NAMES = [
    '', 'swim_float', 'shell', 'icecream',
    'coconut', 'compass', 'snail', 'starfish',
];

interface TurtleViewState extends GameState {
    isFlowMove?: boolean;
}

interface PointGainedEvent {
    value: number;
    row: number;
    col: number;
}

@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
    @property(Prefab) mazeBgPrefab: Prefab = null;
    @property(Prefab) landPrefab: Prefab = null;
    @property(Prefab) flowPrefab: Prefab = null;
    @property(Prefab) wallHPrefab: Prefab = null;
    @property(Prefab) wallVPrefab: Prefab = null;
    @property(Prefab) itemPrefab: Prefab = null;
    @property(Node) winDialogNode: Node = null;
    @property(Node) loseDialogNode: Node = null;
    @property(Node) levelHost: Node = null;
    @property(Node) turtleNode: Node = null;
    @property(TurnManager) turnManager: TurnManager = null;
    @property(Label) currentLevelLabel: Label = null;

    private levelData: MazeLevelData = null;
    private levelNode: Node = null;
    private readonly itemNodes = new Map<number, Node>();
    private readonly pointItemFrames = new Map<number, SpriteFrame>();
    private turtleAnimator: TurtleFrameAnimator = null;
    private isReady = false;
    private currentLevelName = '';

    onLoad() {
        GameAudio.ensure();
        StartRun.eventTarget.on('start-run', this.onStartRun, this);
        TurnManager.eventTarget.on('turtle-moved', this.onTurtleMoved, this);
        TurnManager.eventTarget.on('walls-broken', this.onWallsBroken, this);
        TurnManager.eventTarget.on('game-ended', this.onGameEnded, this);
        TurnManager.eventTarget.on('point-gained', this.onPointGained, this);
    }

    onDestroy() {
        StartRun.eventTarget.off('start-run', this.onStartRun, this);
        TurnManager.eventTarget.off('turtle-moved', this.onTurtleMoved, this);
        TurnManager.eventTarget.off('walls-broken', this.onWallsBroken, this);
        TurnManager.eventTarget.off('game-ended', this.onGameEnded, this);
        TurnManager.eventTarget.off('point-gained', this.onPointGained, this);
    }

    start() {
        // TurnManager nằm cùng GameController; vẫn cho phép kéo reference từ Inspector.
        this.turnManager ??= this.getComponent(TurnManager);
        if (!this.turnManager) {
            console.error('GameBootstrap is missing TurnManager');
            return;
        }

        // Maze được dựng runtime từ JSON; prefab cũ trong LevelHost sẽ được thay thế.
        if (!this.turtleNode) {
            console.error('GameBootstrap is missing turtleNode');
            return;
        }

        this.turtleAnimator = this.turtleNode.getComponent(TurtleFrameAnimator)
            ?? this.turtleNode.addComponent(TurtleFrameAnimator);

        // Gameplay chỉ nạp JSON của level đã được chọn ở Lobby.
        this.currentLevelName = LevelProgress.getSelectedLevel();
        resources.load(`levels/${this.currentLevelName}`, JsonAsset, (err, levelAsset) => {
            if (err) {
                console.error(`GameBootstrap cannot load ${this.currentLevelName}.json`, err);
                return;
            }

            const data = JSON.parse(JSON.stringify(levelAsset.json)) as MazeLevelData;
            if (!this.isValidLevel(data)) return;
            this.showCurrentLevel(data.levelId);

            const levelNode = this.buildLevel(data);
            if (!levelNode) return;

            this.levelData = data;
            this.levelNode = levelNode;
            this.turtleNode.setParent(levelNode, false);
            this.setTurtlePosition(data.start.row, data.start.col);
            // Hướng mặc định của gameplay là Right; sau init sẽ tween sang hướng mở hợp lệ.
            this.turtleNode.setRotationFromEuler(0, 0, this.facingToAngle(1));
            this.spawnGoalMarker(levelNode, data);
            this.loadPointItemFrames(() => {
                this.spawnCellItems(levelNode, data);
                this.turtleNode.setSiblingIndex(levelNode.children.length - 1);
                const initialState = this.turnManager.init(data);
                this.tweenInitialFacing(initialState.facing);
                this.isReady = true;
            });
        });
    }

    private buildLevel(data: MazeLevelData): Node | null {
        if (!this.mazeBgPrefab || !this.landPrefab || !this.flowPrefab
            || !this.wallHPrefab || !this.wallVPrefab) {
            console.error('GameBootstrap is missing MazeBg, Land, Flow, or Wall prefabs.');
            return null;
        }

        const host = this.levelHost ?? this.node;
        for (const oldLevel of host.children.filter(child => /^Level_\d+$/.test(child.name))) {
            if (this.turtleNode.parent === oldLevel) this.turtleNode.setParent(host, true);
            oldLevel.destroy();
        }

        const levelNode = new Node(`Level_${data.levelId}`);
        levelNode.layer = host.layer;
        host.addChild(levelNode);
        this.fitLevelToViewport(levelNode, data);

        const builder = levelNode.addComponent(MazeBuilder);
        builder.mazeBgPrefab = this.mazeBgPrefab;
        builder.landPrefab = this.landPrefab;
        builder.flowPrefab = this.flowPrefab;
        builder.wallHPrefab = this.wallHPrefab;
        builder.wallVPrefab = this.wallVPrefab;
        return builder.build(data);
    }

    private showCurrentLevel(levelId: string): void {
        if (!this.currentLevelLabel) {
            console.warn('GameBootstrap is missing currentLevelLabel.');
            return;
        }

        const numericLevel = Number(levelId);
        this.currentLevelLabel.string = Number.isFinite(numericLevel)
            ? `LEVEL: ${numericLevel}`
            : `LEVEL: ${levelId}`;
    }

    /**
     * Giữ vùng chơi bằng 8x6 ô. Maze lớn hơn được scale đồng đều và căn giữa,
     * còn maze 8x6 hoặc nhỏ hơn giữ nguyên tỉ lệ 1:1.
     * Toàn bộ level dịch thêm LEVEL_OFFSET để chừa chỗ cho khung bg-map.
     */
    private fitLevelToViewport(levelNode: Node, data: MazeLevelData): void {
        const scale = Math.min(
            1,
            VIEWPORT_COLS / data.cols,
            VIEWPORT_ROWS / data.rows,
        );
        levelNode.setScale(scale, scale, 1);

        if (scale >= 1) {
            levelNode.setPosition(LEVEL_OFFSET_X, LEVEL_OFFSET_Y, 0);
            return;
        }

        // Origin của maze nằm tại tâm ô trên-trái, không phải tại mép ngoài.
        const viewportCenterX = (VIEWPORT_COLS - 1) * CELL_SIZE / 2;
        const viewportCenterY = -(VIEWPORT_ROWS - 1) * CELL_SIZE / 2;
        const mazeCenterX = (data.cols - 1) * CELL_SIZE * scale / 2;
        const mazeCenterY = -(data.rows - 1) * CELL_SIZE * scale / 2;
        levelNode.setPosition(
            viewportCenterX - mazeCenterX + LEVEL_OFFSET_X,
            viewportCenterY - mazeCenterY + LEVEL_OFFSET_Y,
            0,
        );
    }

    private isValidLevel(data: MazeLevelData): boolean {
        const valid = !!data
            && Number.isInteger(data.rows)
            && Number.isInteger(data.cols)
            && data.rows > 0
            && data.cols > 0
            && Array.isArray(data.cells)
            && data.cells.length === data.rows * data.cols;
        if (!valid) console.error(`${this.currentLevelName}.json has invalid maze data.`);
        return valid;
    }

    // Bấm Start một lần để rùa tự chạy theo luật hiện tại.
    private onStartRun() {
        if (!this.isReady || !this.turnManager) return;
        void this.turnManager.runAutomatically();
    }

    // State chỉ giữ row/col; view đổi row/col thành tọa độ thật của prefab map.
    private onTurtleMoved(state: TurtleViewState) {
        if (!this.levelData || !this.turtleNode) return;

        this.tweenTurtle(state);

        const index = state.turtleRow * this.levelData.cols + state.turtleCol;
        if (this.levelData.cells[index].item !== ItemType.Food) {
            const collectedItem = this.itemNodes.get(index);
            if (collectedItem) collectedItem.active = false;
        }
    }

    private setTurtlePosition(row: number, col: number) {
        this.turtleNode.setPosition(col * CELL_SIZE, -row * CELL_SIZE, 0);
    }

    private onGameEnded(result: { isWin: boolean; totalScore: number; bestCase: number }) {
        if (result.isWin && this.currentLevelName) {
            LevelProgress.completeLevel(this.currentLevelName);
        }
        this.showResultDialog(result.isWin, result.totalScore, result.bestCase);
    }

    private spawnGoalMarker(levelNode: Node, data: MazeLevelData) {
        resources.load('sprite/flag_destination/spriteFrame', SpriteFrame, (error, frame) => {
            if (error || !frame || !levelNode?.isValid) {
                console.error('Cannot load goal sprite flag_destination', error);
                return;
            }

            const goalNode = new Node('GoalDestination');
            goalNode.layer = levelNode.layer;
            goalNode.setPosition(data.goal.col * CELL_SIZE, -data.goal.row * CELL_SIZE, 0);
            const transform = goalNode.addComponent(UITransform);
            transform.setContentSize(112, 112);
            const sprite = goalNode.addComponent(Sprite);
            sprite.spriteFrame = frame;
            levelNode.addChild(goalNode);

            const walls = levelNode.getChildByName('Walls');
            if (walls) goalNode.setSiblingIndex(walls.getSiblingIndex());
            goalNode.addComponent(GoalAnimator);
        });
    }

    private onPointGained(event: PointGainedEvent) {
        if (!this.levelNode?.isValid) return;

        const popup = new Node(`PointGain_${event.value}`);
        popup.layer = this.levelNode.layer;
        popup.setPosition(event.col * CELL_SIZE, -event.row * CELL_SIZE + 72, 0);
        popup.setScale(0.8, 0.8, 1);
        this.levelNode.addChild(popup);
        popup.setSiblingIndex(this.levelNode.children.length - 1);

        const transform = popup.addComponent(UITransform);
        transform.setContentSize(150, 56);
        const label = popup.addComponent(Label);
        label.string = `+${event.value}`;
        label.fontSize = 40;
        label.lineHeight = 48;
        label.isBold = true;
        label.color = new Color(255, 230, 55, 255);
        label.enableOutline = true;
        label.outlineColor = new Color(74, 42, 12, 255);
        label.outlineWidth = 3;
        const opacity = popup.addComponent(UIOpacity);
        opacity.opacity = 255;

        tween(opacity).to(0.8, { opacity: 0 }, { easing: 'sineIn' }).start();
        tween(popup)
            .parallel(
                tween().by(0.8, { position: new Vec3(0, 72, 0) }, { easing: 'sineOut' }),
                tween().to(0.25, { scale: new Vec3(1.15, 1.15, 1) }, { easing: 'backOut' }),
            )
            .call(() => popup.destroy())
            .start();
    }

    private showResultDialog(isWin: boolean, totalScore: number, bestCase: number) {
        const dialogNode = isWin ? this.winDialogNode : this.loseDialogNode;
        if (!dialogNode) {
            console.error(`GameBootstrap is missing ${isWin ? 'Win' : 'Lose'}Dialog node`);
            return;
        }
        dialogNode.getComponent(YouWinDialog)?.setFinalScore(totalScore, bestCase);
        const dialog = dialogNode.getComponent(PopupDialog);
        if (dialog) dialog.showImmediately();
    }

    private onWallsBroken(walls: BrokenWall[]) {
        const wallRoot = this.levelNode?.getChildByName('Walls');
        if (!wallRoot) return;

        for (const wall of walls) {
            const name = this.getWallNodeName(wall);
            const wallNode = wallRoot.getChildByName(name);
            if (!wallNode || !wallNode.active) continue;

            const breakableView = wallNode.getComponent(BreakableWallView);
            if (breakableView) {
                breakableView.play();
                continue;
            }

            // Fallback cho level cũ chưa gắn BreakableWallView.
            Tween.stopAllByTarget(wallNode);
            tween(wallNode)
                .to(0.22, { scale: new Vec3(0, 0, 1) }, { easing: 'backIn' })
                .call(() => { wallNode.active = false; })
                .start();
        }
    }

    private getWallNodeName(wall: BrokenWall): string {
        if (wall.dir === 0) return `Wall_up_${wall.row}_${wall.col}`;
        if (wall.dir === 3) return `Wall_left_${wall.row}_${wall.col}`;
        if (wall.dir === 2) return `Wall_up_${wall.row + 1}_${wall.col}`;
        return `Wall_left_${wall.row}_${wall.col + 1}`;
    }

    private tweenTurtle(state: TurtleViewState) {
        const node = this.turtleNode;
        const targetPosition = new Vec3(
            state.turtleCol * CELL_SIZE,
            -state.turtleRow * CELL_SIZE,
            0,
        );
        const targetAngle = this.facingToAngle(state.facing);
        const currentAngle = node.angle;
        // Chuẩn hóa về [-180, 180] để luôn quay theo cung ngắn nhất.
        const shortestDelta = ((targetAngle - currentAngle + 540) % 360) - 180;
        const tweenAngle = currentAngle + shortestDelta;
        const duration = state.isFlowMove ? FLOW_TWEEN_DURATION : MOVE_TWEEN_DURATION;

        Tween.stopAllByTarget(node);
        this.turtleAnimator?.play(duration);
        tween(node)
            .to(duration, {
                position: targetPosition,
                angle: tweenAngle,
            }, { easing: 'sineInOut' })
            .call(() => {
                node.setRotationFromEuler(0, 0, targetAngle);
                this.turtleAnimator?.stop();
            })
            .start();
    }

    private tweenInitialFacing(facing: number) {
        const node = this.turtleNode;
        const targetAngle = this.facingToAngle(facing);
        const currentAngle = node.angle;
        const shortestDelta = ((targetAngle - currentAngle + 540) % 360) - 180;

        Tween.stopAllByTarget(node);
        tween(node)
            .to(0.4, { angle: currentAngle + shortestDelta }, { easing: 'sineInOut' })
            .call(() => node.setRotationFromEuler(0, 0, targetAngle))
            .start();
    }

    /** Sprite gốc nhìn xuống: Up=180, Right=90, Down=0, Left=-90. */
    private facingToAngle(facing: number): number {
        return (2 - facing) * 90;
    }

    // Item cũng được dựng từ JSON và đặt giữa layer Terrain với Walls.
    private spawnCellItems(levelNode: Node, data: MazeLevelData) {
        if (!this.itemPrefab) {
            console.warn('GameBootstrap is missing itemPrefab; cell values will not be shown');
            return;
        }

        const itemLayer = new Node('RuntimeItems');
        itemLayer.layer = levelNode.layer;
        levelNode.addChild(itemLayer);

        // Thứ tự render: Terrain -> Item -> Walls -> Turtle.
        const walls = levelNode.getChildByName('Walls');
        if (walls) itemLayer.setSiblingIndex(walls.getSiblingIndex());

        this.itemNodes.clear();
        for (const cell of data.cells) {
            if (cell.item !== ItemType.Food) continue;

            const index = cell.row * data.cols + cell.col;
            const itemNode = instantiate(this.itemPrefab);
            itemNode.name = `Item_${cell.row}_${cell.col}`;
            itemNode.setPosition(cell.col * CELL_SIZE, -cell.row * CELL_SIZE, 0);
            itemNode.setScale(0.75, 0.75, 1);
            itemLayer.addChild(itemNode);

            const sprites = itemNode.getComponentsInChildren(Sprite);
            const icon = sprites[0];
            const pointFrame = this.pointItemFrames.get(cell.itemValue ?? 1);
            if (icon && pointFrame) {
                icon.enabled = true;
                icon.spriteFrame = pointFrame;
            } else {
                console.warn(`Missing point icon for value ${cell.itemValue ?? 1}`);
                for (const sprite of sprites) sprite.enabled = false;
            }

            this.attachValueBadge(itemNode, cell.itemValue ?? 1, index);
            this.itemNodes.set(index, itemNode);
        }
    }

    /** Label "+x" nhún trên đầu item để user thấy giá trị điểm của nó. */
    private attachValueBadge(itemNode: Node, value: number, index: number) {
        const badge = new Node('ValueBadge');
        badge.layer = itemNode.layer;
        badge.setPosition(0, 84, 0);
        badge.addComponent(UITransform).setContentSize(120, 48);

        const label = badge.addComponent(Label);
        label.string = `+${value}`;
        label.fontSize = 40;
        label.lineHeight = 48;
        label.isBold = true;
        label.color = new Color(255, 230, 55, 255);
        label.enableOutline = true;
        label.outlineColor = new Color(74, 42, 12, 255);
        label.outlineWidth = 3;

        itemNode.addChild(badge);
        // Lệch pha theo index để các badge không nảy đồng loạt.
        badge.addComponent(ItemValueBadge).configure(index * 0.073);
    }

    private loadPointItemFrames(onComplete: () => void) {
        resources.loadDir('sprite/Item', SpriteFrame, (err, frames) => {
            if (err) {
                console.error('Cannot load point item icons', err);
                onComplete();
                return;
            }

            this.pointItemFrames.clear();
            for (let value = 1; value <= 7; value++) {
                const expectedName = POINT_ITEM_NAMES[value];
                const frame = frames.find(candidate => candidate.name === expectedName);
                if (frame) this.pointItemFrames.set(value, frame);
                else console.warn(`Point icon not found: ${expectedName}`);
            }
            onComplete();
        });
    }
}
