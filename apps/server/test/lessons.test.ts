import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { SchoolService, answerKeysFromPackage, type GradablePackage } from '@lhdk/domain';
import { loadLessons } from '../src/lessons.js';

const REAL_DIR = fileURLToPath(new URL('../../classroom/content/lessons/', import.meta.url));

const realSlugs = readdirSync(REAL_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const readPkg = (slug: string): GradablePackage =>
  JSON.parse(readFileSync(join(REAL_DIR, slug, 'lesson.json'), 'utf8')) as GradablePackage;

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function fixture(packs: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'lhdk-lessons-'));
  tmpDirs.push(dir);
  for (const [slug, pkg] of Object.entries(packs)) {
    mkdirSync(join(dir, slug));
    writeFileSync(join(dir, slug, 'lesson.json'), typeof pkg === 'string' ? pkg : JSON.stringify(pkg));
  }
  return dir;
}

const mini = (id: string, status: string) => ({
  lesson: { id, status },
  scenarios: [{ activities: [{ id: `${id}-a1`, type: 'explore' }] }],
});

describe('hợp đồng với gói bài thật', () => {
  it('có ít nhất 6 gói', () => {
    expect(realSlugs.length).toBeGreaterThanOrEqual(6);
  });

  for (const slug of realSlugs) {
    it(`gói "${slug}": khoá chấm dựng được và đủ hoạt động`, () => {
      const pkg = readPkg(slug);
      const keys = answerKeysFromPackage(pkg);
      expect(keys.lessonId).toBe(pkg.lesson.id);
      const ids = pkg.scenarios.flatMap((s) => s.activities.map((a) => a.id));
      expect(ids.length).toBeGreaterThan(0);
      expect(keys.activityIds).toEqual(ids);
      for (const id of ids) expect(Object.hasOwn(keys.keys, id)).toBe(true);
      expect(Object.keys(keys.keys).sort()).toEqual([...ids].sort());
    });
  }

  it('loadLessons (development) nạp mọi gói và lookup trả đúng', () => {
    const { lookup, lessonIds } = loadLessons({ nodeEnv: 'development' });
    expect(lessonIds.length).toBeGreaterThanOrEqual(6);
    expect(lessonIds).toEqual([...lessonIds].sort());
    for (const slug of realSlugs) {
      const pkg = readPkg(slug);
      expect(lessonIds).toContain(pkg.lesson.id);
      const found = lookup(pkg.lesson.id);
      expect(found?.lessonId).toBe(pkg.lesson.id);
      expect(found?.activityIds).toEqual(answerKeysFromPackage(pkg).activityIds);
    }
    expect(lookup('khong-co-bai-nay')).toBeUndefined();
  });
});

describe('lọc theo trạng thái', () => {
  it('production chỉ nạp approved | published', () => {
    const dir = fixture({
      a: mini('lesson-review', 'review'),
      b: mini('lesson-published', 'published'),
      c: mini('lesson-approved', 'approved'),
      d: mini('lesson-draft', 'draft'),
    });
    mkdirSync(join(dir, 'rong')); // thư mục không có lesson.json bị bỏ qua
    const { lookup, lessonIds } = loadLessons({ nodeEnv: 'production', dir });
    expect(lessonIds).toEqual(['lesson-approved', 'lesson-published']);
    expect(lookup('lesson-review')).toBeUndefined();
    expect(lookup('lesson-published')).toBeDefined();
  });

  it('development/test nạp mọi trạng thái', () => {
    const dir = fixture({ a: mini('x-review', 'review'), b: mini('y-published', 'published') });
    for (const nodeEnv of ['development', 'test'] as const) {
      expect(loadLessons({ nodeEnv, dir }).lessonIds).toEqual(['x-review', 'y-published']);
    }
  });

  it('production trên thư mục thật chỉ nạp số gói đã approved/published (hiện 0 vì còn review)', () => {
    const statuses = realSlugs.map((s) => (readPkg(s).lesson as { status?: string }).status);
    const expected = statuses.filter((s) => s === 'approved' || s === 'published').length;
    expect(loadLessons({ nodeEnv: 'production' }).lessonIds).toHaveLength(expected);
  });
});

describe('gói lỗi', () => {
  it('gói hỏng JSON → throw có tên slug', () => {
    const dir = fixture({ 'bai-hong': '{ not json' });
    expect(() => loadLessons({ nodeEnv: 'development', dir })).toThrow(/bai-hong/);
  });

  it('khoá chấm không hợp lệ → throw có tên slug', () => {
    const dir = fixture({
      'bai-sai-khoa': {
        lesson: { id: 'sai-khoa', status: 'review' },
        scenarios: [
          {
            activities: [
              { id: 'q1', type: 'object_identification', options: [{ id: 'a' }], correctAnswer: 'khong-co' },
            ],
          },
        ],
      },
    });
    expect(() => loadLessons({ nodeEnv: 'development', dir })).toThrow(/bai-sai-khoa/);
  });

  it('trùng lesson.id → throw', () => {
    const dir = fixture({ a: mini('trung', 'review'), b: mini('trung', 'review') });
    expect(() => loadLessons({ nodeEnv: 'development', dir })).toThrow(/trùng/);
  });
});

describe('chấm bài bằng gói thật', () => {
  it('SchoolService({ lessons }) chấm đáp án đúng của float-or-sink ra outcome khác recorded', () => {
    const { lookup } = loadLessons({ nodeEnv: 'test' });
    const keys = lookup('float-or-sink');
    expect(keys).toBeDefined();
    const entry = Object.entries(keys!.keys).find(([, k]) => k.expects === 'placements' && k.graded);
    expect(entry).toBeDefined();
    const [activityId, key] = entry!;
    if (key.expects !== 'placements') throw new Error('không phải placements');

    let t = 1_000;
    const svc = new SchoolService({ clock: () => (t += 1000), lessons: lookup });
    const host = svc.registerUser({ displayName: 'Chủ trường chơi', planId: 'pilot' });
    const kid = svc.registerUser({ displayName: 'Phụ huynh' });
    const school = svc.createSchool(host.id, { name: 'Trường thử', level: 'kindergarten' });
    svc.grantTeacher(host.id, school.id, host.id);
    const klass = svc.createClass(host.id, school.id, { name: 'Lớp thử', capacity: 10 });
    svc.enrollWithCode(kid.id, klass.joinCode);
    const session = svc.startSession(host.id, klass.id, 'float-or-sink');
    svc.joinSession(kid.id, session.id);
    svc.setActivity(host.id, session.id, activityId);

    const right = svc.submitResult(kid.id, session.id, activityId, { kind: 'placements', placements: key.answer });
    expect(right.outcome).toBe('correct');
    expect(right.outcome).not.toBe('recorded');

    const firstItem = Object.keys(key.answer)[0] as string;
    const other = key.categories.find((c) => c !== key.answer[firstItem]) as string;
    const wrong = svc.submitResult(kid.id, session.id, activityId, {
      kind: 'placements',
      placements: { ...key.answer, [firstItem]: other },
    });
    expect(wrong.outcome).toBe('incorrect');
  });
});
