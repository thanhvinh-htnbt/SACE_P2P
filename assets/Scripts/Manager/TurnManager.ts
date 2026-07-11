import { _decorator, Component } from 'cc';
import { EventTarget } from 'cc';
import { MazeLevelData, ItemType } from '../Maze/MazeData';
import { MazePathfinder } from '../Maze/MazePathfinder';
import { Dir } from '../Maze/MazeConstants';
import { GameState } from './GameState';
import { TurtleAgent } from '../Player/TurtleAgent';
import { LogicPutWall } from '../Logic/LogicPutWall';
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
        this.turtle = new TurtleAgent(this.state, data);
        this.phase = TurnPhase.PlacingItem;
        TurnManager.eventTarget.emit('state-changed', this.state);
    }

    // Người chơi đặt item lên 1 ô (tường hoặc food)
    placeItem(row: number, col: number, dir: Dir | null, itemType: ItemType, value?: number): boolean {
        if (this.phase !== TurnPhase.PlacingItem || !this.data || !this.state) return false;

        if (itemType === ItemType.Wall && dir !== null) {
            // Chặn cạnh ngoài biên, cạnh đã có wall và cạnh Flow-Flow trước khi thử pathfinding.
            if (!new LogicPutWall(this.data).canPlaceWall(row, col, dir)) {
                TurnManager.eventTarget.emit('wall-blocked-invalid');
                return false;
            }
            const turtlePos = { row: this.state.turtleRow, col: this.state.turtleCol };
            if (!this.pathfinder.canPlaceWallSafely(row, col, dir, turtlePos)) {
                TurnManager.eventTarget.emit('wall-blocked-invalid');
                return false;
            }
            this.pathfinder.placeWall(row, col, dir);
        } else if (itemType === ItemType.Food) {
            const idx = row * this.data.cols + col;
            this.data.cells[idx].item = ItemType.Food;
            this.data.cells[idx].itemValue = value ?? 1;
        } else {
            return false;
        }

        TurnManager.eventTarget.emit('maze-changed', this.data);
        return true;
    }

    // Người chơi xác nhận xong việc đặt item, chuyển sang chọn số bước
    confirmPlacement() {
        if (this.phase !== TurnPhase.PlacingItem) return;

        this.phase = TurnPhase.ChoosingSteps;
        TurnManager.eventTarget.emit('phase-changed', this.phase);
    }

    // Người chơi chọn số bước, bắt đầu rùa tự di chuyển
    async chooseSteps(steps: number) {
        if (this.phase !== TurnPhase.ChoosingSteps) return;
        const requestedSteps = Math.floor(steps);
        if (!Number.isFinite(requestedSteps) || requestedSteps <= 0) return;

        this.phase = TurnPhase.TurtleMoving;
        this.state.isMoving = true;
        TurnManager.eventTarget.emit('phase-changed', this.phase);

        const remainingSteps = Math.max(
            0,
            this.data.winCondition.maxSteps - this.state.stepsUsed,
        );
        const stepsToRun = Math.min(requestedSteps, remainingSteps);
        let isStuck = false;
        let consumedSteps = 0;
        let consecutiveFreeActions = 0;
        const maxFreeActions = this.data.cells.length * 4;

        while (consumedSteps < stepsToRun) {
            if (this.state.isGameOver) break;

            const consumedBeforeMove = consumedSteps;
            const moved = await this.turtle.step(async move => {
                // Tính theo ô đích: vào/đi giữa Flow miễn phí, đáp xuống Land mới trừ 1.
                if (move.consumesStep) {
                    this.state.stepsUsed++;
                    consumedSteps++;
                }

                // Callback chạy cho từng ô, nên item trên đường Flow vẫn được ăn đủ.
                this.checkCellItem();
                TurnManager.eventTarget.emit('turtle-moved', {
                    ...this.state,
                    isFlowMove: move.isFlowMove,
                    consumesStep: move.consumesStep,
                });

                // Chờ tween view hoàn tất trước khi phát chuyển động kế tiếp.
                await this.delay(move.isFlowMove ? 320 : 500);
            });

            if (!moved) {
                isStuck = true;
                break;
            }
            if (this.isAtGoal()) break; // tới đích sớm hơn số bước đã chọn -> dừng

            if (consumedSteps === consumedBeforeMove) {
                consecutiveFreeActions++;
                if (consecutiveFreeActions >= maxFreeActions) {
                    console.warn('Free-move loop detected; turtle stopped');
                    isStuck = true;
                    break;
                }
            } else {
                consecutiveFreeActions = 0;
            }
        }

        this.state.isMoving = false;

        if (isStuck) {
            this.endGame(false, 'stuck');
            return;
        }

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

            this.endGame(
                scoreOk && stepsOk,
                !scoreOk ? 'not-enough-score' : !stepsOk ? 'too-many-steps' : 'success',
            );
            return;
        }

        // Chưa tới đích nhưng đã hết số bước cho phép -> thua
        if (this.state.stepsUsed >= maxSteps) {
            this.endGame(false, 'out-of-steps');
        }
    }

    private endGame(isWin: boolean, reason: string) {
        this.state.isMoving = false;
        this.state.isGameOver = true;
        this.state.isWin = isWin;
        this.phase = TurnPhase.GameEnded;

        TurnManager.eventTarget.emit('phase-changed', this.phase);
        TurnManager.eventTarget.emit('game-ended', { isWin, reason });
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => this.scheduleOnce(resolve, ms / 1000));
    }
}
