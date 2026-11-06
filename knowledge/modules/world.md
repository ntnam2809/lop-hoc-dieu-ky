# Module `world` — campus 2D · avatar · di chuyển · instance · presence (L1)

**Lead:** `lead-world` · **ADR:** 0003, 0004, 0008 · **Luật:** CONSTITUTION §2.3, §3, §6

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
- Chỉ thành viên trường vào campus trường đó. Không hub công cộng, không thăm trường khác (ADR-0008).
- Avatar chỉ hiện tên hiển thị. Không tọa độ/thông tin thật nào của người dùng.
- Asset campus là tạm (vector/tile đơn giản) — không tự chốt visual cuối (HO-0012 ngoài phạm vi).

## Trạng thái
Chưa có code. ADR-0003 chờ spike S1.

## Việc kế tiếp — Spike S1 (M1)
1. `apps/campus` tối thiểu: một tilemap sân, avatar chạm-để-đi + phím.
2. Room realtime (Colyseus ứng viên, dự phòng `ws`) với 2+ client thấy nhau; reconnect.
3. Đo: fps tablet với 30 avatar (bot), bundle gzip, rò bộ nhớ khi chuyển campus ↔ sân khấu bài học 10 lần.
4. Báo kết quả so với tiêu chí ADR-0003 → manager quyết giữ/lật ADR.

## Câu hỏi mở
Visual style campus (chưa có art bible cho campus) · thiết bị mục tiêu thật của lớp (Q-01).

## Kiểm
M1: `npm run check -w @lhdk/campus` (sẽ tạo) + Playwright hai trình duyệt.
