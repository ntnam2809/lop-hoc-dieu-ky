import type { LogFields, Logger } from './ports.js';

/** Allowlist trường log (ADR-0013): không tên hiển thị, nội dung chat, token, email. */
const ALLOWED_KEYS = new Set([
  'userId',
  'schoolId',
  'classId',
  'sessionId',
  'roomId',
  'route',
  'method',
  'status',
  'code',
  'ms',
  'n',
  'written',
  'verdict',
]);
const EVENT_RE = /^[a-z0-9.]+$/;
const SAFE_STRING_RE = /^[A-Za-z0-9_:\-./]{1,64}$/;

export function createLogger(
  sink: (line: string) => void = (l) => process.stdout.write(l + '\n'),
  clock: () => number = Date.now,
): Logger {
  const emit = (level: 'info' | 'error', event: string, fields?: LogFields) => {
    const kept: Record<string, string | number | boolean> = {};
    let dropped = 0;
    for (const [k, v] of Object.entries(fields ?? {})) {
      const ok =
        ALLOWED_KEYS.has(k) &&
        ((typeof v === 'string' && SAFE_STRING_RE.test(v)) ||
          (typeof v === 'number' && Number.isFinite(v)) ||
          typeof v === 'boolean');
      if (ok) kept[k] = v;
      else dropped++;
    }
    const ev = typeof event === 'string' && EVENT_RE.test(event) ? event : 'log.invalid';
    const line = JSON.stringify({ ts: clock(), level, event: ev, ...kept, ...(dropped > 0 ? { dropped } : {}) });
    sink(line);
  };
  return {
    info: (event, fields) => emit('info', event, fields),
    error: (event, fields) => emit('error', event, fields),
  };
}
