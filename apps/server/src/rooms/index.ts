import type { Server } from '@colyseus/core';
import type { RoomContext } from '../ports.js';
import { defineCampus, type CampusDeps } from './campus-seat.js';

/** Đăng ký mọi room. Room phiên học của classroom sẽ đăng ký thêm ở đây. */
export function registerRooms(server: Server, ctx: RoomContext): { campus: CampusDeps } {
  const campus: CampusDeps = { service: ctx.service, newGuard: ctx.newGuard, log: ctx.log, now: ctx.clock };
  defineCampus(server, campus);
  // reserveCampusSeat tra runtime theo đúng object này: không bọc lại, không sao chép.
  return { campus };
}
