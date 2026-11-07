import type { AssetRef, Catalog, LessonBundle } from '../types';

/**
 * Nguồn nội dung. Engine chỉ nói chuyện qua giao diện này nên có thể đổi
 * giữa gói JSON cục bộ (dev, offline) và Firestore/Storage (production)
 * mà không chạm vào phần còn lại.
 */
export interface ContentSource {
  readonly name: string;
  /** true khi đang xem cả nội dung chưa xuất bản (draft/review/approved). */
  readonly preview: boolean;
  loadCatalog(): Promise<Catalog>;
  loadLesson(id: string): Promise<LessonBundle>;
  /** Asset cho minh hoạ ngoài bài học (thẻ mảng, thẻ bài ở màn chọn). */
  loadAssets(ids: string[]): Promise<Record<string, AssetRef>>;
}

export function isVisible(status: string, preview: boolean): boolean {
  if (status === 'archived') return false;
  return preview || status === 'published';
}

let current: ContentSource | null = null;

export async function getContentSource(): Promise<ContentSource> {
  if (current) return current;
  const params = new URLSearchParams(location.search);
  const kind = params.get('source') ?? import.meta.env.VITE_CONTENT_SOURCE ?? 'local';
  const preview = params.has('preview');
  if (kind === 'firebase') {
    const { FirebaseContentSource } = await import('./firebase-source');
    current = new FirebaseContentSource(preview);
  } else {
    const { LocalContentSource } = await import('./local-source');
    // Gói cục bộ là môi trường soạn/duyệt: hiện cả bản nháp, kèm nhãn trạng thái.
    current = new LocalContentSource(true);
  }
  return current;
}
