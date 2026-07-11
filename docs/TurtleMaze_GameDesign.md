# 🐢 Turtle Maze — Game Design Document (v1.0)

> Thể loại: Puzzle / Auto-runner trong mê cung dạng ma trận, chơi theo **pha (phase/round)**.
> Engine: **Cocos Creator** (TypeScript).
> 🎯 **Theme cuộc thi: FLOW (dòng chảy)** — thể hiện qua cơ chế dòng nước cuốn rùa trôi theo (mục 6).
>
> 📎 Phần kỹ thuật (data format, mapping code, roadmap, câu hỏi mở) tách riêng ở [TurtleMaze_Implementation.md](TurtleMaze_Implementation.md).
>
> **3 core twist:**
> 1. Người chơi **không điều khiển rùa trực tiếp** — rùa tự đi theo luật ưu tiên cố định. Người chơi **thiết kế lại mê cung bằng item** (Wall, Food, +Step) để "ép" rùa đi theo tuyến tối ưu.
> 2. **Map biến đổi bất ngờ giữa các pha** — tường mất / tường dựng / dòng chảy đổi. Người chơi đoán được luật đi của rùa nhưng không đoán được map → phải liên tục thích nghi, tạo bất ngờ và dopamine 🎢.
> 3. 🌊 **Dòng chảy trong map** — rùa bước vào ô nước là bị cuốn trôi theo hướng dòng do map design sẵn.

---

## 1. Tổng quan

Rùa xuất phát tại một ô trong mê cung dạng ma trận (grid). Trên đường đi có đồ ăn (Food) để cộng điểm. Rùa di chuyển **hoàn toàn tự động**: tại ngã ba / ngã tư nó chọn hướng theo **độ ưu tiên cố định** mà người chơi nắm rõ luật.

Trong map có các **dòng chảy** 🌊 — chuỗi ô nước có hướng. Rùa bước vào là bị **cuốn trôi theo dòng** cho tới khi ra khỏi dòng. Dòng chảy vừa là đường tắt, vừa là bẫy — tùy người chơi tận dụng.

Một màn chơi diễn ra qua **nhiều pha**. Mỗi pha, người chơi đặt item và chọn số bước rùa đi. Rùa đi xong, **map bất ngờ biến đổi** rồi mới sang pha tiếp theo.

Gameplay = **đặt vật cản để tái cấu trúc mê cung** + **lợi dụng / né dòng chảy** + **thích nghi với map luôn biến động**. Không phải vẽ đường — mà là bẻ dòng.

### Điều kiện thắng (phải đủ cả 3)

| # | Điều kiện |
|---|-----------|
| 1 | Rùa **về tới đích** |
| 2 | Rùa **ăn đủ số điểm yêu cầu** (`targetScore`) |
| 3 | Rùa về đích với **tổng số bước (cộng dồn qua các pha) ≤ giới hạn** (`maxSteps`) |

### Điều kiện thua

| Lý do | Mã (`reason` trong event `game-ended`) |
|---|---|
| Rùa bị kẹt — mọi hướng đều bị chặn | `stuck` |
| Hết quỹ bước mà chưa về đích | `out-of-steps` |
| Về đích nhưng chưa đủ điểm | `not-enough-score` |

### Xếp hạng sao (tunable sau playtest)

| Sao | Điều kiện |
|:---:|---|
| ⭐ | Thắng màn |
| ⭐⭐ | Thắng + còn dư ≥ 20% quỹ bước |
| ⭐⭐⭐ | Thắng + ăn **toàn bộ** Food có trên map |

---

## 2. Vòng lặp gameplay theo pha

Một màn chơi = **chuỗi các pha lặp lại** cho tới khi thắng hoặc thua:

```
┌────────────────────────── MỘT PHA ──────────────────────────┐
│                                                              │
│  (1) Quan sát        (2) Đặt item          (3) Rùa chạy      │
│  map hiện tại   →    + chọn N lượt    →    tính theo ô đích  │
│  (kể cả dòng chảy)   cho pha này           (trôi theo dòng   │
│                                             nếu vào ô nước)  │
└──────────────────────────────┬───────────────────────────────┘
                               │
                    (4) 💥 MAP BIẾN ĐỔI BẤT NGỜ
              (tường mất / dựng lên / dòng chảy đổi)
                               │
                               ▼
                     sang pha tiếp theo…
              (lặp tới khi rùa về đích / thua)
```

### (1) Quan sát — đầu mỗi pha

Người chơi thấy **trạng thái map hiện tại**: vị trí + hướng nhìn của rùa, đích, **các dòng chảy và hướng chảy** (mũi tên trên ô nước), điểm đã ăn / `targetScore`, bước đã dùng / `maxSteps`, inventory còn lại, các ô hợp lệ để đặt item.

### (2) Đặt item & chọn N bước

1. **Đặt item** tại vị trí chiến lược (ngã rẽ, hoặc chặn / lợi dụng dòng chảy).
2. **Chọn N** — số lượt di chuyển chủ động tối đa trong pha. Quỹ `maxSteps` chỉ giảm khi rùa **đáp xuống Land**; đi vào hoặc đi giữa các ô Flow không giảm quỹ.

**Đặt Wall có kiểm tra** — không được đặt ngoài biên, chồng lên Wall có sẵn, giữa hai ô Flow hoặc tại cạnh làm mất toàn bộ đường từ vị trí rùa tới đích.

### (3) Rùa chạy N bước

Nhấn Start → rùa thực hiện tối đa **N lượt di chuyển chủ động** theo luật mục 4 rồi dừng. Các nhịp vào/đi trong Flow có thể làm rùa đi qua nhiều ô mà không giảm quỹ bước; nhịp đáp xuống Land mới giảm quỹ.

- Ăn Food → cộng điểm. Ăn `+XS` → cộng bước vào quỹ.
- **Bước vào ô dòng chảy → bị cuốn trôi** (luật mục 6); Land → Flow và Flow → Flow không tốn bước, Flow → Land tốn 1 bước.
- Về tới đích → kết thúc màn, xét 3 điều kiện thắng.
- Bị kẹt → thua ngay.

### (4) 💥 Map biến đổi

Rùa đi xong pha đã chọn (chưa về đích) → map **tự biến đổi theo kịch bản** (mục 7) với animation rõ ràng → sang pha mới.

> Cú lừa chủ đạo: người chơi tính trước được đường rùa (luật cố định) nhưng **không biết map sẽ đổi ra sao** → mỗi pha là một lần bất ngờ, phải tính lại.

---

## 3. Luật đã chốt (tổng hợp)

| # | Quyết định | Chi tiết |
|---|---|---|
| 1 | **Luật rẽ cố định** | Thẳng → Phải → Trái → Quay lại. Không dùng BFS để chọn hướng. |
| 2 | **Đặt Wall có điều kiện** | Không đặt ngoài biên, chồng Wall, giữa 2 ô Flow hoặc nếu làm mất toàn bộ đường tới đích. |
| 3 | **Tính bước theo ô đích** | Land → Land và Flow → Land tốn 1; Land → Flow và Flow → Flow miễn phí. |
| 4 | **Ăn item khi trôi: CÓ** | Dòng chảy design được thành "băng chuyền điểm". |
| 5 | **Đặt item lên ô nước: ĐƯỢC** | Food/`+XS` đặt trên ô nước làm mồi; Wall chỉ đặt được trên cạnh Flow–Land hoặc Land–Land (không đặt được giữa 2 ô Flow, xem #9). |
| 6 | **Mutation scripted** (v1) | Kịch bản định nghĩa sẵn theo level. Random-có-luật để bản sau. |
| 7 | **Mutation chỉ giữa các pha** (v1) | Mid-run ("đang đi tường dựng lên") để dành cho level khó bản sau. |
| 8 | **Tường người chơi đặt không bị mutation xóa** | Giữ cảm giác kiểm soát. |
| 9 | **Wall theo cạnh (edge)** | Chặn cạnh giữa 2 ô, khớp `walls[dir]` trong `CellData`. Mỗi ô có `flow?: Dir` (có giá trị = ô **Flow**/nước theo hướng đó, `undefined` = ô **Land**/cạn). Luật đặt: Flow–Flow ❌ (dòng chảy phải liền mạch, không bị chặn giữa 2 ô nước kề nhau); Flow–Land ✅; Land–Land ✅. |
| 10 | **Food: level đặt sẵn + người chơi đặt thêm** | Cả hai nguồn, code `placeItem` đã hỗ trợ. |
| 11 | **N bước/pha tự do** | 1 ≤ N ≤ quỹ còn lại. |

*(Các con số cụ thể — điểm, bước, tỉ lệ sao — đều tunable sau playtest.)*

### Wall vỡ đánh lừa

`WallState.DISAPPEAR` được thể hiện bằng nét đứt. Nó được tính là vật cản thật cho tới khi rùa vừa bước vào một trong hai ô nằm sát cạnh đó. Ngay lúc ấy wall vỡ, cả hai phía của cạnh chuyển thành `NONE`, bản đồ đường đi được tính lại và rùa dùng layout mới ở lần chọn hướng kế tiếp. Wall này không phải wall do người chơi đặt; nó là bẫy được thiết kế sẵn trong level.

---

## 4. Luật di chuyển của rùa 🐢

Rùa **không đi ngẫu nhiên**. Luật công khai, không đổi giữa các pha — thứ thay đổi là map.

Tại thời điểm bắt đầu level, hướng nhìn của rùa được chọn từ một cạnh đang mở tại ô start theo cùng thứ tự ưu tiên; sprite tween sang hướng hợp lệ trước khi chạy, không chĩa đầu vào tường.

### Trên cạn

- **Hành lang một chiều** (chỉ 1 lối ra ngoài lối vừa vào): tiếp tục đi tới.
- **Ngã ba / ngã tư** — chọn theo ưu tiên (hướng tương đối theo hướng rùa đang nhìn):

| Ưu tiên | Hướng |
|:---:|---|
| 1 | ⬆️ **Đi thẳng** — nếu phía trước không bị chặn |
| 2 | ➡️ **Rẽ phải** |
| 3 | ⬅️ **Rẽ trái** |
| 4 | 🔄 **Quay lại** |

- **Mọi lối bị chặn** → rùa kẹt → thua (`stuck`).

> Luật cố định giúp người chơi dự đoán **100%** đường đi của rùa trên map hiện tại — độ bất ngờ đến từ mutation và dòng chảy, không đến từ AI của rùa.

### Trong dòng chảy 🌊

Luật ưu tiên **tạm ngưng** — rùa bị cuốn theo dòng, xem mục 6.

---

## 5. Item

Người chơi đặt item lên **lối đi** trong bước (2) mỗi pha; level cũng có thể đặt sẵn.

| Ký hiệu | Item | Tác dụng |
|:---:|---|---|
| `swim_float` / `shell` / `icecream` / `coconut` / `compass` / `snail` / `starfish` | 🍦 **Food 1–7 điểm** | Giá trị tương ứng là `1 / 2 / 3 / 4 / 5 / 6 / 7`; rùa đi hoặc trôi qua sẽ ăn và cộng đúng `itemValue` |
| `W` | 🧱 **Wall** | **Chặn 1 cạnh** giữa 2 ô — bẻ hướng rùa, hoặc **chặn ngang dòng chảy** để rùa hết bị cuốn (mục 6) |
| `+XS` | ⏱️ **+X Steps** | Rùa đi/trôi qua sẽ **cộng X bước** vào quỹ (ví dụ `+3S` = +3 bước) |

---

## 6. 🌊 Cơ chế dòng chảy (Flow) — theme cuộc thi

Dòng chảy là **địa hình** (không phải item): chuỗi ô nước liền nhau, mỗi ô có **hướng chảy** do map design sẵn. Vừa thể hiện theme FLOW, vừa là công cụ level design mạnh: đường tắt, bẫy, hoặc băng chuyền gom Food.

### Luật trôi (cố định, công khai)

1. **Vào dòng:** Rùa bước (hoặc bị cuốn) vào ô dòng chảy → bị **cuốn theo hướng chảy của từng ô**, không tự chọn hướng nữa.
2. **Trôi liên tiếp:** Mỗi nhịp trôi sang ô kế theo hướng chảy của ô đang đứng; ô kế cũng là dòng → trôi tiếp theo hướng của ô đó (dòng uốn cong được).
3. **Ra khỏi dòng:** Ô kế theo hướng chảy là ô cạn → rùa dạt lên đó, **hướng nhìn = hướng chảy cuối**, từ bước sau đi lại theo luật mục 4.
4. **Dòng bị chặn:** Hướng chảy bị Wall chặn (người chơi đặt hoặc mutation) → rùa **dừng trên ô nước đó**, hết bị cuốn; bước sau đi theo luật thường. → Chiêu chiến thuật: **đặt Wall chặn dòng để "vớt" rùa** đúng chỗ mình muốn.
5. **Tính bước theo ô đích:** Land → Flow và Flow → Flow không trừ quỹ. Khi dòng đẩy rùa từ Flow lên Land, lần đáp xuống Land đó trừ 1 bước. Land → Land cũng trừ 1 bước như bình thường.
6. **Ăn khi trôi:** Rùa vẫn ăn Food / `+XS` trên các ô nước trôi qua.

### Fairness

- Các dòng chảy **không được tạo vòng khép kín** (trôi vô hạn) — level designer tự đảm bảo khi design map và khi viết mutation.
- Hướng chảy **hiển thị rõ** (mũi tên/animation trên ô nước).

### Tương tác hệ thống

- **Với Wall:** chặn được dòng (luật 4) → thêm nước đi "cứu rùa".
- **Với Mutation:** dòng đổi hướng / xuất hiện / biến mất giữa các pha (mục 7).
- **Với người chơi:** luật trôi cố định + công khai → vẫn tính trước được; đúng tinh thần "bất ngờ đến từ map, không đến từ luật".

---

## 7. 💥 Hệ thống biến đổi map (Map Mutation)

Sau mỗi pha (rùa đi xong N bước, chưa về đích), map biến đổi **theo kịch bản của level** trước khi sang pha mới.

### Các kiểu biến đổi

| Kiểu | Mô tả | Tác động |
|---|---|---|
| 🧱→✨ **Tường biến mất** | Tường trên map biến mất | Mở lối đi mới không lường trước |
| ✨→🧱 **Tường dựng lên** | Tường mới xuất hiện | Chặn tuyến đã tính — buộc đổi kế hoạch |
| 🌊🔄 **Dòng đổi hướng** | Đoạn dòng chảy đảo/xoay hướng | Đường tắt thành bẫy (và ngược lại) |
| 🌊✨ **Dòng xuất hiện / biến mất** | Ô cạn ↔ ô nước | Đổi hẳn cấu trúc di chuyển một vùng |

### Luật fairness

1. Mutation **không nhốt rùa tại chỗ** — sau khi đổi, rùa còn ≥ 1 hướng đi.
2. Mutation **không cắt đứt hoàn toàn đường tới đích** — đảm bảo bằng tay khi viết kịch bản level (không check runtime).
3. **Không xóa tường do người chơi đặt.**
4. Map đổi **sau khi rùa dừng**, animation rõ ràng cho thấy cái gì vừa thay đổi.
5. Mutation dòng chảy không tạo **vòng chảy khép kín**.

### Kịch bản (v1: scripted)

Mỗi level định nghĩa sẵn chuỗi mutation theo pha: *"sau pha 1: tường A mất; sau pha 2: dòng B đảo hướng…"*. Level designer kiểm soát độ khó, đảm bảo puzzle giải được. *(Bản sau có thể lai thêm random-có-luật làm gia vị / tăng replay value.)*

---

## 8. UI / UX

### Màn hình

`Main Menu → Level Select → Gameplay → Win/Lose popup (retry / next)`

### Trong Gameplay

- **HUD:** điểm đã ăn / `targetScore` • bước còn lại / `maxSteps` • số pha hiện tại • inventory item (kéo-thả). NumberBoard đếm ngược số bước đã chọn và chỉ giảm khi rùa đáp xuống Land; Land → Flow / Flow → Flow giữ nguyên số.
- **Icon điểm:** không có label/background. Icon scale mượt `0.8 → 1 → 0.8` theo cosine và lệch pha giữa các ô.
- **Pha đặt item:** highlight ô/cạnh hợp lệ khi kéo item; slider hoặc +/- chọn N bước; nút **Start**.
- **Pha rùa chạy:** khóa input; animation rùa đi từng ô (~0.3s/ô); hiệu ứng nước cuốn khi trôi (nhanh hơn đi bộ để "đã").
- **Mutation:** camera nhấn vào chỗ thay đổi, animation tường sập/dựng, nước dâng/rút, dòng xoay mũi tên — người chơi phải **thấy rõ** cái gì vừa đổi.

---

*Chi tiết kỹ thuật để implement → [TurtleMaze_Implementation.md](TurtleMaze_Implementation.md)*
