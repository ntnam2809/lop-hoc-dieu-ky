# Thiết kế chính thức v1 — Lớp Học Diệu Kỳ: Trường Học Online

**Trạng thái:** chính thức sau review HO-0012 · 2026-11-06 · Phạm vi mỗi mục có nhãn **[MVP]** · **[Phase N]** · **[LATER]**
Nguồn: prompt gốc ([`00-ORIGINAL-USER-PROMPT.md`](00-ORIGINAL-USER-PROMPT.md)) → phản biện ([`PRODUCT_REVIEW.md`](PRODUCT_REVIEW.md)) → tài liệu này. Kỹ thuật chi tiết ở ADR ([`DECISIONS.md`](DECISIONS.md)).

## 0. Phương châm của chủ dự án (2026-11-06)

1. **MVP có hai mục đích.** (a) Kéo **phụ huynh** trước bằng gameplay RPG: người lớn chơi được, giải trí được, hiểu cơ chế trước khi cho con tham gia. (b) **Trẻ tham gia qua một tổ chức có thật bên ngoài**, do giáo viên thật quản lý.
2. **Người lớn livestream TikTok** để quảng bá sản phẩm.
3. **Trẻ mẫu giáo không là chủ tài khoản.**
4. **MVP-B vẫn là không gian người lớn** (ADR-0016): giáo viên thật, ví dụ đang làm SKKN, chủ động **thiết kế phiên học cho trẻ**, chạy thử với người lớn, rồi trình chiếu cho lớp thật. Hiệu trưởng trường thật phê duyệt giáo viên dùng app ở **chế độ private** để quản lý riêng. Trẻ không có tài khoản ở MVP-B.

Cách hiện thực: hai không gian tách hẳn nhau (ADR-0014). Trường **chơi** (`play`) chỉ có người lớn, là nơi có RPG và được livestream. Trường **tổ chức** (`organization`) phải qua xác minh, là nơi duy nhất có trẻ, không livestream (ADR-0015). Cùng một vòng đời trường → lớp → phiên học chạy ở cả hai không gian. Nhờ vậy, phụ huynh chơi bên trường chơi chính là đang "học cơ chế" mà con sẽ dùng.

## 1. Định vị

**Lớp Học Diệu Kỳ** là trường học 2D trực tuyến: người lớn lập trường, mở lớp, dẫn phiên học tương tác; học sinh có nhân vật, đi lại trong khuôn viên trường, vào phòng học để chơi-học cùng cô và bạn.

Lõi trải nghiệm theo thứ tự ưu tiên:
1. **Nhập vai một ngôi trường (người lớn)**: tạo nhân vật, đi lại trong campus, nhận vai học sinh, giáo viên hoặc hiệu trưởng, làm nhiệm vụ, mở lớp, đứng lớp thử cho người lớn khác. *[MVP-A]*
2. **Học cùng nhau trong phòng học**: phiên học trực tiếp do giáo viên điều nhịp, mỗi người tương tác trên thiết bị của mình. Phụ huynh chơi đúng bài con sẽ học. *[MVP-A người lớn · MVP-B trẻ qua tổ chức]*
3. **Thuộc về một ngôi trường**: trường có tên, khuôn viên, thầy cô, lớp, bạn cùng lớp. *[MVP]*
4. **Kiến tạo**: tùy biến trường, tự soạn bài, sự kiện liên trường. *[Phase 3+]*

Không phải: MMO thế giới mở, mạng xã hội cho trẻ, LMS gắn avatar.

## 2. Người dùng & vai

| Vai | Ai | Làm được | Phạm vi |
|---|---|---|---|
| Hiệu trưởng (`principal`) | Người lớn lập trường (gói cho phép) | Cấp/thu hồi giáo viên, xem tiến độ mọi lớp, xử lý báo cáo, xem nhật ký kiểm toán | Một trường |
| Giáo viên (`teacher`) | Người lớn được hiệu trưởng cấp vai | Mở lớp, tạo hồ sơ trẻ, chia mã lớp, mở/điều khiển/đóng phiên, đặt chế độ chat, ẩn tin | Lớp mình dạy trong trường đã cấp |
| Học sinh (`student`) | Hồ sơ trẻ do cô tạo, hoặc người dùng vào bằng mã lớp | Đi lại campus, vào phiên học, tương tác, nộp kết quả, gửi câu/sticker, báo cáo | Lớp đã ghi danh |
| Người chơi người lớn (phụ huynh) | Bất kỳ người lớn nào | Chơi RPG ở trường chơi, nhận mọi vai trong đó, livestream (streamer mode) | Trường chơi |
| Phụ huynh có con trong tổ chức | — | *[LATER, Q-15]* xem tiến độ con khi tổ chức xác nhận liên kết | Con mình |
| Quản trị nền tảng | Đội vận hành | Xác minh tổ chức có thật (Q-13) | Toàn nền tảng, chỉ thao tác xác minh |

Một người có thể giữ nhiều vai ở nhiều trường (ADR-0006). Vai quản trị chỉ cho người lớn. Ở trường tổ chức, người lớn **chỉ** là hiệu trưởng hoặc giáo viên; học sinh là hồ sơ trẻ do cô tạo (trẻ không là chủ tài khoản).

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

- **Topology** (ADR-0008, ADR-0014): mỗi trường một campus instance (~40 người); phòng học là room riêng của phiên học. Có **campus trải nghiệm chính thức** (một trường chơi do nền tảng vận hành, nhiều instance) để phụ huynh vào chơi ngay. Không có hub chung giữa trường chơi và tổ chức; trẻ không bao giờ vào campus trường chơi.
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

## 8. Gameplay RPG cho người lớn & tiến trình

**Không gian người lớn (trường chơi)** *[MVP-A]*. Khung đề xuất, vòng chơi cụ thể chờ anh Nam duyệt (Q-12):
- **Nhân vật:** tạo avatar, trang phục, thẻ hồ sơ.
- **Nhập vai trường học:** đi đủ vòng đời của prompt gốc. Vào trường bằng mã → học sinh → được cấp vai giáo viên → mở lớp → đứng lớp cho người lớn khác. Gói `pilot` lập được trường riêng.
- **Chuỗi nhiệm vụ "Một ngày ở Trường Diệu Kỳ":** check-in ở cổng · tìm đồ vật ở sân · học thử một bài đúng như con sẽ học · đứng lớp thử một phiên · xem lớp học bằng **chế độ "nhìn như con"** (giao diện câu/sticker của trẻ).
- **Tiến trình:** EXP, cấp nhân vật, huy hiệu, trang phục mở bằng nhiệm vụ. Không loot box, không bán lợi thế, không ép đăng nhập (CONSTITUTION §1.5).
- **Xã hội:** chat chữ giữa người lớn trong phiên và ở sân trường, có báo cáo/chặn/rate limit. Emote. Livestream có streamer mode (ADR-0015).

**Không gian có trẻ (tổ chức)** *[MVP-B]*:
- Huy hiệu hoàn thành bài trên thẻ học sinh; tiến độ lớp cho giáo viên. Không điểm số công khai, không EXP, không tiền tệ, không xếp hạng (CONSTITUTION §1.3).
- *[Phase 2+]* Trang phục avatar của trẻ mở bằng hoạt động, không mua bằng tiền thật; portfolio tác phẩm.

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
| **M0** ✓ | Review, thiết kế, ADR, constitution, agent, init monorepo, lõi domain (hai không gian), migrate source | — |
| **M1** ✓ | Spike S1: campus Phaser + room realtime, 2+ client thấy nhau, reconnect, đo trên tablet và điện thoại · port engine delta, đưa 4 bài khôi phục về build | anh Nam duyệt PR M0 |
| **M2** | `apps/server`: domain qua HTTP/WS, auth người lớn, Postgres adapter, grader từ gói bài | S1 đạt tiêu chí ADR-0003 |
| **M3 = MVP-A** (hạ tầng miễn phí, phiên ≤ 20 người — ADR-0017) | Campus trường chơi (cổng · sân · 2 phòng) + nhân vật + chuỗi nhiệm vụ + phòng học đồng bộ + chat người lớn có moderation + streamer mode · **mở cho phụ huynh, livestream quảng bá** | tài khoản host free |
| **M4 = MVP-B** | Trường tổ chức chế độ private + hiệu trưởng phê duyệt giáo viên + thiết kế phiên học (`SessionPlan`) + trình chiếu cho lớp kèm ghi quan sát + xuất tóm tắt SKKN · pilot với một giáo viên thật. **Không có tài khoản trẻ** | Q-13, Q-16 |
| Phase sau | Hồ sơ trẻ trên thiết bị của tổ chức | Q-02 |
| Phase 1–4 | Social alpha → Learning beta → Creator & gói trả phí → Cộng đồng (mỗi phase một review) | sau pilot |
