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

## Việc kế tiếp
1. Manager chốt ADR-0003 (đề xuất giữ có điều kiện, sửa chữ "Phaser 3" thành 4.x) và ADR-0004 (giữ Colyseus) sau WO-06.
2. Chưa đo: campus <-> sân khấu bài học (classroom overlay) · fps trên tablet thật (Q-01) · hạn mức host free · nhánh hết hạn 30 s ở room.
3. M2: nối SchoolService/auth vào room, luật gán instance, import 20 từ domain, gắn cờ dev cho hook test.

## RPG người lớn (MVP-A, M3)
Avatar, trang phục, chuỗi nhiệm vụ, EXP, huy hiệu, chế độ "nhìn như con" — khung ở `docs/DESIGN.md` §8, chờ Q-12. Chỉ trong không gian `play`.

## Câu hỏi mở
Q-12 vòng chơi · Q-14 livestream · Visual style campus (chưa có art bible cho campus) · thiết bị mục tiêu thật của lớp (Q-01).

## Kiểm
M1: `npm run check -w @lhdk/campus` (sẽ tạo) + Playwright hai trình duyệt.
