# Thiết kế chính thức v1 — Lớp Học Diệu Kỳ: Trường Học Online

**Trạng thái:** chính thức sau review HO-0012 · 2026-11-06 · Phạm vi mỗi mục có nhãn **[MVP]** · **[Phase N]** · **[LATER]**
Nguồn: prompt gốc ([`00-ORIGINAL-USER-PROMPT.md`](00-ORIGINAL-USER-PROMPT.md)) → phản biện ([`PRODUCT_REVIEW.md`](PRODUCT_REVIEW.md)) → tài liệu này. Kỹ thuật chi tiết ở ADR ([`DECISIONS.md`](DECISIONS.md)).

## 1. Định vị

**Lớp Học Diệu Kỳ** là trường học 2D trực tuyến: người lớn lập trường, mở lớp, dẫn phiên học tương tác; học sinh có nhân vật, đi lại trong khuôn viên trường, vào phòng học để chơi-học cùng cô và bạn.

Lõi trải nghiệm theo thứ tự ưu tiên:
1. **Học cùng nhau trong phòng học** — phiên học trực tiếp do giáo viên điều nhịp, mỗi học sinh tương tác trên thiết bị của mình. *[MVP]*
2. **Thuộc về một ngôi trường** — trường có tên, khuôn viên, thầy cô, lớp, bạn cùng lớp. *[MVP]*
3. **Đi lại, khám phá, gặp gỡ** — campus 2D, emote, đồ vật tương tác. *[MVP tối thiểu → Phase 1]*
4. **Kiến tạo** — tùy biến trường, tự soạn bài, sự kiện liên trường. *[Phase 3+]*

Không phải: MMO thế giới mở, mạng xã hội cho trẻ, LMS gắn avatar.

## 2. Người dùng & vai

| Vai | Ai | Làm được | Phạm vi |
|---|---|---|---|
| Hiệu trưởng (`principal`) | Người lớn lập trường (gói cho phép) | Cấp/thu hồi giáo viên, xem tiến độ mọi lớp, xử lý báo cáo, xem nhật ký kiểm toán | Một trường |
| Giáo viên (`teacher`) | Người lớn được hiệu trưởng cấp vai | Mở lớp, tạo hồ sơ trẻ, chia mã lớp, mở/điều khiển/đóng phiên, đặt chế độ chat, ẩn tin | Lớp mình dạy trong trường đã cấp |
| Học sinh (`student`) | Hồ sơ trẻ do cô tạo, hoặc người dùng vào bằng mã lớp | Đi lại campus, vào phiên học, tương tác, nộp kết quả, gửi câu/sticker, báo cáo | Lớp đã ghi danh |
| Phụ huynh | — | *[LATER, Q-02]* xem tiến độ con, quản lý đồng ý | Con mình |

Một người có thể giữ nhiều vai ở nhiều trường (ADR-0006). Vai quản trị chỉ cho người lớn.

## 3. Loại trường

`kindergarten` · `primary` · `secondary` · `university` có trong mô hình dữ liệu từ đầu. MVP chỉ *vận hành* mầm non (có nội dung). Mỗi cấp mở thêm cần: gói nội dung, mặc định an toàn theo tuổi, template campus. *[Phase 2+ cho tiểu học]*

## 4. Vòng đời cốt lõi *[MVP]*

```
Người lớn (gói pilot) ──lập trường──► Hiệu trưởng
Hiệu trưởng ──cấp vai──► Giáo viên ──mở lớp (sức chứa ≤ gói)──► Lớp + mã lớp
Giáo viên ──tạo hồ sơ trẻ / chia mã──► Học sinh ghi danh
Giáo viên ──mở phiên (bài học)──► Phiên live ◄──vào phòng── Học sinh
Giáo viên ──mở hoạt động N──► Học sinh tương tác ──nộp──► Server chấm/ghi nhận
Giáo viên ──đóng phiên──► Kết quả xem được theo quyền (cô, hiệu trưởng, chính học sinh)
```
Đã hiện thực ở lõi `packages/domain` và kiểm bằng test hành trình.

## 5. Thế giới 2D

- **Topology** (ADR-0008): mỗi trường một campus instance (~40 người). Phòng học là room riêng của phiên học. Không hub công cộng trong MVP.
- **Campus MVP:** Cổng trường (bảng thông báo, điểm xuất hiện) · Sân trường (đồ vật tương tác: xích đu, bóng, cây; emote) · Phòng học 1 & 2 (cửa chỉ mở cho lớp có phiên). *[MVP]*
- **Mở rộng:** thư viện, phòng thí nghiệm, phòng mỹ thuật, căng-tin, hội trường, vườn, phòng CLB *[Phase 1–4]*; mỗi khu chỉ thêm khi có hoạt động thật cho nó.
- **Điều khiển:** chạm-để-đi (trẻ) · joystick ảo · WASD/phím mũi tên. Chạm avatar → thẻ tên (chỉ tên hiển thị). Emote: vẫy tay, giơ tay, vỗ tay, nhảy, ngồi.
- **Authority:** server giữ vị trí hợp lệ; client dự đoán để mượt (ADR-0004).

## 6. Phiên học trực tiếp *[MVP]*

- **Mô hình "theo nhịp cô"**: mỗi thiết bị chạy engine bài học sẵn có; server phát *hoạt động đang mở*; học sinh chỉ nộp cho hoạt động đó; cô bấm tiếp/lùi/tạm dừng như prototype.
- **Bảng giáo viên:** danh sách người trong phòng + trạng thái (đang làm · đã nộp · cần giúp) · nút điều nhịp · chế độ chat · đóng phiên.
- **Học sinh:** giơ tay (emote), tương tác bài, câu/sticker.
- **Panel chat kiểu livestream** (R9): chạy dọc cạnh sân khấu bài, tin mới đẩy lên, sticker nổi. Chế độ `off | phrases | open`; trẻ luôn chỉ câu/sticker (ADR-0007).
- **Kết quả:** lưu theo `(phiên, học sinh, hoạt động)` có số lần thử; dự đoán/kể lại = `recorded`, không chấm đúng/sai.
- *[Phase 2]* poll nhanh, chia nhóm, bảng trắng chung, xem lại phiên. *[LATER, Q-08]* giọng/video giáo viên.

## 7. Nội dung học

- Phân cấp: Khu vực (domain) → Chủ đề (topic) → Bài (lesson) → Kịch bản → Hoạt động. Giữ đúng engine hiện có (ADR-0010).
- "Pattern của game" (R7) = 9 primitive hiện có: kể chuyện · khám phá · chọn/nhận biết (6 biến thể) · sắp xếp · ghép câu · nhớ lại · dự đoán · thí nghiệm · phân loại.
- Bài hiện có: *Quả táo bị thất lạc*, *Nổi hay chìm?* (trong build) + 4 bài khôi phục chờ port engine.
- Quy trình: AI soạn → `review` → chuyên môn duyệt → xuất bản (CONSTITUTION §4).
- Tự tạo bài (R8) *[Phase 3]*: trình soạn theo khối, bài người dùng tạo đi qua cùng validator + duyệt; chỉ gói trả phí.

## 8. Tiến trình & phần thưởng

- *[MVP]* Huy hiệu hoàn thành bài trên thẻ học sinh; tiến độ lớp cho giáo viên. Không điểm số công khai.
- *[Phase 2+]* Trang phục avatar mở bằng hoạt động (không mua bằng tiền thật ở bản trẻ em), portfolio tác phẩm.
- *[LATER]* EXP/đóng góp/tiền trang trí — chỉ khi có thiết kế kinh tế được duyệt. Cấm streak phạt và xếp hạng cá nhân giữa trẻ (CONSTITUTION §1.3).

## 9. Cộng đồng *[Phase 1–4]*

Bạn bè (chỉ trong trường, cô duyệt) · CLB · bảng tin trường · sự kiện mùa · ngày hội liên trường (chỉ khi có moderation) · thư viện thế giới. Mỗi tính năng phải có mục tương ứng trong `SAFETY.md` trước khi mở cho trẻ.

## 10. Gói tài khoản

Theo prompt (R5, R6, R8): free = học sinh hoặc giáo viên lớp nhỏ, **không lập trường**; trả phí = lập trường, lớp lớn hơn, tự soạn bài. Số cụ thể, giá, bậc gói là quyết định chủ dự án (Q-03). MVP: gói `pilot` cấp tay, không thanh toán (ADR-0009).

## 11. Kiến trúc tổng (chi tiết ở ADR)

```
apps/campus (Phaser, M1) ─┐                         ┌─ packages/domain (lõi nghiệp vụ thuần) ✓
apps/classroom (engine     ├─ WebSocket/HTTP ─► apps/server (M2) ─┤
  bài học, prototype) ✓   ─┘                         └─ Postgres (M2) · nội dung tĩnh/Firebase
```
✓ = đã có code. Module nghiệp vụ & lead phụ trách: `school` · `classroom` · `world` · `learning` · `safety` · `platform` (`knowledge/modules/`).

## 12. Lộ trình

| Mốc | Nội dung | Điều kiện vào |
|---|---|---|
| **M0** ✓ | Review, thiết kế, ADR, constitution, agent, init monorepo, lõi domain, migrate source | — |
| **M1** | Spike S1: campus Phaser + room realtime, 2+ client thấy nhau, reconnect, đo tablet · port engine delta, đưa 4 bài khôi phục về build | anh Nam duyệt PR M0 |
| **M2** | `apps/server`: domain qua HTTP/WS, auth người lớn (dev), Postgres adapter, grader từ gói bài | S1 đạt tiêu chí ADR-0003 |
| **M3** | Campus MVP (cổng · sân · 2 phòng) + phòng học đồng bộ theo nhịp cô + panel chat · staging cho người lớn · cutover Pages | Q-04 |
| **M4** | Rà soát an toàn/riêng tư, playtest người lớn đóng vai, chuẩn bị pilot | Q-01, Q-02 |
| Phase 1–4 | Social alpha → Learning beta → Creator & gói trả phí → Cộng đồng (theo đề xuất HO-0012, mỗi phase một review) | sau pilot |
