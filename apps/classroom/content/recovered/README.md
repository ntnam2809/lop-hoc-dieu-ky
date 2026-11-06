# Bài khôi phục từ bản build (chưa nạp vào app)

Bốn bài dưới đây chỉ còn trong bản build deploy (commit `e995268` của repo này, 2026-10-06); source của chúng không có ở repo nào. Em khôi phục ngày 2026-11-06:

- `lesson.json`, `assets.json`: lấy nguyên đối tượng JSON từ chunk `assets/lesson-<id>-*.js`, `assets/assets-<id>-*.js` ở gốc repo, chỉ định dạng lại (không sửa nội dung).
- `assets/*.svg`: file SVG trong build, đổi lại tên gốc (bỏ hash). SVG dùng chung đã bị Vite nhúng thẳng (bird, flower, mushroom, help, owl) → chép từ `lost-apple/` và `float-or-sink/`.
- `catalog.deployed.json`: catalog của bản deploy (có thêm chủ đề `kitchen-magic`).

| Bài | Vì sao chưa qua validator của source hiện tại |
|---|---|
| `red-riding-hood` | Qua (chỉ cảnh báo) — vẫn để đây vì có thể phụ thuộc bản sửa hiệu ứng show/fade bị mất |
| `white-black-buffalo` | `options[].visual.layers` rỗng |
| `purple-cabbage` | Tên asset loại `liquid` ngoài quy ước |
| `dancing-rice` | `ms`/`to` dạng tham số `$x` trong timeline |

Engine của bản deploy mới hơn source. Port theo `docs/MIGRATION.md` bước 4–5. Không sửa dữ liệu ở đây để "cho qua".
