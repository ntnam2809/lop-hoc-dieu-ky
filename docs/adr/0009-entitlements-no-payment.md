# ADR-0009 — Quyền lợi theo gói, không có thanh toán trong MVP

**Trạng thái:** Accepted · 2026-11-06 · module `school`

## Quyết định
- Gói là bảng quyền lợi (`packages/domain/src/plans.ts`): `free` (không lập trường, lớp nhỏ) và `pilot` (cấp tay cho người thử, lập 1 trường). Con số là **placeholder kỹ thuật**.
- Sức chứa lớp = mức cao hơn giữa gói giáo viên và gói chủ trường (giả định A-07).
- Không cổng thanh toán, không giá, không marketplace trong MVP.
- Nguyên tắc cố định: thu phí công cụ quản trị/sáng tạo, không thu phí kiến thức (CONSTITUTION §1.2).

## Chờ quyết (Q-03)
Bậc gói, con số, School Pro có gồm Teacher Pro, hoàn phí, chuyển chủ.
