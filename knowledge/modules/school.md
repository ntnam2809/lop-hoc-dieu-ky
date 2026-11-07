# Module `school` — danh tính · trường · vai · lớp · ghi danh · gói (L1)

**Lead:** `lead-school` · **ADR:** 0005, 0006, 0009, 0014 · **Luật:** CONSTITUTION §2.2, §2.4, §3

## Sứ mệnh
Ai là ai, ở trường nào, với vai gì, được làm tới đâu. Mọi kiểm quyền theo phạm vi đều đi qua đây.

## Sở hữu
- `packages/domain/src/types.ts` — `User`, `School`, `Membership`, `SchoolClass`, `Enrollment`, `PlanId`
- `packages/domain/src/plans.ts` — `PLANS` (placeholder)
- `packages/domain/src/service.ts` — mục *danh tính*, *trường & vai*, *lớp & ghi danh*, helper quyền (`rolesIn`, `hasRole`, `canManageClass`, `teachingLimits`)
- `packages/domain/test/policy.test.ts` (phần vai/gói/sức chứa), `journey.test.ts` (bước 1–4)

## Không thuộc
Phiên học, chat (→ classroom) · chính sách an toàn (→ safety quyết, school hiện thực luật vai) · adapter DB/HTTP (→ platform).

## Hợp đồng (module khác chỉ dùng những thứ này)
- `SchoolService.registerUser · createSchool({kind}) · verifyOrganization · grantTeacher · revokeTeacher · createClass · createManagedStudent · enrollWithCode`
- `isVerifiedOrganization(school)` · `School.kind ∈ play | organization`
- Truy vấn: `user · school · klass · rolesIn · hasRole · isEnrolled · canManageClass`
- Lỗi: `DomainError.code ∈ FORBIDDEN|NOT_FOUND|QUOTA|INVALID|CONFLICT`

## Bất biến
- Vai luôn gắn `schoolId`; không vai toàn hệ thống. Thu hồi vai có hiệu lực ngay (đóng phiên live).
- Vai quản trị chỉ cho `adult`. Trẻ không là chủ tài khoản — chỉ `createManagedStudent`, và chỉ ở tổ chức **đã xác minh**.
- Hai không gian (ADR-0014): trường `play` không có hồ sơ trẻ; lớp `organization` không nhận người lớn làm học sinh. Chỉ `platformAdmin` (seed nội bộ) xác minh tổ chức.
- Free không lập trường (prompt R6). Số trong `PLANS` không phải quyết định thương mại.
- Lớp chỉ tồn tại trong trường (A-06). Vào lớp bằng mã, không danh bạ (ADR-0007).

## Trạng thái
M0 ✓: đủ luật cho hành trình A (trường chơi) và B (tổ chức); store bộ nhớ.

## Việc kế tiếp
- M2: mã vào lớp ngẫu nhiên an toàn (server cấp `ids('code')`), đổi mã · tách `service.ts` thành `school-service.ts` khi > 500 dòng.
- Phase 2: phó hiệu trưởng, trợ giảng, chuyển chủ trường (Q-05), lời mời giáo viên thay cấp trực tiếp.

## Câu hỏi mở
Q-03 quota/gói · Q-05 chuyển chủ · Q-06/Q-07 lớp ngoài trường · Q-13 quy trình xác minh · Q-15 liên kết phụ huynh–con.

## Kiểm
`npm run check -w @lhdk/domain`
