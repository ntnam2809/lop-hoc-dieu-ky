import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { Client, type Room } from '@colyseus/sdk';
import { ROOM } from '../src/sim/constants.js';
import { players, startCampusServer, wait, type CampusTestServer } from './helpers/campus-server.js';

const lbl = (n: number) => `u${String(n).padStart(2, '0')}`;

let t: CampusTestServer;
beforeEach(async () => {
  t = await startCampusServer();
});
afterEach(async () => {
  await t.stop();
});

describe('sức chứa & gán instance', () => {
  it('20 người cùng trường vào cùng roomId và thấy đủ 20; người thứ 21 sang room khác, không thấy 20 người kia', async () => {
    const rooms: Room[] = [];
    for (let i = 1; i <= 20; i++) rooms.push((await t.join(lbl(i))).room);
    expect(new Set(rooms.map((r) => r.roomId)).size).toBe(1);
    await wait(() => rooms.every((r) => players(r)?.size === 20));

    const over = await t.join(lbl(21));
    expect(over.roomId).not.toBe(rooms[0]!.roomId);
    await wait(() => players(over.room)?.get(over.room.sessionId));
    expect(players(over.room).size).toBe(1);
    expect(players(rooms[0]!).size).toBe(20);
  }, 30_000);

  it('một người leave(true) thì người tiếp theo về room 1', async () => {
    const rooms: Room[] = [];
    for (let i = 1; i <= 20; i++) rooms.push((await t.join(lbl(i))).room);
    const first = rooms[0]!.roomId;
    await wait(() => players(rooms[1]!)?.size === 20);

    await rooms[5]!.leave(true);
    await wait(() => players(rooms[1]!)?.size === 19);
    const next = await t.join(lbl(21));
    expect(next.roomId).toBe(first);
    await wait(() => players(rooms[1]!)?.size === 20);
  }, 30_000);
});

describe('rớt kết nối rồi xin ghế lại', () => {
  it('cùng roomId, ghost bị đuổi, số người không đổi', async () => {
    const a = await t.join(lbl(1));
    const b = await t.join(lbl(2));
    await wait(() => players(b.room)?.size === 2);
    const oldSid = a.room.sessionId;

    a.room.reconnection.maxRetries = 0;
    (a.room as any).connection.transport.ws.close(4010); // mất kết nối bất thường → server giữ chỗ
    await new Promise((r) => setTimeout(r, 200));
    expect(players(b.room).get(oldSid)).toBeDefined();

    const a2 = await t.join(lbl(1));
    expect(a2.roomId).toBe(a.roomId);
    await wait(() => players(b.room)?.get(a2.room.sessionId) && !players(b.room).get(oldSid));
    expect(players(b.room).size).toBe(2);
    expect(players(a2.room).size).toBe(2);
  }, 15_000);

  it('người chơi duy nhất rớt rồi xin lại ghế: room không bị huỷ giữa chừng', async () => {
    const a = await t.join(lbl(3));
    a.room.reconnection.maxRetries = 0;
    (a.room as any).connection.transport.ws.close(4010);
    await new Promise((r) => setTimeout(r, 200));
    const a2 = await t.join(lbl(3));
    expect(a2.roomId).toBe(a.roomId);
    await wait(() => players(a2.room)?.size === 1);
  }, 15_000);

  it('kết nối còn sống mà xin ghế lại: kết nối cũ bị đóng 4409, kết nối mới thắng', async () => {
    const a = await t.join(lbl(1));
    const b = await t.join(lbl(2));
    await wait(() => players(b.room)?.size === 2);
    let closed: number | null = null;
    a.room.onLeave((code) => {
      closed = code;
    });
    const a2 = await t.join(lbl(1));
    expect(a2.roomId).toBe(a.roomId);
    await wait(() => closed !== null);
    expect(closed).toBe(4409);
    await wait(() => players(b.room)?.size === 2 && !players(b.room).get(a.room.sessionId));
  }, 15_000);

  it('đầy 20 người, một người xin ghế lại vẫn vào đúng room, vẫn 20', async () => {
    const rooms: Room[] = [];
    for (let i = 1; i <= 20; i++) rooms.push((await t.join(lbl(i))).room);
    await wait(() => players(rooms[0]!)?.size === 20);
    const again = await t.join(lbl(7));
    expect(again.roomId).toBe(rooms[0]!.roomId);
    await wait(() => players(rooms[0]!)?.size === 20 && !players(rooms[0]!).get(rooms[6]!.sessionId));
  }, 30_000);
});

describe('ticket & cổng vào', () => {
  it('joinOrCreate("campus") không ticket bị từ chối và không tạo được room', async () => {
    await expect(new Client(t.url).joinOrCreate(ROOM)).rejects.toBeTruthy();
    await expect(
      new Client(t.url).joinOrCreate(ROOM, { instanceId: 'campus:x:1', schoolId: 'x', kind: 'play', seq: 1, createKey: 'doan' }),
    ).rejects.toBeTruthy();
    expect(await matchMaker.query({ name: ROOM })).toHaveLength(0);
  });

  it('dùng lại ticket cũ bị từ chối; ticket sai bị từ chối', async () => {
    const a = await t.join(lbl(1));
    await expect(new Client(t.url).joinById(a.roomId, { ticket: a.ticket })).rejects.toBeTruthy();
    await expect(new Client(t.url).joinById(a.roomId, { ticket: 'khong-co-that' })).rejects.toBeTruthy();
    await expect(new Client(t.url).joinById(a.roomId, {})).rejects.toBeTruthy();
    await wait(() => players(a.room)?.size === 1);
  });

  it('ticket của instance này không dùng được ở room khác', async () => {
    for (let i = 1; i <= 20; i++) await t.join(lbl(i));
    const other = await t.join(lbl(21)); // room 2
    const seat = await t.seat(lbl(22)); // cũng room 2
    expect(seat.roomId).toBe(other.roomId);
    const first = (await matchMaker.query({ name: ROOM })).find((r) => r.roomId !== other.roomId)!;
    await expect(new Client(t.url).joinById(first.roomId, { ticket: seat.ticket })).rejects.toBeTruthy();
  }, 30_000);

  it('hồi quy: joinById không ticket / ticket rác không giữ được ghế; người có ticket vẫn vào được khi room còn 1 ghế', async () => {
    const rooms: Room[] = [];
    for (let i = 1; i <= 19; i++) rooms.push((await t.join(lbl(i))).room);
    await wait(() => players(rooms[0]!)?.size === 19);
    const seat = await t.seat(lbl(20)); // ghế cuối của room
    expect(seat.instanceId).toMatch(/:1$/);

    const attempts = [
      ...[1, 2, 3].map(() => new Client(t.url).joinById(seat.roomId, {})),
      new Client(t.url).joinById(seat.roomId, { ticket: 'rac' }),
      new Client(t.url).joinById(seat.roomId, { ticket: 12345 }),
    ];
    for (const r of await Promise.allSettled(attempts)) expect(r.status).toBe('rejected');
    // Colyseus không giữ ghế nào cho kẻ không có ticket.
    const local = matchMaker.getLocalRoomById(seat.roomId) as unknown as { _reservedSeats: Record<string, unknown>; clients: unknown[] };
    expect(Object.keys(local._reservedSeats)).toHaveLength(0);

    const last = t.track(await new Client(t.url).joinById(seat.roomId, { ticket: seat.ticket }));
    await wait(() => players(last)?.size === 20);
    expect(local.clients).toHaveLength(20);
  }, 30_000);

  it('ticket cấp cho room A dùng ở room B bị từ chối, room B không tăng số người', async () => {
    const rooms: Room[] = [];
    for (let i = 1; i <= 20; i++) rooms.push((await t.join(lbl(i))).room); // room 1 đầy
    const other = await t.join(lbl(21)); // room 2
    const seatB = await t.seat(lbl(22)); // ticket của room 2
    expect(seatB.roomId).toBe(other.roomId);
    const roomOneId = rooms[0]!.roomId;
    await wait(() => players(rooms[0]!)?.size === 20);

    await rooms[19]!.leave(true); // room 1 còn 1 chỗ trống thật
    await wait(() => players(rooms[0]!)?.size === 19);
    const roomOne = matchMaker.getLocalRoomById(roomOneId) as unknown as { clients: unknown[]; _reservedSeats: Record<string, unknown> };
    await expect(new Client(t.url).joinById(roomOneId, { ticket: seatB.ticket })).rejects.toBeTruthy();
    await new Promise((r) => setTimeout(r, 100));
    expect(players(rooms[0]!).size).toBe(19);
    expect(roomOne.clients).toHaveLength(19);
    expect(Object.keys(roomOne._reservedSeats)).toHaveLength(0);

    // Ticket đã cháy và chỗ chờ ở room 2 đã nhả: người đó xin lại thì được xếp vào room 1 (còn chỗ), room 2 vẫn 1 người.
    const again = await t.join(lbl(22));
    expect(again.roomId).toBe(roomOneId);
    await wait(() => players(rooms[0]!)?.size === 20);
    expect(players(other.room).size).toBe(1);
  }, 30_000);

  it('ticket dùng lần hai bị từ chối ngay cả khi room còn chỗ', async () => {
    const a = await t.join(lbl(1));
    await wait(() => players(a.room)?.size === 1);
    await expect(new Client(t.url).joinById(a.roomId, { ticket: a.ticket })).rejects.toBeTruthy();
    await new Promise((r) => setTimeout(r, 100));
    expect(players(a.room).size).toBe(1);
  });

  it('u30 (tổ chức) không truyền schoolId → FORBIDDEN (campus tổ chức đóng)', async () => {
    await expect(t.seat('u30')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const org = [...t.service.store.schools.values()].find((s) => s.kind === 'organization')!;
    await expect(t.seat('u30', { schoolId: org.id })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('user không thuộc trường nào → FORBIDDEN; trường không tồn tại cũng FORBIDDEN', async () => {
    const loner = t.service.registerUser({ displayName: 'Người lạ' });
    await expect(t.seatFor(loner.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(t.seatFor(loner.id, { schoolId: 'school-khong-co' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const play = [...t.service.store.schools.values()].find((s) => s.kind === 'play')!;
    await expect(t.seatFor(loner.id, { schoolId: play.id })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('user có ≥2 trường mà không truyền schoolId → INVALID; truyền schoolId thì vào được', async () => {
    const p2 = t.service.registerUser({ displayName: 'Hiệu trưởng 2', planId: 'pilot' });
    const s2 = t.service.createSchool(p2.id, { name: 'Trường hai', level: 'primary', kind: 'play' });
    t.service.grantTeacher(p2.id, s2.id, p2.id);
    const cls = t.service.createClass(p2.id, s2.id, { name: 'Lớp', capacity: 5 });
    t.service.enrollWithCode(t.idOf('u05'), cls.joinCode);

    await expect(t.seat('u05')).rejects.toMatchObject({ code: 'INVALID' });
    const seat = await t.seat('u05', { schoolId: s2.id });
    expect(seat.instanceId).toBe(`campus:${s2.id}:1`);
  });

  it('streaming ở trường play → OK', async () => {
    const seat = await t.seat('u03', { streaming: true });
    expect(seat.ticket).toBeTruthy();
    const room = await new Client(t.url).joinById(seat.roomId, { ticket: seat.ticket });
    await wait(() => players(room)?.size === 1);
    await room.leave(true);
  });

  it('mất vai thành viên sau khi có ticket thì onAuth từ chối', async () => {
    const school = [...t.service.store.schools.values()].find((s) => s.kind === 'play')!;
    const seat = await t.seat('u02');
    t.service.store.memberships.delete(`${school.id}:${t.idOf('u02')}`);
    await expect(new Client(t.url).joinById(seat.roomId, { ticket: seat.ticket })).rejects.toBeTruthy();
  });
});

describe('danh tính & presence', () => {
  it('displayName lấy từ domain dù client gửi name khác; presence không lộ userId', async () => {
    const a = await t.join(lbl(4), { name: 'Hacker' });
    await wait(() => players(a.room)?.get(a.room.sessionId));
    const me = players(a.room).get(a.room.sessionId);
    expect(me.displayName).toBe('Dev u04');
    expect(me.id).toBe(a.room.sessionId);
    const json = JSON.stringify(me.toJSON());
    expect(json).not.toContain(t.idOf(lbl(4)));
    expect(Object.keys(me.toJSON()).sort()).toEqual(['displayName', 'id', 'lastSeq', 'x', 'y']);
  });

  it('log chỉ chứa id, không có ticket, không có tên', async () => {
    const a = await t.join(lbl(4), { name: 'Hacker' });
    await wait(() => players(a.room)?.size === 1);
    await a.room.leave(true);
    await wait(() => t.guard.forgotten.length === 1);
    const dump = JSON.stringify(t.logs);
    expect(t.logs.length).toBeGreaterThan(0);
    expect(dump).not.toContain(a.ticket);
    expect(dump).not.toContain('Dev u04');
    expect(dump).not.toContain('Hacker');
  });
});

describe('guard', () => {
  const sendAndWaitChecked = async (room: Room, type: string, payload: unknown) => {
    const n = t.guard.checked.length;
    room.send(type, payload);
    await wait(() => t.guard.checked.length > n);
  };

  it("verdict 'drop' thì tin move không đổi vị trí; 'ok' thì đổi", async () => {
    const a = await t.join(lbl(1));
    await wait(() => players(a.room)?.get(a.room.sessionId));
    const me = players(a.room).get(a.room.sessionId);
    const { x, y } = { x: me.x, y: me.y };

    t.guard.verdict = () => 'drop';
    await sendAndWaitChecked(a.room, 'move', { x: x + 2, y, seq: 1 });
    await new Promise((r) => setTimeout(r, 100));
    expect(me.lastSeq).toBe(0);
    expect(Math.abs(me.x - x)).toBeLessThan(0.01);

    t.guard.verdict = () => 'ok';
    a.room.send('move', { x: x + 2, y, seq: 1 });
    await wait(() => me.lastSeq === 1);
    expect(Math.abs(me.x - (x + 2))).toBeLessThan(0.01);
  });

  it("verdict 'kick' thì client nhận mã đóng 4029 và bị rời hẳn (không giữ chỗ reconnect)", async () => {
    const a = await t.join(lbl(1));
    const b = await t.join(lbl(2));
    await wait(() => players(b.room)?.size === 2);
    let closed: number | null = null;
    a.room.onLeave((code) => {
      closed = code;
    });
    t.guard.verdict = (id) => (id === a.room.sessionId ? 'kick' : 'ok');
    a.room.send('move', { x: 1, y: 1, seq: 1 });
    await wait(() => closed !== null);
    expect(closed).toBe(4029);
    await wait(() => players(b.room)?.size === 1);
    await wait(() => t.guard.forgotten.includes(a.room.sessionId));
  });

  it('tin loại lạ cũng gọi guard rồi bị bỏ', async () => {
    const a = await t.join(lbl(1));
    await wait(() => players(a.room)?.size === 1);
    const before = t.guard.checked.filter((id) => id === a.room.sessionId).length;
    await sendAndWaitChecked(a.room, 'chieu-la', { hello: 1 });
    expect(t.guard.checked.filter((id) => id === a.room.sessionId).length).toBe(before + 1);
    // Vẫn sống và không đổi state.
    await new Promise((r) => setTimeout(r, 50));
    expect(players(a.room).size).toBe(1);

    let closed: number | null = null;
    a.room.onLeave((code) => {
      closed = code;
    });
    t.guard.verdict = () => 'kick';
    a.room.send('chieu-la-nua', 1);
    await wait(() => closed !== null);
    expect(closed).toBe(4029);
  });

  it('rời room thì forget được gọi', async () => {
    const a = await t.join(lbl(1));
    await wait(() => players(a.room)?.size === 1);
    const sid = a.room.sessionId;
    await a.room.leave(true);
    await wait(() => t.guard.forgotten.includes(sid));
  });
});
