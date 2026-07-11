import {
    _decorator,
    Color,
    Component,
    HorizontalTextAlignment,
    JsonAsset,
    Label,
    Node,
    Prefab,
    UITransform,
    Tween,
    Vec3,
    VerticalTextAlignment,
    instantiate,
    resources,
    tween,
} from 'cc';
import { TurnManager } from '../Manager/TurnManager';
import { GameState } from '../Manager/GameState';
import { ItemType, MazeLevelData } from '../Maze/MazeData';
import { BoardBtnNumber } from './BoardBtnNumber';
const { ccclass, property } = _decorator;

const CELL_SIZE = 128;
const MOVE_TWEEN_DURATION = 0.45;
const FLOW_TWEEN_DURATION = 0.28;

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
    private readonly itemNodes = new Map<number, Node>();
    private isReady = false;

    onLoad() {
        // Board phát số bước; TurnManager phát vị trí mới của rùa.
        BoardBtnNumber.eventTarget.on('go', this.onGo, this);
        TurnManager.eventTarget.on('turtle-moved', this.onTurtleMoved, this);
    }

    onDestroy() {
        BoardBtnNumber.eventTarget.off('go', this.onGo, this);
        TurnManager.eventTarget.off('turtle-moved', this.onTurtleMoved, this);
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

        // Prefab tĩnh đã chứa sẵn Terrain/Walls.
        if (!this.turtleNode) {
            console.error('GameBootstrap is missing turtleNode');
            return;
        }

        // Map là prefab tĩnh. Đưa rùa vào map ngay để luôn render trên cùng.
        this.turtleNode.setParent(levelNode, false);

        // JSON chỉ cung cấp start và gameplay data, không dùng để dựng map.
        resources.load(`levels/${this.levelName}`, JsonAsset, (err, asset) => {
            if (err) { console.error(err); return; }
            const data = asset.json as MazeLevelData;

            this.levelData = data;
            this.setTurtlePosition(data.start.row, data.start.col);
            this.turtleNode.setRotationFromEuler(0, 0, this.facingToAngle(1));
            this.spawnCellItems(levelNode, data);
            this.turnManager.init(data);
            this.isReady = true;
        });
    }

    // Mỗi lần bấm Go: bỏ qua phase đặt item ở bản test và cho rùa đi số bước đã nhập.
    private onGo(steps: number) {
        if (!this.isReady || !this.turnManager) return;

        this.turnManager.confirmPlacement();
        void this.turnManager.chooseSteps(steps);
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
        tween(node)
            .to(duration, {
                position: targetPosition,
                angle: tweenAngle,
            }, { easing: 'sineInOut' })
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

            const labelNode = new Node('ValueLabel');
            labelNode.layer = itemNode.layer;
            itemNode.addChild(labelNode);

            const transform = labelNode.addComponent(UITransform);
            transform.setContentSize(100, 100);

            const label = labelNode.addComponent(Label);
            label.string = String(cell.itemValue ?? 1);
            label.fontSize = 48;
            label.lineHeight = 52;
            label.color = new Color(30, 30, 30, 255);
            label.horizontalAlign = HorizontalTextAlignment.CENTER;
            label.verticalAlign = VerticalTextAlignment.CENTER;

            this.itemNodes.set(index, itemNode);
        }
    }
}
