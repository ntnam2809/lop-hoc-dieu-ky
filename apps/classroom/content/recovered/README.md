# recovered/

Bốn bài `red-riding-hood`, `white-black-buffalo`, `purple-cabbage`, `dancing-rice` đã chuyển sang `content/lessons/` ngày 2026-11-06. Thư mục này chỉ còn README để ghi nguồn gốc.

- Nguồn gốc: bundle build ở commit `e995268` (deploy ở gốc repo). `lesson.json`, `assets.json` lấy nguyên đối tượng JSON từ chunk `lesson-<id>-*.js` / `assets-<id>-*.js`; SVG đổi lại tên gốc (bỏ hash). SVG dùng chung chép từ `lost-apple/` và `float-or-sink/`.
- Delta engine đã port (6 điểm): `$x` ở `ms`/`to`; id asset loại liquid; `layers` rỗng khi có `bg`; show/fade không chớp; topic `kitchen-magic`; chọn giọng vi.
- Chi tiết: `docs/MIGRATION.md` bước 4–5 và `apps/classroom/docs/architecture.md`.
