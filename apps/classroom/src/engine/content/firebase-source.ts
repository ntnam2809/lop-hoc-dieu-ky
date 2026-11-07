import type { Activity, AssetRef, Catalog, Domain, Lesson, LessonBundle, Scenario, Topic } from '../types';
import { isVisible, type ContentSource } from './source';

/**
 * Nạp nội dung từ Firestore (collections: domains · topics · lessons ·
 * scenarios · activities · assets). File asset nằm trên Firebase Storage;
 * tools/publish.ts đã ghi sẵn URL tải xuống vào trường `src` của asset.
 *
 * Người dùng thường chỉ đọc được tài liệu `status == "published"` (xem
 * firestore.rules). Chế độ `?preview` đăng nhập Google và cần custom claim
 * `reviewer` để xem bản nháp phục vụ duyệt nội dung.
 */
export class FirebaseContentSource implements ContentSource {
  readonly name = 'firebase';
  private dbPromise: Promise<FirestoreKit> | null = null;

  constructor(readonly preview: boolean) {}

  private db(): Promise<FirestoreKit> {
    this.dbPromise ??= initFirestore(this.preview);
    return this.dbPromise;
  }

  async loadCatalog(): Promise<Catalog> {
    const kit = await this.db();
    const [domains, topics, lessons] = await Promise.all([
      kit.list<Domain>('domains', this.preview),
      kit.list<Topic>('topics', this.preview),
      kit.list<Lesson>('lessons', this.preview),
    ]);
    const vis = (s: { status: string }) => isVisible(s.status, this.preview);
    return {
      domains: domains.filter(vis).sort((a, b) => a.order - b.order),
      topics: topics.filter(vis).sort((a, b) => a.order - b.order),
      lessons: lessons.filter(vis).sort((a, b) => a.order - b.order),
    };
  }

  async loadLesson(id: string): Promise<LessonBundle> {
    const kit = await this.db();
    const lesson = await kit.get<Lesson & { assetIds?: string[] }>('lessons', id);
    if (!lesson || !isVisible(lesson.status, this.preview)) throw new Error(`Không tìm thấy bài học "${id}"`);
    const [scenarios, activities] = await Promise.all([
      kit.where<Scenario>('scenarios', 'lessonId', id, this.preview),
      kit.where<Activity>('activities', 'lessonId', id, this.preview),
    ]);
    const assetList = await kit.byIds<AssetRef>('assets', lesson.assetIds ?? [], this.preview);
    const assets: Record<string, AssetRef> = {};
    for (const a of assetList) assets[a.id] = a;
    return { lesson, scenarios, activities, assets };
  }

  async loadAssets(ids: string[]): Promise<Record<string, AssetRef>> {
    const kit = await this.db();
    const out: Record<string, AssetRef> = {};
    for (const a of await kit.byIds<AssetRef>('assets', [...new Set(ids)], this.preview)) out[a.id] = a;
    return out;
  }
}

interface FirestoreKit {
  list<T>(col: string, preview: boolean): Promise<T[]>;
  get<T>(col: string, id: string): Promise<T | null>;
  where<T>(col: string, field: string, value: string, preview: boolean): Promise<T[]>;
  byIds<T>(col: string, ids: string[], preview: boolean): Promise<T[]>;
}

async function initFirestore(preview: boolean): Promise<FirestoreKit> {
  const env = import.meta.env;
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    appId: env.VITE_FIREBASE_APP_ID,
  };
  if (!config.projectId) throw new Error('Chưa cấu hình Firebase (VITE_FIREBASE_* trong .env)');

  const { initializeApp } = await import('firebase/app');
  const fs = await import('firebase/firestore');
  const app = initializeApp(config);
  const db = fs.getFirestore(app);

  if (preview) {
    const auth = await import('firebase/auth');
    const a = auth.getAuth(app);
    await a.authStateReady();
    if (!a.currentUser) await auth.signInWithPopup(a, new auth.GoogleAuthProvider());
  }

  const published = (preview: boolean) => (preview ? [] : [fs.where('status', '==', 'published')]);
  const data = <T>(d: { id: string; data(): unknown }) => ({ id: d.id, ...(d.data() as object) }) as T;

  return {
    async list<T>(col: string, pv: boolean) {
      const snap = await fs.getDocs(fs.query(fs.collection(db, col), ...published(pv)));
      return snap.docs.map((d) => data<T>(d));
    },
    async get<T>(col: string, id: string) {
      const snap = await fs.getDoc(fs.doc(db, col, id));
      return snap.exists() ? data<T>(snap) : null;
    },
    async where<T>(col: string, field: string, value: string, pv: boolean) {
      const snap = await fs.getDocs(fs.query(fs.collection(db, col), fs.where(field, '==', value), ...published(pv)));
      return snap.docs.map((d) => data<T>(d));
    },
    async byIds<T>(col: string, ids: string[], pv: boolean) {
      const out: T[] = [];
      for (let i = 0; i < ids.length; i += 30) {
        const chunk = ids.slice(i, i + 30);
        const snap = await fs.getDocs(
          fs.query(fs.collection(db, col), fs.where(fs.documentId(), 'in', chunk), ...published(pv)),
        );
        out.push(...snap.docs.map((d) => data<T>(d)));
      }
      return out;
    },
  };
}
