# Art bible

Mọi hình ảnh — vector tạm hiện có lẫn ảnh GPT Image sau này — phải trông như cùng một quyển sách tranh.

## Phong cách

| Hạng mục | Quy định |
|---|---|
| Tổng thể | Tranh sách thiếu nhi, khối tròn mềm, ấm áp, thân thiện; độ phức tạp thấp, đọc rõ từ cuối lớp |
| Nét viền | Nâu đậm ấm `#5A3B2E`, dày đều (≈ 2% chiều cao vật), đầu và góc nét tròn |
| Màu | Pastel ấm, bão hoà vừa; mỗi khối = 1 màu nền + 1 tông bóng nhạt + 1 điểm sáng trắng |
| Ánh sáng | Nguồn sáng dịu từ trên-trái; không bóng gắt; bóng đổ dưới chân là elip mờ (nâu 14%) |
| Nhân vật | Tỉ lệ đầu : thân ≈ 1 : 1,2; mắt to bóng có 2 đốm sáng; má hồng; biểu cảm hiền, không nhe răng, không đáng sợ |
| Đồ vật | Hình khối đơn giản, dễ nhận ra ngay; không chi tiết thừa |
| Phông nền | 16:9, nhiều lớp chiều sâu (trời – đồi xa – cây – mặt đất); để trống vùng đất phía trước cho nhân vật; không chữ |
| Khung hình | Nhân vật/đồ vật: toàn thân, chính giữa, nền trong suốt, có khoảng thở |
| Cấm | Chữ trong ảnh, logo, bạo lực, chi tiết rùng rợn, phong cách quá hiện thực, màu neon chói |

Bảng màu tham chiếu: trời `#9EDBFF` · cỏ `#8CCB6A` · nước `#4DB3EC` · táo `#F0453A` · cam cáo `#F58A45` · vàng `#FFC94A` · kem `#FFF8EC`.

## Đặt tên & quản lý

`{domain}_{topic}_{assetType}_{name}_{vNN}` — ví dụ `language_story_character_rabbit_v01`. Loại: `character` · `object` · `background` · `icon` · `overlay` · `audio`. Chất lỏng đặt tên với loại `liquid` (vd `science_cabbage_liquid_purple_v01`); trong manifest `type` vẫn là `object`.

Trong `assets.json`, mỗi asset có `prompt` (mô tả chủ thể) và `status`: `placeholder` (vector tạm) → `generated` (GPT Image, chưa duyệt) → `approved`. Thay ảnh = tăng version (`_v02`), cập nhật `file`, giữ nguyên `id` cũ trong các bài đã xuất bản hoặc cập nhật tham chiếu.

## Prompt chuẩn GPT Image

```
Children's picture-book illustration for 5-year-olds. Soft rounded shapes, warm dark-brown
outline (#5A3B2E) of even weight, flat warm-pastel colors with one gentle shade and a small
white highlight, soft light from the top-left, friendly and calm, low detail, no text.
{framing}
Subject: {prompt trong assets.json}
```

`{framing}`: nhân vật/đồ vật → `Full body, centered, transparent background, generous padding.` · phông nền → `Wide 16:9 scene, layered depth, empty foreground ground area for characters.` · lớp phủ → `Transparent PNG overlay.`

## Bộ phận chuyển động (tuỳ chọn, chỉ với SVG)

Engine tự tạo chuyển động toàn thân cho mọi ảnh (cả PNG). Với SVG, có thể gắn class cho nhóm bộ phận để nhân vật "sống" hơn:

| Class | Chuyển động |
|---|---|
| `blink` | Mắt chớp (nhóm cả hai mắt) |
| `ear-l`, `ear-r` | Tai giật nhẹ, xoay quanh chân tai |
| `tail` | Đuôi ve vẩy, xoay quanh góc dưới-trái |
| `wing` | Cánh vỗ |
| `sway`, `sway-slow` | Cây/hoa đung đưa quanh gốc |
| `drift`, `drift-2` | Mây trôi |
| `rays` | Tia nắng xoay chậm |
| `wave`, `wave-2` | Sóng nước trượt ngang |
| `shimmer`, `twinkle`, `glint` | Lấp lánh |
| `float`, `steam` | Dập dềnh, khói bay |

SVG được làm sạch khi nạp (bỏ script, handler, liên kết ngoài) và đổi id nội bộ theo từng bản sao.
