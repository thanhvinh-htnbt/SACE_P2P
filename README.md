Turtle Maze Description

Rùa xuất phát trong một mê cung dạng ma trận. Trên đường có các đồ ăn để cộng điểm. Rùa sẽ tự động đi theo mê cung. Ở các ngã ba hoặc ngã tư, rùa sẽ tự chọn đường theo sự ưu tiên thứ tự là đi thẳng, rẽ phải, rẽ trái, quay đầu.

Bắt đầu mỗi lượt chơi, Người chơi đặt **Item** để trên lối đi và cho số bước mà rùa di chuyển, nếu là Wall khiến rùa chỉ còn những hướng mà người chơi mong muốn. Nhờ vậy, gameplay không phải là “vẽ đường đi” trực tiếp, mà là **thiết kế lại mê cung bằng vật cản** để ép rùa đi theo tuyến tối ưu.

Điều kiện thắng gồm 3 yếu tố:

1. Rùa phải **về tới đích**.
2. Rùa phải **ăn đủ số điểm yêu cầu**.
3. Rùa phải về đích **trong vòng số bước quy định**.

---

# Vòng lặp gameplay

Một màn chơi có thể chia thành 3 pha:

## 1. Pha quan sát

Người chơi nhìn thấy toàn bộ mê cung, vị trí rùa, đích, đò ăn và các ngã rẽ quan trọng.

Game hiển thị:

* Vị trí hiện tại của rùa.
* Vị trí đích.
* Số điểm hiện tại / cần đạt.
* Số bước hiện tại / giới hạn.
* Các loại item và số lượng.
* Các ô có thể đặt item.

## 2. Pha đặt item và chọn số bước

Người chơi đặt item tại các ngã ba hoặc ngã tư. Chọn số bước mà người chơi muốn rùa đi.

Ví dụ: tại một ngã tư có 4 hướng, người chơi có thể đặt Wall ở trước mặt để rùa không thể đi thẳng mà phải buộc rẽ.

## 3. Pha rùa di chuyển

Sau khi người chơi bấm GO, rùa tự động di chuyển.

Người chơi quan sát xem rùa có đi đúng lộ trình không.
---
