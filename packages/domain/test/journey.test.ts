import { describe, expect, it } from 'vitest';
import { SchoolService, type Grader } from '../src';

/**
 * Hai hành trình nghiệm thu của vertical slice (docs/MVP.md §3), chạy trọn trên lõi domain:
 * A — phụ huynh chơi trước ở trường chơi (chỉ người lớn) để hiểu cơ chế.
 * B — trẻ tham gia qua tổ chức có thật đã xác minh, giáo viên thật quản lý.
 */
const grader: Grader = (_lesson, activity, response) =>
  activity === 'a9-quiz' ? (response === 'duck' ? 'correct' : 'incorrect') : 'recorded';

const setup = () => {
  let t = 1_000;
  return new SchoolService({ clock: () => (t += 1000), grader });
};

describe('Hành trình A — phụ huynh chơi trước (trường chơi, chỉ người lớn)', () => {
  it('phụ huynh vào lớp bằng mã, học thử bài như con sẽ học, chat chữ được', () => {
    const svc = setup();
    const host = svc.registerUser({ displayName: 'Chủ trường chơi', planId: 'pilot' });
    const mom = svc.registerUser({ displayName: 'Mẹ Bi' });
    const dad = svc.registerUser({ displayName: 'Bố Na' });

    const play = svc.createSchool(host.id, { name: 'Trường Diệu Kỳ (trải nghiệm)', level: 'kindergarten' });
    expect(play.kind).toBe('play');
    svc.grantTeacher(host.id, play.id, host.id); // chủ trường tự đứng lớp
    const klass = svc.createClass(host.id, play.id, { name: 'Lớp thử của phụ huynh', capacity: 20 });

    svc.enrollWithCode(mom.id, klass.joinCode);
    svc.enrollWithCode(dad.id, klass.joinCode);
    const s = svc.startSession(host.id, klass.id, 'float-or-sink');
    expect(s.chatMode).toBe('open');
    svc.joinSession(mom.id, s.id);
    svc.joinSession(dad.id, s.id);

    svc.setActivity(host.id, s.id, 'a9-quiz');
    expect(svc.submitResult(mom.id, s.id, 'a9-quiz', 'duck').outcome).toBe('correct');
    expect(svc.sendChat(dad.id, s.id, { kind: 'text', text: 'Bé nhà mình sẽ thích bài này' }).payload.kind).toBe('text');

    // Trường chơi không có hồ sơ trẻ.
    expect(() => svc.createManagedStudent(host.id, klass.id, 'Bé Bi')).toThrow(/tổ chức thật/);
  });
});

describe('Hành trình B — trẻ qua tổ chức có thật: tạo trường → xác minh → cấp giáo viên → lớp → phiên → kết quả', () => {
  it('chạy trọn và tôn trọng quyền xem dữ liệu', () => {
    const svc = setup();
    const admin = svc.registerUser({ displayName: 'Quản trị nền tảng', platformAdmin: true });
    const a = svc.registerUser({ displayName: 'Cô Hiệu Trưởng A', planId: 'pilot' });
    const b = svc.registerUser({ displayName: 'Cô Giáo B' });
    const parent = svc.registerUser({ displayName: 'Phụ huynh D' });
    const outsider = svc.registerUser({ displayName: 'Người lạ E' });

    // 1. A lập trường dạng tổ chức (trường mầm non có thật), thành hiệu trưởng; quản trị xác minh.
    const school = svc.createSchool(a.id, { name: 'Trường Mầm Non Hoa Sen', level: 'kindergarten', kind: 'organization' });
    expect(svc.rolesIn(school.id, a.id)).toEqual(['principal']);
    svc.grantTeacher(a.id, school.id, b.id);
    const klass = svc.createClass(b.id, school.id, { name: 'Lớp Lá 1', capacity: 20 });
    expect(() => svc.createManagedStudent(b.id, klass.id, 'Bé Na')).toThrow(/đã xác minh/);
    svc.verifyOrganization(admin.id, school.id);

    // 4. Trẻ không là chủ tài khoản: cô tạo hồ sơ. Người lớn không vào lớp có trẻ bằng mã.
    const c = svc.createManagedStudent(b.id, klass.id, 'Bé Na');
    expect(c.ageBand).toBe('child');
    expect(() => svc.enrollWithCode(parent.id, klass.joinCode)).toThrow(/chỉ nhận học sinh do giáo viên/);

    // 5–6. B mở phiên, C vào phòng; người ngoài bị chặn.
    const session = svc.startSession(b.id, klass.id, 'float-or-sink');
    expect(session.chatMode).toBe('phrases');
    svc.joinSession(c.id, session.id);
    expect(() => svc.joinSession(outsider.id, session.id)).toThrow(/học sinh của lớp/);

    // 7–8. B mở hoạt động; C dự đoán rồi trả lời.
    svc.setActivity(b.id, session.id, 'a3-predict-duck');
    expect(svc.submitResult(c.id, session.id, 'a3-predict-duck', 'float').outcome).toBe('recorded');
    svc.setActivity(b.id, session.id, 'a9-quiz');
    expect(svc.submitResult(c.id, session.id, 'a9-quiz', 'rock').outcome).toBe('incorrect');
    expect(svc.submitResult(c.id, session.id, 'a9-quiz', 'duck')).toMatchObject({ outcome: 'correct', attempts: 2 });

    // 9–10. Đóng phiên; xem theo quyền.
    svc.endSession(b.id, session.id);
    expect(() => svc.submitResult(c.id, session.id, 'a9-quiz', 'duck')).toThrow(/đã đóng/);
    expect(svc.classProgress(b.id, klass.id)).toHaveLength(2);
    expect(svc.classProgress(a.id, klass.id)).toHaveLength(2);
    expect(svc.myProgress(c.id).map((r) => r.activityId).sort()).toEqual(['a3-predict-duck', 'a9-quiz']);
    expect(() => svc.classProgress(outsider.id, klass.id)).toThrow(/Chỉ giáo viên/);

    expect(svc.schoolAudit(a.id, school.id).map((e) => e.action)).toEqual([
      'school.create',
      'role.grant',
      'class.create',
      'school.verify',
      'student.create',
      'enrollment.create',
      'session.start',
      'session.activity',
      'session.activity',
      'session.end',
    ]);
  });
});
