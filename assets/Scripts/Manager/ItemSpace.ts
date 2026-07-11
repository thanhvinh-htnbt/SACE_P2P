import { _decorator, Component, director, instantiate, JsonAsset, Node, Prefab, resources, UITransform, Vec3 } from 'cc';
import { Inventory, ItemType, MazeLevelData } from '../Maze/MazeData';
import { Dir } from '../Maze/MazeConstants';
import { DraggableItem, InventoryItemKind, ItemDropRequest } from './DraggableItem';
import { TurnManager, TurnPhase } from './TurnManager';
import { LevelProgress } from './LevelProgress';
const { ccclass, property } = _decorator;

@ccclass('ItemSpace')
export class ItemSpace extends Component {
    @property(Node) content: Node = null;
    @property(Prefab) wallHPrefab: Prefab = null;
    @property(Prefab) wallVPrefab: Prefab = null;
    @property(Prefab) foodPrefab: Prefab = null;
    @property(Prefab) stepBonusPrefab: Prefab = null;
    @property columns = 2;
    @property spacingX = 130;
    @property spacingY = 150;

    private levelData: MazeLevelData = null;

    onEnable() {
        DraggableItem.events.on('drop', this.onItemDrop, this);
        TurnManager.eventTarget.on('phase-changed', this.onPhaseChanged, this);
    }

    onDisable() {
        DraggableItem.events.off('drop', this.onItemDrop, this);
        TurnManager.eventTarget.off('phase-changed', this.onPhaseChanged, this);
    }

    private onPhaseChanged(phase: TurnPhase) {
        const canEdit = phase === TurnPhase.PlacingItem;
        for (const draggable of this.node.getComponentsInChildren(DraggableItem)) {
            draggable.enabled = canEdit;
        }
    }

    start() {
        const selectedLevel = LevelProgress.getSelectedLevel();
        resources.load(`levels/${selectedLevel}`, JsonAsset, (err, asset) => {
            if (err) {
                console.error(`ItemSpace cannot load ${selectedLevel}`, err);
                return;
            }
            this.levelData = asset.json as MazeLevelData;
            this.populate(this.levelData.inventory);
        });
    }

    populate(inventory: Inventory) {
        const content = this.content ?? this.node;
        content.removeAllChildren();

        const entries: Array<[Prefab, number, InventoryItemKind]> = [
            [this.wallHPrefab, inventory.wallH, 'wallH'],
            [this.wallVPrefab, inventory.wallV, 'wallV'],
            [this.foodPrefab, inventory.food, 'food'],
            [this.stepBonusPrefab, inventory.stepBonus, 'stepBonus'],
        ];

        let index = 0;
        for (const [prefab, count, kind] of entries) {
            if (!prefab || count <= 0) continue;
            for (let i = 0; i < count; i++) {
                const item = instantiate(prefab);
                item.name = `${kind}_${i + 1}`;
                this.setLayerRecursively(item, this.node.layer);
                content.addChild(item);

                const row = Math.floor(index / Math.max(1, this.columns));
                const col = index % Math.max(1, this.columns);
                const x = (col - (Math.max(1, this.columns) - 1) / 2) * this.spacingX;
                item.setPosition(new Vec3(x, -row * this.spacingY, 0));
                item.addComponent(DraggableItem).configure(kind);
                index++;
            }
        }
    }

    private setLayerRecursively(node: Node, layer: number) {
        node.layer = layer;
        for (const child of node.children) this.setLayerRecursively(child, layer);
    }

    private onItemDrop(request: ItemDropRequest) {
        if (!this.levelData) return;

        const map = this.findMapRoot(director.getScene());
        if (!map) return;

        const local = new Vec3();
        map.inverseTransformPoint(local, request.worldPosition);
        const cellSize = 128;
        let x: number;
        let y: number;
        let target = map;
        let wallCell: { row: number; col: number; dir: Dir } | null = null;

        if (request.kind === 'wallH') {
            const col = Math.round(local.x / cellSize);
            const boundary = Math.round((cellSize / 2 - local.y) / cellSize);
            // Chỉ đặt ở cạnh giữa hai ô; viền ngoài đã là wall cố định.
            if (col < 0 || col >= this.levelData.cols
                || boundary <= 0 || boundary >= this.levelData.rows) return;
            x = col * cellSize;
            y = cellSize / 2 - boundary * cellSize;
            target = map.getChildByName('Walls') ?? map;
            wallCell = { row: boundary - 1, col, dir: 2 };
        } else if (request.kind === 'wallV') {
            const boundary = Math.round((local.x + cellSize / 2) / cellSize);
            const row = Math.round(-local.y / cellSize);
            if (boundary <= 0 || boundary >= this.levelData.cols
                || row < 0 || row >= this.levelData.rows) return;
            x = -cellSize / 2 + boundary * cellSize;
            y = -row * cellSize;
            target = map.getChildByName('Walls') ?? map;
            wallCell = { row, col: boundary - 1, dir: 1 };
        } else {
            const col = Math.round(local.x / cellSize);
            const row = Math.round(-local.y / cellSize);
            if (col < 0 || col >= this.levelData.cols
                || row < 0 || row >= this.levelData.rows) return;
            x = col * cellSize;
            y = -row * cellSize;
        }

        const turnManager = this.findTurnManager(director.getScene());
        if (!turnManager) return;
        if (wallCell) {
            if (!turnManager.placeItem(
                wallCell.row,
                wallCell.col,
                wallCell.dir,
                ItemType.Wall,
            )) return;
        } else if (request.kind === 'food') {
            const col = Math.round(local.x / cellSize);
            const row = Math.round(-local.y / cellSize);
            if (!turnManager.placeItem(row, col, null, ItemType.Food)) return;
        }

        if (wallCell) this.applySystemWallSize(request.item, request.kind);
        request.item.setParent(target);
        request.item.setPosition(x, y, 0);
        const draggable = request.item.getComponent(DraggableItem);
        if (draggable) draggable.enabled = false;
        request.accept();
    }

    /**
     * Wall trong ItemSpace giữ kích thước preview 128x32 để dễ kéo.
     * Khi đặt xuống, chuyển về đúng format wall tĩnh trong Level prefab:
     * UITransform 8x128; wall ngang xoay 90°, wall dọc giữ 0°.
     */
    private applySystemWallSize(item: Node, kind: InventoryItemKind) {
        item.setScale(1, 1, 1);
        item.setRotationFromEuler(0, 0, kind === 'wallH' ? 90 : 0);
        this.setWallTransformSize(item);
    }

    private setWallTransformSize(node: Node) {
        const transform = node.getComponent(UITransform);
        if (transform) transform.setContentSize(8, 128);
        for (const child of node.children) this.setWallTransformSize(child);
    }

    private findMapRoot(node: Node): Node | null {
        if (/^Level_\d+$/i.test(node.name)
            && node.getChildByName('Terrain')
            && node.getChildByName('Walls')) return node;

        for (const child of node.children) {
            const result = this.findMapRoot(child);
            if (result) return result;
        }
        return null;
    }

    private findTurnManager(node: Node): TurnManager | null {
        const manager = node.getComponent(TurnManager);
        if (manager) return manager;
        for (const child of node.children) {
            const result = this.findTurnManager(child);
            if (result) return result;
        }
        return null;
    }
}
