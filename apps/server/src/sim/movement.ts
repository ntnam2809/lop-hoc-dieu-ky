import { MAX_DT_MS, MAX_SPEED, SLACK_PX, WORLD } from './constants.js';

export interface PrevState {
  x: number;
  y: number;
  /** Thời điểm (ms) của lần move hợp lệ gần nhất, hoặc lúc vào phòng. */
  t: number;
  lastSeq: number;
}
export interface MoveRequest {
  x: number;
  y: number;
  seq: number;
}
export type MoveResult =
  | { ok: true; x: number; y: number }
  | { ok: false; reason: 'bounds' | 'speed' | 'invalid' | 'stale-seq' };

export function validateMove(prev: PrevState, req: MoveRequest, nowMs: number): MoveResult {
  if (!Number.isFinite(req.x) || !Number.isFinite(req.y) || !Number.isFinite(req.seq)) {
    return { ok: false, reason: 'invalid' };
  }
  if (req.seq <= prev.lastSeq) return { ok: false, reason: 'stale-seq' };
  if (req.x < 0 || req.x > WORLD.w || req.y < 0 || req.y > WORLD.h) {
    return { ok: false, reason: 'bounds' };
  }
  const dt = Math.max(0, Math.min(nowMs - prev.t, MAX_DT_MS));
  const allowed = (MAX_SPEED * dt) / 1000 + SLACK_PX;
  if (Math.hypot(req.x - prev.x, req.y - prev.y) > allowed) {
    return { ok: false, reason: 'speed' };
  }
  return { ok: true, x: req.x, y: req.y };
}

export function sanitizeName(raw: unknown, idFallback: string): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  // Tên dài hơn 20 ký tự (tính theo code point) bị cắt bớt, không thay bằng tên mặc định.
  const cut = [...s].slice(0, 20).join('').trim();
  return cut.length >= 1 ? cut : `Khách-${idFallback.slice(0, 4)}`;
}
