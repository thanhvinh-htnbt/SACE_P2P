import { _decorator, Component, resources, Sprite, SpriteFrame } from 'cc';
const { ccclass } = _decorator;

@ccclass('WallTheme')
export class WallTheme extends Component {
    private static readonly framePromises = new Map<string, Promise<SpriteFrame | null>>();
    private isBoundary = false;

    configure(isBoundary: boolean) {
        this.isBoundary = isBoundary;
        void this.applyTheme();
    }

    private async applyTheme() {
        const assetName = this.isBoundary ? 'wall-bird' : 'wall-seaweed';
        const frame = await WallTheme.loadFrame(assetName);
        if (!frame || !this.isValid || !this.node?.isValid) return;
        for (const sprite of this.getComponentsInChildren(Sprite)) sprite.spriteFrame = frame;
    }

    private static loadFrame(assetName: string): Promise<SpriteFrame | null> {
        const cached = this.framePromises.get(assetName);
        if (cached) return cached;

        const request = new Promise<SpriteFrame | null>(resolve => {
            resources.load(`sprite/${assetName}/spriteFrame`, SpriteFrame, (error, frame) => {
                if (error) {
                    console.error(`Cannot load sprite/${assetName}`, error);
                    this.framePromises.delete(assetName);
                    resolve(null);
                    return;
                }
                resolve(frame);
            });
        });
        this.framePromises.set(assetName, request);
        return request;
    }
}
