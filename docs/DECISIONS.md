# Decisions — chỉ mục ADR · giả định · câu hỏi chủ dự án

> File này là **chỉ mục**. Mỗi ADR một file ở [`adr/`](adr/); lead chỉ đọc ADR thuộc module mình. Thêm ADR bằng skill `write-adr`.
> Trạng thái: `Proposed` (đề xuất) · `Accepted` (đã chốt) · `Accepted có điều kiện` (spike có quyền lật) · `Superseded by ADR-NNNN`.

## ADR

| ADR | Chủ đề | Trạng thái | Module |
|---|---|---|---|
| [0001](adr/0001-modular-monolith-monorepo.md) | Monorepo npm workspaces, modular monolith | Accepted | platform |
| [0002](adr/0002-preserve-prototype-deploy.md) | Giữ deploy prototype ở gốc; source về `apps/classroom` | Accepted | platform · learning |
| [0003](adr/0003-client-engine.md) | Phaser cho campus · giữ engine bài học · không React MVP | Accepted có điều kiện (S1) | world · learning |
| [0004](adr/0004-backend-realtime-persistence.md) | Node 22 · realtime theo room (Colyseus ứng viên) · Postgres | Accepted hướng; thư viện sau S1 | platform · world · classroom |
| [0005](adr/0005-auth-child-guardian.md) | Người lớn có tài khoản · trẻ là hồ sơ được quản lý | Accepted MVP; phụ huynh chờ Q-02 | school · safety |
| [0006](adr/0006-identity-role-model.md) | Danh tính ≠ thành viên ≠ ghi danh ≠ gói; vai có phạm vi | Accepted | school |
| [0007](adr/0007-safety-defaults.md) | Mặc định an toàn MVP | Accepted | safety |
| [0008](adr/0008-world-topology.md) | Mỗi trường một campus instance; phòng học là room riêng | Accepted | world · classroom |
| [0009](adr/0009-entitlements-no-payment.md) | Quyền lợi theo gói, không thanh toán | Accepted | school |
| [0010](adr/0010-content-schema.md) | Gói bài hiện có là hợp đồng nội dung | Accepted | learning |
| [0011](adr/0011-hosting-deploy.md) | Hosting & deploy | Proposed (Q-04) | platform |
| [0012](adr/0012-agent-hierarchy.md) | Đội agent manager → lead → thợ | Accepted | (toàn repo) |
| [0013](adr/0013-observability.md) | Quan sát không thu dữ liệu cá nhân trẻ | Proposed (M2) | platform · safety |
| [0014](adr/0014-two-spaces-adult-first.md) | Hai không gian: trường chơi người lớn ↔ tổ chức có thật cho trẻ | Accepted (phương châm 2026-11-06) | school · safety · world |
| [0015](adr/0015-livestream-streamer-mode.md) | Livestream TikTok bởi người lớn, streamer mode | Accepted hướng; API TikTok LATER | world · classroom · safety |

## Giả định đang dùng (đổi được khi anh Nam trả lời)

| Id | Giả định | Gắn với |
|---|---|---|
| A-01 | ~~Đối tượng slice đầu~~ → đã quyết: người lớn chơi trước (MVP-A), trẻ lớp Lá qua tổ chức thật sau (MVP-B) | Q-01 ✓ |
| A-06 | Lớp chỉ tồn tại trong trường; học sinh vào lớp có sẵn | Q-06 |
| A-07 | Sức chứa lớp = mức cao hơn giữa gói giáo viên và gói chủ trường | Q-03 |
| A-08 | "Chat kiểu livestream" = panel chat chạy dọc cạnh sân khấu bài học; không video | Q-08 |
| A-11 | "Đi vòng vòng tương tác" = đi lại tự do + emote + chạm vật trong campus. Phần prompt bị cắt không suy diễn | — |
| A-12 | Số trong `plans.ts` là placeholder kỹ thuật | Q-03 |

## Câu hỏi chủ dự án

**Blocker** = chặn một mốc cụ thể. Không có câu nào chặn lượt init này.

| Id | Câu hỏi | Blocker? | Đề xuất của em |
|---|---|---|---|
| Q-01 | ✓ **Đã trả lời 2026-11-06:** phụ huynh chơi trước bằng RPG; trẻ tham gia qua tổ chức có thật do giáo viên thật quản lý; trẻ mẫu giáo không là chủ tài khoản → ADR-0014 | — | — |
| Q-02 | Còn lại sau phương châm: tổ chức lấy đồng ý của phụ huynh thế nào (giấy tờ của trường hay trong app), ai chịu trách nhiệm dữ liệu trẻ (tổ chức hay nền tảng), lưu/xoá ra sao, thị trường phát hành, có ai tư vấn pháp lý | **Chặn MVP-B** (M4); không chặn MVP-A | Hợp đồng với tổ chức: tổ chức giữ đồng ý của phụ huynh, nền tảng xử lý dữ liệu theo hợp đồng — cần luật sư xác nhận |
| Q-03 | Bậc gói, quota, giá; School Pro có gồm Teacher Pro không | Không (placeholder) | Chờ có số liệu chi phí từ staging |
| Q-04 | Nhà cung cấp hosting server + Postgres, ngân sách tháng, ai giữ tài khoản | Chặn staging online (M3) | Một container nhỏ + Postgres managed, vùng gần Việt Nam |
| Q-05 | Chuyển nhượng chủ trường, phó hiệu trưởng, trợ giảng, đóng trường thì dữ liệu đi đâu | Không | LATER |
| Q-06 | "tạo 1 lớp mới như học sinh" nghĩa là gì — học sinh tự lập lớp/nhóm học? | Không (A-06) | Nếu có: "nhóm học" do học sinh lập trong trường, giáo viên duyệt — LATER |
| Q-07 | Giáo viên free có được mở lớp nhỏ **không cần trường** (lớp cá nhân)? | Không | Chưa — mọi lớp dưới một trường để giữ chuỗi cấp quyền |
| Q-08 | "Livestream" có cần video/giọng giáo viên không? | Không (A-08) | Không trong MVP; xét phát giọng một chiều của giáo viên sau |
| Q-09 | Đóng băng `neutrino-verse-studio/edu-platform/` (source cũ) sau khi PR này merge? Talia thêm repo này vào router (`tools/router.py` REPOS) + bí danh `@edu`? | Không | Có cho cả hai — tránh hai nơi chứa source |
| Q-10 | Duyệt port engine delta để đưa 4 bài khôi phục trở lại build (M1)? | Không | Có — trước khi cutover deploy |
| Q-11 | Repo đang public (Pages)? Tài liệu thiết kế công khai có ổn không? | Không | Ổn nếu không có dữ liệu thật; tách repo private khi có dữ liệu người dùng |
| Q-12 | Vòng chơi RPG cho người lớn: khung ở `DESIGN.md` §8 (nhập vai vòng đời trường, chuỗi nhiệm vụ, EXP, trang phục, "nhìn như con") có đúng hướng anh muốn không? Có cần minigame giải trí riêng ngoài bài học không? | Chặn thiết kế chi tiết M3 | Duyệt khung; em soạn bản nhiệm vụ đầu tiên ở M3 |
| Q-13 | Xác minh tổ chức có thật: cần giấy tờ gì, ai duyệt, có hợp đồng không | **Chặn MVP-B** | Duyệt tay bởi đội vận hành + hợp đồng thử nghiệm với tổ chức đầu tiên |
| Q-14 | Livestream: tài khoản TikTok chính thức, ai phát, kịch bản, có cần đưa bình luận TikTok vào game không | Không chặn code; chặn kế hoạch quảng bá | Phát bằng streamer mode ở campus trải nghiệm; tích hợp bình luận để sau |
| Q-15 | Phụ huynh đã chơi ở trường chơi có được liên kết với hồ sơ con trong tổ chức (xem tiến độ) không | Không (Phase 2) | Có, nhưng chỉ khi tổ chức xác nhận liên kết; phụ huynh không vào lớp có trẻ |
