import { describe, expect, it } from 'vitest';
import { SchoolService } from '@lhdk/domain';

describe('workspace link @lhdk/domain', () => {
  it('registerUser chạy được', () => {
    const svc = new SchoolService({ clock: () => 1000 });
    const u = svc.registerUser({ displayName: 'Cô Lan' });
    expect(u.ageBand).toBe('adult');
    expect(u.displayName).toBe('Cô Lan');
  });
});
