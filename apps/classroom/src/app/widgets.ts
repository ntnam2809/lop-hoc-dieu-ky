import type { AssetRef, ContentStatus, Visual } from '../engine/types';
import { AssetStore } from '../engine/runtime/assets';
import { renderVisual } from '../engine/activities/ui';
import { h } from '../engine/dom';
import { icons } from '../engine/icons';
import { sound } from '../engine/fx/audio';
import { narrator } from '../engine/fx/speech';
import { saveSettings, settings, type Settings } from './state';

export { h };

export function iconButton(icon: string, label: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = h('button', `icon-btn ${cls}`, { type: 'button', 'aria-label': label, title: label });
  b.innerHTML = icon;
  b.addEventListener('click', () => {
    sound.unlock();
    sound.play('tap');
    onClick();
  });
  return b;
}

const statusText: Record<ContentStatus, string> = {
  draft: 'Bản nháp',
  review: 'Chờ duyệt',
  approved: 'Đã duyệt',
  published: 'Đã xuất bản',
  archived: 'Lưu trữ',
};

export function statusBadge(status: ContentStatus): HTMLElement | string {
  if (status === 'published') return '';
  return h('span', `status-badge status-${status}`, { title: 'Nội dung chưa xuất bản — cần giáo viên/chuyên môn duyệt trước khi dùng chính thức' }, [statusText[status]]);
}

/** Minh hoạ động cho thẻ ở màn chọn — dùng chung renderer thẻ của engine. */
export async function coverArt(visual: Visual | undefined, assets: Record<string, AssetRef>): Promise<HTMLElement> {
  const store = new AssetStore(assets);
  if (visual) await store.preload(visual.layers.map((l) => l.asset));
  return renderVisual(visual, store);
}

export function brandMark(): string {
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="bm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD54F"/><stop offset="1" stop-color="#FF8A5B"/></linearGradient></defs>
  <path d="M32 4l7.8 16 17.6 2.6-12.7 12.4 3 17.5L32 44.2 16.3 52.5l3-17.5L6.6 22.6 24.2 20z" fill="url(#bm)" stroke="#5A3B2E" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="25" cy="30" r="2.6" fill="#5A3B2E"/><circle cx="39" cy="30" r="2.6" fill="#5A3B2E"/>
  <path d="M26.5 36.5q5.5 5 11 0" fill="none" stroke="#5A3B2E" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="21" cy="35" r="2.6" fill="#FF8FB1" opacity=".7"/><circle cx="43" cy="35" r="2.6" fill="#FF8FB1" opacity=".7"/></svg>`;
}

/** Bảng cài đặt nhanh cho giáo viên. */
export function settingsPanel(onClose: () => void): HTMLElement {
  const panel = h('div', 'settings-panel', { role: 'dialog', 'aria-label': 'Cài đặt' });
  const row = (key: keyof Settings, icon: string, label: string, note?: string) => {
    const r = h('label', 'setting-row');
    const ic = h('span', 'setting-icon');
    ic.innerHTML = icon;
    const input = h('input', '', { type: 'checkbox' });
    input.checked = settings[key];
    input.addEventListener('change', () => {
      saveSettings({ [key]: input.checked });
      sound.play('tap');
    });
    const text = h('span', 'setting-text', {}, [label]);
    if (note) text.append(h('small', '', {}, [note]));
    r.append(ic, text, input, h('span', 'switch'));
    return r;
  };
  const voiceNote = narrator.available ? undefined : 'Máy chưa có giọng tiếng Việt — phụ đề vẫn hiện để cô đọc';
  panel.append(
    h('h3', '', {}, ['Cài đặt lớp học']),
    row('sound', icons.sound, 'Hiệu ứng âm thanh'),
    row('narration', icons.voice, 'Đọc lời dẫn', voiceNote),
    row('music', icons.music, 'Nhạc nền nhẹ'),
    row('autoAdvance', icons.skip, 'Tự chuyển hoạt động', 'Tắt để cô chủ động dẫn dắt (khuyên dùng)'),
  );
  const close = iconButton(icons.close, 'Đóng', onClose, 'settings-close');
  panel.prepend(close);
  return panel;
}

export function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.().catch(() => {});
}

export function topbar(opts: { back?: () => void; title?: string; right?: HTMLElement[] } = {}): HTMLElement {
  const bar = h('header', 'topbar');
  const left = h('div', 'topbar-left');
  if (opts.back) left.append(iconButton(icons.back, 'Quay lại', opts.back, 'ghost'));
  const brand = h('a', 'brand', { href: '#/' });
  brand.innerHTML = `${brandMark()}<span><b>Lớp Học Diệu Kỳ</b><small>Đồ dùng dạy học số cho lớp Lá</small></span>`;
  left.append(brand);
  const right = h('div', 'topbar-right');
  let panel: HTMLElement | null = null;
  const settingsBtn = iconButton(icons.settings, 'Cài đặt', () => {
    if (panel) {
      panel.remove();
      panel = null;
      return;
    }
    panel = settingsPanel(() => {
      panel?.remove();
      panel = null;
    });
    bar.append(panel);
  }, 'ghost');
  right.append(...(opts.right ?? []), settingsBtn, iconButton(icons.fullscreen, 'Toàn màn hình', toggleFullscreen, 'ghost'));
  bar.append(left, right);
  return bar;
}

/** Hình nền trang trí trôi nhẹ cho các màn giáo viên. */
export function floatingDecor(): HTMLElement {
  const box = h('div', 'decor-layer', { 'aria-hidden': 'true' });
  const shapes = ['star', 'circle', 'cloud', 'star', 'circle', 'leaf', 'star', 'cloud', 'circle', 'leaf'];
  shapes.forEach((s, i) => {
    const d = h('span', `deco deco-${s}`);
    d.style.left = `${(i * 97 + 13) % 100}%`;
    d.style.top = `${(i * 53 + 7) % 92}%`;
    d.style.animationDelay = `${-i * 1.7}s`;
    d.style.setProperty('--s', String(0.6 + ((i * 37) % 10) / 10));
    box.appendChild(d);
  });
  return box;
}
