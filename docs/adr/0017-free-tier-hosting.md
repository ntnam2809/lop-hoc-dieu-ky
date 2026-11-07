# ADR-0017 — MVP chạy trên hạ tầng có sẵn, miễn phí; phiên live tối đa 20 người

**Trạng thái:** Accepted · 2026-11-06 · quyết định của anh Nam · module `platform` (+ `world`, `classroom`) · thay ADR-0011 phần server, thay phần Postgres của ADR-0004 cho MVP

## Bối cảnh
Anh Nam (2026-11-06): "MVP A và host thì sử dụng những thứ có sẵn, free, tối đa phiên 20 người tham gia live."

## Quyết định
1. **Trần phiên live: 20 người, kể cả giáo viên dẫn phiên** (`LIVE_SESSION_MAX_PARTICIPANTS` trong `packages/domain`). Campus instance dùng cùng trần 20. Gói `pilot` có sĩ số lớp tối đa 20 để khớp.
2. **Client tĩnh:** GitHub Pages (đang dùng).
3. **Danh tính + lưu trữ:** Firebase (đã có trong prototype). Firebase Auth cho người lớn; Firestore làm adapter `Store` phía server (qua `firebase-admin`, đã là devDependency của classroom). Dùng gói miễn phí Spark. **Postgres hoãn** tới khi vượt hạn mức miễn phí hoặc cần truy vấn quan hệ nặng.
4. **Realtime (Colyseus, một tiến trình Node):** một host miễn phí có hỗ trợ WebSocket. Ứng viên theo thứ tự: Render (web service miễn phí, không cần thẻ, ngủ khi rảnh), Koyeb (instance miễn phí), Google Cloud Run (hạn mức miễn phí, cần tài khoản billing; đặt `max-instances=1` để giữ state room). Lead-platform kiểm điều khoản và hạn mức **thật** ở trang của nhà cung cấp lúc tạo tài khoản (M2); không dựa vào trí nhớ.
5. **Hệ quả của host miễn phí phải hiện trong thiết kế:**
   - Server có thể ngủ: client hiện "Đang đánh thức trường…" và tự thử lại.
   - Một instance: state room nằm trong bộ nhớ; kết quả và báo cáo ghi ngay xuống Firestore để không mất khi server khởi động lại.
   - Không có SLA, nên chỉ dùng cho MVP-A và pilot nhỏ.

## Phương án đã cân nhắc
VPS trả phí (ổn định hơn, nhưng trái quyết định "free") · Firebase Realtime Database thay Colyseus (không có logic server authoritative nếu không thêm Cloud Functions; phí theo lượt ghi khi vượt hạn mức) · Supabase free (Postgres + realtime, nhưng thêm một nền tảng mới trong khi Firebase đã có sẵn).

## Xem lại khi
Vượt hạn mức miễn phí · cần > 20 người một phiên · cần nhiều instance realtime.
