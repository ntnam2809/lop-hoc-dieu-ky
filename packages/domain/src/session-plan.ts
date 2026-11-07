import { invalid } from './errors';
import type { Id, Timestamp } from './types';

/** Giới hạn kỹ thuật (giả định), không phải quota thương mại. */
export const SESSION_PLAN_LIMITS = {
  titleMax: 60,
  stepsMax: 30,
  noteMax: 500,
  hintMax: 200,
  hintsPerStepMax: 5,
} as const;

export interface SessionPlanStep {
  activityId: string;
  note?: string;
  hintQuestions: string[];
}

export interface SessionPlan {
  id: Id;
  schoolId: Id;
  authorId: Id;
  lessonId: string;
  title: string;
  steps: SessionPlanStep[];
  version: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SessionPlanInput {
  title: string;
  lessonId: string;
  steps: ReadonlyArray<{ activityId: string; note?: string; hintQuestions?: readonly string[] }>;
}

export interface LessonOutline {
  lessonId: string;
  activityIds: readonly string[];
}

/** Nội dung kế hoạch đã chuẩn hoá (chưa gắn id/tác giả/phiên bản). */
export interface SessionPlanContent {
  title: string;
  lessonId: string;
  steps: SessionPlanStep[];
}

const L = SESSION_PLAN_LIMITS;

// Ký tự điều khiển (C0, DEL, C1) trừ '\n'.
// eslint-disable-next-line no-control-regex
const CONTROL_EXCEPT_NEWLINE = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

function cleanNote(raw: unknown, where: string): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string') throw invalid(`${where}: ghi chú phải là chuỗi`);
  const v = raw.replace(CONTROL_EXCEPT_NEWLINE, '').trim();
  if (v.length > L.noteMax) throw invalid(`${where}: ghi chú tối đa ${L.noteMax} ký tự`);
  return v === '' ? undefined : v;
}

function cleanHints(raw: unknown, where: string): string[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw invalid(`${where}: câu hỏi gợi ý phải là danh sách`);
  const out: string[] = [];
  for (const h of raw as unknown[]) {
    if (typeof h !== 'string') throw invalid(`${where}: mỗi câu hỏi gợi ý phải là chuỗi`);
    const v = collapse(h.replace(CONTROL_EXCEPT_NEWLINE, ' '));
    if (v === '') continue;
    if (v.length > L.hintMax) throw invalid(`${where}: mỗi câu hỏi gợi ý tối đa ${L.hintMax} ký tự`);
    out.push(v);
  }
  if (out.length > L.hintsPerStepMax) {
    throw invalid(`${where}: tối đa ${L.hintsPerStepMax} câu hỏi gợi ý mỗi bước`);
  }
  return out;
}

/**
 * Chuẩn hoá và kiểm đầu vào kế hoạch buổi dạy do giáo viên soạn.
 * Thuần, tất định, không mutate đầu vào; đầu vào đến từ transport nên kiểm kiểu lúc chạy.
 */
export function normalizeSessionPlanInput(input: SessionPlanInput, lesson: LessonOutline): SessionPlanContent {
  const raw: unknown = input;
  if (!isRecord(raw)) throw invalid('Kế hoạch buổi dạy không hợp lệ');

  if (typeof raw.title !== 'string') throw invalid('Tiêu đề phải là chuỗi');
  const title = collapse(raw.title);
  if (!title || title.length > L.titleMax) throw invalid(`Tiêu đề phải có 1–${L.titleMax} ký tự`);

  if (typeof raw.lessonId !== 'string') throw invalid('Bài học phải là chuỗi');
  if (raw.lessonId !== lesson.lessonId) throw invalid('Kế hoạch không khớp với bài học đã chọn');

  if (!Array.isArray(raw.steps)) throw invalid('Các bước phải là danh sách');
  const rawSteps: unknown[] = raw.steps;
  if (rawSteps.length < 1 || rawSteps.length > L.stepsMax) {
    throw invalid(`Kế hoạch phải có 1–${L.stepsMax} bước`);
  }

  const known = new Set(lesson.activityIds);
  const seen = new Set<string>();
  const steps: SessionPlanStep[] = [];
  rawSteps.forEach((s, i) => {
    const where = `Bước ${i + 1}`;
    if (!isRecord(s)) throw invalid(`${where}: không hợp lệ`);
    if (typeof s.activityId !== 'string') throw invalid(`${where}: hoạt động phải là chuỗi`);
    const activityId = s.activityId;
    if (!known.has(activityId)) throw invalid(`${where}: hoạt động không thuộc bài học`);
    if (seen.has(activityId)) throw invalid(`${where}: hoạt động bị trùng`);
    seen.add(activityId);

    const note = cleanNote(s.note, where);
    const hintQuestions = cleanHints(s.hintQuestions, where);
    steps.push(note === undefined ? { activityId, hintQuestions } : { activityId, note, hintQuestions });
  });

  return { title, lessonId: lesson.lessonId, steps };
}
