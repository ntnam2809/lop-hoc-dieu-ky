# ADR-0001 — Monorepo npm workspaces, modular monolith

**Trạng thái:** Accepted · 2026-11-06 · module `platform`

## Bối cảnh
Đề xuất ban đầu liệt kê ~10 app/service. Thực tế: một người + agent, chưa có tải, chưa có server.

## Quyết định
- Một repo, npm workspaces: `apps/*` (thứ chạy được) · `packages/*` (thư viện dùng chung).
- Backend là **một tiến trình** Node (HTTP + WebSocket) chia module theo thư mục, không tách service.
- Thư mục mới chỉ tạo khi có code thật (CONSTITUTION §6.2).

## Phương án đã cân nhắc
Microservices (vận hành nặng, không có lý do đo được) · nhiều repo (đồng bộ type khó) · pnpm/turbo (thêm công cụ; npm đủ ở quy mô này).

## Hệ quả
Một lệnh `npm run check` cho cả repo. Tách service khi số đo (CPU realtime vs API) chứng minh — ghi ADR mới.
