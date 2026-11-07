import { describe, expect, it } from 'vitest';
import { createMemoryStore, type SchoolClass } from '@lhdk/domain';
import { createIds } from '../src/ids.js';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** rand tất định: lặp một dãy byte. */
const cycle = (seq: number[]) => {
  let i = 0;
  return (n: number) => Uint8Array.from({ length: n }, () => seq[i++ % seq.length]!);
};

const klass = (joinCode: string): SchoolClass => ({
  id: 'c1',
  schoolId: 's1',
  name: 'Lớp',
  teacherId: 'u1',
  capacity: 5,
  joinCode,
  createdAt: 0,
});

describe('createIds', () => {
  it('id thường: kind_ + 16 ký tự base32 thường từ 10 byte', () => {
    const ids = createIds(createMemoryStore(), cycle([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    expect(ids('user')).toBe('user_aaaaaaaaaaaaaaaa');
    const all255 = createIds(createMemoryStore(), cycle([255]));
    expect(all255('school')).toBe('school_7777777777777777');
    expect(createIds(createMemoryStore())('class')).toMatch(/^class_[a-z2-7]{16}$/);
  });

  it('mã vào lớp: 8 ký tự chỉ trong bảng', () => {
    const ids = createIds(createMemoryStore());
    for (let i = 0; i < 200; i++) {
      const code = ids('code');
      expect(code).toHaveLength(8);
      for (const ch of code) expect(ALPHABET).toContain(ch);
    }
  });

  it('lấy mẫu loại bỏ: byte >= 248 bị bỏ, không lệch modulo', () => {
    // 255 và 248 bị bỏ; 0..7 → ABCDEFGH
    const ids = createIds(createMemoryStore(), cycle([255, 248, 0, 1, 2, 3, 4, 5, 6, 7]));
    expect(ids('code')).toBe('ABCDEFGH');
  });

  it('trùng mã của lớp có sẵn → sinh lại', () => {
    const store = createMemoryStore();
    store.classes.set('c1', klass('AAAAAAAA'));
    // lô 16 byte đầu → AAAAAAAA (trùng), lô sau → BBBBBBBB
    const batches = [new Array(16).fill(0), new Array(16).fill(1)];
    let call = 0;
    const ids = createIds(store, (n) => Uint8Array.from(batches[Math.min(call++, 1)]!.slice(0, n)));
    expect(ids('code')).toBe('BBBBBBBB');
  });

  it('10 lần trùng liên tiếp → throw', () => {
    const store = createMemoryStore();
    store.classes.set('c1', klass('AAAAAAAA'));
    const ids = createIds(store, (n) => new Uint8Array(n));
    expect(() => ids('code')).toThrow();
  });
});
