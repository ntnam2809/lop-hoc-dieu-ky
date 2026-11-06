# Kế hoạch migration & bảo toàn prototype

**Trạng thái:** bước 1–3 xong trong M0 · 2026-11-06 · ADR-0002

## Hiện trạng ba nơi

| Nơi | Chứa | Vai trò từ nay |
|---|---|---|
| Gốc repo này (`index.html`, `assets/`, `.nojekyll`) | Bản build deploy GitHub Pages (6 bài) | **Giữ nguyên** tới cutover |
| `apps/classroom/` | Source chép từ `neutrino-verse-studio/edu-platform` @ `9526753` | **Nguồn chính thức** của engine bài học |
| `neutrino-verse-studio/edu-platform/` | Source cũ (2 bài) | Đề xuất đóng băng sau khi PR này merge (Q-09) |

## Các bước

| # | Bước | Trạng thái |
|---|---|---|
| 1 | Chép source studio (`git ls-files`) vào `apps/classroom/`; đổi tên package; bỏ lockfile riêng; workspace gốc | ✓ |
| 2 | Khôi phục 4 bài + catalog từ bundle build vào `apps/classroom/content/recovered/` (JSON nguyên dạng, SVG đổi lại tên gốc, SVG dùng chung chép từ bài gốc) | ✓ |
| 3 | Kiểm: `validate` · `typecheck` · vitest · `build` · Playwright đều xanh với 2 bài trong build | ✓ |
| 4 | **Port engine delta** (M1): schema nhận tham số `$x` ở `ms`/`to`; loại asset `liquid` (hoặc đổi tên asset); `layers` rỗng; sửa hiệu ứng show/fade mượt. Đối chiếu hành vi với bản deploy bằng Playwright + ảnh chụp | chờ Q-10 |
| 5 | Chuyển từng bài từ `recovered/` vào `content/lessons/`, chạy `validate` + E2E chơi trọn từng bài; merge catalog (`recovered/catalog.deployed.json` có chủ đề `kitchen-magic`) | M1 |
| 6 | **Cutover deploy** (M3): workflow GitHub Actions build `apps/classroom` → Pages; xác nhận 6 bài chạy trên URL thật; sau đó mới gỡ `index.html` + `assets/` ở gốc trong một PR riêng | M3 |
| 7 | Đóng băng/ghi chú chuyển nhà ở studio; cập nhật routing của Talia (Q-09) | sau merge |

## Rollback
Bước 1–5 không đụng bản deploy → rollback = revert PR. Bước 6: giữ commit cuối có build ở gốc; Pages chuyển lại "deploy from branch" nếu workflow lỗi.

## Không được làm
Xoá/ghi đè file build ở gốc trước bước 6 · sửa JSON khôi phục cho "qua validator" bằng cách bỏ dữ liệu · coi `recovered/` là nội dung đã duyệt (trạng thái gốc vẫn là `review`).
