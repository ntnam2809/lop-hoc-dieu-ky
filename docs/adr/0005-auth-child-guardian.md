# ADR-0005 — Xác thực: người lớn có tài khoản, trẻ là hồ sơ được quản lý

**Trạng thái:** Accepted cho MVP; mô hình đồng ý phụ huynh chờ Q-02 · 2026-11-06 · module `school` + `safety`

## Quyết định
- **Người lớn** (hiệu trưởng, giáo viên, người thử) đăng nhập qua nhà cung cấp OAuth/magic link có sẵn (ứng viên: Firebase Auth vì repo đã dùng Firebase; chọn ở M2). Server chỉ giữ `userId` + tên hiển thị + nhóm tuổi + gói.
- **Trẻ** không có thông tin đăng nhập, không email. Giáo viên tạo hồ sơ (`createManagedStudent`) thuộc trường. Trẻ vào trên thiết bị có người lớn giám sát: mã lớp → chọn hình đại diện của mình (picture login), phiên thiết bị có hạn.
- **Dev/test:** `registerUser` là stub; không mở đăng ký công khai trước khi xong M4.
- Không tự đăng ký cho trẻ ở bất kỳ đâu (CONSTITUTION §2.2).

## Chưa quyết (Q-02)
Tài khoản phụ huynh, cách lấy đồng ý, xoá/xuất dữ liệu theo yêu cầu, thị trường phát hành.
