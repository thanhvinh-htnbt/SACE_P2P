import {
    _decorator,
    Component,
    JsonAsset,
    Node,
    Prefab,
    Sprite,
    SpriteFrame,
    Tween,
    Vec3,
    instantiate,
    resources,
    tween,
} from 'cc';
import { TurnManager } from '../Manager/TurnManager';
import { GameState } from '../Manager/GameState';
import { ItemType, MazeLevelData } from '../Maze/MazeData';
import { BrokenWall } from '../Player/TurtleAgent';
import { BreakableWallView } from '../Maze/BreakableWallView';
import { PointItemAnimator } from '../Maze/PointItemAnimator';
import { StartRun } from './StartRun';
import { TurtleFrameAnimator } from '../Player/TurtleFrameAnimator';
const { ccclass, property } = _decorator;

const CELL_SIZE = 128;
const MOVE_TWEEN_DURATION = 0.45;
const FLOW_TWEEN_DURATION = 0.28;
const POINT_ITEM_NAMES = [
    '', 'swim_float', 'shell', 'icecream',
    'coconut', 'compass', 'snail', 'starfish',
];

interface TurtleViewState extends GameState {
    isFlowMove?: boolean;
}

@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
    @property(Prefab) levelPrefab: Prefab = null;
    @property(Prefab) itemPrefab: Prefab = null;
    @property(Node) levelHost: Node = null;
    @property(Node) turtleNode: Node = null;
    @property(TurnManager) turnManager: TurnManager = null;
    @property levelName: string = 'level_01';

    private levelData: MazeLevelData = null;
    private levelNode: Node = null;
    private readonly itemNodes = new Map<number, Node>();
    private readonly pointItemFrames = new Map<number, SpriteFrame>();
    private turtleAnimator: TurtleFrameAnimator = null;
    private isReady = false;

    onLoad() {
        StartRun.eventTarget.on('start-run', this.onStartRun, this);
        TurnManager.eventTarget.on('turtle-moved', this.onTurtleMoved, this);
        TurnManager.eventTarget.on('walls-broken', this.onWallsBroken, this);
    }

    onDestroy() {
        StartRun.eventTarget.off('start-run', this.onStartRun, this);
        TurnManager.eventTarget.off('turtle-moved', this.onTurtleMoved, this);
        this.turtleAnimator?.stop();
        TurnManager.eventTarget.off('walls-broken', this.onWallsBroken, this);
    }

    start() {
        if (!this.levelPrefab) {
            console.error('GameBootstrap is missing levelPrefab');
            return;
        }

        // TurnManager nằm cùng GameController; vẫn cho phép kéo reference từ Inspector.
        this.turnManager ??= this.getComponent(TurnManager);
        if (!this.turnManager) {
            console.error('GameBootstrap is missing TurnManager');
            return;
        }

        const host = this.levelHost ?? this.node;
        // Tái sử dụng prefab map đã đặt sẵn trong scene để không tạo hai map chồng nhau.
        const levelNode = host.children.find(child => /^Level_\d+$/.test(child.name))
            ?? instantiate(this.levelPrefab);
        if (!levelNode.parent) host.addChild(levelNode);
        this.levelNode = levelNode;

        // Prefab tĩnh đã chứa sẵn Terrain/Walls.
        if (!this.turtleNode) {
            console.error('GameBootstrap is missing turtleNode');
            return;
        }

        // Map là prefab tĩnh. Đưa rùa vào map ngay để luôn render trên cùng.
        this.turtleNode.setParent(levelNode, false);
        this.turtleAnimator = this.turtleNode.getComponent(TurtleFrameAnimator)
            ?? this.turtleNode.addComponent(TurtleFrameAnimator);

        // JSON chỉ cung cấp start và gameplay data, không dùng để dựng map.
        resources.load(`levels/${this.levelName}`, JsonAsset, (err, asset) => {
            if (err) { console.error(err); return; }
            const data = asset.json as MazeLevelData;

            this.levelData = data;
            this.setTurtlePosition(data.start.row, data.start.col);
            // Hướng mặc định của gameplay là Right; sau init sẽ tween sang hướng mở hợp lệ.
            this.turtleNode.setRotationFromEuler(0, 0, this.facingToAngle(1));
            this.loadPointItemFrames(() => {
                this.spawnCellItems(levelNode, data);
                const initialState = this.turnManager.init(data);
                this.tweenInitialFacing(initialState.facing);
                this.isReady = true;
            });
        });
    }

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

    // Terrain/Walls vẫn nằm sẵn trong Level prefab; chỉ item gameplay được đọc từ JSON.
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

            // Lệch pha theo index để icon trên map không scale đồng loạt.
            itemNode.addComponent(PointItemAnimator).configure(index * 0.073);

            this.itemNodes.set(index, itemNode);
        }
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
