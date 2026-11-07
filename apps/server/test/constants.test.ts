import { describe, expect, it } from 'vitest';
import { CAMPUS_MAX_OCCUPANCY } from '@lhdk/domain';
import { resolveMaxClients } from '../src/sim/constants';

describe('resolveMaxClients (ADR-0017: trần 20)', () => {
  it('giá trị rác hoặc ngoài 1..100 → trần domain', () => {
    for (const v of ['abc', '-5', '0', '1e9', '', '101', '3.5', ' 30', undefined]) {
      expect(resolveMaxClients({ NODE_ENV: 'development', CAMPUS_MAX_CLIENTS: v }), String(v)).toBe(CAMPUS_MAX_OCCUPANCY);
    }
    expect(CAMPUS_MAX_OCCUPANCY).toBe(20);
  });

  it('ngoài production nhận số nguyên 1..100', () => {
    expect(resolveMaxClients({ NODE_ENV: 'development', CAMPUS_MAX_CLIENTS: '30' })).toBe(30);
    expect(resolveMaxClients({ CAMPUS_MAX_CLIENTS: '100' })).toBe(100);
    expect(resolveMaxClients({ NODE_ENV: 'test', CAMPUS_MAX_CLIENTS: '1' })).toBe(1);
  });

  it('production luôn dùng trần domain, bỏ qua CAMPUS_MAX_CLIENTS', () => {
    expect(resolveMaxClients({ NODE_ENV: 'production', CAMPUS_MAX_CLIENTS: '30' })).toBe(20);
  });
});
