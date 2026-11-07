# `apps/classroom` — engine bài học Lớp Học Diệu Kỳ (prototype)

> Chuyển từ `neutrino-verse-studio/edu-platform/` @ `9526753` ngày 2026-11-06 (HO-0012). Đây là nguồn chính thức của engine bài học; bản deploy Pages hiện tại vẫn là file build ở gốc repo (`docs/MIGRATION.md`). Bốn bài chỉ còn ở bản build được khôi phục vào `content/recovered/`.

Đồ dùng dạy học số cho lớp Lá (trẻ 5 tuổi): giáo viên chọn bài, trình chiếu lên màn hình lớn, trẻ quan sát – chạm – kéo thả – trả lời bằng lời. **Trò chơi hỗ trợ giáo viên, không thay giáo viên.** AI (Claude, GPT Image) chỉ dùng ở khâu **sản xuất nội dung**; lúc chơi **không** cần AI.

Nguyên lý cốt lõi: **dựng engine một lần — thêm bài học bằng dữ liệu.** Engine không chứa logic của bất kỳ bài nào; mỗi bài là một gói JSON + asset trong `content/`.

## Chạy thử

```bash
# từ gốc repo
npm ci
cd apps/classroom
npm run dev          # http://localhost:5180 — nội dung đọc từ content/ (không cần Firebase)
npm run dev:lan      # mở cho máy tính bảng / TV cùng mạng Wi-Fi
```

Phím tắt khi trình chiếu (giáo viên dùng bàn phím hoặc bút trình chiếu): `→`/`PageDown` tiếp · `←`/`PageUp` lùi · `Space` tạm dừng · `R` phát lại · `P` câu hỏi gợi ý · `Esc` đóng.

Tham số URL hữu ích: `?mute` (tắt giọng đọc) · `?speed=4` (tua nhanh để duyệt) · `?autostart` · `?source=firebase` · `?preview` (người duyệt xem bản nháp trên Firebase).

## Kiểm tra chất lượng

| Lệnh | Việc |
|---|---|
| `npm run validate` | QA cấp 1 + phần tự động của cấp 2 (đặc tả §19): schema, tham chiếu cảnh/asset/mục tiêu, đáp án tồn tại, thứ tự là hoán vị, vùng chạm ≥ 100, câu yêu cầu ≤ 7 từ, timeline không trỏ vào nhân vật không có… |
| `npm test` | Unit test: validator bắt đúng các lỗi cố ý, xáo trộn tất định, timeline mẫu, easing |
| `npm run test:e2e` | Playwright **chơi trọn từng bài** bằng chạm/kéo thả/phím tắt thật — bảo đảm không kẹt, tạm dừng chạy, không lỗi JS. Bài mới tự được kiểm tra. `SHOTS=<thư mục>` để chụp màn hình từng bước |
| `npm run qa` | Tất cả các bước trên |
| `npm run build` | validate → typecheck → build `dist/` |

## Quy trình nội dung

```
Brief giáo dục ──► Claude soạn gói bài (docs/content-factory.md) ──► GPT Image vẽ asset (docs/art-bible.md)
      ──► npm run validate / test:e2e ──► status "review" ──► chuyên môn duyệt (npm run approve)
      ──► npm run publish:content -- --apply ──► Firestore + Storage ──► giáo viên dùng
```

- `npm run scaffold -- <id> --domain <d> --topic <t> --title "…"` — tạo khung bài mới (draft, chạy được ngay).
- `npm run approve -- <id> --by "Tên người duyệt"` — ghi nhận duyệt chuyên môn (bắt buộc trước khi xuất bản).
- `npm run publish:content -- --project <firebase-id> [--lesson <id>] [--include-drafts] [--apply]` — mặc định chỉ in kế hoạch.
- `npm run schema` — xuất JSON Schema của gói bài vào `docs/schema/` (hợp đồng cho AI sinh nội dung).

Nội dung do AI soạn **luôn** bắt đầu ở `draft`/`review`; công cụ xuất bản từ chối bài chưa có `review.reviewedBy`.

## Firebase

1. Tạo project Firebase, bật Firestore, Storage, Hosting (và Authentication › Google nếu cần chế độ duyệt `?preview`).
2. `cp .env.example .env` rồi điền `VITE_FIREBASE_*`, đặt `VITE_CONTENT_SOURCE=firebase`.
3. `cp .firebaserc.example .firebaserc` và sửa project id.
4. Xuất bản nội dung: `GOOGLE_APPLICATION_CREDENTIALS=<service-account.json> npm run publish:content -- --project <id> --apply`.
5. `npm run build && npx firebase-tools deploy` (hosting + rules).

Rules (`firestore.rules`, `storage.rules`): ai cũng đọc được nội dung `published`; chỉ tài khoản có custom claim `reviewer` đọc bản nháp; **không ai ghi từ client** — mọi thay đổi đi qua pipeline có QA và duyệt.

> Đường Firebase chưa được chạy thử với một project thật trong lượt phát triển này — xem mục "Trạng thái" ở `docs/architecture.md`.

## Cấu trúc

| Đường dẫn | Vai trò |
|---|---|
| `src/engine/` | Engine dùng chung: kiểu dữ liệu, nguồn nội dung (local/Firebase), sân khấu, timeline, hạt hiệu ứng, âm thanh tổng hợp, giọng đọc, các primitive hoạt động |
| `src/app/` | Ứng dụng giáo viên: trang chủ, khu vực, chuẩn bị bài, trình chiếu, tổng kết, cài đặt |
| `content/catalog.json` | Khu vực học (domain) và chủ đề (topic) |
| `content/lessons/<id>/` | Một gói bài: `lesson.json` (bài → kịch bản → cảnh → hoạt động) + `assets.json` + `assets/` |
| `tools/` | `validate` + `qa` (QA tự động) · `schema` (zod) + `export-schema` · `scaffold` · `approve` · `publish` |
| `tests/` | `unit/` (vitest) · `e2e/` (Playwright) |
| `docs/` | Kiến trúc, hướng dẫn soạn nội dung, art bible, quy trình AI, JSON Schema |

Tài liệu: [kiến trúc](docs/architecture.md) · [soạn nội dung](docs/content-guide.md) · [art bible](docs/art-bible.md) · [AI content factory](docs/content-factory.md).
