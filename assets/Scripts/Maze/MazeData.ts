import { Dir } from './MazeConstants';

export enum ItemType {
    None = 0,
    Food = 1,      // ăn được, cộng điểm
    Wall = 2,      // chặn đường (người chơi đặt)
}

export enum WallState {
    NONE = 0,       // không có tường, đi qua được
    NORMAL = 1,     // tường thường, chặn vĩnh viễn
    DISAPPEAR = 2,  // tường đánh lừa: vỡ khi rùa vừa tới một trong hai ô kề
}

/** Hình biểu diễn đoạn cua; `flow` vẫn là hướng rùa đi ra khỏi ô. */
export type FlowCurve = 'rightDown' | 'leftDown' | 'rightUp' | 'leftUp';

export interface CellData {
    row: number;
    col: number;
    /** Tường 4 cạnh theo thứ tự [Up, Right, Down, Left] — khớp enum Dir. */
    walls: [WallState, WallState, WallState, WallState];
    item?: ItemType;      // item hiện có trên ô (nếu có)
    itemValue?: number;   // số hiện trên ô Food, đồng thời là điểm nhận được khi rùa ăn
    /** 🌊 Ô dòng chảy + hướng cuốn. undefined = ô cạn (đi bộ bình thường). */
    flow?: Dir;
    /** Có giá trị khi ô Flow là một góc cua thay vì mũi tên thẳng. */
    flowCurve?: FlowCurve;
}

export interface WinCondition {
    maxSteps: number;      // phải tới đích khi remain = maxSteps - stepsUsed > 0
}

export interface RatingConfig {
    bestCase: number;      // điểm tổng tốt nhất dự kiến: remain + pointCollected
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
    rating: RatingConfig;
    inventory: Inventory;
}
