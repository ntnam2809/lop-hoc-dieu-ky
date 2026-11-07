import { ErrorCode, Room, ServerError, type Client, type Deferred } from '@colyseus/core';
import { checkCampusEntry, type SchoolKind, type SchoolService } from '@lhdk/domain';
import { z } from 'zod';
import type { Logger, MessageGuardPort } from '../ports.js';
import { BUDGET_CAP, CAMPUS_ORG_ENABLED, MAX_CLIENTS, RECONNECT_S, SEAT_COLYSEUS_S, SEAT_TTL_MS, WORLD } from '../sim/constants.js';
import { sanitizeName, validateMove } from '../sim/movement.js';
import type { CampusDirectory } from './campus-directory.js';
import { CampusState, Player } from './campus-state.js';

const MoveMsg = z.object({ x: z.number(), y: z.number(), seq: z.number().int().nonnegative().max(0xffffffff) }); // lastSeq là uint32 trong schema

/** Mã đóng: bị guard đá (tin nhắn quá mức). */
export const CLOSE_KICKED = 4029;
/** Mã đóng: kết nối cũ bị thay bằng kết nối mới của cùng người. */
export const CLOSE_SUPERSEDED = 4409;

/** Phụ thuộc của một lần `defineCampus`; mỗi lần có sổ instance riêng. */
export interface CampusRuntime {
  directory: CampusDirectory;
  service: SchoolService;
  newGuard?: () => MessageGuardPort;
  log?: Logger;
  now: () => number;
}

/** Tuỳ chọn nội bộ khi server tự tạo room (client không có `createKey`). */
export interface CampusCreateOptions {
  instanceId: string;
  schoolId: string;
  kind: SchoolKind;
  seq: number;
  createKey: string;
}

const NOOP_GUARD: MessageGuardPort = { check: () => 'ok', forget: () => {} };
const AUTH_DENIED = () => new ServerError(ErrorCode.AUTH_FAILED, 'Không vào được campus');

/** Dữ liệu `client.auth` do onAuth static trả. */
interface CampusAuth {
  userId: string;
  instanceId: string;
}

/**
 * Vé vào, chạy trong `onAuth` static: Colyseus gọi nó TRƯỚC khi đặt ghế (MatchMaker.joinById → callOnAuth → reserveSeatFor),
 * nên người không có vé không giữ được ghế. Dùng ticket một lần, kiểm lại quyền theo trường/loại của instance ghi trong ticket.
 * Không log ticket.
 */
export async function authenticateCampusTicket(rt: CampusRuntime, options: unknown): Promise<CampusAuth> {
  const ticket = (options as { ticket?: unknown } | undefined | null)?.ticket;
  if (typeof ticket !== 'string') throw AUTH_DENIED();
  const used = rt.directory.consume(ticket, rt.now());
  if (used === null) throw AUTH_DENIED();
  const { instanceId, userId, streaming } = used;
  try {
    const inst = rt.directory.describe(instanceId);
    if (!inst) throw new Error('instance gone');
    const entry = checkCampusEntry(rt.service, userId, inst.schoolId, { streaming });
    if (entry.schoolId !== inst.schoolId || entry.kind !== inst.kind) throw new Error('mismatch');
    if (entry.kind === 'organization' && !CAMPUS_ORG_ENABLED) throw new Error('org closed');
  } catch {
    rt.directory.release(instanceId, userId);
    rt.log?.info('campus.auth.denied', { instanceId, userId });
    throw AUTH_DENIED();
  }
  return { userId, instanceId };
}

interface Session {
  userId: string;
}

export class CampusRoom extends Room {
  maxClients = MAX_CLIENTS;
  state = new CampusState();
  // Trạng thái nội bộ (không vào Schema): ngân sách quãng đường + mốc tích luỹ.
  private internal = new Map<string, { budget: number; t: number }>();

  private instanceId = '';
  private guard: MessageGuardPort = NOOP_GUARD;
  /** sessionId → người dùng. userId KHÔNG vào schema/presence (Player.id vẫn là sessionId). */
  private sessions = new Map<string, Session>();
  /** Phiên đang giữ chỗ chờ nối lại. */
  private holds = new Map<string, Deferred<Client>>();
  /** Phiên bị đá/thay thế: không giữ chỗ reconnect. */
  private noHold = new Set<string>();
  private leftWaiters = new Map<string, Array<() => void>>();

  /** `rt` do `defineCampus` tiêm; không có (vd `new CampusRoom()` trần) thì onCreate từ chối. */
  constructor(private readonly rt?: CampusRuntime) {
    super();
  }

  async onCreate(options: unknown) {
    const rt = this.rt;
    const o = options as Partial<CampusCreateOptions> | undefined;
    if (
      !rt ||
      typeof o?.instanceId !== 'string' ||
      typeof o.createKey !== 'string' ||
      typeof o.schoolId !== 'string' ||
      (o.kind !== 'play' && o.kind !== 'organization') ||
      typeof o.seq !== 'number' ||
      !rt.directory.isCreating(o.instanceId, o.createKey)
    ) {
      throw new Error('Room campus chỉ do server mở');
    }
    this.instanceId = o.instanceId;
    // Private: join()/joinOrCreate() của matchmaker lọc private:false nên không tìm thấy room này; chỉ joinById (vé) và reconnect.
    await this.setPrivate(true);
    // Ghế Colyseus hết hạn trước chỗ chờ trong sổ (SEAT_TTL_MS) → sổ không bao giờ đếm thiếu so với Colyseus.
    this.seatReservationTimeout = SEAT_COLYSEUS_S;
    this.guard = rt.newGuard?.() ?? NOOP_GUARD;
    rt.directory.bindRoom(o.instanceId, this.roomId);
    void this.setMetadata({ schoolId: o.schoolId, kind: o.kind, seq: o.seq });
    rt.log?.info('campus.room.created', { roomId: this.roomId, instanceId: o.instanceId });

    this.onMessage('move', (client, raw) => {
      if (!this.admit(client)) return;
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const parsed = MoveMsg.safeParse(raw);
      const now = Date.now();
      const st = this.internal.get(client.sessionId) ?? { budget: BUDGET_CAP, t: now };
      const res = parsed.success
        ? validateMove(
            { x: p.x, y: p.y, t: st.t, budget: st.budget, lastSeq: p.lastSeq },
            parsed.data,
            now,
          )
        : ({ ok: false, reason: 'invalid', budget: st.budget, t: st.t } as const);
      this.internal.set(client.sessionId, { budget: res.budget, t: res.t });
      if (res.ok && parsed.success) {
        p.x = res.x;
        p.y = res.y;
        p.lastSeq = parsed.data.seq;
      } else {
        const seq = parsed.success ? parsed.data.seq : 0;
        if (process.env.CAMPUS_LOG_CORRECT) console.log(`[campus] correct ${res.ok ? 'invalid' : res.reason} seq=${seq}`);
        client.send('correct', { x: p.x, y: p.y, seq });
      }
    });
    // Loại tin lạ: vẫn qua guard (đếm nhịp/kích cỡ), xong thì bỏ.
    this.onMessage('*', (client) => {
      this.admit(client);
    });
  }

  /**
   * Không có onAuth instance: vé được kiểm ở `onAuth` static do `defineCampus` đóng gói (trước khi đặt ghế).
   * `callOnAuth` bỏ qua static khi không có authContext (MatchMaker.mjs:550) → ở đây bắt buộc kiểm lại `client.auth`.
   */
  onJoin(client: Client, _options: unknown, _auth: unknown) {
    const rt = this.rt!;
    const auth = client.auth as Partial<CampusAuth> | undefined;
    if (!auth || typeof auth.userId !== 'string' || typeof auth.instanceId !== 'string') throw AUTH_DENIED();
    const { userId, instanceId } = auth;
    if (instanceId !== this.instanceId) {
      // Vé của room khác: nhả chỗ chờ đúng instance ghi trong vé, room này không đổi.
      rt.directory.release(instanceId, userId);
      rt.log?.info('campus.auth.wrong_room', { roomId: this.roomId, instanceId, userId });
      throw AUTH_DENIED();
    }
    if (!rt.directory.markConnected(this.instanceId, userId, client.sessionId)) {
      throw new ServerError(ErrorCode.AUTH_FAILED, 'Chỗ ngồi không còn hiệu lực');
    }
    this.sessions.set(client.sessionId, { userId });
    const p = new Player();
    p.id = client.sessionId;
    // Tên lấy từ domain; options.name của client bị bỏ qua.
    p.displayName = sanitizeName(rt.service.user(userId).displayName, client.sessionId);
    p.x = WORLD.w * (0.25 + Math.random() * 0.5);
    p.y = WORLD.h * (0.25 + Math.random() * 0.5);
    p.lastSeq = 0;
    this.state.players.set(client.sessionId, p);
    this.internal.set(client.sessionId, { budget: BUDGET_CAP, t: Date.now() });
    rt.log?.info('campus.join', { roomId: this.roomId, userId, sessionId: client.sessionId, n: this.state.players.size });
  }

  // 0.18: onDrop = mất kết nối không chủ động; onLeave = rời hẳn (kể cả hết hạn giữ chỗ).
  async onDrop(client: Client) {
    const rt = this.rt!;
    const sid = client.sessionId;
    const s = this.sessions.get(sid);
    if (!s || this.noHold.has(sid)) return; // bị đá/thay thế: không giữ chỗ
    if (!rt.directory.markHeld(this.instanceId, s.userId, sid)) return;
    rt.log?.info('campus.drop', { roomId: this.roomId, sessionId: sid, holdSeconds: RECONNECT_S });
    const hold = this.allowReconnection(client, RECONNECT_S);
    this.holds.set(sid, hold);
    try {
      await hold;
      rt.directory.markConnected(this.instanceId, s.userId, sid);
      const st = this.internal.get(sid);
      if (st) st.t = Date.now();
      rt.log?.info('campus.reconnected', { roomId: this.roomId, sessionId: sid });
    } catch {
      rt.log?.info('campus.reconnect.expired', { roomId: this.roomId, sessionId: sid });
    } finally {
      this.holds.delete(sid);
    }
  }

  onLeave(client: Client) {
    const rt = this.rt!;
    const sid = client.sessionId;
    const s = this.sessions.get(sid);
    if (s) rt.directory.release(this.instanceId, s.userId, sid);
    this.sessions.delete(sid);
    this.noHold.delete(sid);
    this.state.players.delete(sid);
    this.internal.delete(sid);
    this.guard.forget(sid);
    // Còn chỗ pending (vd vừa đuổi kết nối cũ để cấp ticket mới) thì chưa được tự huỷ room.
    // resetAutoDisposeTimeout có ở runtime 0.18.23 (Room.mjs:1230) nhưng .d.ts đánh dấu private → ép kiểu hẹp.
    if (rt.directory.size(this.instanceId) > 0) {
      (this as unknown as { resetAutoDisposeTimeout(seconds: number): void }).resetAutoDisposeTimeout(
        Math.ceil(SEAT_TTL_MS / 1000) + 1,
      );
    }
    for (const w of this.leftWaiters.get(sid) ?? []) w();
    this.leftWaiters.delete(sid);
    rt.log?.info('campus.leave', { roomId: this.roomId, sessionId: sid, n: this.state.players.size });
  }

  onDispose() {
    this.rt?.directory.dispose(this.instanceId, this.roomId);
    this.rt?.log?.info('campus.room.disposed', { roomId: this.roomId });
  }

  /**
   * Đuổi kết nối hiện tại của một người (đang held hoặc connected) và chờ tới khi phiên đó đã rời hẳn.
   * Gọi trước khi cấp ticket mới để số người trong room không tăng.
   */
  async evict(userId: string, timeoutMs = 3000): Promise<void> {
    let sid: string | undefined;
    for (const [id, s] of this.sessions) if (s.userId === userId) sid = id;
    if (sid === undefined) return;
    const left = new Promise<void>((resolve) => {
      const list = this.leftWaiters.get(sid!) ?? [];
      list.push(resolve);
      this.leftWaiters.set(sid!, list);
    });
    this.noHold.add(sid);
    const hold = this.holds.get(sid);
    if (hold) {
      hold.reject(new Error('superseded'));
    } else {
      const c = this.clients.getById(sid);
      if (c) c.leave(CLOSE_SUPERSEDED);
      else {
        this.sessions.delete(sid);
        this.state.players.delete(sid);
      }
    }
    await Promise.race([left, new Promise<void>((r) => setTimeout(r, timeoutMs).unref())]);
  }

  /** Mọi tin đi qua guard trước khi xử lý. true = được xử lý. */
  private admit(client: Client): boolean {
    const verdict = this.guard.check(client.sessionId);
    if (verdict === 'ok') return true;
    if (verdict === 'kick') {
      this.noHold.add(client.sessionId);
      client.leave(CLOSE_KICKED);
    }
    return false;
  }
}
