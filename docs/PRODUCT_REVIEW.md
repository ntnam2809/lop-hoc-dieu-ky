# Product Review — HO-0012: Lớp Học Diệu Kỳ thành Trường Học Online

**Trạng thái:** review xong, đã init phần không cần owner input · **Ngày:** 2026-11-06
**Nguồn yêu cầu:** [`00-ORIGINAL-USER-PROMPT.md`](00-ORIGINAL-USER-PROMPT.md) (nguyên văn) · đề xuất của Talia: [`proposals/HO-0012/`](proposals/HO-0012/) (đầu vào để phản biện, chưa phải quyết định)
**Kết quả:** thiết kế chính thức [`DESIGN.md`](DESIGN.md) · quyết định [`DECISIONS.md`](DECISIONS.md) · MVP [`MVP.md`](MVP.md) · an toàn [`SAFETY.md`](SAFETY.md) · migration [`MIGRATION.md`](MIGRATION.md)

---

## 1. Discovery — repo thật đang có gì

| Hạng mục | Thực tế khảo sát | Hệ quả |
|---|---|---|
| Repo `lop-hoc-dieu-ky` (`main`, 3 commit) | **Chỉ chứa bản build tĩnh**: `index.html` + 107 file trong `assets/` (JS minify, CSS, font, SVG) + `.nojekyll`. Không `package.json`, không source, không test | GitHub Pages đang phục vụ từ gốc `main`. Không được dời/xoá các file này (CONSTITUTION §5) |
| Source thật | `neutrino-verse-studio/edu-platform/` (commit `9526753`, 2026-10-02): Vite 8 + TypeScript thuần (không framework UI), engine dữ liệu hoá, zod schema, validator, scaffold/approve/publish, Firebase source, vitest + Playwright, ~4.500 dòng TS | Engine tốt, tái dùng được — không rewrite. Đã chép nguyên vào `apps/classroom/` |
| Lệch source ↔ bản deploy | Commit `e995268` (2026-10-06) thêm 4 bài (*Cô bé quàng khăn đỏ, Trâu trắng và trâu đen, Bắp cải tím đổi màu, Hạt gạo nhảy múa*) + sửa hiệu ứng show/fade **chỉ ở dạng build**. Source tương ứng không có ở repo nào trong phiên | Đã khôi phục dữ liệu 4 bài + catalog từ bundle (`apps/classroom/content/recovered/`). Chúng cần schema/engine mới hơn (tham số `$x` cho `ms`/`to`, loại asset `liquid`, `layers` rỗng) → chưa đưa vào build; việc port nằm ở M1 |
| Firebase | Có `firestore.rules`, `storage.rules`, `FirebaseContentSource`, `publish.ts`; **chưa chạy với project thật** (theo `architecture.md`) | Firebase chỉ là kho nội dung đọc-công-khai, không có auth/realtime/ghi từ client → không đủ cho trường học online, nhưng không cần bỏ |
| Kiểm thử | Sau migration: `validate` ✓ (2 bài) · `typecheck` ✓ · vitest 14/14 · `build` ✓ · Playwright 3/3 (sau khi sửa đường dẫn Chromium) | Nền xanh để xây tiếp |
| Mô hình sử dụng hiện tại | **Một màn hình lớn, giáo viên dẫn**, trẻ 5 tuổi chạm/kéo/nói. Không tài khoản, không mạng khi chạy | Khác căn bản với "game online nhập vai" — xem phản biện P1 |

## 2. Tách yêu cầu cứng khỏi ý tưởng bổ sung

Mỗi dòng prompt gốc → cách hiểu → phân loại → quyết định. **MUST** = prompt yêu cầu · **SHOULD** = đề xuất hữu ích · **LATER** = ngoài MVP · **OWNER** = cần anh Nam quyết.

| # | Prompt gốc (trích) | Cách hiểu | Loại | Quyết định | Lý do |
|---|---|---|---|---|---|
| R1 | "Game 2D online mạng xã hội nhập vai, giáo dục" | Thế giới 2D nhiều người, avatar, giáo dục là lõi | MUST | **Giữ** — campus 2D nhiều người trong MVP | Đây là fantasy cốt lõi; không được biến thành LMS có avatar |
| R2 | "tạo 1 trường học theo loại mẫu giáo, tiểu, trung, đại học" | Trường có `level` 4 loại | MUST | **Giữ mô hình 4 loại**, MVP chỉ *vận hành* mẫu giáo | Data model có sẵn `SchoolLevel`; nội dung hiện có chỉ cho 5 tuổi |
| R3 | "tạo 1 lớp mới như học sinh hoặc tham gia trường lớp có sẵn" | Câu mơ hồ: (a) tạo lớp mới, hoặc (b) vào lớp có sẵn với vai học sinh | MUST + OWNER (Q-06) | **Giả định A-06:** lớp chỉ tồn tại trong trường; học sinh vào lớp có sẵn | Lớp không thuộc trường phá mô hình quyền hiệu trưởng → giáo viên |
| R4 | "chủ trường là role hiệu trưởng có thể cấp phép chủ lớp là giáo viên mở lớp" | Người lập trường = hiệu trưởng; hiệu trưởng cấp vai giáo viên; giáo viên mở lớp | MUST | **Giữ nguyên** — đã code + test (`grantTeacher`, `createClass`) | Lõi của vòng đời |
| R5 | "có limit trường và limit học sinh" | Quota số trường, sĩ số | MUST | **Giữ cơ chế**, số là placeholder (`plans.ts`) | Cơ chế cần cho chi phí & an toàn; con số là quyết định thương mại (Q-03) |
| R6 | "account free thì chỉ làm học sinh hay giáo viên với lớp nhỏ" | Free: học sinh, hoặc giáo viên lớp nhỏ; **không lập trường** | MUST | **Giữ** — free `maxOwnedSchools = 0`, `maxClassSize = 10` (placeholder) | Bám sát chữ của prompt; Talia để ngỏ "free lập trường?" → prompt đã trả lời: không |
| R7 | "Giáo viên có thể tự mở phiên học và giáo trình học có sẵn pattern của game" | Phiên học trực tiếp dùng bài dựng sẵn | MUST | **Giữ** — `startSession` + bài có sẵn của engine | Engine hiện có 9 primitive = "pattern của game" |
| R8 | "account có phí thì có thể tự tạo bài học" | Lesson authoring cho gói trả phí | MUST (dài hạn) | **LATER** — cờ `canAuthorLessons` giữ chỗ | Cần moderation nội dung người dùng tạo + thanh toán; quá lớn cho MVP |
| R9 | "khung chat kiểu livestream" | Panel chat chạy dọc cạnh sân khấu bài học | MUST + OWNER (Q-08) | **Giữ dạng an toàn**: panel chat phiên học, trẻ chỉ câu/sticker | "Livestream" có thể ngụ ý video giáo viên — giả định A-08: không video trong MVP |
| R10 | "lên idea hoàn chỉnh hơn" | Mở rộng concept | SHOULD | Thiết kế ở `DESIGN.md`, phân tầng theo roadmap | — |
| R11 | "Player có thể đi vòng vòng tương tác" (câu bỏ dở) | Đi lại tự do trong campus, tương tác vật/người | MUST (phần rõ) | **Giữ**: đi lại + emote + tương tác vật. Phần bị cắt **không suy diễn** | Prompt dừng giữa câu; mọi tương tác thêm là giả định A-11 |

## 3. Phản biện — đề xuất | vấn đề | phương án | quyết định | hậu quả

| # | Đề xuất ban đầu (Talia) | Vấn đề | Phương án thay thế | Quyết định đề nghị | Hậu quả |
|---|---|---|---|---|---|
| P1 | MVP là "trường mẫu giáo online" với avatar đi lại, chat | **Trẻ 5 tuổi không tự đăng nhập, đọc, gõ, điều hướng thế giới mở.** Prototype được thiết kế cho *màn hình lớn do cô điều khiển*. Social world thật sự hợp tiểu học trở lên | (a) Chọn tiểu học làm slice đầu — nhưng không có nội dung; (b) Mầm non với **hồ sơ trẻ do cô tạo**, vào lớp bằng mã + chọn hình, tablet có người lớn bên cạnh, cô điều nhịp | **(b)** cho MVP; ghi Q-01 để anh Nam chọn đối tượng thật cho pilot | Giữ được nội dung sẵn có và vòng đời; tính năng xã hội của trẻ bị giới hạn mạnh (đúng ý) |
| P2 | Ba trụ cột Social + Learning + Creation ngay từ đầu | MMO xã hội + LMS + SaaS trường học = ba sản phẩm; một người làm không kham nổi | Chọn **Learning trong không gian Social** làm lõi; Creation chỉ ở mức lập trường/lớp | Trụ cột Creation (campus builder, lesson creator, marketplace) → LATER | Phạm vi vừa sức; roadmap vẫn giữ đường lên |
| P3 | Hybrid world: hub công cộng + campus nhiều instance + thăm trường khác | Hub công cộng trộn trẻ với người lạ — rủi ro an toàn lớn nhất; cần moderation 24/7 | Lobby/hub chỉ cho người lớn; hoặc bỏ hub | **MVP: mỗi trường một campus instance (giới hạn ~40 người) + phòng học là room riêng. Không hub, không thăm trường khác** | Mất cảm giác "thế giới lớn" lúc đầu; đổi lại không có đường để người lạ gặp trẻ |
| P4 | Tìm kiếm & đăng ký trường/lớp công khai | Danh bạ công khai cho người lạ biết trường nào có trẻ, lớp nào đang mở | Mã vào lớp do giáo viên chia sẻ trực tiếp | **Không có danh bạ trong MVP**; `enrollWithCode` | Bước 4 hành trình đổi từ "C tìm trường" thành "C nhận mã từ cô" |
| P5 | Free teacher mở lớp public nhỏ | Giáo viên chưa xác minh + lớp công khai = kênh tiếp cận trẻ | Giáo viên chỉ được cấp vai bởi hiệu trưởng; lớp chỉ vào bằng mã | Free teacher **có**, nhưng chỉ trong trường đã cấp vai (prompt R6 vẫn giữ) | Free teacher không tự lập lớp độc lập (Q-06/Q-07) |
| P6 | Quota theo bảng Free/Teacher Pro/School Pro | Số liệu chưa có cơ sở chi phí; School Pro có bao gồm Teacher Pro? | Quota theo *gói của chủ trường* cộng gói giáo viên | **Giả định A-07:** sức chứa = mức cao hơn giữa gói giáo viên và gói chủ trường; mọi con số là placeholder; gói `pilot` cấp tay, không thanh toán | Không khoá giá; đổi số chỉ sửa `plans.ts` |
| P7 | Chat livestream + proximity chat + group chat + friend messaging | Mỗi kênh chat là một bề mặt quấy rối cần moderation | Một kênh duy nhất: chat phiên học, có chế độ do giáo viên đặt | **MVP chỉ chat trong phiên học**: `off/phrases/open`, trẻ luôn chỉ câu/sticker, rate limit, ẩn tin, báo cáo | Không có chat ở sân trường cho trẻ — dùng emote thay |
| P8 | Phaser + **React** cho dashboard/chat/admin | Prototype là TS thuần + DOM/SVG; thêm React = hai mô hình UI + công tích hợp | Vanilla TS cho UI MVP; xét React khi có dashboard thật (Phase 3) | **Không React trong MVP** (ADR-0003) | Bundle nhỏ hơn; nếu UI admin phình thì xét lại |
| P9 | WebSocket "server-authoritative" chưa nói công cụ | Tự viết netcode tốn công; managed service (Firebase RTDB) không có logic server | Colyseus (room, state sync, reconnect) · raw `ws` · Cloudflare Durable Objects | **Colyseus là ứng viên, kiểm bằng spike S1** trước khi khoá; lõi domain độc lập transport nên đổi rẻ | Có một vòng spike trước khi dựng server thật |
| P10 | Live classroom: giáo viên điều khiển slide, quiz, chia nhóm… | Engine hiện chạy cục bộ một màn hình | **Mô hình "theo nhịp cô"**: mỗi client chạy engine bài học, server phát lệnh hoạt động hiện tại (`setActivity`), học sinh nộp kết quả lên server | Giữ engine, thêm chế độ đồng bộ (M3) | Không cần stream video/màn hình; chia nhóm, poll → LATER |
| P11 | RPG progression EXP / Contribution / Star Coin | Ba loại điểm = nền kinh tế cần cân bằng, dễ thành thao túng với trẻ | Chỉ huy hiệu hoàn thành bài (không điểm số) | **LATER**; MVP không có tiền tệ, không xếp hạng | Thiếu "vị game" lúc đầu — bù bằng tương tác campus |
| P12 | Lesson Creator, AI Lesson Assistant, marketplace | Nội dung người dùng tạo cho trẻ cần duyệt chuyên môn + moderation + license | Giữ pipeline hiện có: AI soạn → `review` → người duyệt → publish | LATER; khi làm phải qua đúng pipeline duyệt | Prompt R8 được giữ ở roadmap Phase 3 |
| P13 | Cấu trúc `apps/game-client, school-admin, teacher-dashboard, services/api, realtime, content-engine…` | Tạo 10 thư mục trước khi có code = nợ bảo trì | Tạo khi cần | **Hiện có đúng:** `apps/classroom` (đã có code), `packages/domain` (đã có code). `apps/server`, `apps/campus` tạo ở M2/M1 | Cây repo khớp code thật |
| P14 | Firebase hiện có | Không auth thật, không realtime authoritative | Giữ Firebase làm kho nội dung (đọc công khai); server riêng cho trường/lớp/phiên | ADR-0004/0010 | Không phá đường xuất bản nội dung đã viết |

## 4. Khả thi — một người + agent

| Yếu tố | Đánh giá |
|---|---|
| Phạm vi | Vertical slice khả thi trong ~4 mốc (M0–M3) nếu giữ đúng non-goals. Toàn bộ tầm nhìn (4 cấp, kinh tế, marketplace) là nhiều năm công |
| Chi phí vận hành | MVP: một tiến trình Node nhỏ + Postgres nhỏ + static hosting — mức chi phí thấp; con số cụ thể phụ thuộc nhà cung cấp (Q-04), không bịa |
| Độ trễ | Lớp mầm non ≤ 40 người/room, cập nhật vị trí ~10 Hz — nằm trong khả năng một tiến trình Node; S1 sẽ đo thật |
| Scale | Không thiết kế cho MMO. Tách theo room/instance là đủ đến khi có số đo |
| Moderation | Rủi ro vận hành lớn nhất: chat người lớn tự do cần người xử lý báo cáo. MVP né bằng mặc định câu/sticker |
| An toàn trẻ em & pháp lý | **Chặn mọi pilot có trẻ thật** cho tới khi Q-02 được trả lời (đồng ý của phụ huynh, thị trường, dữ liệu) |

## 5. Rủi ro chính

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Source bản deploy bị mất (engine delta + 4 bài) | Cao, đã xảy ra | Đã khôi phục dữ liệu; port engine ở M1; từ nay source sống ở repo này, CI build |
| Concept quá rộng, làm dàn trải | Cao | Non-goals cứng trong `MVP.md`; lead chỉ nhận việc trong module |
| Trẻ gặp người lạ / nội dung xấu | Cao | `SAFETY.md`: không hub, không danh bạ, chat câu duyệt sẵn, vai do người có thẩm quyền cấp |
| Netcode tốn hơn dự kiến | Trung bình | Spike S1 có tiêu chí dừng; lõi domain độc lập transport |
| Hai nơi chứa source (studio + repo này) | Trung bình | Q-09: đóng băng `edu-platform` bên studio sau khi PR này merge |
| Pháp lý dữ liệu trẻ em | Cao trước launch | Q-02; không tuyên bố tuân thủ |

## 6. MVP đề nghị (tóm tắt — chi tiết ở `MVP.md`)

Một trường mầm non, campus nhỏ (cổng · sân · 2 phòng học), ba vai (hiệu trưởng · giáo viên · học sinh), học sinh mầm non là hồ sơ do cô tạo, vào bằng mã lớp; giáo viên mở phiên học bài *Nổi hay chìm?*, điều nhịp hoạt động; học sinh dự đoán/tương tác/trả lời trên thiết bị của mình; kết quả lưu server; chat phiên học dạng câu/sticker. **Phần prompt vẫn được bảo toàn:** R1, R2 (mô hình), R4, R5, R6, R7, R9, R11. **Bị hoãn có lý do:** R8 (tự tạo bài), phần "nhập vai" sâu (kinh tế, tiến trình).

## 7. Đã init trong lượt này (không cần owner input)

- Monorepo npm workspaces · `apps/classroom` (prototype source, xanh đủ bộ) · `packages/domain` (vòng đời trường→lớp→phiên→kết quả + chat an toàn + kiểm toán, 18 test).
- CONSTITUTION · tài liệu thiết kế · ADR · knowledge base phân tầng · đội agent manager/lead/thợ · skill · CI.
- **Chưa làm (cố ý):** server mạng, campus 2D, auth thật, Postgres — chờ spike S1 và Q-04.

## 8. Câu hỏi cho anh Nam

Danh sách đầy đủ, phân biệt blocker/không blocker: [`DECISIONS.md` › Câu hỏi chủ dự án](DECISIONS.md#câu-hỏi-chủ-dự-án).
