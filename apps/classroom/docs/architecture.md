# Kiến trúc

## Tách engine khỏi nội dung

```
content/ (JSON + asset)  ──►  ContentSource  ──►  Player  ──►  ActivityFactory (registry)
   hoặc Firestore/Storage        local | firebase      │            story_scene · explore · choice ·
                                                       │            sequence · sentence_builder ·
                                                       ▼            story_recall · prediction ·
                                                     Stage           experiment · classification
                                          (cảnh, thực thể, camera,
                                           hạt hiệu ứng, phụ đề, UI)
```

- **`ContentSource`** (`src/engine/content/`) — `LocalContentSource` đọc gói trong `content/` (đóng gói cùng app, chạy offline); `FirebaseContentSource` đọc Firestore. Đổi nguồn bằng `VITE_CONTENT_SOURCE` hoặc `?source=`; phần còn lại không đổi.
- **`Player`** (`src/engine/runtime/player.ts`) — dựng cảnh cho từng hoạt động (cảnh gốc + `sceneOverrides`), tạo controller từ registry, cấp `ActivityHost`, nhận lệnh giáo viên (tiếp/lùi/tạm dừng/phát lại/bỏ qua). Không có `if bài == …` nào.
- **`ActivityHost`** (`src/engine/activities/host.ts`) — thứ duy nhất một hoạt động được dùng: sân khấu, timeline, đọc to, khen, mời thử lại, nhắc khi trẻ không tương tác, `complete()`. Hoạt động **không** tự chuyển bài — chỉ báo hoàn thành; giáo viên quyết định khi nào đi tiếp.
- **`Stage`** — sân khấu cố định 1600×900, co giãn theo màn hình. Lớp `world` chịu camera (zoom/pan); lớp `ui` (thẻ, ô thả, giỏ) thì không.
- **Đồng hồ trung tâm** (`ticker.ts`) — mọi tween, lệnh chờ, hạt hiệu ứng chạy theo một đồng hồ, nên "Tạm dừng" dừng toàn bộ sân khấu nhất quán (kể cả hoạt ảnh CSS và âm thanh).

## Primitive hoạt động

| Primitive | Loại trong dữ liệu | Tương tác |
|---|---|---|
| `storyScene` | `story_scene` | Xem timeline; sau đó chạm nhân vật/đồ vật để nghe tên |
| `explore` | `explore` | Chạm từng vật → nghe tên, sưu tập đủ thì khen |
| `choice` | `object_identification` · `character_identification` · `action_identification` · `word_selection` · `comparison` · `cause_effect` | Chạm thẳng vào cảnh (`presentation: scene`) hoặc thẻ lớn (`cards`) |
| `sequence` | `sequence` | Kéo tranh vào ô 1-2-3-4 (hoặc chạm thẻ rồi chạm ô); xong thì kể lại theo thứ tự |
| `sentenceBuilder` | `sentence_builder` | Ghép khối hình–chữ thành câu, đọc to câu hoàn chỉnh |
| `storyRecall` | `story_recall` | Dải tranh, chạm để phóng to + câu hỏi gợi mở — không đúng/sai |
| `prediction` | `prediction` | Camera phóng to vật, trẻ chọn kết quả đoán; bong bóng suy nghĩ ghi lại |
| `experiment` | `experiment` | Chạy mô phỏng tất định từ timeline, huy hiệu kết quả, so với dự đoán |
| `classification` | `classification` | Kéo vật vào giỏ; `check` = bật lại nếu sai, `predict` = ghi nhận dự đoán |

Sáu loại "chọn" dùng chung một primitive — thêm loại nhận biết mới chỉ là thêm tên vào registry. **Thêm primitive mới** chỉ khi tương tác thật sự chưa có: viết factory trong `src/engine/activities/`, đăng ký ở `registry.ts`, thêm kiểu ở `types.ts`, schema ở `tools/schema.ts`, kiểm tra ở `tools/qa.ts`, và cách giải trong `tests/e2e/lessons.spec.ts`.

## Timeline DSL

Cảnh truyện, mô phỏng thí nghiệm, phần mở/kết của mọi hoạt động đều là danh sách bước dữ liệu: `move` (có `arc` để nhảy cong, `ease` gồm cả `sink`/`float` cho nước) · `show`/`hide` · `anim` (bộ chuyển động có sẵn) · `emote` · `fx` (té nước, gợn sóng, bong bóng, sao, confetti…) · `say` (phụ đề/bong bóng thoại + đọc to) · `wait` · `sound` · `flip` · `scale` · `rotate` · `camera` · `parallel` · `play` (gọi timeline mẫu của kịch bản với tham số `$x`). Chi tiết: [content-guide.md](content-guide.md).

- **Tham số `$x`:** `ms` của `wait` và `to` của `scale`/`rotate` có kiểu `number | Param` (`Param = $${string}`, `types.ts`). Runtime thay giá trị lúc chạy bằng `substitute()` (`runtime/timeline.ts`). Schema (`tools/schema.ts`) nhận số không âm cho `ms`, hoặc chuỗi `$x`.
- **`visual`:** `layers` rỗng được phép nếu có `bg`; rỗng cả hai là lỗi ("Visual rỗng: cần ít nhất một layer hoặc bg"). Quy tắc áp cả cho `cover` của catalog.
- **`show` kiểu `fade`:** đặt opacity = 0 và `apply()` rồi mới tween, nên khung đầu không chớp.

## Hiệu ứng

- **Hạt** (`fx/particles.ts`, canvas): sao bung + vòng sóng khi đúng, té nước + gợn sóng khi rơi xuống nước, chuỗi bong bóng khi chìm, bụi khi chạm đất, tim, nước mắt, confetti; hạt nền theo cảnh (phấn hoa, đom đóm, bướm bay lượn, bụi nắng, bong bóng trong bể).
- **Nhân vật sống**: thở, chớp mắt, vẫy tai, ve vẩy đuôi, vỗ cánh (class quy ước trong SVG — xem art bible), cộng 15 bộ chuyển động toàn thân (nhảy, đi, chạy, ngủ, khóc, reo, dập dềnh…) lệch pha để không đồng loạt.
- **Phản hồi**: chữ khen nảy từng ký tự, thẻ đúng gắn huy hiệu; sai thì lắc nhẹ + hai nốt nhạc mời thử lại — **không** có dấu X đỏ, không phụ thuộc màu xanh/đỏ.
- **Chuyển cảnh**: vòng tròn khép–mở có ngôi sao xoay; camera zoom/pan trong truyện.
- **Âm thanh**: tổng hợp WebAudio (không cần file), có vang nhẹ; nhạc nền hộp nhạc ngũ cung (mặc định tắt).
- **Giọng đọc**: Web Speech với giọng tiếng Việt của máy (chỉ đọc văn bản đã duyệt). Chọn giọng bằng hàm thuần `pickVoice` (`fx/speech.ts`): chỉ xét giọng có `lang` bắt đầu `vi`; `?voice=<chuỗi con tên, không phân biệt hoa thường>` ép giọng; không ép thì ưu tiên tên khớp `/google|hoai\s?my/i`, rồi giọng vi đầu tiên, rồi `null`. Không có giọng vi-VN → im lặng, phụ đề vẫn hiện. Gói nội dung có thể bổ sung file ghi âm sau.

## Bảo đảm không kẹt (soft-lock)

- Nút "Tiếp/Bỏ qua" của giáo viên luôn bấm được; hoạt động chỉ báo hoàn thành.
- Validator chặn: đáp án không tồn tại, thứ tự không phải hoán vị, vật cần chạm bị ẩn/là đồ trang trí, nhóm phân loại không tồn tại, tham số timeline thiếu.
- Xáo thẻ tất định và không bao giờ trả về thứ tự đã đúng sẵn.
- Không tương tác ~9 giây → mọi lựa chọn cùng nhấp nháy (gợi "chạm vào đây", không lộ đáp án).
- Trẻ chạm vào sân khấu → bảng điều khiển của cô tự thu lại để không bấm nhầm.
- E2E chơi trọn mọi bài trong `content/lessons/` mỗi lần chạy.

## Trạng thái

| Hạng mục (đặc tả §25) | Trạng thái |
|---|---|
| Mở nền tảng, chọn Ngôn ngữ/Khoa học, chọn bài, bắt đầu | ✓ (E2E) |
| Trẻ hoàn thành không cần đọc nhiều chữ | ✓ câu yêu cầu ≤ 7 từ + đọc to + biểu tượng |
| Giáo viên tạm dừng/tiếp/lùi, xem câu hỏi gợi ý | ✓ (E2E kiểm tra tạm dừng bằng phím) |
| Toàn bộ nội dung từ dữ liệu, không hard-code bài | ✓ |
| Sáu bài chơi trọn | ✓ `lost-apple` (11 hoạt động) · `float-or-sink` (10 hoạt động) · `red-riding-hood` · `white-black-buffalo` · `purple-cabbage` · `dancing-rice` |
| Thêm bài mới chỉ bằng dữ liệu + asset | ✓ `npm run scaffold` → validate → chạy, không sửa engine |
| Asset nạp từ Firebase Storage | Đã viết `FirebaseContentSource` + `publish.ts` + rules; **chưa chạy với project thật** |
| Asset GPT Image | Hiện là vector tạm (SVG) theo art bible, kèm prompt trong `assets.json` để thay |
| Duyệt sư phạm (cấp 3) | Cả sáu bài đang ở `review` — cần chuyên môn mầm non duyệt |
