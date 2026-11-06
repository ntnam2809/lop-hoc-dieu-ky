# ADR-0002 — Giữ bản deploy prototype ở gốc, source về `apps/classroom`

**Trạng thái:** Accepted · 2026-11-06 · module `platform` + `learning`

## Bối cảnh
GitHub Pages phục vụ `index.html` + `assets/` ở gốc `main`. Source nằm ở repo studio, và bản deploy mới hơn source (4 bài + sửa hiệu ứng chỉ có dạng build).

## Quyết định
- Không đụng `index.html`, `assets/`, `.nojekyll` ở gốc cho tới khi cutover (MIGRATION M3).
- Source chép nguyên vào `apps/classroom/` (đổi tên package `@lhdk/classroom`, bỏ lockfile riêng).
- 4 bài khôi phục từ bundle để ở `apps/classroom/content/recovered/`, không nạp vào build cho tới khi engine được port.
- Cutover: workflow GitHub Actions build `apps/classroom` và deploy Pages, chỉ khi bản build mới chơi được đủ 6 bài (E2E) — rồi mới gỡ file build ở gốc.

## Hệ quả
Người dùng hiện tại không bị gián đoạn. Trong thời gian chuyển tiếp, gốc repo có cả file build lẫn mã nguồn — README ghi rõ.
