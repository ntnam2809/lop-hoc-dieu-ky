import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  answerKeysFromPackage,
  lessonLookupFrom,
  type GradablePackage,
  type LessonAnswerKeys,
  type LessonLookup,
} from '@lhdk/domain';
import type { Config } from './config.js';

/**
 * Nạp khoá chấm từ gói bài thật lúc khởi động (domain thuần không đọc file nên server làm việc này).
 * Production chỉ nhận bài đã duyệt/xuất bản (CONSTITUTION §4.2); dev/test nhận mọi trạng thái.
 */

const DEFAULT_DIR = fileURLToPath(new URL('../../classroom/content/lessons/', import.meta.url));
const PRODUCTION_STATUSES: ReadonlySet<string> = new Set(['approved', 'published']);

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function loadLessons(o: { nodeEnv: Config['nodeEnv']; dir?: string }): {
  lookup: LessonLookup;
  lessonIds: string[];
} {
  const dir = o.dir ?? DEFAULT_DIR;
  const slugs = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'lesson.json')))
    .map((d) => d.name)
    .sort();

  const list: LessonAnswerKeys[] = [];
  const slugById = new Map<string, string>();
  for (const slug of slugs) {
    let pkg: GradablePackage & { lesson: { id: string; status?: unknown } };
    try {
      pkg = JSON.parse(readFileSync(join(dir, slug, 'lesson.json'), 'utf8')) as typeof pkg;
    } catch (e) {
      throw new Error(`Gói bài "${slug}": không đọc được lesson.json (${msg(e)})`);
    }
    const status = pkg?.lesson?.status;
    if (o.nodeEnv === 'production' && !(typeof status === 'string' && PRODUCTION_STATUSES.has(status))) continue;

    let keys: LessonAnswerKeys;
    try {
      keys = answerKeysFromPackage(pkg);
    } catch (e) {
      throw new Error(`Gói bài "${slug}": khoá chấm không hợp lệ (${msg(e)})`);
    }
    const prev = slugById.get(keys.lessonId);
    if (prev !== undefined) {
      throw new Error(`Gói bài "${slug}": trùng lesson.id "${keys.lessonId}" với gói "${prev}"`);
    }
    slugById.set(keys.lessonId, slug);
    list.push(keys);
  }

  return { lookup: lessonLookupFrom(list), lessonIds: list.map((l) => l.lessonId).sort() };
}
