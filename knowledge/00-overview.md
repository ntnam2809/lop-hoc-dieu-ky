# Tổng quan cho Manager (L0)

## Sản phẩm một câu
Trường học 2D trực tuyến: người lớn lập trường, mở lớp, dẫn phiên học tương tác; học sinh có nhân vật, đi lại trong campus, vào phòng học chơi-học theo nhịp cô (`docs/DESIGN.md`, `docs/MVP.md`).

## Phương châm (anh Nam, 2026-11-06)
- **MVP-A:** phụ huynh chơi trước ở **trường chơi** (`play`, chỉ người lớn): RPG, hiểu cơ chế, livestream TikTok bằng streamer mode.
- **MVP-B (ADR-0016):** vẫn là không gian người lớn. Giáo viên thật (vd làm SKKN) **thiết kế phiên học cho trẻ**, chạy thử với người lớn, trình chiếu cho lớp thật. Hiệu trưởng trường thật phê duyệt giáo viên dùng **chế độ private** (`organization`). Trẻ không có tài khoản ở MVP-B. Không livestream ở đây.
- Trẻ mẫu giáo **không là chủ tài khoản**. Hai không gian tách hẳn (ADR-0014, ADR-0015).

## Mốc hiện tại
- **M0 ✓** (HO-0012): review · thiết kế · ADR 0001–0015 · constitution · agent · monorepo · `packages/domain` (21 test, hai không gian) · `apps/classroom` (prototype source, xanh).
- **M1 ✓:** spike S1 (`apps/campus` Phaser 4 + `apps/server` Colyseus 0.18, e2e 9 ca, số đo ở `docs/spikes/S1-campus-realtime.md`) · engine delta đã port, 6 bài trong build.
- **M2 ✓ (code, chưa deploy):** domain nối vào `apps/server` (API `/v1`, room campus có vé một lần, gán instance ≤ 20), lưu qua cổng `DocDb` (Firestore MVP, ADR-0018), `SessionPlan`, Grader chấm ở server (`StudentAck` cho trẻ), rate limit + `maxPayload`, `window.__campus` chỉ dev, campus `organization` đóng. Còn nợ M3: đăng nhập client, host free (Q-19), nợ an toàn ở `docs/DECISIONS.md` và `knowledge/modules/safety.md`.
- Sau đó: **M3 = MVP-A** (người lớn, RPG, streamer mode) · **M4 = MVP-B** (tổ chức + trẻ).

## Bản đồ code

| Đường dẫn | Module | Trạng thái |
|---|---|---|
| `packages/domain/` | school · classroom · safety (luật) | có code + test |
| `apps/classroom/` | learning | có code + test (prototype) |
| `apps/campus/` | world | spike S1 (có code + test + e2e) |
| `apps/server/` | platform · classroom · world | spike S1: room campus (chưa nối domain) |
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
- **Q-13** xác nhận hiệu trưởng thật · **Q-16** mẫu tóm tắt SKKN → MVP-B. **Q-02** chỉ chặn phase có hồ sơ trẻ.
- Q-04 ✓ hạ tầng miễn phí, phiên live ≤ 20 người (ADR-0017) · Q-12 ✓ khung RPG đã duyệt.
- Danh sách đủ: `docs/DECISIONS.md` › Câu hỏi chủ dự án.

## Lệnh
`npm run check` (domain + classroom: validate · typecheck · test · build) · `npm run test:e2e` (Playwright) · `npm run dev:classroom`.
