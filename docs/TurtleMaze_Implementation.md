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
| Dữ liệu màn chơi | `MazeLevelData` — [MazeData.ts](../assets/Scripts/Maze/MazeData.ts) — *cần thêm `startFacing`, `inventory`, `mutations`* |
| Ô mê cung | `CellData` — [MazeData.ts](../assets/Scripts/Maze/MazeData.ts) — *cần thêm `flow?: Dir`* |
| Điều kiện thắng | `WinCondition` — [MazeData.ts](../assets/Scripts/Maze/MazeData.ts) |
| Loại item | `ItemType` — [MazeData.ts](../assets/Scripts/Maze/MazeData.ts) — *cần thêm `StepBonus`* |
| Hướng | `Dir`, `DIR_OFFSETS`, `OPPOSITE_DIR` — [MazeConstants.ts](../assets/Scripts/Maze/MazeConstants.ts) |
| Vòng lặp pha | `TurnManager` + `TurnPhase` — [TurnManager.ts](../assets/Scripts/Manager/TurnManager.ts) — *thiếu bước Mutation sau mỗi pha* |
| Trạng thái ván | `GameState` — [GameState.ts](../assets/Scripts/Manager/GameState.ts) |
| Luật đi của rùa | `TurtleAgent.chooseNextMove()` — [TurtleAgent.ts](../assets/Scripts/Player/TurtleAgent.ts) |
| Nhặt item | `TurnManager.checkCellItem()` — [TurnManager.ts](../assets/Scripts/Manager/TurnManager.ts) |
| Xét thắng/thua | `TurnManager.evaluateWinCondition()` — [TurnManager.ts](../assets/Scripts/Manager/TurnManager.ts) |
| Luật đặt Wall theo địa hình (Flow–Flow ❌, còn lại ✅) | `LogicPutWall.canPlaceWall()` / `.placeWall()` — [LogicPutWall.ts](../assets/Scripts/Logic/LogicPutWall.ts) |

### ⚠️ Code đang lệch design đã chốt — SỬA SAU (đã thống nhất)

1. **`TurtleAgent.chooseNextMove()`**: đang dùng BFS distance + tie-break *phải→trái→quay lại* → sửa thành luật cố định **thẳng→trái→phải→quay lại**, bỏ BFS.
2. **`TurnManager.placeItem()`**: đang gọi `canPlaceWallSafely()` → gỡ, đặt Wall tự do (bỏ luôn event `wall-blocked-invalid`).
3. **[MazePathfinder.ts](../assets/Scripts/Maze/MazePathfinder.ts)**: hết người dùng sau 2 sửa trên → gỡ khỏi base; tách logic set tường 2 phía (`setWallState`) thành util cho đặt Wall / mutation.

### Blocker để game chạy lên được (chưa làm)

1. **Chưa có level JSON** — `GameBootstrap` load `resources/levels/level_01` nhưng thư mục `resources` chưa tồn tại → cần tạo `assets/resources/levels/level_01.json` theo format mục 1.
2. **Scene chưa wire** — [scene.scene](../assets/scene.scene) mới có Canvas + Camera + node Player; chưa gắn `GameBootstrap` / `MazeBuilder` / `TurnManager`, chưa có `mazeRoot`.
3. **Chưa render + di chuyển rùa** — `GameState` có `turtleRow/Col` nhưng chưa có gì nối vào node hiển thị rùa.
4. **Chưa có UI** đặt item / chọn N bước → vòng lặp pha chưa chạy được bằng tay.

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
