import { describe, expect, it } from 'vitest';
import { createLogger } from '../src/log.js';

const setup = () => {
  const lines: string[] = [];
  const log = createLogger((l) => lines.push(l), () => 1234);
  return { lines, log, last: () => JSON.parse(lines[lines.length - 1]!) as Record<string, unknown> };
};

describe('createLogger', () => {
  it('mỗi dòng là JSON hợp lệ với ts/level/event', () => {
    const { log, last, lines } = setup();
    log.info('http.request', { method: 'GET', route: '/v1/me', status: 200, ms: 3, userId: 'user_abc' });
    expect(lines).toHaveLength(1);
    expect(last()).toEqual({ ts: 1234, level: 'info', event: 'http.request', method: 'GET', route: '/v1/me', status: 200, ms: 3, userId: 'user_abc' });
    log.error('persist.fail', { written: 0 });
    expect(last()).toMatchObject({ level: 'error', event: 'persist.fail', written: 0 });
  });

  it('bỏ displayName/text/token/email và đếm dropped', () => {
    const { log, last } = setup();
    log.info('x.y', { userId: 'u1', displayName: 'Cô Lan', text: 'xin chào', token: 'abc', email: 'a@b.c' } as never);
    const out = last();
    expect(out).toEqual({ ts: 1234, level: 'info', event: 'x.y', userId: 'u1', dropped: 4 });
    expect(JSON.stringify(out)).not.toMatch(/Lan|chào|abc|@/);
  });

  it('bỏ giá trị có dấu cách, tiếng Việt, quá dài, hoặc kiểu lạ', () => {
    const { log, last } = setup();
    log.info('a', { userId: 'Cô Lan', roomId: 'a b', classId: 'x'.repeat(65), sessionId: '', code: 'ok_1', n: NaN } as never);
    expect(last()).toEqual({ ts: 1234, level: 'info', event: 'a', code: 'ok_1', dropped: 5 });
    log.info('a', { userId: { x: 1 } } as never);
    expect(last().dropped).toBe(1);
  });

  it('event sai định dạng → log.invalid', () => {
    const { log, last } = setup();
    log.info('Bad Event!');
    expect(last().event).toBe('log.invalid');
    log.info('');
    expect(last().event).toBe('log.invalid');
  });

  it('key ngoài danh sách (kể cả ts/level/event) không ghi đè', () => {
    const { log, last } = setup();
    log.info('a', { ts: 1, level: 'x', event: 'y' } as never);
    expect(last()).toEqual({ ts: 1234, level: 'info', event: 'a', dropped: 3 });
  });
});
