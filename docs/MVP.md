# MVP — Vertical slice: một trường mầm non trực tuyến

**Trạng thái:** chốt phạm vi sau review · 2026-11-06 · Bản đề xuất gốc: [`proposals/HO-0012/MVP_VERTICAL_SLICE.md`](proposals/HO-0012/MVP_VERTICAL_SLICE.md)

## 1. Mục tiêu
Chứng minh trọn vòng đời **tạo trường → cấp giáo viên → mở lớp → học sinh vào → mở phiên học → tương tác trong bài → lưu kết quả**, trong một campus 2D nhiều người, với mặc định an toàn cho trẻ.

## 2. Trong phạm vi

| Hạng mục | Chi tiết | Mốc |
|---|---|---|
| Lõi nghiệp vụ | Trường, vai có phạm vi, lớp, ghi danh, phiên, kết quả, chat an toàn, báo cáo, kiểm toán | **M0 ✓** |
| Engine bài học | Prototype source + 2 bài trong build; 4 bài khôi phục | M0 ✓ · port M1 |
| Campus | Cổng · sân · 2 phòng học; avatar đi lại; emote; ~40 người/instance | M1 spike → M3 |
| Server | HTTP lệnh quản trị + WS room; Postgres | M2 |
| Auth | Người lớn qua nhà cung cấp; trẻ = hồ sơ do cô tạo + mã lớp + chọn hình | M2 (dev) → M3 |
| Phòng học | Đồng bộ hoạt động theo nhịp cô; bảng giáo viên; panel chat | M3 |
| Bài đầu tiên | *Nổi hay chìm?* | M3 |

## 3. Hành trình nghiệm thu

| # | Bước (đề xuất gốc) | Bản chốt | Kiểm ở đâu |
|---|---|---|---|
| 1 | A tạo trường | A (gói pilot) lập Trường Mầm Non, thành hiệu trưởng | `journey.test.ts` ✓ |
| 2 | A cấp Teacher cho B | Như cũ; chỉ hiệu trưởng của chính trường | ✓ |
| 3 | B tạo lớp | B mở Lớp Lá 1, sức chứa ≤ gói | ✓ |
| 4 | C **tìm** trường và đăng ký | **Đổi:** cô tạo hồ sơ cho bé C; người lớn khác vào bằng mã lớp — không danh bạ công khai (ADR-0007) | ✓ |
| 5 | B mở phiên | Như cũ; một phiên live mỗi lớp | ✓ |
| 6 | C vào phòng học | Chỉ người ghi danh; người lạ bị chặn | ✓ (domain) · M3 (campus → phòng) |
| 7 | B bắt đầu *Nổi hay chìm?* | B mở từng hoạt động; server là nguồn sự thật | ✓ (domain) · M3 (đồng bộ engine) |
| 8 | C dự đoán/tương tác/trả lời | Chỉ nộp cho hoạt động đang mở; đếm số lần thử | ✓ |
| 9 | Server lưu kết quả | `ActivityResult` theo phiên × học sinh × hoạt động | ✓ bộ nhớ · M2 Postgres |
| 10 | B đóng phiên; A/B xem theo quyền | Cô + hiệu trưởng xem cả lớp; học sinh chỉ xem của mình; người khác bị chặn | ✓ |

## 4. Tiêu chí phi chức năng

- [x] Học sinh không gọi được lệnh giáo viên/hiệu trưởng (`policy.test.ts`).
- [x] Giáo viên trường này không quản trị lớp trường khác (`policy.test.ts`).
- [x] Chat có rate limit; trẻ không gõ chữ tự do (`chat.test.ts`).
- [x] Không secret trong repo; `.env.example` an toàn.
- [x] Bản deploy prototype không bị phá (file gốc không đổi).
- [x] Lệnh test/build có tài liệu và xanh (`npm run check`, `npm run test:e2e`).
- [ ] Học sinh rớt mạng vào lại được phiên hoặc thấy thông báo rõ ràng — M2/M3.
- [ ] Campus ≥ 50 fps trên tablet tầm trung với 30 avatar — spike S1.

## 5. User flow giao diện (M3)

1. **Giáo viên:** đăng nhập → (hiệu trưởng: Trường của tôi → Cấp giáo viên) → Lớp của tôi → Tạo hồ sơ trẻ / In mã lớp → Campus → cửa Phòng học → Mở phiên (chọn bài) → bảng giáo viên điều nhịp → Đóng phiên → Tiến độ lớp.
2. **Trẻ (tablet có người lớn):** nhập mã lớp (hoặc quét QR) → chọn hình của mình → xuất hiện ở cổng trường → đi tới phòng học đang sáng đèn → vào phòng → chơi bài theo nhịp cô → huy hiệu → quay ra sân.
3. **Hiệu trưởng:** Báo cáo chờ xử lý · Nhật ký kiểm toán · Tiến độ các lớp.

## 6. Ngoài phạm vi (non-goals)

Đủ chương trình mầm non · tiểu học/trung học/đại học vận hành thật · thanh toán/giá · marketplace · AI soạn và xuất bản bài · voice/video · tin nhắn riêng · bạn bè · hub công cộng · thăm trường khác · danh bạ trường · xếp hạng · kinh tế/tiền tệ · campus builder · app di động native · tách microservice · pilot có trẻ thật trước Q-02.

## 7. Quy tắc điều chỉnh phạm vi
Spike S1 trượt tiêu chí → dừng, ghi ADR thay thế, báo anh Nam phần giá trị bị hoãn. Không âm thầm cắt bước hành trình.
