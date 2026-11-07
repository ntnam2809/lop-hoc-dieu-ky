import { randomBytes } from 'node:crypto';
import type { ServiceDeps, Store } from '@lhdk/domain';

type IdKind = Parameters<NonNullable<ServiceDeps['ids']>>[0];

const B32 = 'abcdefghijklmnopqrstuvwxyz234567';
/** Bỏ 0/O/1/I/L cho dễ đọc khi giáo viên đọc mã cho lớp. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const CODE_MAX_TRIES = 10;
/** Ngưỡng loại bỏ: bội lớn nhất của |bảng| trong 256, để không lệch modulo. */
const CODE_LIMIT = Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length;

function base32(bytes: Uint8Array): string {
  let out = '';
  let acc = 0;
  let bits = 0;
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(acc >>> (bits - 5)) & 31];
      bits -= 5;
    }
    acc &= (1 << bits) - 1;
  }
  if (bits > 0) out += B32[(acc << (5 - bits)) & 31];
  return out;
}

function randomCode(rand: (n: number) => Uint8Array): string {
  let out = '';
  while (out.length < CODE_LENGTH) {
    const buf = rand(16);
    if (buf.length === 0) throw new Error('rand trả về rỗng');
    for (const b of buf) {
      if (b >= CODE_LIMIT) continue;
      out += CODE_ALPHABET[b % CODE_ALPHABET.length];
      if (out.length === CODE_LENGTH) break;
    }
  }
  return out;
}

/** Sinh id không đoán được (10 byte ngẫu nhiên) và mã vào lớp 8 ký tự không trùng mã đang có. */
export function createIds(store: Store, rand: (n: number) => Uint8Array = randomBytes): NonNullable<ServiceDeps['ids']> {
  return (kind: IdKind) => {
    if (kind !== 'code') return `${kind}_${base32(rand(10))}`;
    const taken = new Set<string>();
    for (const c of store.classes.values()) taken.add(c.joinCode);
    for (let i = 0; i < CODE_MAX_TRIES; i++) {
      const code = randomCode(rand);
      if (!taken.has(code)) return code;
    }
    throw new Error('Không sinh được mã vào lớp không trùng');
  };
}
