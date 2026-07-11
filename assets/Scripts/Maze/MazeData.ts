import { Dir } from './MazeConstants';

export enum ItemType {
    None = 0,
    Food = 1,      // ăn được, cộng điểm
    Wall = 2,      // chặn đường (người chơi đặt)
}

export enum WallState {
    NONE = 0,       // không có tường, đi qua được
    NORMAL = 1,     // tường thường, chặn vĩnh viễn
    DISAPPEAR = 2,  // tường sẽ biến mất (level sau) — vẫn chặn đường cho tới khi biến mất
}

export interface CellData {
    row: number;
    col: number;
    /** Tường 4 cạnh theo thứ tự [Up, Right, Down, Left] — khớp enum Dir. */
    walls: [WallState, WallState, WallState, WallState];
    item?: ItemType;      // item hiện có trên ô (nếu có)
    itemValue?: number;   // giá trị điểm nếu là Food
    /** 🌊 Ô dòng chảy + hướng cuốn. undefined = ô cạn (đi bộ bình thường). */
    flow?: Dir;
}

export interface WinCondition {
    targetScore: number;   // số điểm cần ăn đủ
    maxSteps: number;      // số bước tối đa được phép đi hết
}

/** Số item người chơi được cấp đầu màn để tự đặt trong lúc chơi. */
export interface Inventory {
    wallH: number;      // số tường ngang (Wall-Horizontal) được cấp
    wallV: number;      // số tường dọc (Wall-Vertical) được cấp
    food: number;       // số Food được cấp
    stepBonus: number;  // số +Step được cấp
}

export interface MazeLevelData {
    levelId: string;
    rows: number;
    cols: number;
    start: { row: number; col: number };
    goal: { row: number; col: number };
    cells: CellData[];
    winCondition: WinCondition;
    inventory: Inventory;
}