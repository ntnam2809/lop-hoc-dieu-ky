# Module `classroom` — phiên học trực tiếp · điều nhịp · kết quả · chat phiên (L1)

**Lead:** `lead-classroom` · **ADR:** 0004, 0007, 0008, 0010 · **Luật:** CONSTITUTION §1, §2.3, §2.5, §3

## Sứ mệnh
Biến một bài học thành buổi học chung: giáo viên điều nhịp, học sinh tương tác trên thiết bị mình, server ghi kết quả tin cậy, chat kiểu livestream an toàn.

## Sở hữu
- `packages/domain/src/service.ts` — mục *phiên học trực tiếp*, *chat an toàn*, *xem dữ liệu theo quyền*
- `packages/domain/src/chat.ts` — `checkChat`, `RateLimiter`, `DEFAULT_CHAT_CATALOG` (luật do safety duyệt)
- `packages/domain/test/chat.test.ts`, `journey.test.ts` (bước 5–10)
- M2+: room phiên học trong `apps/server/src/rooms/session-room.ts` · M3: chế độ "theo nhịp cô" phía client (phối hợp learning)

## Không thuộc
Engine/primitive bài học (→ learning) · campus/di chuyển (→ world) · luật vai (→ school, chỉ gọi `canManageClass`).

## Hợp đồng
- `startSession · joinSession · setActivity · submitResult · endSession`
- `setChatMode · sendChat · chatLog · hideMessage · report`
- `classProgress · myProgress · schoolReports · schoolAudit`
- `Grader = (lessonId, activityId, response) => 'correct'|'incorrect'|'recorded'` — learning cấp bản thật.
- Sự kiện room (M2, dự kiến): `session.state {currentActivityId, participants, chatMode}` · `chat.message` · `result.ack`.

## Bất biến
- Một phiên live mỗi lớp. Chỉ nộp cho hoạt động đang mở. Server chấm.
- Dự đoán/kể lại/nhớ lại = `recorded`, không đúng/sai.
- Trẻ chỉ câu/sticker ở mọi chế độ chat. Chế độ mặc định: `open` ở trường chơi (chỉ người lớn), `phrases` ở tổ chức.
- Không livestream phiên của tổ chức (CONSTITUTION §2.7).
- Không chấm điểm công khai, không xếp hạng học sinh.

## Trạng thái
M0 ✓ ở lõi domain. Chưa có transport, chưa đồng bộ engine.

## Việc kế tiếp
- M2 (ADR-0016): `SessionPlan` (giáo viên thiết kế phiên: bài, thứ tự hoạt động, ghi chú, câu hỏi gợi ý; private theo trường) · phiên chế độ `presented` (trình chiếu cho lớp, không có người tham gia là trẻ, giáo viên ghi quan sát) · xuất tóm tắt SKKN (M4, Q-16).
- M2: room phiên học (state, reconnect: học sinh vào lại thấy hoạt động hiện tại), resolve báo cáo, giáo viên tắt chat từng học sinh.
- M3: bảng giáo viên (ai đang làm/đã nộp/cần giúp), panel chat livestream, nối `Player` của engine với `session.state`.

## Câu hỏi mở
Q-08 video/giọng giáo viên.

## Kiểm
`npm run check -w @lhdk/domain`
