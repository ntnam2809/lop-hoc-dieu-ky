# AI content factory

AI dùng ở khâu sản xuất; trẻ chơi không cần AI. Mọi bài do AI soạn đi qua QA tự động và **duyệt bởi người** trước khi xuất bản.

```
Brief (JSON) ─► Claude: thiết kế giáo dục → thiết kế trò chơi → gói bài + asset manifest
            ─► GPT Image: asset theo art bible ─► validate + e2e ─► review ─► approve ─► publish
```

## 1. Đầu vào (đặc tả §18)

```json
{
  "domain": "science",
  "topic": "plants",
  "targetAge": 5,
  "durationMinutes": 7,
  "learningObjectives": ["Nhận biết cây cần nước", "Quan sát sự thay đổi của cây"],
  "classroomContext": "teacher-led group activity"
}
```

## 2. Yêu cầu cho Claude (dán kèm brief)

> Soạn MỘT gói bài học cho nền tảng "Lớp Học Diệu Kỳ" trong `edu-platform/`.
> 1. Đọc `docs/content-guide.md`, `docs/art-bible.md`, hai bài mẫu trong `content/lessons/`, và `docs/schema/lesson-package.schema.json`.
> 2. Chạy `npm run scaffold -- <id> --domain <domain> --topic <topic> --title "<tên>"` rồi điền `lesson.json` + `assets.json`.
> 3. Chỉ dùng loại hoạt động có sẵn trong engine. Thiếu tương tác thật sự → dừng, đề xuất primitive mới, không tự chế trong dữ liệu.
> 4. Mỗi hoạt động: câu yêu cầu ≤ 7 từ, câu hỏi gợi ý cho cô, mục tiêu, ghi chú quan sát. Không phạt khi sai. Khoa học phải đúng — ghi rõ điểm cần chuyên môn kiểm.
> 5. Asset: tái dùng nếu có; asset mới đặt tên theo quy ước, viết `prompt` theo art bible, tạm thời vẽ SVG placeholder cùng phong cách.
> 6. Để `status: "review"`, `review.generatedBy` ghi rõ AI soạn. Không bao giờ tự đặt `approved`/`published`.
> 7. Chạy `npm run validate`, `npm test`, `npm run test:e2e` đến khi sạch; báo cáo theo mục 3.

## 3. Đầu ra

1. Metadata bài · 2. Mục tiêu · 3. Kịch bản · 4. Danh sách cảnh · 5. Danh sách hoạt động · 6. Tương tác · 7. Câu hỏi gợi ý — tất cả nằm trong `lesson.json`.
8. Hành vi học tập mong đợi — `teacherGuide.expectedObservations` + `observation` từng hoạt động.
9. Asset manifest — `assets.json` (kèm prompt).
10. Yêu cầu âm thanh — lời đọc là các bước `say` (giọng máy hoặc ghi âm sau); hiệu ứng dùng âm tổng hợp có sẵn.
11. QA checklist — kết quả validate/test + danh sách điểm cần người duyệt (mục 4).

## 4. Duyệt (QA cấp 3)

Người duyệt (giáo viên mầm non / tổ chuyên môn) chạy bài với `npm run dev`, đối chiếu: mục tiêu phù hợp 5 tuổi · ngôn ngữ dễ hiểu · khoa học đúng · hoạt động dễ hiểu · câu hỏi gợi ý hữu ích · tải nhận thức vừa phải · không có nội dung không phù hợp. Đạt thì:

```bash
npm run approve -- <id> --by "Tên người duyệt" --notes "…"
npm run publish:content -- --project <firebase-id> --lesson <id> --apply
```

## 5. Asset GPT Image

Với từng asset `placeholder`: ghép **prompt chuẩn** (art bible) + `prompt` của asset → tạo ảnh (PNG nền trong suốt cho nhân vật/đồ vật, 16:9 cho phông nền) → lưu `assets/<id mới _v02>.png` → cập nhật `assets.json` (`file`, `version`, `status: "generated"`) và tham chiếu trong bài → `SHOTS=<thư mục> npm run test:e2e` để soát hình → người duyệt chuyển `approved`.
