import type { AssetRef, Catalog, Domain, Lesson, LessonBundle, Topic } from '../types';
import { normalizePackage, type AssetManifestFile, type LessonPackageFile } from './package';
import { isVisible, type ContentSource } from './source';

const catalogFile = import.meta.glob<{ domains: Domain[]; topics: Topic[] }>('/content/catalog.json', {
  import: 'default',
});
const lessonFiles = import.meta.glob<LessonPackageFile>('/content/lessons/*/lesson.json', { import: 'default' });
const manifestFiles = import.meta.glob<AssetManifestFile>('/content/lessons/*/assets.json', { import: 'default' });
const assetUrls = import.meta.glob<string>('/content/lessons/*/assets/*', {
  query: '?url',
  import: 'default',
  eager: true,
});

const dirOf = (path: string) => path.slice(0, path.lastIndexOf('/'));

/** Nội dung đóng gói cùng app (content/), không cần mạng — dùng cho dev, duyệt nội dung, demo offline. */
export class LocalContentSource implements ContentSource {
  readonly name = 'local';
  constructor(readonly preview: boolean) {}

  async loadCatalog(): Promise<Catalog> {
    const load = Object.values(catalogFile)[0];
    if (!load) throw new Error('Thiếu content/catalog.json');
    const cat = await load();
    const lessons: Lesson[] = [];
    for (const path of Object.keys(lessonFiles)) {
      const pkg = await lessonFiles[path]();
      lessons.push({ ...pkg.lesson, scenarioIds: pkg.lesson.scenarioIds ?? pkg.scenarios.map((s) => s.id) });
    }
    const vis = (s: { status: string }) => isVisible(s.status, this.preview);
    return {
      domains: cat.domains.filter(vis).sort((a, b) => a.order - b.order),
      topics: cat.topics.filter(vis).sort((a, b) => a.order - b.order),
      lessons: lessons.filter(vis).sort((a, b) => a.order - b.order),
    };
  }

  async loadLesson(id: string): Promise<LessonBundle> {
    for (const path of Object.keys(lessonFiles)) {
      const pkg = await lessonFiles[path]();
      if (pkg.lesson.id !== id) continue;
      const dir = dirOf(path);
      const manifestLoader = manifestFiles[`${dir}/assets.json`];
      const manifest = manifestLoader ? await manifestLoader() : { assets: [] };
      return normalizePackage(pkg, manifest, (a) => (a.file ? assetUrls[`${dir}/${a.file}`] : undefined));
    }
    throw new Error(`Không tìm thấy bài học "${id}"`);
  }

  async loadAssets(ids: string[]): Promise<Record<string, AssetRef>> {
    const want = new Set(ids);
    const out: Record<string, AssetRef> = {};
    for (const path of Object.keys(manifestFiles)) {
      const dir = dirOf(path);
      const m = await manifestFiles[path]();
      for (const a of m.assets) {
        if (want.has(a.id)) out[a.id] = { ...a, src: a.src ?? (a.file ? assetUrls[`${dir}/${a.file}`] : undefined) };
      }
    }
    return out;
  }
}
