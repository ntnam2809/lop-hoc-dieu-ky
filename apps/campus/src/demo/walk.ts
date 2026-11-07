// Luật đi lại của bản chơi thử offline: thuần, tất định, không phụ thuộc Phaser (có test).
// Nhân vật là một điểm ở chân, bán kính `r`; vật cản là hình chữ nhật trục thẳng.

export interface Vec { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface Bounds { w: number; h: number }

/** Điểm `p` (đã tính bán kính r) có chạm vật cản hoặc ra ngoài biên không. */
export function blocked(p: Vec, obstacles: readonly Rect[], r: number, b: Bounds): boolean {
  if (p.x < r || p.y < r || p.x > b.w - r || p.y > b.h - r) return true;
  for (const o of obstacles) {
    if (p.x > o.x - r && p.x < o.x + o.w + r && p.y > o.y - r && p.y < o.y + o.h + r) return true;
  }
  return false;
}

/**
 * Đi một đoạn (dx, dy). Chạm vật cản thì trượt theo trục còn đi được, kẹt cả hai trục thì đứng yên.
 * Đoạn dài được chia nhỏ để không xuyên qua vật mỏng.
 */
export function moveWithCollision(from: Vec, dx: number, dy: number, obstacles: readonly Rect[], r: number, b: Bounds): Vec {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (r / 2)));
  const sx = dx / steps;
  const sy = dy / steps;
  let p = from;
  for (let i = 0; i < steps; i++) {
    const both = { x: p.x + sx, y: p.y + sy };
    if (!blocked(both, obstacles, r, b)) { p = both; continue; }
    const onlyX = { x: p.x + sx, y: p.y };
    if (sx !== 0 && !blocked(onlyX, obstacles, r, b)) { p = onlyX; continue; }
    const onlyY = { x: p.x, y: p.y + sy };
    if (sy !== 0 && !blocked(onlyY, obstacles, r, b)) { p = onlyY; continue; }
    break;
  }
  return p;
}

/** Hướng phím (dx, dy ∈ {-1,0,1}) → một bước, đi chéo không nhanh hơn đi thẳng. */
export function stepDirection(from: Vec, dx: number, dy: number, speed: number, dt: number, obstacles: readonly Rect[], r: number, b: Bounds): Vec {
  const len = Math.hypot(dx, dy);
  if (len === 0) return from;
  const d = speed * dt;
  return moveWithCollision(from, (dx / len) * d, (dy / len) * d, obstacles, r, b);
}

/**
 * Đi về phía `target`. Tới nơi (≤ 2 px) hoặc bị kẹt (không nhích được) thì `done`.
 */
export function stepTarget(from: Vec, target: Vec, speed: number, dt: number, obstacles: readonly Rect[], r: number, b: Bounds): { pos: Vec; done: boolean } {
  const vx = target.x - from.x;
  const vy = target.y - from.y;
  const dist = Math.hypot(vx, vy);
  if (dist <= 2) return { pos: from, done: true };
  const d = Math.min(dist, speed * dt);
  const pos = moveWithCollision(from, (vx / dist) * d, (vy / dist) * d, obstacles, r, b);
  const moved = Math.hypot(pos.x - from.x, pos.y - from.y);
  return { pos, done: moved < 0.01 || Math.hypot(target.x - pos.x, target.y - pos.y) <= 2 };
}

/** Hướng mặt nhân vật theo chuyển động (để vẽ). */
export function facing(dx: number, dy: number, prev: 'left' | 'right'): 'left' | 'right' {
  if (dx < -0.01) return 'left';
  if (dx > 0.01) return 'right';
  void dy;
  return prev;
}

/** Bộ sinh số giả ngẫu nhiên có hạt giống (mulberry32) — NPC đi dạo tất định khi test. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Chọn một điểm trống ngẫu nhiên trong vùng `area` (thử tối đa 40 lần). */
export function randomFreePoint(rand: () => number, area: Rect, obstacles: readonly Rect[], r: number, b: Bounds): Vec | null {
  for (let i = 0; i < 40; i++) {
    const p = { x: area.x + rand() * area.w, y: area.y + rand() * area.h };
    if (!blocked(p, obstacles, r, b)) return p;
  }
  return null;
}
