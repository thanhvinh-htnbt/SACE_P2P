import { _decorator, Component, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

/** Nhún label "+x" trên đầu item theo nhịp nảy để user chú ý giá trị điểm. */
@ccclass('ItemValueBadge')
export class ItemValueBadge extends Component {
    @property bounceHeight = 12;
    /** Thời gian một nhịp nảy đầy đủ. */
    @property cycleSeconds = 0.8;

    private phaseOffset = 0;
    private elapsed = 0;
    private readonly basePosition = new Vec3();

    /** Lệch pha theo index để các badge trên map không nảy đồng loạt. */
    configure(phaseOffset: number) {
        this.phaseOffset = phaseOffset;
    }

    onLoad() {
        this.basePosition.set(this.node.position);
    }

    update(dt: number) {
        this.elapsed += dt;
        const t = (this.elapsed + this.phaseOffset) / this.cycleSeconds * Math.PI;
        const offset = Math.abs(Math.sin(t)) * this.bounceHeight;
        this.node.setPosition(
            this.basePosition.x,
            this.basePosition.y + offset,
            this.basePosition.z,
        );
    }
}
