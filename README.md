# Lớp Học Diệu Kỳ — Trường Học Online

Trường học 2D trực tuyến cho việc học tương tác: người lớn lập trường, mở lớp, dẫn phiên học; học sinh có nhân vật, đi lại trong khuôn viên, vào phòng học chơi-học theo nhịp cô. Phương châm: **phụ huynh chơi trước** ở trường chơi chỉ có người lớn (RPG, hiểu cơ chế, được livestream quảng bá); **trẻ chỉ tham gia qua tổ chức có thật** do giáo viên thật quản lý, và không là chủ tài khoản. Nội dung đầu tiên là các bài mầm non sẵn có.

> **Trạng thái deploy:** GitHub Pages vẫn đang phục vụ **bản chơi thử** (đồ dùng dạy học số cho trẻ 5 tuổi) từ `index.html` + `assets/` ở gốc repo. Các file này là bản build, được giữ nguyên cho tới khi chuyển deploy sang build tự động (`docs/MIGRATION.md`).

## Bài học trong bản chơi thử

**Phát triển ngôn ngữ — Kể chuyện:** Quả táo bị thất lạc · Cô bé quàng khăn đỏ · Trâu trắng và trâu đen
**Khám phá khoa học:** Nổi hay chìm? (Nổi và chìm) · Bắp cải tím đổi màu, Hạt gạo nhảy múa (Phép màu trong bếp)

## Tài liệu

| | |
|---|---|
| Luật bất biến | [`CONSTITUTION.md`](CONSTITUTION.md) |
| Thiết kế chính thức | [`docs/DESIGN.md`](docs/DESIGN.md) |
| Phạm vi MVP + nghiệm thu | [`docs/MVP.md`](docs/MVP.md) |
| Review sản phẩm (HO-0012) | [`docs/PRODUCT_REVIEW.md`](docs/PRODUCT_REVIEW.md) · prompt gốc [`docs/00-ORIGINAL-USER-PROMPT.md`](docs/00-ORIGINAL-USER-PROMPT.md) |
| Quyết định (ADR, giả định, câu hỏi) | [`docs/DECISIONS.md`](docs/DECISIONS.md) |
| An toàn trẻ em | [`docs/SAFETY.md`](docs/SAFETY.md) |
| Migration prototype | [`docs/MIGRATION.md`](docs/MIGRATION.md) |
| Knowledge base & đội agent | [`knowledge/README.md`](knowledge/README.md) · [`.claude/CLAUDE.md`](.claude/CLAUDE.md) |

## Cấu trúc

| Đường dẫn | Vai trò |
|---|---|
| `packages/domain/` | Lõi nghiệp vụ thuần TypeScript: trường, vai theo phạm vi, lớp, ghi danh, phiên học, kết quả, chat an toàn, báo cáo, kiểm toán |
| `apps/classroom/` | Engine bài học dữ liệu hoá + ứng dụng giáo viên (Vite + TS) — source của bản chơi thử, 6 bài |
| `apps/campus/` | Campus 2D (Phaser 4) — **spike S1**: sân trường tạm, avatar đi lại, thấy nhau realtime. Không gian **người lớn**, chưa gắn danh tính; trẻ không dùng |
| `apps/server/` | Server realtime (Colyseus 0.18): room campus authoritative, trần 20 người, `/health` cho host miễn phí — **spike S1** |
| `index.html`, `assets/`, `.nojekyll` | Bản build đang deploy GitHub Pages — không sửa tay |
| `docs/` · `knowledge/` · `.claude/` | Thiết kế · tri thức phân tầng · agent, skill |

Kết quả spike S1: [`docs/spikes/S1-campus-realtime.md`](docs/spikes/S1-campus-realtime.md). Chưa có (theo lộ trình): nối `packages/domain` vào server, đăng nhập Firebase, lưu Firestore (M2).

## Chạy local

Yêu cầu Node ≥ 22.

```bash
npm ci
npm run check          # domain: typecheck + test · classroom: validate + typecheck + test + build
npm run test:e2e       # Playwright chơi trọn từng bài (Chromium; trong cloud tự dùng /opt/pw-browsers/chromium)
npm run dev:classroom  # http://localhost:5180
npm run dev:server     # realtime campus ws://localhost:2567 (GET /health)
npm run dev:campus     # http://localhost:5198 (?name=<tên>)
```

Biến môi trường: `.env.example` (gốc, cho server M2) và `apps/classroom/.env.example` (nguồn nội dung, Firebase). Không file nào chứa secret; sao chép thành `.env` khi cần.

## Lộ trình

M0 ✓ review + thiết kế + init · M1 spike campus/realtime + port 4 bài khôi phục · M2 server + Postgres · M3 campus + phòng học đồng bộ + staging · M4 an toàn/pháp lý trước pilot. Chi tiết: [`docs/DESIGN.md`](docs/DESIGN.md) §12.
