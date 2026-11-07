import type { Visual } from '../types';
import type { AssetStore } from '../runtime/assets';
import type { Stage } from '../runtime/stage';
import { sound } from '../fx/audio';
import { emoteIcon } from '../icons';
import { h } from '../dom';

export { h };

/** Minh hoạ nhỏ dựng từ nhiều lớp asset trong khung 400×300 (tỉ lệ 4:3). */
export function renderVisual(v: Visual | undefined, assets: AssetStore): HTMLElement {
  const box = h('div', 'visual');
  if (!v) return box;
  if (v.bg) box.style.background = v.bg;
  for (const l of v.layers) {
    const layer = h('div', 'visual-layer');
    layer.style.left = `${((l.x - l.w / 2) / 400) * 100}%`;
    layer.style.top = `${((l.y - l.h / 2) / 300) * 100}%`;
    layer.style.width = `${(l.w / 400) * 100}%`;
    layer.style.height = `${(l.h / 300) * 100}%`;
    if (l.rotate) layer.style.transform = `rotate(${l.rotate}deg)`;
    const motion = h('div', `motion anim-${l.anim ?? 'none'}`);
    const flip = h('div', 'flip');
    if (l.flip) flip.style.transform = 'scaleX(-1)';
    flip.appendChild(assets.render(l.asset));
    motion.appendChild(flip);
    layer.appendChild(motion);
    if (l.emote) {
      const em = h('div', `visual-emote emote-${l.emote}`);
      em.innerHTML = emoteIcon(l.emote);
      layer.appendChild(em);
    }
    box.appendChild(layer);
  }
  return box;
}

/** Thẻ lớn cho trẻ chạm: hình + chữ (chữ để giáo viên đọc, trẻ không cần đọc). */
export function makeCard(opts: { id: string; label: string; visual?: Visual; assets: AssetStore; className?: string }): HTMLElement {
  const card = h('button', `card ${opts.className ?? ''}`, { type: 'button', 'data-card': opts.id, 'aria-label': opts.label });
  card.append(renderVisual(opts.visual, opts.assets), h('span', 'card-label', {}, [opts.label]));
  return card;
}

/** Tâm phần tử theo toạ độ lớp UI 1600×900. */
export function uiCenter(stage: Stage, el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return stage.clientToUi(r.left + r.width / 2, r.top + r.height / 2);
}

/** Xuất hiện so le, nảy nhẹ. */
export function staggerIn(els: HTMLElement[], base = 0, gap = 90) {
  els.forEach((el, i) => {
    el.style.animationDelay = `${base + i * gap}ms`;
    el.classList.add('enter-pop');
    // Gỡ animation vào cảnh khi xong, để không đè transform lúc kéo thả.
    el.addEventListener('animationend', function done(e) {
      if (e.target !== el) return;
      el.classList.remove('enter-pop');
      el.style.animationDelay = '';
      el.removeEventListener('animationend', done);
    });
    setTimeout(() => sound.play('pop'), base + i * gap);
  });
}

export interface DragOptions {
  stage: Stage;
  el: HTMLElement;
  /** Bắt đầu kéo (trả false để chặn). */
  onStart?: () => boolean | void;
  onMove?: (p: { x: number; y: number }) => void;
  /** Thả; trả true nếu được nhận (đã tự đặt vị trí), false để bay về chỗ cũ. */
  onDrop: (p: { x: number; y: number }) => boolean | Promise<boolean>;
  /** Chạm không kéo (dùng cho chế độ chạm-chọn rồi chạm-ô). */
  onTap?: () => void;
}

/**
 * Kéo thả bằng Pointer Events (chuột, cảm ứng, bảng tương tác). Thẻ nghiêng
 * theo vận tốc kéo, thả trượt thì bay về vị trí cũ bằng lò xo.
 */
export function makeDraggable(o: DragOptions): () => void {
  const { el, stage } = o;
  let start: { x: number; y: number } | null = null;
  let last = { x: 0, y: 0, t: 0 };
  let dragging = false;
  let tilt = 0;
  let pid = -1;

  const down = (e: PointerEvent) => {
    if (e.button > 0 || el.classList.contains('locked')) return;
    start = stage.clientToUi(e.clientX, e.clientY);
    last = { ...start, t: performance.now() };
    pid = e.pointerId;
    el.setPointerCapture(e.pointerId);
    dragging = false;
  };
  const move = (e: PointerEvent) => {
    if (!start || e.pointerId !== pid) return;
    const p = stage.clientToUi(e.clientX, e.clientY);
    const dx = p.x - start.x;
    const dy = p.y - start.y;
    if (!dragging) {
      if (Math.hypot(dx, dy) < 12) return;
      if (o.onStart?.() === false) {
        start = null;
        return;
      }
      dragging = true;
      el.classList.add('dragging');
      sound.play('pickup');
    }
    const now = performance.now();
    const vx = (p.x - last.x) / Math.max(1, now - last.t);
    last = { ...p, t: now };
    tilt += (Math.max(-18, Math.min(18, vx * 14)) - tilt) * 0.3;
    el.style.transform = `translate(${dx}px, ${dy}px) rotate(${tilt}deg) scale(1.08)`;
    o.onMove?.(p);
  };
  const up = async (e: PointerEvent) => {
    if (!start || e.pointerId !== pid) return;
    const was = dragging;
    start = null;
    dragging = false;
    try { el.releasePointerCapture(e.pointerId); } catch { /* đã nhả */ }
    if (!was) {
      o.onTap?.();
      return;
    }
    const p = stage.clientToUi(e.clientX, e.clientY);
    el.classList.remove('dragging');
    const ok = await o.onDrop(p);
    if (!ok) {
      el.classList.add('returning');
      el.style.transform = '';
      tilt = 0;
      setTimeout(() => el.classList.remove('returning'), 450);
    }
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.style.touchAction = 'none';
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
  };
}

/** Điểm (UI) có nằm trong phần tử không, có nới biên cho ngón tay nhỏ. */
export function hitTest(stage: Stage, el: Element, p: { x: number; y: number }, pad = 30): boolean {
  const r = el.getBoundingClientRect();
  const a = stage.clientToUi(r.left, r.top);
  const b = stage.clientToUi(r.right, r.bottom);
  return p.x >= a.x - pad && p.x <= b.x + pad && p.y >= a.y - pad && p.y <= b.y + pad;
}

/** Bay một phần tử từ vị trí hiện tại vào tâm phần tử đích (FLIP). */
export function flyInto(stage: Stage, el: HTMLElement, target: HTMLElement): Promise<void> {
  const r1 = el.getBoundingClientRect();
  target.appendChild(el);
  el.style.transform = '';
  const r2 = el.getBoundingClientRect();
  const s = stage.scale;
  const dx = (r1.left - r2.left) / s;
  const dy = (r1.top - r2.top) / s;
  el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(1.08)` },
      { transform: 'translate(0,0) scale(0.92)', offset: 0.75 },
      { transform: 'translate(0,0) scale(1)' },
    ],
    { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' },
  );
  return new Promise((r) => setTimeout(r, 420));
}
