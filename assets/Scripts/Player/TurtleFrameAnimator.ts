import { _decorator, Component, Sprite, SpriteFrame, resources } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('TurtleFrameAnimator')
export class TurtleFrameAnimator extends Component {
    // Giữ property riêng để tương thích scene/prefab cũ và dễ gán trong Inspector.
    @property(SpriteFrame) frame1: SpriteFrame = null;
    @property(SpriteFrame) frame2: SpriteFrame = null;
    @property(SpriteFrame) frame3: SpriteFrame = null;
    @property(SpriteFrame) frame4: SpriteFrame = null;
    @property(SpriteFrame) frame5: SpriteFrame = null;
    @property(SpriteFrame) frame6: SpriteFrame = null;

    /** Tốc độ fallback khi play() không nhận duration. */
    @property frameInterval = 0.075;
    /** Bật để phát 1→6→1; tắt để loop 1→6→1 trực tiếp. */
    @property pingPong = false;
    @property returnToIdleOnStop = true;
    @property idleMinScale = 1.176471;
    @property idleMaxScale = 1.3;
    /** Thời gian đi từ scale nhỏ nhất tới lớn nhất; chu kỳ đầy đủ dài gấp đôi. */
    @property idleHalfCycle = 0.65;

    private sprite: Sprite = null;
    private frames: SpriteFrame[] = [];
    private playbackOrder: number[] = [];
    private orderCursor = 0;
    private elapsed = 0;
    private activeInterval = 0.075;
    private isPlaying = false;
    private idleElapsed = 0;

    onLoad() {
        this.sprite = this.getComponent(Sprite);
        if (!this.sprite) {
            console.error('TurtleFrameAnimator requires a Sprite on the same node');
            return;
        }
        this.applyIdleScale(this.idleMinScale);

        const inspectorFrames = [
            this.frame1, this.frame2, this.frame3,
            this.frame4, this.frame5, this.frame6,
        ].filter((frame): frame is SpriteFrame => frame !== null);

        if (inspectorFrames.length === 6) {
            this.setFrames(inspectorFrames);
            return;
        }

        // Fallback tự load turtle_1..turtle_6 nếu Inspector chưa gán đủ.
        resources.loadDir('anim', SpriteFrame, (err, assets) => {
            if (err) {
                console.error('Cannot load turtle animation frames', err);
                return;
            }
            if (!this.isValid) return;

            const loadedFrames = assets
                .filter(frame => /^turtle_[1-6]$/.test(frame.name))
                .sort((a, b) => this.frameNumber(a) - this.frameNumber(b));

            if (loadedFrames.length !== 6) {
                console.warn(`TurtleFrameAnimator expected 6 frames, found ${loadedFrames.length}`);
            }
            this.setFrames(loadedFrames);
        });
    }

    update(dt: number) {
        if (!this.isPlaying) {
            this.updateIdleBreathing(dt);
            return;
        }
        if (this.playbackOrder.length < 2) return;

        this.elapsed += Math.min(dt, 0.1);
        while (this.elapsed >= this.activeInterval) {
            this.elapsed -= this.activeInterval;
            this.orderCursor = (this.orderCursor + 1) % this.playbackOrder.length;
            this.showCurrentFrame();
        }
    }

    /**
     * Phát animation. Khi có cycleDuration, toàn bộ frame được trải đều đúng
     * theo thời gian tween di chuyển nên animation thường/Flow đều chạy đủ nhịp.
     */
    play(cycleDuration = 0) {
        this.isPlaying = true;
        this.idleElapsed = 0;
        this.applyIdleScale(this.idleMinScale);
        this.elapsed = 0;
        this.orderCursor = 0;
        this.activeInterval = cycleDuration > 0 && this.playbackOrder.length > 0
            ? Math.max(0.03, cycleDuration / this.playbackOrder.length)
            : Math.max(0.03, this.frameInterval);
        this.showCurrentFrame();
    }

    stop() {
        this.isPlaying = false;
        this.elapsed = 0;
        this.orderCursor = 0;
        this.idleElapsed = 0;
        this.applyIdleScale(this.idleMinScale);
        if (this.returnToIdleOnStop) this.showIdleFrame();
    }

    onDisable() {
        this.stop();
    }

    private setFrames(frames: SpriteFrame[]) {
        this.frames = frames;
        this.playbackOrder = frames.map((_, index) => index);
        if (this.pingPong && frames.length > 2) {
            for (let index = frames.length - 2; index > 0; index--) {
                this.playbackOrder.push(index);
            }
        }

        if (this.isPlaying) this.showCurrentFrame();
        else this.showIdleFrame();
    }

    private showCurrentFrame() {
        if (!this.sprite || this.frames.length === 0 || this.playbackOrder.length === 0) return;
        this.sprite.spriteFrame = this.frames[this.playbackOrder[this.orderCursor]];
    }

    private showIdleFrame() {
        if (this.sprite && this.frames.length > 0) this.sprite.spriteFrame = this.frames[0];
    }

    private updateIdleBreathing(dt: number) {
        const halfCycle = Math.max(0.1, this.idleHalfCycle);
        const fullCycle = halfCycle * 2;
        this.idleElapsed = (this.idleElapsed + Math.min(dt, 0.1)) % fullCycle;

        // 0 → 1 → 0 với vận tốc đầu/cuối bằng 0, tạo nhịp thở mềm mại.
        const normalized = (1 - Math.cos(
            Math.PI * 2 * this.idleElapsed / fullCycle,
        )) * 0.5;
        const scale = this.idleMinScale
            + (this.idleMaxScale - this.idleMinScale) * normalized;
        this.applyIdleScale(scale);
    }

    private applyIdleScale(scale: number) {
        this.node.setScale(scale, scale, this.node.scale.z);
    }

    private frameNumber(frame: SpriteFrame): number {
        return Number(frame.name.match(/(\d+)$/)?.[1] ?? 0);
    }
}
