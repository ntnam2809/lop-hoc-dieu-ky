# Mô hình an toàn & đe doạ (threat/safety model) v1

**Trạng thái:** nền tảng cho MVP · 2026-11-06 · Lead: `lead-safety` · Luật gốc: `CONSTITUTION.md` §2
> Đây là đánh giá kỹ thuật, **không phải** ý kiến pháp lý. Trước mọi pilot có trẻ thật phải có rà soát pháp lý/quyền riêng tư theo thị trường phát hành (Q-02).

## 1. Tài sản cần bảo vệ
Trẻ (thân thể, tinh thần) · danh tính và dữ liệu học tập của trẻ · quyền quản trị trường/lớp · uy tín giáo viên/trường · nội dung bài học.

## 2. Tác nhân đe doạ

| Tác nhân | Mục tiêu | Ví dụ |
|---|---|---|
| Người lạ có ý xấu | Tiếp cận trẻ | Dò danh bạ trường, vào lớp bằng mã lộ, nhắn riêng |
| Người lớn giả giáo viên | Có quyền với trẻ | Lập trường giả, xin cấp vai |
| Học sinh bắt nạt | Làm tổn thương bạn | Spam, nội dung xúc phạm, cô lập |
| Người dùng gian lận | Phá phiên / lấy dữ liệu | Gửi lệnh giáo viên, nộp hộ, gọi API trực tiếp |
| Giáo viên của trường khác | Vượt phạm vi | Xem tiến độ lớp không thuộc mình |
| Sự cố nội bộ | Lộ dữ liệu | Log chứa tên trẻ, nội dung chat |

## 3. Đe doạ → biện pháp

| # | Đe doạ | Biện pháp MVP | Trạng thái |
|---|---|---|---|
| T1 | Người lạ tìm thấy lớp có trẻ | Không danh bạ công khai; vào bằng mã do server sinh ngẫu nhiên (≥ 8 ký tự, không đoán được); giáo viên đổi mã được (M2) | domain ✓ · mã ngẫu nhiên M2 |
| T2 | Người lạ nói chuyện riêng với trẻ | Không DM, không phòng riêng, không voice; chat chỉ trong phiên có giáo viên; campus không có chat chữ cho trẻ | ✓ (ADR-0007) |
| T3 | Trẻ lộ thông tin cá nhân qua chat | Trẻ chỉ câu/sticker duyệt sẵn — không có đường gõ địa chỉ/SĐT | ✓ `checkChat` |
| T4 | Người lớn chat nội dung xấu trong phiên | Mặc định `phrases`; `open` do giáo viên bật; ≤ 200 ký tự; rate limit; ẩn tin; báo cáo | ✓ · bộ lọc từ ngữ LATER |
| T5 | Giả giáo viên | Vai giáo viên chỉ do hiệu trưởng cấp; lập trường cần gói `pilot` cấp tay | ✓ · xác minh người lớn thật: Q-02 |
| T6 | Leo thang quyền / chéo trường | Mọi lệnh kiểm phạm vi ở server; không vai toàn hệ thống; thu hồi có hiệu lực ngay | ✓ `policy.test.ts` |
| T7 | Client gian lận kết quả | Server chấm; chỉ nhận nộp cho hoạt động đang mở; đếm lần thử | ✓ |
| T8 | Spam/DoS chat, sự kiện | Token bucket/người; trần người mỗi room; giới hạn kích thước tin | chat ✓ · WS M2 |
| T9 | Bắt nạt | Báo cáo → hàng chờ hiệu trưởng; ẩn tin; (M3) giáo viên tạm tắt chat một học sinh | báo cáo ✓ · tắt từng người M3 |
| T10 | Lộ dữ liệu qua log | Log chỉ id nội bộ, không tên trẻ/nội dung chat (ADR-0013) | M2 |
| T11 | Dữ liệu trẻ tồn tại mãi | Chính sách lưu/xoá/xuất theo Q-02; hồ sơ trẻ thuộc trường, xoá theo trường | Q-02 |
| T12 | Thiết bị dùng chung ở lớp | Phiên thiết bị trẻ có hạn, đăng xuất khi rời lớp; không lưu thông tin đăng nhập trẻ | M3 |
| T13 | Nội dung bài sai/không phù hợp | Validator + duyệt chuyên môn; AI không tự xuất bản | ✓ (pipeline sẵn có) |

## 4. Dữ liệu cá nhân — tối thiểu hoá

| Dữ liệu | Người lớn | Trẻ |
|---|---|---|
| Tên hiển thị | Có | Có (do cô đặt; khuyến nghị tên gọi ở lớp, không họ tên đầy đủ) |
| Email / SĐT | Nhà cung cấp auth giữ; server chỉ giữ id | **Không** |
| Ngày sinh | Không | Không (chỉ `ageBand`) |
| Vị trí, ảnh, giọng | Không | Không |
| Kết quả học | — | Theo phiên × hoạt động; chỉ cô, hiệu trưởng, chính trẻ (và phụ huynh — LATER) xem |
| Chat | Lưu trong phiên để moderation | Chỉ id câu/sticker |

## 5. Quy trình moderation (MVP)
1. Ai trong phiên cũng báo cáo được một tin → `ModerationReport(open)` + kiểm toán.
2. Giáo viên ẩn tin ngay trong phiên; hiệu trưởng xem hàng chờ của trường.
3. Xử lý xong → `resolved` (M2). Báo cáo nghiêm trọng (an toàn trẻ) → quy trình leo thang ngoài app do chủ dự án định nghĩa (Q-02).

## 6. Cổng kiểm trước khi mở tính năng xã hội mới
Mỗi tính năng có tương tác giữa người dùng phải trả lời: ai thấy · ai liên lạc được với ai · trẻ có gõ chữ không · báo cáo/chặn thế nào · dữ liệu lưu bao lâu · ai xử lý. Thiếu một câu → tính năng tắt cho tài khoản trẻ (CONSTITUTION §2.1). Lead `safety` duyệt bằng skill `safety-review`.
