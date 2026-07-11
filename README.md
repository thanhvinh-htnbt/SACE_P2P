# Turtle Maze

Rùa tự động di chuyển trong mê cung theo thứ tự ưu tiên cố định:

1. Đi thẳng.
2. Rẽ phải.
3. Rẽ trái.
4. Quay đầu.

Người chơi kéo Wall từ ItemSpace và đặt vào cạnh giữa hai ô để thay đổi đường đi. Wall hợp lệ được ghi vào cả hai ô kề nhau và là vật cản thật; rùa và dòng chảy không thể đi xuyên qua. Không thể đặt Wall ngoài biên, chồng lên Wall có sẵn, giữa hai ô Flow hoặc tại vị trí làm mất toàn bộ đường tới đích.

Wall trong ItemSpace dùng kích thước preview `128×32` để dễ thao tác. Sau khi drop hợp lệ, wall được chuẩn hóa giống wall hệ thống: `UITransform 8×128`; wall ngang xoay `90°`, wall dọc giữ `0°`.

## Wall vỡ (`WallState.DISAPPEAR`)

Wall nét đứt vẫn chặn đường khi người chơi quan sát và tính toán. Khi rùa vừa tới một trong hai ô kề wall, wall vỡ trước lần chọn hướng tiếp theo, được xóa khỏi `walls` của cả hai ô và pathfinding được tính lại. Vì vậy rùa lập tức chọn đường mới như thể cạnh đó không còn tường. Level 09 sử dụng cơ chế này để đánh lừa người chơi.

Visual wall vỡ dùng `wall-crack.png` và component `BreakableWallView`. Component nhận mảng `frames`; hiện có một frame và dùng tween thu nhỏ khi vỡ. Khi có thêm asset animation, chỉ cần gán các SpriteFrame theo thứ tự vào `frames` để chạy frame-by-frame trước khi wall biến mất.

## Luật tính bước

Số bước được tính theo loại của ô đích:

- Land → Land: tốn 1 bước.
- Land → Flow: không tốn bước.
- Flow → Flow: không tốn bước.
- Flow → Land: tốn 1 bước.

Vì vậy toàn bộ đoạn di chuyển trên Flow là miễn phí; một bước chỉ bị trừ khi rùa đáp xuống Land.

NumberBoard hiển thị số bước đã chọn dưới dạng countdown khi rùa chạy và cũng chỉ giảm ở chuyển động có `consumesStep = true`. Land → Flow và Flow → Flow không làm giảm số trên board.

## Điều kiện thắng

Rùa phải đồng thời:

1. Tới đích.
2. Thu thập đủ `targetScore`.
3. Không dùng quá `maxSteps`.

HUD cập nhật `Point: current/target` ngay khi ăn điểm và `Remain: remaining/max` sau từng chuyển động có tính bước.

Food được đặt sẵn trên map chỉ render label giá trị, không render background của prefab Item để Land/Flow bên dưới vẫn nhìn thấy rõ.

Rùa tween vị trí và hướng nhìn bằng easing `sineInOut` sau mỗi lần di chuyển. Góc quay luôn dùng cung ngắn nhất giữa hướng cũ và hướng mới; tween thường kéo dài `0.45s`, tween Flow `0.28s`.

Animation rùa dùng 6 frame `turtle_1..6`. `TurtleFrameAnimator` trải đều toàn bộ frame theo duration của từng tween, hỗ trợ tùy chọn ping-pong và tự fallback load từ `resources/anim` nếu Inspector chưa gán đủ frame.

Khi idle, rùa có animation “thở” bằng scale: tăng mượt từ `(1.176471, 1.176471)` tới `(1.3, 1.3)`, sau đó giảm mượt về mức nhỏ nhất và lặp lại. Mỗi nửa chu kỳ mặc định là `0.65s`; khi rùa chạy, breathing tạm dừng và scale trở về mức nhỏ nhất.

Khi bắt đầu level, rùa không giữ một hướng cố định có thể chĩa vào tường. Hướng khởi tạo được chọn từ cạnh mở đầu tiên theo luật thẳng → phải → trái → quay đầu, sau đó đầu rùa tween sang hướng hợp lệ trong `0.4s`.
