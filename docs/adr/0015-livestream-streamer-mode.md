# ADR-0015 — Livestream quảng bá (TikTok) bởi người lớn, streamer mode

**Trạng thái:** Accepted hướng đi; tích hợp API TikTok là LATER · 2026-11-06 · module `world` + `classroom` + `safety`

## Bối cảnh
Anh Nam muốn người lớn livestream TikTok để quảng bá sản phẩm. Prompt gốc cũng có "khung chat kiểu livestream".

## Quyết định
1. **Chỉ livestream trong không gian `play`.** Không livestream, không quay màn hình phát công khai trong trường `organization` hay bất kỳ phiên nào có hồ sơ trẻ. Điều này là luật bất biến (CONSTITUTION §2.7). Khi bật streamer mode, client **không vào được** trường tổ chức.
2. **Streamer mode** (client, M3): ẩn tên hiển thị của người chơi khác (thay bằng nhãn trung tính), ẩn mã vào lớp và mã mời, ẩn chat của người khác hoặc chỉ hiện tin đã qua bộ lọc, hiện watermark "đang phát trực tiếp" cho mọi người trong room. Ai trong room cũng thấy có người đang phát, và có thể rời đi hoặc chọn ẩn avatar của mình khỏi camera người phát (M3).
3. **Panel chat kiểu livestream** trong game giữ như ADR-0007/DESIGN §6. Đưa bình luận TikTok LIVE vào game qua API là LATER: cần tài khoản nhà phát triển và điều khoản của TikTok, và phải lọc nội dung trước khi hiện.
4. Người phát tự chịu trách nhiệm tuân thủ quy định của TikTok, kể cả độ tuổi tối thiểu để phát LIVE. Sản phẩm không xác nhận thay điều khoản của nền tảng.

## Hệ quả
Có nội dung quảng bá mà không phơi trẻ hay người dùng khác. Thêm việc ở M3: cờ `streaming` trên presence, giao diện streamer mode, chặn trường tổ chức.

## Chờ quyết
Q-14: tài khoản TikTok chính thức, ai phát, kịch bản phát, có cần tích hợp bình luận hay không.
