# ADR-0012 — Đội agent phân cấp manager → lead → thợ

**Trạng thái:** Accepted · 2026-11-06 · chi tiết: `knowledge/README.md`, `knowledge/protocol.md`

## Bối cảnh
Anh Nam yêu cầu không agent nào nạp toàn bộ ngữ cảnh. Ràng buộc kỹ thuật của Claude Code: **subagent không spawn được subagent**.

## Quyết định
- **Manager** = phiên chính. Chỉ nạp L0 (`CLAUDE.md`, `knowledge/00-overview.md`). Phân loại việc, gọi lead, chuyển phiếu, commit/PR.
- **Lead** = subagent một module (`.claude/agents/lead-*.md`). Nạp L1 (`knowledge/modules/<m>.md` + ADR của module). Lập kế hoạch module → **phiếu việc (Work Order)** tự đủ; duyệt báo cáo thợ. Không viết code.
- **Thợ** = subagent hẹp (`implementer`, `content-author`, `test-runner`, `code-scout`, `guard-reviewer`). Chỉ nạp L2: đúng file trong phiếu.
- Vì lead không spawn được thợ: lead trả phiếu → manager chuyển nguyên văn cho thợ → manager gửi báo cáo thợ về **cùng lead** bằng `SendMessage` (lead giữ ngữ cảnh) → lead duyệt PASS/REWORK.
- Việc nhỏ (≤ 2 file, rõ ràng) manager tự làm, không qua lead.

## Hệ quả
Ngữ cảnh mỗi agent nhỏ; manager trả phí chuyển tiếp phiếu (văn bản ngắn). Knowledge module phải luôn được lead cập nhật sau mỗi việc.
