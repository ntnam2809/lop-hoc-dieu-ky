# Knowledge base — nạp theo tầng, không ai nạp hết

> Mục tiêu: mỗi agent chỉ cầm đúng ngữ cảnh vai mình (CONSTITUTION §7.1, ADR-0012). Sửa file nào thì giữ trần dòng của tầng đó.

| Tầng | Ai nạp | File | Trần |
|---|---|---|---|
| **L0 — tổng quan** | Manager (phiên chính) | `.claude/CLAUDE.md` · `knowledge/00-overview.md` · `knowledge/protocol.md` | mỗi file ≤ 80 dòng |
| **L1 — module** | Lead của module | `knowledge/modules/<module>.md` + ADR liệt kê trong đó + `knowledge/protocol.md` | module ≤ 100 dòng |
| **L2 — việc** | Thợ | Chỉ những file phiếu việc (Work Order) ghi tên | do phiếu quy định |
| Tham chiếu | Khi cần, đọc khoanh vùng | `docs/*` (thiết kế, review, safety…) · `docs/adr/*` · `knowledge/glossary.md` | — |

## Ai đọc gì
- **Manager** không đọc `knowledge/modules/*` hay code của module, trừ việc nhỏ tự làm (≤ 2 file). Muốn biết module → hỏi lead.
- **Lead** không đọc module khác. Cần giao diện module khác → đọc mục **Hợp đồng** trong file module đó (chỉ mục đó).
- **Thợ** không tự mở rộng phạm vi đọc; thiếu ngữ cảnh → báo `NEED_CONTEXT` trong báo cáo, không đoán.

## Module & lead

| Module | Lead | Sở hữu |
|---|---|---|
| [school](modules/school.md) | `lead-school` | danh tính, trường, vai, lớp, ghi danh, gói |
| [classroom](modules/classroom.md) | `lead-classroom` | phiên học trực tiếp, điều nhịp, kết quả, chat phiên |
| [world](modules/world.md) | `lead-world` | campus 2D, avatar, di chuyển, instance, presence |
| [learning](modules/learning.md) | `lead-learning` | engine bài học, primitive, gói bài, pipeline nội dung |
| [safety](modules/safety.md) | `lead-safety` | chính sách an toàn, moderation, riêng tư, kiểm toán (duyệt chéo mọi module) |
| [platform](modules/platform.md) | `lead-platform` | monorepo, build, CI, server bootstrap, lưu trữ, deploy, quan sát |

## Bảo trì
Lead cập nhật file module của mình sau mỗi việc (mục *Trạng thái*, *Việc kế tiếp*). Manager cập nhật `00-overview.md` khi mốc đổi. Sự thật hiện hành — sửa thẳng, không ghi "trước đây…".
