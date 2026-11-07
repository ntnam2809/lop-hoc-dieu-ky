// Xin ghế vào campus qua HTTP (POST /campus/seat). Không lưu, không log token/ticket.
export type SeatResult =
  | { ok: true; roomId: string; ticket: string }
  | { ok: false; kind: 'denied' | 'busy' | 'network'; status?: number };

export interface SeatRequesterOptions {
  /** ws://host:port hoặc wss://host:port (cùng host với HTTP). */
  server: string;
  getToken(): Promise<string>;
  schoolId?: string;
  streaming?: boolean;
}

const TIMEOUT_MS = 5000;

export function seatUrl(server: string): string {
  const u = new URL(server);
  u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:';
  u.pathname = '/campus/seat';
  u.search = '';
  u.hash = '';
  return u.toString();
}

export function createSeatRequester(opts: SeatRequesterOptions): () => Promise<SeatResult> {
  return async () => {
    let token: string;
    try {
      token = await opts.getToken();
    } catch {
      return { ok: false, kind: 'network' }; // lấy token lỗi (mạng/đăng nhập tạm): cho thử lại theo luồng waking
    }
    const body: { schoolId?: string; streaming?: boolean } = {};
    if (opts.schoolId !== undefined) body.schoolId = opts.schoolId;
    if (opts.streaming !== undefined) body.streaming = opts.streaming;
    let res: Response;
    try {
      res = await fetch(seatUrl(opts.server), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return { ok: false, kind: 'network' };
    }
    const status = res.status;
    if (status === 200) {
      try {
        const j = (await res.json()) as { roomId?: unknown; ticket?: unknown };
        if (typeof j.roomId === 'string' && typeof j.ticket === 'string') {
          return { ok: true, roomId: j.roomId, ticket: j.ticket };
        }
      } catch { /* body hỏng */ }
      return { ok: false, kind: 'network', status };
    }
    if (status === 400 || status === 401 || status === 403 || status === 404) return { ok: false, kind: 'denied', status };
    if (status === 409 || status === 429) return { ok: false, kind: 'busy', status }; // 429: QUOTA hoặc RATE_LIMITED
    return { ok: false, kind: 'network', status };
  };
}
