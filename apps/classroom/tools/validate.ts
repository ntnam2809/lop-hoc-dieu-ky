/**
 * npm run validate — kiểm tra toàn bộ nội dung trong content/.
 * Thoát mã 1 nếu có lỗi (dùng trong build/CI và trước khi xuất bản).
 *   --strict   coi cảnh báo như lỗi
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runQa, type Issue } from './qa';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');
const strict = process.argv.includes('--strict');
const report = runQa(root);

const c = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};
const print = (issues: Issue[]) => {
  for (const i of issues) {
    const tag = i.level === 'error' ? c.red('✗ lỗi   ') : c.yellow('⚠ c.báo ');
    console.log(`   ${tag} ${c.dim(i.where)} — ${i.message}`);
  }
};

let errors = 0;
let warns = 0;
const count = (issues: Issue[]) => {
  errors += issues.filter((i) => i.level === 'error').length;
  warns += issues.filter((i) => i.level === 'warn').length;
};

console.log(c.bold('\nKiểm tra nội dung — Lớp Học Diệu Kỳ\n'));
console.log(`${report.catalog.length ? '•' : c.green('✓')} catalog.json`);
print(report.catalog);
count(report.catalog);
for (const l of report.lessons) {
  const e = l.issues.filter((i) => i.level === 'error').length;
  const mark = e ? c.red('✗') : l.issues.length ? c.yellow('•') : c.green('✓');
  console.log(`${mark} ${c.bold(l.id)} ${c.dim(`(${l.dir}, ${l.activities} hoạt động)`)}`);
  print(l.issues);
  count(l.issues);
}
console.log(`\n${report.lessons.length} bài · ${errors ? c.red(`${errors} lỗi`) : c.green('0 lỗi')} · ${warns ? c.yellow(`${warns} cảnh báo`) : '0 cảnh báo'}\n`);
if (errors || (strict && warns)) process.exit(1);
