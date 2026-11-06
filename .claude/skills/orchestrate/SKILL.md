---
name: orchestrate
description: Quy trình của Manager Lớp Học Diệu Kỳ cho mọi việc phát triển nhiều bước — chuẩn hoá yêu cầu, chọn module, gọi lead-<module> lấy kế hoạch + phiếu việc, chuyển phiếu cho thợ (song song khi được), gửi báo cáo về lead duyệt, gọi lead-safety khi đụng trẻ/chat/dữ liệu, rồi ship. Dùng khi anh Nam giao tính năng, sửa lỗi lớn, mốc M1+, hoặc phiếu HO. Việc ≤ 2 file rõ ràng thì tự làm, không cần skill này.
effort: medium
---

# Skill: orchestrate (Manager)

Manager chỉ cầm L0: `.claude/CLAUDE.md`, `knowledge/00-overview.md`, `knowledge/protocol.md`. **Không** đọc `knowledge/modules/*` hay code module (để lead làm).

## 1. Chuẩn hoá
Viết BRIEF (định dạng `knowledge/protocol.md`): mục tiêu · vì sao (mốc/HO) · tiêu chí xong · ràng buộc (CONSTITUTION/ADR) · không làm. Thiếu thông tin là **quyết định của anh Nam** (giá, quota, pháp lý, chính sách trẻ em, visual cuối, hosting) → hỏi, không đoán. Thiếu thông tin kỹ thuật → giả định hợp lý, ghi vào brief.

## 2. Chọn module
Theo bảng "Giao việc nhanh" ở `knowledge/00-overview.md`. Nhiều module → mỗi lead một brief; thứ tự theo phụ thuộc hợp đồng (thường school → classroom → world/learning → platform).

## 3. Gọi lead
`Agent(subagent_type: "lead-<module>", prompt: BRIEF)`. Giữ lại **agent id** — mọi báo cáo sau gửi về đúng lead đó bằng `SendMessage`.

## 4. Chuyển phiếu cho thợ
- Dán **nguyên văn** WO cho `subagent_type` ghi trong phiếu. Không thêm ngữ cảnh ngoài phiếu.
- WO `song song: có` → gọi cùng lượt. Thợ code chạy song song trên cùng file → không; tách theo file.
- Thợ trả `NEED_CONTEXT` → chuyển câu hỏi cho lead, không tự đọc code để trả lời.

## 5. Duyệt
`SendMessage(lead id, REPORT…)` → `PASS` thì sang bước 6; `REWORK` → lặp bước 4 với phiếu mới (tối đa 2 vòng, sau đó báo anh Nam); `ESCALATE` → dừng, trình anh Nam.
Phiếu có `cần safety-review: có` hoặc diff đụng chat/tương tác/hiển thị người dùng/dữ liệu trẻ/auth/log → gọi `lead-safety` (skill `safety-review`) trên diff; `UNSAFE` chặn commit.

## 6. Ship
Skill `ship`. Cập nhật `knowledge/00-overview.md` nếu mốc đổi.

## Ngân sách
Mỗi lead: một lượt kế hoạch + tối đa vài lượt duyệt. Không gọi lead chỉ để hỏi điều đã có trong 00-overview. Không spawn agent cho việc tra 1–2 file.
