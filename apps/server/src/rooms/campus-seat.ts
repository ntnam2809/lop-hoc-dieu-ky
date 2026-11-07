import { matchMaker, type Server } from '@colyseus/core';
import { campusAffinity, checkCampusEntry, conflict, forbidden, invalid, type SchoolService } from '@lhdk/domain';
import type { Logger, MessageGuardPort } from '../ports.js';
import { CAMPUS_ORG_ENABLED, ROOM } from '../sim/constants.js';
import { CampusDirectory } from './campus-directory.js';
import { authenticateCampusTicket, CampusRoom, type CampusCreateOptions, type CampusRuntime } from './campus-room.js';

export interface CampusDeps {
  service: SchoolService;
  /** Mỗi room một guard. Không có thì mọi tin được cho qua. */
  newGuard?: () => MessageGuardPort;
  log?: Logger;
  now?: () => number;
}

interface SeatRuntime extends CampusRuntime {
  /** Lần tạo room đang chạy, để yêu cầu đồng thời vào cùng instance chờ cùng một room. */
  creating: Map<string, Promise<string>>;
}

// Khoá theo chính đối tượng `deps` đã đưa vào defineCampus (không singleton toàn cục).
const runtimes = new WeakMap<CampusDeps, SeatRuntime>();

/** Định nghĩa room 'campus'. Mỗi lần gọi có một sổ instance riêng. `reserveCampusSeat` phải nhận lại đúng `deps` này. */
export function defineCampus(server: Server, deps: CampusDeps): void {
  const rt: SeatRuntime = {
    directory: new CampusDirectory(),
    service: deps.service,
    ...(deps.newGuard ? { newGuard: deps.newGuard } : {}),
    ...(deps.log ? { log: deps.log } : {}),
    now: deps.now ?? (() => Date.now()),
    creating: new Map(),
  };
  runtimes.set(deps, rt);
  server.define(
    ROOM,
    class extends CampusRoom {
      constructor() {
        super(rt);
      }

      /** Chạy trong joinById trước khi Colyseus đặt ghế; đóng gói runtime của đúng lần defineCampus này. */
      static override async onAuth(_token: string, options: unknown) {
        return authenticateCampusTicket(rt, options);
      }
    },
  );
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Listing của matchmaker mở khoá bất đồng bộ sau khi có người rời; chờ ngắn để joinById không gặp "locked". */
async function settleUnlocked(roomId: string): Promise<void> {
  for (let i = 0; i < 100; i++) {
    const listing = await matchMaker.getRoomById(roomId);
    if (!listing || !listing.locked) return;
    await sleep(5);
  }
}

/**
 * Cấp chỗ ngồi: server chọn instance theo luật domain rồi trả ticket dùng một lần.
 * Người gọi (tầng HTTP) đã xác thực `userId` và rate limit. Lỗi ném DomainError.
 */
export async function reserveCampusSeat(
  deps: CampusDeps,
  req: { userId: string; schoolId?: string; streaming?: boolean },
): Promise<{ roomId: string; ticket: string; instanceId: string }> {
  const rt = runtimes.get(deps);
  if (!rt) throw new Error('defineCampus chưa được gọi với deps này');
  const svc = deps.service;
  const { userId } = req;

  let schoolId = req.schoolId;
  if (schoolId === undefined) {
    const mine = [...svc.store.memberships.values()].filter((m) => m.userId === userId && m.roles.length > 0);
    if (mine.length === 0) throw forbidden('Chỉ thành viên trường mới vào campus');
    if (mine.length > 1) throw invalid('Cần chọn trường');
    schoolId = mine[0]!.schoolId;
  } else if (svc.rolesIn(schoolId, userId).length === 0) {
    // Không phân biệt "trường không có" với "không phải thành viên" để không lộ id trường.
    throw forbidden('Chỉ thành viên trường mới vào campus');
  }

  const entry = checkCampusEntry(svc, userId, schoolId, { streaming: !!req.streaming });
  if (entry.kind === 'organization' && !CAMPUS_ORG_ENABLED) throw forbidden('Campus tổ chức chưa mở');

  const res = rt.directory.reserve(entry, campusAffinity(svc, userId, schoolId), rt.now(), !!req.streaming);
  const { instanceId, seq, action } = res.assignment;

  try {
    let roomId: string;
    if (action === 'create') {
      const opts: CampusCreateOptions = { instanceId, schoolId, kind: entry.kind, seq, createKey: res.createKey! };
      const creating = matchMaker.createRoom(ROOM, opts).then((l) => l.roomId);
      rt.creating.set(instanceId, creating);
      creating.then(
        () => rt.creating.delete(instanceId),
        () => rt.creating.delete(instanceId),
      );
      roomId = await creating;
    } else {
      const pendingCreate = rt.creating.get(instanceId);
      const known = res.roomId ?? (pendingCreate ? await pendingCreate : undefined);
      if (known === undefined) throw conflict('Phòng campus chưa sẵn sàng, thử lại');
      roomId = known;
    }

    if (res.previous === 'held' || res.previous === 'connected') {
      // Kết nối mới nhất thắng: đuổi kết nối cũ xong mới cấp ticket, số người trong room không tăng.
      const room = matchMaker.getLocalRoomById(roomId) as CampusRoom | undefined;
      if (!room) {
        rt.directory.dispose(instanceId, roomId);
        throw conflict('Phòng campus đã đóng, thử lại');
      }
      await room.evict(userId);
    }
    if (action !== 'create') await settleUnlocked(roomId);

    deps.log?.info('campus.seat.reserved', { userId, schoolId, instanceId, roomId, action });
    return { roomId, ticket: res.ticket, instanceId };
  } catch (e) {
    rt.directory.release(instanceId, userId);
    deps.log?.error('campus.seat.failed', { userId, schoolId, instanceId, action });
    throw e;
  }
}
