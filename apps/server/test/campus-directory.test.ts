import { describe, expect, it } from 'vitest';
import { CampusDirectory } from '../src/rooms/campus-directory.js';
import { SEAT_COLYSEUS_S, SEAT_TTL_MS } from '../src/sim/constants.js';

const CAP = 20;
const TTL = 15_000;
const entry = (userId: string, schoolId = 's1') => ({ userId, schoolId, kind: 'play' as const });

const make = () => {
  let n = 0;
  const dir = new CampusDirectory({ cap: CAP, ttlMs: TTL, newTicket: () => `t${++n}` });
  return dir;
};

/** Mô phỏng room: gắn room vào instance ngay sau khi tạo. */
const reserve = (dir: CampusDirectory, userId: string, now = 0, schoolId = 's1') => {
  const r = dir.reserve(entry(userId, schoolId), [], now);
  if (r.assignment.action === 'create') dir.bindRoom(r.assignment.instanceId, `room-${r.assignment.seq}`);
  return r;
};

describe('CampusDirectory', () => {
  it('20 lần reserve vào seq 1; người thứ 21 sang seq 2', () => {
    const dir = make();
    for (let i = 1; i <= CAP; i++) expect(reserve(dir, `u${i}`).assignment.seq).toBe(1);
    const r = reserve(dir, 'u21');
    expect(r.assignment.seq).toBe(2);
    expect(r.assignment.action).toBe('create');
  });

  it('pending hết hạn thì nhả chỗ', () => {
    const dir = make();
    for (let i = 1; i <= CAP; i++) reserve(dir, `u${i}`, 0);
    // Chưa hết hạn: đầy.
    expect(reserve(dir, 'x1', TTL - 1).assignment.seq).toBe(2);
    // Hết hạn: chỗ ở seq 1 trống lại.
    const r = reserve(dir, 'x2', TTL);
    expect(r.assignment.seq).toBe(1);
    expect(r.assignment.action).toBe('join');
  });

  it('ticket dùng một lần; đúng instance; chưa hết hạn', () => {
    const dir = make();
    const r = reserve(dir, 'u1', 0);
    const id = r.assignment.instanceId;
    expect(dir.consume('sai', 1)).toBeNull();
    expect(dir.consume('', 1)).toBeNull();
    expect(dir.consume(r.ticket, 1)).toEqual({ instanceId: id, userId: 'u1', streaming: false });
    expect(dir.consume(r.ticket, 2)).toBeNull(); // lần hai

    const late = reserve(dir, 'u2', 0);
    expect(dir.consume(late.ticket, TTL)).toBeNull(); // hết hạn
  });

  it('held vẫn chiếm chỗ; release thì nhả chỗ', () => {
    const dir = make();
    const first = reserve(dir, 'u1', 0);
    const id = first.assignment.instanceId;
    dir.consume(first.ticket, 1);
    expect(dir.markConnected(id, 'u1', 'sess1')).toBe(true);
    for (let i = 2; i <= CAP; i++) {
      const o = reserve(dir, `u${i}`, 2);
      dir.consume(o.ticket, 3);
      dir.markConnected(id, `u${i}`, `sess${i}`);
    }

    expect(dir.markHeld(id, 'u1', 'sess1')).toBe(true);
    expect(dir.stateOf(id, 'u1')).toBe('held');
    // Rất lâu sau, held vẫn chiếm chỗ (không bị quét như pending) → người 21 sang seq 2.
    expect(reserve(dir, 'u21', 10 * TTL).assignment.seq).toBe(2);

    dir.release(id, 'u1', 'sess1');
    expect(dir.stateOf(id, 'u1')).toBeUndefined();
    expect(reserve(dir, 'u22', 10 * TTL).assignment.instanceId).toBe(id);
  });

  it('phiên cũ không xoá/đổi chỗ của phiên mới sau khi bị thay thế', () => {
    const dir = make();
    const a = reserve(dir, 'u1', 0);
    const id = a.assignment.instanceId;
    dir.consume(a.ticket, 1);
    dir.markConnected(id, 'u1', 'old');
    const again = reserve(dir, 'u1', 2);
    expect(again.assignment.action).toBe('rejoin');
    expect(again.previous).toBe('connected');
    expect(again.ticket).not.toBe(a.ticket);

    expect(dir.markHeld(id, 'u1', 'old')).toBe(false);
    dir.release(id, 'u1', 'old');
    expect(dir.stateOf(id, 'u1')).toBe('pending'); // vẫn giữ chỗ cho ticket mới
    expect(dir.consume(again.ticket, 3)).toMatchObject({ instanceId: id, userId: 'u1' });
    expect(dir.markConnected(id, 'u1', 'new')).toBe(true);
    expect(dir.size(id)).toBe(1);
  });

  it('dispose rồi tạo lại thì dùng lại seq 1 (và seq 2)', () => {
    const dir = make();
    const r = reserve(dir, 'u1', 0);
    for (let i = 2; i <= CAP; i++) reserve(dir, `u${i}`, 0);
    const second = reserve(dir, 'u21', 0);
    expect(second.assignment.seq).toBe(2);

    dir.dispose(second.assignment.instanceId);
    const again = reserve(dir, 'u21', 0);
    expect(again.assignment.seq).toBe(2);
    expect(again.assignment.action).toBe('create');

    dir.dispose(r.assignment.instanceId);
    dir.dispose(again.assignment.instanceId);
    const fresh = reserve(dir, 'u1', 0);
    expect(fresh.assignment.seq).toBe(1);
    expect(fresh.assignment.action).toBe('create');
  });

  it('dispose có roomId chỉ huỷ đúng room đang gắn', () => {
    const dir = make();
    const r = reserve(dir, 'u1', 0);
    dir.dispose(r.assignment.instanceId, 'room-khac');
    expect(dir.size(r.assignment.instanceId)).toBe(1);
    dir.dispose(r.assignment.instanceId, 'room-1');
    expect(dir.size(r.assignment.instanceId)).toBe(0);
  });

  it('cùng user reserve lại → rejoin đúng instance cũ, không tăng số chỗ', () => {
    const dir = make();
    const a = reserve(dir, 'u1', 0);
    const b = reserve(dir, 'u1', 1);
    expect(b.assignment).toEqual({ action: 'rejoin', instanceId: a.assignment.instanceId, seq: 1 });
    expect(dir.size(a.assignment.instanceId)).toBe(1);
    // Ticket cũ bị thay.
    expect(dir.consume(a.ticket, 2)).toBeNull();
    expect(dir.consume(b.ticket, 2)).toMatchObject({ userId: 'u1' });
  });

  it('isCreating: chỉ đúng khoá tạo và trước khi gắn room', () => {
    const dir = make();
    const r = dir.reserve(entry('u1'), [], 0);
    const id = r.assignment.instanceId;
    expect(dir.isCreating(id, r.createKey)).toBe(true);
    expect(dir.isCreating(id, 'khoa-gia')).toBe(false);
    expect(dir.isCreating('campus:s1:9', r.createKey)).toBe(false);
    dir.bindRoom(id, 'room-1');
    expect(dir.isCreating(id, r.createKey)).toBe(false);
  });

  it('tạo room lỗi: release nhả instance chưa có room', () => {
    const dir = make();
    const r = dir.reserve(entry('u1'), [], 0);
    dir.release(r.assignment.instanceId, 'u1');
    expect(dir.isCreating(r.assignment.instanceId)).toBe(false);
    expect(dir.reserve(entry('u2'), [], 0).assignment.seq).toBe(1);
  });

  it('tách theo trường', () => {
    const dir = make();
    expect(reserve(dir, 'u1', 0, 's1').assignment.instanceId).toBe('campus:s1:1');
    expect(reserve(dir, 'u2', 0, 's2').assignment.instanceId).toBe('campus:s2:1');
  });
});

describe('CampusDirectory: streaming & thời hạn ghế', () => {
  it('reserve lưu streaming vào chỗ chờ; ticket mang cờ đó ra khi consume', () => {
    const dir = make();
    const on = dir.reserve(entry('u1'), [], 0, true);
    const off = dir.reserve(entry('u2'), [], 0);
    const id = on.assignment.instanceId;
    expect(dir.streamingOf(id, 'u1')).toBe(true);
    expect(dir.streamingOf(id, 'u2')).toBe(false);
    expect(dir.consume(on.ticket, 1)).toEqual({ instanceId: id, userId: 'u1', streaming: true });
    expect(dir.consume(off.ticket, 1)).toEqual({ instanceId: id, userId: 'u2', streaming: false });
    expect(dir.describe(id)).toEqual({ schoolId: 's1', kind: 'play' });
  });

  it('tra ticket ở mọi instance (không cần biết instanceId)', () => {
    const dir = make();
    for (let i = 1; i <= CAP; i++) reserve(dir, `u${i}`, 0);
    const second = reserve(dir, 'u21', 0);
    expect(dir.consume(second.ticket, 1)).toMatchObject({ instanceId: 'campus:s1:2', userId: 'u21' });
  });

  it('sau consume chỗ chờ vẫn chiếm chỗ cho tới markConnected hoặc hết hạn', () => {
    const dir = make();
    const r = reserve(dir, 'u1', 0);
    const id = r.assignment.instanceId;
    dir.consume(r.ticket, 1);
    expect(dir.size(id)).toBe(1);
    expect(dir.stateOf(id, 'u1')).toBe('pending');
    expect(dir.markConnected(id, 'u1', 's')).toBe(true);
    expect(dir.stateOf(id, 'u1')).toBe('connected');
  });

  it('hằng số: ghế Colyseus ngắn hơn chỗ chờ trong sổ ít nhất 3 s', () => {
    expect(SEAT_COLYSEUS_S * 1000).toBeLessThanOrEqual(SEAT_TTL_MS - 3000);
  });

  it('đồng hồ giả: khi ghế Colyseus đã hết hạn, sổ vẫn còn đếm chỗ (không đếm thiếu)', () => {
    let n = 0;
    const dir = new CampusDirectory({ cap: 2, newTicket: () => `k${++n}` }); // ttl mặc định = SEAT_TTL_MS
    const a = dir.reserve(entry('u1'), [], 0);
    dir.bindRoom(a.assignment.instanceId, 'room-1');
    const b = dir.reserve(entry('u2'), [], 0);
    dir.consume(a.ticket, 0);
    dir.consume(b.ticket, 0);
    const colyseusGone = SEAT_COLYSEUS_S * 1000 + 1;
    expect(colyseusGone).toBeLessThan(SEAT_TTL_MS);
    // Colyseus đã nhả ghế nhưng sổ còn giữ → người thứ 3 không lọt vào instance đầy.
    expect(dir.reserve(entry('u3'), [], colyseusGone).assignment.seq).toBe(2);
    // Sổ nhả sau SEAT_TTL_MS kể từ lúc consume.
    expect(dir.reserve(entry('u4'), [], SEAT_TTL_MS).assignment.seq).toBe(1);
  });
});
