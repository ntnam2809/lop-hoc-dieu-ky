import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { Client, type Room } from '@colyseus/sdk';
import { SchoolService, createMemoryStore, type Id } from '@lhdk/domain';
import type { GuardVerdict, Logger } from '../../src/ports.js';
import { defineCampus, reserveCampusSeat, type CampusDeps } from '../../src/rooms/campus-seat.js';
import { seedDevCampus } from '../../src/rooms/campus-dev-seed.js';

/** Guard giả: ghi lại mọi lần gọi và trả verdict do test lập trình. */
export interface FakeGuard {
  verdict: (clientId: string) => GuardVerdict;
  checked: string[];
  forgotten: string[];
}

export interface CampusTestServer {
  url: string;
  service: SchoolService;
  deps: CampusDeps;
  guard: FakeGuard;
  logs: Array<{ event: string; fields?: Record<string, string | number | boolean> }>;
  idOf(label: string): Id;
  seat(label: string, extra?: { schoolId?: string; streaming?: boolean }): ReturnType<typeof reserveCampusSeat>;
  seatFor(userId: Id, extra?: { schoolId?: string; streaming?: boolean }): ReturnType<typeof reserveCampusSeat>;
  /** Xin ghế rồi joinById bằng ticket. `options` được gộp vào (vd name giả mạo). */
  join(label: string, options?: Record<string, unknown>): Promise<{ room: Room; roomId: string; ticket: string }>;
  /** Ghi nhận room tạo ngoài `join` (vd reconnect) để `stop` rời gọn. */
  track(room: Room): Room;
  stop(): Promise<void>;
}

export const wait = async (cond: () => boolean, ms = 3000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('hết giờ chờ');
    await new Promise((r) => setTimeout(r, 10));
  }
};

export const players = (r: Room) => (r.state as any)?.players;

export async function startCampusServer(): Promise<CampusTestServer> {
  // Mỗi Server của Colyseus gắn thêm listener process; test dựng nhiều server tuần tự trong một tiến trình.
  process.setMaxListeners(100);
  const service = new SchoolService({ store: createMemoryStore() });
  const labels = new Map<string, Id>();
  await seedDevCampus({
    service,
    flush: async () => {},
    devUserId: (l) => labels.get(l),
    linkDevIdentity: (l, id) => void labels.set(l, id),
  });

  const guard: FakeGuard = { verdict: () => 'ok', checked: [], forgotten: [] };
  const logs: CampusTestServer['logs'] = [];
  const log: Logger = {
    info: (event, fields) => void logs.push({ event, ...(fields ? { fields } : {}) }),
    error: (event, fields) => void logs.push({ event, ...(fields ? { fields } : {}) }),
  };
  const deps: CampusDeps = {
    service,
    log,
    newGuard: () => ({
      check: (id) => {
        guard.checked.push(id);
        return guard.verdict(id);
      },
      forget: (id) => void guard.forgotten.push(id),
    }),
  };

  const http = createServer();
  const server = new Server({ transport: new WebSocketTransport({ server: http }) });
  defineCampus(server, deps);
  await server.listen(0);
  const url = `ws://localhost:${(http.address() as AddressInfo).port}`;
  const open: Room[] = [];

  const idOf = (label: string) => {
    const id = labels.get(label);
    if (!id) throw new Error(`không có nhãn ${label}`);
    return id;
  };
  const seatFor: CampusTestServer['seatFor'] = (userId, extra = {}) => reserveCampusSeat(deps, { userId, ...extra });

  return {
    url,
    service,
    deps,
    guard,
    logs,
    idOf,
    seatFor,
    seat: (label, extra) => seatFor(idOf(label), extra),
    async join(label, options = {}) {
      const { roomId, ticket } = await seatFor(idOf(label));
      const room = await new Client(url).joinById(roomId, { ...options, ticket });
      open.push(room);
      return { room, roomId, ticket };
    },
    track(room) {
      open.push(room);
      return room;
    },
    async stop() {
      await Promise.race([Promise.allSettled(open.map((r) => r.leave())), new Promise((r) => setTimeout(r, 2000))]);
      await server.gracefullyShutdown(false);
    },
  };
}
