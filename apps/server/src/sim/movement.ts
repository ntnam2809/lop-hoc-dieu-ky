import { BUDGET_CAP, MAX_DT_MS, MAX_SPEED, SLACK_PX, WORLD } from './constants.js';

export interface PrevState {
  x: number;
  y: number;
  /** Mốc (ms) lần tích luỹ ngân sách gần nhất (cập nhật mỗi message), hoặc lúc vào phòng. */
  t: number;
  lastSeq: number;
  /** Ngân sách quãng đường còn lại (px); khởi tạo BUDGET_CAP lúc vào. */
  budget: number;
}
export interface MoveRequest {
  x: number;
  y: number;
  seq: number;
}
/** `budget`/`t` là trạng thái ngân sách mới để caller lưu lại (cả khi bị từ chối). */
export type MoveResult =
  | { ok: true; x: number; y: number; budget: number; t: number }
  | { ok: false; reason: 'bounds' | 'speed' | 'invalid' | 'stale-seq'; budget: number; t: number };

/**
 * Xô ngân sách: mỗi message cộng MAX_SPEED * min(dt, MAX_DT_MS) vào budget (trần BUDGET_CAP),
 * hợp lệ khi dist <= budget + SLACK_PX; chấp nhận thì trừ dist, từ chối thì không trừ.
 * Mốc tích luỹ `t` luôn dời tới nowMs ở mọi message hữu hạn (kể cả bị từ chối), vì ngân sách
 * của khoảng thời gian đó đã được cộng rồi; nếu không dời sẽ cộng trùng. Message `invalid`
 * (NaN/Infinity) không đụng tới trạng thái.
 */
export function validateMove(prev: PrevState, req: MoveRequest, nowMs: number): MoveResult {
  if (!Number.isFinite(req.x) || !Number.isFinite(req.y) || !Number.isFinite(req.seq)) {
    return { ok: false, reason: 'invalid', budget: prev.budget, t: prev.t };
  }
  const dt = Math.max(0, Math.min(nowMs - prev.t, MAX_DT_MS));
  const budget = Math.min(BUDGET_CAP, prev.budget + (MAX_SPEED * dt) / 1000);
  const t = Math.max(prev.t, nowMs);
  if (req.seq <= prev.lastSeq) return { ok: false, reason: 'stale-seq', budget, t };
  if (req.x < 0 || req.x > WORLD.w || req.y < 0 || req.y > WORLD.h) {
    return { ok: false, reason: 'bounds', budget, t };
  }
  const dist = Math.hypot(req.x - prev.x, req.y - prev.y);
  if (dist > budget + SLACK_PX) return { ok: false, reason: 'speed', budget, t };
  return { ok: true, x: req.x, y: req.y, budget: Math.max(0, budget - dist), t };
}

export function sanitizeName(raw: unknown, idFallback: string): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  // Tên dài hơn 20 ký tự (tính theo code point) bị cắt bớt, không thay bằng tên mặc định.
  const cut = [...s].slice(0, 20).join('').trim();
  return cut.length >= 1 ? cut : `Khách-${idFallback.slice(0, 4)}`;
}
