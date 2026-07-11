# 🐢 Turtle Maze — Implementation Notes (dev)

> Phần kỹ thuật, tách khỏi [TurtleMaze_GameDesign.md](TurtleMaze_GameDesign.md) (doc design cho team).
> Nội dung ở đây phục vụ code/implement — data format, mapping với code hiện tại, roadmap, và các câu hỏi còn mở.

---

## 1. Dữ liệu level (format đề xuất)

Mở rộng từ code hiện có trong [MazeData.ts](../assets/Scripts/Maze/MazeData.ts):

```ts
export enum ItemType {
    None = 0,
    Food = 1,       // ăn được, cộng điểm
    Wall = 2,       // chặn cạnh (người chơi đặt)
    StepBonus = 3,  // +XS: cộng bước vào quỹ            // MỚI
}

export interface CellData {
    row: number;
    col: number;
    walls: [boolean, boolean, boolean, boolean];
    item?: ItemType;
    itemValue?: number;   // điểm nếu Food, số bước cộng nếu StepBonus
    flow?: Dir;           // MỚI — ô dòng chảy + hướng cuốn. undefined = ô cạn (Land).
}

// MỚI — kịch bản mutation
export enum MutationType { WallAdd, WallRemove, FlowSet, FlowRemove }

export interface MutationAction {
    type: MutationType;
    row: number;
    col: number;
    dir?: Dir;   // cạnh tường (WallAdd/Remove) hoặc hướng chảy mới (FlowSet)
}

export interface PhaseMutation {
    afterPhase: number;        // chạy sau pha thứ mấy (1-based)
    actions: MutationAction[];
}

export interface MazeLevelData {
    levelId: string;
    rows: number;
    cols: number;
    start: { row: number; col: number };
    startFacing: Dir;                     // MỚI — hướng nhìn ban đầu
    goal: { row: number; col: number };
    cells: CellData[];
    winCondition: WinCondition;           // { targetScore, maxSteps }
    inventory: { wall: number; food: number; stepBonus: number };  // MỚI
    mutations: PhaseMutation[];           // MỚI
}
```

### Màn 1 — Ma trận 6×8 (spec khởi điểm, tunable)

| Thuộc tính | Giá trị |
|---|---|
| Kích thước | 6 hàng × 8 cột |
| Legend | Chữ số = Food, `W` = Wall, `+XS` = cộng step, `↑→↓←` = ô dòng chảy |
| `targetScore` | 5 *(draft)* |
| `maxSteps` | 20 *(draft)* |
| Inventory | 3 Wall, 2 Food(1đ) *(draft)* |
| Dòng chảy | 1 đoạn dòng 3–4 ô, thẳng hoặc cong 1 khúc — màn dạy cơ chế |
| Mutation | 1–2 mutation đơn giản (1 tường dựng sau pha 1) — màn dạy cơ chế |

*(Layout ô cụ thể do level designer vẽ bằng editor / `MazeBuilder`, lưu theo format trên.)*

---

## 2. Mapping với code hiện tại

| Khái niệm | Code |
|---|---|
| Dữ liệu màn chơi | `MazeLevelData` — [MazeData.ts](../assets/Scripts/Maze/MazeData.ts) |
| Ô mê cung | `CellData` — [MazeData.ts](../assets/Scripts/Maze/MazeData.ts), gồm `walls` và `flow?: Dir` |
| Điều kiện thắng | `WinCondition` — [MazeData.ts](../assets/Scripts/Maze/MazeData.ts) |
| Loại item | `ItemType` — [MazeData.ts](../assets/Scripts/Maze/MazeData.ts) — *cần thêm `StepBonus`* |
| Hướng | `Dir`, `DIR_OFFSETS`, `OPPOSITE_DIR` — [MazeConstants.ts](../assets/Scripts/Maze/MazeConstants.ts) |
| Vòng lặp pha | `TurnManager` + `TurnPhase` — [TurnManager.ts](../assets/Scripts/Manager/TurnManager.ts) — *thiếu bước Mutation sau mỗi pha* |
| Trạng thái ván | `GameState` — [GameState.ts](../assets/Scripts/Manager/GameState.ts) |
| Luật đi của rùa | `TurtleAgent.chooseNextMove()` — [TurtleAgent.ts](../assets/Scripts/Player/TurtleAgent.ts) |
| Nhặt item | `TurnManager.checkCellItem()` — [TurnManager.ts](../assets/Scripts/Manager/TurnManager.ts) |
| Xét thắng/thua | `TurnManager.evaluateWinCondition()` — [TurnManager.ts](../assets/Scripts/Manager/TurnManager.ts) |
| Luật đặt Wall | `ItemSpace.onItemDrop()` → `TurnManager.placeItem()` → `LogicPutWall` + `MazePathfinder` |
| Tính bước Flow/Land | `TurtleAgent.destinationIsLand()` tạo `TurtleMove.consumesStep`; `TurnManager` chỉ tăng `stepsUsed` khi cờ này là `true` |

### Trạng thái implementation hiện tại

1. `TurtleAgent.chooseNextMove()` dùng luật cố định **thẳng → phải → trái → quay đầu**.
2. `TurtleMove.consumesStep` được quyết định theo ô đích: vào Flow miễn phí, đáp xuống Land tốn 1 bước.
3. Wall kéo-thả được snap vào cạnh lưới và ghi vào `walls[dir]` của cả hai ô kề nhau, nên `TurtleAgent.canMove()` chặn chuyển động ngay lập tức.
4. `LogicPutWall` từ chối cạnh ngoài biên, cạnh đã có Wall và Flow–Flow. `MazePathfinder.canPlaceWallSafely()` từ chối Wall làm mất đường tới đích.
5. `ingame.scene` đã wire map tĩnh, rùa, `GameBootstrap`, `TurnManager`, ItemSpace, bộ chọn bước và HUD realtime.
6. `GameBootstrap.tweenTurtle()` tween cả vị trí và hướng nhìn bằng `sineInOut`; sprite gốc nhìn xuống và góc quay được chuẩn hóa theo cung ngắn nhất. Tween thường `0.45s`, Flow `0.28s`; `TurnManager` chờ tương ứng `500ms`/`320ms` để tween không bị bước kế tiếp ngắt giữa chừng.
7. `TurnManager.chooseSteps()` chạy cho tới khi đủ số lần `consumesStep`, không đếm lượt miễn phí Land → Flow / Flow → Flow. `BoardBtnNumber` nghe `turtle-moved` và chỉ giảm countdown khi `consumesStep = true`.
8. Khi `TurnManager.init()`, `TurtleAgent.getNextDirection()` chọn hướng mở hợp lệ đầu tiên tại ô start. `GameBootstrap.tweenInitialFacing()` tween sprite sang hướng đó trước lượt chạy đầu tiên.
9. `ItemSpace.applySystemWallSize()` chỉ resize wall sau khi drop hợp lệ: từ preview `128×32` về cùng format wall tĩnh `8×128`; horizontal xoay `90°`, vertical `0°`.
10. `GameBootstrap.spawnCellItems()` tắt các `Sprite` nền của Item đặt sẵn trên cell và chỉ tạo `ValueLabel`, tránh che sprite Land/Flow.
11. `TurtleAgent.breakAdjacentWalls()` xóa `WallState.DISAPPEAR` ở cả hai ô ngay sau khi rùa tới ô kề. `TurnManager` recalculate pathfinder và emit `walls-broken`; `GameBootstrap` tween node wall về scale 0 rồi ẩn.
12. Level 09 nằm tại `assets/resources/levels/level_09.json` và `assets/Prefabs/Level_09.prefab` (10×8). Wall vỡ dùng `wall-crack.png` cùng `BreakableWallView`; mảng `frames` hiện có một SpriteFrame và đã sẵn sàng nhận nhiều frame animation sau này.

---

## 3. Roadmap

| Milestone | Nội dung |
|---|---|
| **M0 — Chạy lên được** | Tạo level JSON; wire scene (GameBootstrap + MazeBuilder + TurnManager + mazeRoot); render maze 6×8 lên màn hình |
| **M1 — Core cạn** | Sửa 3 mục lệch design ở mục 2; thêm `StepBonus`; rùa đi đúng luật cố định; quỹ bước cộng dồn qua pha; render + di chuyển rùa |
| **M2 — Flow 🌊** | `flow?: Dir` + logic cuốn trôi (vào / trôi / dạt / bị chặn); visual mũi tên dòng |
| **M3 — Mutation 💥** | Format `PhaseMutation` + áp dụng sau mỗi pha trong `TurnManager`; animation biến đổi |
| **M4 — Level & UI** | Level 1 (6×8) hoàn chỉnh; HUD, kéo-thả item, chọn N; win/lose + lý do + sao; juice (SFX, camera) |

---

## 4. Câu hỏi mở (cần quyết định thêm / để playtest trả lời — không chặn dev)

- Các con số màn 1 (`targetScore` 5, `maxSteps` 20, inventory 3W/2F) có cho độ khó hợp lý?
- Ngưỡng sao 2 (dư ≥ 20% bước) có quá dễ/khó?
- Trôi miễn phí có làm dòng chảy quá mạnh (người chơi chỉ chăm chăm dùng dòng)?
- Có cần cap N bước mỗi pha để pacing mutation đều hơn không?
- Mid-run mutation ("đang đi tường dựng lên") đưa vào từ level mấy?
