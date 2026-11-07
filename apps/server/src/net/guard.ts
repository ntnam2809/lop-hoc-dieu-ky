import { RateLimiter } from '@lhdk/domain';
import type { GuardVerdict, MessageGuardPort } from '../ports.js';
import { LIMITS } from './limits.js';

export interface GuardOptions {
  msgBurst: number;
  msgPerSecond: number;
  dropsBeforeKick: number;
  dropWindowMs: number;
}

interface ClientState {
  limiter: RateLimiter;
  drops: number[];
}

/**
 * Rate limit tin nhắn theo từng client của một room. Mỗi client có bucket riêng
 * để `forget` xoá sạch state. Không đọc/log nội dung tin.
 */
export class MessageGuard implements MessageGuardPort {
  private readonly states = new Map<string, ClientState>();

  constructor(
    private readonly opts: GuardOptions = LIMITS,
    private readonly clock: () => number = Date.now,
  ) {}

  check(clientId: string): GuardVerdict {
    const now = this.clock();
    let st = this.states.get(clientId);
    if (!st) {
      st = {
        limiter: new RateLimiter(this.opts.msgBurst, this.opts.msgPerSecond / 1000),
        drops: [],
      };
      this.states.set(clientId, st);
    }
    try {
      st.limiter.take(clientId, now);
      return 'ok';
    } catch (e) {
      if ((e as { code?: unknown }).code !== 'RATE_LIMITED') throw e;
    }
    const since = now - this.opts.dropWindowMs;
    st.drops = st.drops.filter((t) => t > since);
    st.drops.push(now);
    return st.drops.length >= this.opts.dropsBeforeKick ? 'kick' : 'drop';
  }

  forget(clientId: string): void {
    this.states.delete(clientId);
  }
}

/** Client đã bị đá: dùng chung giữa các handler để `leave` chỉ gọi một lần. */
const kicked = new WeakSet<object>();

/** Bọc handler của `onMessage`: 'ok' → gọi handler; 'drop' → bỏ; 'kick' → leave(kickCode) một lần. */
export function guarded<C extends { sessionId: string; leave(code?: number): void }, M>(
  guard: MessageGuardPort,
  handler: (client: C, msg: M) => void,
  kickCode: number = LIMITS.kickCode,
): (client: C, msg: M) => void {
  return (client, msg) => {
    if (kicked.has(client)) return;
    const verdict = guard.check(client.sessionId);
    if (verdict === 'ok') return handler(client, msg);
    if (verdict === 'kick') {
      kicked.add(client);
      client.leave(kickCode);
    }
  };
}
