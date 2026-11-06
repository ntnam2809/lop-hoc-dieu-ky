# ADR-0003 — Client: Phaser cho campus 2D, giữ engine bài học TS thuần, không React trong MVP

**Trạng thái:** Accepted có điều kiện — spike S1 có quyền lật · 2026-11-06 · module `world` + `learning`

## Bối cảnh
Cần thế giới 2D (tilemap, camera, avatar, va chạm, touch) cạnh engine bài học sẵn có (DOM/SVG, sân khấu 1600×900, đồng hồ trung tâm, 9 primitive).

## Quyết định
- **Campus:** Phaser 3 (tilemap Tiled, camera, input chạm/phím, arcade physics) trong app mới `apps/campus` (tạo ở M1).
- **Bài học:** giữ nguyên engine `apps/classroom`, nhúng như "sân khấu bài học" khi vào phòng học (overlay toàn màn hình), không port sang Phaser.
- **UI (chat, bảng giáo viên, form):** TypeScript + DOM thuần như prototype. Không React trong MVP.

## Phương án đã cân nhắc
PixiJS (chỉ renderer, phải tự viết tilemap/camera/input) · Canvas tự viết (rẻ ban đầu, đắt về sau) · Godot web export (bundle lớn, hai ngôn ngữ) · React cho UI (hai mô hình UI, công tích hợp).

## Tiêu chí S1 để giữ quyết định
Tablet tầm trung chạy campus ≥ 50 fps với 30 avatar · bundle campus gzip ≤ 1,5 MB · chuyển campus ↔ sân khấu bài học không rò bộ nhớ sau 10 lần. Trượt → ghi ADR thay thế.

## Xem lại khi
Có dashboard quản trị nhiều form/bảng (Phase 3) → xét React riêng cho app admin.
