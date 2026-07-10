export enum ItemType {
    None = 0,
    Food = 1,      // ăn được, cộng điểm
    Wall = 2,       // chặn đường (người chơi đặt)
}

export interface CellData {
    row: number;
    col: number;
    walls: [boolean, boolean, boolean, boolean];
    item?: ItemType;      // item hiện có trên ô (nếu có)
    itemValue?: number;   // giá trị điểm nếu là Food
}

export interface WinCondition {
    targetScore: number;   // số điểm cần ăn đủ
    maxSteps: number;      // số bước tối đa được phép đi hết
}

export interface MazeLevelData {
    levelId: string;
    rows: number;
    cols: number;
    start: { row: number; col: number };
    goal: { row: number; col: number };
    cells: CellData[];
    winCondition: WinCondition;
}