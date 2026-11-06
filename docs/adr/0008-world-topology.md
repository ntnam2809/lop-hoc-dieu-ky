# ADR-0008 — Mỗi trường một campus instance, phòng học là room riêng

**Trạng thái:** Accepted · 2026-11-06 · module `world` + `classroom`

## Quyết định
- Campus của một trường = một room realtime, trần ~40 người (vượt → instance thứ hai cùng trường).
- Vào cửa phòng học = rời room campus, vào room phiên học (chỉ người ghi danh lớp + giáo viên).
- MVP: một template campus (cổng · sân · 2 phòng học). Không hub công cộng, không trường khác.

## Phương án đã cân nhắc
Hub công cộng + campus + room (đề xuất ban đầu — LATER, chỉ khi có moderation) · một room cho cả trường kể cả học (lẫn tải và quyền) · chỉ lobby + phiên học không có campus (mất fantasy R1/R11).
