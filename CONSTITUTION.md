# Hiến pháp — Lớp Học Diệu Kỳ

> Luật **bất biến** cho mọi người và mọi agent làm việc trong repo này. Đứng trên tài liệu thiết kế, ADR, skill và yêu cầu từng lượt.
> Muốn đổi một điều → anh Nam duyệt, ghi ADR, sửa file này trong cùng PR. Không agent nào được "tạm lách".

## §1 Sản phẩm phục vụ việc học, không phục vụ thời gian dùng
1. Trò chơi **hỗ trợ** giáo viên, không thay giáo viên. Mọi phiên học có người lớn chịu trách nhiệm.
2. Không paywall kiến thức cơ bản; không bán điểm, lợi thế học tập hay vật phẩm ảnh hưởng kết quả học.
3. Không streak phạt, không đếm ngược gây áp lực, không bảng xếp hạng cá nhân giữa trẻ. EXP/huy hiệu không bao giờ được trình bày như thước đo trí thông minh.
4. Sai thì mời thử lại — không dấu X đỏ, không âm thanh chê.
5. Gameplay RPG (nhiệm vụ, EXP, trang phục) chỉ dành cho **không gian người lớn** để giải trí và hiểu cơ chế. Không thao túng (loot box, đếm ngược mua hàng, ép đăng nhập), không bán lợi thế học tập.

## §2 An toàn trẻ em là kiến trúc, không phải tính năng
0. **Người lớn đi trước, trẻ đi sau, hai không gian tách hẳn nhau.** Trường chơi (`play`) chỉ có người lớn. Trẻ chỉ tham gia qua **tổ chức có thật đã xác minh**, do **giáo viên thật** quản lý (`organization`). Không có đường đi qua lại giữa hai không gian (ADR-0014).
1. Mặc định an toàn: tính năng xã hội mới **tắt** cho tài khoản trẻ cho tới khi `docs/SAFETY.md` có biện pháp tương ứng.
2. Trẻ (`ageBand: child`) **không là chủ tài khoản**, không tự đăng ký, không có thông tin đăng nhập, email, điện thoại hay vị trí. Hồ sơ trẻ do giáo viên của tổ chức đã xác minh tạo, chỉ có tên hiển thị. Người lớn không ghi danh làm học sinh trong lớp có trẻ.
3. Trẻ **không gõ chữ tự do** — chỉ câu/sticker duyệt sẵn. Không voice chat, không tin nhắn riêng, không phòng riêng với người lạ.
4. Vai quản trị (hiệu trưởng, giáo viên) chỉ dành cho tài khoản người lớn, được cấp bởi người có thẩm quyền trong **đúng phạm vi** trường/lớp.
5. Mọi hành động đặc quyền ghi nhật ký kiểm toán. Có đường báo cáo – ẩn – xử lý trước khi mở bất kỳ kênh chat nào.
6. Không phát hành công khai cho trẻ khi chưa xong rà soát an toàn, quyền riêng tư và pháp lý. Không tuyên bố "tuân thủ luật" khi chưa có đánh giá thật.
7. **Livestream và quay màn hình phát công khai chỉ trong không gian người lớn.** Không bao giờ phát hình, tên hay giọng của trẻ, hay bất kỳ phiên nào của tổ chức. Streamer mode ẩn danh tính người chơi khác (ADR-0015).

## §3 Server là nguồn sự thật
1. Client chỉ *đề nghị*; server kiểm quyền và quyết định trạng thái phiên, kết quả, phần thưởng.
2. Mọi lệnh kiểm quyền theo phạm vi (trường/lớp/phiên). Không có quyền toàn hệ thống nào suy ra từ vai trong một trường.
3. Lõi nghiệp vụ (`packages/domain`) thuần và tất định: không I/O, không đồng hồ/ngẫu nhiên ngầm — tiêm qua tham số.

## §4 Nội dung là dữ liệu
1. Engine bài học không biết bài nào; bài mới = gói `lesson.json` + `assets.json` + asset, qua validator.
2. Nội dung do AI soạn luôn bắt đầu ở `draft`/`review`; chỉ người duyệt mới chuyển `approved`/`published`.
3. Nội dung khoa học phải đúng; điểm chưa chắc ghi vào `review.notes`.

## §5 Bảo toàn tài sản
1. Không xoá/ghi đè prototype đang deploy (`index.html`, `assets/` ở gốc) hay gói bài khi chưa có kế hoạch migration được duyệt (`docs/MIGRATION.md`).
2. Không commit secret. Không commit binary lớn; asset tạm là SVG (text).

## §6 Đơn giản trước, bằng chứng rồi mới phức tạp
1. Modular monolith; không tách microservice khi chưa có số đo chứng minh.
2. Không dựng module tương lai trước khi vertical slice cần nó. Không tạo thư mục rỗng cho "đẹp sơ đồ".
3. Quyết định kỹ thuật có trade-off → ADR. Quyết định giá, quota thương mại, chính sách trẻ em, pháp lý → **chủ dự án**, agent chỉ đề xuất.

## §7 Kỷ luật agent
1. Không agent nào nạp toàn bộ ngữ cảnh: manager nắm tổng quan, lead nắm một module, thợ nắm đúng việc được giao (`knowledge/README.md`).
2. Không xong khi chưa xanh: chạy lệnh kiểm thật, báo đúng kết quả, không làm đẹp số liệu.
3. Không tự merge PR. Không tự monitor PR trừ khi anh Nam yêu cầu.
