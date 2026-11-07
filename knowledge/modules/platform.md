# Module `platform` — monorepo · build · CI · server bootstrap · lưu trữ · deploy · quan sát (L1)

**Lead:** `lead-platform` · **ADR:** 0001, 0002, 0004, 0013, 0017 · **Luật:** CONSTITUTION §3.3, §5, §6

## Sứ mệnh
Để mọi module build/test/deploy được bằng một lệnh, không ai phải nhớ mẹo môi trường.

## Sở hữu
- Gốc: `package.json` (workspaces, script `check`), `package-lock.json`, `.gitignore`, `.env.example`
- `.github/workflows/ci.yml`
- `apps/classroom/playwright.config.ts`, `vite.config.ts` (phần môi trường — phối hợp learning)
- M2: `apps/server/` khung (HTTP + WS, cấu hình, adapter `Store` Postgres, migration SQL)
- Bản deploy ở gốc (`index.html`, `assets/`, `.nojekyll`) — giữ nguyên tới cutover (ADR-0002)

## Không thuộc
Luật nghiệp vụ (→ school/classroom) · nội dung bài (→ learning).

## Hợp đồng
- `npm run check` xanh = điều kiện merge. `npm run test:e2e` cho thay đổi UI/engine.
- Biến môi trường: chỉ khai trong `.env.example` (không giá trị thật). Secret ở nền tảng host.
- Adapter lưu trữ hiện thực giao diện `Store` của `packages/domain`.

## Bất biến
- Không commit secret, binary lớn. Không xoá file deploy ở gốc trước MIGRATION bước 6.
- Không thêm service/tiến trình mới khi chưa có số đo (ADR-0001).
- Chromium cloud: `/opt/pw-browsers/chromium` (đã cấu hình trong `playwright.config.ts`).

## Trạng thái
M0 ✓: workspaces (`@lhdk/domain`, `@lhdk/classroom`), CI chạy `npm run check`. Chưa có server/DB.

## Việc kế tiếp
- M1: workspace `apps/campus`; CI thêm build campus.
- M2 (ADR-0017): adapter `Store` Firestore (firebase-admin) + Firebase Auth người lớn; chọn host Node free có WebSocket (Render/Koyeb/Cloud Run — kiểm điều khoản thật); xử lý server ngủ/khởi động lạnh.
- M3: staging trên host free; workflow Pages build `apps/classroom` (cutover).

## Kiểm
`npm ci && npm run check` · `npm run test:e2e`
