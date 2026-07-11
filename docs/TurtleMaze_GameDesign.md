# Turtle Maze — Game Design V2

> Trạng thái: định hướng thiết kế mới, ưu tiên chốt trải nghiệm trước khi sửa code.

## 1. Vấn đề của thiết kế cũ

Thiết kế cũ yêu cầu người chơi đồng thời:

- dự đoán luật tự động của rùa;
- đặt item đúng vị trí;
- nhập số bước cho từng lượt;
- tới đích;
- ăn đủ điểm;
- không vượt quá giới hạn bước;
- xử lý thêm Flow và các loại wall đặc biệt.

Mỗi cơ chế riêng lẻ đều có tiềm năng, nhưng khi xuất hiện cùng lúc chúng làm tăng tải nhận thức. Người chơi mới có thể thua mà không hiểu mình sai ở dự đoán đường đi, số bước, điểm, item hay giới hạn lượt.

V2 giảm số điều kiện bắt buộc và chuyển phần chiều sâu sang lựa chọn item cùng hệ thống xếp hạng.

## 2. Tuyên bố sản phẩm

**Turtle Maze là game puzzle quan sát và can thiệp:** rùa tự chạy theo một luật công khai; người chơi dùng item để thay đổi môi trường, giúp rùa tới đích hoặc tạo một hành trình tối ưu hơn.

Game phục vụ hai động lực chơi khác nhau trên cùng một level:

1. **Người chơi thành tựu cơ bản:** chỉ cần đưa rùa tới đích khi `remain >= 0` và tận hưởng cảm giác hoàn thành level.
2. **Người chơi mastery/rank:** tối ưu đường đi, thu thập điểm và thể hiện năng lực qua sao, điểm số hoặc bảng xếp hạng.

Hai nhóm dùng cùng luật lõi. Người chơi không bị ép trở thành người chơi rank để được xem là đã thắng.

## 3. Luật lõi V2

### Rùa

- Rùa tự động di chuyển sau khi người chơi bắt đầu lượt chạy.
- Không còn NumberBoard và không nhập N bước theo lượt.
- Ở mỗi ô, hướng ưu tiên là: **thẳng → phải → trái → quay đầu**.
- Rùa tiếp tục chạy cho tới khi tới đích, bị kẹt hoặc gặp trạng thái kết thúc đặc biệt của level.
- Flow vẫn tác động theo hướng được thiết kế trên map.

### Điều kiện thắng

Điều kiện thắng bắt buộc duy nhất là biểu thức kết hợp:

> **Rùa tới đích VÀ số bước còn lại `remain >= 0`.**

Hai vế đều bắt buộc. Tới đích với `remain = 0` vẫn là thắng hợp lệ.

`targetScore` không còn là điều kiện thắng. Thiếu hoặc không ăn item điểm không biến một lần giải hợp lệ thành thất bại. `maxSteps` vẫn tạo giới hạn cho hành trình tự động; dùng bước cuối cùng để tới đích vẫn hợp lệ.

### Điểm và xếp hạng

Điểm là lớp mastery tùy chọn:

- item điểm có giá trị 1–7;
- người chơi có thể thắng với 0 điểm nếu tới đích và còn bước;
- người chơi muốn tối ưu phải chủ động bẻ đường để ăn nhiều item hơn mà vẫn tới đích;
- UI sau màn phải tách rõ **Level Complete** và **Performance**.

Điểm performance cuối màn được tính thống nhất:

> **`performanceScore = remain + pointCollected`**

Mỗi file JSON level định nghĩa `bestCase`: tổng performance tốt nhất mà designer kỳ vọng cho level đó. Kết quả được trình bày dưới dạng:

> **`performanceScore / bestCase`**

Tỉ lệ này là đầu vào để xét sao, best score và rank. `bestCase` thuộc dữ liệu level nên có thể cân bằng riêng mà không làm thay đổi luật thắng.

Ví dụ kết quả:

| Kết quả | Ý nghĩa |
|---|---|
| Tới đích, `remain >= 0`, không ăn item | Thắng level; performance chỉ nhận phần `remain` |
| Tới đích, `remain >= 0`, có ăn item | Thắng + performance cao hơn |
| `remain + pointCollected` gần/đạt `bestCase` | Sao/rank cao |
| Không tới đích hoặc `remain <= 0` | Chưa giải được level |

Ngưỡng sao/rank là dữ liệu cân bằng riêng của từng level, không phải điều kiện mở khóa chiến thắng.

## 4. Core loop mới

1. **Quan sát:** đọc map, hướng hiện tại của rùa, đích, Flow, item và vật cản.
2. **Can thiệp:** đặt hoặc chọn item được cấp cho level.
3. **Run:** bấm Start; rùa tự chạy liên tục, không cần nhập số bước.
4. **Kết quả:**
   - tới đích khi `remain >= 0` → thắng;
   - hết remain trước hoặc đúng lúc tới đích → chưa thắng;
   - bị kẹt/sai đường → cho retry nhanh;
   - sau khi thắng → hiển thị điểm và mức performance.
5. **Mastery loop tùy chọn:** replay để ăn thêm điểm, dùng ít item hơn hoặc tìm route đẹp hơn.

Một lần retry phải nhanh, giữ cho người chơi tập trung vào giả thuyết “nếu đặt item ở đây thì chuyện gì xảy ra?”.

## 5. Hai lớp trải nghiệm

### 5.1 Người chơi chỉ muốn thắng

Đối với nhóm này, một level hay không nằm ở lượng cơ chế hoặc độ khó tính toán. Một level hay cần tạo được một khoảnh khắc **“À, ra là vậy!”** rõ ràng.

Các tiêu chí:

1. **Mục tiêu dễ đọc:** người chơi nhìn thấy rùa, đích và vấn đề chính trong vài giây.
2. **Một câu hỏi puzzle trung tâm:** mỗi level nên hỏi một câu rõ ràng, ví dụ “làm sao buộc rùa rẽ xuống?” hoặc “dùng dòng nước để vượt vùng này thế nào?”.
3. **Ít thao tác nhưng có ý nghĩa:** một hoặc hai item đúng chỗ tạo khác biệt lớn hơn nhiều thao tác nhỏ.
4. **Nhân quả trực quan:** đặt item → map thay đổi rõ → rùa phản ứng đúng như người chơi dự đoán.
5. **Retry không đau:** thất bại diễn ra nhanh, lý do dễ hiểu, chơi lại gần như ngay lập tức.
6. **Có cảm giác tiến triển:** rùa liên tục di chuyển gần hơn tới đích; tránh thời gian chờ hoặc vòng lặp dài vô nghĩa.
7. **Khoảnh khắc trình diễn:** Flow cuốn rùa, wall vỡ, item kích hoạt hoặc đường mới mở ra tạo cảm giác phần thưởng thị giác.
8. **Không bắt buộc vét điểm:** route thắng cơ bản phải hợp lệ dù bỏ qua phần lớn item điểm.
9. **Có thể có nhiều lời giải:** ít nhất một route đơn giản; route đẹp hơn dành cho người muốn khám phá.
10. **Mỗi level dạy một điều:** chỉ giới thiệu một ý mới hoặc kết hợp tối đa một ý cũ với một ý mới.

Công thức level casual tốt:

> **Đọc được vấn đề → thử một giả thuyết → thấy phản hồi rõ → rùa tới đích → cảm thấy mình thông minh.**

Độ khó nên đến từ việc nhận ra can thiệp đúng, không đến từ nhớ quá nhiều luật hoặc nhập chính xác nhiều tham số.

### 5.2 Người chơi muốn mastery/rank

Sau khi route thắng cơ bản đã rõ, cùng level mở thêm các câu hỏi:

- có thể lấy bao nhiêu điểm trước khi về đích?
- route nào gom được item giá trị cao?
- có thể dùng ít item can thiệp hơn không?
- có thể tận dụng Flow hoặc wall vỡ để tạo đường tối ưu không?
- có nhiều route cùng điểm nhưng khác độ khó/rủi ro không?

Nhóm này cần thông tin minh bạch: `remain`, `pointCollected`, phép cộng thành `performanceScore`, `bestCase`, điểm cá nhân tốt nhất và tiêu chí sao/rank phải được công bố rõ.

## 6. Item là nơi chứa chiều sâu

V2 không loại bỏ cái hay; nó chuyển cái hay khỏi danh sách điều kiện bắt buộc sang item và tương tác map.

Mỗi item tốt nên:

- có một chức năng chính dễ giải thích trong một câu;
- tạo thay đổi nhìn thấy ngay;
- kết hợp được với luật rẽ tự động;
- có cách dùng cơ bản để thắng;
- có cách dùng nâng cao để gom điểm hoặc tối ưu;
- không yêu cầu người chơi nhớ ngoại lệ ẩn.

Ví dụ cấu trúc giới thiệu:

| Giai đoạn | Nội dung |
|---|---|
| Tutorial | Một item, một mục đích, route thắng rõ |
| Early game | Item cũ + một địa hình mới |
| Mid game | Hai item có tương tác, điểm tạo route phụ |
| Advanced | Flow, wall vỡ và item tạo nhiều route mastery |

Wall vỡ có thể là bẫy hay, nhưng phải được báo hiệu bằng visual rõ và level đầu tiên sử dụng nó phải cho người chơi học trong môi trường ít hình phạt.

## 7. Quy định icon điểm

| Điểm | Icon |
|---:|---|
| 1 | `swim_float` |
| 2 | `shell` |
| 3 | `icecream` |
| 4 | `coconut` |
| 5 | `compass` |
| 6 | `snail` |
| 7 | `starfish` |

Icon điểm scale mượt `0.8 → 1 → 0.8`. Điểm chỉ phục vụ performance, không quyết định thắng/thua.

## 8. UI/UX bắt buộc

Trong gameplay:

- mục tiêu “Đưa rùa tới đích khi vẫn còn bước” phải nổi bật hơn điểm;
- bỏ UI nhập số bước;
- điểm hiện tại vẫn cập nhật realtime nhưng được trình bày như mục tiêu phụ;
- có Start, Retry và Back rõ ràng;
- khi thất bại phải chỉ ra nguyên nhân trực quan: kẹt, loop hoặc sai route.

Sau màn:

1. Hiện **Level Complete** khi tới đích với `remain >= 0`.
2. Tổng kết rõ `remain + pointCollected = performanceScore` và so với `bestCase`.
3. Cho ba lựa chọn rõ: Next Level, Replay for Better Score, Back to Lobby.

Không dùng thông báo “thua vì thiếu điểm”. Nếu rùa dùng bước cuối cùng để tới đích (`remain = 0`) thì vẫn thắng.

## 9. Nguyên tắc thiết kế level

Mỗi level cần ghi rõ hai route mục tiêu:

- **Completion route:** lời giải dễ nhất để tới đích khi vẫn còn bước, không yêu cầu ăn item điểm.
- **Mastery route:** lời giải có điểm/ngưỡng sao cao hơn.

Checklist trước khi duyệt level:

- Người mới có hiểu mục tiêu trong 5 giây không?
- Completion route có cần ít kiến thức hơn Mastery route không?
- Thất bại có giải thích được bằng hình ảnh không?
- Item chính có tạo ra một quyết định đáng nhớ không?
- Điểm có dẫn người chơi tới route thú vị thay vì chỉ kéo dài đường đi không?
- Người chơi thắng cơ bản có cảm giác trọn vẹn không?
- Người chơi giỏi có lý do rõ ràng để replay không?

## 10. Những quyết định cần playtest

- Rùa bắt đầu chạy ngay hay chỉ chạy sau nút Start?
- Người chơi được đặt toàn bộ item trước Run hay được pause/can thiệp giữa lúc chạy?
- Khi rùa kẹt, game tự reset hay chờ người chơi bấm Retry?
- Sao dựa hoàn toàn vào điểm hay kết hợp số item đã dùng/thời gian?
- Rank so sánh tổng điểm, điểm từng level hay một score chuẩn hóa?
- Có hiển thị `bestCase` trước khi chơi hay chỉ ở màn kết quả không?

Khuyến nghị cho prototype gần nhất:

> Giữ pha quan sát/đặt item, dùng một nút Start, sau đó rùa chạy tự động tới khi thắng hoặc kẹt. Không cho can thiệp giữa lúc chạy ở các level đầu. Điểm chỉ xuất hiện ở màn tổng kết và HUD phụ.

## 11. Trạng thái migration code

Đã hoàn tất core V2:

1. Gỡ `BoardBtnNumber` khỏi scene/code và thay bằng nút `StartRun`.
2. `TurnManager.runAutomatically()` chạy tới đích, kẹt hoặc hết remain và có guard chống loop miễn phí.
3. Điều kiện thắng là `isAtGoal() && remain >= 0`.
4. Đã bỏ thất bại `not-enough-score`; điểm item chỉ phục vụ performance.
5. JSON level đã có `rating.bestCase`; giá trị hiện tại là baseline tự động và cần level designer tune theo route tối ưu thực tế.
6. Event `game-ended` trả về `remain`, `pointCollected`, `performanceScore`, `bestCase` và `ratingRatio`.

Còn cần làm: màn kết quả tách Completion/Performance và quy định chính thức các ngưỡng sao/rank.
