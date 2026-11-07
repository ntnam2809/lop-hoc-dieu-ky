---
name: ship
description: Đóng gói một round làm việc của Lớp Học Diệu Kỳ — chạy npm run check (và test:e2e nếu đụng UI/engine), ghi đúng một dòng .talia/log.jsonl, commit, push branch được giao, mở PR về main (không merge, không tự monitor). Dùng ở cuối mọi round có thay đổi file.
effort: low
---

# Skill: ship

1. `git status` — không có binary lớn, secret, `node_modules`, `dist`, `test-results`.
2. Kiểm: `npm run check` (bắt buộc) · `npm run test:e2e` nếu đụng `apps/classroom` hoặc client. Đỏ → không ship; sửa hoặc báo anh Nam nguyên văn lỗi.
3. Thêm **một dòng** vào `.talia/log.jsonl` (chỉ thêm, không sửa dòng cũ):
   `{"ts":"YYYY-MM-DDTHH:MM+07:00","project":"edu-platform","done":"…","next":"…","decide":"…","pr":"#N"|null,"ho":"HO-NNNN"|null}` — mỗi trường ≤ 1 câu, không chép code/nội dung bài.
4. Commit tiếng Việt, mô tả *vì sao*. Push `git push -u origin <branch>` (lỗi mạng: thử lại 2s/4s/8s/16s).
5. PR về `main`: tiêu đề có mã HO nếu có; body gồm thay đổi · kiểm đã chạy (kết quả thật) · quyết định cần anh Nam. Số PR chưa biết lúc commit → để `"pr": null` (Talia đọc PR từ GitHub); không thêm dòng thứ hai cho cùng round.
6. Báo link PR rồi dừng. Không merge, không subscribe PR trừ khi anh Nam bảo.
