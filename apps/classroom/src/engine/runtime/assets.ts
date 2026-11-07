import type { AssetRef } from '../types';

/**
 * Kho asset của một bài học. SVG được nhúng trực tiếp (inline) để engine
 * điều khiển được từng bộ phận (chớp mắt, vẫy tai, đuôi…) qua class quy
 * ước trong art bible; ảnh raster (PNG/WebP từ GPT Image) vẫn chạy được với
 * mọi chuyển động toàn thân.
 */
export class AssetStore {
  private svgText = new Map<string, string>();
  private counter = 0;

  constructor(private assets: Record<string, AssetRef>) {}

  get(id: string): AssetRef | undefined {
    return this.assets[id];
  }

  isSvg(a: AssetRef): boolean {
    const s = a.src ?? a.file ?? '';
    return /\.svg(\?|#|$)/i.test(s) || s.startsWith('data:image/svg');
  }

  /** Tải trước toàn bộ asset; báo tiến độ 0..1. Lỗi một asset không làm sập bài. */
  async preload(ids: Iterable<string>, onProgress?: (p: number) => void): Promise<string[]> {
    const list = [...new Set(ids)].map((id) => this.assets[id]).filter(Boolean) as AssetRef[];
    const failed: string[] = [];
    let done = 0;
    await Promise.all(
      list.map(async (a) => {
        try {
          if (!a.src) throw new Error('no src');
          if (this.isSvg(a)) {
            const res = await fetch(a.src);
            if (!res.ok) throw new Error(String(res.status));
            this.svgText.set(a.id, sanitizeSvg(await res.text()));
          } else {
            await new Promise<void>((ok, err) => {
              const img = new Image();
              img.onload = () => ok();
              img.onerror = () => err(new Error('img'));
              img.src = a.src!;
            });
          }
        } catch {
          failed.push(a.id);
        } finally {
          done++;
          onProgress?.(done / Math.max(1, list.length));
        }
      }),
    );
    if (!list.length) onProgress?.(1);
    return failed;
  }

  /** Tạo phần tử hiển thị cho asset. Thiếu asset → khối placeholder dịu mắt thay vì vỡ màn hình. */
  render(id: string): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'art';
    const a = this.assets[id];
    const text = this.svgText.get(id);
    if (a && text) {
      wrap.innerHTML = uniquifyIds(text, `a${++this.counter}_`);
      const svg = wrap.querySelector('svg');
      if (svg) {
        svg.setAttribute('preserveAspectRatio', svg.getAttribute('preserveAspectRatio') ?? 'xMidYMid meet');
        svg.setAttribute('aria-hidden', 'true');
      }
    } else if (a?.src && !this.isSvg(a)) {
      const img = document.createElement('img');
      img.src = a.src;
      img.alt = '';
      img.draggable = false;
      wrap.appendChild(img);
    } else {
      wrap.classList.add('art-missing');
      wrap.title = `Thiếu asset: ${id}`;
    }
    return wrap;
  }
}

/** Loại bỏ script/handler — nội dung từ Storage không được phép chạy mã. */
export function sanitizeSvg(text: string): string {
  if (typeof DOMParser === 'undefined') return text;
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg') return '';
  svg.querySelectorAll('script, foreignObject').forEach((n) => n.remove());
  svg.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      const n = attr.name.toLowerCase();
      if (n.startsWith('on')) el.removeAttribute(attr.name);
      if ((n === 'href' || n === 'xlink:href') && !attr.value.startsWith('#')) el.removeAttribute(attr.name);
    }
  });
  return new XMLSerializer().serializeToString(svg);
}

/** Đổi id nội bộ của SVG cho từng bản sao để gradient/clipPath không giẫm lên nhau. */
export function uniquifyIds(svg: string, prefix: string): string {
  const ids = new Set<string>();
  svg.replace(/\sid="([^"]+)"/g, (_, id: string) => {
    ids.add(id);
    return '';
  });
  if (!ids.size) return svg;
  return svg
    .replace(/\sid="([^"]+)"/g, (_, id: string) => ` id="${prefix}${id}"`)
    .replace(/url\(#([^)]+)\)/g, (m, id: string) => (ids.has(id) ? `url(#${prefix}${id})` : m))
    .replace(/href="#([^"]+)"/g, (m, id: string) => (ids.has(id) ? `href="#${prefix}${id}"` : m));
}
