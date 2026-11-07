import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { Client, type Room } from '@colyseus/sdk';
import { quota } from '@lhdk/domain';
import { createApp, type AppContext } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { startServer } from '../src/index.js';
import { createMemoryDocDb } from '../src/persist/memory-docdb.js';
import type { Logger } from '../src/ports.js';
import { players, wait } from './helpers/campus-server.js';

process.setMaxListeners(100);

const hook = vi.hoisted(() => ({ full: false }));
// Trần số instance chưa được nối ở server, nên QUOTA thật không xảy ra được: giả lập ở ranh giới reserveCampusSeat.
vi.mock('../src/rooms/campus-seat.js', async (orig) => {
  const m = await orig<typeof import('../src/rooms/campus-seat.js')>();
  return {
    ...m,
    reserveCampusSeat: (d: Parameters<typeof m.reserveCampusSeat>[0], r: Parameters<typeof m.reserveCampusSeat>[1]) => {
      if (hook.full) throw quota('Campus đang đầy');
      return m.reserveCampusSeat(d, r);
    },
  };
});

let logs: string[];
let started: Awaited<ReturnType<typeof startServer>>;
let app: AppContext;
let url: string;
let wsUrl: string;
const open: Room[] = [];

beforeEach(async () => {
  hook.full = false;
  logs = [];
  const log: Logger = {
    info: (e, f) => void logs.push(JSON.stringify({ e, f })),
    error: (e, f) => void logs.push(JSON.stringify({ e, f })),
  };
  const config = loadConfig({ NODE_ENV: 'test', PORT: '0' });
  app = await createApp(config, { docDb: createMemoryDocDb(), log });
  started = await startServer(0, { config, app });
  const port = (started.http.address() as AddressInfo).port;
  url = `http://localhost:${port}`;
  wsUrl = `ws://localhost:${port}`;
});
afterEach(async () => {
  await Promise.race([Promise.allSettled(open.splice(0).map((r) => r.leave())), new Promise((r) => setTimeout(r, 2000))]);
  await started.server.gracefullyShutdown(false);
});

const seat = (label: string | null, body?: unknown, raw?: string) =>
  fetch(`${url}/campus/seat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(label ? { authorization: `Bearer dev:${label}` } : {}) },
    body: raw ?? JSON.stringify(body ?? {}),
  });
const errCode = async (r: Response) => ((await r.json()) as any).error.code as string;

async function join(label: string): Promise<Room> {
  const res = await seat(label);
  expect(res.status).toBe(200);
  const { roomId, ticket } = (await res.json()) as any;
  const room = await new Client(wsUrl).joinById(roomId, { ticket });
  open.push(room);
  return room;
}

describe('POST /campus/seat', () => {
  it('không token → 401; method khác → 404', async () => {
    const r = await seat(null);
    expect(r.status).toBe(401);
    expect(await errCode(r)).toBe('UNAUTHENTICATED');
    expect((await fetch(`${url}/campus/seat`, { method: 'GET' })).status).toBe(404);
  });

  it('dev:u01 không gửi schoolId → 200 {roomId, ticket, instanceId} rồi vào được room', async () => {
    const res = await seat('u01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Object.keys(body).sort()).toEqual(['instanceId', 'roomId', 'ticket']);
    const room = await new Client(wsUrl).joinById(body.roomId, { ticket: body.ticket });
    open.push(room);
    await wait(() => players(room)?.get(room.sessionId));
    expect(players(room).get(room.sessionId).displayName).toBe('Dev u01');
    // ticket và token không lọt vào log
    expect(logs.join('\n')).not.toContain(body.ticket);
    expect(logs.join('\n')).not.toContain('dev:u01');
  });

  it('user chưa thuộc trường nào, không gửi schoolId → 403', async () => {
    expect((await seat('nobody')).status).toBe(403);
  });

  it('user thuộc ≥ 2 trường, không gửi schoolId → 400', async () => {
    // 'dan' (gói pilot) tự lập một trường và còn là giáo viên của Trường Dev → thuộc 2 trường.
    const { userId } = await app.authenticate('dev:dan');
    app.store.users.get(userId)!.planId = 'pilot';
    app.service.createSchool(userId, { name: 'Trường Hai', level: 'primary', kind: 'play' });
    const dev = [...app.store.schools.values()].find((s) => s.name === 'Trường Dev')!;
    app.service.grantTeacher(app.devUserId('u01')!, dev.id, userId);
    const r = await seat('dan');
    expect(r.status).toBe(400);
    expect(await errCode(r)).toBe('INVALID');
  });

  it('schoolId của trường không phải thành viên → 403', async () => {
    const schoolId = [...app.store.schools.values()].find((s) => s.name === 'Trường Dev')!.id;
    expect((await seat('nobody', { schoolId })).status).toBe(403);
    expect((await seat('nobody', { schoolId: 'khong-co' })).status).toBe(403);
  });

  it('key lạ trong body → 400; JSON hỏng → 400', async () => {
    expect((await seat('u01', { schoolId: 'x', extra: 1 })).status).toBe(400);
    expect((await seat('u01', { streaming: 'yes' })).status).toBe(400);
    expect((await seat('u01', undefined, '{oops')).status).toBe(400);
  });

  it('11 lần gọi dồn → lần thứ 11 là 429 RATE_LIMITED', async () => {
    const codes: number[] = [];
    let last: Response | undefined;
    for (let i = 0; i < 11; i++) {
      last = await seat('nobody');
      codes.push(last.status);
    }
    expect(codes.slice(0, 10).every((c) => c === 403)).toBe(true);
    expect(codes[10]).toBe(429);
    expect(await errCode(last!)).toBe('RATE_LIMITED');
  });

  it('campus đầy (QUOTA) → 429 code QUOTA', async () => {
    hook.full = true;
    const r = await seat('u01');
    expect(r.status).toBe(429);
    expect(await errCode(r)).toBe('QUOTA');
  });

  it('flood 200 move → bị đóng mã 4029, client khác không ảnh hưởng', async () => {
    const a = await join('u01');
    const b = await join('u02');
    await wait(() => players(b)?.size === 2);
    let closeA: number | undefined;
    let closeB: number | undefined;
    a.onLeave((c) => (closeA = c));
    b.onLeave((c) => (closeB = c));
    const me = players(a).get(a.sessionId);
    for (let i = 1; i <= 200; i++) a.send('move', { x: me.x, y: me.y, seq: i });
    await wait(() => closeA !== undefined, 5000);
    expect(closeA).toBe(4029);
    await wait(() => players(b)?.size === 1);
    expect(closeB).toBeUndefined();
  });
});
