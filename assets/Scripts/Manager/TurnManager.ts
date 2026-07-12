import { _decorator, Component } from 'cc';
import { EventTarget } from 'cc';
import { MazeLevelData, ItemType } from '../Maze/MazeData';
import { Dir } from '../Maze/MazeConstants';
import { GameState } from './GameState';
import { TurtleAgent } from '../Player/TurtleAgent';
import { LogicPutWall } from '../Logic/LogicPutWall';
const { ccclass } = _decorator;

export enum TurnPhase {
    PlacingItem,   // người chơi đang đặt item
    TurtleMoving,  // rùa đang tự động di chuyển, khóa input
    GameEnded,
}

/**
 * Số lần rùa được phép quay đầu đi ngược chiều Flow (do bị chặn hết lối ra).
 * Vượt quá = người chơi đã tự nhốt rùa trong dòng chảy -> xử thua.
 */
const MAX_AGAINST_FLOW_MOVES = 5;

@ccclass('TurnManager')
export class TurnManager extends Component {
    static eventTarget = new EventTarget(); // Manager -> UI

    private data: MazeLevelData;
    private wallLogic: LogicPutWall;
    private state: GameState;
    private turtle: TurtleAgent;
    private phase: TurnPhase = TurnPhase.PlacingItem;

    init(data: MazeLevelData): GameState {
        this.data = data;
        this.wallLogic = new LogicPutWall(data);
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
        // Hướng ban đầu phải là một cạnh có thể đi, dùng đúng luật ưu tiên của rùa.
        this.state.facing = this.turtle.getNextDirection() ?? this.state.facing;
        this.phase = TurnPhase.PlacingItem;
        TurnManager.eventTarget.emit('state-changed', this.state);
        TurnManager.eventTarget.emit('phase-changed', this.phase);
        return this.state;
    }

    // Người chơi đặt item lên 1 ô (tường hoặc food)
    placeItem(row: number, col: number, dir: Dir | null, itemType: ItemType, value?: number): boolean {
        if (this.phase !== TurnPhase.PlacingItem || !this.data || !this.state) return false;

        if (itemType === ItemType.Wall && dir !== null) {
            // Chỉ xét tính hợp lệ của cạnh. Người chơi được phép tự chặn đường hoặc tự nhốt rùa.
            // Không đặt được nếu: ngoài biên, cạnh đã có wall, hoặc nằm giữa hai ô Flow.
            if (!this.wallLogic.placeWall(row, col, dir)) {
                TurnManager.eventTarget.emit('wall-blocked-invalid');
                return false;
            }
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

    // V2: sau khi bấm Start, rùa tự chạy tới đích, kẹt hoặc hết quỹ bước.
    async runAutomatically() {
        if (this.phase !== TurnPhase.PlacingItem || this.state.isMoving) return;
        this.phase = TurnPhase.TurtleMoving;
        this.state.isMoving = true;
        TurnManager.eventTarget.emit('phase-changed', this.phase);

        let isStuck = false;
        let isFlowTrapped = false;
        let againstFlowMoves = 0;
        let consecutiveFreeActions = 0;
        const maxFreeActions = this.data.cells.length * 4;

        while (!this.state.isGameOver
            && !this.isAtGoal()
            && this.getRemain() > 0) {

            const stepsBeforeMove = this.state.stepsUsed;
            const moved = await this.turtle.step(async move => {
                // Tính theo ô đích: vào/đi giữa Flow miễn phí, đáp xuống Land mới trừ 1.
                if (move.consumesStep) {
                    this.state.stepsUsed++;
                }
                if (move.brokenWalls.length > 0) {
                    TurnManager.eventTarget.emit('walls-broken', move.brokenWalls);
                }

                // Quay đầu ngược dòng = bị nhốt trong Flow; bước chủ động thoát
                // được (không phải bị dòng cuốn) thì reset bộ đếm.
                if (move.isAgainstFlow) {
                    againstFlowMoves++;
                } else if (!move.isFlowMove) {
                    againstFlowMoves = 0;
                }

                // Callback chạy cho từng ô, nên item trên đường Flow vẫn được ăn đủ.
                this.checkCellItem();
                TurnManager.eventTarget.emit('turtle-moved', {
                    ...this.state,
                    isFlowMove: move.isFlowMove,
                    destinationIsFlow: this.isCurrentCellFlow(),
                    consumesStep: move.consumesStep,
                    brokenWalls: move.brokenWalls,
                });

                // Chờ tween view hoàn tất trước khi phát chuyển động kế tiếp.
                await this.delay(move.isFlowMove ? 320 : 500);
            });

            if (!moved) {
                isStuck = true;
                break;
            }
            if (againstFlowMoves >= MAX_AGAINST_FLOW_MOVES) {
                isFlowTrapped = true;
                break;
            }
            if (this.isAtGoal()) break; // tới đích sớm hơn số bước đã chọn -> dừng

            if (this.state.stepsUsed === stepsBeforeMove) {
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

        if (isFlowTrapped) {
            this.endGame(false, 'flow-trapped');
            return;
        }
        if (isStuck) {
            this.endGame(false, 'stuck');
            return;
        }

        this.evaluateWinCondition();
    }

    private checkCellItem() {
        const idx = this.state.turtleRow * this.data.cols + this.state.turtleCol;
        const cell = this.data.cells[idx];
        if (cell.item === ItemType.Food) {
            const gainedPoint = cell.itemValue ?? 1;
            this.state.scoreCollected += gainedPoint;
            cell.item = ItemType.None;
            TurnManager.eventTarget.emit('point-gained', {
                value: gainedPoint,
                row: this.state.turtleRow,
                col: this.state.turtleCol,
            });
            TurnManager.eventTarget.emit('food-collected', this.state.scoreCollected);
        }
    }

    private isAtGoal(): boolean {
        return this.state.turtleRow === this.data.goal.row
            && this.state.turtleCol === this.data.goal.col;
    }

    private evaluateWinCondition() {
        const remain = this.getRemain();

        if (this.isAtGoal()) {
            // Dùng hết bước đúng tại đích vẫn hợp lệ: remain = 0 vẫn thắng.
            this.endGame(remain >= 0, 'success');
            return;
        }

        if (remain <= 0) {
            this.endGame(false, 'out-of-steps');
        }
    }

    private isCurrentCellFlow(): boolean {
        const index = this.state.turtleRow * this.data.cols + this.state.turtleCol;
        return this.data.cells[index]?.flow !== undefined;
    }

    private getRemain(): number {
        return Math.max(0, this.data.winCondition.maxSteps - this.state.stepsUsed);
    }

    private endGame(isWin: boolean, reason: string) {
        this.state.isMoving = false;
        this.state.isGameOver = true;
        this.state.isWin = isWin;
        this.phase = TurnPhase.GameEnded;

        TurnManager.eventTarget.emit('phase-changed', this.phase);
        const remain = this.getRemain();
        const pointCollected = this.state.scoreCollected;
        // Luật tính điểm: điểm tổng sau màn = số bước còn dư + điểm đã thu thập.
        const totalScore = remain + pointCollected;
        const bestCase = Math.max(1, this.data.rating?.bestCase ?? 1);
        TurnManager.eventTarget.emit('game-ended', {
            isWin,
            reason,
            remain,
            pointCollected,
            totalScore,
            bestCase,
            ratingRatio: totalScore / bestCase,
        });
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => this.scheduleOnce(resolve, ms / 1000));
    }
}
