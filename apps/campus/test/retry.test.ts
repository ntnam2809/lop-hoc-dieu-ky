import { describe, expect, it } from 'vitest';
import { attemptTimes, retryDelay } from '../src/net/retry';

describe('retry', () => {
  it('waking: mỗi 2 s, trần 90 s', () => {
    expect(retryDelay('waking', 0)).toBe(2000);
    expect(retryDelay('waking', 88_000)).toBe(2000);
    expect(retryDelay('waking', 90_000)).toBeNull();
    const t = attemptTimes('waking');
    expect(t[0]).toBe(2000);
    expect(t.at(-1)).toBe(90_000);
    expect(t).toHaveLength(45);
  });
});
