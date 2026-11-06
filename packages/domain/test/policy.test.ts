import { describe, expect, it } from 'vitest';
import { DomainError, SchoolService } from '../src';

function world() {
  const svc = new SchoolService();
  const admin = svc.registerUser({ displayName: 'Quản trị', platformAdmin: true });
  const ownerA = svc.registerUser({ displayName: 'Chủ A', planId: 'pilot' });
  const ownerB = svc.registerUser({ displayName: 'Chủ B', planId: 'pilot' });
  const teacherA = svc.registerUser({ displayName: 'GV A' });
  const teacherB = svc.registerUser({ displayName: 'GV B' });
  const schoolA = svc.createSchool(ownerA.id, { name: 'Trường A', level: 'kindergarten', kind: 'organization' });
  svc.verifyOrganization(admin.id, schoolA.id);
  const schoolB = svc.createSchool(ownerB.id, { name: 'Trường B', level: 'primary' });
  svc.grantTeacher(ownerA.id, schoolA.id, teacherA.id);
  svc.grantTeacher(ownerB.id, schoolB.id, teacherB.id);
  const classA = svc.createClass(teacherA.id, schoolA.id, { name: 'Lá 1', capacity: 2 });
  return { svc, admin, ownerA, ownerB, teacherA, teacherB, schoolA, schoolB, classA };
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

  it('trường chơi: không ghi danh hai lần, giáo viên không làm học sinh lớp mình', () => {
    const { svc, ownerB, teacherB, schoolB } = world();
    const parent = svc.registerUser({ displayName: 'Phụ huynh' });
    const playClass = svc.createClass(teacherB.id, schoolB.id, { name: 'Lớp thử', capacity: 5 });
    svc.enrollWithCode(parent.id, playClass.joinCode);
    expect(code(() => svc.enrollWithCode(parent.id, playClass.joinCode))).toBe('CONFLICT');
    expect(code(() => svc.enrollWithCode(teacherB.id, playClass.joinCode))).toBe('CONFLICT');
    expect(code(() => svc.createManagedStudent(ownerB.id, playClass.id, 'Bé'))).toBe('FORBIDDEN');
  });
});

describe('trần phiên live', () => {
  it('tối đa 20 người một phiên, kể cả giáo viên; vào lại không tính thêm', () => {
    const svc = new SchoolService();
    const host = svc.registerUser({ displayName: 'Chủ', planId: 'pilot' });
    const play = svc.createSchool(host.id, { name: 'Trường chơi', level: 'primary' });
    svc.grantTeacher(host.id, play.id, host.id);
    const k = svc.createClass(host.id, play.id, { name: 'Lớp 1', capacity: 20 });
    const people = Array.from({ length: 20 }, (_, i) => svc.registerUser({ displayName: `Người ${i + 1}` }));
    people.forEach((p) => svc.enrollWithCode(p.id, k.joinCode));
    const s = svc.startSession(host.id, k.id, 'lost-apple');
    people.slice(0, 19).forEach((p) => svc.joinSession(p.id, s.id));
    expect(svc.session(s.id).participants).toHaveLength(20);
    expect(code(() => svc.joinSession(people[19]!.id, s.id))).toBe('QUOTA');
    expect(code(() => svc.joinSession(people[0]!.id, s.id))).toBe('OK');
  });
});

describe('hai không gian: trường chơi người lớn ↔ tổ chức có trẻ (ADR-0014)', () => {
  it('chỉ quản trị nền tảng xác minh tổ chức; tổ chức chưa xác minh không có trẻ', () => {
    const { svc, admin, ownerB, teacherB } = world();
    const owner = svc.registerUser({ displayName: 'Chủ C', planId: 'pilot' });
    const org = svc.createSchool(owner.id, { name: 'Mầm non C', level: 'kindergarten', kind: 'organization' });
    svc.grantTeacher(owner.id, org.id, owner.id);
    const k = svc.createClass(owner.id, org.id, { name: 'Lá', capacity: 5 });
    expect(code(() => svc.createManagedStudent(owner.id, k.id, 'Bé'))).toBe('FORBIDDEN');
    expect(code(() => svc.verifyOrganization(ownerB.id, org.id))).toBe('FORBIDDEN');
    expect(code(() => svc.verifyOrganization(teacherB.id, org.id))).toBe('FORBIDDEN');
    svc.verifyOrganization(admin.id, org.id);
    expect(code(() => svc.verifyOrganization(admin.id, org.id))).toBe('CONFLICT');
    expect(code(() => svc.createManagedStudent(owner.id, k.id, 'Bé'))).toBe('OK');
  });

  it('người lớn không vào lớp có trẻ bằng mã; trường chơi không xác minh được', () => {
    const { svc, admin, classA, schoolB } = world();
    const stranger = svc.registerUser({ displayName: 'Người lạ' });
    expect(code(() => svc.enrollWithCode(stranger.id, classA.joinCode))).toBe('FORBIDDEN');
    expect(code(() => svc.verifyOrganization(admin.id, schoolB.id))).toBe('INVALID');
  });
});
