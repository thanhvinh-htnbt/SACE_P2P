import { MazeLevelData } from './MazeData';
import { Dir, DIR_OFFSETS, OPPOSITE_DIR } from './MazeConstants';

export class MazePathfinder {
    private distanceMap: number[];

    constructor(private data: MazeLevelData) {
        this.recalculate();
    }

    recalculate() {
        const { rows, cols, goal } = this.data;
        this.distanceMap = new Array(rows * cols).fill(Infinity);
        const goalIdx = goal.row * cols + goal.col;
        this.distanceMap[goalIdx] = 0;

        const queue: number[] = [goalIdx];
        while (queue.length > 0) {
            const idx = queue.shift()!;
            const dist = this.distanceMap[idx];
            for (const nIdx of this.getOpenNeighbors(idx)) {
                if (this.distanceMap[nIdx] === Infinity) {
                    this.distanceMap[nIdx] = dist + 1;
                    queue.push(nIdx);
                }
            }
        }
    }

    private getOpenNeighbors(idx: number): number[] {
        const { rows, cols, cells } = this.data;
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        const cell = cells[idx];
        const result: number[] = [];

        if (!cell.walls[0] && row > 0) result.push(idx - cols);
        if (!cell.walls[1] && col < cols - 1) result.push(idx + 1);
        if (!cell.walls[2] && row < rows - 1) result.push(idx + cols);
        if (!cell.walls[3] && col > 0) result.push(idx - 1);

        return result;
    }

    getDistance(row: number, col: number): number {
        if (row < 0 || row >= this.data.rows || col < 0 || col >= this.data.cols) {
            return Infinity;
        }
        return this.distanceMap[row * this.data.cols + col];
    }

    // Đặt tường thật, tự cập nhật cả 2 phía + BFS lại
    placeWall(row: number, col: number, dir: Dir) {
        this.setWallState(row, col, dir, true);
        this.recalculate();
    }

    // Kiểm tra thử: nếu đặt tường này, checkFrom (thường là vị trí rùa) còn tới được đích không?
    canPlaceWallSafely(
        row: number,
        col: number,
        dir: Dir,
        checkFrom: { row: number; col: number }
    ): boolean {
        this.setWallState(row, col, dir, true);
        this.recalculate();

        const reachable = this.getDistance(checkFrom.row, checkFrom.col) !== Infinity;

        // rollback lại trạng thái cũ vì đây chỉ là kiểm tra thử
        this.setWallState(row, col, dir, false);
        this.recalculate();

        return reachable;
    }

    private setWallState(row: number, col: number, dir: Dir, value: boolean) {
        const idx = row * this.data.cols + col;
        this.data.cells[idx].walls[dir] = value;

        const [dr, dc] = DIR_OFFSETS[dir];
        const nRow = row + dr, nCol = col + dc;
        if (nRow >= 0 && nRow < this.data.rows && nCol >= 0 && nCol < this.data.cols) {
            const nIdx = nRow * this.data.cols + nCol;
            this.data.cells[nIdx].walls[OPPOSITE_DIR[dir]] = value;
        }
    }
}