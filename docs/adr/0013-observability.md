# ADR-0013 — Quan sát hệ thống không thu dữ liệu cá nhân của trẻ

**Trạng thái:** Proposed (áp dụng từ M2) · 2026-11-06 · module `platform` + `safety`

## Đề xuất
- Log có cấu trúc (JSON), chỉ chứa id nội bộ, không tên hiển thị trẻ, không nội dung chat.
- Số đo: người đồng thời/room, tỉ lệ reconnect, độ trễ tick, lượt nộp bài lỗi, tỉ lệ hoàn thành phiên, độ dài hàng chờ báo cáo, chi phí DB.
- Lưu giữ log ngắn hạn (đề xuất 14 ngày — chờ chính sách dữ liệu Q-02).
