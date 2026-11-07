// Bản build production không được chứa hook test (__campus) hay cờ harness.
// Chạy sau `vite build` (thường, không --mode measure): quét dist/**/*.js.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const FORBIDDEN = ['__campus', 'harness', 'dev:'];

const bad = [];
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) {
      const text = readFileSync(p, 'utf8');
      const hit = FORBIDDEN.filter((s) => text.includes(s));
      if (hit.length) bad.push(`${p} (${hit.join(', ')})`);
    }
  }
};
walk(dist);

if (bad.length) {
  console.error('Bản production chứa hook test:');
  for (const b of bad) console.error('  ' + b);
  process.exit(1);
}
console.log('assert-no-test-hooks: dist sạch');
