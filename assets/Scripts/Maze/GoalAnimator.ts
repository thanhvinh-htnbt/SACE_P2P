import { _decorator, Component, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GoalAnimator')
export class GoalAnimator extends Component {
    @property bobHeight = 7;
    @property cycleDuration = 1.5;
    @property maxScale = 1.08;
    @property tiltAngle = 2;

    private elapsed = 0;
    private basePosition = new Vec3();

    start() {
        this.basePosition.set(this.node.position);
    }

    update(dt: number) {
        if (!this.node?.isValid) return;
        this.elapsed = (this.elapsed + Math.min(dt, 0.1)) % Math.max(0.2, this.cycleDuration);
        const phase = this.elapsed / Math.max(0.2, this.cycleDuration) * Math.PI * 2;
        const wave = (Math.sin(phase) + 1) * 0.5;
        const scale = 1 + (this.maxScale - 1) * wave;

        this.node.setPosition(
            this.basePosition.x,
            this.basePosition.y + Math.sin(phase) * this.bobHeight,
            this.basePosition.z,
        );
        this.node.setScale(scale, scale, 1);
        this.node.setRotationFromEuler(0, 0, Math.sin(phase) * this.tiltAngle);
    }
}
