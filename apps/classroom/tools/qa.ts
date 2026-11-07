/**
 * QA tự động cho nội dung — Cấp 1 (kỹ thuật) và phần tự động hoá được của
 * Cấp 2 (trò chơi) trong đặc tả: schema, tham chiếu, kích thước vùng chạm,
 * độ dài câu cho trẻ, đường đi không kẹt. Cấp 3 (sư phạm) luôn do người duyệt.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ZodError } from 'zod';
import { normalizePackage, orderedActivities, referencedAssetIds, type AssetManifestFile, type LessonPackageFile } from '../src/engine/content/package';
import type { Activity, Entity, LessonBundle, Scene, Scenario, Step, Visual } from '../src/engine/types';
import { assetManifestSchema, catalogSchema, packageSchema } from './schema';

/** Vùng chạm tối thiểu (đơn vị sân khấu 1600×900 ≈ 64px trên màn 1024px). */
export const MIN_TARGET = 100;
/** Số từ tối đa của câu yêu cầu đọc cho trẻ. */
export const MAX_INSTRUCTION_WORDS = 7;
export const MAX_SAY_CHARS = 110;

export type Level = 'error' | 'warn';
export interface Issue {
  level: Level;
  where: string;
  message: string;
}

export interface QaReport {
  lessons: Array<{ id: string; dir: string; issues: Issue[]; activities: number }>;
  catalog: Issue[];
}

const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

function zodIssues(err: ZodError, where: string): Issue[] {
  return err.issues.map((i) => ({ level: 'error' as const, where: `${where}${i.path.length ? ' › ' + i.path.join('.') : ''}`, message: i.message }));
}

export function runQa(contentRoot: string): QaReport {
  const report: QaReport = { lessons: [], catalog: [] };
  const catPath = join(contentRoot, 'catalog.json');
  const cat = existsSync(catPath) ? readJson(catPath) : null;
  if (!cat) report.catalog.push({ level: 'error', where: 'catalog.json', message: 'Thiếu file' });
  else {
    const r = catalogSchema.safeParse(cat);
    if (!r.success) report.catalog.push(...zodIssues(r.error, 'catalog.json'));
  }

  const lessonsDir = join(contentRoot, 'lessons');
  const allAssetIds = new Set<string>();
  const dirs = existsSync(lessonsDir) ? readdirSync(lessonsDir).filter((d) => existsSync(join(lessonsDir, d, 'lesson.json'))) : [];
  const lessonIds = new Set<string>();

  for (const d of dirs) {
    const dir = join(lessonsDir, d);
    const issues: Issue[] = [];
    const pkg = readJson(join(dir, 'lesson.json')) as LessonPackageFile;
    const manifestPath = join(dir, 'assets.json');
    const manifest: AssetManifestFile = existsSync(manifestPath) ? readJson(manifestPath) : { assets: [] };
    const entry = { id: pkg.lesson?.id ?? d, dir: d, issues, activities: 0 };
    report.lessons.push(entry);

    const ps = packageSchema.safeParse(pkg);
    if (!ps.success) issues.push(...zodIssues(ps.error, 'lesson.json'));
    const ms = assetManifestSchema.safeParse(manifest);
    if (!ms.success) issues.push(...zodIssues(ms.error, 'assets.json'));
    if (!ps.success) continue; // tham chiếu vô nghĩa khi schema hỏng

    if (lessonIds.has(pkg.lesson.id)) issues.push({ level: 'error', where: 'lesson.id', message: `Trùng id bài "${pkg.lesson.id}"` });
    lessonIds.add(pkg.lesson.id);

    // Tài sản
    const seen = new Set<string>();
    for (const a of manifest.assets) {
      if (seen.has(a.id)) issues.push({ level: 'error', where: `assets.json › ${a.id}`, message: 'Trùng asset id' });
      seen.add(a.id);
      allAssetIds.add(a.id);
      if (a.file && !existsSync(join(dir, a.file))) issues.push({ level: 'error', where: `assets.json › ${a.id}`, message: `Không thấy file ${a.file}` });
      if (!a.file && !a.src) issues.push({ level: 'error', where: `assets.json › ${a.id}`, message: 'Asset thiếu file/src' });
      if (!a.prompt && a.type !== 'audio') issues.push({ level: 'warn', where: `assets.json › ${a.id}`, message: 'Thiếu prompt GPT Image (art bible)' });
    }

    const bundle = normalizePackage(pkg, manifest, () => undefined);
    entry.activities = bundle.activities.length;
    checkLesson(bundle, cat, issues);
    const used = referencedAssetIds(bundle);
    for (const idUsed of used) if (!seen.has(idUsed)) issues.push({ level: 'error', where: 'tham chiếu asset', message: `Asset "${idUsed}" không có trong assets.json của gói` });
    for (const a of manifest.assets) if (!used.has(a.id)) issues.push({ level: 'warn', where: `assets.json › ${a.id}`, message: 'Asset không được dùng' });
  }

  // Ảnh bìa của mảng học dùng asset từ các gói.
  if (cat?.domains) {
    for (const dm of cat.domains) {
      for (const l of dm.cover?.layers ?? []) {
        if (!allAssetIds.has(l.asset)) report.catalog.push({ level: 'error', where: `catalog › ${dm.id}.cover`, message: `Asset "${l.asset}" không tồn tại trong gói nào` });
      }
    }
    for (const t of cat.topics ?? []) {
      if (!cat.domains.some((x: { id: string }) => x.id === t.domainId)) report.catalog.push({ level: 'error', where: `catalog › topic ${t.id}`, message: `domainId "${t.domainId}" không tồn tại` });
    }
  }
  return report;
}

function checkLesson(b: LessonBundle, cat: { domains?: Array<{ id: string }>; topics?: Array<{ id: string; domainId: string }> } | null, issues: Issue[]) {
  const L = b.lesson;
  const err = (where: string, message: string) => issues.push({ level: 'error', where, message });
  const warn = (where: string, message: string) => issues.push({ level: 'warn', where, message });

  if (cat) {
    const topic = cat.topics?.find((t) => t.id === L.topicId);
    if (!cat.domains?.some((d) => d.id === L.domainId)) err('lesson.domainId', `Không có mảng "${L.domainId}" trong catalog`);
    if (!topic) err('lesson.topicId', `Không có chủ đề "${L.topicId}" trong catalog`);
    else if (topic.domainId !== L.domainId) err('lesson.topicId', 'Chủ đề thuộc mảng khác');
  }
  if (L.status === 'published' && !L.review?.reviewedBy) {
    err('lesson.status', 'Bài "published" phải có review.reviewedBy (đặc tả §14: bắt buộc người duyệt)');
  }

  const objIds = new Set(L.learningObjectives.map((o) => o.id));
  const covered = new Set<string>();
  const actIds = new Set<string>();
  const produced = new Set<string>();

  for (const a of orderedActivities(b)) {
    const where = `activity ${a.id}`;
    const sc = b.scenarios.find((s) => s.id === a.scenarioId)!;
    if (actIds.has(a.id)) err(where, 'Trùng id hoạt động');
    actIds.add(a.id);
    const scene = sc.scenes.find((s) => s.id === a.sceneId);
    if (!scene) {
      err(where, `Không có cảnh "${a.sceneId}"`);
      continue;
    }
    for (const o of a.learningObjectives) {
      if (!objIds.has(o)) err(where, `Mục tiêu "${o}" không có trong bài`);
      covered.add(o);
    }
    if (!a.teacherPrompts.length) warn(where, 'Chưa có câu hỏi gợi ý cho giáo viên');
    const words = a.instruction.trim().split(/\s+/).length;
    if (words > MAX_INSTRUCTION_WORDS) warn(where, `Câu yêu cầu dài ${words} từ (nên ≤ ${MAX_INSTRUCTION_WORDS}) — trẻ 5 tuổi cần câu ngắn`);
    for (const k of Object.keys(a.sceneOverrides ?? {})) {
      if (!scene.entities.some((e) => e.id === k)) err(where, `sceneOverrides: không có thực thể "${k}"`);
    }
    const ents = effectiveEntities(scene, a);
    const has = (id: string) => ents.has(id);
    const checkTimeline = (t: Step[] | undefined, label: string) => checkSteps(t ?? [], sc, ents, `${where} › ${label}`, issues);
    checkTimeline(a.intro, 'intro');
    checkTimeline(a.outro, 'outro');
    checkActivity(a, sc, ents, produced, err, warn, has, checkTimeline, b);
  }
  for (const id of objIds) if (!covered.has(id)) warn('lesson.learningObjectives', `Mục tiêu "${id}" chưa có hoạt động nào phục vụ`);
  for (const sc of b.scenarios) {
    for (const s of sc.scenes) {
      const ids = new Set<string>();
      for (const e of s.entities) {
        if (ids.has(e.id)) err(`scene ${s.id}`, `Trùng id thực thể "${e.id}"`);
        ids.add(e.id);
      }
    }
  }
}

function effectiveEntities(scene: Scene, a: Activity): Map<string, Entity> {
  const m = new Map<string, Entity>();
  for (const e of scene.entities) m.set(e.id, { ...e, ...(a.sceneOverrides?.[e.id] ?? {}) } as Entity);
  return m;
}

function checkActivity(
  a: Activity, sc: Scenario, ents: Map<string, Entity>, produced: Set<string>,
  err: (w: string, m: string) => void, warn: (w: string, m: string) => void,
  has: (id: string) => boolean, checkTimeline: (t: Step[] | undefined, label: string) => void, b: LessonBundle,
) {
  const where = `activity ${a.id}`;
  const target = (id: string, what: string) => {
    const e = ents.get(id);
    if (!e) return err(where, `${what}: không có thực thể "${id}"`);
    if (e.hidden) err(where, `${what}: "${id}" đang bị ẩn — trẻ không chạm được (kẹt)`);
    if (e.decor) err(where, `${what}: "${id}" là vật trang trí, không nhận chạm`);
    if (Math.min(e.w, e.h) < MIN_TARGET) warn(where, `${what}: vùng chạm "${id}" ${e.w}×${e.h} nhỏ hơn ${MIN_TARGET}`);
  };
  const visualAssets = (v: Visual | undefined, label: string) => {
    if (!v) return err(where, `${label}: thiếu hình minh hoạ`);
    for (const l of v.layers) if (!b.assets[l.asset]) err(where, `${label}: asset "${l.asset}" không có`);
  };
  switch (a.type) {
    case 'story_scene':
      checkTimeline(a.timeline, 'timeline');
      for (const s of flatSteps(a.timeline, sc)) {
        if (s.do === 'say' && s.text.length > MAX_SAY_CHARS) warn(where, `Câu thoại dài ${s.text.length} ký tự — nên tách nhỏ`);
      }
      break;
    case 'explore':
      for (const t of a.targets) {
        target(t, 'targets');
        if (!ents.get(t)?.label) err(where, `targets: "${t}" cần label để đọc tên`);
      }
      break;
    case 'object_identification':
    case 'character_identification':
    case 'action_identification':
    case 'word_selection':
    case 'comparison':
    case 'cause_effect': {
      const ids = a.options.map((o) => o.id);
      if (new Set(ids).size !== ids.length) err(where, 'Trùng id phương án');
      if (!ids.includes(a.correctAnswer)) err(where, `correctAnswer "${a.correctAnswer}" không nằm trong options (kẹt: không thể hoàn thành)`);
      for (const o of a.options) {
        if (a.presentation === 'scene') {
          if (!o.entity) err(where, `option ${o.id}: presentation "scene" cần entity`);
          else target(o.entity, `option ${o.id}`);
        } else visualAssets(o.visual, `option ${o.id}`);
      }
      break;
    }
    case 'sequence':
    case 'sentence_builder': {
      const cards = a.type === 'sequence' ? a.cards : a.blocks;
      const ids = cards.map((c) => c.id).sort().join('|');
      if ([...a.correctOrder].sort().join('|') !== ids) err(where, 'correctOrder phải là hoán vị đúng của các thẻ (kẹt)');
      cards.forEach((c) => visualAssets(c.visual, `thẻ ${c.id}`));
      break;
    }
    case 'story_recall':
      a.frames.forEach((f) => visualAssets(f.visual, `tranh ${f.id}`));
      break;
    case 'prediction':
      target(a.subject, 'subject');
      a.options.forEach((o) => visualAssets(o.visual, `option ${o.id}`));
      produced.add(a.predictionKey);
      break;
    case 'experiment': {
      const outs = new Set(a.outcomes.map((o) => o.id));
      for (const s of a.subjects) {
        if (!has(s.entity)) err(where, `subject: không có thực thể "${s.entity}"`);
        if (!outs.has(s.result)) err(where, `subject ${s.entity}: kết quả "${s.result}" không có trong outcomes`);
        if (s.predictionKey && !produced.has(s.predictionKey)) warn(where, `subject ${s.entity}: chưa có hoạt động dự đoán nào trước đó ghi "${s.predictionKey}"`);
        checkTimeline(s.timeline, `subject ${s.entity}`);
      }
      break;
    }
    case 'classification': {
      const cats = new Set(a.categories.map((c) => c.id));
      for (const it of a.items) {
        if (!cats.has(it.category)) err(where, `item ${it.id}: nhóm "${it.category}" không tồn tại (kẹt ở chế độ check)`);
        visualAssets(it.visual, `item ${it.id}`);
        if (a.mode === 'predict') {
          if (!it.predictionKey) warn(where, `item ${it.id}: chế độ predict nên có predictionKey`);
          else produced.add(it.predictionKey);
        }
      }
      a.categories.forEach((c) => visualAssets(c.visual, `nhóm ${c.id}`));
      break;
    }
  }
}

/** Trải phẳng timeline (kể cả parallel và template đã thay tham số) để kiểm tra. */
function flatSteps(steps: Step[], sc: Scenario, args: Record<string, string | number> = {}, depth = 0): Step[] {
  const out: Step[] = [];
  if (depth > 5) return out;
  for (const raw of steps) {
    const s = subst(raw, args) as Step;
    out.push(s);
    if (s.do === 'parallel') out.push(...flatSteps(s.steps, sc, args, depth + 1));
    if (s.do === 'play') {
      const tpl = sc.timelines?.[s.timeline];
      if (tpl) out.push(...flatSteps(tpl, sc, { ...args, ...(s.args ?? {}) }, depth + 1));
    }
  }
  return out;
}

function subst(v: unknown, args: Record<string, string | number>): unknown {
  if (typeof v === 'string') return /^\$\w+$/.test(v) && v.slice(1) in args ? args[v.slice(1)] : v;
  if (Array.isArray(v)) return v.map((x) => subst(x, args));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, subst(x, args)]));
  return v;
}

function checkSteps(steps: Step[], sc: Scenario, ents: Map<string, Entity>, where: string, issues: Issue[]) {
  for (const s of flatSteps(steps, sc)) {
    if (s.do === 'play' && !sc.timelines?.[s.timeline]) issues.push({ level: 'error', where, message: `Không có timeline mẫu "${s.timeline}"` });
    const refs: unknown[] = [];
    if ('target' in s) refs.push(s.target);
    if (s.do === 'move') refs.push(s.to);
    if (s.do === 'fx') refs.push(s.at);
    if (s.do === 'camera') refs.push(s.focus);
    for (const r of refs) {
      if (typeof r === 'string') {
        if (r.startsWith('$')) issues.push({ level: 'error', where, message: `Tham số "${r}" chưa được truyền vào timeline mẫu` });
        else if (!ents.has(r)) issues.push({ level: 'error', where, message: `Bước "${s.do}" trỏ tới thực thể không tồn tại "${r}"` });
      } else if (r && typeof r === 'object') {
        const p = r as { x: unknown; y: unknown };
        if (typeof p.x !== 'number' || typeof p.y !== 'number') issues.push({ level: 'error', where, message: `Bước "${s.do}" có toạ độ chưa thay tham số` });
      }
    }
  }
}
