import { describe, expect, it } from 'vitest';
import {
  answerKeysFromPackage,
  createGrader,
  gradeResponse,
  lessonLookupFrom,
  recordOnlyGrader,
  toStudentAck,
  type GradableActivity,
  type GradablePackage,
} from '../src/grading';
import type { DomainError } from '../src/errors';

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as DomainError).code;
  }
  return 'OK';
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const opts = (...ids: string[]) => ids.map((id) => ({ id }));

function makePackage(): GradablePackage {
  const choice = (id: string, type: string): GradableActivity => ({
    id,
    type,
    options: opts('a', 'b', 'c'),
    correctAnswer: 'b',
  });
  return {
    lesson: { id: 'les-1' },
    scenarios: [
      {
        activities: [
          { id: 'ss', type: 'story_scene' },
          { id: 'ex', type: 'explore' },
          choice('oi', 'object_identification'),
          choice('ci', 'character_identification'),
          choice('ai', 'action_identification'),
          choice('ws', 'word_selection'),
          choice('cmp', 'comparison'),
          choice('ce', 'cause_effect'),
        ],
      },
      {
        activities: [
          { id: 'seq', type: 'sequence', cards: opts('c1', 'c2', 'c3'), correctOrder: ['c2', 'c1', 'c3'] },
          { id: 'sb', type: 'sentence_builder', blocks: opts('w1', 'w2', 'w3'), correctOrder: ['w1', 'w2', 'w3'] },
          { id: 'sr', type: 'story_recall' },
          { id: 'pr', type: 'prediction', options: opts('x', 'y') },
          { id: 'exp', type: 'experiment' },
          {
            id: 'clsC',
            type: 'classification',
            mode: 'check',
            categories: opts('sink', 'float'),
            items: [
              { id: 'i1', category: 'sink' },
              { id: 'i2', category: 'float' },
              { id: 'i3', category: 'float' },
            ],
          },
          {
            id: 'clsP',
            type: 'classification',
            mode: 'predict',
            categories: opts('sink', 'float'),
            items: [
              { id: 'j1', category: 'sink' },
              { id: 'j2', category: 'float' },
            ],
          },
        ],
      },
    ],
  };
}

const withActivities = (...acts: GradableActivity[]): GradablePackage => ({
  lesson: { id: 'x' },
  scenarios: [{ activities: acts }],
});

const grader = () => createGrader(lessonLookupFrom([answerKeysFromPackage(makePackage())]));

describe('answerKeysFromPackage', () => {
  it('dựng khoá cho đủ 14 loại, activityIds theo thứ tự xuất hiện', () => {
    const k = answerKeysFromPackage(makePackage());
    expect(k.lessonId).toBe('les-1');
    expect(k.activityIds).toEqual([
      'ss', 'ex', 'oi', 'ci', 'ai', 'ws', 'cmp', 'ce', 'seq', 'sb', 'sr', 'pr', 'exp', 'clsC', 'clsP',
    ]);
    expect(Object.keys(k.keys)).toHaveLength(15);
    expect(k.keys['oi']).toEqual({ expects: 'choice', options: ['a', 'b', 'c'], correct: 'b' });
    expect(k.keys['pr']).toEqual({ expects: 'choice', options: ['x', 'y'] });
    expect(k.keys['seq']).toEqual({ expects: 'order', ids: ['c1', 'c2', 'c3'], correct: ['c2', 'c1', 'c3'] });
    expect(k.keys['clsC']).toEqual({
      expects: 'placements',
      categories: ['sink', 'float'],
      answer: { i1: 'sink', i2: 'float', i3: 'float' },
      graded: true,
    });
    expect((k.keys['clsP'] as { graded: boolean }).graded).toBe(false);
    expect(k.keys['ss']).toEqual({ expects: 'done' });
  });

  it('gói lỗi → INVALID', () => {
    expect(code(() => answerKeysFromPackage(withActivities({ id: 'z', type: 'hologram' })))).toBe('INVALID');
    expect(
      code(() => answerKeysFromPackage(withActivities({ id: 'd', type: 'explore' }, { id: 'd', type: 'explore' }))),
    ).toBe('INVALID');
    expect(
      code(() =>
        answerKeysFromPackage(
          withActivities({ id: 'q', type: 'comparison', options: opts('a', 'b'), correctAnswer: 'zzz' }),
        ),
      ),
    ).toBe('INVALID');
    expect(code(() => answerKeysFromPackage(withActivities({ id: 'q', type: 'comparison', options: opts('a', 'b') })))).toBe(
      'INVALID',
    );
    expect(
      code(() =>
        answerKeysFromPackage(
          withActivities({ id: 's', type: 'sequence', cards: opts('a', 'b', 'c'), correctOrder: ['a', 'b', 'x'] }),
        ),
      ),
    ).toBe('INVALID');
    expect(
      code(() =>
        answerKeysFromPackage(
          withActivities({ id: 's', type: 'sequence', cards: opts('a', 'b', 'c'), correctOrder: ['a', 'b'] }),
        ),
      ),
    ).toBe('INVALID');
    expect(
      code(() =>
        answerKeysFromPackage(
          withActivities({
            id: 'k',
            type: 'classification',
            mode: 'check',
            categories: opts('a', 'b'),
            items: [{ id: 'i', category: 'nope' }],
          }),
        ),
      ),
    ).toBe('INVALID');
  });
});

describe('lessonLookupFrom / createGrader', () => {
  it('lessonId trùng → INVALID', () => {
    const k = answerKeysFromPackage(makePackage());
    expect(code(() => lessonLookupFrom([k, k]))).toBe('INVALID');
  });

  it('lesson/activity lạ → NOT_FOUND', () => {
    const g = grader();
    expect(code(() => g('nope', 'oi', { kind: 'choice', optionId: 'a' }))).toBe('NOT_FOUND');
    expect(code(() => g('les-1', 'nope', { kind: 'choice', optionId: 'a' }))).toBe('NOT_FOUND');
    expect(code(() => g('les-1', 'constructor', { kind: 'done' }))).toBe('NOT_FOUND');
  });
});

describe('chấm choice', () => {
  const g = grader();
  it('đúng / sai', () => {
    expect(g('les-1', 'oi', { kind: 'choice', optionId: 'b' })).toEqual({
      outcome: 'correct',
      response: { kind: 'choice', optionId: 'b' },
    });
    expect(g('les-1', 'cmp', { kind: 'choice', optionId: 'a' }).outcome).toBe('incorrect');
  });
  it('optionId lạ / raw trần / sai kind → INVALID', () => {
    expect(code(() => g('les-1', 'oi', { kind: 'choice', optionId: 'zzz' }))).toBe('INVALID');
    expect(code(() => g('les-1', 'oi', { kind: 'choice', optionId: 5 }))).toBe('INVALID');
    expect(code(() => g('les-1', 'oi', 'b'))).toBe('INVALID');
    expect(code(() => g('les-1', 'oi', null))).toBe('INVALID');
    expect(code(() => g('les-1', 'oi', ['b']))).toBe('INVALID');
    expect(code(() => g('les-1', 'oi', { kind: 'order', ids: [] }))).toBe('INVALID');
  });
  it('trường thừa (chữ tự do) bị loại khỏi response', () => {
    const r = g('les-1', 'oi', { kind: 'choice', optionId: 'b', text: 'xin chào cô giáo' });
    expect(r.response).toEqual({ kind: 'choice', optionId: 'b' });
    expect(Object.keys(r.response)).toEqual(['kind', 'optionId']);
  });
  it('prediction luôn recorded', () => {
    expect(g('les-1', 'pr', { kind: 'choice', optionId: 'x' }).outcome).toBe('recorded');
    expect(g('les-1', 'pr', { kind: 'choice', optionId: 'y' }).outcome).toBe('recorded');
    expect(code(() => g('les-1', 'pr', { kind: 'choice', optionId: 'a' }))).toBe('INVALID');
  });
});

describe('chấm order', () => {
  const g = grader();
  it('đúng / sai thứ tự', () => {
    expect(g('les-1', 'seq', { kind: 'order', ids: ['c2', 'c1', 'c3'] }).outcome).toBe('correct');
    expect(g('les-1', 'seq', { kind: 'order', ids: ['c1', 'c2', 'c3'] }).outcome).toBe('incorrect');
    expect(g('les-1', 'sb', { kind: 'order', ids: ['w1', 'w2', 'w3'] }).outcome).toBe('correct');
  });
  it('thiếu / trùng / lạ / sai kiểu → INVALID', () => {
    expect(code(() => g('les-1', 'seq', { kind: 'order', ids: ['c2', 'c1'] }))).toBe('INVALID');
    expect(code(() => g('les-1', 'seq', { kind: 'order', ids: ['c2', 'c2', 'c3'] }))).toBe('INVALID');
    expect(code(() => g('les-1', 'seq', { kind: 'order', ids: ['c2', 'c1', 'zz'] }))).toBe('INVALID');
    expect(code(() => g('les-1', 'seq', { kind: 'order', ids: ['c2', 'c1', 3] }))).toBe('INVALID');
    expect(code(() => g('les-1', 'seq', { kind: 'order', ids: 'c2c1c3' }))).toBe('INVALID');
  });
  it('response là mảng mới, trường thừa bị loại', () => {
    const ids = ['c2', 'c1', 'c3'];
    const r = g('les-1', 'seq', { kind: 'order', ids, note: 'hi' });
    expect(r.response).toEqual({ kind: 'order', ids: ['c2', 'c1', 'c3'] });
    expect((r.response as { ids: string[] }).ids).not.toBe(ids);
  });
});

describe('chấm classification', () => {
  const g = grader();
  it('check: đủ-đúng → correct, key response được sắp xếp', () => {
    const r = g('les-1', 'clsC', { kind: 'placements', placements: { i3: 'float', i1: 'sink', i2: 'float' } });
    expect(r.outcome).toBe('correct');
    expect(Object.keys((r.response as { placements: object }).placements)).toEqual(['i1', 'i2', 'i3']);
  });
  it('check: sai một item → incorrect; thiếu một item → incorrect', () => {
    expect(
      g('les-1', 'clsC', { kind: 'placements', placements: { i1: 'float', i2: 'float', i3: 'float' } }).outcome,
    ).toBe('incorrect');
    expect(g('les-1', 'clsC', { kind: 'placements', placements: { i1: 'sink', i2: 'float' } }).outcome).toBe(
      'incorrect',
    );
  });
  it('category lạ / item lạ / rỗng / sai kiểu → INVALID', () => {
    expect(code(() => g('les-1', 'clsC', { kind: 'placements', placements: { i1: 'lava' } }))).toBe('INVALID');
    expect(code(() => g('les-1', 'clsC', { kind: 'placements', placements: { zz: 'sink' } }))).toBe('INVALID');
    expect(code(() => g('les-1', 'clsC', { kind: 'placements', placements: {} }))).toBe('INVALID');
    expect(code(() => g('les-1', 'clsC', { kind: 'placements', placements: [] }))).toBe('INVALID');
    expect(code(() => g('les-1', 'clsC', { kind: 'placements', placements: { i1: 7 } }))).toBe('INVALID');
    expect(code(() => g('les-1', 'clsC', JSON.parse('{"kind":"placements","placements":{"__proto__":"sink"}}')))).toBe(
      'INVALID',
    );
  });
  it('predict → recorded', () => {
    expect(g('les-1', 'clsP', { kind: 'placements', placements: { j1: 'float', j2: 'float' } }).outcome).toBe(
      'recorded',
    );
    expect(g('les-1', 'clsP', { kind: 'placements', placements: { j1: 'sink' } }).outcome).toBe('recorded');
  });
});

describe('done-type & recordOnlyGrader', () => {
  const g = grader();
  it('story_scene/explore/story_recall/experiment → recorded', () => {
    for (const id of ['ss', 'ex', 'sr', 'exp']) {
      expect(g('les-1', id, { kind: 'done', text: 'abc' })).toEqual({ outcome: 'recorded', response: { kind: 'done' } });
    }
    expect(code(() => g('les-1', 'ss', { kind: 'choice', optionId: 'a' }))).toBe('INVALID');
  });
  it('recordOnlyGrader bỏ qua raw', () => {
    expect(recordOnlyGrader('l', 'a', 'bất kỳ gì')).toEqual({ outcome: 'recorded', response: { kind: 'done' } });
  });
});

describe('toStudentAck', () => {
  it('ánh xạ phản hồi, chỉ có activityId + feedback', () => {
    expect(toStudentAck({ activityId: 'a', outcome: 'correct' })).toEqual({ activityId: 'a', feedback: 'praise' });
    expect(toStudentAck({ activityId: 'a', outcome: 'incorrect' })).toEqual({ activityId: 'a', feedback: 'try_again' });
    expect(toStudentAck({ activityId: 'a', outcome: 'recorded' })).toEqual({ activityId: 'a', feedback: 'thanks' });
    for (const outcome of ['correct', 'incorrect', 'recorded'] as const) {
      const ack = toStudentAck({ activityId: 'a', outcome, extra: 'điểm 10', rank: 1 } as never);
      expect(Object.keys(ack).sort()).toEqual(['activityId', 'feedback']);
    }
  });
});

describe('tất định & không mutate', () => {
  it('gọi 2 lần cho kết quả toEqual, đầu vào nguyên vẹn', () => {
    const pkg = makePackage();
    const pkgSnap = clone(pkg);
    const k1 = answerKeysFromPackage(pkg);
    const k2 = answerKeysFromPackage(pkg);
    expect(k1).toEqual(k2);
    expect(pkg).toEqual(pkgSnap);

    const keysSnap = clone(k1);
    const g = createGrader(lessonLookupFrom([k1]));
    const raws: Array<[string, unknown]> = [
      ['oi', { kind: 'choice', optionId: 'b', text: 'x' }],
      ['seq', { kind: 'order', ids: ['c2', 'c1', 'c3'], text: 'x' }],
      ['clsC', { kind: 'placements', placements: { i2: 'float', i1: 'sink' }, text: 'x' }],
      ['ss', { kind: 'done' }],
    ];
    for (const [id, raw] of raws) {
      const snap = clone(raw);
      expect(g('les-1', id, raw)).toEqual(g('les-1', id, raw));
      expect(raw).toEqual(snap);
    }
    expect(k1).toEqual(keysSnap);
    const key = k1.keys['oi']!;
    const raw = { kind: 'choice', optionId: 'a' };
    expect(gradeResponse(key, raw)).toEqual(gradeResponse(key, raw));
    expect(gradeResponse(key, raw).response).not.toBe(raw);
  });
});
