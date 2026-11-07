/**
 * Xuất bản nội dung lên Firebase (Firestore + Storage).
 *
 *   npm run publish:content -- --project <id> [--bucket <bucket>] [--lesson <id>] [--include-drafts] [--apply]
 *
 * Mặc định chỉ IN KẾ HOẠCH (dry-run); thêm --apply để ghi thật.
 * Xác thực: biến môi trường GOOGLE_APPLICATION_CREDENTIALS trỏ tới file
 * service account (không commit file này).
 *
 * Cổng duyệt (đặc tả §14): chỉ bài có status "approved"/"published" VÀ có
 * review.reviewedBy mới được đưa lên với status "published". --include-drafts
 * đưa bản nháp lên nguyên trạng thái để người duyệt xem qua ?preview — người
 * dùng thường không đọc được (firestore.rules).
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePackage, referencedAssetIds, type AssetManifestFile, type LessonPackageFile } from '../src/engine/content/package';
import type { ContentStatus } from '../src/engine/types';
import { runQa } from './qa';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');
const args = process.argv.slice(2);
const opt = (k: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (k: string) => args.includes(`--${k}`);

const project = opt('project') ?? process.env.GOOGLE_CLOUD_PROJECT ?? process.env.VITE_FIREBASE_PROJECT_ID;
const bucket = opt('bucket') ?? process.env.VITE_FIREBASE_STORAGE_BUCKET ?? (project ? `${project}.firebasestorage.app` : undefined);
const onlyLesson = opt('lesson');
const includeDrafts = flag('include-drafts');
const apply = flag('apply');

const MIME: Record<string, string> = { '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };

/** Trạng thái sẽ ghi lên server, hoặc null nếu bị chặn bởi cổng duyệt. */
function gate(status: ContentStatus, reviewedBy?: string): ContentStatus | null {
  if (status === 'archived') return 'archived';
  if ((status === 'approved' || status === 'published') && reviewedBy) return 'published';
  return includeDrafts ? status : null;
}

async function main() {
  const qa = runQa(root);
  const errors = [...qa.catalog, ...qa.lessons.flatMap((l) => l.issues)].filter((i) => i.level === 'error');
  if (errors.length) {
    console.error(`✗ Nội dung còn ${errors.length} lỗi — chạy "npm run validate" để xem. Dừng xuất bản.`);
    process.exit(1);
  }
  if (apply && !project) {
    console.error('✗ Thiếu --project (hoặc GOOGLE_CLOUD_PROJECT).');
    process.exit(1);
  }

  type Write = { col: string; id: string; data: Record<string, unknown> };
  const writes: Write[] = [];
  const uploads: Array<{ path: string; dest: string; token: string; assetId: string }> = [];
  const catalog = JSON.parse(readFileSync(join(root, 'catalog.json'), 'utf8'));
  const now = new Date().toISOString();

  for (const d of catalog.domains) {
    const s = gate(d.status, 'catalog');
    if (s) writes.push({ col: 'domains', id: d.id, data: { ...d, status: s } });
  }
  for (const t of catalog.topics) {
    const s = gate(t.status, 'catalog');
    if (s) writes.push({ col: 'topics', id: t.id, data: { ...t, status: s } });
  }

  const lessonsDir = join(root, 'lessons');
  for (const dir of readdirSync(lessonsDir)) {
    const lp = join(lessonsDir, dir, 'lesson.json');
    if (!existsSync(lp)) continue;
    const pkg = JSON.parse(readFileSync(lp, 'utf8')) as LessonPackageFile;
    if (onlyLesson && pkg.lesson.id !== onlyLesson) continue;
    const status = gate(pkg.lesson.status, pkg.lesson.review?.reviewedBy);
    if (!status) {
      console.log(`– bỏ qua "${pkg.lesson.id}" (status ${pkg.lesson.status}, chưa được duyệt; dùng --include-drafts để đưa lên xem trước)`);
      continue;
    }
    const manifest = JSON.parse(readFileSync(join(lessonsDir, dir, 'assets.json'), 'utf8')) as AssetManifestFile;
    const b = normalizePackage(pkg, manifest, () => undefined);
    const used = [...referencedAssetIds(b)];
    // Ảnh bìa ở catalog có thể dùng asset của gói này → đưa lên luôn.
    for (const dm of catalog.domains) for (const l of dm.cover?.layers ?? []) if (b.assets[l.asset] && !used.includes(l.asset)) used.push(l.asset);

    for (const id of used) {
      const a = b.assets[id];
      if (!a.file) continue;
      const token = randomUUID();
      const dest = `content/assets/${a.id}${extname(a.file)}`;
      uploads.push({ path: join(lessonsDir, dir, a.file), dest, token, assetId: a.id });
      const src = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(dest)}?alt=media&token=${token}`;
      const { file: _file, ...rest } = a;
      writes.push({ col: 'assets', id: a.id, data: { ...rest, src, status } });
    }
    const lesson = { ...b.lesson, status, assetIds: used, publishedAt: status === 'published' ? now : null };
    writes.push({ col: 'lessons', id: b.lesson.id, data: lesson });
    for (const s of b.scenarios) writes.push({ col: 'scenarios', id: s.id, data: { ...s, status } });
    for (const a of b.activities) writes.push({ col: 'activities', id: a.id, data: { ...a, lessonId: b.lesson.id, status } });
  }

  console.log(`\nKế hoạch: ${writes.length} tài liệu Firestore · ${uploads.length} file Storage (project ${project ?? '?'}, bucket ${bucket ?? '?'})`);
  const byCol = writes.reduce<Record<string, number>>((m, w) => ((m[w.col] = (m[w.col] ?? 0) + 1), m), {});
  for (const [c, n] of Object.entries(byCol)) console.log(`  ${c}: ${n}`);
  if (!apply) {
    console.log('\n(dry-run) Thêm --apply để ghi thật.\n');
    return;
  }

  const { initializeApp, applicationDefault } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const { getStorage } = await import('firebase-admin/storage');
  const app = initializeApp({ credential: applicationDefault(), projectId: project, storageBucket: bucket });
  const db = getFirestore(app);
  const store = getStorage(app).bucket();

  for (const u of uploads) {
    await store.upload(u.path, {
      destination: u.dest,
      metadata: {
        contentType: MIME[extname(u.path).toLowerCase()] ?? 'application/octet-stream',
        cacheControl: 'public, max-age=86400',
        metadata: { firebaseStorageDownloadTokens: u.token },
      },
    });
    console.log(`↑ ${u.dest}`);
  }
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + 400)) batch.set(db.collection(w.col).doc(w.id), JSON.parse(JSON.stringify(w.data)));
    await batch.commit();
  }
  console.log(`✓ Đã ghi ${writes.length} tài liệu.\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
