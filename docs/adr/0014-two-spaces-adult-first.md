# ADR-0014 — Hai không gian: trường chơi của người lớn ↔ tổ chức có thật cho trẻ

**Trạng thái:** Accepted · 2026-11-06 · theo phương châm của anh Nam · module `school` + `safety` + `world` · hiện thực: `packages/domain` (`SchoolKind`, `verifyOrganization`)

## Bối cảnh
Phương châm của chủ dự án (2026-11-06):
1. MVP để **kéo phụ huynh trước** bằng gameplay RPG: người lớn giải trí và hiểu cơ chế trước khi cho con tham gia.
2. Trẻ tham gia **thông qua một tổ chức có thật bên ngoài**, do **giáo viên thật** quản lý.
3. Trẻ mẫu giáo **không là chủ tài khoản**.

## Quyết định
- `School.kind`:
  - `play` (mặc định): trường chơi chỉ có người lớn. Người lớn nhập vai đủ vòng đời của prompt gốc (lập trường → hiệu trưởng → cấp giáo viên → mở lớp → học sinh → phiên học). **Không có hồ sơ trẻ.** Chat chữ của người lớn mặc định mở, có moderation.
  - `organization`: trường/tổ chức có thật. Sinh ra ở trạng thái **chưa xác minh**; quản trị nền tảng xác minh (`verifyOrganization`) rồi mới tạo được hồ sơ trẻ. Người lớn ở đây chỉ mang vai hiệu trưởng/giáo viên. **Người lớn không ghi danh làm học sinh lớp có trẻ.**
- Trẻ chỉ tồn tại dưới dạng hồ sơ do giáo viên của tổ chức đã xác minh tạo (`createManagedStudent`). Trẻ không có thông tin đăng nhập, không bao giờ là chủ tài khoản.
- `platformAdmin` chỉ gán bằng seed/CLI nội bộ.
- Hai không gian **không có đường đi qua lại**: không chung campus instance, không chung phiên, không chung chat.

## Phương án đã cân nhắc
Một không gian chung có lọc theo tuổi (lọc sai một lần là đủ gây hại) · cho phụ huynh vào lớp có con để đồng hành (trộn người lớn lạ với trẻ; để Phase sau, chỉ khi có liên kết phụ huynh–con được tổ chức xác nhận — Q-15).

## Hệ quả
- MVP chia hai đường: **MVP-A** (người lớn, RPG) đi trước, **MVP-B** (tổ chức + trẻ) đi sau và chờ Q-02/Q-13.
- Thay thế phần "đối tượng pilot" của A-01: pilot đầu tiên là người lớn.
- ADR-0005 (trẻ là hồ sơ được quản lý), 0007 (mặc định an toàn), 0008 (topology) vẫn đúng, áp riêng cho không gian `organization`. Không gian `play` có thêm luật ở ADR-0015 và `docs/SAFETY.md` T14–T17.

## Xem lại khi
Có liên kết phụ huynh–con (Q-15) · quy trình xác minh tổ chức được chốt (Q-13).
