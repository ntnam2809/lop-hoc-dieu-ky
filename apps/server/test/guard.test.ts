import { describe, expect, it, vi } from 'vitest';
import { MessageGuard, guarded } from '../src/net/guard.js';
import { LIMITS } from '../src/net/limits.js';

const setup = () => {
  let t = 0;
  const guard = new MessageGuard(LIMITS, () => t);
  return { guard, advance: (ms: number) => (t += ms) };
};

describe('MessageGuard', () => {
  it('20 tin liên tiếp ok, tin 21 bị drop', () => {
    const { guard } = setup();
    for (let i = 0; i < 20; i++) expect(guard.check('a')).toBe('ok');
    expect(guard.check('a')).toBe('drop');
  });

  it('mỗi client có bucket riêng', () => {
    const { guard } = setup();
    for (let i = 0; i < 21; i++) guard.check('a');
    expect(guard.check('b')).toBe('ok');
  });

  it('sau 1000 ms hồi khoảng 15 tin', () => {
    const { guard, advance } = setup();
    for (let i = 0; i < 21; i++) guard.check('a');
    advance(1000);
    let ok = 0;
    for (let i = 0; i < 30; i++) if (guard.check('a') === 'ok') ok++;
    expect(ok).toBeGreaterThanOrEqual(14);
    expect(ok).toBeLessThanOrEqual(16);
  });

  it('60 drop trong 10 s → kick (tin thứ 60 bị drop)', () => {
    const { guard } = setup();
    for (let i = 0; i < 20; i++) guard.check('a');
    for (let i = 0; i < 59; i++) expect(guard.check('a')).toBe('drop');
    expect(guard.check('a')).toBe('kick');
  });

  it('60 drop rải quá 10 s → không kick', () => {
    const { guard, advance } = setup();
    for (let i = 0; i < 20; i++) guard.check('a');
    for (let i = 0; i < 59; i++) expect(guard.check('a')).toBe('drop');
    advance(10_001); // 59 drop cũ rơi khỏi cửa sổ; bucket đầy lại
    for (let i = 0; i < 20; i++) expect(guard.check('a')).toBe('ok');
    for (let i = 0; i < 59; i++) expect(guard.check('a')).toBe('drop');
  });

  it('forget xoá state: bucket đầy lại', () => {
    const { guard } = setup();
    for (let i = 0; i < 20; i++) guard.check('a');
    expect(guard.check('a')).toBe('drop');
    guard.forget('a');
    for (let i = 0; i < 20; i++) expect(guard.check('a')).toBe('ok');
  });

  it('forget xoá cả mốc drop: không kick dồn từ lần trước', () => {
    const { guard } = setup();
    for (let i = 0; i < 20; i++) guard.check('a');
    for (let i = 0; i < 40; i++) guard.check('a');
    guard.forget('a');
    for (let i = 0; i < 20; i++) guard.check('a');
    for (let i = 0; i < 40; i++) expect(guard.check('a')).toBe('drop');
  });
});

describe('guarded', () => {
  const fakeClient = () => ({ sessionId: 's1', leave: vi.fn() });

  it('ok gọi handler, drop bỏ, kick gọi leave(4029) đúng một lần', () => {
    const { guard } = setup();
    const handler = vi.fn();
    const client = fakeClient();
    const h = guarded(guard, handler);
    for (let i = 0; i < 200; i++) h(client, i);
    expect(handler).toHaveBeenCalledTimes(20);
    expect(client.leave).toHaveBeenCalledTimes(1);
    expect(client.leave).toHaveBeenCalledWith(4029);
  });

  it('kick không gọi handler', () => {
    const handler = vi.fn();
    const client = fakeClient();
    const h = guarded({ check: () => 'kick', forget: () => {} }, handler, 4100);
    h(client, 'x');
    h(client, 'y');
    expect(handler).not.toHaveBeenCalled();
    expect(client.leave).toHaveBeenCalledTimes(1);
    expect(client.leave).toHaveBeenCalledWith(4100);
  });

  it('drop không gọi handler và không leave', () => {
    const handler = vi.fn();
    const client = fakeClient();
    guarded({ check: () => 'drop', forget: () => {} }, handler)(client, 'x');
    expect(handler).not.toHaveBeenCalled();
    expect(client.leave).not.toHaveBeenCalled();
  });
});
