export type Dir = 0 | 1 | 2 | 3; // Up, Right, Down, Left

export const DIR_OFFSETS: [number, number][] = [
    [-1, 0], // Up
    [0, 1],  // Right
    [1, 0],  // Down
    [0, -1], // Left
];

export const OPPOSITE_DIR: [Dir, Dir, Dir, Dir] = [2, 3, 0, 1];