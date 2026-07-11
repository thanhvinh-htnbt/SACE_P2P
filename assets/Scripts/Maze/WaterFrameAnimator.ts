import { _decorator, Component, resources, Sprite, SpriteFrame } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('WaterFrameAnimator')
export class WaterFrameAnimator extends Component {
    @property frameInterval = 0.20;

    private static cachedFrames: SpriteFrame[] = [];
    private static loadingPromise: Promise<SpriteFrame[]> = null;

    private sprite: Sprite = null;
    private frames: SpriteFrame[] = [];
    private elapsed = 0;
    private frameIndex = 0;
    private phaseOffset = 0;

    onLoad() {
        this.sprite = this.getComponentInChildren(Sprite);
        if (!this.sprite) {
            console.error('WaterFrameAnimator requires a Sprite in the Flow node');
            return;
        }

        void WaterFrameAnimator.loadFrames().then(frames => {
            if (!this.isValid || !this.node?.isValid) return;
            // Chạy tới rồi chạy lùi để không giật khi frame cuối quay thẳng về frame đầu.
            this.frames = frames.length > 2
                ? [...frames, ...frames.slice(1, -1).reverse()]
                : frames;
            if (this.frames.length === 0) return;

            const interval = Math.max(0.04, this.frameInterval);
            this.frameIndex = Math.floor(this.phaseOffset / interval) % this.frames.length;
            this.elapsed = this.phaseOffset % interval;
            this.showFrame();
        });
    }

    configure(phaseOffset: number) {
        this.phaseOffset = Math.max(0, phaseOffset);
    }

    update(dt: number) {
        if (this.frames.length < 2 || !this.sprite?.isValid) return;

        const interval = Math.max(0.04, this.frameInterval);
        this.elapsed += Math.min(dt, 0.1);
        while (this.elapsed >= interval) {
            this.elapsed -= interval;
            this.frameIndex = (this.frameIndex + 1) % this.frames.length;
            this.showFrame();
        }
    }

    private showFrame() {
        if (this.sprite?.isValid && this.frames.length > 0) {
            this.sprite.spriteFrame = this.frames[this.frameIndex];
        }
    }

    private static loadFrames(): Promise<SpriteFrame[]> {
        if (this.cachedFrames.length > 0) return Promise.resolve(this.cachedFrames);
        if (this.loadingPromise) return this.loadingPromise;

        this.loadingPromise = new Promise(resolve => {
            resources.loadDir('anim_water', SpriteFrame, (error, assets) => {
                if (error) {
                    console.error('Cannot load resources/anim_water', error);
                    this.loadingPromise = null;
                    resolve([]);
                    return;
                }

                this.cachedFrames = assets
                    .filter(frame => /^water(?:_\d+)?$/.test(frame.name))
                    .sort((a, b) => this.frameNumber(a.name) - this.frameNumber(b.name));
                this.loadingPromise = null;
                resolve(this.cachedFrames);
            });
        });
        return this.loadingPromise;
    }

    private static frameNumber(name: string): number {
        if (name === 'water') return 0;
        return Number(name.match(/(\d+)$/)?.[1] ?? Number.MAX_SAFE_INTEGER);
    }
}
