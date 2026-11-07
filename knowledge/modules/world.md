# Module `world` — campus 2D · avatar · di chuyển · instance · presence (L1)

**Lead:** `lead-world` · **ADR:** 0003, 0004, 0008, 0014, 0015 · **Luật:** CONSTITUTION §2.3, §3, §6

## Sứ mệnh
Cho người chơi cảm giác ở trong một ngôi trường: đi lại, thấy bạn, emote, chạm đồ vật, bước vào phòng học.

## Sở hữu (dự kiến — chưa có code)
- `apps/campus/` (M1): Phaser 3 + TypeScript, scene `Gate`, `Yard`, `ClassroomDoor`; tilemap Tiled JSON (text) + sprite SVG/PNG tạm
- M2: `apps/server/src/rooms/campus-room.ts` — vị trí authoritative, trần ~40, instance phụ

## Không thuộc
Phiên học bên trong phòng (→ classroom) · bài học (→ learning) · ai được vào trường (→ school) · chat (campus **không** có chat chữ cho trẻ).

## Hợp đồng (dự kiến M1)
- Client → server: `move {x, y, seq}` (≤ 10 Hz) · `emote {id}` · `interact {objectId}` · `enterDoor {classId}`
- Server → client: `presence {players: [{id, displayName, x, y, emote}]}` · `door.state {classId, live}` · `redirect {sessionId}`
- Server kiểm: biên bản đồ, tốc độ tối đa, emote trong danh mục, cửa chỉ mở khi `isEnrolled` và lớp có phiên live.

## Bất biến
- Chỉ thành viên trường vào campus trường đó. Campus trường chơi (`play`) và tổ chức (`organization`) là hai loại instance tách hẳn; trẻ không bao giờ vào campus trường chơi (ADR-0014). Có campus trải nghiệm chính thức nhiều instance cho người lớn.
- Streamer mode (ADR-0015): cờ `streaming` trên presence, ẩn tên người khác + mã lớp, dấu đang phát cho cả room, chặn vào trường tổ chức.
- Avatar chỉ hiện tên hiển thị. Không tọa độ/thông tin thật nào của người dùng.
- Asset campus là tạm (vector/tile đơn giản) — không tự chốt visual cuối (HO-0012 ngoài phạm vi).

## Trạng thái
Spike S1 (2026-11-06) đã dựng và đo xong; chờ WO-06 (soát) rồi manager chốt ADR. Có: `apps/server` (room `campus` Colyseus 0.18, `movement.ts` thuần với xô ngân sách cap 55 px, trần 20, `/health`, bot) · `apps/campus` (Phaser 4.2.1, tạm vector, chạm/phím, dự đoán + nội suy, reconnect, cold start 'waking') · e2e 9 ca xanh 5/5 · doc `docs/spikes/S1-campus-realtime.md`. Pin: phaser 4.2.1, colyseus 0.18.10, @colyseus/sdk 0.18.6, schema 5.0.42.
Số đo (SwiftShader, không GPU, chỉ proxy): bundle gzip 400,5 KiB (đạt <=1,5 MB) · fps 40,5 / 29,3 / 25,4 cho 1/20/30 avatar (mốc 50 fps không đánh giá được) · heap 60 vòng dốc ~8 KB/vòng, nửa sau 1,7-4,0: không thấy rò · A->B median 155 ms (gồm 100 ms đệm) · server RSS ~92 MB với 19 bot, cold start <1 s.
Phát hiện cho M2: SDK `reconnection.minUptime=5000` phải đặt 0 · delta Phaser bị làm mượt, dùng `performance.now()` · đóng tab thẳng để người ma 30 s, cần `unmount()` · `joinOrCreate` tràn trần mở room phụ, cần luật gán room · hook `window.__campus` còn trong bundle, gắn cờ dev ở M2.
Quyết định anh Nam: MVP-A dùng hạ tầng miễn phí, tối đa 20 người/phiên live -> `MAX_CLIENTS=20` (env `CAMPUS_MAX_CLIENTS` chỉ để đo).
M2 (2026-11-07, nhánh ccr-cc266ad8-9pmldj, PR #2): WO-world-01 PASS, chưa commit, chờ lead-safety duyệt. `packages/domain/src/campus.ts` thuần: `CAMPUS_MAX_OCCUPANCY`(=20) · `checkCampusEntry` (thành viên; play cấm trẻ; org: trẻ chỉ ở tổ chức đã xác minh của mình + vai student, người lớn chỉ principal/teacher, streaming bị cấm) · `campusAffinity` · `assignCampusInstance` (rejoin → join ưu tiên chung lớp rồi seq nhỏ → create seq trống nhỏ nhất | QUOTA khi chạm `maxInstances`; chỉ xét cùng schoolId+kind) · `campusInstanceId`. 36 test trong `test/campus.test.ts`.
WO-world-02 (v2) + 02b PASS (chưa commit, chờ lead-safety duyệt gộp 01+02+02b); check server 174 pass, 2 skip. Có: `campus-directory.ts` (sổ instance, ticket một lần tra mọi instance, mang `streaming`) · `campus-seat.ts` (`defineCampus` đăng ký subclass có `onAuth` static; `reserveCampusSeat`; runtime tra WeakMap theo đúng object deps, platform không được bọc lại) · `campus-room.ts` (`authenticateCampusTicket` chạy trước khi Colyseus đặt ghế, onJoin kiểm `client.auth.instanceId`, `createKey`, guard mọi tin, kick 4029, đuổi 4409, `seatReservationTimeout = SEAT_COLYSEUS_S` 10 s < `SEAT_TTL_MS` 15 s) · `campus-dev-seed.ts` (u01..u30). Có test hồi quy: joinById không ticket không giữ ghế.
WO-world-03 (v2) PASS (typecheck campus chỉ đỏ ở `main.ts` do bỏ `name`, WO-world-04 sửa): `net/seat.ts` (`createSeatRequester`: 400/401/403/404 denied · 409/429 busy · 5xx/lỗi mạng network) · `net/client.ts` (`requestSeat` → `joinById`; joinById lỗi → xin ghế mới; 4029 → denied, 4409 → replaced; `pagehide` leave(true), `pageshow` vào lại) · Status `denied`/`replaced`. 36 test campus pass. Còn nợ nhỏ: 4029 nên có nhãn riêng; busy dùng chung lịch waking.
WO-world-04 (v2) PASS: `main.ts` đọc `?as`/`?school` chỉ trong `TEST_HOOKS`, token `dev:<nhãn>`; production `getToken` reject (chờ Firebase client, M3) → kẹt 'waking' rồi 'failed' (nợ: nên báo "cần đăng nhập"). `bots.ts` u03..u29 qua `/campus/seat`. e2e campus 12/12 (lead chạy lại 1 lần, 1,0 phút); `npm run check` gốc xanh, dist không có `dev:`. CORS: manager thêm `Allow-Credentials` chỉ cho Origin trong allowlist ở `restrictCors` (file platform).

## Việc kế tiếp
1. Manager chốt ADR-0003 (đề xuất giữ có điều kiện, sửa chữ "Phaser 3" thành 4.x) và ADR-0004 (giữ Colyseus) sau WO-06.
2. Chưa đo: campus <-> sân khấu bài học (classroom overlay) · fps trên tablet thật (Q-01) · hạn mức host free · nhánh hết hạn 30 s ở room.
3. M2 còn lại: WO-world-05 (guard-reviewer) → lead-safety duyệt gộp 01/02/02b/03/04 (gồm reconnection token ở sessionStorage, CORS credentials) → commit. Ranh giới: world không sửa `apps/server/src/index.ts`, `src/rooms/index.ts`, `src/http/**`, `package.json`.
5. Nợ nhỏ M3: client production cần đăng nhập Firebase (hiện kẹt 'waking') · nhãn riêng cho kick 4029 · lịch retry riêng cho busy · cửa vào phòng học (`enterDoor` → session room của classroom) · đuổi khỏi campus khi thu hồi vai · cờ `streaming` trên presence.
4. Chờ quyết: trần số instance trên host free (anh Nam) · bổ sung ADR-0008 (gán bằng domain thay `joinOrCreate`).

## RPG người lớn (MVP-A, M3)
Avatar, trang phục, chuỗi nhiệm vụ, EXP, huy hiệu, chế độ "nhìn như con" — khung ở `docs/DESIGN.md` §8, chờ Q-12. Chỉ trong không gian `play`.

## Câu hỏi mở
Q-12 vòng chơi · Q-14 livestream · Visual style campus (chưa có art bible cho campus) · thiết bị mục tiêu thật của lớp (Q-01).

## Kiểm
M1: `npm run check -w @lhdk/campus` (sẽ tạo) + Playwright hai trình duyệt.
