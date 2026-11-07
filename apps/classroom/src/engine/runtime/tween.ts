import type { Ease } from '../types';
import { ticker } from './ticker';

const c1 = 1.70158;
const c3 = c1 + 1;

function bounceOut(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

export const easings: Record<Ease, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t * t,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  backOut: (t) => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2),
  backIn: (t) => c3 * t * t * t - c1 * t * t,
  bounceOut,
  elasticOut: (t) =>
    t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  // Chìm trong nước: lao nhanh rồi chậm dần như bị nước cản.
  sink: (t) => 1 - Math.pow(1 - t, 2.4) + Math.sin(t * Math.PI * 3) * 0.02 * (1 - t),
  // Thả nổi: vượt qua rồi dập dềnh về vị trí.
  float: (t) => 1 - Math.cos(t * Math.PI * 2.5) * Math.exp(-4 * t),
};

export interface TweenOptions {
  duration: number;
  ease?: Ease;
  signal?: AbortSignal;
  onUpdate: (k: number, raw: number) => void;
}

/** Tween theo đồng hồ engine. Bị huỷ thì nhảy tới trạng thái cuối để cảnh luôn nhất quán. */
export function tween({ duration, ease = 'easeInOut', signal, onUpdate }: TweenOptions): Promise<void> {
  return new Promise((resolve) => {
    const fn = easings[ease] ?? easings.easeInOut;
    if (signal?.aborted || duration <= 0) {
      onUpdate(fn(1), 1);
      return resolve();
    }
    let t = 0;
    const off = ticker.add((dt) => {
      t += dt;
      const raw = Math.min(1, t / duration);
      onUpdate(fn(raw), raw);
      if (raw >= 1) {
        off();
        resolve();
      }
    });
    signal?.addEventListener('abort', () => {
      off();
      onUpdate(fn(1), 1);
      resolve();
    }, { once: true });
  });
}

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
