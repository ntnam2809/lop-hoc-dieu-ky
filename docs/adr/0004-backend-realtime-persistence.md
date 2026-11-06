# ADR-0004 — Backend Node 22 + TypeScript, realtime theo room, Postgres

**Trạng thái:** Accepted hướng đi; chọn thư viện realtime sau spike S1 · 2026-11-06 · module `platform` + `world` + `classroom`

## Bối cảnh
Cần: kiểm quyền phía server, state phiên học tin cậy, vị trí avatar nhiều người, lưu trường/lớp/kết quả có quan hệ.

## Quyết định
- **Lõi nghiệp vụ** `packages/domain` thuần, độc lập transport/DB (đã có). Server chỉ là adapter.
- **Server** `apps/server` (M2): Node 22, một tiến trình, HTTP cho lệnh quản trị + WebSocket cho room.
- **Realtime:** ứng viên số một **Colyseus** (room authoritative, state delta, reconnect, matchmaking). Dự phòng: `ws` + giao thức tự định nghĩa validate bằng zod. Room = campus instance (trần ~40) · room = phiên học.
- **Authority:** server giữ vị trí hợp lệ (biên bản đồ, tốc độ tối đa), trạng thái phiên, kết quả. Client dự đoán di chuyển cục bộ cho mượt.
- **Lưu trữ:** PostgreSQL cho danh tính/trường/vai/lớp/ghi danh/phiên/kết quả/báo cáo/kiểm toán. Test dùng store bộ nhớ (cùng giao diện `Store`). Asset/nội dung: tiếp tục static + (tùy chọn) Firebase Storage.

## Phương án đã cân nhắc
Firebase RTDB/Firestore cho realtime (không có logic authoritative nếu không thêm Functions; tính tiền theo lượt ghi, vị trí ~10 Hz rất tốn) · Supabase Realtime (broadcast tốt, authority vẫn phải tự làm) · Cloudflare Durable Objects (room-per-object rất hợp, nhưng khoá nền tảng + runtime khác Node) · Nakama (mạnh, vận hành nặng).

## Hệ quả
Đổi thư viện realtime chỉ đụng adapter. Postgres cần nơi host (Q-04).
