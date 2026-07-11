import { CellData, MazeLevelData, WallState } from '../Maze/MazeData';
import { Dir, DIR_OFFSETS, OPPOSITE_DIR } from '../Maze/MazeConstants';

export class LogicPutWall {
    constructor(private data: MazeLevelData) {}

    // Flow-Flow: không được đặt. Flow-Land / Land-Land: được đặt. Cạnh đã có tường: không được đặt đè.
    canPlaceWall(row: number, col: number, dir: Dir): boolean {
        const cell = this.getCell(row, col);
        if (!cell) return false;

        const neighbor = this.getNeighbor(row, col, dir);
        if (!neighbor) return false; // cạnh ngoài biên map, không có ô kề

        if (cell.walls[dir] !== WallState.NONE) return false; // đã có tường ở cạnh này

        return cell.flow === undefined || neighbor.flow === undefined;
    }

    // Đặt wall vào cạnh dir của (row, col) và cạnh đối diện của ô kề.
    // Trả về false nếu vi phạm luật Flow-Flow, cạnh đã có tường, hoặc ngoài biên map.
    placeWall(row: number, col: number, dir: Dir, state: WallState = WallState.NORMAL): boolean {
        if (state === WallState.NONE) return false;
        if (!this.canPlaceWall(row, col, dir)) return false;

        const cell = this.getCell(row, col)!;
        const [dr, dc] = DIR_OFFSETS[dir];
        const nRow = row + dr, nCol = col + dc;
        const neighborIdx = nRow * this.data.cols + nCol;

        cell.walls[dir] = state;
        this.data.cells[neighborIdx].walls[OPPOSITE_DIR[dir]] = state;
        return true;
    }

    // Xóa tường (ví dụ khi tường DISAPPEAR hết hạn).
    removeWall(row: number, col: number, dir: Dir): void {
        const cell = this.getCell(row, col);
        if (!cell) return;

        const [dr, dc] = DIR_OFFSETS[dir];
        const nRow = row + dr, nCol = col + dc;
        cell.walls[dir] = WallState.NONE;

        const neighbor = this.getCell(nRow, nCol);
        if (neighbor) neighbor.walls[OPPOSITE_DIR[dir]] = WallState.NONE;
    }

    private getCell(row: number, col: number): CellData | null {
        if (row < 0 || row >= this.data.rows || col < 0 || col >= this.data.cols) return null;
        return this.data.cells[row * this.data.cols + col];
    }

    private getNeighbor(row: number, col: number, dir: Dir): CellData | null {
        const [dr, dc] = DIR_OFFSETS[dir];
        return this.getCell(row + dr, col + dc);
    }
}
