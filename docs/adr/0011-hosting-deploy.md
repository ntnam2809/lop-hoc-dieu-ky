# ADR-0011 — Hosting & deploy

**Trạng thái:** Proposed — phần server chờ Q-04 · 2026-11-06 · module `platform`

## Đề xuất
- **Client tĩnh:** GitHub Pages (đang dùng) cho prototype và về sau cho `apps/campus` + `apps/classroom` (build qua GitHub Actions).
- **Server:** một container nhỏ (Node + Colyseus) + Postgres managed. Ứng viên: Fly.io, Railway, Render, hoặc VPS — chọn theo ngân sách và tài khoản của anh Nam.
- **Môi trường:** `local` (bộ nhớ) → `staging` (chỉ người lớn thử) → `production` (sau M4).
- **CI:** GitHub Actions chạy `npm run check` mỗi PR (đã có, không cần secret).

## Chờ quyết (Q-04)
Nhà cung cấp, ngân sách tháng, vùng đặt server (độ trễ tới Việt Nam), ai giữ tài khoản.
