/**
 * Đồng hồ trung tâm của engine. Mọi chuyển động, hạt hiệu ứng và lệnh chờ
 * trong timeline đều chạy theo đồng hồ này, nên "Tạm dừng" của giáo viên
 * dừng được toàn bộ sân khấu một cách nhất quán.
 */
export type TickFn = (dt: number, time: number) => void;

class Ticker {
  time = 0;
  paused = false;
  /** Hệ số tốc độ (QA tự động có thể tăng tốc qua ?speed=N). */
  timeScale = 1;
  private fns = new Set<TickFn>();
  private raf = 0;
  private last = 0;

  constructor() {
    const s = Number(new URLSearchParams(globalThis.location?.search ?? '').get('speed'));
    if (s > 0) this.timeScale = Math.min(s, 20);
  }

  add(fn: TickFn): () => void {
    this.fns.add(fn);
    this.ensure();
    return () => this.fns.delete(fn);
  }

  private ensure() {
    if (this.raf || typeof requestAnimationFrame === 'undefined') return;
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(now - this.last, 64) * this.timeScale;
      this.last = now;
      if (!this.paused) {
        this.time += dt;
        for (const fn of [...this.fns]) fn(dt, this.time);
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  setPaused(p: boolean) {
    this.paused = p;
    document.documentElement.classList.toggle('is-paused', p);
  }
}

export const ticker = new Ticker();

/** Chờ theo đồng hồ engine (tôn trọng tạm dừng). Huỷ được bằng AbortSignal. */
export function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    let t = 0;
    const off = ticker.add((dt) => {
      t += dt;
      if (t >= ms) {
        off();
        resolve();
      }
    });
    signal?.addEventListener('abort', () => {
      off();
      resolve();
    }, { once: true });
  });
}
