import { describe, expect, it } from 'vitest';
import {
  normalizeSessionPlanInput,
  SESSION_PLAN_LIMITS as L,
  type LessonOutline,
  type SessionPlanInput,
} from '../src/session-plan';
import { DomainError } from '../src/errors';

const lesson: LessonOutline = { lessonId: 'colors-1', activityIds: ['a1', 'a2', 'a3'] };

const mk = (over: Partial<SessionPlanInput> = {}): SessionPlanInput => ({
  title: 'Buổi học màu sắc',
  lessonId: 'colors-1',
  steps: [{ activityId: 'a1' }],
  ...over,
});

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof DomainError ? e.code : 'OTHER';
  }
  return 'OK';
};

const deepFreeze = <T>(o: T): T => {
  if (typeof o === 'object' && o !== null) {
    Object.values(o).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
};

const bad = (input: unknown) => code(() => normalizeSessionPlanInput(input as SessionPlanInput, lesson));
const steps = (n: number) => Array.from({ length: n }, (_, i) => ({ activityId: `x${i}` }));

describe('normalizeSessionPlanInput', () => {
  it('hợp lệ tối thiểu: không có key note, hint là []', () => {
    const out = normalizeSessionPlanInput(mk(), lesson);
    expect(out).toEqual({
      title: 'Buổi học màu sắc',
      lessonId: 'colors-1',
      steps: [{ activityId: 'a1', hintQuestions: [] }],
    });
    expect('note' in out.steps[0]!).toBe(false);
  });

  it('gộp khoảng trắng ở title', () => {
    expect(normalizeSessionPlanInput(mk({ title: '  Màu   sắc \n vui ' }), lesson).title).toBe('Màu sắc vui');
  });

  it('title toàn khoảng trắng hoặc 61 ký tự bị từ chối; 60 ký tự được', () => {
    expect(bad(mk({ title: '   \n ' }))).toBe('INVALID');
    expect(bad(mk({ title: 'a'.repeat(L.titleMax + 1) }))).toBe('INVALID');
    expect(bad(mk({ title: 'a'.repeat(L.titleMax) }))).toBe('OK');
  });

  it('lessonId lệch bị từ chối', () => {
    expect(bad(mk({ lessonId: 'other' }))).toBe('INVALID');
  });

  it('0 bước / 31 bước bị từ chối; 30 bước được', () => {
    const big: LessonOutline = { lessonId: 'colors-1', activityIds: steps(40).map((s) => s.activityId) };
    expect(bad(mk({ steps: [] }))).toBe('INVALID');
    expect(code(() => normalizeSessionPlanInput(mk({ steps: steps(L.stepsMax + 1) }), big))).toBe('INVALID');
    expect(code(() => normalizeSessionPlanInput(mk({ steps: steps(L.stepsMax) }), big))).toBe('OK');
  });

  it('activityId lạ hoặc trùng bị từ chối', () => {
    expect(bad(mk({ steps: [{ activityId: 'zzz' }] }))).toBe('INVALID');
    expect(bad(mk({ steps: [{ activityId: 'a1' }, { activityId: 'a1' }] }))).toBe('INVALID');
  });

  it('note 501 ký tự bị từ chối; 500 được', () => {
    expect(bad(mk({ steps: [{ activityId: 'a1', note: 'n'.repeat(L.noteMax + 1) }] }))).toBe('INVALID');
    expect(bad(mk({ steps: [{ activityId: 'a1', note: 'n'.repeat(L.noteMax) }] }))).toBe('OK');
  });

  it('note: bỏ ký tự điều khiển, giữ \\n, trim; rỗng thì bỏ key', () => {
    const out = normalizeSessionPlanInput(mk({ steps: [{ activityId: 'a1', note: '  dòng 1\u0007\ndòng 2  ' }] }), lesson);
    expect(out.steps[0]!.note).toBe('dòng 1\ndòng 2');
    const empty = normalizeSessionPlanInput(mk({ steps: [{ activityId: 'a1', note: ' \u0007 ' }] }), lesson);
    expect('note' in empty.steps[0]!).toBe(false);
  });

  it('hint: lọc câu rỗng, gộp khoảng trắng', () => {
    const out = normalizeSessionPlanInput(
      mk({ steps: [{ activityId: 'a1', hintQuestions: ['  Màu   gì? ', '', '   '] }] }),
      lesson,
    );
    expect(out.steps[0]!.hintQuestions).toEqual(['Màu gì?']);
  });

  it('6 hint bị từ chối; 5 hint được; 5 thật + rỗng vẫn được', () => {
    const five = ['1', '2', '3', '4', '5'];
    expect(bad(mk({ steps: [{ activityId: 'a1', hintQuestions: [...five, '6'] }] }))).toBe('INVALID');
    expect(bad(mk({ steps: [{ activityId: 'a1', hintQuestions: five }] }))).toBe('OK');
    expect(bad(mk({ steps: [{ activityId: 'a1', hintQuestions: [...five, ' '] }] }))).toBe('OK');
  });

  it('hint 201 ký tự bị từ chối; 200 được', () => {
    expect(bad(mk({ steps: [{ activityId: 'a1', hintQuestions: ['h'.repeat(L.hintMax + 1)] }] }))).toBe('INVALID');
    expect(bad(mk({ steps: [{ activityId: 'a1', hintQuestions: ['h'.repeat(L.hintMax)] }] }))).toBe('OK');
  });

  it('giá trị sai kiểu bị từ chối', () => {
    expect(bad({ ...mk(), title: 123 })).toBe('INVALID');
    expect(bad({ ...mk(), lessonId: 5 })).toBe('INVALID');
    expect(bad({ ...mk(), steps: 'a1' })).toBe('INVALID');
    expect(bad({ ...mk(), steps: { length: 1 } })).toBe('INVALID');
    expect(bad(mk({ steps: [null as never] }))).toBe('INVALID');
    expect(bad(mk({ steps: [{ activityId: 1 as never }] }))).toBe('INVALID');
    expect(bad(mk({ steps: [{ activityId: 'a1', note: 7 as never }] }))).toBe('INVALID');
    expect(bad(mk({ steps: [{ activityId: 'a1', note: null as never }] }))).toBe('INVALID');
    expect(bad(mk({ steps: [{ activityId: 'a1', hintQuestions: 'x' as never }] }))).toBe('INVALID');
    expect(bad(mk({ steps: [{ activityId: 'a1', hintQuestions: [1 as never] }] }))).toBe('INVALID');
    expect(bad(null)).toBe('INVALID');
    expect(bad(undefined)).toBe('INVALID');
  });

  it('giữ đúng thứ tự bước giáo viên đưa', () => {
    const out = normalizeSessionPlanInput(
      mk({ steps: [{ activityId: 'a3' }, { activityId: 'a1' }, { activityId: 'a2' }] }),
      lesson,
    );
    expect(out.steps.map((s) => s.activityId)).toEqual(['a3', 'a1', 'a2']);
  });

  it('không mutate đầu vào và trả đối tượng mới', () => {
    const input = deepFreeze(
      mk({
        title: '  Tên  ',
        steps: [{ activityId: 'a1', note: ' ghi chú ', hintQuestions: [' q1 ', ''] }, { activityId: 'a2' }],
      }),
    );
    const snapshot = JSON.stringify(input);
    const out = normalizeSessionPlanInput(input, lesson);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(out.steps).not.toBe(input.steps);
    expect(out.steps[0]).not.toBe(input.steps[0]);
    expect(out.steps[0]!.hintQuestions).not.toBe(input.steps[0]!.hintQuestions);
  });
});
