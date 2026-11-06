# ADR-0006 — Danh tính ≠ thành viên trường ≠ ghi danh lớp ≠ quyền lợi gói

**Trạng thái:** Accepted · 2026-11-06 · module `school` · hiện thực: `packages/domain/src/types.ts`, `service.ts`

## Quyết định
- `User` (danh tính, nhóm tuổi, gói) · `Membership {schoolId, userId, roles[]}` · `Enrollment {classId, userId}` · `PlanLimits` (quyền lợi).
- Vai **luôn có phạm vi trường**: `principal | teacher | student`. Một người có thể là hiệu trưởng trường A và học sinh trường B.
- Người lập trường = chủ + `principal`. Hiệu trưởng cấp/thu hồi `teacher`. `student` sinh từ ghi danh.
- Quản lý lớp = giáo viên phụ trách *còn vai teacher* hoặc hiệu trưởng của chính trường đó. Thu hồi vai đóng ngay phiên đang mở.
- Không có vai toàn hệ thống trong MVP (admin nền tảng thao tác ngoài app).
- MVP không có `vice_principal`, `assistant`, `guest`, chuyển nhượng chủ trường (Q-05).

## Hệ quả
Rò quyền chéo trường bị test chặn (`policy.test.ts`). Thêm vai mới = thêm vào union + luật trong `service.ts` + test.
