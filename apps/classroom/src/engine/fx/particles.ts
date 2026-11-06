import type { AmbientFx, AmbientSpec, FxKind } from '../types';
import { STAGE_H, STAGE_W } from '../types';
import { ticker } from '../runtime/ticker';

type Shape = 'circle' | 'star' | 'rect' | 'leaf' | 'drop' | 'ring' | 'bubble' | 'heart' | 'glow' | 'butterfly' | 'puff';

interface P {
  shape: Shape;
  x: number; y: number;
  vx: number; vy: number;
  ax: number; ay: number;
  drag: number;
  life: number; max: number;
  size: number; grow: number;
  rot: number; vr: number;
  color: string;
  alpha: number;
  phase: number;
  wobble: number;
  /** Tỉ lệ dẹt (ring trên mặt nước). */
  squash: number;
  fadeIn: number;
  twinkle: boolean;
  flutter: boolean;
  /** Bướm/đom đóm: điểm đích lang thang. */
  tx?: number; ty?: number;
  ambient?: AmbientFx;
}

const GOLD = ['#FFD54F', '#FFE082', '#FFF3C4', '#FFB300'];
const CONFETTI = ['#FF7A59', '#FFC94A', '#5CC9A7', '#5AB3F0', '#9C88FF', '#FF8FB1'];
const WATER = ['#BFE6FF', '#8FD3FF', '#E6F6FF', '#6EC3F5'];
const LEAF = ['#7CC76B', '#A5D86E', '#F2B84B', '#E98A4A'];
const BUTTERFLY = ['#FF9BC0', '#FFC94A', '#9C88FF', '#6EC3F5'];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pickc = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

/** Hệ hạt hiệu ứng vẽ trên canvas trong không gian sân khấu 1600×900. */
export class ParticleSystem {
  private ctx: CanvasRenderingContext2D;
  private ps: P[] = [];
  private ambient: Array<AmbientSpec & { acc: number }> = [];
  private off: () => void;
  private res = 1;
  private glowCache = new Map<string, HTMLCanvasElement>();

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize(1);
    this.off = ticker.add((dt) => this.step(dt));
  }

  /** `scale` = tỉ lệ hiển thị của sân khấu; độ phân giải canvas bám theo để luôn sắc nét. */
  resize(scale: number) {
    const r = Math.max(0.5, Math.min(2, scale * (globalThis.devicePixelRatio || 1)));
    if (Math.abs(r - this.res) < 0.05 && this.canvas.width) return;
    this.res = r;
    this.canvas.width = Math.round(STAGE_W * r);
    this.canvas.height = Math.round(STAGE_H * r);
  }

  setAmbient(list: Array<AmbientFx | AmbientSpec> = []) {
    this.ambient = list.map((a) => ({ ...(typeof a === 'string' ? { fx: a } : a), acc: 0 }));
    this.ps = this.ps.filter((p) => !p.ambient);
    // Gieo sẵn để cảnh "sống" ngay khi xuất hiện, không đợi hạt bay vào.
    for (const a of this.ambient) {
      const n = { pollen: 18, fireflies: 14, butterflies: 3, motes: 22, leaves: 3, bubbles: 6 }[a.fx] * (a.density ?? 1);
      for (let i = 0; i < n; i++) this.spawnAmbient(a, true);
    }
  }

  clear() {
    this.ps = this.ps.filter((p) => p.ambient);
  }

  destroy() {
    this.off();
    this.ps = [];
  }

  private add(p: Partial<P> & Pick<P, 'shape' | 'x' | 'y'>) {
    if (this.ps.length > 900) return;
    this.ps.push({
      vx: 0, vy: 0, ax: 0, ay: 0, drag: 0, life: 0, max: 1000, size: 8, grow: 0,
      rot: 0, vr: 0, color: '#fff', alpha: 1, phase: Math.random() * 6.28, wobble: 0,
      squash: 1, fadeIn: 0, twinkle: false, flutter: false,
      ...p,
    });
  }

  burst(kind: FxKind, x: number, y: number, size = 1) {
    const s = size;
    switch (kind) {
      case 'sparkle':
        for (let i = 0; i < 16 * s; i++) {
          const a = rand(0, Math.PI * 2);
          const v = rand(0.08, 0.32) * s;
          this.add({ shape: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.002, max: rand(600, 1100),
            size: rand(8, 18) * s, rot: rand(0, 6), vr: rand(-0.006, 0.006), color: pickc(GOLD), twinkle: true });
        }
        for (let i = 0; i < 6; i++) this.add({ shape: 'glow', x: x + rand(-30, 30) * s, y: y + rand(-30, 30) * s, max: rand(500, 900), size: rand(30, 60) * s, color: '#FFF1B8', grow: 0.02 });
        break;
      case 'stars': {
        this.add({ shape: 'ring', x, y, max: 700, size: 30 * s, grow: 0.55 * s, color: '#FFE082' });
        this.add({ shape: 'ring', x, y, max: 900, size: 10 * s, grow: 0.4 * s, color: '#FFFFFF' });
        this.add({ shape: 'glow', x, y, max: 600, size: 160 * s, grow: 0.15, color: '#FFF4C7' });
        const n = 10;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
          const v = rand(0.35, 0.55) * s;
          this.add({ shape: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.0035, ay: 0.0002, max: rand(900, 1300),
            size: rand(18, 30) * s, rot: rand(0, 6), vr: rand(-0.01, 0.01), color: pickc(GOLD) });
        }
        this.burst('sparkle', x, y, s * 0.8);
        break;
      }
      case 'confetti':
        for (let i = 0; i < 70 * s; i++) {
          const a = rand(-Math.PI * 0.85, -Math.PI * 0.15);
          const v = rand(0.45, 1.05);
          this.add({ shape: Math.random() < 0.7 ? 'rect' : 'circle', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
            ay: 0.0011, drag: 0.0022, max: rand(1800, 2800), size: rand(9, 15), rot: rand(0, 6), vr: rand(-0.02, 0.02),
            color: pickc(CONFETTI), flutter: true, phase: rand(0, 6) });
        }
        break;
      case 'splash':
        for (let i = 0; i < 30 * s; i++) {
          const a = rand(-Math.PI * 0.92, -Math.PI * 0.08);
          const v = rand(0.25, 0.75) * Math.sqrt(s);
          this.add({ shape: 'drop', x: x + rand(-20, 20) * s, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 0.0018,
            max: rand(600, 1000), size: rand(5, 12) * s, color: pickc(WATER) });
        }
        this.burst('ripple', x, y + 4, s);
        break;
      case 'ripple':
        for (let i = 0; i < 3; i++) {
          this.add({ shape: 'ring', x, y, max: 1200 + i * 250, size: 12 * s, grow: (0.14 + i * 0.03) * s, squash: 0.22,
            color: '#FFFFFF', fadeIn: i * 180, alpha: 0.9 });
        }
        break;
      case 'bubbles':
        for (let i = 0; i < 14 * s; i++) {
          this.add({ shape: 'bubble', x: x + rand(-26, 26) * s, y: y + rand(-10, 20), vy: rand(-0.06, -0.14), wobble: rand(0.4, 1.2),
            max: rand(1200, 2200), size: rand(5, 14) * s, color: '#E6F6FF', fadeIn: rand(0, 600) });
        }
        break;
      case 'leaves':
        for (let i = 0; i < 9 * s; i++) {
          const a = rand(-Math.PI * 0.9, -Math.PI * 0.1);
          this.add({ shape: 'leaf', x, y, vx: Math.cos(a) * rand(0.1, 0.35), vy: Math.sin(a) * rand(0.15, 0.4), ay: 0.0004,
            drag: 0.002, wobble: rand(0.5, 1.2), max: rand(1500, 2500), size: rand(12, 20), rot: rand(0, 6), vr: rand(-0.004, 0.004), color: pickc(LEAF) });
        }
        break;
      case 'dust':
        for (let i = 0; i < 12 * s; i++) {
          const a = rand(-Math.PI, 0);
          this.add({ shape: 'puff', x: x + rand(-20, 20) * s, y, vx: Math.cos(a) * rand(0.05, 0.18), vy: Math.sin(a) * rand(0.02, 0.08),
            drag: 0.002, max: rand(600, 1000), size: rand(12, 24) * s, grow: 0.03, color: '#E9DCC7', alpha: 0.85 });
        }
        break;
      case 'hearts':
        for (let i = 0; i < 7 * s; i++) {
          this.add({ shape: 'heart', x: x + rand(-40, 40) * s, y: y + rand(-10, 10), vy: rand(-0.06, -0.13), wobble: rand(0.4, 0.9),
            max: rand(1300, 2000), size: rand(14, 26) * s, color: pickc(['#FF6F91', '#FF8FB1', '#FF5C7A']), fadeIn: rand(0, 400) });
        }
        break;
      case 'tears':
        for (const side of [-1, 1]) {
          for (let i = 0; i < 4; i++) {
            this.add({ shape: 'drop', x: x + side * 22 * s, y, vx: side * rand(0.02, 0.06), vy: rand(-0.05, 0), ay: 0.0009,
              max: rand(700, 1000), size: rand(5, 8) * s, color: '#8FD3FF', fadeIn: i * 260 });
          }
        }
        break;
    }
  }

  private area(a: AmbientSpec) {
    return a.area ?? { x: 0, y: 0, w: STAGE_W, h: STAGE_H };
  }

  private spawnAmbient(a: AmbientSpec, seed = false) {
    const r = this.area(a);
    const rx = () => rand(r.x, r.x + r.w);
    const ry = () => rand(r.y, r.y + r.h);
    switch (a.fx) {
      case 'pollen':
        this.add({ ambient: a.fx, shape: 'glow', x: rx(), y: ry(), vx: rand(-0.01, 0.02), vy: rand(-0.015, -0.004), wobble: rand(0.2, 0.6),
          max: rand(5000, 9000), life: seed ? rand(0, 4000) : 0, size: rand(5, 11), color: '#FFF0B3', fadeIn: 800, twinkle: true });
        break;
      case 'motes':
        this.add({ ambient: a.fx, shape: 'glow', x: rx(), y: ry(), vx: rand(-0.008, 0.008), vy: rand(-0.008, 0.004), wobble: rand(0.1, 0.4),
          max: rand(6000, 10000), life: seed ? rand(0, 5000) : 0, size: rand(3, 7), color: '#FFFFFF', alpha: 0.7, fadeIn: 1200, twinkle: true });
        break;
      case 'fireflies':
        this.add({ ambient: a.fx, shape: 'glow', x: rx(), y: ry(), max: rand(6000, 11000), life: seed ? rand(0, 5000) : 0, size: rand(10, 16),
          color: '#E8FF9E', fadeIn: 900, twinkle: true, tx: rx(), ty: ry() });
        break;
      case 'butterflies':
        this.add({ ambient: a.fx, shape: 'butterfly', x: seed ? rx() : r.x - 40, y: ry(), max: 1e9, size: rand(16, 22), color: pickc(BUTTERFLY),
          tx: rx(), ty: ry(), phase: rand(0, 6) });
        break;
      case 'leaves':
        this.add({ ambient: a.fx, shape: 'leaf', x: rx(), y: seed ? ry() : r.y - 20, vy: rand(0.03, 0.06), vx: rand(-0.01, 0.02), wobble: rand(0.6, 1.2),
          max: rand(9000, 14000), size: rand(12, 18), rot: rand(0, 6), vr: rand(-0.002, 0.002), color: pickc(LEAF), fadeIn: 600 });
        break;
      case 'bubbles':
        this.add({ ambient: a.fx, shape: 'bubble', x: rx(), y: seed ? ry() : r.y + r.h, vy: rand(-0.025, -0.06), wobble: rand(0.3, 0.8),
          max: rand(4000, 8000), size: rand(3, 8), color: '#E6F6FF', fadeIn: 400 });
        break;
    }
  }

  private step(dt: number) {
    // Duy trì mật độ hạt nền.
    for (const a of this.ambient) {
      const rate = { pollen: 380, fireflies: 650, butterflies: 0, motes: 420, leaves: 2600, bubbles: 700 }[a.fx];
      if (!rate) continue;
      a.acc += dt * (a.density ?? 1);
      while (a.acc > rate) {
        a.acc -= rate;
        this.spawnAmbient(a);
      }
    }
    const t = ticker.time;
    for (const p of this.ps) {
      p.life += dt;
      p.vx += p.ax * dt;
      p.vy += p.ay * dt;
      if (p.drag) {
        const d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d;
        p.vy *= d;
      }
      if (p.tx !== undefined && p.ty !== undefined) {
        // Lang thang mượt về điểm đích, tới nơi thì chọn điểm mới.
        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        const dist = Math.hypot(dx, dy);
        const speed = p.shape === 'butterfly' ? 0.09 : 0.025;
        if (dist < 20) {
          const r = this.area({ fx: p.ambient ?? 'pollen', area: this.ambient.find((a) => a.fx === p.ambient)?.area });
          p.tx = rand(r.x, r.x + r.w);
          p.ty = rand(r.y, r.y + r.h);
        } else {
          p.vx += ((dx / dist) * speed - p.vx) * 0.02;
          p.vy += ((dy / dist) * speed - p.vy) * 0.02;
        }
      }
      p.x += p.vx * dt + (p.wobble ? Math.sin(t * 0.002 + p.phase) * p.wobble * dt * 0.03 : 0);
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.size += p.grow * dt;
    }
    this.ps = this.ps.filter((p) => p.life < p.max && p.size > 0 && p.y < STAGE_H + 80 && p.x > -120 && p.x < STAGE_W + 120);
    this.draw(t);
  }

  private glow(color: string): HTMLCanvasElement {
    let c = this.glowCache.get(color);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, color);
    grad.addColorStop(0.35, color + 'AA');
    grad.addColorStop(1, color + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    this.glowCache.set(color, c);
    return c;
  }

  private draw(t: number) {
    const g = this.ctx;
    g.setTransform(this.res, 0, 0, this.res, 0, 0);
    g.clearRect(0, 0, STAGE_W, STAGE_H);
    for (const p of this.ps) {
      const k = p.life / p.max;
      let a = p.alpha * (k > 0.7 ? (1 - k) / 0.3 : 1);
      if (p.fadeIn) a *= Math.min(1, p.life / p.fadeIn);
      if (p.twinkle) a *= 0.6 + 0.4 * Math.sin(t * 0.008 + p.phase * 3);
      if (a <= 0.01) continue;
      g.globalAlpha = Math.min(1, a);
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      const s = p.size;
      switch (p.shape) {
        case 'circle':
          g.fillStyle = p.color;
          if (p.flutter) g.scale(Math.cos(t * 0.01 + p.phase), 1);
          g.beginPath(); g.arc(0, 0, s / 2, 0, Math.PI * 2); g.fill();
          break;
        case 'rect':
          g.fillStyle = p.color;
          if (p.flutter) g.scale(Math.cos(t * 0.012 + p.phase), 1);
          g.fillRect(-s / 2, -s / 3.2, s, s / 1.6);
          break;
        case 'star':
          g.fillStyle = p.color;
          starPath(g, s);
          g.fill();
          break;
        case 'glow':
          g.globalCompositeOperation = 'lighter';
          g.drawImage(this.glow(p.color), -s, -s, s * 2, s * 2);
          break;
        case 'ring':
          g.scale(1, p.squash);
          g.strokeStyle = p.color;
          g.lineWidth = Math.max(1.5, 6 * (1 - k));
          g.beginPath(); g.arc(0, 0, s, 0, Math.PI * 2); g.stroke();
          break;
        case 'drop': {
          const ang = Math.atan2(p.vy, p.vx) + Math.PI / 2;
          g.rotate(ang - p.rot);
          g.fillStyle = p.color;
          g.beginPath();
          g.moveTo(0, -s * 1.2);
          g.quadraticCurveTo(s, 0, 0, s);
          g.quadraticCurveTo(-s, 0, 0, -s * 1.2);
          g.fill();
          g.fillStyle = 'rgba(255,255,255,.8)';
          g.beginPath(); g.arc(-s * 0.25, -s * 0.1, s * 0.25, 0, Math.PI * 2); g.fill();
          break;
        }
        case 'bubble':
          g.strokeStyle = 'rgba(255,255,255,.9)';
          g.fillStyle = 'rgba(200,236,255,.25)';
          g.lineWidth = 2;
          g.beginPath(); g.arc(0, 0, s, 0, Math.PI * 2); g.fill(); g.stroke();
          g.fillStyle = 'rgba(255,255,255,.9)';
          g.beginPath(); g.arc(-s * 0.35, -s * 0.35, s * 0.28, 0, Math.PI * 2); g.fill();
          break;
        case 'leaf':
          g.rotate(Math.sin(t * 0.003 + p.phase) * 0.6);
          g.fillStyle = p.color;
          g.beginPath();
          g.moveTo(0, -s);
          g.quadraticCurveTo(s * 0.7, 0, 0, s);
          g.quadraticCurveTo(-s * 0.7, 0, 0, -s);
          g.fill();
          g.strokeStyle = 'rgba(80,60,30,.35)';
          g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(0, -s * 0.8); g.lineTo(0, s * 0.8); g.stroke();
          break;
        case 'heart':
          g.fillStyle = p.color;
          g.scale(s / 20, s / 20);
          g.beginPath();
          g.moveTo(0, 6);
          g.bezierCurveTo(-12, -2, -8, -14, 0, -7);
          g.bezierCurveTo(8, -14, 12, -2, 0, 6);
          g.fill();
          break;
        case 'puff':
          g.fillStyle = p.color;
          g.beginPath(); g.arc(0, 0, s / 2, 0, Math.PI * 2); g.fill();
          break;
        case 'butterfly': {
          const flap = Math.abs(Math.sin(t * 0.018 + p.phase));
          g.rotate(Math.atan2(p.vy, p.vx) * 0.3);
          g.fillStyle = p.color;
          for (const side of [-1, 1]) {
            g.save();
            g.scale(side * (0.25 + flap * 0.75), 1);
            g.beginPath(); g.ellipse(s * 0.45, -s * 0.25, s * 0.5, s * 0.4, 0.4, 0, Math.PI * 2); g.fill();
            g.beginPath(); g.ellipse(s * 0.35, s * 0.3, s * 0.32, s * 0.26, -0.4, 0, Math.PI * 2); g.fill();
            g.restore();
          }
          g.fillStyle = '#5A3B2E';
          g.beginPath(); g.ellipse(0, 0, s * 0.09, s * 0.42, 0, 0, Math.PI * 2); g.fill();
          break;
        }
      }
      g.restore();
      g.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = 1;
  }
}

function starPath(g: CanvasRenderingContext2D, s: number) {
  const r1 = s / 2;
  const r2 = s / 5;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
}
