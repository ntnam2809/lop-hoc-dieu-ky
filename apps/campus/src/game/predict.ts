// Hàm thuần cho dự đoán cục bộ và nội suy; không Phaser, không đồng hồ ngầm.
import { INTERP_DELAY_MS, WORLD_H, WORLD_W } from '../net/protocol';

export interface Vec { x: number; y: number }
export interface Sample { t: number; x: number; y: number }

export const AVATAR_RADIUS = 18;

export function clampToWorld(p: Vec, margin = AVATAR_RADIUS): Vec {
  return {
    x: Math.min(WORLD_W - margin, Math.max(margin, p.x)),
    y: Math.min(WORLD_H - margin, Math.max(margin, p.y)),
  };
}

/** Giới hạn bước đi: từ `from` tới `to`, không quá `maxDist`. */
export function limitStep(from: Vec, to: Vec, maxDist: number): Vec {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d <= maxDist || d === 0) return { x: to.x, y: to.y };
  const k = maxDist / d;
  return { x: from.x + dx * k, y: from.y + dy * k };
}

/** Đi thẳng tới đích với tốc độ speed trong dt giây. */
export function stepToward(from: Vec, target: Vec, speed: number, dt: number): { pos: Vec; arrived: boolean } {
  const pos = limitStep(from, target, Math.max(0, speed * dt));
  return { pos, arrived: pos.x === target.x && pos.y === target.y };
}

/** Trần dt mỗi khung (ms): tab ẩn rồi hiện lại không làm nhân vật dịch chuyển tức thời. */
export const MAX_FRAME_DT_MS = 100;

/** dt thật giữa hai khung (ms) → giây, chặn ở [0, MAX_FRAME_DT_MS]. */
export function frameDtSeconds(rawMs: number): number {
  if (!Number.isFinite(rawMs) || rawMs <= 0) return 0;
  return Math.min(rawMs, MAX_FRAME_DT_MS) / 1000;
}

/** Như stepToward nhưng nhận dt thật bằng ms (đã chặn ≤ MAX_FRAME_DT_MS). */
export function stepTowardMs(from: Vec, target: Vec, speed: number, dtMs: number): { pos: Vec; arrived: boolean } {
  return stepToward(from, target, speed, frameDtSeconds(dtMs));
}

/** Đi theo hướng phím (dx,dy ∈ {-1,0,1}); chéo được chuẩn hoá để không nhanh hơn. */
export function stepByDirection(from: Vec, dx: number, dy: number, speed: number, dt: number): Vec {
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: from.x, y: from.y };
  const k = (speed * dt) / len;
  return { x: from.x + dx * k, y: from.y + dy * k };
}

/** Chọn đích từ điểm chạm (toạ độ thế giới). Điểm ngoài khung bị kẹp vào trong; không hợp lệ → null. */
export function pickTarget(p: Vec): Vec | null {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  return clampToWorld(p);
}

/** Thêm mẫu vào đệm; bỏ mẫu trùng vị trí liên tiếp, giữ tối đa `max` mẫu. */
export function pushSample(buf: Sample[], s: Sample, max = 24): void {
  const last = buf[buf.length - 1];
  if (last && last.x === s.x && last.y === s.y && buf.length > 1) {
    last.t = s.t; // đứng yên: chỉ dời mốc thời gian
    return;
  }
  buf.push(s);
  if (buf.length > max) buf.splice(0, buf.length - max);
}

/** Nội suy tuyến tính tại renderT = now - delay; không ngoại suy ngoài mẫu mới nhất. */
export function interpolate(buf: readonly Sample[], now: number, delayMs = INTERP_DELAY_MS): Vec | null {
  if (buf.length === 0) return null;
  const rt = now - delayMs;
  const first = buf[0]!;
  if (rt <= first.t) return { x: first.x, y: first.y };
  for (let i = 1; i < buf.length; i++) {
    const b = buf[i]!;
    if (rt <= b.t) {
      const a = buf[i - 1]!;
      const span = b.t - a.t;
      const k = span <= 0 ? 1 : (rt - a.t) / span;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
  }
  const last = buf[buf.length - 1]!;
  return { x: last.x, y: last.y };
}

/** Bỏ các mẫu đã quá cũ, luôn giữ ít nhất 1 mẫu ≤ renderT làm mốc. */
export function pruneSamples(buf: Sample[], now: number, delayMs = INTERP_DELAY_MS): void {
  const rt = now - delayMs;
  while (buf.length > 2 && buf[1]!.t <= rt) buf.shift();
}

export function hashHue(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 360;
}
