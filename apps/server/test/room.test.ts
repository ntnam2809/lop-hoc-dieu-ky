import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@colyseus/sdk';
import type { AddressInfo } from 'node:net';
import { matchMaker } from '@colyseus/core';
import { startServer } from '../src/index.js';
import { players, startCampusServer, wait, type CampusTestServer } from './helpers/campus-server.js';

// /health vẫn do startServer phục vụ. Trong spike này startServer còn define CampusRoom trần
// (platform-06 sẽ nối defineCampus + HTTP API và phủ lại ca này).
describe('http', () => {
  it('GET /health → 200 ok, route khác 404', async () => {
    const { server, http } = await startServer(0);
    try {
      const httpUrl = `http://localhost:${(http.address() as AddressInfo).port}`;
      const res = await fetch(`${httpUrl}/health`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('ok');
      expect((await fetch(`${httpUrl}/x`)).status).toBe(404);
    } finally {
      await server.gracefullyShutdown(false);
    }
  });
});

describe('campus room', () => {
  let t: CampusTestServer;
  beforeAll(async () => {
    t = await startCampusServer();
  });
  afterAll(async () => {
    await t.stop();
  });

  it('A đi hợp lệ thì B thấy; A teleport thì nhận correct; reconnect giữ vị trí; người thứ 21 sang instance 2', async () => {
    const a = (await t.join('u01')).room;
    const b = (await t.join('u02')).room;
    await wait(() => players(b)?.size === 2 && players(a)?.get(a.sessionId));
    expect(players(b).get(b.sessionId).displayName).toBe('Dev u02');

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
    const a2 = t.track(await new Client(t.url).reconnect(token));
    expect(a2.sessionId).toBe(sid);
    await wait(() => !!players(a2)?.get(sid));
    expect(Math.abs(players(a2).get(sid).x - before.x)).toBeLessThan(0.01);
    expect(Math.abs(players(a2).get(sid).y - before.y)).toBeLessThan(0.01);

    // đầy phòng: đã có 2, thêm 18 → 20 cùng room; người thứ 21 sang instance 2.
    for (let i = 3; i <= 20; i++) await t.join(`u${String(i).padStart(2, '0')}`);
    const over = await t.join('u21');
    expect(over.roomId).not.toBe(a.roomId);
    expect(over.roomId).not.toBe('');
    // Ghế của người thứ 21 vẫn ở instance 2 dù room 1 còn người nhưng đã đầy.
    const seat = await t.seat('u22');
    expect(seat.instanceId.endsWith(':2')).toBe(true);
  }, 30_000);
});

describe('campus room private', () => {
  let t: CampusTestServer;
  beforeAll(async () => {
    t = await startCampusServer();
  });
  afterAll(async () => {
    await t.stop();
  });

  it('room private: join()/joinOrCreate() bằng vé hợp lệ của trường khác bị từ chối, room A không tăng; joinById vẫn vào', async () => {
    const a = await t.join('u03');
    const listingA = await matchMaker.getRoomById(a.roomId);
    expect(listingA.private).toBe(true);
    await wait(() => players(a.room)?.size === 1);

    // Trường B: người lớn khác lập trường mới và có vé hợp lệ (room B do server tạo).
    const p2 = t.service.registerUser({ displayName: 'Hiệu trưởng B', planId: 'pilot' });
    const sB = t.service.createSchool(p2.id, { name: 'Trường B', level: 'primary', kind: 'play' });
    t.service.grantTeacher(p2.id, sB.id, p2.id);

    const before = { clients: listingA.clients, size: players(a.room).size };
    for (const via of ['join', 'joinOrCreate'] as const) {
      const seat = await t.seatFor(p2.id, { schoolId: sB.id });
      expect(seat.roomId).not.toBe(a.roomId);
      await expect(new Client(t.url)[via]('campus', { ticket: seat.ticket }), via).rejects.toBeTruthy();
    }

    const after = await matchMaker.getRoomById(a.roomId);
    expect(after.clients).toBe(before.clients);
    expect(players(a.room).size).toBe(before.size);
    const reserved = (matchMaker.getLocalRoomById(a.roomId) as any)._reservedSeats as Record<string, unknown>;
    expect(Object.keys(reserved)).toHaveLength(0);

    // luồng joinById của helper vẫn xanh (đã dùng ở a); thêm một người nữa.
    const b = await t.join('u04');
    expect(b.roomId).toBe(a.roomId);
    await wait(() => players(a.room)?.size === 2);
  });
});
