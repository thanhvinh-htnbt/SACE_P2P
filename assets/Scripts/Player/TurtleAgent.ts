import { MazeLevelData, WallState } from '../Maze/MazeData';
import { GameState } from '../Manager/GameState';
import { Dir, DIR_OFFSETS, OPPOSITE_DIR } from '../Maze/MazeConstants';

export interface TurtleMove {
    row: number;
    col: number;
    facing: Dir;
    /** true = bị Flow cuốn, không tính vào số bước người chơi đã chọn. */
    isFlowMove: boolean;
}

type MoveHandler = (move: TurtleMove) => void | Promise<void>;

export class TurtleAgent {
    constructor(
        private state: GameState,
        private data: MazeLevelData
    ) {}

    /**
     * Đi 1 bước chủ động rồi xử lý toàn bộ chuỗi Flow nếu rùa bước vào nước.
     * Trả về false khi cả 4 hướng đều bị chặn.
     */
    async step(onMoved: MoveHandler = () => {}): Promise<boolean> {
        const dir = this.chooseNextMove();
        if (dir === null) return false;

        this.move(dir);
        await onMoved(this.createMove(false));

        if (!this.isAtGoal()) {
            await this.slideThroughFlow(onMoved);
        }
        return true;
    }

    /** Luật cố định trên cạn: Thẳng -> Trái -> Phải -> Quay lại. */
    private chooseNextMove(): Dir | null {
        const facing = this.state.facing as Dir;
        const priority: Dir[] = [
            facing,
            ((facing + 3) % 4) as Dir, // trái
            ((facing + 1) % 4) as Dir, // phải
            ((facing + 2) % 4) as Dir, // quay lại
        ];

        return priority.find(dir => this.canMove(
            this.state.turtleRow,
            this.state.turtleCol,
            dir,
        )) ?? null;
    }

    /**
     * Mỗi ô Flow quyết định hướng của hop tiếp theo.
     * Flow -> Flow: tiếp tục trôi. Flow -> Land: dạt lên Land rồi dừng.
     * Nếu hướng Flow bị tường/biên chặn thì dừng ngay trên ô nước.
     */
    private async slideThroughFlow(onMoved: MoveHandler) {
        const visited = new Set<number>();

        while (!this.isAtGoal()) {
            const row = this.state.turtleRow;
            const col = this.state.turtleCol;
            const cell = this.getCell(row, col);
            if (!cell || cell.flow === undefined) return;

            const index = row * this.data.cols + col;
            if (visited.has(index)) {
                console.warn('Flow loop detected; turtle slide stopped');
                return;
            }
            visited.add(index);

            const flowDir = cell.flow;
            // Nếu bị chặn, bước sau rùa dùng luật thường với hướng nhìn theo dòng.
            this.state.facing = flowDir;
            if (!this.canMove(row, col, flowDir)) return;

            this.move(flowDir);
            await onMoved(this.createMove(true));
        }
    }

    /** Check cả tường phía đang đứng, tường phía ô kế bên và biên map. */
    private canMove(row: number, col: number, dir: Dir): boolean {
        const cell = this.getCell(row, col);
        if (!cell || cell.walls[dir] !== WallState.NONE) return false;

        const [dr, dc] = DIR_OFFSETS[dir];
        const nextRow = row + dr;
        const nextCol = col + dc;
        const nextCell = this.getCell(nextRow, nextCol);
        if (!nextCell) return false;

        return nextCell.walls[OPPOSITE_DIR[dir]] === WallState.NONE;
    }

    private move(dir: Dir) {
        const [dr, dc] = DIR_OFFSETS[dir];
        this.state.turtleRow += dr;
        this.state.turtleCol += dc;
        this.state.facing = dir;
    }

    private createMove(isFlowMove: boolean): TurtleMove {
        return {
            row: this.state.turtleRow,
            col: this.state.turtleCol,
            facing: this.state.facing,
            isFlowMove,
        };
    }

    private getCell(row: number, col: number) {
        if (row < 0 || row >= this.data.rows || col < 0 || col >= this.data.cols) {
            return null;
        }
        return this.data.cells[row * this.data.cols + col] ?? null;
    }

    private isAtGoal(): boolean {
        return this.state.turtleRow === this.data.goal.row
            && this.state.turtleCol === this.data.goal.col;
    }
}
