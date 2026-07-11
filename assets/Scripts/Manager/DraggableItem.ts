import { _decorator, Component, EventTarget, EventTouch, Node, UITransform, Vec3 } from 'cc';
const { ccclass } = _decorator;

export type InventoryItemKind = 'wallH' | 'wallV' | 'food' | 'stepBonus';

export interface ItemDropRequest {
    item: Node;
    kind: InventoryItemKind;
    worldPosition: Vec3;
    accepted: boolean;
    accept: () => void;
}

@ccclass('DraggableItem')
export class DraggableItem extends Component {
    static readonly events = new EventTarget();

    private kind: InventoryItemKind = 'food';
    private homePosition = new Vec3();
    private dragging = false;

    configure(kind: InventoryItemKind) {
        this.kind = kind;
        this.homePosition.set(this.node.position);
    }

    onEnable() {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    onDisable() {
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    private onTouchStart() {
        this.dragging = true;
        const parent = this.node.parent;
        if (parent) this.node.setSiblingIndex(parent.children.length - 1);
    }

    private onTouchMove(event: EventTouch) {
        if (!this.dragging || !this.node.parent) return;
        const point = event.getUILocation();
        const parentTransform = this.node.parent.getComponent(UITransform);
        if (!parentTransform) return;
        const local = parentTransform.convertToNodeSpaceAR(new Vec3(point.x, point.y, 0));
        this.node.setPosition(local);
    }

    private onTouchEnd() {
        if (!this.dragging) return;
        this.dragging = false;

        const request: ItemDropRequest = {
            item: this.node,
            kind: this.kind,
            worldPosition: this.node.worldPosition.clone(),
            accepted: false,
            accept: () => { request.accepted = true; },
        };
        DraggableItem.events.emit('drop', request);

        if (!request.accepted) this.node.setPosition(this.homePosition);
    }
}
