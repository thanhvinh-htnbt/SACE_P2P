import { _decorator, Component, Sprite, SpriteFrame, resources } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('TurtleFrameAnimator')
export class TurtleFrameAnimator extends Component {
    @property(SpriteFrame) frame1: SpriteFrame = null;
    @property(SpriteFrame) frame2: SpriteFrame = null;
    @property(SpriteFrame) frame3: SpriteFrame = null;
    @property frameInterval = 0.1;

    private sprite: Sprite = null;
    private frames: SpriteFrame[] = [];
    private frameCursor = 0;
    private isPlaying = false;
    private readonly frameOrder = [0, 1, 2, 1];

    onLoad() {
        this.sprite = this.getComponent(Sprite);
        if (!this.sprite) {
            console.error('TurtleFrameAnimator requires a Sprite on the same node');
            return;
        }

        const inspectorFrames = [this.frame1, this.frame2, this.frame3]
            .filter((frame): frame is SpriteFrame => frame !== null);
        if (inspectorFrames.length === 3) {
            this.frames = inspectorFrames;
            this.showFirstFrame();
            return;
        }

        // Tự load ba ảnh assets/resources/anim/turtle_1..3 để không phải kéo tay trong Inspector.
        resources.loadDir('anim', SpriteFrame, (err, assets) => {
            if (err) {
                console.error('Cannot load turtle animation frames', err);
                return;
            }
            if (!this.isValid) return;

            this.frames = assets
                .filter(frame => /^turtle_[1-3]$/.test(frame.name))
                .sort((a, b) => a.name.localeCompare(b.name));

            if (this.frames.length < 3) {
                console.warn(`TurtleFrameAnimator expected 3 frames, found ${this.frames.length}`);
            }

            if (this.isPlaying) this.startFrameLoop();
            else this.showFirstFrame();
        });
    }

    play() {
        this.isPlaying = true;
        this.startFrameLoop();
    }

    stop() {
        this.isPlaying = false;
        this.unschedule(this.advanceFrame);
        this.frameCursor = 0;
        this.showFirstFrame();
    }

    onDisable() {
        this.stop();
    }

    onDestroy() {
        this.unschedule(this.advanceFrame);
    }

    private startFrameLoop() {
        this.unschedule(this.advanceFrame);
        this.frameCursor = 0;

        if (!this.sprite || this.frames.length === 0) return;

        this.showCurrentFrame();
        if (this.frames.length > 1) {
            this.schedule(this.advanceFrame, Math.max(0.05, this.frameInterval));
        }
    }

    private readonly advanceFrame = () => {
        if (!this.isPlaying) return;
        this.frameCursor = (this.frameCursor + 1) % this.frameOrder.length;
        this.showCurrentFrame();
    };

    private showCurrentFrame() {
        if (!this.sprite || this.frames.length === 0) return;

        const orderedIndex = this.frameOrder[this.frameCursor];
        const safeIndex = Math.min(orderedIndex, this.frames.length - 1);
        this.sprite.spriteFrame = this.frames[safeIndex];
    }

    private showFirstFrame() {
        if (this.sprite && this.frames.length > 0) {
            this.sprite.spriteFrame = this.frames[0];
        }
    }
}
