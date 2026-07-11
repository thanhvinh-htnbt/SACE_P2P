import { CellData, MazeLevelData } from '../Maze/MazeData';
import { Dir, DIR_OFFSETS, OPPOSITE_DIR } from '../Maze/MazeConstants';

export class LogicPutWall {
    constructor(private data: MazeLevelData) {}

    // Flow-Flow: không được đặt. Flow-Land / Land-Land: được đặt.
    canPlaceWall(row: number, col: number, dir: Dir): boolean {
        const cell = this.getCell(row, col);
        if (!cell) return false;

        const neighbor = this.getNeighbor(row, col, dir);
        if (!neighbor) return false; // cạnh ngoài biên map, không có ô kề

        return cell.flow === undefined || neighbor.flow === undefined;
    }

    // Đặt wall vào cạnh dir của (row, col) và cạnh đối diện của ô kề.
    // Trả về false nếu vi phạm luật Flow-Flow hoặc ngoài biên map.
    placeWall(row: number, col: number, dir: Dir): boolean {
        if (!this.canPlaceWall(row, col, dir)) return false;

        const cell = this.getCell(row, col)!;
        const [dr, dc] = DIR_OFFSETS[dir];
        const nRow = row + dr, nCol = col + dc;
        const neighborIdx = nRow * this.data.cols + nCol;

        cell.walls[dir] = true;
        this.data.cells[neighborIdx].walls[OPPOSITE_DIR[dir]] = true;
        return true;
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
