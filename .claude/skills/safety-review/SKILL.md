---
name: safety-review
description: Duyệt an toàn trẻ em cho một thay đổi của Lớp Học Diệu Kỳ — đối chiếu diff với CONSTITUTION §2, docs/SAFETY.md (T1–T13, dữ liệu tối thiểu, cổng kiểm 6 câu) và ADR-0007, trả SAFE / SAFE_WITH_CHANGES / UNSAFE. Dùng bởi lead-safety (hoặc guard-reviewer khi được giao) mỗi khi thay đổi đụng chat, tương tác giữa người dùng, hiển thị thông tin người dùng, dữ liệu về trẻ, auth/vai, log/analytics, hoặc tính năng mới cho tài khoản trẻ.
effort: medium
---

# Skill: safety-review

## Đầu vào
Diff hoặc danh sách file + mô tả tính năng (từ manager).

## Soát
1. **Cổng kiểm 6 câu** (`docs/SAFETY.md` §6): ai thấy · ai liên lạc được với ai · trẻ có gõ chữ không · báo cáo/chặn thế nào · dữ liệu lưu bao lâu · ai xử lý. Thiếu câu nào → tính năng phải tắt cho `ageBand: child`.
2. **CONSTITUTION §2.1–2.6** từng điều.
3. **Bảng đe doạ T1–T13**: thay đổi có làm yếu biện pháp nào? Có mở đe doạ mới không → đề xuất thêm hàng T-mới.
4. **Dữ liệu** (§4 SAFETY): trường dữ liệu mới về trẻ? Lộ qua API/log/presence?
5. **Test**: có test chứng minh luật (vd trẻ không gửi `text`, người ngoài bị `FORBIDDEN`)? Thiếu → SAFE_WITH_CHANGES.

## Trả về
```
SAFETY-REVIEW <phạm vi> · SAFE | SAFE_WITH_CHANGES | UNSAFE
Phát hiện: - [T-id / §] file:dòng — vấn đề — sửa đề nghị
Cập nhật SAFETY.md cần có: - …
```
Không đưa kết luận pháp lý. Điểm cần luật sư/chuyên môn → ghi "chuyển Q-02".
