// Lịch retry thuần (không timer, không đồng hồ). Chỉ còn cold start; reconnect do SDK lo.
export type RetryKind = 'waking';

export const RETRY: Record<RetryKind, { intervalMs: number; capMs: number }> = {
  waking: { intervalMs: 2000, capMs: 90_000 },
};

/** Chờ bao lâu rồi thử tiếp; null = hết trần, dừng. elapsedMs tính từ lúc bắt đầu luồng. */
export function retryDelay(kind: RetryKind, elapsedMs: number): number | null {
  const { intervalMs, capMs } = RETRY[kind];
  return elapsedMs >= capMs ? null : intervalMs;
}

/** Thời điểm (ms từ lúc bắt đầu) của mọi lần thử nếu mỗi lần thất bại tức thì. */
export function attemptTimes(kind: RetryKind): number[] {
  const out: number[] = [];
  let t = 0;
  for (;;) {
    const d = retryDelay(kind, t);
    if (d === null) return out;
    t += d;
    out.push(t);
  }
}
