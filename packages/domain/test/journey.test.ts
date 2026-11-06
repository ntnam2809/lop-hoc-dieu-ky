import { describe, expect, it } from 'vitest';
import { SchoolService, type Grader } from '../src';

/**
 * Hành trình nghiệm thu của vertical slice (docs/MVP.md §3), chạy trọn trên lõi domain.
 * Bước 4 dùng hồ sơ trẻ do giáo viên tạo + mã vào lớp thay cho "tìm trường" (ADR-0007: MVP không có danh bạ công khai).
 */
const grader: Grader = (_lesson, activity, response) =>
  activity === 'a9-quiz' ? (response === 'duck' ? 'correct' : 'incorrect') : 'recorded';

function setup() {
  let t = 1_000;
  const svc = new SchoolService({ clock: () => (t += 1000), grader });
  return svc;
}

describe('hành trình: tạo trường → cấp giáo viên → mở lớp → học sinh vào → phiên học → lưu kết quả', () => {
  it('chạy trọn 10 bước và tôn trọng quyền xem dữ liệu', () => {
    const svc = setup();
    const a = svc.registerUser({ displayName: 'Cô Hiệu Trưởng A', planId: 'pilot' });
    const b = svc.registerUser({ displayName: 'Cô Giáo B' });
    const tester = svc.registerUser({ displayName: 'Người thử D' });
    const outsider = svc.registerUser({ displayName: 'Người lạ E' });

    // 1. A tạo trường mẫu giáo, thành hiệu trưởng.
    const school = svc.createSchool(a.id, { name: 'Trường Mầm Non Diệu Kỳ', level: 'kindergarten' });
    expect(svc.rolesIn(school.id, a.id)).toEqual(['principal']);

    // 2. A cấp quyền giáo viên cho B.
    svc.grantTeacher(a.id, school.id, b.id);
    expect(svc.hasRole(school.id, b.id, 'teacher')).toBe(true);

    // 3. B mở lớp Lá 1 (sức chứa theo gói của trường — giả định A-07).
    const klass = svc.createClass(b.id, school.id, { name: 'Lớp Lá 1', capacity: 25 });

    // 4. Học sinh vào lớp: trẻ C do cô tạo hồ sơ; người thử D tự vào bằng mã lớp.
    const c = svc.createManagedStudent(b.id, klass.id, 'Bé Na');
    expect(c.ageBand).toBe('child');
    svc.enrollWithCode(tester.id, klass.joinCode);

    // 5. B mở phiên học. 6. C vào phòng.
    const session = svc.startSession(b.id, klass.id, 'float-or-sink');
    svc.joinSession(c.id, session.id);
    svc.joinSession(tester.id, session.id);
    expect(() => svc.joinSession(outsider.id, session.id)).toThrow(/học sinh của lớp/);

    // 7. B mở hoạt động dự đoán. 8. C dự đoán, rồi trả lời câu hỏi.
    svc.setActivity(b.id, session.id, 'a3-predict-duck');
    expect(svc.submitResult(c.id, session.id, 'a3-predict-duck', 'float').outcome).toBe('recorded');
    svc.setActivity(b.id, session.id, 'a9-quiz');
    expect(svc.submitResult(c.id, session.id, 'a9-quiz', 'rock').outcome).toBe('incorrect');
    const retry = svc.submitResult(c.id, session.id, 'a9-quiz', 'duck');
    expect(retry).toMatchObject({ outcome: 'correct', attempts: 2 });

    // 9. Kết quả được lưu phía server. 10. B đóng phiên; A/B xem được theo quyền.
    svc.endSession(b.id, session.id);
    expect(() => svc.submitResult(c.id, session.id, 'a9-quiz', 'duck')).toThrow(/đã đóng/);

    expect(svc.classProgress(b.id, klass.id)).toHaveLength(2);
    expect(svc.classProgress(a.id, klass.id)).toHaveLength(2);
    expect(svc.myProgress(c.id).map((r) => r.activityId).sort()).toEqual(['a3-predict-duck', 'a9-quiz']);
    expect(() => svc.classProgress(tester.id, klass.id)).toThrow(/Chỉ giáo viên/);
    expect(() => svc.classProgress(outsider.id, klass.id)).toThrow(/Chỉ giáo viên/);

    const actions = svc.schoolAudit(a.id, school.id).map((e) => e.action);
    expect(actions).toEqual([
      'school.create',
      'role.grant',
      'class.create',
      'student.create',
      'enrollment.create',
      'enrollment.create',
      'session.start',
      'session.activity',
      'session.activity',
      'session.end',
    ]);
  });
});
