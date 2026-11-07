# Module `classroom` — phiên học trực tiếp · điều nhịp · kết quả · chat phiên (L1)

**Lead:** `lead-classroom` · **ADR:** 0004, 0007, 0008, 0010 · **Luật:** CONSTITUTION §1, §2.3, §2.5, §3

## Sứ mệnh
Biến một bài học thành buổi học chung: giáo viên điều nhịp, học sinh tương tác trên thiết bị mình, server ghi kết quả tin cậy, chat kiểu livestream an toàn.

## Sở hữu
- `packages/domain/src/service.ts` — mục *phiên học trực tiếp*, *chat an toàn*, *xem dữ liệu theo quyền*
- `packages/domain/src/chat.ts` — `checkChat`, `RateLimiter`, `DEFAULT_CHAT_CATALOG` (luật do safety duyệt)
- `packages/domain/src/grading.ts` · `session-plan.ts` · service mục *kế hoạch phiên*
- `packages/domain/test/chat.test.ts`, `journey.test.ts` (bước 5–10), `grading.test.ts`, `session-plan.test.ts`, `session.test.ts`
- M2+: room phiên học trong `apps/server/src/rooms/session-room.ts` · M3: chế độ "theo nhịp cô" phía client (phối hợp learning)

## Không thuộc
Engine/primitive bài học (→ learning) · campus/di chuyển (→ world) · luật vai (→ school, chỉ gọi `canManageClass`).

## Hợp đồng
- `startSession(actor, classId, lessonId, {planId?}) · joinSession · setActivity · submitResult · endSession`
- `createSessionPlan · updateSessionPlan · sessionPlan · listSessionPlans` (chỉ người lớn teacher/principal của đúng trường; bài của plan cố định)
- `setChatMode · sendChat · chatLog · hideMessage · report`
- `classProgress · myProgress · schoolReports · schoolAudit`
- Chấm: `ServiceDeps.lessons = lessonLookupFrom(packs.map(answerKeysFromPackage))` → `createGrader`. Thiếu `lessons` → mọi kết quả `recorded`.
- `Grader = (lessonId, activityId, raw) => {outcome, response: NormalizedResponse}`. Response chuẩn hoá chỉ còn id: `choice{optionId}` · `order{ids}` · `placements{placements}` · `done`. Sai dạng → INVALID, không lưu.
- Trẻ chỉ nhận `toStudentAck(result) = {activityId, feedback: praise|try_again|thanks}`. Không gửi `ActivityResult`/outcome thô.
- `Store.sessionPlans: Map<Id, SessionPlan>`. `LessonSession` chỉ mang `planId` + `planActivityIds`, không note/hint.
- Sự kiện room (M2, dự kiến): `session.state {currentActivityId, participants, chatMode}` · `chat.message` · `result.ack` (= StudentAck).

## Bất biến
- Một phiên live mỗi lớp, **tối đa 20 người kể cả giáo viên** (ADR-0017). Chỉ nộp cho hoạt động đang mở. Server chấm.
- Dự đoán/kể lại/nhớ lại = `recorded`, không đúng/sai.
- Trẻ chỉ câu/sticker ở mọi chế độ chat. Chế độ mặc định: `open` ở trường chơi (chỉ người lớn), `phrases` ở tổ chức.
- Không livestream phiên của tổ chức (CONSTITUTION §2.7).
- Không chấm điểm công khai, không xếp hạng học sinh.

## Trạng thái
M0 ✓ ở lõi domain. Chưa có transport, chưa đồng bộ engine.
M2 domain (chưa commit, nhánh ccr-cc266ad8-9pmldj): WO-01, 02, 03 PASS.
- Grader thuần đã nối vào service; server không còn lưu response thô.
- SessionPlan riêng tư theo trường. Phiên mở từ plan thì `setActivity` chỉ nhận hoạt động có trong plan.
- Trần 20 có ca biên (hiệu trưởng chiếm chỗ, QUOTA không đổi participants).
- `npm run check -w @lhdk/domain` 7 file / 108 test xanh; `npm run check` gốc xanh.

## Việc kế tiếp
- WO-04 guard-reviewer, rồi lead-safety duyệt WO-01 + WO-03 trước commit.
- Chờ quyết: Q-17 đề xuất (lớp pilot 20 em + giáo viên = 21 > trần phiên) · learning xác nhận ánh xạ 14 loại · safety: `myProgress` của trẻ, note/hint có tên trẻ.
- Ghi cho platform: mảng hint thô không giới hạn số phần tử → transport phải chặn kích thước body.
- M2 (ADR-0016): phiên chế độ `presented` (trình chiếu cho lớp, không có người tham gia là trẻ, giáo viên ghi quan sát) · xuất tóm tắt SKKN (M4, Q-16).
- M2: room phiên học (state, reconnect: học sinh vào lại thấy hoạt động hiện tại), resolve báo cáo, giáo viên tắt chat từng học sinh.
- M3: bảng giáo viên (ai đang làm/đã nộp/cần giúp), panel chat livestream, nối `Player` của engine với `session.state`.

## Câu hỏi mở
Q-08 video/giọng giáo viên.

## Kiểm
`npm run check -w @lhdk/domain`
