import { describe, expect, it } from 'vitest';
import {
  CAMPUS_MAX_OCCUPANCY,
  DomainError,
  LIVE_SESSION_MAX_PARTICIPANTS,
  SchoolService,
  assignCampusInstance,
  campusAffinity,
  campusInstanceId,
  checkCampusEntry,
  type CampusInstanceView,
  type CampusOccupant,
  type SchoolKind,
} from '../src';

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as DomainError).code;
  }
  return 'OK';
};

// ───────────── gán instance ─────────────

const occ = (n: number, prefix = 'u', affinity: string[] = []): CampusOccupant[] =>
  Array.from({ length: n }, (_, i) => ({ userId: `${prefix}${i}`, affinity }));

const inst = (seq: number, occupants: readonly CampusOccupant[], schoolId = 'S1', kind: SchoolKind = 'play'): CampusInstanceView => ({
  instanceId: campusInstanceId(schoolId, seq),
  schoolId,
  kind,
  seq,
  occupants,
});

const req = (affinity: string[] = [], over: Partial<{ userId: string; schoolId: string; kind: SchoolKind }> = {}) => ({
  userId: 'me',
  schoolId: 'S1',
  kind: 'play' as SchoolKind,
  affinity,
  ...over,
});

describe('gán instance campus', () => {
  it('cap mặc định là 20 = trần phiên live', () => {
    expect(CAMPUS_MAX_OCCUPANCY).toBe(LIVE_SESSION_MAX_PARTICIPANTS);
    expect(CAMPUS_MAX_OCCUPANCY).toBe(20);
  });

  it('instanceId có dạng campus:<schoolId>:<seq>', () => {
    expect(campusInstanceId('S1', 3)).toBe('campus:S1:3');
  });

  it('chưa có instance nào → create seq 1', () => {
    expect(assignCampusInstance([], req())).toEqual({ action: 'create', instanceId: 'campus:S1:1', seq: 1 });
  });

  it('19 người → người thứ 20 vào seq 1', () => {
    expect(assignCampusInstance([inst(1, occ(19))], req())).toEqual({ action: 'join', instanceId: 'campus:S1:1', seq: 1 });
  });

  it('đúng 20 người → người thứ 21 mở seq 2', () => {
    expect(assignCampusInstance([inst(1, occ(20))], req())).toEqual({ action: 'create', instanceId: 'campus:S1:2', seq: 2 });
  });

  it('seq 1 đầy, seq 3 còn chỗ, thiếu seq 2 → join seq 3', () => {
    expect(assignCampusInstance([inst(1, occ(20)), inst(3, occ(5, 'v'))], req())).toMatchObject({ action: 'join', seq: 3 });
  });

  it('tất cả đầy, thiếu seq 2 → create seq 2', () => {
    expect(assignCampusInstance([inst(1, occ(20)), inst(3, occ(20, 'v'))], req())).toMatchObject({ action: 'create', seq: 2 });
  });

  it('có người rời seq 1 đang đầy → người mới về seq 1', () => {
    const full = occ(20);
    const afterLeave = full.slice(1);
    expect(assignCampusInstance([inst(1, full), inst(2, occ(3, 'v'))], req())).toMatchObject({ action: 'join', seq: 2 });
    expect(assignCampusInstance([inst(1, afterLeave), inst(2, occ(3, 'v'))], req())).toMatchObject({ action: 'join', seq: 1 });
  });

  it('vào lại: đã có trong seq 1 đầy → rejoin seq 1', () => {
    const full = [...occ(19), { userId: 'me', affinity: [] }];
    expect(assignCampusInstance([inst(1, full), inst(2, occ(1, 'v'))], req())).toEqual({
      action: 'rejoin',
      instanceId: 'campus:S1:1',
      seq: 1,
    });
  });

  it('ưu tiên instance có nhiều người chung lớp hơn seq nhỏ', () => {
    const a = inst(1, occ(5, 'a', ['c9']));
    const b = inst(2, [...occ(2, 'b', ['c1']), ...occ(3, 'x', [])]);
    expect(assignCampusInstance([a, b], req(['c1']))).toMatchObject({ action: 'join', seq: 2 });
  });

  it('hoà affinity → seq nhỏ nhất', () => {
    const a = inst(1, occ(2, 'a', ['c1']));
    const b = inst(2, occ(2, 'b', ['c1']));
    expect(assignCampusInstance([b, a], req(['c1']))).toMatchObject({ action: 'join', seq: 1 });
    expect(assignCampusInstance([inst(2, occ(1, 'b')), inst(1, occ(9, 'a'))], req())).toMatchObject({ seq: 1 });
  });

  it('instance chung lớp nhưng đầy thì không được chọn', () => {
    const a = inst(1, occ(20, 'a', ['c1']));
    const b = inst(2, occ(1, 'b', []));
    expect(assignCampusInstance([a, b], req(['c1']))).toMatchObject({ action: 'join', seq: 2 });
  });

  it('đảo thứ tự đầu vào → cùng kết quả, không đột biến đầu vào', () => {
    const list = [inst(1, occ(20)), inst(2, occ(4, 'b', ['c1'])), inst(3, occ(4, 'c', ['c1'])), inst(5, occ(1, 'd'))];
    const snapshot = JSON.stringify(list);
    const r1 = assignCampusInstance(list, req(['c1']));
    const r2 = assignCampusInstance([...list].reverse(), req(['c1']));
    const r3 = assignCampusInstance([list[2]!, list[0]!, list[3]!, list[1]!], req(['c1']));
    expect(r1).toEqual(r2);
    expect(r1).toEqual(r3);
    expect(JSON.stringify(list)).toBe(snapshot);
  });

  it('tách không gian: instance cùng trường khác kind còn chỗ bị bỏ qua', () => {
    const org = inst(1, occ(1), 'S1', 'organization');
    expect(assignCampusInstance([org], req([], { kind: 'play' }))).toEqual({ action: 'create', instanceId: 'campus:S1:1', seq: 1 });
    const play = inst(1, occ(1), 'S1', 'play');
    expect(assignCampusInstance([play], req([], { kind: 'organization' }))).toMatchObject({ action: 'create', seq: 1 });
  });

  it('khác kind không dẫn tới rejoin dù user đang ở đó', () => {
    const org = inst(1, [{ userId: 'me', affinity: [] }], 'S1', 'organization');
    expect(assignCampusInstance([org], req([], { kind: 'play' }))).toMatchObject({ action: 'create', seq: 1 });
  });

  it('instance của trường khác còn chỗ bị bỏ qua', () => {
    const other = inst(1, occ(1), 'S2');
    expect(assignCampusInstance([other], req())).toEqual({ action: 'create', instanceId: 'campus:S1:1', seq: 1 });
  });

  it('cap không hợp lệ → INVALID', () => {
    for (const cap of [0, -1, 1.5, Number.NaN]) {
      expect(code(() => assignCampusInstance([], req(), { cap }))).toBe('INVALID');
    }
  });

  it('maxInstances không hợp lệ → INVALID', () => {
    for (const maxInstances of [0, -1, 2.5]) {
      expect(code(() => assignCampusInstance([], req(), { maxInstances }))).toBe('INVALID');
    }
  });

  it('cap tuỳ chỉnh được tôn trọng', () => {
    expect(assignCampusInstance([inst(1, occ(1))], req(), { cap: 1 })).toMatchObject({ action: 'create', seq: 2 });
    expect(assignCampusInstance([inst(1, occ(1))], req(), { cap: 2 })).toMatchObject({ action: 'join', seq: 1 });
  });

  it('đạt maxInstances mà hết chỗ → QUOTA; còn chỗ hoặc rejoin thì vẫn được', () => {
    const full = [inst(1, occ(20)), inst(2, occ(20, 'v'))];
    expect(code(() => assignCampusInstance(full, req(), { maxInstances: 2 }))).toBe('QUOTA');
    expect(assignCampusInstance(full, req(), { maxInstances: 3 })).toMatchObject({ action: 'create', seq: 3 });
    expect(assignCampusInstance([inst(1, occ(20)), inst(2, occ(3, 'v'))], req(), { maxInstances: 2 })).toMatchObject({ action: 'join', seq: 2 });
    const withMe = [inst(1, [...occ(19), { userId: 'me', affinity: [] }]), inst(2, occ(20, 'v'))];
    expect(assignCampusInstance(withMe, req(), { maxInstances: 2 })).toMatchObject({ action: 'rejoin', seq: 1 });
  });

  it('maxInstances chỉ đếm instance hợp lệ (cùng trường, cùng kind)', () => {
    const list = [inst(1, occ(20)), inst(1, occ(1), 'S2'), inst(1, occ(1), 'S1', 'organization')];
    expect(assignCampusInstance(list, req(), { maxInstances: 2 })).toMatchObject({ action: 'create', seq: 2 });
  });
});

// ───────────── quyền vào campus ─────────────

function world() {
  const svc = new SchoolService();
  const admin = svc.registerUser({ displayName: 'Quản trị', platformAdmin: true });
  const ownerPlay = svc.registerUser({ displayName: 'Chủ chơi', planId: 'pilot' });
  const ownerOrgA = svc.registerUser({ displayName: 'Chủ tổ chức A', planId: 'pilot' });
  const ownerOrgB = svc.registerUser({ displayName: 'Chủ tổ chức B', planId: 'pilot' });
  const ownerOrgU = svc.registerUser({ displayName: 'Chủ tổ chức U', planId: 'pilot' });
  const teacherPlay = svc.registerUser({ displayName: 'GV chơi' });
  const teacherA = svc.registerUser({ displayName: 'GV A' });
  const teacherB = svc.registerUser({ displayName: 'GV B' });
  const adultStudent = svc.registerUser({ displayName: 'Phụ huynh học thử' });
  const outsider = svc.registerUser({ displayName: 'Người ngoài' });

  const play = svc.createSchool(ownerPlay.id, { name: 'Trường chơi', level: 'kindergarten' });
  const orgA = svc.createSchool(ownerOrgA.id, { name: 'Tổ chức A', level: 'kindergarten', kind: 'organization' });
  const orgB = svc.createSchool(ownerOrgB.id, { name: 'Tổ chức B', level: 'kindergarten', kind: 'organization' });
  const orgU = svc.createSchool(ownerOrgU.id, { name: 'Tổ chức U', level: 'kindergarten', kind: 'organization' });
  svc.verifyOrganization(admin.id, orgA.id);
  svc.verifyOrganization(admin.id, orgB.id);

  svc.grantTeacher(ownerPlay.id, play.id, teacherPlay.id);
  svc.grantTeacher(ownerOrgA.id, orgA.id, teacherA.id);
  svc.grantTeacher(ownerOrgB.id, orgB.id, teacherB.id);

  const classPlay = svc.createClass(teacherPlay.id, play.id, { name: 'Lớp chơi', capacity: 5 });
  const classA = svc.createClass(teacherA.id, orgA.id, { name: 'Lá 1', capacity: 5 });
  const classB = svc.createClass(teacherB.id, orgB.id, { name: 'Lá B', capacity: 5 });
  svc.enrollWithCode(adultStudent.id, classPlay.joinCode);
  const childA = svc.createManagedStudent(teacherA.id, classA.id, 'Bé A');
  const childB = svc.createManagedStudent(teacherB.id, classB.id, 'Bé B');

  return { svc, admin, ownerPlay, ownerOrgA, ownerOrgU, teacherPlay, teacherA, adultStudent, outsider, play, orgA, orgB, orgU, classPlay, classA, classB, childA, childB };
}

const idle = { streaming: false };

describe('quyền vào campus', () => {
  it('không phải thành viên → FORBIDDEN', () => {
    const w = world();
    expect(code(() => checkCampusEntry(w.svc, w.outsider.id, w.play.id, idle))).toBe('FORBIDDEN');
    expect(code(() => checkCampusEntry(w.svc, w.outsider.id, w.orgA.id, idle))).toBe('FORBIDDEN');
  });

  it('user hoặc trường không tồn tại → NOT_FOUND', () => {
    const w = world();
    expect(code(() => checkCampusEntry(w.svc, 'nope', w.play.id, idle))).toBe('NOT_FOUND');
    expect(code(() => checkCampusEntry(w.svc, w.ownerPlay.id, 'nope', idle))).toBe('NOT_FOUND');
  });

  it('trường chơi: hiệu trưởng, giáo viên, học sinh người lớn đều vào được', () => {
    const w = world();
    const p = checkCampusEntry(w.svc, w.ownerPlay.id, w.play.id, idle);
    expect(p).toMatchObject({ userId: w.ownerPlay.id, schoolId: w.play.id, kind: 'play', ageBand: 'adult', displayName: 'Chủ chơi' });
    expect(p.roles).toContain('principal');
    expect(checkCampusEntry(w.svc, w.teacherPlay.id, w.play.id, idle).roles).toContain('teacher');
    const s = checkCampusEntry(w.svc, w.adultStudent.id, w.play.id, idle);
    expect(s.kind).toBe('play');
    expect(s.roles).toEqual(['student']);
  });

  it('trẻ (dựng thẳng qua store) vào trường chơi → FORBIDDEN', () => {
    const w = world();
    w.svc.store.users.set('kid-play', { id: 'kid-play', displayName: 'Bé', ageBand: 'child', planId: 'free', managedBySchoolId: w.play.id, createdAt: 0 });
    w.svc.store.memberships.set(`${w.play.id}:kid-play`, { schoolId: w.play.id, userId: 'kid-play', roles: ['student'] });
    expect(code(() => checkCampusEntry(w.svc, 'kid-play', w.play.id, idle))).toBe('FORBIDDEN');
  });

  it('tổ chức chưa xác minh: hiệu trưởng vào được', () => {
    const w = world();
    const e = checkCampusEntry(w.svc, w.ownerOrgU.id, w.orgU.id, idle);
    expect(e.kind).toBe('organization');
    expect(e.roles).toContain('principal');
  });

  it('tổ chức chưa xác minh: trẻ (dựng qua store) → FORBIDDEN', () => {
    const w = world();
    w.svc.store.users.set('kid-u', { id: 'kid-u', displayName: 'Bé U', ageBand: 'child', planId: 'free', managedBySchoolId: w.orgU.id, createdAt: 0 });
    w.svc.store.memberships.set(`${w.orgU.id}:kid-u`, { schoolId: w.orgU.id, userId: 'kid-u', roles: ['student'] });
    expect(code(() => checkCampusEntry(w.svc, 'kid-u', w.orgU.id, idle))).toBe('FORBIDDEN');
  });

  it('tổ chức đã xác minh: giáo viên và trẻ của chính tổ chức đó vào được', () => {
    const w = world();
    expect(checkCampusEntry(w.svc, w.teacherA.id, w.orgA.id, idle).roles).toContain('teacher');
    const kid = checkCampusEntry(w.svc, w.childA.id, w.orgA.id, idle);
    expect(kid).toMatchObject({ kind: 'organization', ageBand: 'child', roles: ['student'], displayName: 'Bé A' });
  });

  it('trẻ của tổ chức khác (ghi danh giả qua store) → FORBIDDEN', () => {
    const w = world();
    w.svc.store.memberships.set(`${w.orgA.id}:${w.childB.id}`, { schoolId: w.orgA.id, userId: w.childB.id, roles: ['student'] });
    w.svc.store.enrollments.set(`${w.classA.id}:${w.childB.id}`, { classId: w.classA.id, userId: w.childB.id, enrolledAt: 0 });
    expect(code(() => checkCampusEntry(w.svc, w.childB.id, w.orgA.id, idle))).toBe('FORBIDDEN');
    // chính tổ chức của bé B thì vẫn vào được
    expect(code(() => checkCampusEntry(w.svc, w.childB.id, w.orgB.id, idle))).toBe('OK');
  });

  it('trẻ của tổ chức thiếu vai student → FORBIDDEN', () => {
    const w = world();
    w.svc.store.memberships.set(`${w.orgA.id}:${w.childA.id}`, { schoolId: w.orgA.id, userId: w.childA.id, roles: ['teacher'] });
    expect(code(() => checkCampusEntry(w.svc, w.childA.id, w.orgA.id, idle))).toBe('FORBIDDEN');
  });

  it('người lớn chỉ có vai student ở tổ chức đã xác minh → FORBIDDEN', () => {
    const w = world();
    w.svc.store.memberships.set(`${w.orgA.id}:${w.outsider.id}`, { schoolId: w.orgA.id, userId: w.outsider.id, roles: ['student'] });
    expect(code(() => checkCampusEntry(w.svc, w.outsider.id, w.orgA.id, idle))).toBe('FORBIDDEN');
  });

  it('đang livestream: tổ chức → FORBIDDEN (mọi vai), trường chơi → OK', () => {
    const w = world();
    const live = { streaming: true };
    expect(code(() => checkCampusEntry(w.svc, w.teacherA.id, w.orgA.id, live))).toBe('FORBIDDEN');
    expect(code(() => checkCampusEntry(w.svc, w.ownerOrgA.id, w.orgA.id, live))).toBe('FORBIDDEN');
    expect(code(() => checkCampusEntry(w.svc, w.childA.id, w.orgA.id, live))).toBe('FORBIDDEN');
    expect(code(() => checkCampusEntry(w.svc, w.ownerPlay.id, w.play.id, live))).toBe('OK');
    expect(code(() => checkCampusEntry(w.svc, w.adultStudent.id, w.play.id, live))).toBe('OK');
  });

  it('roles trả về là bản sao, không lộ mảng của store', () => {
    const w = world();
    const e = checkCampusEntry(w.svc, w.ownerPlay.id, w.play.id, idle);
    e.roles.push('student');
    expect(w.svc.rolesIn(w.play.id, w.ownerPlay.id)).toEqual(['principal']);
  });
});

// ───────────── affinity ─────────────

describe('campusAffinity', () => {
  it('chỉ trả lớp của trường đó, gồm cả lớp mình dạy, đã sort', () => {
    const w = world();
    // GV A dạy thêm một lớp ở orgA, và (giả) được ghi danh ở lớp của trường khác
    const second = w.svc.createClass(w.teacherA.id, w.orgA.id, { name: 'Lá 2', capacity: 5 });
    w.svc.store.enrollments.set(`${w.classB.id}:${w.teacherA.id}`, { classId: w.classB.id, userId: w.teacherA.id, enrolledAt: 0 });
    const got = campusAffinity(w.svc, w.teacherA.id, w.orgA.id);
    expect(got).toEqual([w.classA.id, second.id].sort());
    expect(got).not.toContain(w.classB.id);
    expect(campusAffinity(w.svc, w.teacherA.id, w.orgB.id)).toEqual([w.classB.id]);
  });

  it('học sinh được ghi danh trả đúng lớp; người không liên quan trả rỗng', () => {
    const w = world();
    expect(campusAffinity(w.svc, w.childA.id, w.orgA.id)).toEqual([w.classA.id]);
    expect(campusAffinity(w.svc, w.adultStudent.id, w.play.id)).toEqual([w.classPlay.id]);
    expect(campusAffinity(w.svc, w.outsider.id, w.play.id)).toEqual([]);
  });

  it('kết quả đã sort tăng', () => {
    const w = world();
    const extra = [
      w.svc.createClass(w.teacherPlay.id, w.play.id, { name: 'Lớp 2', capacity: 5 }),
    ];
    const got = campusAffinity(w.svc, w.teacherPlay.id, w.play.id);
    expect(got).toEqual([...got].sort());
    expect(got).toEqual([w.classPlay.id, extra[0]!.id].sort());
  });
});
