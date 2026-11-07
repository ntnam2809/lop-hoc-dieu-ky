# ADR-0004 — Backend Node 22 + TypeScript, realtime theo room, Postgres

**Trạng thái:** Accepted hướng đi; chọn thư viện realtime sau spike S1 · phần Postgres: Superseded by ADR-0017 cho MVP (Firestore) · 2026-11-06 · module `platform` + `world` + `classroom`

## Bối cảnh
Cần: kiểm quyền phía server, state phiên học tin cậy, vị trí avatar nhiều người, lưu trường/lớp/kết quả có quan hệ.

## Quyết định
- **Lõi nghiệp vụ** `packages/domain` thuần, độc lập transport/DB (đã có). Server chỉ là adapter.
- **Server** `apps/server` (M2): Node 22, một tiến trình, HTTP cho lệnh quản trị + WebSocket cho room.
- **Realtime:** ứng viên số một **Colyseus** (room authoritative, state delta, reconnect, matchmaking). Dự phòng: `ws` + giao thức tự định nghĩa validate bằng zod. Room = campus instance (trần 20, ADR-0017) · room = phiên học.
- **Authority:** server giữ vị trí hợp lệ (biên bản đồ, tốc độ tối đa), trạng thái phiên, kết quả. Client dự đoán di chuyển cục bộ cho mượt.
- **Lưu trữ:** PostgreSQL cho danh tính/trường/vai/lớp/ghi danh/phiên/kết quả/báo cáo/kiểm toán. Test dùng store bộ nhớ (cùng giao diện `Store`). Asset/nội dung: tiếp tục static + (tùy chọn) Firebase Storage.

## Phương án đã cân nhắc
Firebase RTDB/Firestore cho realtime (không có logic authoritative nếu không thêm Functions; tính tiền theo lượt ghi, vị trí ~10 Hz rất tốn) · Supabase Realtime (broadcast tốt, authority vẫn phải tự làm) · Cloudflare Durable Objects (room-per-object rất hợp, nhưng khoá nền tảng + runtime khác Node) · Nakama (mạnh, vận hành nặng).

## Hệ quả
Đổi thư viện realtime chỉ đụng adapter. Postgres cần nơi host (Q-04).

## Kết quả spike S1 (2026-11-06) — chọn Colyseus
Colyseus 0.18 (`colyseus` 0.18.10, `@colyseus/sdk` 0.18.6, `@colyseus/schema` 5.0.42) đủ cho room authoritative, state delta, reconnect, `maxClients`, `/health`; `ws` chỉ còn là dự phòng. Cấu hình bắt buộc rút ra từ spike:
- Client đặt `room.reconnection.minUptime = 0` (mặc định 5000 ms làm phòng mới mở < 5 s không nối lại được).
- Đóng tab phải `leave`/`unmount` chủ động, nếu không server giữ "người ma" 30 s.
- `joinOrCreate` khi đầy tự mở room phụ (đúng ADR-0008) — cần luật gán instance ở M2.
- Luật tốc độ là xô ngân sách quãng đường (trần 55 px, hồi 220 px/s), không dựa dt giữa hai message.
Server: ~85–93 MB RSS, CPU ~4% với 19 bot, khởi động lạnh ~0,64 s.
