import { describe, expect, it } from 'vitest';
import { checkChat, DomainError, RateLimiter, SchoolService } from '../src';

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as DomainError).code;
  }
  return 'OK';
};

describe('checkChat — chính sách thuần', () => {
  const child = { ageBand: 'child' as const };
  const adult = { ageBand: 'adult' as const };

  it('trẻ không bao giờ gõ chữ tự do, kể cả chế độ open', () => {
    expect(code(() => checkChat(child, 'student', 'open', { kind: 'text', text: 'chào' }))).toBe('FORBIDDEN');
    expect(code(() => checkChat(child, 'student', 'open', { kind: 'phrase', phraseId: 'hello' }))).toBe('OK');
  });

  it('chỉ nhận câu/sticker trong danh mục duyệt sẵn', () => {
    expect(code(() => checkChat(child, 'student', 'phrases', { kind: 'phrase', phraseId: 'tự-chế' }))).toBe('INVALID');
    expect(code(() => checkChat(child, 'student', 'phrases', { kind: 'sticker', stickerId: 'star' }))).toBe('OK');
  });

  it('chế độ off chỉ giáo viên gửi; phrases chỉ giáo viên gõ chữ', () => {
    expect(code(() => checkChat(adult, 'student', 'off', { kind: 'phrase', phraseId: 'hello' }))).toBe('FORBIDDEN');
    expect(code(() => checkChat(adult, 'teacher', 'off', { kind: 'text', text: 'Cả lớp chú ý' }))).toBe('OK');
    expect(code(() => checkChat(adult, 'student', 'phrases', { kind: 'text', text: 'hi' }))).toBe('FORBIDDEN');
    expect(code(() => checkChat(adult, 'student', 'open', { kind: 'text', text: 'hi' }))).toBe('OK');
  });

  it('chuẩn hoá chữ và chặn tin quá dài', () => {
    expect(checkChat(adult, 'teacher', 'open', { kind: 'text', text: '  a\u0007  b ' })).toEqual({ kind: 'text', text: 'a b' });
    expect(code(() => checkChat(adult, 'teacher', 'open', { kind: 'text', text: 'x'.repeat(201) }))).toBe('INVALID');
  });
});

describe('RateLimiter', () => {
  it('cho 5 tin liên tiếp rồi chặn, hồi theo thời gian', () => {
    const rl = new RateLimiter(5, 1 / 3000);
    for (let i = 0; i < 5; i++) rl.take('u', 0);
    expect(code(() => rl.take('u', 0))).toBe('RATE_LIMITED');
    expect(code(() => rl.take('u', 3000))).toBe('OK');
  });
});

describe('chat trong phiên + báo cáo', () => {
  it('học sinh gửi câu duyệt sẵn, báo cáo đến hiệu trưởng, giáo viên ẩn được tin', () => {
    let t = 0;
    const svc = new SchoolService({ clock: () => (t += 10_000) });
    const admin = svc.registerUser({ displayName: 'Quản trị', platformAdmin: true });
    const owner = svc.registerUser({ displayName: 'Chủ', planId: 'pilot' });
    const teacher = svc.registerUser({ displayName: 'Cô' });
    const school = svc.createSchool(owner.id, { name: 'Trường', level: 'kindergarten', kind: 'organization' });
    svc.verifyOrganization(admin.id, school.id);
    svc.grantTeacher(owner.id, school.id, teacher.id);
    const klass = svc.createClass(teacher.id, school.id, { name: 'Lá 2', capacity: 10 });
    const kid = svc.createManagedStudent(teacher.id, klass.id, 'Bé Bông');
    const s = svc.startSession(teacher.id, klass.id, 'lost-apple');
    svc.joinSession(kid.id, s.id);

    const msg = svc.sendChat(kid.id, s.id, { kind: 'sticker', stickerId: 'heart' });
    expect(code(() => svc.sendChat(kid.id, s.id, { kind: 'text', text: 'abc' }))).toBe('FORBIDDEN');

    svc.report(teacher.id, msg.id, 'thử quy trình');
    expect(svc.schoolReports(owner.id, school.id)).toHaveLength(1);
    expect(code(() => svc.schoolReports(teacher.id, school.id))).toBe('FORBIDDEN');

    svc.hideMessage(teacher.id, msg.id);
    expect(svc.chatLog(kid.id, s.id)).toHaveLength(0);
    expect(code(() => svc.hideMessage(kid.id, msg.id))).toBe('FORBIDDEN');
  });
});
