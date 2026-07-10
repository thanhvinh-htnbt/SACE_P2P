export interface GameState {
    turtleRow: number;
    turtleCol: number;
    facing: 0 | 1 | 2 | 3;
    stepsUsed: number;
    scoreCollected: number;
    isMoving: boolean;
    isGameOver: boolean;
    isWin: boolean;
}