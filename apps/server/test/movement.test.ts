import { describe, expect, it } from 'vitest';
import { validateMove, sanitizeName, type PrevState } from '../src/sim/movement.js';
import { BUDGET_CAP, MAX_SPEED, SLACK_PX } from '../src/sim/constants.js';

const prev: PrevState = { x: 600, y: 300, t: 1000, lastSeq: 5, budget: BUDGET_CAP };

/** Mô phỏng một client gửi chuỗi move tới "server" (validateMove), giữ trạng thái như campus-room. */
function sim(start: { x: number; y: number }) {
  let st: PrevState = { x: start.x, y: start.y, t: 0, lastSeq: 0, budget: BUDGET_CAP };
  let seq = 0;
  let rejected = 0;
  let accepted = 0;
  return {
    send(x: number, y: number, now: number) {
      const r = validateMove(st, { x, y, seq: ++seq }, now);
      if (r.ok) { accepted++; st = { ...st, x, y, t: r.t, budget: r.budget, lastSeq: seq }; }
      else { rejected++; st = { ...st, t: r.t, budget: r.budget }; }
      return r;
    },
    get pos() { return { x: st.x, y: st.y }; },
    get rejected() { return rejected; },
    get accepted() { return accepted; },
  };
}
// PRNG tất định cho jitter.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

describe('validateMove', () => {
  it('chấp nhận bước hợp lệ', () => {
    expect(validateMove(prev, { x: 610, y: 300, seq: 6 }, 1100)).toMatchObject({ ok: true, x: 610, y: 300 });
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
  it('nằm im 10 s: ngân sách chỉ đầy tới trần, nhảy 300 px vẫn bị từ chối', () => {
    expect(validateMove(prev, { x: 900, y: 300, seq: 6 }, 11_000)).toMatchObject({ ok: false, reason: 'speed' });
    // trần = BUDGET_CAP + SLACK_PX = 59 px
    expect(validateMove(prev, { x: 659, y: 300, seq: 6 }, 11_000).ok).toBe(true);
    expect(validateMove(prev, { x: 660, y: 300, seq: 6 }, 11_000).ok).toBe(false);
  });
  it('từ chối vẫn dời mốc tích luỹ và không trừ ngân sách', () => {
    const r = validateMove({ ...prev, budget: 10 }, { x: 900, y: 300, seq: 6 }, 1100);
    expect(r).toMatchObject({ ok: false, reason: 'speed', t: 1100 });
    expect(r.budget).toBeCloseTo(10 + 22);
  });
});

describe('xô ngân sách', () => {
  it('(a) message dồn: 2 bước 22 px cách 10 ms rồi im 90 ms được chấp nhận', () => {
    const s = sim({ x: 600, y: 300 });
    expect(s.send(622, 300, 10).ok).toBe(true);
    expect(s.send(644, 300, 20).ok).toBe(true);
    expect(s.send(644, 300, 110).ok).toBe(true);
    expect(s.pos.x).toBe(644);
  });
  it('(b) teleport 600 px → speed', () => {
    const s = sim({ x: 300, y: 300 });
    expect(s.send(900, 300, 50)).toMatchObject({ ok: false, reason: 'speed' });
  });
  it('(c) 10 bước 40 px trong 100 ms: tổng chấp nhận ≤ 55 + 22 + 4*10', () => {
    const s = sim({ x: 100, y: 300 });
    for (let i = 1; i <= 10; i++) s.send(100 + 40 * i, 300, i * 10);
    expect(s.pos.x - 100).toBeLessThanOrEqual(BUDGET_CAP + 22 + SLACK_PX * 10);
  });
  it('(d) 220 px/s liên tục 10 s, 10 Hz, jitter ±50 ms: không bị từ chối', () => {
    const rnd = rng(7);
    const s = sim({ x: 20, y: 100 });
    // vị trí theo thời điểm gửi (nominal), thời điểm tới server lệch ±50 ms
    for (let k = 1; k <= 100; k++) {
      const sentAt = k * 100;
      const arrive = sentAt + (rnd() * 100 - 50);
      // đi 22 px mỗi bước, quay đầu theo chiều x để nằm trong biên
      const dist = 22 * k;
      const lap = Math.floor(dist / 1200);
      const off = dist % 1200;
      const x = 20 + (lap % 2 === 0 ? off : 1200 - off);
      s.send(x, 100, Math.max(arrive, 0));
    }
    expect(s.rejected).toBe(0);
  });
  it('(e) 300 px/s kéo dài 5 s bị chặn', () => {
    const s = sim({ x: 40, y: 100 });
    for (let k = 1; k <= 50; k++) {
      const d = 30 * k; // quãng đường dọc đường đi: sang phải 1200 rồi xuống
      const x = 40 + Math.min(d, 1200);
      const y = 100 + Math.max(0, d - 1200);
      s.send(x, y, k * 100);
    }
    expect(s.rejected).toBeGreaterThan(30);
    const progressed = Math.hypot(s.pos.x - 40, s.pos.y - 100);
    expect(progressed).toBeLessThanOrEqual(BUDGET_CAP + MAX_SPEED * 5 + SLACK_PX * 50);
    expect(progressed).toBeLessThan(1500 * 0.5);
  });
  it('(f) idle 10 s rồi nhảy 300 px vẫn bị từ chối', () => {
    const s = sim({ x: 100, y: 300 });
    expect(s.send(400, 300, 10_000)).toMatchObject({ ok: false, reason: 'speed' });
  });
});

describe('sanitizeName', () => {
  it('cắt khoảng trắng', () => expect(sanitizeName('  Nam  ', 'abcd1234')).toBe('Nam'));
  it('rỗng, quá dài, không phải chuỗi → Khách-<4 ký tự>', () => {
    expect(sanitizeName('   ', 'abcd1234')).toBe('Khách-abcd');
    expect(sanitizeName('x'.repeat(21), 'abcd1234')).toBe('x'.repeat(20));
    expect(sanitizeName(42, 'abcd1234')).toBe('Khách-abcd');
    expect(sanitizeName(undefined, 'abcd1234')).toBe('Khách-abcd');
  });
  it('20 ký tự vẫn hợp lệ', () => expect(sanitizeName('x'.repeat(20), 'abcd')).toBe('x'.repeat(20)));
});
