# Turtle Maze

Rùa tự động di chuyển trong mê cung theo thứ tự ưu tiên cố định:

1. Đi thẳng.
2. Rẽ phải.
3. Rẽ trái.
4. Quay đầu.

Người chơi kéo Wall từ ItemSpace và đặt vào cạnh giữa hai ô để thay đổi đường đi. Wall hợp lệ được ghi vào cả hai ô kề nhau và là vật cản thật; rùa và dòng chảy không thể đi xuyên qua. Không thể đặt Wall ngoài biên, chồng lên Wall có sẵn, giữa hai ô Flow hoặc tại vị trí làm mất toàn bộ đường tới đích.

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

Rùa tween vị trí và hướng nhìn bằng easing `sineInOut` sau mỗi lần di chuyển. Góc quay luôn dùng cung ngắn nhất giữa hướng cũ và hướng mới; tween thường kéo dài `0.45s`, tween Flow `0.28s`.
