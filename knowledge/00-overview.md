# Tổng quan cho Manager (L0)

## Sản phẩm một câu
Trường học 2D trực tuyến: người lớn lập trường, mở lớp, dẫn phiên học tương tác; học sinh có nhân vật, đi lại trong campus, vào phòng học chơi-học theo nhịp cô. Slice đầu: một trường mầm non (`docs/DESIGN.md`, `docs/MVP.md`).

## Mốc hiện tại
- **M0 ✓** (HO-0012): review · thiết kế · ADR 0001–0013 · constitution · agent · monorepo · `packages/domain` (18 test) · `apps/classroom` (prototype source, xanh).
- **M1 kế tiếp:** spike S1 (campus Phaser + room realtime, đo tablet) · port engine delta để 4 bài khôi phục vào build.
- Sau đó: M2 server + Postgres · M3 campus + phòng học đồng bộ + staging · M4 an toàn/pháp lý trước pilot.

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
- **Q-02** pháp lý/đồng ý phụ huynh → chặn mọi pilot có trẻ thật.
- **Q-04** hosting/ngân sách → chặn staging online (M3).
- Danh sách đủ: `docs/DECISIONS.md` › Câu hỏi chủ dự án.

## Lệnh
`npm run check` (domain + classroom: validate · typecheck · test · build) · `npm run test:e2e` (Playwright) · `npm run dev:classroom`.
