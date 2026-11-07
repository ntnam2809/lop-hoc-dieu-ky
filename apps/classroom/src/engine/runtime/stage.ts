import type { AnimPreset, Emote, Entity, EntityOverride, Point, Scene } from '../types';
import { STAGE_H, STAGE_W } from '../types';
import { ParticleSystem } from '../fx/particles';
import { AssetStore } from './assets';
import { emoteIcon } from '../icons';

/** Một nhân vật/vật thể/vùng chạm trên sân khấu. */
export class EntityView {
  readonly el: HTMLElement;
  readonly motion: HTMLElement;
  readonly flipEl: HTMLElement;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  scale: number;
  opacity = 1;
  flip: boolean;
  hidden: boolean;
  preset: AnimPreset = 'none';
  private emoteEl: HTMLElement | null = null;
  private emoteTimer = 0;

  constructor(readonly def: Entity, assets: AssetStore) {
    this.x = def.x;
    this.y = def.y;
    this.w = def.w;
    this.h = def.h;
    this.rot = def.rotate ?? 0;
    this.scale = def.scale ?? 1;
    this.flip = !!def.flip;
    this.hidden = !!def.hidden;

    this.el = document.createElement('div');
    this.el.className = 'entity';
    this.el.dataset.entity = def.id;
    if (def.zone) this.el.classList.add('zone');
    if (def.decor) this.el.classList.add('decor');
    this.el.style.width = `${def.w}px`;
    this.el.style.height = `${def.h}px`;
    this.el.style.zIndex = String(def.z ?? 10);
    this.motion = document.createElement('div');
    this.motion.className = 'motion';
    this.flipEl = document.createElement('div');
    this.flipEl.className = 'flip';
    if (def.asset) this.flipEl.appendChild(assets.render(def.asset));
    this.motion.appendChild(this.flipEl);
    this.el.appendChild(this.motion);
    this.setPreset(def.anim ?? 'idle');
    this.apply();
  }

  get center(): Point {
    return { x: this.x, y: this.y };
  }

  /** Đỉnh đầu (dùng cho bong bóng cảm xúc, lời thoại). */
  get top(): Point {
    return { x: this.x, y: this.y - (this.h * this.scale) / 2 };
  }

  apply() {
    const s = this.scale;
    this.el.style.transform = `translate(${this.x - this.w / 2}px, ${this.y - this.h / 2}px) rotate(${this.rot}deg) scale(${s})`;
    this.el.style.opacity = String(this.opacity);
    this.el.style.visibility = this.hidden ? 'hidden' : 'visible';
    this.flipEl.style.transform = this.flip ? 'scaleX(-1)' : '';
  }

  setPreset(p: AnimPreset) {
    this.motion.classList.remove(`anim-${this.preset}`);
    this.preset = p;
    this.motion.classList.add(`anim-${p}`);
    // Lệch pha để nhiều nhân vật không nhún nhảy đồng loạt như rô-bốt.
    this.motion.style.animationDelay = `${-(this.def.id.length * 137) % 1000}ms`;
  }

  emote(kind: Emote, duration = 1800) {
    this.clearEmote();
    const b = document.createElement('div');
    b.className = `emote emote-${kind}`;
    b.innerHTML = emoteIcon(kind);
    this.el.appendChild(b);
    this.emoteEl = b;
    if (duration > 0) {
      this.emoteTimer = window.setTimeout(() => this.clearEmote(), duration);
    }
  }

  clearEmote() {
    clearTimeout(this.emoteTimer);
    if (!this.emoteEl) return;
    const el = this.emoteEl;
    this.emoteEl = null;
    el.classList.add('out');
    setTimeout(() => el.remove(), 250);
  }

  reset(def: Entity) {
    Object.assign(this, { x: def.x, y: def.y, w: def.w, h: def.h, rot: def.rotate ?? 0, scale: def.scale ?? 1, flip: !!def.flip, hidden: !!def.hidden, opacity: 1 });
    this.setPreset(def.anim ?? 'idle');
    this.clearEmote();
    this.apply();
  }
}

/**
 * Sân khấu cố định 1600×900, co giãn khớp màn hình (máy chiếu, TV, máy tính
 * bảng). Lớp `world` chịu camera; lớp `ui` (thẻ, ô thả, phụ đề) thì không.
 */
export class Stage {
  readonly viewport: HTMLElement;
  readonly stage: HTMLElement;
  readonly world: HTMLElement;
  readonly ui: HTMLElement;
  readonly fx: ParticleSystem;
  private bg: HTMLElement;
  private layer: HTMLElement;
  private captionEl: HTMLElement;
  entities = new Map<string, EntityView>();
  scene: Scene | null = null;
  scale = 1;
  camera = { zoom: 1, x: STAGE_W / 2, y: STAGE_H / 2 };
  private ro: ResizeObserver;

  constructor(container: HTMLElement, readonly assets: AssetStore) {
    this.viewport = document.createElement('div');
    this.viewport.className = 'stage-viewport';
    this.stage = document.createElement('div');
    this.stage.className = 'stage';
    this.world = document.createElement('div');
    this.world.className = 'world';
    this.bg = document.createElement('div');
    this.bg.className = 'stage-bg';
    this.layer = document.createElement('div');
    this.layer.className = 'stage-entities';
    const canvas = document.createElement('canvas');
    canvas.className = 'stage-fx';
    this.ui = document.createElement('div');
    this.ui.className = 'stage-ui';
    this.captionEl = document.createElement('div');
    this.captionEl.className = 'caption-layer';
    this.world.append(this.bg, this.layer, canvas);
    this.stage.append(this.world, this.ui, this.captionEl);
    this.viewport.appendChild(this.stage);
    container.appendChild(this.viewport);
    this.fx = new ParticleSystem(canvas);
    this.ro = new ResizeObserver(() => this.fit());
    this.ro.observe(this.viewport);
    this.fit();
  }

  fit() {
    const r = this.viewport.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.scale = Math.min(r.width / STAGE_W, r.height / STAGE_H);
    const ox = (r.width - STAGE_W * this.scale) / 2;
    const oy = (r.height - STAGE_H * this.scale) / 2;
    this.stage.style.transform = `translate(${ox}px, ${oy}px) scale(${this.scale})`;
    this.fx.resize(this.scale);
  }

  /** Dựng cảnh từ dữ liệu + override của hoạt động. Gọi lại = đặt lại cảnh về trạng thái đầu. */
  load(scene: Scene, overrides: Record<string, EntityOverride> = {}) {
    this.scene = scene;
    this.entities.clear();
    this.layer.replaceChildren();
    this.bg.replaceChildren();
    this.bg.style.background = scene.backdrop ?? '';
    const bgArt = this.assets.render(scene.background);
    bgArt.classList.add('bg-art');
    this.bg.appendChild(bgArt);
    for (const base of scene.entities) {
      const def = { ...base, ...(overrides[base.id] ?? {}) } as Entity;
      const v = new EntityView(def, this.assets);
      this.entities.set(def.id, v);
      this.layer.appendChild(v.el);
    }
    this.fx.clear();
    this.fx.setAmbient(scene.ambient ?? []);
    this.setCamera(1, { x: STAGE_W / 2, y: STAGE_H / 2 });
    this.clearCaptions();
    this.ui.replaceChildren();
  }

  entity(id: string): EntityView | undefined {
    return this.entities.get(id);
  }

  resolvePoint(p: Point | string, offset?: Point): Point {
    let pt: Point;
    if (typeof p === 'string') {
      const e = this.entities.get(p);
      pt = e ? e.center : { x: STAGE_W / 2, y: STAGE_H / 2 };
    } else pt = p;
    return offset ? { x: pt.x + offset.x, y: pt.y + offset.y } : pt;
  }

  setCamera(zoom: number, focus: Point) {
    const z = Math.max(1, zoom);
    const hw = STAGE_W / 2 / z;
    const hh = STAGE_H / 2 / z;
    const x = Math.min(STAGE_W - hw, Math.max(hw, focus.x));
    const y = Math.min(STAGE_H - hh, Math.max(hh, focus.y));
    this.camera = { zoom: z, x, y };
    this.world.style.transform = `translate(${STAGE_W / 2 - x * z}px, ${STAGE_H / 2 - y * z}px) scale(${z})`;
  }

  /** Toạ độ thế giới → toạ độ lớp UI (sau camera). */
  worldToUi(p: Point): Point {
    const { zoom, x, y } = this.camera;
    return { x: (p.x - x) * zoom + STAGE_W / 2, y: (p.y - y) * zoom + STAGE_H / 2 };
  }

  /** Toạ độ lớp UI → toạ độ thế giới (để bắn hạt hiệu ứng đúng chỗ thẻ). */
  uiToWorld(p: Point): Point {
    const { zoom, x, y } = this.camera;
    return { x: (p.x - STAGE_W / 2) / zoom + x, y: (p.y - STAGE_H / 2) / zoom + y };
  }

  /** Toạ độ con trỏ trên màn hình → toạ độ lớp UI 1600×900. */
  clientToUi(cx: number, cy: number): Point {
    const r = this.stage.getBoundingClientRect();
    return { x: (cx - r.left) / this.scale, y: (cy - r.top) / this.scale };
  }

  /** Hiện phụ đề (và bong bóng thoại nếu có nhân vật). Trả về hàm gỡ. */
  caption(text: string, target?: string): () => void {
    this.clearCaptions();
    const el = document.createElement('div');
    const e = target ? this.entities.get(target) : undefined;
    if (e && !e.hidden) {
      el.className = 'speech-bubble';
      const p = this.worldToUi(e.top);
      const left = Math.min(STAGE_W - 260, Math.max(260, p.x));
      el.style.left = `${left}px`;
      el.style.top = `${Math.max(150, p.y - 18)}px`;
      el.style.setProperty('--tail', `${p.x - left}px`);
    } else {
      el.className = 'caption';
    }
    el.textContent = text;
    this.captionEl.appendChild(el);
    return () => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
    };
  }

  clearCaptions() {
    this.captionEl.replaceChildren();
  }

  destroy() {
    this.ro.disconnect();
    this.fx.destroy();
    this.viewport.remove();
  }
}
