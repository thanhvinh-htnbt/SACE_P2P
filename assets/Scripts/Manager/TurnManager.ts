import { _decorator, Component } from 'cc';
import { EventTarget } from 'cc';
import { MazeLevelData, ItemType } from '../Maze/MazeData';
import { MazePathfinder } from '../Maze/MazePathfinder';
import { Dir } from '../Maze/MazeConstants';
import { GameState } from './GameState';
import { TurtleAgent } from '../Player/TurtleAgent';
const { ccclass } = _decorator;

export enum TurnPhase {
    PlacingItem,   // người chơi đang đặt item
    ChoosingSteps, // người chơi chọn số bước
    TurtleMoving,  // rùa đang tự di chuyển, khóa input
    GameEnded,
}

@ccclass('TurnManager')
export class TurnManager extends Component {
    static eventTarget = new EventTarget(); // Manager -> UI

    private data: MazeLevelData;
    private pathfinder: MazePathfinder;
    private state: GameState;
    private turtle: TurtleAgent;
    private phase: TurnPhase = TurnPhase.PlacingItem;

    init(data: MazeLevelData) {
        this.data = data;
        this.pathfinder = new MazePathfinder(data);
        this.state = {
            turtleRow: data.start.row,
            turtleCol: data.start.col,
            facing: 1,
            stepsUsed: 0,
            scoreCollected: 0,
            isMoving: false,
            isGameOver: false,
            isWin: false,
        };
        this.turtle = new TurtleAgent(this.state, this.pathfinder, data);
        this.phase = TurnPhase.PlacingItem;
        TurnManager.eventTarget.emit('state-changed', this.state);
    }

    // Người chơi đặt item lên 1 ô (tường hoặc food)
    placeItem(row: number, col: number, dir: Dir | null, itemType: ItemType, value?: number) {
        if (this.phase !== TurnPhase.PlacingItem) return;

        if (itemType === ItemType.Wall && dir !== null) {
            const turtlePos = { row: this.state.turtleRow, col: this.state.turtleCol };
            if (!this.pathfinder.canPlaceWallSafely(row, col, dir, turtlePos)) {
                TurnManager.eventTarget.emit('wall-blocked-invalid');
                return;
            }
            this.pathfinder.placeWall(row, col, dir);
        } else if (itemType === ItemType.Food) {
            const idx = row * this.data.cols + col;
            this.data.cells[idx].item = ItemType.Food;
            this.data.cells[idx].itemValue = value ?? 1;
        }

        TurnManager.eventTarget.emit('maze-changed', this.data);
    }

    // Người chơi xác nhận xong việc đặt item, chuyển sang chọn số bước
    confirmPlacement() {
        this.phase = TurnPhase.ChoosingSteps;
        TurnManager.eventTarget.emit('phase-changed', this.phase);
    }

    // Người chơi chọn số bước, bắt đầu rùa tự di chuyển
    async chooseSteps(steps: number) {
        if (this.phase !== TurnPhase.ChoosingSteps) return;
        this.phase = TurnPhase.TurtleMoving;
        this.state.isMoving = true;
        TurnManager.eventTarget.emit('phase-changed', this.phase);

        for (let i = 0; i < steps; i++) {
            if (this.state.isGameOver) break;

            const moved = this.turtle.step(); // di chuyển 1 ô, trả về false nếu kẹt hoàn toàn
            this.state.stepsUsed++;

            this.checkCellItem();
            TurnManager.eventTarget.emit('turtle-moved', { ...this.state });

            await this.delay(300); // animation timing, tùy bạn chỉnh

            if (!moved) break; // rùa không còn đường đi -> dừng sớm
            if (this.isAtGoal()) break; // tới đích sớm hơn số bước đã chọn -> dừng
        }

        this.state.isMoving = false;
        this.evaluateWinCondition();

        if (!this.state.isGameOver) {
            this.phase = TurnPhase.PlacingItem; // quay lại lượt tiếp theo
            TurnManager.eventTarget.emit('phase-changed', this.phase);
        }
    }

    private checkCellItem() {
        const idx = this.state.turtleRow * this.data.cols + this.state.turtleCol;
        const cell = this.data.cells[idx];
        if (cell.item === ItemType.Food) {
            this.state.scoreCollected += cell.itemValue ?? 1;
            cell.item = ItemType.None;
            TurnManager.eventTarget.emit('food-collected', this.state.scoreCollected);
        }
    }

    private isAtGoal(): boolean {
        return this.state.turtleRow === this.data.goal.row
            && this.state.turtleCol === this.data.goal.col;
    }

    // Kiểm tra đủ cả 3 điều kiện thắng
    private evaluateWinCondition() {
        const { targetScore, maxSteps } = this.data.winCondition;

        if (this.isAtGoal()) {
            const scoreOk = this.state.scoreCollected >= targetScore;
            const stepsOk = this.state.stepsUsed <= maxSteps;

            this.state.isGameOver = true;
            this.state.isWin = scoreOk && stepsOk;
            this.phase = TurnPhase.GameEnded;

            TurnManager.eventTarget.emit('game-ended', {
                isWin: this.state.isWin,
                reason: !scoreOk ? 'not-enough-score' : !stepsOk ? 'too-many-steps' : 'success',
            });
            return;
        }

        // Chưa tới đích nhưng đã hết số bước cho phép -> thua
        if (this.state.stepsUsed >= maxSteps) {
            this.state.isGameOver = true;
            this.state.isWin = false;
            this.phase = TurnPhase.GameEnded;
            TurnManager.eventTarget.emit('game-ended', { isWin: false, reason: 'out-of-steps' });
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => this.scheduleOnce(resolve, ms / 1000));
    }
}