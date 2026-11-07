/**
 * E2E campus: hai (hoặc một) trình duyệt thật nối server Colyseus thật (AUTH_MODE=dev, đã seed u01..u30).
 * Mỗi ca dùng context riêng; hai tab trong một ca là hai người dùng khác nhau (?as=u01 / ?as=u02).
 * Tên hiển thị do server lấy từ domain ("Dev u01"), client không tự đặt được.
 */
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

interface P { id: string; displayName: string; x: number; y: number }
interface S { status: string; connected: boolean; self: { id: string; x: number; y: number } | null; players: P[]; fps: number; rtt: number | null }

const TOKEN_KEY = 'lhdk.campus.reconnectionToken';

/** name = displayName server gán cho nhãn dev (Dev u01...), dùng để lọc người chơi. */
interface Client { ctx: BrowserContext; page: Page; name: string; label: string; errors: string[]; consoleErrors: string[] }

async function open(browser: Browser, label: string, query = ''): Promise<Client> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const consoleErrors: string[] = [];
  // Dòng "Failed to load resource" là log mạng tự động của Chromium cho mọi HTTP 4xx, không phải lỗi code.
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) consoleErrors.push(m.text()); });
  await page.goto(`/?as=${encodeURIComponent(label)}&server=ws://localhost:2567&harness=1${query}`);
  await page.waitForFunction(() => !!(window as any).__campus);
  await page.evaluate(() => (window as any).__campus.mount());
  return { ctx, page, name: `Dev ${label}`, label, errors, consoleErrors };
}

const st = (c: Client): Promise<S> => c.page.evaluate(() => (window as any).__campus.state());

async function ready(c: Client) {
  await expect.poll(async () => (await st(c)).status, { timeout: 15_000 }).toBe('connected');
  await expect.poll(async () => (await st(c)).self?.id ?? null, { timeout: 10_000 }).not.toBeNull();
}

/** Mở A và B, chờ cả hai thấy nhau. */
async function pair(browser: Browser) {
  const a = await open(browser, 'u01');
  const b = await open(browser, 'u02');
  await ready(a);
  await ready(b);
  for (const [x, y] of [[a, b], [b, a]] as const) {
    await expect.poll(async () => (await st(x)).players.some((p) => p.displayName === y.name), { timeout: 10_000 }).toBe(true);
  }
  const aid = (await st(a)).self!.id;
  return { a, b, aid };
}

/** Vị trí của người có id trong state của client c. */
async function seen(c: Client, id: string): Promise<{ x: number; y: number } | null> {
  const p = (await st(c)).players.find((q) => q.id === id);
  return p ? { x: p.x, y: p.y } : null;
}

const send = (c: Client, type: string, payload: unknown) =>
  c.page.evaluate(([t, p]) => (window as any).__campus.sendRaw(t as string, p), [type, payload] as const);

/** Chờ vị trí A (nhìn từ B) ổn định, trả về vị trí đó. */
async function settled(b: Client, id: string) {
  let last = await seen(b, id);
  for (let i = 0; i < 30; i++) {
    await b.page.waitForTimeout(150);
    const cur = await seen(b, id);
    if (cur && last && Math.hypot(cur.x - last.x, cur.y - last.y) < 0.5) return cur;
    last = cur;
  }
  return last!;
}


/**
 * Đi tới (x,y). Nếu một `correct` lẻ của server huỷ đích thì gọi lại moveTo, tối đa 3 lần
 * rồi fail rõ ràng (thay vì chờ tới hết timeout).
 */
async function goTo(c: Client, x: number, y: number) {
  const move = () => c.page.evaluate(([px, py]) => (window as any).__campus.moveTo(px, py), [x, y]);
  const dist = async () => { const s = (await st(c)).self!; return Math.hypot(s.x - x, s.y - y); };
  await move();
  let retries = 0;
  let idleSince = 0;
  let prev = await dist();
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    await c.page.waitForTimeout(200);
    const d = await dist();
    if (d <= 12) return;
    if (d < prev - 0.5) { idleSince = 0; } // vẫn đang tiến lại gần
    else if (!idleSince) idleSince = Date.now();
    else if (Date.now() - idleSince > 600) { // đứng yên mà chưa tới: đích bị huỷ
      if (++retries > 3) throw new Error(`goTo(${x},${y}) bị huỷ đích quá 3 lần, còn cách ${d.toFixed(1)} px`);
      await move();
      idleSince = 0;
    }
    prev = d;
  }
  throw new Error(`goTo(${x},${y}) quá 15 s, còn cách ${(await dist()).toFixed(1)} px`);
}

/** Chờ A đứng yên hẳn (self không đổi 600 ms) và B thấy trùng; trả vị trí đó. */
async function still(a: Client, b: Client, id: string) {
  let last = (await st(a)).self!;
  let since = Date.now();
  await expect
    .poll(async () => {
      const s = (await st(a)).self!;
      if (Math.hypot(s.x - last.x, s.y - last.y) > 0.01) { last = s; since = Date.now(); return false; }
      const p = await seen(b, id);
      return Date.now() - since > 600 && !!p && Math.hypot(p.x - s.x, p.y - s.y) <= 1;
    }, { timeout: 15_000, intervals: [100] })
    .toBe(true);
  return (await seen(b, id))!;
}

test('1. hai client thấy nhau và đích moveTo được đồng bộ', async ({ browser }) => {
  const { a, b, aid } = await pair(browser);
  for (const [c, other] of [[a, b], [b, a]] as const) {
    const names = (await st(c)).players.map((p) => p.displayName);
    expect(names).toContain(a.name);
    expect(names).toContain(b.name);
    void other;
  }
  // Khởi động: vài giây đầu khung hình rất chậm (render phần mềm), nên đi một đoạn làm nóng trước.
  await goTo(a, 640, 360);
  await settled(b, aid);
  const s = (await st(a)).self!;
  const tx = Math.min(1200, s.x + 150), ty = Math.min(700, s.y + 80);
  // A tự tới đích (có thử lại, vì khung hình chậm khi máy tải); cửa sổ 5 s tính từ lúc A tới nơi.
  await goTo(a, tx, ty);
  await expect
    .poll(async () => { const p = await seen(b, aid); return p ? Math.hypot(p.x - tx, p.y - ty) : 9999; }, { timeout: 5_000 })
    .toBeLessThanOrEqual(12);
  expect(a.errors).toEqual([]);
  await a.ctx.close(); await b.ctx.close();
});

test('2. giữ phím phải thì x tăng và B thấy', async ({ browser }) => {
  const { a, b, aid } = await pair(browser);
  // đưa A vào giữa để còn chỗ đi sang phải
  await goTo(a, 400, 360);
  const before = await settled(b, aid);
  await a.page.bringToFront();
  await expect
    .poll(async () => {
      if (((await seen(b, aid))?.x ?? 0) > before.x + 10) return true;
      await a.page.keyboard.down('ArrowRight');
      await a.page.waitForTimeout(500);
      await a.page.keyboard.up('ArrowRight');
      await b.page.waitForTimeout(300);
      return ((await seen(b, aid))?.x ?? 0) > before.x + 10;
    }, { timeout: 15_000, intervals: [100] })
    .toBe(true);
  expect((await st(a)).self!.x).toBeGreaterThan(before.x + 10);
  await a.ctx.close(); await b.ctx.close();
});

async function expectRejected(a: Client, b: Client, aid: string, pos: { x: number; y: number }) {
  // (a) server không đổi vị trí của A
  await a.page.waitForTimeout(400);
  await expect.poll(async () => { const p = await seen(b, aid); return p ? Math.hypot(p.x - pos.x, p.y - pos.y) : 9999; }, { timeout: 3_000 }).toBeLessThanOrEqual(1);
  // (b) A nhận correct và snap về đúng vị trí B thấy
  await expect
    .poll(async () => {
      const s = (await st(a)).self!; const p = await seen(b, aid);
      return p ? Math.hypot(s.x - p.x, s.y - p.y) : 9999;
    }, { timeout: 3_000 })
    .toBeLessThanOrEqual(2);
}

test('3. từ chối đích ngoài biên', async ({ browser }) => {
  const { a, b, aid } = await pair(browser);
  const pos = await settled(b, aid);
  await send(a, 'move', { x: -50, y: 100, seq: 1_000_000 });
  await expectRejected(a, b, aid, pos);
  expect(a.errors).toEqual([]);
  await a.ctx.close(); await b.ctx.close();
});

test('4. từ chối teleport / quá tốc độ, rồi vẫn đi hợp lệ được', async ({ browser }) => {
  const { a, b, aid } = await pair(browser);
  // đưa A về giữa sân để mọi bước đều nằm trong biên
  await goTo(a, 400, 360);
  let pos = await still(a, b, aid);

  // teleport 600 px trong một message (còn trong biên 1280x720)
  await send(a, 'move', { x: pos.x + 600, y: pos.y, seq: 2_000_000 });
  await expectRejected(a, b, aid, pos);

  // 10 message mỗi bước 40 px trong ~100 ms (seq tăng dần, đều lớn hơn mọi seq của client)
  pos = await still(a, b, aid);
  const t0 = Date.now();
  await a.page.evaluate(([x0, y0]) => {
    const w = window as any;
    for (let i = 1; i <= 10; i++) w.__campus.sendRaw('move', { x: x0 + 40 * i, y: y0, seq: 3_000_000 + i });
  }, [pos.x, pos.y]);
  const sentMs = Date.now() - t0;
  void sentMs;
  const end = await settled(b, aid);
  const dist = Math.hypot(end.x - pos.x, end.y - pos.y);
  // Xô ngân sách server: trần 55 px (0.25 s * 220) + 22 px tích luỹ trong ~100 ms + 4 px * 10
  // message, cộng 22 px dung sai (độ trễ lô message / đồng hồ server giữa message đầu và cuối).
  const budget = 55 + 22 + 4 * 10 + 22;
  expect(dist).toBeLessThanOrEqual(budget);

  // sau đó A đi hợp lệ vẫn được chấp nhận
  await expect.poll(async () => { const s = (await st(a)).self!; const p = await seen(b, aid); return p ? Math.hypot(s.x - p.x, s.y - p.y) : 9999; }, { timeout: 3_000 }).toBeLessThanOrEqual(2);
  // Burst đã được chấp nhận vài bước nên lastSeq server rất lớn: client thật sẽ bị 'stale-seq'.
  // Bước hợp lệ gửi thô với seq cao hơn, sau khi chờ đủ thời gian để ngân sách tốc độ đủ.
  const cur = (await st(a)).self!;
  const tx = cur.x < 640 ? cur.x + 15 : cur.x - 15;
  await a.page.waitForTimeout(300);
  await send(a, 'move', { x: tx, y: cur.y, seq: 4_000_000 });
  await expect.poll(async () => { const p = await seen(b, aid); return p ? Math.hypot(p.x - tx, p.y - cur.y) : 9999; }, { timeout: 5_000 }).toBeLessThanOrEqual(12);
  await a.ctx.close(); await b.ctx.close();
});

test('5. tên hiển thị do server cấp, ?name= của client bị bỏ qua', async ({ browser }) => {
  const long = ('N' + Date.now().toString(36)).padEnd(30, 'x');
  const a = await open(browser, 'u01', `&name=${encodeURIComponent(long)}`);
  const b = await open(browser, 'u02');
  await ready(a); await ready(b);
  const aid = (await st(a)).self!.id;
  await expect.poll(async () => (await st(b)).players.find((p) => p.id === aid)?.displayName ?? '', { timeout: 10_000 }).toBe('Dev u01');
  expect((await st(a)).players.some((p) => p.displayName.includes(long.slice(0, 5)))).toBe(false);
  await a.ctx.close(); await b.ctx.close();
});

test('6. reconnect sau disconnectHard giữ id và vị trí, B không mất A', async ({ browser }) => {
  const { a, b, aid } = await pair(browser);
  await goTo(a, 500, 300);
  await settled(b, aid);
  await a.page.waitForTimeout(300);
  const before = (await st(a)).self!;
  const seenStatuses = new Set<string>();
  let bMissing = 0;
  await a.page.evaluate(() => (window as any).__campus.disconnectHard());
  const deadline = Date.now() + 10_000;
  let ok = false;
  while (Date.now() < deadline) {
    const sa = await st(a);
    seenStatuses.add(sa.status);
    const sb = await st(b);
    if (sb.players.filter((p) => p.id === aid || p.displayName === b.name).length < 2) bMissing++;
    if (sa.status === 'connected' && sa.connected && sa.self && seenStatuses.size >= 1 && (seenStatuses.has('reconnecting') || Date.now() - (deadline - 10_000) > 1500)) { ok = true; break; }
    await a.page.waitForTimeout(100);
  }
  expect(ok).toBe(true);
  const after = await st(a);
  expect(after.status).toBe('connected');
  expect(after.connected).toBe(true);
  expect(after.self!.id).toBe(aid);
  expect(Math.hypot(after.self!.x - before.x, after.self!.y - before.y)).toBeLessThanOrEqual(5);
  expect(bMissing).toBe(0);
  expect((await st(b)).players.some((p) => p.id === aid)).toBe(true);
  expect(a.errors).toEqual([]);
  await a.ctx.close(); await b.ctx.close();
});

test('7. token bị từ chối: vào phiên mới, không lỗi', async ({ browser }) => {
  // Lệch spec: token trong sessionStorage chỉ được đọc khi (tải lại) trang; disconnectHard dùng
  // token nội bộ của SDK nên ghi đè storage không ảnh hưởng. Do đó ghi đè rồi tải lại trang.
  const a = await open(browser, 'u01');
  await ready(a);
  const oldId = (await st(a)).self!.id;
  await a.page.evaluate(([k]) => sessionStorage.setItem(k, 'rac-khong-hop-le'), [TOKEN_KEY]);
  await a.page.reload();
  await a.page.waitForFunction(() => !!(window as any).__campus);
  await a.page.evaluate(() => (window as any).__campus.mount());
  await expect.poll(async () => (await st(a)).status, { timeout: 10_000 }).toBe('connected');
  await expect.poll(async () => (await st(a)).self?.id ?? oldId, { timeout: 10_000 }).not.toBe(oldId);
  expect(a.errors).toEqual([]);
  await a.ctx.close();
});

test('8. cold start: không server thì waking, không lỗi', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?as=u01&server=ws://localhost:2999&harness=1');
  await page.waitForFunction(() => !!(window as any).__campus);
  await page.evaluate(() => (window as any).__campus.mount());
  await expect.poll(async () => (await page.evaluate(() => (window as any).__campus.state())).status, { timeout: 5_000 }).toBe('waking');
  const s = await page.evaluate(() => (window as any).__campus.state());
  expect(s.connected).toBe(false);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('9. presence chỉ lộ các khoá cho phép', async ({ browser }) => {
  const { a, b } = await pair(browser);
  const s = await st(a);
  expect(Object.keys(s).sort()).toEqual(['connected', 'fps', 'players', 'rtt', 'self', 'status']);
  expect(s.players.length).toBeGreaterThanOrEqual(2);
  for (const p of s.players) expect(Object.keys(p).sort()).toEqual(['displayName', 'id', 'x', 'y']);
  await a.ctx.close(); await b.ctx.close();
});

test('10. người ngoài trường (?as=outsider) bị từ chối, không lỗi console', async ({ browser }) => {
  const a = await open(browser, 'outsider');
  await expect.poll(async () => (await st(a)).status, { timeout: 15_000 }).toBe('denied');
  const s = await st(a);
  expect(s.connected).toBe(false);
  expect(s.self).toBeNull();
  expect(a.errors).toEqual([]);
  expect(a.consoleErrors).toEqual([]);
  await a.ctx.close();
});

test('11. u30 (chỉ hiệu trưởng tổ chức, không ở trường chơi) bị từ chối', async ({ browser }) => {
  const a = await open(browser, 'u30');
  await expect.poll(async () => (await st(a)).status, { timeout: 15_000 }).toBe('denied');
  expect((await st(a)).self).toBeNull();
  expect(a.errors).toEqual([]);
  await a.ctx.close();
});

test('12. cùng nhãn mở tab thứ hai: tab cũ thành replaced, tab mới thấy mình', async ({ browser }) => {
  const first = await open(browser, 'u01');
  await ready(first);
  const second = await open(browser, 'u01');
  await expect.poll(async () => (await st(first)).status, { timeout: 15_000 }).toBe('replaced');
  await ready(second);
  const s = await st(second);
  expect(s.players.some((p) => p.id === s.self!.id && p.displayName === 'Dev u01')).toBe(true);
  // tab cũ không tự giành lại chỗ
  await first.page.waitForTimeout(1500);
  expect((await st(first)).status).toBe('replaced');
  expect(first.errors).toEqual([]);
  await first.ctx.close(); await second.ctx.close();
});
