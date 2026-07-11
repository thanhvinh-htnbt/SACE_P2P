import { _decorator, Component, Sprite, SpriteFrame, Tween, Vec3, tween } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('BreakableWallView')
export class BreakableWallView extends Component {
    @property(Sprite) targetSprite: Sprite = null;
    @property([SpriteFrame]) frames: SpriteFrame[] = [];
    @property frameDuration = 0.08;

    play() {
        this.unscheduleAllCallbacks();
        Tween.stopAllByTarget(this.node);

        if (!this.targetSprite || this.frames.length <= 1) {
            this.finishBreak();
            return;
        }

        let index = 0;
        const showNextFrame = () => {
            if (index >= this.frames.length) {
                this.finishBreak();
                return;
            }
            this.targetSprite.spriteFrame = this.frames[index++];
            this.scheduleOnce(showNextFrame, this.frameDuration);
        };
        showNextFrame();
    }

    private finishBreak() {
        tween(this.node)
            .to(0.22, { scale: new Vec3(0, 0, 1) }, { easing: 'backIn' })
            .call(() => { this.node.active = false; })
            .start();
    }
}
