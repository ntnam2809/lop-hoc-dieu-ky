import { describe, expect, it } from 'vitest';
import {
  DomainError,
  LIVE_SESSION_MAX_PARTICIPANTS,
  SchoolService,
  answerKeysFromPackage,
  lessonLookupFrom,
  toStudentAck,
} from '../src';

const lessons = lessonLookupFrom([
  answerKeysFromPackage({
    lesson: { id: 'float-or-sink' },
    scenarios: [
      {
        activities: [
          { id: 'a1', type: 'prediction', options: [{ id: 'float' }, { id: 'sink' }] },
          { id: 'a2', type: 'object_identification', options: [{ id: 'duck' }, { id: 'rock' }], correctAnswer: 'duck' },
          { id: 'a3', type: 'story_scene' },
        ],
      },
    ],
  }),
  answerKeysFromPackage({
    lesson: { id: 'lost-apple' },
    scenarios: [{ activities: [{ id: 'b1', type: 'story_scene' }] }],
  }),
]);

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as DomainError).code;
  }
  return 'OK';
};

const choice = (optionId: string) => ({ kind: 'choice' as const, optionId });

function world(withLessons = true) {
  let t = 1_000;
  const svc = new SchoolService({ clock: () => (t += 1000), ...(withLessons ? { lessons } : {}) });
  const admin = svc.registerUser({ displayName: 'Quản trị', platformAdmin: true });
  const principalA = svc.registerUser({ displayName: 'Hiệu trưởng A', planId: 'pilot' });
  const teacherA = svc.registerUser({ displayName: 'GV A' });
  const ownerB = svc.registerUser({ displayName: 'Chủ B', planId: 'pilot' });
  const teacherB = svc.registerUser({ displayName: 'GV B' });
  const schoolA = svc.createSchool(principalA.id, { name: 'Trường A', level: 'kindergarten', kind: 'organization' });
  svc.verifyOrganization(admin.id, schoolA.id);
  svc.grantTeacher(principalA.id, schoolA.id, teacherA.id);
  const schoolB = svc.createSchool(ownerB.id, { name: 'Trường B', level: 'primary' });
  svc.grantTeacher(ownerB.id, schoolB.id, teacherB.id);
  const classA = svc.createClass(teacherA.id, schoolA.id, { name: 'Lá 1', capacity: 5 });
  const classB = svc.createClass(teacherB.id, schoolB.id, { name: 'Lớp B', capacity: 5 });
  const kid = svc.createManagedStudent(teacherA.id, classA.id, 'Bé Na');
  return { svc, principalA, teacherA, ownerB, teacherB, schoolA, schoolB, classA, classB, kid };
}

const planInput = (steps: string[] = ['a3', 'a1'], extra: { note?: string; hint?: string } = {}) => ({
  title: 'Buổi 1',
  lessonId: 'float-or-sink',
  steps: steps.map((activityId) => ({
    activityId,
    ...(extra.note ? { note: extra.note } : {}),
    ...(extra.hint ? { hintQuestions: [extra.hint] } : {}),
  })),
});

describe('(a) kế hoạch phiên: soạn, sửa, xem, quyền', () => {
  it('giáo viên tạo/sửa/đọc/list; hiệu trưởng sửa được; version tăng', () => {
    const { svc, principalA, teacherA, schoolA } = world();
    const p = svc.createSessionPlan(teacherA.id, schoolA.id, planInput());
    expect(p).toMatchObject({ schoolId: schoolA.id, authorId: teacherA.id, lessonId: 'float-or-sink', version: 1 });
    expect(p.createdAt).toBe(p.updatedAt);
    expect(p.steps.map((s) => s.activityId)).toEqual(['a3', 'a1']);

    const u1 = svc.updateSessionPlan(teacherA.id, p.id, planInput(['a2']));
    expect(u1.version).toBe(2);
    expect(u1.updatedAt).toBeGreaterThan(u1.createdAt);
    const u2 = svc.updateSessionPlan(principalA.id, p.id, planInput(['a1', 'a2']));
    expect(u2.version).toBe(3);
    expect(u2.authorId).toBe(teacherA.id);

    expect(svc.sessionPlan(teacherA.id, p.id).steps.map((s) => s.activityId)).toEqual(['a1', 'a2']);
    expect(svc.sessionPlan(principalA.id, p.id).id).toBe(p.id);

    const p2 = svc.createSessionPlan(principalA.id, schoolA.id, planInput(['a1']));
    expect(svc.listSessionPlans(teacherA.id, schoolA.id).map((x) => x.id)).toEqual([p.id, p2.id]);
  });

  it('người ngoài quyền: giáo viên trường khác, hồ sơ trẻ, học sinh người lớn → FORBIDDEN', () => {
    const { svc, teacherA, teacherB, schoolA, schoolB, kid } = world();
    const p = svc.createSessionPlan(teacherA.id, schoolA.id, planInput());

    expect(code(() => svc.createSessionPlan(teacherB.id, schoolA.id, planInput()))).toBe('FORBIDDEN');
    expect(code(() => svc.sessionPlan(teacherB.id, p.id))).toBe('FORBIDDEN');
    expect(code(() => svc.listSessionPlans(teacherB.id, schoolA.id))).toBe('FORBIDDEN');
    expect(code(() => svc.updateSessionPlan(teacherB.id, p.id, planInput()))).toBe('FORBIDDEN');

    expect(code(() => svc.createSessionPlan(kid.id, schoolA.id, planInput()))).toBe('FORBIDDEN');
    expect(code(() => svc.sessionPlan(kid.id, p.id))).toBe('FORBIDDEN');
    expect(code(() => svc.listSessionPlans(kid.id, schoolA.id))).toBe('FORBIDDEN');
    expect(code(() => svc.updateSessionPlan(kid.id, p.id, planInput()))).toBe('FORBIDDEN');

    // học sinh người lớn (trường chơi) cũng không soạn/xem
    const classB = svc.createClass(teacherB.id, schoolB.id, { name: 'Lớp B2', capacity: 5 });
    const adultStudent = svc.registerUser({ displayName: 'Phụ huynh' });
    svc.enrollWithCode(adultStudent.id, classB.joinCode);
    const pb = svc.createSessionPlan(teacherB.id, schoolB.id, planInput());
    expect(code(() => svc.createSessionPlan(adultStudent.id, schoolB.id, planInput()))).toBe('FORBIDDEN');
    expect(code(() => svc.sessionPlan(adultStudent.id, pb.id))).toBe('FORBIDDEN');
    expect(code(() => svc.listSessionPlans(adultStudent.id, schoolB.id))).toBe('FORBIDDEN');
  });

  it('giáo viên khác cùng trường không sửa được kế hoạch của người khác; tác giả mất vai thì không sửa được', () => {
    const { svc, principalA, teacherA, schoolA } = world();
    const other = svc.registerUser({ displayName: 'GV A2' });
    svc.grantTeacher(principalA.id, schoolA.id, other.id);
    const p = svc.createSessionPlan(teacherA.id, schoolA.id, planInput());
    expect(code(() => svc.updateSessionPlan(other.id, p.id, planInput()))).toBe('FORBIDDEN');
    svc.revokeTeacher(principalA.id, schoolA.id, teacherA.id);
    expect(code(() => svc.updateSessionPlan(teacherA.id, p.id, planInput()))).toBe('FORBIDDEN');
  });

  it('bài học lạ / kế hoạch lạ → NOT_FOUND; đầu vào sai → INVALID', () => {
    const { svc, teacherA, schoolA } = world();
    expect(code(() => svc.createSessionPlan(teacherA.id, schoolA.id, { ...planInput(), lessonId: 'nope' }))).toBe('NOT_FOUND');
    expect(code(() => svc.createSessionPlan(teacherA.id, 'school-x', planInput()))).toBe('NOT_FOUND');
    expect(code(() => svc.updateSessionPlan(teacherA.id, 'plan-x', planInput()))).toBe('NOT_FOUND');
    expect(code(() => svc.sessionPlan(teacherA.id, 'plan-x'))).toBe('NOT_FOUND');
    expect(code(() => svc.createSessionPlan(teacherA.id, schoolA.id, planInput(['zzz'])))).toBe('INVALID');
  });

  it('audit ghi tạo và sửa', () => {
    const { svc, principalA, teacherA, schoolA } = world();
    const p = svc.createSessionPlan(teacherA.id, schoolA.id, planInput());
    svc.updateSessionPlan(principalA.id, p.id, planInput(['a1']));
    const ev = svc.schoolAudit(principalA.id, schoolA.id).filter((e) => e.action.startsWith('sessionPlan.'));
    expect(ev.map((e) => e.action)).toEqual(['sessionPlan.create', 'sessionPlan.update']);
    expect(ev.map((e) => e.actorId)).toEqual([teacherA.id, principalA.id]);
    expect(ev.every((e) => e.target === p.id)).toBe(true);
  });
});

describe('(b) mở phiên theo kế hoạch', () => {
  it('chụp danh sách hoạt động đúng thứ tự; sửa kế hoạch sau không đổi phiên; không lộ ghi chú/gợi ý', () => {
    const { svc, teacherA, schoolA, classA, kid } = world();
    const p = svc.createSessionPlan(teacherA.id, schoolA.id, planInput(['a3', 'a1'], { note: 'GHI-CHU-RIENG', hint: 'GOI-Y-RIENG?' }));
    const s = svc.startSession(teacherA.id, classA.id, 'float-or-sink', { planId: p.id });
    expect(s.planId).toBe(p.id);
    expect(s.planActivityIds).toEqual(['a3', 'a1']);

    svc.updateSessionPlan(teacherA.id, p.id, planInput(['a2']));
    expect(svc.session(s.id).planActivityIds).toEqual(['a3', 'a1']);

    const joined = svc.joinSession(kid.id, s.id);
    const dump = JSON.stringify(joined);
    expect(dump).not.toContain('GHI-CHU-RIENG');
    expect(dump).not.toContain('GOI-Y-RIENG');
    expect(Object.keys(joined).sort()).toEqual(
      ['chatMode', 'classId', 'currentActivityId', 'id', 'lessonId', 'participants', 'planActivityIds', 'planId', 'schoolId', 'startedAt', 'status', 'teacherId'].sort(),
    );

    const audit = svc.store.audit.find((e) => e.action === 'session.start');
    expect(audit?.detail).toEqual({ lessonId: 'float-or-sink', planId: p.id });
  });

  it('không có planId → không đặt hai key kế hoạch; mọi hoạt động của bài mở được', () => {
    const { svc, teacherA, classA } = world();
    const s = svc.startSession(teacherA.id, classA.id, 'float-or-sink');
    expect('planId' in s).toBe(false);
    expect('planActivityIds' in s).toBe(false);
    svc.setActivity(teacherA.id, s.id, 'a2');
    expect(svc.session(s.id).currentActivityId).toBe('a2');
  });

  it('kế hoạch trường khác → FORBIDDEN; bài lệch → INVALID; kế hoạch/bài lạ → NOT_FOUND', () => {
    const { svc, teacherA, teacherB, schoolB, classA } = world();
    const pb = svc.createSessionPlan(teacherB.id, schoolB.id, planInput());
    expect(code(() => svc.startSession(teacherA.id, classA.id, 'float-or-sink', { planId: pb.id }))).toBe('FORBIDDEN');

    const { svc: svc2, teacherA: t2, schoolA: sa2, classA: ca2 } = world();
    const p = svc2.createSessionPlan(t2.id, sa2.id, planInput());
    expect(code(() => svc2.startSession(t2.id, ca2.id, 'lost-apple', { planId: p.id }))).toBe('INVALID');
    expect(code(() => svc2.startSession(t2.id, ca2.id, 'float-or-sink', { planId: 'plan-x' }))).toBe('NOT_FOUND');
    expect(code(() => svc2.startSession(t2.id, ca2.id, 'nope'))).toBe('NOT_FOUND');
    // mở thất bại không để lại phiên live
    expect(code(() => svc2.startSession(t2.id, ca2.id, 'float-or-sink'))).toBe('OK');
  });

  it('setActivity ngoài kế hoạch → CONFLICT; ngoài bài → NOT_FOUND', () => {
    const { svc, teacherA, schoolA, classA } = world();
    const p = svc.createSessionPlan(teacherA.id, schoolA.id, planInput(['a3', 'a1']));
    const s = svc.startSession(teacherA.id, classA.id, 'float-or-sink', { planId: p.id });
    expect(code(() => svc.setActivity(teacherA.id, s.id, 'a2'))).toBe('CONFLICT');
    expect(code(() => svc.setActivity(teacherA.id, s.id, 'zzz'))).toBe('NOT_FOUND');
    expect(code(() => svc.setActivity(teacherA.id, s.id, 'a1'))).toBe('OK');
    expect(svc.session(s.id).currentActivityId).toBe('a1');
  });
});

describe('(c) nộp bài: chuẩn hoá, chấm, không lưu dữ liệu thô', () => {
  const live = () => {
    const w = world();
    const s = w.svc.startSession(w.teacherA.id, w.classA.id, 'float-or-sink');
    w.svc.joinSession(w.kid.id, s.id);
    return { ...w, s };
  };

  it('chữ tự do bị loại khỏi response lưu', () => {
    const { svc, teacherA, kid, s } = live();
    svc.setActivity(teacherA.id, s.id, 'a2');
    const raw = { kind: 'choice', optionId: 'duck', text: 'xin chào, nhà em ở số 5' };
    const r = svc.submitResult(kid.id, s.id, 'a2', raw);
    expect(r.response).toEqual({ kind: 'choice', optionId: 'duck' });
    expect('text' in r.response).toBe(false);
    expect(JSON.stringify(svc.store.results)).not.toContain('nhà em');
    expect(JSON.stringify([...svc.store.results.values()])).not.toContain('nhà em');
    expect(r.outcome).toBe('correct');
  });

  it('đáp án sai dạng → INVALID, không lưu, attempts không tăng', () => {
    const { svc, teacherA, kid, classA, s } = live();
    svc.setActivity(teacherA.id, s.id, 'a2');
    expect(code(() => svc.submitResult(kid.id, s.id, 'a2', 'duck'))).toBe('INVALID');
    expect(code(() => svc.submitResult(kid.id, s.id, 'a2', { kind: 'choice', optionId: 'cat' }))).toBe('INVALID');
    expect(svc.classProgress(teacherA.id, classA.id)).toHaveLength(0);

    svc.submitResult(kid.id, s.id, 'a2', choice('rock'));
    expect(code(() => svc.submitResult(kid.id, s.id, 'a2', { kind: 'order', ids: [] }))).toBe('INVALID');
    expect(svc.classProgress(teacherA.id, classA.id)).toHaveLength(1);
    expect(svc.classProgress(teacherA.id, classA.id)[0]?.attempts).toBe(1);
  });

  it('sai rồi đúng → attempts 2, outcome correct', () => {
    const { svc, teacherA, kid, s } = live();
    svc.setActivity(teacherA.id, s.id, 'a2');
    expect(svc.submitResult(kid.id, s.id, 'a2', choice('rock'))).toMatchObject({ outcome: 'incorrect', attempts: 1 });
    expect(svc.submitResult(kid.id, s.id, 'a2', choice('duck'))).toMatchObject({ outcome: 'correct', attempts: 2 });
  });

  it('hoạt động ghi nhận (dự đoán, cảnh truyện) → recorded', () => {
    const { svc, teacherA, kid, s } = live();
    svc.setActivity(teacherA.id, s.id, 'a1');
    expect(svc.submitResult(kid.id, s.id, 'a1', choice('float'))).toMatchObject({ outcome: 'recorded' });
    svc.setActivity(teacherA.id, s.id, 'a3');
    expect(svc.submitResult(kid.id, s.id, 'a3', { kind: 'done' })).toMatchObject({ outcome: 'recorded', response: { kind: 'done' } });
  });

  it('toStudentAck không lộ outcome thô', () => {
    const { svc, teacherA, kid, s } = live();
    svc.setActivity(teacherA.id, s.id, 'a2');
    const wrong = svc.submitResult(kid.id, s.id, 'a2', choice('rock'));
    const ack = toStudentAck(wrong);
    expect(ack).toEqual({ activityId: 'a2', feedback: 'try_again' });
    const dump = JSON.stringify(ack);
    expect(dump).not.toContain('incorrect');
    expect(dump).not.toContain('outcome');
    expect(dump).not.toContain('rock');
    expect(toStudentAck(svc.submitResult(kid.id, s.id, 'a2', choice('duck'))).feedback).toBe('praise');
  });
});

describe('(d) không truyền lessons → chỉ ghi nhận', () => {
  it('mọi submit là recorded với response {kind:"done"}', () => {
    const { svc, teacherA, classA, kid } = world(false);
    const s = svc.startSession(teacherA.id, classA.id, 'bat-ky-bai');
    svc.joinSession(kid.id, s.id);
    svc.setActivity(teacherA.id, s.id, 'bat-ky-hoat-dong');
    const r1 = svc.submitResult(kid.id, s.id, 'bat-ky-hoat-dong', 'bất kỳ thứ gì');
    expect(r1).toMatchObject({ outcome: 'recorded', response: { kind: 'done' } });
    const r2 = svc.submitResult(kid.id, s.id, 'bat-ky-hoat-dong', { kind: 'choice', optionId: 'x', text: 'chữ tự do' });
    expect(r2).toMatchObject({ outcome: 'recorded', response: { kind: 'done' }, attempts: 2 });
    expect(JSON.stringify(r2)).not.toContain('chữ tự do');
  });
});

describe('(e) trần người trong phiên', () => {
  const setup = () => {
    const svc = new SchoolService();
    const owner = svc.registerUser({ displayName: 'Chủ', planId: 'pilot' });
    const teacher = svc.registerUser({ displayName: 'GV' });
    const play = svc.createSchool(owner.id, { name: 'Trường chơi', level: 'primary' });
    svc.grantTeacher(owner.id, play.id, teacher.id);
    const k = svc.createClass(teacher.id, play.id, { name: 'Lớp 1', capacity: 20 });
    // giáo viên + hiệu trưởng + (MAX - 2) học sinh = MAX; thêm 1 học sinh nữa là tràn.
    const students = Array.from({ length: LIVE_SESSION_MAX_PARTICIPANTS - 1 }, (_, i) =>
      svc.registerUser({ displayName: `Người ${i + 1}` }),
    );
    students.forEach((p) => svc.enrollWithCode(p.id, k.joinCode));
    const s = svc.startSession(teacher.id, k.id, 'lost-apple');
    return { svc, owner, teacher, students, s };
  };

  it('hiệu trưởng vào phiên cũng chiếm một chỗ; người bị từ chối không nằm trong danh sách', () => {
    const { svc, owner, students, s } = setup();
    svc.joinSession(owner.id, s.id);
    expect(svc.session(s.id).participants).toHaveLength(2);

    const fit = students.slice(0, LIVE_SESSION_MAX_PARTICIPANTS - 2);
    fit.forEach((p) => svc.joinSession(p.id, s.id));
    expect(svc.session(s.id).participants).toHaveLength(LIVE_SESSION_MAX_PARTICIPANTS);

    const rejected = students[students.length - 1]!;
    expect(code(() => svc.joinSession(rejected.id, s.id))).toBe('QUOTA');
    const after = svc.session(s.id).participants;
    expect(after).toHaveLength(LIVE_SESSION_MAX_PARTICIPANTS);
    expect(after).not.toContain(rejected.id);
  });

  it('người đã ở trong vào lại khi đầy vẫn OK và không tính thêm', () => {
    const { svc, owner, students, s } = setup();
    svc.joinSession(owner.id, s.id);
    students.slice(0, LIVE_SESSION_MAX_PARTICIPANTS - 2).forEach((p) => svc.joinSession(p.id, s.id));
    expect(code(() => svc.joinSession(owner.id, s.id))).toBe('OK');
    expect(code(() => svc.joinSession(students[0]!.id, s.id))).toBe('OK');
    expect(svc.session(s.id).participants).toHaveLength(LIVE_SESSION_MAX_PARTICIPANTS);
  });
});
