import type { Activity, AssetRef, Lesson, LessonBundle, Scenario } from '../types';

/**
 * Định dạng gói nội dung trên đĩa (content/lessons/<id>/lesson.json).
 * Hoạt động được viết lồng trong kịch bản cho dễ soạn; khi nạp sẽ được làm
 * phẳng thành mô hình chuẩn (giống các collection Firestore).
 */
export interface LessonPackageFile {
  lesson: Omit<Lesson, 'scenarioIds'> & { scenarioIds?: string[] };
  scenarios: Array<
    Omit<Scenario, 'lessonId' | 'activityIds'> & {
      activities: Array<Omit<Activity, 'scenarioId' | 'order'> & Partial<Pick<Activity, 'scenarioId' | 'order'>>>;
    }
  >;
}

export interface AssetManifestFile {
  assets: AssetRef[];
}

/** Làm phẳng gói nội dung → LessonBundle. `resolve` đổi `file` thành URL dùng được. */
export function normalizePackage(
  pkg: LessonPackageFile,
  manifest: AssetManifestFile,
  resolve: (asset: AssetRef) => string | undefined,
): LessonBundle {
  const scenarios: Scenario[] = [];
  const activities: Activity[] = [];
  for (const sc of pkg.scenarios) {
    const { activities: acts, ...rest } = sc;
    const ids: string[] = [];
    acts.forEach((a, i) => {
      const act = { ...a, scenarioId: sc.id, order: a.order ?? i } as Activity;
      activities.push(act);
      ids.push(act.id);
    });
    scenarios.push({ ...rest, lessonId: pkg.lesson.id, activityIds: ids });
  }
  const lesson: Lesson = {
    ...pkg.lesson,
    scenarioIds: pkg.lesson.scenarioIds ?? scenarios.map((s) => s.id),
  };
  const assets: Record<string, AssetRef> = {};
  for (const a of manifest.assets) assets[a.id] = { ...a, src: a.src ?? resolve(a) };
  return { lesson, scenarios, activities, assets };
}

/** Thứ tự chơi: theo thứ tự kịch bản của bài, rồi `order` của hoạt động. */
export function orderedActivities(bundle: LessonBundle): Activity[] {
  const out: Activity[] = [];
  for (const sid of bundle.lesson.scenarioIds) {
    const sc = bundle.scenarios.find((s) => s.id === sid);
    if (!sc) continue;
    const acts = bundle.activities
      .filter((a) => a.scenarioId === sid)
      .sort((a, b) => a.order - b.order);
    out.push(...acts);
  }
  return out;
}

/** Mọi asset id mà một gói tham chiếu (cảnh, thẻ, timeline không tham chiếu asset). */
export function referencedAssetIds(bundle: Pick<LessonBundle, 'scenarios' | 'activities' | 'lesson'>): Set<string> {
  const ids = new Set<string>();
  const visit = (v: unknown): void => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      v.forEach(visit);
      return;
    }
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if ((k === 'asset' || k === 'background') && typeof val === 'string') ids.add(val);
      else visit(val);
    }
  };
  visit(bundle.lesson.cover);
  visit(bundle.scenarios.map((s) => s.scenes));
  visit(bundle.activities);
  return ids;
}
