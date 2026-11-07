import { invalid, notFound } from './errors';
import type { Outcome } from './types';

/**
 * Chấm bài thuần: khoá chấm dựng từ gói bài, chuẩn hoá đáp án của học sinh (chỉ giữ trường đã biết,
 * loại mọi chữ tự do), chấm, và phản hồi cho trẻ không lộ đáp án/điểm/hạng.
 */

export type NormalizedResponse =
  | { kind: 'choice'; optionId: string }
  | { kind: 'order'; ids: string[] }
  | { kind: 'placements'; placements: Record<string, string> }
  | { kind: 'done' };

export interface Graded {
  outcome: Outcome;
  response: NormalizedResponse;
}

export type Grader = (lessonId: string, activityId: string, response: unknown) => Graded;

export type ActivityKey =
  | { expects: 'choice'; options: string[]; correct?: string } // không có correct → recorded
  | { expects: 'order'; ids: string[]; correct: string[] }
  | { expects: 'placements'; categories: string[]; answer: Record<string, string>; graded: boolean }
  | { expects: 'done' };

export interface LessonAnswerKeys {
  lessonId: string;
  activityIds: string[];
  keys: Record<string, ActivityKey>;
}

export type LessonLookup = (lessonId: string) => LessonAnswerKeys | undefined;

export interface GradableActivity {
  id: string;
  type: string;
  options?: ReadonlyArray<{ id: string }>;
  correctAnswer?: string;
  cards?: ReadonlyArray<{ id: string }>;
  blocks?: ReadonlyArray<{ id: string }>;
  correctOrder?: readonly string[];
  mode?: string;
  categories?: ReadonlyArray<{ id: string }>;
  items?: ReadonlyArray<{ id: string; category: string }>;
}

export interface GradablePackage {
  lesson: { id: string };
  scenarios: ReadonlyArray<{ activities: ReadonlyArray<GradableActivity> }>;
}

const CHOICE_TYPES: ReadonlySet<string> = new Set([
  'object_identification',
  'character_identification',
  'action_identification',
  'word_selection',
  'comparison',
  'cause_effect',
]);
const DONE_TYPES: ReadonlySet<string> = new Set(['story_scene', 'explore', 'story_recall', 'experiment']);

const has = (o: object, k: string): boolean => Object.hasOwn(o, k);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function uniqueIds(what: string, ids: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id !== 'string' || id === '' || id === '__proto__') throw invalid(`${what}: id không hợp lệ`);
    if (seen.has(id)) throw invalid(`${what}: id trùng "${id}"`);
    seen.add(id);
  }
  return [...ids];
}

function isPermutation(candidate: readonly string[], base: readonly string[]): boolean {
  if (candidate.length !== base.length) return false;
  const baseSet = new Set(base);
  const seen = new Set<string>();
  for (const id of candidate) {
    if (!baseSet.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

function keyForActivity(a: GradableActivity): ActivityKey {
  const where = `hoạt động "${a.id}"`;
  if (CHOICE_TYPES.has(a.type)) {
    if (!a.options || a.correctAnswer === undefined) throw invalid(`${where}: thiếu options/correctAnswer`);
    const options = uniqueIds(where, a.options.map((o) => o.id));
    if (!options.includes(a.correctAnswer)) throw invalid(`${where}: correctAnswer không thuộc options`);
    return { expects: 'choice', options, correct: a.correctAnswer };
  }
  if (a.type === 'prediction') {
    if (!a.options) throw invalid(`${where}: thiếu options`);
    return { expects: 'choice', options: uniqueIds(where, a.options.map((o) => o.id)) };
  }
  if (a.type === 'sequence' || a.type === 'sentence_builder') {
    const parts = a.type === 'sequence' ? a.cards : a.blocks;
    if (!parts || !a.correctOrder) throw invalid(`${where}: thiếu phần tử/correctOrder`);
    const ids = uniqueIds(where, parts.map((p) => p.id));
    if (!isPermutation(a.correctOrder, ids)) throw invalid(`${where}: correctOrder không phải hoán vị`);
    return { expects: 'order', ids, correct: [...a.correctOrder] };
  }
  if (a.type === 'classification') {
    if (!a.categories || !a.items) throw invalid(`${where}: thiếu categories/items`);
    const categories = uniqueIds(where, a.categories.map((c) => c.id));
    const itemIds = uniqueIds(where, a.items.map((i) => i.id));
    const entries: Array<[string, string]> = [];
    a.items.forEach((item, idx) => {
      if (!categories.includes(item.category)) throw invalid(`${where}: category không thuộc categories`);
      entries.push([itemIds[idx] as string, item.category]);
    });
    return { expects: 'placements', categories, answer: Object.fromEntries(entries), graded: a.mode === 'check' };
  }
  if (DONE_TYPES.has(a.type)) return { expects: 'done' };
  throw invalid(`${where}: loại hoạt động chưa hỗ trợ "${a.type}"`);
}

export function answerKeysFromPackage(pkg: GradablePackage): LessonAnswerKeys {
  const activityIds: string[] = [];
  const entries: Array<[string, ActivityKey]> = [];
  const seen = new Set<string>();
  for (const scenario of pkg.scenarios) {
    for (const a of scenario.activities) {
      if (seen.has(a.id)) throw invalid(`gói bài "${pkg.lesson.id}": hoạt động trùng id "${a.id}"`);
      if (a.id === '__proto__') throw invalid('id hoạt động không hợp lệ');
      seen.add(a.id);
      activityIds.push(a.id);
      entries.push([a.id, keyForActivity(a)]);
    }
  }
  return { lessonId: pkg.lesson.id, activityIds, keys: Object.fromEntries(entries) };
}

export function lessonLookupFrom(list: readonly LessonAnswerKeys[]): LessonLookup {
  const map = new Map<string, LessonAnswerKeys>();
  for (const l of list) {
    if (map.has(l.lessonId)) throw invalid(`bài học trùng id "${l.lessonId}"`);
    map.set(l.lessonId, l);
  }
  return (lessonId) => map.get(lessonId);
}

export function gradeResponse(key: ActivityKey, raw: unknown): Graded {
  if (!isRecord(raw) || raw['kind'] !== key.expects) throw invalid('đáp án không đúng dạng của hoạt động');

  switch (key.expects) {
    case 'choice': {
      const optionId = raw['optionId'];
      if (typeof optionId !== 'string' || !key.options.includes(optionId)) throw invalid('lựa chọn không hợp lệ');
      const response: NormalizedResponse = { kind: 'choice', optionId };
      if (key.correct === undefined) return { outcome: 'recorded', response };
      return { outcome: optionId === key.correct ? 'correct' : 'incorrect', response };
    }
    case 'order': {
      const ids = raw['ids'];
      if (!Array.isArray(ids) || !ids.every((x): x is string => typeof x === 'string')) {
        throw invalid('thứ tự không hợp lệ');
      }
      if (!isPermutation(ids, key.ids)) throw invalid('thứ tự phải gồm đủ từng phần tử đúng một lần');
      const copy = [...ids];
      const ok = copy.every((id, i) => id === key.correct[i]);
      return { outcome: ok ? 'correct' : 'incorrect', response: { kind: 'order', ids: copy } };
    }
    case 'placements': {
      const p = raw['placements'];
      if (!isRecord(p)) throw invalid('phân loại không hợp lệ');
      const itemIds = Object.keys(p).sort();
      if (itemIds.length === 0) throw invalid('phân loại rỗng');
      const entries: Array<[string, string]> = [];
      for (const itemId of itemIds) {
        const cat = p[itemId];
        if (!has(key.answer, itemId)) throw invalid('mục phân loại không hợp lệ');
        if (typeof cat !== 'string' || !key.categories.includes(cat)) throw invalid('nhóm phân loại không hợp lệ');
        entries.push([itemId, cat]);
      }
      const placements: Record<string, string> = Object.fromEntries(entries);
      const response: NormalizedResponse = { kind: 'placements', placements };
      if (!key.graded) return { outcome: 'recorded', response };
      const complete = entries.length === Object.keys(key.answer).length;
      const allMatch = entries.every(([itemId, cat]) => key.answer[itemId] === cat);
      return { outcome: complete && allMatch ? 'correct' : 'incorrect', response };
    }
    case 'done':
      return { outcome: 'recorded', response: { kind: 'done' } };
  }
}

export function createGrader(lookup: LessonLookup): Grader {
  return (lessonId, activityId, response) => {
    const lesson = lookup(lessonId);
    if (!lesson) throw notFound('bài học');
    const key = has(lesson.keys, activityId) ? lesson.keys[activityId] : undefined;
    if (!key) throw notFound('hoạt động');
    return gradeResponse(key, response);
  };
}

export const recordOnlyGrader: Grader = () => ({ outcome: 'recorded', response: { kind: 'done' } });

export type StudentFeedback = 'praise' | 'try_again' | 'thanks';

/** Phản hồi hiển thị cho trẻ: chỉ hai trường, không đáp án/điểm/hạng/outcome thô. */
export interface StudentAck {
  activityId: string;
  feedback: StudentFeedback;
}

export function toStudentAck(r: { activityId: string; outcome: Outcome }): StudentAck {
  const feedback: StudentFeedback =
    r.outcome === 'correct' ? 'praise' : r.outcome === 'incorrect' ? 'try_again' : 'thanks';
  return { activityId: r.activityId, feedback };
}
