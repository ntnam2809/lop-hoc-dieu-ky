# ADR-0007 — Mặc định an toàn của MVP

**Trạng thái:** Accepted · 2026-11-06 · module `safety` · chi tiết: `docs/SAFETY.md`

> Phạm vi 2026-11-06 (ADR-0014): các mặc định này áp cho không gian `organization` (có trẻ). Không gian `play` chỉ có người lớn, chat chữ mặc định mở, có moderation — xem ADR-0015 và `docs/SAFETY.md` T14–T17.

## Quyết định
1. Không danh bạ trường/lớp công khai — vào lớp bằng mã giáo viên chia sẻ (mã do server sinh ngẫu nhiên an toàn).
2. Không hub công cộng, không thăm trường khác.
3. Chat chỉ trong phiên học; chế độ `off | phrases | open` do giáo viên đặt (mặc định `phrases`). Trẻ luôn chỉ câu/sticker duyệt sẵn. Người lớn gõ chữ ≤ 200 ký tự, có rate limit.
4. Không tin nhắn riêng, không voice, không ảnh/file do người dùng tải lên.
5. Ẩn tin (giáo viên), báo cáo (mọi người trong phiên) → hàng chờ của hiệu trưởng; kiểm toán mọi hành động đặc quyền.
6. Ở campus: trẻ chỉ có emote, không chat chữ.

## Hệ quả
Trải nghiệm xã hội của trẻ hẹp — có chủ đích. Mở rộng mỗi kênh phải cập nhật SAFETY.md + ADR mới.
