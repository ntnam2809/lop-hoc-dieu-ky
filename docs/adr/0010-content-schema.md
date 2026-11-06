# ADR-0010 — Gói bài hiện có là hợp đồng nội dung

**Trạng thái:** Accepted · 2026-11-06 · module `learning`

## Quyết định
- Giữ định dạng `content/lessons/<id>/lesson.json` + `assets.json` + `assets/` với zod schema ở `apps/classroom/tools/schema.ts` (xuất JSON Schema ở `docs/schema/`).
- Phiên học tham chiếu `lessonId`; M2 thêm `contentVersion` vào phiên để kết quả gắn đúng phiên bản bài.
- Chấm điểm phía server dùng đáp án trong gói bài (`Grader` của domain); hoạt động dự đoán/kể lại chỉ ghi nhận (`recorded`), không đúng/sai.
- Thay đổi schema phải tương thích ngược hoặc có script migrate gói bài + chạy lại `validate` cho mọi bài.
