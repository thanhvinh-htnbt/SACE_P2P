# 🐢 Turtle Maze — Implementation Notes (dev)

> Core V2 đã được migration: không còn NumberBoard; luật thắng là `isAtGoal() && remain > 0`; điểm item không quyết định thắng. Performance được tính `remain + pointCollected` và so với `bestCase` trong từng JSON.

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

// V2 — điểm không nằm trong điều kiện thắng.
export interface WinCondition {
    maxSteps: number;      // phải tới đích khi remain > 0
}

export interface RatingConfig {
    bestCase: number;      // performance tốt nhất dự kiến của level
    starRatios?: number[]; // tùy chọn, ví dụ ngưỡng tỉ lệ cho 1/2/3 sao
}

export interface MazeLevelData {
    levelId: string;
    rows: number;
    cols: number;
    start: { row: number; col: number };
    startFacing: Dir;                     // MỚI — hướng nhìn ban đầu
    goal: { row: number; col: number };
    cells: CellData[];
    winCondition: WinCondition;           // { maxSteps }, không còn targetScore
    rating: RatingConfig;                 // performanceScore / bestCase
    inventory: { wall: number; food: number; stepBonus: number };  // MỚI
    mutations: PhaseMutation[];           // MỚI
}
```

### Màn 1 — Ma trận 6×8 (spec khởi điểm, tunable)

| Thuộc tính | Giá trị |
|---|---|
| Kích thước | 6 hàng × 8 cột |
| Legend | Icon Food = 1–7 điểm, `W` = Wall, `+XS` = cộng step, `↑→↓←` = ô dòng chảy |
| `maxSteps` | 20 *(draft)* |
| `rating.bestCase` | Designer tính từ completion/mastery route của level |
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
7. `TurnManager.runAutomatically()` chạy tới đích/kẹt/hết remain; Land → Flow và Flow → Flow không giảm remain. `StartRun` thay thế toàn bộ NumberBoard.
8. Khi `TurnManager.init()`, `TurtleAgent.getNextDirection()` chọn hướng mở hợp lệ đầu tiên tại ô start. `GameBootstrap.tweenInitialFacing()` tween sprite sang hướng đó trước lượt chạy đầu tiên.
9. `ItemSpace.applySystemWallSize()` chỉ resize wall sau khi drop hợp lệ: từ preview `128×32` về cùng format wall tĩnh `8×128`; horizontal xoay `90°`, vertical `0°`.
10. `GameBootstrap.loadPointItemFrames()` preload icon trong `resources/sprite/Item`; `spawnCellItems()` thay Sprite runtime theo mapping: `swim_float=1`, `shell=2`, `icecream=3`, `coconut=4`, `compass=5`, `snail=6`, `starfish=7`. Không còn `ValueLabel` hoặc background.
11. `TurtleAgent.breakAdjacentWalls()` xóa `WallState.DISAPPEAR` ở cả hai ô ngay sau khi rùa tới ô kề. `TurnManager` recalculate pathfinder và emit `walls-broken`; `GameBootstrap` tween node wall về scale 0 rồi ẩn.
12. Level 09 nằm tại `assets/resources/levels/level_09.json` và `assets/Prefabs/Level_09.prefab` (10×8). Wall vỡ dùng `wall-crack.png` cùng `BreakableWallView`; mảng `frames` hiện có một SpriteFrame và đã sẵn sàng nhận nhiều frame animation sau này.
13. `TurtleFrameAnimator` dùng 6 frame, cập nhật bằng `update(dt)` thay vì scheduler. `GameBootstrap` truyền duration tween vào `play(duration)` để một chu kỳ frame được trải đều theo tốc độ di chuyển thường hoặc Flow; scene có thể bật `pingPong` nếu cần.
14. Cũng trong `TurtleFrameAnimator`, trạng thái idle nội suy scale theo cosine từ `1.176471` tới `1.3` rồi quay lại. `idleHalfCycle` mặc định `0.65s`; `play()` khóa scale ở mức min và `stop()` khởi động lại nhịp idle.
15. `PointItemAnimator` nội suy cosine scale icon từ `0.8` tới `1` rồi về `0.8` (`halfCycle=0.6s`). `GameBootstrap` truyền phase offset theo cell index để các icon không chạy đồng bộ tuyệt đối.

16. `GameAudio` preload SFX từ `resources/audio` và tồn tại xuyên scene. Mapping: Start/Back → `click`, Land → `player_move`, Flow → `wave`, ăn item → `item`, thắng → `win`, thua → `lose`. Các hiệu ứng dùng `AudioSource.playOneShot()` nên có thể phát chồng tự nhiên.
17. Luồng UI Ingame gồm ba trạng thái: **Setup** cho phép kéo Wall và bật `START`; **Running** khóa `DraggableItem`, đổi CTA thành `RUNNING`; **Ended** giữ khóa input và đổi CTA thành `DONE`. Bố cục theo mockup: Back góc trái, HUD trên map, kho Walls bên phải và Start ngay dưới kho.

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

- `maxSteps`, `bestCase` và inventory màn 1 có cho độ khó hợp lý?
- Ngưỡng sao nên dùng tỉ lệ `performanceScore / bestCase` nào?
- Trôi miễn phí có làm dòng chảy quá mạnh (người chơi chỉ chăm chăm dùng dòng)?
- Có cần giới hạn thời gian chạy hoặc số lần retry để phục vụ rank không?
- Mid-run mutation ("đang đi tường dựng lên") đưa vào từ level mấy?
