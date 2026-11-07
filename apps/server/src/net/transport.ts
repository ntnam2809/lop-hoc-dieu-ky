import type { IncomingMessage, Server as HttpServer } from 'node:http';
import { WebSocketTransport } from '@colyseus/ws-transport';

export interface TransportOptions {
  server: HttpServer;
  maxPayloadBytes: number;
  allowedOrigins: string[];
  /** Client không phải trình duyệt (bot, công cụ) không gửi Origin. */
  allowMissingOrigin: boolean;
}

/** Transport WebSocket có giới hạn khung và kiểm Origin ở bước bắt tay (từ chối → 403). */
export function createTransport(o: TransportOptions): WebSocketTransport {
  const allowed = new Set(o.allowedOrigins);
  return new WebSocketTransport({
    server: o.server,
    maxPayload: o.maxPayloadBytes,
    verifyClient: (info: { origin: string; req: IncomingMessage }, cb: (ok: boolean, code?: number, message?: string) => void) => {
      const origin = info.req.headers.origin;
      const ok = origin === undefined ? o.allowMissingOrigin : allowed.has(origin);
      if (ok) cb(true);
      else cb(false, 403, 'Forbidden');
    },
  });
}
