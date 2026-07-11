import { MazeLevelData, WallState } from '../Maze/MazeData';
import { MazePathfinder } from '../Maze/MazePathfinder';
import { GameState } from '../Manager/GameState';
import { Dir, DIR_OFFSETS } from '../Maze/MazeConstants';

export class TurtleAgent {
    constructor(
        private state: GameState,
        private pathfinder: MazePathfinder,
        private data: MazeLevelData
    ) {}

    // Di chuyển 1 bước, trả về false nếu rùa bị kẹt hoàn toàn (không còn hướng mở)
    step(): boolean {
        const dir = this.chooseNextMove();
        if (dir === null) return false;

        const [dr, dc] = DIR_OFFSETS[dir];
        this.state.turtleRow += dr;
        this.state.turtleCol += dc;
        this.state.facing = dir;
        return true;
    }

    private chooseNextMove(): Dir | null {
        const idx = this.state.turtleRow * this.data.cols + this.state.turtleCol;
        const cell = this.data.cells[idx];

        // 1. Ưu tiên đi thẳng nếu còn mở
        if (cell.walls[this.state.facing] === WallState.NONE) {
            return this.state.facing as Dir;
        }

        // 2. Lấy các hướng mở, chọn hướng gần đích nhất
        const openDirs: Dir[] = [0, 1, 2, 3].filter(d => cell.walls[d] === WallState.NONE) as Dir[];
        if (openDirs.length === 0) return null; // hết đường, kẹt

        const dists = openDirs.map(d => this.getNeighborDistance(d));
        const minDist = Math.min(...dists);
        const best = openDirs.filter((d, i) => dists[i] === minDist);

        if (best.length === 1) return best[0];

        // 3. Nhiều lối bằng nhau -> ưu tiên phải -> trái -> quay lại
        const priority: Dir[] = [
            ((this.state.facing + 1) % 4) as Dir, // phải
            ((this.state.facing + 3) % 4) as Dir, // trái
            ((this.state.facing + 2) % 4) as Dir, // quay lại
        ];
        return priority.find(d => best.indexOf(d) !== -1)!;
    }

    private getNeighborDistance(dir: Dir): number {
        const [dr, dc] = DIR_OFFSETS[dir];
        return this.pathfinder.getDistance(
            this.state.turtleRow + dr,
            this.state.turtleCol + dc
        );
    }
}