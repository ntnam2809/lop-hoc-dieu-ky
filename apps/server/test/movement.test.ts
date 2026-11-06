import { describe, expect, it } from 'vitest';
import { validateMove, sanitizeName } from '../src/sim/movement.js';

const prev = { x: 600, y: 300, t: 1000, lastSeq: 5 };

describe('validateMove', () => {
  it('chấp nhận bước hợp lệ', () => {
    expect(validateMove(prev, { x: 610, y: 300, seq: 6 }, 1100)).toEqual({ ok: true, x: 610, y: 300 });
  });
  it('từ chối ngoài biên', () => {
    expect(validateMove({ ...prev, x: 0 }, { x: -1, y: 300, seq: 6 }, 1100)).toMatchObject({ ok: false, reason: 'bounds' });
    expect(validateMove({ ...prev, x: 1280 }, { x: 1281, y: 300, seq: 6 }, 1100)).toMatchObject({ ok: false, reason: 'bounds' });
    expect(validateMove({ ...prev, x: 1280 }, { x: 1280, y: 300, seq: 6 }, 1100).ok).toBe(true);
  });
  it('từ chối quá tốc độ', () => {
    expect(validateMove(prev, { x: 1100, y: 300, seq: 6 }, 1100)).toMatchObject({ ok: false, reason: 'speed' });
  });
  it('từ chối seq lùi hoặc bằng', () => {
    expect(validateMove(prev, { x: 601, y: 300, seq: 5 }, 1100)).toMatchObject({ ok: false, reason: 'stale-seq' });
    expect(validateMove(prev, { x: 601, y: 300, seq: 2 }, 1100)).toMatchObject({ ok: false, reason: 'stale-seq' });
  });
  it('từ chối NaN / Infinity', () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(validateMove(prev, { x: bad, y: 300, seq: 6 }, 1100)).toMatchObject({ ok: false, reason: 'invalid' });
      expect(validateMove(prev, { x: 600, y: bad, seq: 6 }, 1100)).toMatchObject({ ok: false, reason: 'invalid' });
      expect(validateMove(prev, { x: 600, y: 300, seq: bad }, 1100)).toMatchObject({ ok: false, reason: 'invalid' });
    }
  });
  it('dt có trần 500 ms: nằm im 10 s rồi nhảy 300 px vẫn bị từ chối', () => {
    expect(validateMove(prev, { x: 900, y: 300, seq: 6 }, 11_000)).toMatchObject({ ok: false, reason: 'speed' });
    // 500 ms cho tối đa 114 px
    expect(validateMove(prev, { x: 710, y: 300, seq: 6 }, 11_000).ok).toBe(true);
  });
});

describe('sanitizeName', () => {
  it('cắt khoảng trắng', () => expect(sanitizeName('  Nam  ', 'abcd1234')).toBe('Nam'));
  it('rỗng, quá dài, không phải chuỗi → Khách-<4 ký tự>', () => {
    expect(sanitizeName('   ', 'abcd1234')).toBe('Khách-abcd');
    expect(sanitizeName('x'.repeat(21), 'abcd1234')).toBe('Khách-abcd');
    expect(sanitizeName(42, 'abcd1234')).toBe('Khách-abcd');
    expect(sanitizeName(undefined, 'abcd1234')).toBe('Khách-abcd');
  });
  it('20 ký tự vẫn hợp lệ', () => expect(sanitizeName('x'.repeat(20), 'abcd')).toBe('x'.repeat(20)));
});
