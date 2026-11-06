import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runQa } from '../../tools/qa';

const content = join(import.meta.dirname, '..', '..', 'content');
const dirs: string[] = [];

/** Sao chép content/ ra thư mục tạm, cho phép "làm hỏng" một bài để kiểm tra validator. */
function fixture(mutate: (pkg: any, assets: any) => void, lesson = 'lost-apple') {
  const dir = mkdtempSync(join(tmpdir(), 'lhdk-'));
  dirs.push(dir);
  cpSync(content, dir, { recursive: true });
  const lp = join(dir, 'lessons', lesson, 'lesson.json');
  const ap = join(dir, 'lessons', lesson, 'assets.json');
  const pkg = JSON.parse(readFileSync(lp, 'utf8'));
  const assets = JSON.parse(readFileSync(ap, 'utf8'));
  mutate(pkg, assets);
  writeFileSync(lp, JSON.stringify(pkg));
  writeFileSync(ap, JSON.stringify(assets));
  return dir;
}

const errorsOf = (dir: string) =>
  runQa(dir).lessons.flatMap((l) => l.issues).filter((i) => i.level === 'error').map((i) => i.message).join('\n');

const act = (pkg: any, id: string) => pkg.scenarios[0].activities.find((a: any) => a.id === id);

afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

describe('QA nội dung', () => {
  it('nội dung hiện có: không bài nào có lỗi; bài đã duyệt/xuất bản sạch cả cảnh báo', () => {
    const r = runQa(content);
    expect(r.catalog).toEqual([]);
    expect(r.lessons.length).toBeGreaterThanOrEqual(2);
    for (const l of r.lessons) {
      expect(l.issues.filter((i) => i.level === 'error'), l.id).toEqual([]);
      // Cảnh báo (câu dài, vùng chạm nhỏ) được phép khi bài còn draft/review — người duyệt chuyên môn quyết.
      const status = JSON.parse(readFileSync(join(content, 'lessons', l.id, 'lesson.json'), 'utf8')).lesson.status;
      if (status === 'approved' || status === 'published') expect(l.issues, l.id).toEqual([]);
    }
  });

  it('bắt đáp án không nằm trong lựa chọn (gây kẹt)', () => {
    const dir = fixture((p) => (act(p, 'a2-find-apple').correctAnswer = 'banana'));
    expect(errorsOf(dir)).toMatch(/correctAnswer "banana"/);
  });

  it('bắt thứ tự sắp xếp không phải hoán vị của thẻ', () => {
    const dir = fixture((p) => (act(p, 'a5-sequence').correctOrder = ['c1', 'c2', 'c2', 'c4']));
    expect(errorsOf(dir)).toMatch(/hoán vị/);
  });

  it('bắt asset bị tham chiếu nhưng không có trong manifest', () => {
    const dir = fixture((_, a) => a.assets.splice(a.assets.findIndex((x: any) => x.id.includes('mushroom')), 1));
    expect(errorsOf(dir)).toMatch(/mushroom.*không có/);
  });

  it('bắt timeline trỏ tới nhân vật không tồn tại', () => {
    const dir = fixture((p) => act(p, 's1-into-forest').timeline.push({ do: 'anim', target: 'dragon', preset: 'hop' }));
    expect(errorsOf(dir)).toMatch(/"dragon"/);
  });

  it('bắt lựa chọn đang bị ẩn — trẻ không chạm được', () => {
    const dir = fixture((p) => (act(p, 'a1-find-rabbit').sceneOverrides.fox.hidden = true));
    expect(errorsOf(dir)).toMatch(/bị ẩn/);
  });

  it('không cho xuất bản bài chưa có người duyệt', () => {
    const dir = fixture((p) => (p.lesson.status = 'published'));
    expect(errorsOf(dir)).toMatch(/reviewedBy/);
  });

  it('bắt loại hoạt động không có trong engine', () => {
    const dir = fixture((p) => (act(p, 'a2-find-apple').type = 'mind_reading'));
    expect(errorsOf(dir)).not.toBe('');
  });

  it('bắt tham số timeline mẫu chưa truyền', () => {
    const dir = fixture((p) => {
      const exp = act(p, 'a3-test-apple');
      delete exp.subjects[0].timeline[0].args.floatY;
    }, 'float-or-sink');
    expect(errorsOf(dir)).toMatch(/chưa thay tham số/);
  });

  it('cảnh báo câu yêu cầu quá dài cho trẻ 5 tuổi', () => {
    const dir = fixture((p) => (act(p, 'a2-find-apple').instruction = 'Con hãy nhìn thật kỹ và tìm giúp cô quả táo màu đỏ ở đâu'));
    const warns = runQa(dir).lessons.flatMap((l) => l.issues).filter((i) => i.level === 'warn');
    expect(warns.map((w) => w.message).join()).toMatch(/Câu yêu cầu dài/);
  });
});
