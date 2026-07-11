import { _decorator, Component } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('PointItemAnimator')
export class PointItemAnimator extends Component {
    @property minScale = 0.8;
    @property maxScale = 1;
    /** Thời gian scale từ 0.8 lên 1; chu kỳ đầy đủ dài gấp đôi. */
    @property halfCycle = 0.6;

    private elapsed = 0;

    configure(phaseOffset: number) {
        const fullCycle = Math.max(0.1, this.halfCycle) * 2;
        this.elapsed = Math.max(0, phaseOffset) % fullCycle;
        this.renderCurrentScale(fullCycle);
    }

    onEnable() {
        this.applyScale(this.minScale);
    }

    update(dt: number) {
        const halfCycle = Math.max(0.1, this.halfCycle);
        const fullCycle = halfCycle * 2;
        this.elapsed = (this.elapsed + Math.min(dt, 0.1)) % fullCycle;

        this.renderCurrentScale(fullCycle);
    }

    private renderCurrentScale(fullCycle: number) {
        // Cosine cho vận tốc bằng 0 tại min/max: 0.8 → 1 → 0.8 thật mượt.
        const normalized = (1 - Math.cos(
            Math.PI * 2 * this.elapsed / fullCycle,
        )) * 0.5;
        const scale = this.minScale + (this.maxScale - this.minScale) * normalized;
        this.applyScale(scale);
    }

    onDisable() {
        this.applyScale(this.minScale);
    }

    private applyScale(scale: number) {
        this.node.setScale(scale, scale, this.node.scale.z);
    }
}
