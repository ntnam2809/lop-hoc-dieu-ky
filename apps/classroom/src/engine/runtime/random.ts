/**
 * Ngẫu nhiên tất định: cùng một hoạt động luôn xáo thẻ giống nhau, giúp giáo
 * viên chuẩn bị trước và QA tái lập được lỗi.
 */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seeded(seed: number | string): () => number {
  let a = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Xáo trộn tất định; với ≥ 2 phần tử, không bao giờ trả về đúng thứ tự gốc (tránh bài "đã giải sẵn"). */
export function shuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  if (out.length < 2) return out;
  const rnd = seeded(seed);
  for (let attempt = 0; attempt < 8; attempt++) {
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (out.some((v, i) => v !== items[i])) return out;
  }
  out.push(out.shift()!);
  return out;
}

/** Chọn phần tử theo chỉ số ổn định. */
export function pick<T>(items: readonly T[], key: string): T {
  return items[hashString(key) % items.length];
}
