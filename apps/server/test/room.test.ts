import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, type Room } from '@colyseus/sdk';
import type { AddressInfo } from 'node:net';
import { startServer } from '../src/index.js';
import { ROOM } from '../src/sim/constants.js';

let url = '';
let httpUrl = '';
let stop: () => Promise<void>;
const open: Room[] = [];

const wait = async (cond: () => boolean, ms = 3000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('hết giờ chờ');
    await new Promise((r) => setTimeout(r, 10));
  }
};
const join = async (name: string) => {
  const r = await new Client(url).joinOrCreate(ROOM, { name });
  open.push(r);
  return r;
};
const players = (r: Room) => (r.state as any)?.players;

beforeAll(async () => {
  const { server, http } = await startServer(0);
  const port = (http.address() as AddressInfo).port;
  url = `ws://localhost:${port}`;
  httpUrl = `http://localhost:${port}`;
  stop = async () => {
    await server.gracefullyShutdown(false);
  };
});
afterAll(async () => {
  await Promise.race([
    Promise.allSettled(open.map((r) => r.leave())),
    new Promise((r) => setTimeout(r, 2000)),
  ]);
  await stop();
});

describe('campus room', () => {
  it('GET /health → 200 ok, route khác 404', async () => {
    const res = await fetch(`${httpUrl}/health`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
    expect((await fetch(`${httpUrl}/x`)).status).toBe(404);
  });

  it('A đi hợp lệ thì B thấy; A teleport thì nhận correct; reconnect giữ vị trí; client thứ 21 bị từ chối', async () => {
    const a = await join('Alice');
    const b = await join('  ');
    await wait(() => players(b)?.size === 2 && players(a)?.get(a.sessionId));
    expect(players(b).get(b.sessionId).displayName).toMatch(/^Khách-/);

    // hợp lệ
    const me = players(a).get(a.sessionId);
    const nx = me.x + 2;
    a.send('move', { x: nx, y: me.y, seq: 1 });
    await wait(() => Math.abs(players(b).get(a.sessionId).x - nx) < 0.01);
    expect(players(b).get(a.sessionId).lastSeq).toBe(1);

    // teleport
    const corrections: any[] = [];
    a.onMessage('correct', (m) => corrections.push(m));
    a.send('move', { x: 5, y: 5, seq: 2 });
    await wait(() => corrections.length === 1);
    expect(corrections[0].seq).toBe(2);
    expect(Math.abs(corrections[0].x - nx)).toBeLessThan(0.01);
    expect(Math.abs(players(b).get(a.sessionId).x - nx)).toBeLessThan(0.01);

    // reconnect sau mất kết nối bất thường
    const before = { x: players(b).get(a.sessionId).x, y: players(b).get(a.sessionId).y };
    const token = a.reconnectionToken;
    const sid = a.sessionId;
    a.reconnection.maxRetries = 0; // tắt tự nối lại của SDK để test nối bằng token
    (a as any).connection.transport.ws.close(4010); // mã không phải CONSENTED = mất kết nối bất thường
    await new Promise((r) => setTimeout(r, 300));
    expect(players(b).get(sid)).toBeDefined(); // vẫn giữ chỗ
    const a2 = await new Client(url).reconnect(token);
    open.push(a2);
    expect(a2.sessionId).toBe(sid);
    await wait(() => !!players(a2)?.get(sid));
    expect(Math.abs(players(a2).get(sid).x - before.x)).toBeLessThan(0.01);
    expect(Math.abs(players(a2).get(sid).y - before.y)).toBeLessThan(0.01);

    // đầy phòng: đã có 2, thêm 18 → 20, người thứ 21 bị từ chối
    for (let i = 0; i < 18; i++) await join(`P${i}`);
    // joinOrCreate sẽ mở campus thứ hai khi đầy; joinById vào đúng phòng thì bị từ chối.
    await expect(new Client(url).joinById(a.roomId, { name: 'Over' })).rejects.toBeTruthy();
  }, 30_000);
});
