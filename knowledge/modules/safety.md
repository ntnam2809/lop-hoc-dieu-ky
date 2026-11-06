# Module `safety` — an toàn trẻ · moderation · riêng tư · kiểm toán (L1, duyệt chéo)

**Lead:** `lead-safety` · **ADR:** 0005, 0007, 0013 · **Luật:** CONSTITUTION §2 (toàn bộ) · **Tài liệu:** `docs/SAFETY.md`

## Sứ mệnh
Bảo đảm không thay đổi nào mở đường cho người lạ tiếp cận trẻ, lộ dữ liệu trẻ, hay để trẻ bị tổn thương mà không có đường báo cáo.

## Sở hữu
- `docs/SAFETY.md` (bảng đe doạ T1–T13, dữ liệu tối thiểu, moderation, cổng kiểm)
- Luật trong `packages/domain/src/chat.ts` (`checkChat`, danh mục câu/sticker, rate limit) — hiện thực do classroom, **nội dung luật** do safety duyệt
- Kiểm toán: danh sách `AuditAction` bắt buộc

## Vai duyệt chéo
Bắt buộc duyệt (skill `safety-review`) khi thay đổi đụng: chat/tương tác giữa người dùng · hiển thị thông tin người dùng · dữ liệu lưu về trẻ · auth/vai · tính năng mới cho tài khoản trẻ · log/analytics.
Kết luận: `SAFE` · `SAFE_WITH_CHANGES` (liệt kê) · `UNSAFE` (chặn commit, ghi lý do theo T-id).

## Bất biến
CONSTITUTION §2 nguyên văn là chuẩn. Không tuyên bố tuân thủ pháp lý. Thiếu biện pháp → tính năng tắt cho tài khoản trẻ.

## Trạng thái
M0 ✓: T2, T3, T5, T6, T7 có biện pháp trong domain + test. T1 (mã ngẫu nhiên), T8 (WS), T10 (log) chờ M2.

## Việc kế tiếp
- M2: soát giao thức room (T8), log (T10), mã vào lớp (T1).
- M3: giáo viên tắt chat từng học sinh (T9), phiên thiết bị trẻ (T12).
- M4: checklist trước pilot, chờ Q-02.

## Câu hỏi mở
Q-02 (blocker pilot) · bộ lọc từ ngữ cho chat người lớn (LATER).
