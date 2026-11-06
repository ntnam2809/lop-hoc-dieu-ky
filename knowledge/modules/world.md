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
Chưa có code. ADR-0003 chờ spike S1.

## Việc kế tiếp — Spike S1 (M1)
1. `apps/campus` tối thiểu: một tilemap sân, avatar chạm-để-đi + phím.
2. Room realtime (Colyseus ứng viên, dự phòng `ws`) với 2+ client thấy nhau; reconnect.
3. Đo: fps tablet với 30 avatar (bot), bundle gzip, rò bộ nhớ khi chuyển campus ↔ sân khấu bài học 10 lần.
4. Báo kết quả so với tiêu chí ADR-0003 → manager quyết giữ/lật ADR.

## RPG người lớn (MVP-A, M3)
Avatar, trang phục, chuỗi nhiệm vụ, EXP, huy hiệu, chế độ "nhìn như con" — khung ở `docs/DESIGN.md` §8, chờ Q-12. Chỉ trong không gian `play`.

## Câu hỏi mở
Q-12 vòng chơi · Q-14 livestream · Visual style campus (chưa có art bible cho campus) · thiết bị mục tiêu thật của lớp (Q-01).

## Kiểm
M1: `npm run check -w @lhdk/campus` (sẽ tạo) + Playwright hai trình duyệt.
