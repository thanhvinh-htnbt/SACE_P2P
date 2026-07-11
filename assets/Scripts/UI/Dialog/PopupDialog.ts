import { _decorator, Component, Node, Tween, tween, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

/**
 * Lớp cơ sở cho các modal dialog.
 *
 * Root node nên phủ toàn màn hình để chặn tương tác với gameplay phía sau.
 * Gán `panel` vào node chứa phần nội dung để chỉ panel được chạy hiệu ứng scale.
 */
@ccclass('PopupDialog')
export class PopupDialog extends Component {
    @property({ type: Node, tooltip: 'Node chứa nền và các nút của dialog.' })
    panel: Node = null;

    @property({ tooltip: 'Thời gian hiệu ứng mở/đóng (giây).' })
    animationDuration = 0.15;

    private readonly hiddenScale = new Vec3(0.9, 0.9, 1);
    private readonly shownScale = new Vec3(1, 1, 1);
    private isTransitioning = false;

    /** Hiện dialog. Có thể gọi dù root node của prefab đang inactive. */
    show(): void {
        if (this.isTransitioning || this.node.active) {
            return;
        }

        const panel = this.getPanel();
        this.isTransitioning = true;
        this.node.active = true;

        Tween.stopAllByTarget(panel);
        panel.setScale(this.hiddenScale);

        tween(panel)
            .to(this.animationDuration, { scale: this.shownScale }, { easing: 'backOut' })
            .call(() => {
                this.isTransitioning = false;
            })
            .start();
    }

    /** Ẩn dialog sau hiệu ứng đóng. */
    hide(): void {
        if (this.isTransitioning || !this.node.active) {
            return;
        }

        const panel = this.getPanel();
        this.isTransitioning = true;
        Tween.stopAllByTarget(panel);

        tween(panel)
            .to(this.animationDuration, { scale: this.hiddenScale }, { easing: 'backIn' })
            .call(() => {
                this.node.active = false;
                panel.setScale(this.shownScale);
                this.isTransitioning = false;
            })
            .start();
    }

    /** Hiện ngay, hữu ích khi không muốn chạy animation. */
    showImmediately(): void {
        const panel = this.getPanel();
        Tween.stopAllByTarget(panel);
        panel.setScale(this.shownScale);
        this.isTransitioning = false;
        this.node.active = true;
    }

    /** Ẩn ngay, thường dùng lúc khởi tạo UI. */
    hideImmediately(): void {
        const panel = this.getPanel();
        Tween.stopAllByTarget(panel);
        panel.setScale(this.shownScale);
        this.isTransitioning = false;
        this.node.active = false;
    }

    protected onDestroy(): void {
        if (this.panel?.isValid) {
            Tween.stopAllByTarget(this.panel);
        }
    }

    private getPanel(): Node {
        if (!this.panel) {
            console.warn(`${this.constructor.name}: panel chưa được gán, dùng root node thay thế.`);
        }

        return this.panel ?? this.node;
    }
}
