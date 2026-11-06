# Module `learning` — engine bài học · primitive · gói bài · pipeline nội dung (L1)

**Lead:** `lead-learning` · **ADR:** 0002, 0010 · **Luật:** CONSTITUTION §1.4, §4, §5

## Sứ mệnh
Giữ engine dữ liệu hoá của prototype chạy tốt, thêm bài bằng dữ liệu, và cho phòng học online dùng lại engine đó.

## Sở hữu
- `apps/classroom/` toàn bộ: `src/engine/` (types, runtime, activities, fx, content) · `src/app/` (màn giáo viên) · `content/` · `tools/` (validate, schema, scaffold, approve, publish) · `tests/` · `docs/` (architecture, content-guide, art-bible, content-factory, schema)
- `apps/classroom/content/recovered/` — 4 bài khôi phục chờ port

## Không thuộc
Phiên/kết quả phía server (→ classroom) · campus (→ world). Firebase deploy (→ platform phối hợp).

## Hợp đồng
- Gói bài: `content/lessons/<id>/lesson.json` + `assets.json` (schema `tools/schema.ts`, JSON Schema `docs/schema/`).
- `ContentSource` (`src/engine/content/source.ts`): `loadCatalog · loadLesson · loadAssets`.
- `Player` nhận lệnh giáo viên (tiếp/lùi/tạm dừng/phát lại/bỏ qua) — điểm nối cho chế độ "theo nhịp cô" (M3).
- Cấp cho classroom: `Grader` đọc đáp án trong gói (M2).

## Bất biến
- Engine không biết bài nào; bài mới = dữ liệu. Thêm primitive chỉ khi tương tác thật sự chưa có — hỏi anh Nam trước, cập nhật đủ `types.ts · registry.ts · tools/schema.ts · tools/qa.ts · tests/e2e/lessons.spec.ts · docs/architecture.md`.
- AI không tự xuất bản: bài mới `status: review`; không điền `reviewedBy` thay người.
- Trẻ 5 tuổi: câu yêu cầu ≤ 7 từ, một nhiệm vụ mỗi lần, không phạt khi sai, mỗi hoạt động có câu hỏi gợi ý cho cô. Khoa học phải đúng.
- Asset theo `docs/art-bible.md`, tên `{domain}_{topic}_{type}_{name}_{vNN}`, SVG tạm.

## Trạng thái
M0 ✓: source chuyển về, 2 bài trong build, validate/typecheck/vitest 14/14/build/Playwright 3/3 xanh. Bản deploy (gốc repo) mới hơn source: 4 bài + sửa show/fade.

M1 đang làm: WO-01 (khám phá delta) PASS — 6 delta: `$x` ở ms/to (schema+types), id asset `liquid`, `layers` rỗng (refine: rỗng thì phải có `bg`), show/fade (`opacity=0; apply()` trước tween), topic `kitchen-magic`, chọn giọng vi (speech.ts). Runtime còn lại ≈ deploy. WO-02 hiện thực, WO-03 chuyển bài + e2e, WO-04 tài liệu.

## Việc kế tiếp
- M1 (Q-10): port engine delta — `$x` ở `ms`/`to`, asset `liquid`, `layers` rỗng, show/fade mượt — rồi đưa 4 bài về `content/lessons/` từng bài, E2E chơi trọn (`docs/MIGRATION.md` bước 4–5).
- M2: `Grader` từ gói bài · M3: chế độ đồng bộ theo `session.state`, nộp kết quả lên server.

## Kiểm
`npm run check:classroom` · `npm run test:e2e` · soát hình: `SHOTS=<scratchpad> npm run test:e2e -w @lhdk/classroom`
