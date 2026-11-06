import { describe, expect, it } from 'vitest';
import { DomainError, SchoolService } from '../src';

function world() {
  const svc = new SchoolService();
  const ownerA = svc.registerUser({ displayName: 'Chủ A', planId: 'pilot' });
  const ownerB = svc.registerUser({ displayName: 'Chủ B', planId: 'pilot' });
  const teacherA = svc.registerUser({ displayName: 'GV A' });
  const teacherB = svc.registerUser({ displayName: 'GV B' });
  const schoolA = svc.createSchool(ownerA.id, { name: 'Trường A', level: 'kindergarten' });
  const schoolB = svc.createSchool(ownerB.id, { name: 'Trường B', level: 'primary' });
  svc.grantTeacher(ownerA.id, schoolA.id, teacherA.id);
  svc.grantTeacher(ownerB.id, schoolB.id, teacherB.id);
  const classA = svc.createClass(teacherA.id, schoolA.id, { name: 'Lá 1', capacity: 2 });
  return { svc, ownerA, ownerB, teacherA, teacherB, schoolA, schoolB, classA };
}

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as DomainError).code;
  }
  return 'OK';
};

describe('danh tính & gói', () => {
  it('trẻ em không tự đăng ký được', () => {
    const svc = new SchoolService();
    expect(code(() => svc.registerUser({ displayName: 'Bé', ageBand: 'child' }))).toBe('FORBIDDEN');
  });

  it('account free không lập trường (prompt: free chỉ làm học sinh hoặc giáo viên lớp nhỏ)', () => {
    const svc = new SchoolService();
    const u = svc.registerUser({ displayName: 'Free' });
    expect(code(() => svc.createSchool(u.id, { name: 'X', level: 'primary' }))).toBe('QUOTA');
  });

  it('gói pilot giới hạn số trường làm chủ', () => {
    const { svc, ownerA } = world();
    expect(code(() => svc.createSchool(ownerA.id, { name: 'Trường thứ hai', level: 'primary' }))).toBe('QUOTA');
  });
});

describe('vai theo phạm vi trường', () => {
  it('chỉ hiệu trưởng của chính trường mới cấp giáo viên', () => {
    const { svc, ownerB, teacherA, schoolA, teacherB } = world();
    expect(code(() => svc.grantTeacher(ownerB.id, schoolA.id, teacherB.id))).toBe('FORBIDDEN');
    expect(code(() => svc.grantTeacher(teacherA.id, schoolA.id, teacherB.id))).toBe('FORBIDDEN');
  });

  it('không cấp vai giáo viên cho hồ sơ trẻ', () => {
    const { svc, ownerA, teacherA, schoolA, classA } = world();
    const kid = svc.createManagedStudent(teacherA.id, classA.id, 'Bé Bi');
    expect(code(() => svc.grantTeacher(ownerA.id, schoolA.id, kid.id))).toBe('FORBIDDEN');
  });

  it('giáo viên trường B không mở lớp hay mở phiên ở trường A', () => {
    const { svc, teacherB, schoolA, classA } = world();
    expect(code(() => svc.createClass(teacherB.id, schoolA.id, { name: 'Lén', capacity: 5 }))).toBe('FORBIDDEN');
    expect(code(() => svc.startSession(teacherB.id, classA.id, 'lost-apple'))).toBe('FORBIDDEN');
    expect(code(() => svc.classProgress(teacherB.id, classA.id))).toBe('FORBIDDEN');
  });

  it('học sinh không gọi được lệnh của giáo viên', () => {
    const { svc, teacherA, classA } = world();
    const kid = svc.createManagedStudent(teacherA.id, classA.id, 'Bé Su');
    expect(code(() => svc.startSession(kid.id, classA.id, 'lost-apple'))).toBe('FORBIDDEN');
    const s = svc.startSession(teacherA.id, classA.id, 'lost-apple');
    svc.joinSession(kid.id, s.id);
    expect(code(() => svc.setActivity(kid.id, s.id, 'a1'))).toBe('FORBIDDEN');
    expect(code(() => svc.endSession(kid.id, s.id))).toBe('FORBIDDEN');
    expect(code(() => svc.setChatMode(kid.id, s.id, 'open'))).toBe('FORBIDDEN');
  });

  it('thu hồi giáo viên đóng phiên đang mở và chặn quyền ngay', () => {
    const { svc, ownerA, teacherA, schoolA, classA } = world();
    const s = svc.startSession(teacherA.id, classA.id, 'lost-apple');
    svc.revokeTeacher(ownerA.id, schoolA.id, teacherA.id);
    expect(svc.session(s.id).status).toBe('ended');
    expect(code(() => svc.startSession(teacherA.id, classA.id, 'lost-apple'))).toBe('FORBIDDEN');
    // Hiệu trưởng vẫn quản lý được lớp.
    expect(code(() => svc.startSession(ownerA.id, classA.id, 'lost-apple'))).toBe('OK');
  });
});

describe('sức chứa & phiên', () => {
  it('chặn sĩ số vượt gói và lớp đầy', () => {
    const { svc, teacherA, schoolA, classA } = world();
    expect(code(() => svc.createClass(teacherA.id, schoolA.id, { name: 'To', capacity: 500 }))).toBe('QUOTA');
    svc.createManagedStudent(teacherA.id, classA.id, 'Bé 1');
    svc.createManagedStudent(teacherA.id, classA.id, 'Bé 2');
    expect(code(() => svc.createManagedStudent(teacherA.id, classA.id, 'Bé 3'))).toBe('QUOTA');
  });

  it('mỗi lớp chỉ một phiên đang mở; chỉ nộp cho hoạt động đang mở', () => {
    const { svc, teacherA, classA } = world();
    const kid = svc.createManagedStudent(teacherA.id, classA.id, 'Bé Mi');
    const s = svc.startSession(teacherA.id, classA.id, 'float-or-sink');
    expect(code(() => svc.startSession(teacherA.id, classA.id, 'float-or-sink'))).toBe('CONFLICT');
    expect(code(() => svc.submitResult(kid.id, s.id, 'a1', 'x'))).toBe('FORBIDDEN'); // chưa vào phiên
    svc.joinSession(kid.id, s.id);
    expect(code(() => svc.submitResult(kid.id, s.id, 'a1', 'x'))).toBe('CONFLICT'); // chưa mở hoạt động
    svc.setActivity(teacherA.id, s.id, 'a1');
    expect(code(() => svc.submitResult(kid.id, s.id, 'a1', 'x'))).toBe('OK');
  });

  it('không ghi danh hai lần, giáo viên không làm học sinh lớp mình', () => {
    const { svc, teacherA, classA } = world();
    const kid = svc.createManagedStudent(teacherA.id, classA.id, 'Bé Tí');
    expect(code(() => svc.enrollWithCode(kid.id, classA.joinCode))).toBe('CONFLICT');
    expect(code(() => svc.enrollWithCode(teacherA.id, classA.joinCode))).toBe('CONFLICT');
  });
});
