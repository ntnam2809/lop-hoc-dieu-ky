# Hướng dẫn soạn nội dung

Một bài = một thư mục `content/lessons/<id>/`:

```
lesson.json   bài → kịch bản → cảnh + timeline mẫu + hoạt động
assets.json   danh sách asset (id, file, loại, prompt GPT Image, trạng thái)
assets/       file asset (SVG tạm / PNG, WebP do GPT Image tạo)
```

Schema đầy đủ: `docs/schema/lesson-package.schema.json` (sinh bằng `npm run schema`). Các bài `lost-apple` và `float-or-sink` là ví dụ chuẩn nhất — đọc chúng trước. Loại id asset: `character` · `object` · `liquid` · `background` · `icon` · `overlay` · `audio` (`liquid` trong manifest có `type` là `object`).

## Phân cấp

```
Domain (catalog.json) └ Topic (catalog.json) └ Lesson └ Scenario └ Scene (+ timelines mẫu)
                                                                 └ Activity (sceneId, instruction, teacherPrompts, learningObjectives, observation)
```

`lesson.status`: `draft` → `review` → `approved` → `published` → `archived`. Nội dung AI soạn luôn bắt đầu ở `draft`/`review`.

## Toạ độ

Sân khấu 1600×900. Thực thể khai báo **tâm** `x, y` và hộp `w, h` (hộp cũng là vùng chạm — tối thiểu 100). Minh hoạ trên thẻ (`visual`) dùng khung 400×300.

## Thực thể (`scene.entities[]`)

```json
{ "id": "rabbit", "asset": "language_story_character_rabbit_v01", "x": 380, "y": 650, "w": 190, "h": 240,
  "z": 30, "anim": "idle", "label": "bạn Thỏ" }
```

- `label` — tên đọc to khi trẻ chạm (từ vựng).
- `zone: true` — vùng chạm vô hình trên ảnh nền (ví dụ "dòng suối").
- `decor: true` — trang trí, không nhận chạm (ví dụ mặt kính bể nước phủ lên đồ vật).
- `hidden`, `flip`, `rotate`, `scale`, `z`.
- `anim`: `idle` · `hop` · `walk` · `run` · `sleep` · `cry` · `cheer` · `wiggle` · `bob` · `sway` · `spin` · `pulse` · `shake` · `think` · `peek` · `none`.

Mỗi hoạt động dựng lại cảnh từ trạng thái gốc + `sceneOverrides` → "Phát lại" và "Lùi" luôn đúng. Hãy để override phản ánh diễn biến truyện (ví dụ quả táo đã ở dưới suối).

`scene.ambient`: `pollen` · `leaves` · `fireflies` · `butterflies` · `motes` · `bubbles`, có thể kèm `area` và `density`.

## Timeline

```json
[
  { "do": "say", "text": "Bỗng nhiên… bịch!" },
  { "do": "parallel", "steps": [
      { "do": "move", "target": "apple", "to": { "x": 650, "y": 716 }, "duration": 950, "ease": "bounceOut" },
      { "do": "scale", "target": "apple", "to": 1 } ] },
  { "do": "fx", "fx": "dust", "at": { "x": 650, "y": 770 } },
  { "do": "emote", "target": "rabbit", "emote": "exclaim" },
  { "do": "say", "text": "Bạn Thỏ ơi, sao bạn khóc?", "target": "fox" }
]
```

| Bước | Trường |
|---|---|
| `move` | `target`, `to` (điểm hoặc id thực thể), `duration`, `ease`, `arc` (độ cao cung nhảy), `offset` |
| `show` / `hide` | `effect`: `pop` · `fade` · `grow` / `shrink` |
| `anim` | `preset` |
| `emote` | `heart` · `question` · `exclaim` · `tear` · `zzz` · `sparkle` · `music` · `idea` (+ `duration`) |
| `fx` | `splash` · `ripple` · `bubbles` · `sparkle` · `confetti` · `leaves` · `dust` · `stars` · `hearts` · `tears`; `at`, `size` |
| `say` | `text`; có `target` → bong bóng thoại của nhân vật, không có → phụ đề người kể |
| `wait` · `sound` · `flip` · `scale` · `rotate` | |
| `camera` | `zoom` (1–3), `focus` |
| `parallel` | `steps` chạy đồng thời |
| `play` | gọi `scenario.timelines[<tên>]` với `args`; trong mẫu dùng `"$ten"` (số giữ nguyên kiểu, dùng được làm toạ độ) |

`$x` cũng dùng được ở `wait.ms` và `scale.to`/`rotate.to` trong timeline mẫu, ví dụ `{ "do": "wait", "ms": "$delay" }` và `{ "do": "rotate", "target": "…", "to": "$rot" }` (xem `dancing-rice`); `ms` là số không âm. `visual` (khung 400×300) cho phép `layers` rỗng nếu có `bg`; rỗng cả hai là lỗi.

`ease`: `linear` · `easeIn` · `easeOut` · `easeInOut` · `backOut` · `backIn` · `bounceOut` · `elasticOut` · `sink` (chìm, bị nước cản) · `float` (dập dềnh rồi nổi).

Âm thanh: `tap` · `pop` · `pickup` · `drop` · `correct` · `retry` · `splash` · `plunk` · `bubble` · `whoosh` · `sparkle` · `hop` · `fanfare` · `thud` · `page` · `chime`.

## Hoạt động

Trường chung: `id`, `type`, `sceneId`, `instruction` (≤ 7 từ, đọc to cho trẻ), `teacherPrompts`, `learningObjectives`, `observation`, `sceneOverrides`, `intro`, `outro`.

| `type` | Trường riêng |
|---|---|
| `story_scene` | `timeline` |
| `explore` | `targets` (id thực thể có `label`) |
| `object_identification` … `cause_effect` | `presentation` (`scene`/`cards`), `options[]` (`id`, `label`, `entity` hoặc `visual`), `correctAnswer`, `praise` |
| `sequence` | `cards[]` (`id`, `label`, `visual`), `correctOrder` |
| `sentence_builder` | `blocks[]`, `correctOrder`, `sentence` |
| `story_recall` | `frames[]` (thêm `prompt`) |
| `prediction` | `subject`, `options`, `predictionKey` |
| `experiment` | `outcomes`, `subjects[]` (`entity`, `label`, `result`, `predictionKey`, `timeline`) |
| `classification` | `mode` (`check`/`predict`), `categories`, `items[]` (`category`, `predictionKey`) |

## Nguyên tắc sư phạm (QA cấp 3 — người duyệt kiểm)

- Một nhiệm vụ nhận thức mỗi lần; câu yêu cầu ngắn, có hình đi kèm.
- Không phạt khi sai: lời mời thử lại, không tín hiệu "sai".
- Mỗi hoạt động có câu hỏi gợi ý cho giáo viên — trò chơi tạo tình huống, cô hỏi, trẻ nói.
- Nội dung khoa học phải đúng; tránh gieo ngộ nhận (ví dụ bài nổi/chìm tránh "vật nặng thì chìm").
- Bài `approved`/`published` phải sạch cả cảnh báo QA (câu yêu cầu > 7 từ, vùng chạm nhỏ); bài `draft`/`review` được phép còn cảnh báo.
- Ngôn ngữ phù hợp trẻ 5 tuổi; khuyến khích trả lời cả câu.
