# ADR-0008 — Mỗi trường một campus instance, phòng học là room riêng

**Trạng thái:** Accepted · 2026-11-06 · module `world` + `classroom`

> Bổ sung 2026-11-06 (ADR-0014): campus `play` và campus `organization` là hai loại instance tách hẳn nhau. Không gian `play` có thể có campus trải nghiệm chính thức nhiều instance cho người lớn; trẻ không bao giờ vào đó.

> Sửa 2026-11-07 (M2): bản đầu viết "`joinOrCreate` tự mở room phụ". Cách đó không lọc theo trường nên room phụ có thể trộn người của trường khác và trộn hai không gian (trái ADR-0014). Thay bằng gán instance phía server như bên dưới.

## Quyết định
- Campus của một trường = **một hoặc nhiều instance** room `campus`, mỗi instance tối đa **20 người kể cả giáo viên** (ADR-0017). Chỗ đang giữ chờ reconnect và chỗ đã cấp ticket nhưng chưa vào vẫn tính vào trần.
- Server gán instance theo luật domain (`assignCampusInstance`): chỉ xét instance cùng trường và cùng loại (`play`/`organization`); người đã ở trong thì vào lại đúng chỗ; còn chỗ thì ưu tiên instance có bạn cùng lớp; hết chỗ thì tạo instance mới. Client **không** tự `joinOrCreate`: xin ghế qua HTTP (`POST /campus/seat`), nhận `roomId` + ticket dùng một lần (hết hạn 15 s), rồi `joinById`. Room từ chối join không có ticket.
- Ai được vào: `schoolId` client gửi chỉ là đề nghị; domain (`checkCampusEntry`) quyết. `play`: chỉ người lớn là thành viên. `organization`: chỉ thành viên đúng trường (trẻ chỉ khi tổ chức đã xác minh); người đang livestream không vào. Campus `organization` **đóng ở M2** (`CAMPUS_ORG_ENABLED=false`) cho tới khi Q-02/Q-13 xong.
- Một người một kết nối: kết nối mới nhất thắng, chỗ cũ bị đóng (mã 4409).
- Vào cửa phòng học = rời room campus, vào room phiên học (chỉ người ghi danh lớp + giáo viên; cũng tối đa 20 kể cả giáo viên). Room phiên học thuộc mốc sau.
- MVP: một template campus (cổng · sân · 2 phòng học). Không hub công cộng giữa các trường, không đi từ campus trường này sang trường khác.

## Phương án đã cân nhắc
Hub công cộng + campus + room (đề xuất ban đầu — LATER, chỉ khi có moderation) · một room cho cả trường kể cả học (lẫn tải và quyền) · chỉ lobby + phiên học không có campus (mất fantasy R1/R11).
