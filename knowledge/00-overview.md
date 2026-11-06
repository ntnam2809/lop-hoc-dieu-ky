# Tổng quan cho Manager (L0)

## Sản phẩm một câu
Trường học 2D trực tuyến: người lớn lập trường, mở lớp, dẫn phiên học tương tác; học sinh có nhân vật, đi lại trong campus, vào phòng học chơi-học theo nhịp cô (`docs/DESIGN.md`, `docs/MVP.md`).

## Phương châm (anh Nam, 2026-11-06)
- **MVP-A:** phụ huynh chơi trước ở **trường chơi** (`play`, chỉ người lớn): RPG, hiểu cơ chế, livestream TikTok bằng streamer mode.
- **MVP-B:** trẻ chỉ tham gia qua **tổ chức có thật đã xác minh** (`organization`), giáo viên thật quản lý. Không livestream ở đây.
- Trẻ mẫu giáo **không là chủ tài khoản**. Hai không gian tách hẳn (ADR-0014, ADR-0015).

## Mốc hiện tại
- **M0 ✓** (HO-0012): review · thiết kế · ADR 0001–0015 · constitution · agent · monorepo · `packages/domain` (21 test, hai không gian) · `apps/classroom` (prototype source, xanh).
- **M1 kế tiếp:** spike S1 (campus Phaser + room realtime, đo tablet) · port engine delta để 4 bài khôi phục vào build.
- Sau đó: M2 server + Postgres · **M3 = MVP-A** (người lớn, RPG, streamer mode) · **M4 = MVP-B** (tổ chức + trẻ).

## Bản đồ code

| Đường dẫn | Module | Trạng thái |
|---|---|---|
| `packages/domain/` | school · classroom · safety (luật) | có code + test |
| `apps/classroom/` | learning | có code + test (prototype) |
| `apps/campus/` | world | chưa tạo (M1) |
| `apps/server/` | platform · classroom · world | chưa tạo (M2) |
| `index.html`, `assets/` (gốc) | — | bản deploy Pages, **không đụng** (ADR-0002) |

## Giao việc nhanh

| Việc thuộc về | Gọi |
|---|---|
| Vai, trường, lớp, ghi danh, quota | `lead-school` |
| Phiên học, điều nhịp, kết quả, chat phiên | `lead-classroom` |
| Campus, avatar, di chuyển, realtime room | `lead-world` |
| Bài học, primitive, nội dung, engine | `lead-learning` |
| Chat/tương tác/dữ liệu trẻ ở bất kỳ module nào | thêm `lead-safety` duyệt |
| Build, CI, deploy, server bootstrap, DB | `lead-platform` |
| Chạm ≥ 2 module | mỗi lead một phần; manager ghép thứ tự theo hợp đồng |

## Đang chờ anh Nam (blocker)
- **Q-02** đồng ý phụ huynh/trách nhiệm dữ liệu · **Q-13** xác minh tổ chức → chặn MVP-B.
- **Q-04** hosting/ngân sách · **Q-12** vòng chơi RPG người lớn → chặn MVP-A (M3).
- Danh sách đủ: `docs/DECISIONS.md` › Câu hỏi chủ dự án.

## Lệnh
`npm run check` (domain + classroom: validate · typecheck · test · build) · `npm run test:e2e` (Playwright) · `npm run dev:classroom`.
