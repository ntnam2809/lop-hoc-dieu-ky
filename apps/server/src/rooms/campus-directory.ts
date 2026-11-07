import { randomUUID } from 'node:crypto';
import {
  assignCampusInstance,
  type CampusAssignment,
  type CampusEntry,
  type CampusInstanceView,
} from '@lhdk/domain';
import { MAX_CLIENTS, SEAT_TTL_MS } from '../sim/constants.js';

/**
 * Sổ instance campus trong bộ nhớ: ai đang chiếm chỗ ở instance nào. Thuần: đồng hồ do người gọi tiêm,
 * không import Colyseus. Mọi hàm chạy đồng bộ nên `reserve` là một bước nguyên tử — hai yêu cầu đồng thời
 * không thể cùng vượt trần.
 */

export type OccupantState = 'pending' | 'connected' | 'held';

interface Occupant {
  affinity: readonly string[];
  state: OccupantState;
  /** Chỉ có khi pending và chưa dùng. */
  ticket?: string;
  /** Chỉ có khi pending. */
  expiresAt?: number;
  /** Cờ livestream lúc xin ghế; ticket mang theo để onAuth kiểm lại đúng ngữ cảnh. */
  streaming: boolean;
  /** Phiên Colyseus đang sở hữu chỗ (connected/held). Vắng khi pending → phiên cũ không còn quyền đụng chỗ này. */
  sessionId?: string;
}

interface Instance {
  instanceId: string;
  schoolId: string;
  kind: CampusEntry['kind'];
  seq: number;
  roomId?: string;
  /** Khoá nội bộ cho lần tạo room; client không biết nên không tự mở được room. */
  createKey?: string;
  occupants: Map<string, Occupant>;
}

export interface CampusReservation {
  assignment: CampusAssignment;
  ticket: string;
  /** Trạng thái chỗ trước đó của chính user này (chỉ khi rejoin). */
  previous?: OccupantState;
  /** Room đã gắn với instance (chưa có thì đang/sắp được tạo). */
  roomId?: string;
  /** Có khi action = 'create': khoá để room xác nhận lần tạo là của server. */
  createKey?: string;
}

/** Kết quả dùng ticket: ticket tự cho biết instance và người, không cần biết trước. */
export interface ConsumedTicket {
  instanceId: string;
  userId: string;
  streaming: boolean;
}

export interface CampusDirectoryOptions {
  cap?: number;
  ttlMs?: number;
  newTicket?: () => string;
}

export class CampusDirectory {
  private readonly instances = new Map<string, Instance>();
  private readonly cap: number;
  private readonly ttlMs: number;
  private readonly newTicket: () => string;

  constructor(opts: CampusDirectoryOptions = {}) {
    this.cap = opts.cap ?? MAX_CLIENTS;
    this.ttlMs = opts.ttlMs ?? SEAT_TTL_MS;
    this.newTicket = opts.newTicket ?? randomUUID;
  }

  /** Giữ chỗ pending kèm ticket. Ném DomainError (vd QUOTA) nếu luật gán từ chối. */
  reserve(
    entry: Pick<CampusEntry, 'userId' | 'schoolId' | 'kind'>,
    affinity: readonly string[],
    now: number,
    streaming = false,
  ): CampusReservation {
    this.sweep(now);
    const views: CampusInstanceView[] = [...this.instances.values()].map((i) => ({
      instanceId: i.instanceId,
      schoolId: i.schoolId,
      kind: i.kind,
      seq: i.seq,
      occupants: [...i.occupants].map(([userId, o]) => ({ userId, affinity: o.affinity })),
    }));
    const assignment = assignCampusInstance(
      views,
      { userId: entry.userId, schoolId: entry.schoolId, kind: entry.kind, affinity },
      { cap: this.cap },
    );

    let inst = this.instances.get(assignment.instanceId);
    let createKey: string | undefined;
    if (assignment.action === 'create' || !inst) {
      createKey = randomUUID();
      inst = {
        instanceId: assignment.instanceId,
        schoolId: entry.schoolId,
        kind: entry.kind,
        seq: assignment.seq,
        createKey,
        occupants: new Map(),
      };
      this.instances.set(inst.instanceId, inst);
    }
    const previous = inst.occupants.get(entry.userId)?.state;
    const ticket = this.newTicket();
    inst.occupants.set(entry.userId, {
      affinity: [...affinity],
      state: 'pending',
      ticket,
      expiresAt: now + this.ttlMs,
      streaming,
    });
    return {
      assignment,
      ticket,
      ...(assignment.action === 'rejoin' && previous ? { previous } : {}),
      ...(inst.roomId ? { roomId: inst.roomId } : {}),
      ...(createKey ? { createKey } : {}),
    };
  }

  /**
   * Dùng ticket (một lần), tra ở mọi instance. Trả instance + người + cờ streaming; sai/hết hạn/đã dùng thì null.
   * Chỗ chờ vẫn chiếm chỗ cho tới khi `markConnected` hoặc hết hạn.
   */
  consume(ticket: string, now: number): ConsumedTicket | null {
    if (typeof ticket !== 'string' || ticket === '') return null;
    for (const inst of this.instances.values()) {
      for (const [userId, o] of inst.occupants) {
        if (o.state !== 'pending' || o.ticket === undefined || o.ticket !== ticket) continue;
        if (o.expiresAt === undefined || now >= o.expiresAt) return null;
        delete o.ticket;
        o.expiresAt = now + this.ttlMs; // đang nối vào: cho thêm thời gian hoàn tất onJoin
        return { instanceId: inst.instanceId, userId, streaming: o.streaming };
      }
    }
    return null;
  }

  /** Trường và loại của một instance đang có trong sổ (để kiểm lại quyền sau khi dùng ticket). */
  describe(instanceId: string): { schoolId: string; kind: CampusEntry['kind'] } | undefined {
    const inst = this.instances.get(instanceId);
    return inst ? { schoolId: inst.schoolId, kind: inst.kind } : undefined;
  }

  /** Cờ streaming đã lưu ở chỗ chờ của một người (chỉ khi còn pending). */
  streamingOf(instanceId: string, userId: string): boolean | undefined {
    return this.instances.get(instanceId)?.occupants.get(userId)?.streaming;
  }

  /** Trả false nếu chỗ không còn (bị quét/thay thế) → room phải từ chối lần vào này. */
  markConnected(instanceId: string, userId: string, sessionId: string): boolean {
    const o = this.instances.get(instanceId)?.occupants.get(userId);
    if (!o) return false;
    // Đang giữ chỗ do một phiên khác sở hữu thì không được giành lại.
    if (o.sessionId !== undefined && o.sessionId !== sessionId) return false;
    o.state = 'connected';
    o.sessionId = sessionId;
    delete o.ticket;
    delete o.expiresAt;
    return true;
  }

  /** Chỉ phiên đang sở hữu chỗ mới chuyển được sang held. */
  markHeld(instanceId: string, userId: string, sessionId: string): boolean {
    const o = this.instances.get(instanceId)?.occupants.get(userId);
    if (!o || o.sessionId !== sessionId) return false;
    o.state = 'held';
    return true;
  }

  /** Nhả chỗ. Có `sessionId` thì chỉ nhả khi đúng phiên đang sở hữu (phiên bị thay thế không xoá chỗ của phiên mới). */
  release(instanceId: string, userId: string, sessionId?: string): void {
    const inst = this.instances.get(instanceId);
    const o = inst?.occupants.get(userId);
    if (!inst || !o) return;
    if (sessionId !== undefined && o.sessionId !== sessionId) return;
    inst.occupants.delete(userId);
    if (inst.occupants.size === 0 && inst.roomId === undefined) this.instances.delete(instanceId);
  }

  /** Room bị huỷ: giải phóng instance (và seq). Có `roomId` thì chỉ huỷ khi đúng room đang gắn. */
  dispose(instanceId: string, roomId?: string): void {
    const inst = this.instances.get(instanceId);
    if (!inst) return;
    if (roomId !== undefined && inst.roomId !== roomId) return;
    this.instances.delete(instanceId);
  }

  bindRoom(instanceId: string, roomId: string): void {
    const inst = this.instances.get(instanceId);
    if (inst) {
      inst.roomId = roomId;
      delete inst.createKey;
    }
  }

  /** Instance đã có chỗ ghi sổ nhưng chưa gắn room (và đúng khoá tạo nếu được đưa vào). */
  isCreating(instanceId: string, createKey?: string): boolean {
    const inst = this.instances.get(instanceId);
    if (!inst || inst.roomId !== undefined) return false;
    return createKey === undefined || (inst.createKey !== undefined && inst.createKey === createKey);
  }

  roomIdOf(instanceId: string): string | undefined {
    return this.instances.get(instanceId)?.roomId;
  }

  /** Số chỗ đang chiếm (pending + connected + held). */
  size(instanceId: string): number {
    return this.instances.get(instanceId)?.occupants.size ?? 0;
  }

  stateOf(instanceId: string, userId: string): OccupantState | undefined {
    return this.instances.get(instanceId)?.occupants.get(userId)?.state;
  }

  private sweep(now: number): void {
    for (const inst of [...this.instances.values()]) {
      for (const [userId, o] of inst.occupants) {
        if (o.state === 'pending' && o.expiresAt !== undefined && now >= o.expiresAt) inst.occupants.delete(userId);
      }
      if (inst.occupants.size === 0 && inst.roomId === undefined) this.instances.delete(inst.instanceId);
    }
  }
}
