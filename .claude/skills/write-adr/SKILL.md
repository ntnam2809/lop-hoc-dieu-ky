---
name: write-adr
description: Viết hoặc cập nhật một Architecture Decision Record cho Lớp Học Diệu Kỳ (docs/adr/NNNN-<slug>.md) và chỉ mục docs/DECISIONS.md — bối cảnh, quyết định, phương án đã cân nhắc, hệ quả, tiêu chí xem lại. Dùng khi một lựa chọn kỹ thuật có trade-off, khi spike lật/khoá một ADR, hoặc khi anh Nam trả lời một câu Q-xx. KHÔNG dùng để chốt giá/quota/pháp lý thay anh Nam.
effort: medium
---

# Skill: write-adr

1. Số kế tiếp = số lớn nhất trong `docs/adr/` + 1. Slug tiếng Anh ngắn, kebab-case.
2. Khung (≤ 40 dòng):
   ```
   # ADR-NNNN — <tiêu đề tiếng Việt>
   **Trạng thái:** Proposed | Accepted | Accepted có điều kiện (<điều kiện>) | Superseded by ADR-XXXX · <ngày> · module `<m>`
   ## Bối cảnh   (sự thật, số đo nếu có — không bịa số)
   ## Quyết định
   ## Phương án đã cân nhắc   (mỗi phương án một lý do loại)
   ## Hệ quả
   ## Xem lại khi
   ```
3. Thay ADR cũ: sửa trạng thái ADR cũ thành `Superseded by ADR-NNNN`, không xoá nội dung cũ của ADR (ADR là nhật ký quyết định — ngoại lệ duy nhất của "sửa thẳng").
4. Cập nhật bảng ADR trong `docs/DECISIONS.md`; câu Q-xx đã được trả lời → chuyển giả định A-xx tương ứng thành quyết định, ghi ngày.
5. ADR đụng luật bất biến → cần anh Nam duyệt + sửa `CONSTITUTION.md` cùng PR.
6. Báo lead của module liên quan cập nhật mục ADR trong `knowledge/modules/<m>.md`.
