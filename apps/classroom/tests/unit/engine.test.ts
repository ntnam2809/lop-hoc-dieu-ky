import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { shuffle } from '../../src/engine/runtime/random';
import { substitute } from '../../src/engine/runtime/timeline';
import { easings } from '../../src/engine/runtime/tween';
import { normalizePackage, orderedActivities, referencedAssetIds } from '../../src/engine/content/package';

describe('xáo trộn tất định', () => {
  it('cùng seed → cùng kết quả, và không bao giờ trả về thứ tự đã đúng sẵn', () => {
    for (let n = 2; n <= 6; n++) {
      const items = Array.from({ length: n }, (_, i) => i);
      for (let s = 0; s < 200; s++) {
        const a = shuffle(items, `seed-${s}`);
        expect(a).toEqual(shuffle(items, `seed-${s}`));
        expect(a).not.toEqual(items);
        expect([...a].sort()).toEqual(items);
      }
    }
  });
});

describe('timeline mẫu', () => {
  it('thay tham số, giữ kiểu số cho toạ độ', () => {
    const out = substitute({ do: 'move', target: '$who', to: { x: '$x', y: 300 }, text: 'Chào $name!' }, { who: 'fox', x: 640, name: 'Cáo' });
    expect(out).toEqual({ do: 'move', target: 'fox', to: { x: 640, y: 300 }, text: 'Chào Cáo!' });
  });
});

describe('easing', () => {
  it('mọi easing đi từ 0 tới 1', () => {
    for (const [name, f] of Object.entries(easings)) {
      expect(Math.abs(f(0)), name).toBeLessThan(0.02);
      expect(Math.abs(f(1) - 1), name).toBeLessThan(0.02);
    }
  });
});

describe('gói nội dung', () => {
  it('làm phẳng kịch bản → hoạt động có scenarioId/order, đúng thứ tự', () => {
    const dir = join(import.meta.dirname, '..', '..', 'content', 'lessons', 'float-or-sink');
    const pkg = JSON.parse(readFileSync(join(dir, 'lesson.json'), 'utf8'));
    const manifest = JSON.parse(readFileSync(join(dir, 'assets.json'), 'utf8'));
    const b = normalizePackage(pkg, manifest, (a) => `/x/${a.file}`);
    const acts = orderedActivities(b);
    expect(acts.map((a) => a.id)).toEqual(pkg.scenarios[0].activities.map((a: any) => a.id));
    expect(acts.every((a, i) => a.order === i && a.scenarioId === 'float-sink-lab')).toBe(true);
    expect(b.assets.science_float_object_duck_v01.src).toBe('/x/assets/science_float_object_duck_v01.svg');
    expect(referencedAssetIds(b).has('science_float_icon_sink_v01')).toBe(true);
  });
});
