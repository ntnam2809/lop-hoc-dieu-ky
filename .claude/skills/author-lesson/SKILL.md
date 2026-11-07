---
name: author-lesson
description: Soạn, sửa hoặc port một gói bài học cho engine Lớp Học Diệu Kỳ (apps/classroom/content/lessons/<id>/ — lesson.json + assets.json + SVG tạm) theo art bible và content guide, chạy validate + E2E. Cũng dùng khi đưa một bài từ content/recovered/ về build. KHÔNG thêm primitive engine (hỏi anh Nam qua lead-learning), KHÔNG xuất bản.
effort: high
---

# Skill: author-lesson

Mọi lệnh chạy từ gốc repo. Tài liệu nguồn (đọc khoanh vùng): `apps/classroom/docs/content-guide.md` · `content-factory.md` · `art-bible.md` · bài mẫu `content/lessons/lost-apple/`, `float-or-sink/`.

## Luật
1. **Engine không biết bài nào.** Bài = dữ liệu. Cần tương tác chưa có primitive → dừng, báo lead-learning (Cần quyết).
2. **AI không tự xuất bản:** `status: "review"`; không điền `reviewedBy`; người duyệt chạy `npm run approve -w @lhdk/classroom -- <id> --by "…"`.
3. **Trẻ 5 tuổi:** câu yêu cầu ≤ 7 từ · một nhiệm vụ mỗi lần · không phạt khi sai · mỗi hoạt động có câu hỏi gợi ý cho cô · khoa học đúng, điểm chưa chắc ghi `review.notes`.
4. **Asset:** tên `{domain}_{topic}_{type}_{name}_{vNN}`, có `prompt` cho GPT Image; vector tạm SVG; không commit raster.
5. **Không xong khi chưa xanh:** `npm run validate -w @lhdk/classroom` · `npm test -w @lhdk/classroom` · `npm run test:e2e` đều qua. Soát hình: `SHOTS=<scratchpad> npm run test:e2e -w @lhdk/classroom` rồi tự xem ảnh.

## Quy trình bài mới
1. `npm run scaffold -w @lhdk/classroom -- <id> --domain <d> --topic <t> --title "…"`.
2. Thiết kế giáo dục (mục tiêu → hoạt động → câu hỏi gợi ý → quan sát) rồi thiết kế trò chơi (cảnh, thực thể, timeline, override).
3. Asset: tái dùng hoặc vẽ SVG tạm + prompt.
4. Kiểm theo luật 5, sửa tới sạch.
5. REPORT: tóm tắt bài · kết quả QA · điểm cần duyệt chuyên môn.

## Port bài từ `content/recovered/`
Không sửa nội dung để "cho qua" validator. Lỗi do engine thiếu (xem `recovered/README.md`) → báo lead-learning cần port engine trước. Chỉ khi validator của engine mới qua: `git mv` sang `content/lessons/`, gộp chủ đề từ `recovered/catalog.deployed.json` vào `content/catalog.json`, chạy E2E chơi trọn.
