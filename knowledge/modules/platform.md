# Module `platform` — monorepo · build · CI · server bootstrap · lưu trữ · deploy · quan sát (L1)

**Lead:** `lead-platform` · **ADR:** 0001, 0002, 0004, 0013, 0017 · **Luật:** CONSTITUTION §3.3, §5, §6

## Sứ mệnh
Để mọi module build/test/deploy được bằng một lệnh, không ai phải nhớ mẹo môi trường.

## Sở hữu
- Gốc: `package.json` (workspaces, script `check`), `package-lock.json`, `.gitignore`, `.env.example`
- `.github/workflows/ci.yml`
- `apps/classroom/playwright.config.ts`, `vite.config.ts` (phần môi trường — phối hợp learning)
- M2: `apps/server/` khung — `src/ports.ts`, `src/config.ts`, `src/persist/*`, `src/auth/*`, `src/firebase.ts`, `src/net/*`, `src/http/*`, `src/ids.ts`, `src/log.ts`, `src/lessons.ts`, `src/app.ts`, `src/index.ts`, `src/rooms/index.ts` (`registerRooms`; room cụ thể thuộc world/classroom). Không Postgres ở MVP (ADR-0017)
- `apps/campus/src/main.ts` phần cờ `TEST_HOOKS` + `tools/assert-no-test-hooks.mjs` (phối hợp world)
- Bản deploy ở gốc (`index.html`, `assets/`, `.nojekyll`) — giữ nguyên tới cutover (ADR-0002)

## Không thuộc
Luật nghiệp vụ (→ school/classroom) · nội dung bài (→ learning).

## Hợp đồng
- `npm run check` xanh = điều kiện merge. `npm run test:e2e` cho thay đổi UI/engine.
- Biến môi trường: chỉ khai trong `.env.example` (không giá trị thật). Secret ở nền tảng host.
- Lưu trữ: `Store` của domain ở trong bộ nhớ; server nạp lúc khởi động và ghi theo diff qua cổng `DocDb` (`src/ports.ts`; Firestore ở MVP). Chi tiết ở ADR-0018 (sắp có).
- Room nhận `RoomContext` (`src/ports.ts`) qua `registerRooms(server, ctx)`; mọi `onMessage` bọc `guarded(ctx.newGuard(), …)`.

## Bất biến
- Không commit secret, binary lớn. Không xoá file deploy ở gốc trước MIGRATION bước 6.
- Không thêm service/tiến trình mới khi chưa có số đo (ADR-0001).
- Chromium cloud: `/opt/pw-browsers/chromium` (đã cấu hình trong `playwright.config.ts`).

## Trạng thái
M0 ✓ workspaces + CI. M1 ✓ `apps/server` (Colyseus 0.18) và `apps/campus` nằm trong `npm run check`.
M2 (đang làm, chưa commit):
- WO-01 ✓ PASS: `apps/server` phụ thuộc `@lhdk/domain` + `firebase-admin` 14.5.0 (chỉ WO-01 sửa `apps/server/package.json`); `src/ports.ts` (DocDb, Persistence, AuthVerifier/AuthError, Identity, Logger, MessageGuardPort, RoomContext); `src/config.ts` `loadConfig(env)` — production bắt buộc ALLOWED_ORIGINS, STORE=firestore, AUTH_MODE=firebase; lỗi chỉ nêu tên biến. `.env.example` bỏ DATABASE_URL.
- WO-08 ✓ PASS: campus `TEST_HOOKS = DEV || MODE==='measure'`; `__campus`, `?harness`, `?server` chỉ trong TEST_HOOKS; `VITE_SERVER_URL`; check campus chạy `assert-no-test-hooks` (dist sạch); measure dùng `dist-measure/`.
- WO-02 ✓ PASS: `persist/snapshot.ts` `createPersistence(db, root)` — Map → collection (set/delete theo diff JSON), Array → chỉ `create` (audit); cache chỉ tiến sau mỗi lô thành công; hydrate nạp qua bộ đệm tạm. `persist/memory-docdb.ts` (failNext).
- WO-03 ✓ PASS: `persist/firestore-docdb.ts` (doc `{data: JSON, at}`, ≤ 500 op/lô), `auth/verifier.ts` (firebase `verifyIdToken(t, true)` · dev `dev:<nhãn>` · cấm dev ở production), `firebase.ts` (ADC, app `lhdk-server`). Test emulator skip khi không có `FIRESTORE_EMULATOR_HOST`.
- WO-04 ✓ PASS: `net/limits.ts` (4096 B · burst 20 · 15/s · 60 drop/10 s → kick 4029), `net/guard.ts` (`MessageGuard`, `guarded`), `net/transport.ts` (maxPayload + Origin 403). Test qua mạng thật.
- WO-05 ✓ PASS: `http/api.ts` (/v1 MVP-A, `kind` luôn `play`, không route trẻ/xác minh; `ApiDenied` = FORBIDDEN + reason NOT_REGISTERED/ADULT_ONLY/SIGNUP_CLOSED; QUOTA 422 ở /v1; `/v1/me/progress` chỉ StudentAck; GET trả mảng trần), `ids.ts` (mã 8 ký tự, bảng 31, không lệch modulo), `log.ts` (allowlist key + giá trị).
- WO-10 ✓ PASS: `lessons.ts` `loadLessons` — 6 gói thật nạp ở dev/test; production chỉ approved/published → hiện 0 bài.
- Kiểm 2026-11-07 (lead chạy lại): `npm run check` exit 0 — domain 108, classroom 22, server 110 (+2 skip emulator), campus 20. e2e campus 9/9 (thợ báo ở WO-08).
- Bất biến lưu trữ (đưa vào ADR-0018): domain không gán lại field của Store; mảng trong Store chỉ thêm, phần tử bất biến; giá trị JSON-serializable; một instance. Lệnh ghi đã đổi bộ nhớ rồi mà flush lỗi thì trả 503, lần flush sau ghi bù.

- WO-06 ✓ PASS: `app.ts` (`createApp` → `AppContext`, có `signupAllowed`, `devUserId`, `linkDevIdentity`; dev token tự tạo người lớn, chống tạo trùng khi gọi đồng thời), `rooms/index.ts` (`registerRooms` → `{campus}`), `http/seat.ts` (POST /campus/seat, QUOTA → 429 riêng route này), `http/node-adapter.ts` (CORS allowlist, 413, 400). `index.ts` `startServer(port, o?)` → `{server, http, ctx}`, seed dev khi auth dev và không production. `restrictCors` ghi đè `matchMaker.controller.getCorsHeaders` (điểm mở rộng của Colyseus; áp cho cả tiến trình, kể cả /matchmake) và bỏ `Allow-Credentials`.
- Kiểm 2026-11-07 (lead chạy lại sau WO-06): server 174 pass + 2 skip. Campus typecheck đang đỏ do WO-world-03 sửa dở (`main.ts` truyền `name`, `client.ts` thừa `ROOM`); e2e campus 8/9 đỏ là dự kiến tới khi xong WO-world-03/04.

## Việc kế tiếp
- WO-world-03/04 → e2e campus phải xanh lại. Nếu matchmake trên trình duyệt lỗi CORS thì xét trả lại `Allow-Credentials` chỉ cho Origin trong allowlist (`restrictCors`).
- Trần instance campus (QUOTA) chưa nối vì chưa truyền `maxInstances`, chờ Q-18.
- Sau đó WO-09 soát → lead-safety (01–06, 08, 10). WO-07 đã bỏ.
- Chờ: ADR-0018 (manager viết, WO-02 đã PASS) → sửa mục Hợp đồng. Q-19 project Firebase · Q-20 xác nhận người lớn · Q-21 thời hạn lưu chat.
- M3: chọn host free có WebSocket (`max-instances=1`, kiểm hạn mức thật); đóng gói `apps/classroom/content/lessons` cùng server; UI đăng nhập Firebase; workflow Pages (cutover).

## Kiểm
`npm ci && npm run check` · `npm run test:e2e`
