# MVP — hai đường: phụ huynh chơi trước (A), trẻ qua tổ chức thật (B)

**Trạng thái:** chốt phạm vi theo phương châm của anh Nam ngày 2026-11-06 · ADR-0014, ADR-0015 · Bản đề xuất gốc: [`proposals/HO-0012/MVP_VERTICAL_SLICE.md`](proposals/HO-0012/MVP_VERTICAL_SLICE.md)

## 1. Mục tiêu
- **MVP-A (M3), người lớn:** phụ huynh vào chơi được một ngôi trường 2D nhiều người, nhập vai đủ vòng đời *lập trường → hiệu trưởng → cấp giáo viên → mở lớp → học sinh → phiên học → kết quả*. Có giải trí, hiểu cơ chế con sẽ dùng, và livestream TikTok quảng bá được.
- **MVP-B (M4), trẻ:** một tổ chức có thật (trường mầm non) được xác minh; giáo viên thật tạo hồ sơ trẻ và dẫn phiên học trên tablet tại lớp. Trẻ không là chủ tài khoản.

## 2. Trong phạm vi

| Hạng mục | MVP-A (người lớn) | MVP-B (tổ chức + trẻ) | Trạng thái |
|---|---|---|---|
| Lõi nghiệp vụ hai không gian | trường `play` | trường `organization` + xác minh | **M0 ✓** |
| Engine bài học | 2 bài + 4 bài khôi phục | như A | M0 ✓ · port M1 |
| Campus 2D | campus trải nghiệm chính thức + trường chơi của gói pilot | campus riêng của tổ chức | spike M1 → M3/M4 |
| Nhân vật & RPG | avatar, trang phục, chuỗi nhiệm vụ, EXP, huy hiệu (Q-12) | chỉ huy hiệu hoàn thành bài | M3 |
| Chat | chữ tự do giữa người lớn + báo cáo/chặn/rate limit | chỉ câu/sticker, giáo viên điều chế độ | domain ✓ · UI M3 |
| Livestream | streamer mode (ADR-0015) | **cấm** | M3 |
| Auth | người lớn qua nhà cung cấp | trẻ: mã lớp + chọn hình trên thiết bị của tổ chức | M2–M4 |
| Server + DB | HTTP + WS room + Postgres | như A | M2 |

## 3. Hành trình nghiệm thu

### A — Phụ huynh chơi trước (`journey.test.ts` › Hành trình A ✓ ở domain)
1. Người lớn đăng nhập, tạo nhân vật, xuất hiện ở cổng campus trải nghiệm. *(M3)*
2. Nhận nhiệm vụ "Một ngày ở Trường Diệu Kỳ". *(M3)*
3. Vào lớp thử bằng mã, học *Nổi hay chìm?* cùng người lớn khác do một "giáo viên" người lớn dẫn. ✓
4. Chat chữ với người lớn trong phiên. ✓
5. Thử lớp học ở "chế độ nhìn như con". *(M3)*
6. Nhận EXP/huy hiệu; mở trang phục. *(M3)*
7. Bật streamer mode, phát TikTok: tên người khác và mã lớp bị ẩn, mọi người trong room thấy dấu đang phát. *(M3)*
8. Thử vào trường tổ chức khi đang bật streamer mode thì bị chặn. *(M3)*
9. Trường chơi không tạo được hồ sơ trẻ. ✓

### B — Trẻ qua tổ chức thật (`journey.test.ts` › Hành trình B ✓ ở domain)

| # | Bước | Kiểm |
|---|---|---|
| 1 | Hiệu trưởng thật lập trường dạng tổ chức; quản trị nền tảng xác minh (Q-13) | ✓ |
| 2 | Hiệu trưởng cấp vai giáo viên | ✓ |
| 3 | Giáo viên mở Lớp Lá 1 | ✓ |
| 4 | Giáo viên tạo hồ sơ trẻ; chưa xác minh thì không tạo được; người lớn không vào lớp có trẻ bằng mã | ✓ |
| 5–6 | Giáo viên mở phiên; trẻ vào phòng; người ngoài bị chặn | ✓ domain · M4 thiết bị |
| 7–8 | Giáo viên mở từng hoạt động; trẻ dự đoán/trả lời; đếm lần thử | ✓ |
| 9–10 | Kết quả lưu server; giáo viên và hiệu trưởng xem cả lớp, trẻ xem của mình, người khác bị chặn | ✓ |

## 4. Tiêu chí phi chức năng
- [x] Học sinh không gọi được lệnh giáo viên/hiệu trưởng. Giáo viên trường này không quản trị lớp trường khác.
- [x] Không có đường nào để người lớn vào lớp có trẻ làm học sinh; trường chơi không có trẻ (`policy.test.ts`).
- [x] Chỉ quản trị nền tảng xác minh tổ chức.
- [x] Chat có rate limit; trẻ không gõ chữ tự do.
- [x] Không secret; bản deploy prototype không bị phá; lệnh test/build xanh.
- [ ] Rớt mạng vào lại được phiên hoặc thấy thông báo rõ ràng (M2/M3).
- [ ] Campus ≥ 50 fps trên tablet tầm trung với 30 avatar (spike S1).
- [ ] Streamer mode không lộ tên người khác hay mã lớp trong bất kỳ khung hình nào (E2E chụp màn hình, M3).

## 5. Ngoài phạm vi (non-goals)
Đủ chương trình mầm non · tiểu học trở lên vận hành thật · thanh toán/giá · marketplace · AI soạn và xuất bản bài · voice/video · tin nhắn riêng · bạn bè giữa trẻ · hub chung giữa hai không gian · danh bạ trường tổ chức · xếp hạng trẻ · kinh tế có tiền thật · campus builder · app native · tích hợp API bình luận TikTok · microservice · pilot có trẻ trước Q-02/Q-13.

## 6. Quy tắc điều chỉnh phạm vi
Spike S1 trượt tiêu chí → dừng, ghi ADR thay thế, báo anh Nam phần giá trị bị hoãn. Không âm thầm cắt bước hành trình. MVP-A không bao giờ được mở cửa cho trẻ "tạm thời".
