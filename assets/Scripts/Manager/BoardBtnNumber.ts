import { _decorator, Component, Node, Label, Button, EventTarget } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Bàn phím số cho người chơi nhập số bước rùa đi.
 * - Nút 0-9: nhập chữ số vào label
 * - Nút X: xóa 1 chữ số cuối
 * - Nút Clear: xóa hết
 * - Nút Go: xác nhận, phát event 'go' kèm số bước đã nhập
 *
 * Mỗi btn* là Node có sẵn component cc.Button. Bắt sự kiện click qua node.on.
 */
@ccclass('BoardBtnNumber')
export class BoardBtnNumber extends Component {
    /** Sự kiện board -> game. emit('go', steps:number) khi bấm Go. */
    static eventTarget = new EventTarget();

    @property(Label) numberLabel: Label = null;   // ô hiển thị số đã chọn

    @property(Node) btn0: Node = null;
    @property(Node) btn1: Node = null;
    @property(Node) btn2: Node = null;
    @property(Node) btn3: Node = null;
    @property(Node) btn4: Node = null;
    @property(Node) btn5: Node = null;
    @property(Node) btn6: Node = null;
    @property(Node) btn7: Node = null;
    @property(Node) btn8: Node = null;
    @property(Node) btn9: Node = null;
    @property(Node) btnX: Node = null;             // xóa 1 số
    @property(Node) btnClear: Node = null;         // xóa hết
    @property(Node) btnGo: Node = null;            // bắt đầu đi

    @property maxDigits: number = 3;               // giới hạn độ dài số nhập

    private current: string = '';

    private get digitButtons(): Node[] {
        return [this.btn0, this.btn1, this.btn2, this.btn3, this.btn4,
                this.btn5, this.btn6, this.btn7, this.btn8, this.btn9];
    }

    onLoad() {
        this.digitButtons.forEach((node, digit) => {
            if (node) node.on(Button.EventType.CLICK, () => this.onDigit(digit), this);
        });
        this.btnX?.on(Button.EventType.CLICK, this.onBackspace, this);
        this.btnClear?.on(Button.EventType.CLICK, this.onClear, this);
        this.btnGo?.on(Button.EventType.CLICK, this.onGo, this);
        this.refresh();
    }

    onDestroy() {
        this.digitButtons.forEach(node => node?.off(Button.EventType.CLICK));
        this.btnX?.off(Button.EventType.CLICK, this.onBackspace, this);
        this.btnClear?.off(Button.EventType.CLICK, this.onClear, this);
        this.btnGo?.off(Button.EventType.CLICK, this.onGo, this);
    }

    private onDigit(digit: number) {
        if (this.current.length >= this.maxDigits) return;
        // tránh số 0 đứng đầu (ví dụ "0", "05")
        if (this.current === '' && digit === 0) return;
        this.current += String(digit);
        this.refresh();
    }

    private onBackspace() {
        if (this.current.length > 0) {
            this.current = this.current.slice(0, -1);
            this.refresh();
        }
    }

    private onClear() {
        this.current = '';
        this.refresh();
    }

    private onGo() {
        const steps = this.getValue();
        if (steps <= 0) return; // chưa nhập số hợp lệ
        BoardBtnNumber.eventTarget.emit('go', steps);
        this.onClear();
    }

    /** Số bước hiện đang nhập (0 nếu chưa nhập). */
    getValue(): number {
        return this.current === '' ? 0 : parseInt(this.current, 10);
    }

    /** Reset bàn phím về rỗng (gọi từ ngoài sau khi bắt đầu lượt mới). */
    reset() {
        this.onClear();
    }

    private refresh() {
        if (this.numberLabel) {
            this.numberLabel.string = this.current === '' ? '' : this.current;
        }
    }
}
