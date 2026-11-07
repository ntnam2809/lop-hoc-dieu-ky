# ADR-0018 — Server giữ `Store` đồng bộ trong bộ nhớ, lưu bền qua cổng `DocDb`

**Trạng thái:** Accepted · 2026-11-07 · module `platform`

## Bối cảnh
- `packages/domain` (`SchoolService`) thuần, đồng bộ; đọc/ghi các `Map` trong `Store` và có chỗ sửa tại chỗ object (vd `verifyOrganization` gán `verifiedAt`, `joinSession` đẩy vào `participants`).
- MVP chạy trên hạ tầng miễn phí, một tiến trình Node (ADR-0017); Firestore ở MVP, Postgres hoãn.
- Firestore bất đồng bộ, không nhận mảng lồng mảng, trần 500 thao tác mỗi lô.

## Quyết định
- Server nạp toàn bộ dữ liệu lúc khởi động (`hydrate`) vào `Store` trong bộ nhớ; sau mỗi lệnh đổi dữ liệu gọi `flush`, so diff JSON với bản đã lưu rồi ghi các bản ghi đổi qua cổng `DocDb` (`readAll`, `commit` theo lô nguyên tử).
- Firestore là adapter MVP (mỗi doc lưu `{data: <chuỗi JSON>}`); Postgres về sau chỉ cần hiện thực lại `DocDb`, domain không đổi.
- Lệnh đã đổi bộ nhớ mà `flush` lỗi → trả 503; `flush` kế tiếp ghi bù đúng phần còn thiếu.

## Phương án đã cân nhắc
- Đổi `Store` sang repository bất đồng bộ: mọi hàm domain thành async, đụng code các module đang phát triển song song; không đáng ở MVP.
- Đọc/ghi thẳng Firestore mỗi lệnh: chậm, tốn lượt đọc của gói miễn phí, mất tính nguyên tử giữa nhiều bản ghi.

## Hệ quả
- Bất biến cho domain: không gán lại field của `Store`; mảng trong `Store` (audit…) chỉ thêm, phần tử bất biến; mọi giá trị JSON-serializable; field `Map` mới tự được lưu.
- Bắt buộc đúng một instance server (ADR-0017); chi phí diff O(N) mỗi lệnh và đọc toàn bộ khi khởi động lạnh.
- Client thử lại sau 503 có thể nhận 409 (vd `POST /v1/me` đã đổi bộ nhớ).

## Xem lại khi
Flush > 50 ms, dữ liệu > ~20 nghìn bản ghi, cần nhiều hơn một instance, hoặc chuyển sang Postgres.
