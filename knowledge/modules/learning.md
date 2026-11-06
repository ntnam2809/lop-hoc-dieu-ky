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

M1 ✓ (HO-0012): 6 delta engine/schema/catalog đã vào source (`$x` ở ms/to, id asset `liquid`, `layers` rỗng khi có `bg`, show/fade không chớp, topic `kitchen-magic`, chọn giọng vi `?voice=`). 6 bài ở `content/lessons/` (đều `status: review`, dữ liệu bài không sửa, sha256 trùng); validate 0 lỗi 11 cảnh báo, vitest 22/22, e2e classroom 7/7; test qa chỉ đòi sạch cảnh báo với bài approved/published. `recovered/` chỉ còn README. Tài liệu architecture/content-guide/MIGRATION đã cập nhật. Còn chờ: guard-reviewer soát diff M1 (manager gọi sau khi world xong).

## Việc kế tiếp
- Chờ anh Nam: rút gọn câu yêu cầu 8–13 từ (purple-cabbage a2/a4/a6/a9, dancing-rice a2/a5) — phiếu `content-author` riêng, bài giữ `review`; cảnh báo phải sạch trước khi `approved`.
- M2: `Grader` từ gói bài (đọc đáp án trong gói).
- M3: chế độ "theo nhịp cô" đồng bộ theo `session.state`, nộp kết quả lên server.

## Kiểm
`npm run check:classroom` · `npm run test:e2e` · soát hình: `SHOTS=<scratchpad> npm run test:e2e -w @lhdk/classroom`
