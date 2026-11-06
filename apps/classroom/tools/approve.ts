/**
 * Ghi nhận duyệt chuyên môn (đặc tả §19 cấp 3) cho một bài:
 *
 *   npm run approve -- <lessonId> --by "Cô Lan (tổ chuyên môn)" [--notes "..."]
 *
 * Đặt status "approved" + review.reviewedBy/reviewedAt cho bài, và duyệt
 * luôn khu vực/chủ đề chứa nó. Chỉ người đã thực sự xem bài mới chạy lệnh này.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runQa } from './qa';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');
const [lessonId, ...rest] = process.argv.slice(2);
const opt = (k: string) => {
  const i = rest.indexOf(`--${k}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const by = opt('by');
if (!lessonId || !by) {
  console.error('Cách dùng: npm run approve -- <lessonId> --by "Tên người duyệt" [--notes "..."]');
  process.exit(1);
}

const qa = runQa(root);
const lessonQa = qa.lessons.find((l) => l.id === lessonId);
if (!lessonQa) {
  console.error(`✗ Không có bài "${lessonId}"`);
  process.exit(1);
}
if (lessonQa.issues.some((i) => i.level === 'error')) {
  console.error('✗ Bài còn lỗi kỹ thuật — sửa trước khi duyệt (npm run validate).');
  process.exit(1);
}

const dir = readdirSync(join(root, 'lessons')).find((d) => {
  const p = join(root, 'lessons', d, 'lesson.json');
  return existsSync(p) && JSON.parse(readFileSync(p, 'utf8')).lesson.id === lessonId;
})!;
const lp = join(root, 'lessons', dir, 'lesson.json');
const pkg = JSON.parse(readFileSync(lp, 'utf8'));
pkg.lesson.status = 'approved';
pkg.lesson.review = { ...(pkg.lesson.review ?? {}), reviewedBy: by, reviewedAt: new Date().toISOString().slice(0, 10), notes: opt('notes') ?? pkg.lesson.review?.notes ?? '' };
writeFileSync(lp, JSON.stringify(pkg, null, 2) + '\n');

const cp = join(root, 'catalog.json');
const cat = JSON.parse(readFileSync(cp, 'utf8'));
for (const d of cat.domains) if (d.id === pkg.lesson.domainId && d.status !== 'published') d.status = 'approved';
for (const t of cat.topics) if (t.id === pkg.lesson.topicId && t.status !== 'published') t.status = 'approved';
writeFileSync(cp, JSON.stringify(cat, null, 2) + '\n');
console.log(`✓ "${lessonId}" đã được duyệt bởi ${by}. Xuất bản: npm run publish:content -- --lesson ${lessonId} --apply`);
