import { MazeLevelData, WallState } from '../Maze/MazeData';
import { GameState } from '../Manager/GameState';
import { Dir, DIR_OFFSETS, OPPOSITE_DIR } from '../Maze/MazeConstants';

export interface TurtleMove {
    row: number;
    col: number;
    facing: Dir;
    /** true = bị Flow cuốn, không tính vào số bước người chơi đã chọn. */
    isFlowMove: boolean;
    /** Chỉ trừ quỹ bước khi ô đích là Land. Đi vào/giữa các ô Flow là miễn phí. */
    consumesStep: boolean;
    brokenWalls: BrokenWall[];
}

export interface BrokenWall {
    row: number;
    col: number;
    dir: Dir;
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
        const dir = this.getNextDirection();
        if (dir === null) return false;

        const consumesStep = this.destinationIsLand(
            this.state.turtleRow,
            this.state.turtleCol,
            dir,
        );
        this.move(dir);
        const brokenWalls = this.breakAdjacentWalls();
        await onMoved(this.createMove(false, consumesStep, brokenWalls));

        if (!this.isAtGoal()) {
            await this.slideThroughFlow(onMoved);
        }
        return true;
    }

    /** Luật cố định trên cạn: Thẳng -> Phải -> Trái -> Quay lại. */
    getNextDirection(): Dir | null {
        const facing = this.state.facing as Dir;
        const priority: Dir[] = [
            facing,
            ((facing + 1) % 4) as Dir, // phải
            ((facing + 3) % 4) as Dir, // trái
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

            const consumesStep = this.destinationIsLand(row, col, flowDir);
            this.move(flowDir);
            const brokenWalls = this.breakAdjacentWalls();
            await onMoved(this.createMove(true, consumesStep, brokenWalls));
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

    private destinationIsLand(row: number, col: number, dir: Dir): boolean {
        const [dr, dc] = DIR_OFFSETS[dir];
        return this.getCell(row + dr, col + dc)?.flow === undefined;
    }

    /** Wall DISAPPEAR vỡ ngay khi rùa vừa vào một trong hai ô kề. */
    private breakAdjacentWalls(): BrokenWall[] {
        const row = this.state.turtleRow;
        const col = this.state.turtleCol;
        const cell = this.getCell(row, col);
        if (!cell) return [];

        const broken: BrokenWall[] = [];
        for (let dir = 0; dir < 4; dir++) {
            const typedDir = dir as Dir;
            if (cell.walls[typedDir] !== WallState.DISAPPEAR) continue;

            cell.walls[typedDir] = WallState.NONE;
            const [dr, dc] = DIR_OFFSETS[typedDir];
            const neighbor = this.getCell(row + dr, col + dc);
            if (neighbor) neighbor.walls[OPPOSITE_DIR[typedDir]] = WallState.NONE;
            broken.push({ row, col, dir: typedDir });
        }
        return broken;
    }

    private createMove(
        isFlowMove: boolean,
        consumesStep: boolean,
        brokenWalls: BrokenWall[],
    ): TurtleMove {
        return {
            row: this.state.turtleRow,
            col: this.state.turtleCol,
            facing: this.state.facing,
            isFlowMove,
            consumesStep,
            brokenWalls,
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
