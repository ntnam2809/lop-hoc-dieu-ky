import { Client, type Room } from '@colyseus/sdk';
import { CorrectMsg, PlayerRow, Status, TOKEN_KEY } from './protocol';
import { retryDelay } from './retry';
import type { SeatResult } from './seat';

export interface NetOptions {
  server: string; // ws://host:port
  /** Xin ghế vào campus (POST /campus/seat); xem seat.ts. */
  requestSeat: () => Promise<SeatResult>;
  onStatus(s: Status): void;
  /** Gọi mỗi lần state đổi. */
  onPlayers(rows: PlayerRow[], selfId: string): void;
  /** Vừa vào (lại) phòng: vị trí server là sự thật, cần khôi phục. */
  onJoined(selfId: string): void;
  onCorrect(c: CorrectMsg): void;
}

export interface Net {
  sendMove(x: number, y: number, seq: number): void;
  sendRaw(type: string, payload: unknown): void;
  disconnectHard(): void;
  rtt(): number | null;
  selfId(): string | null;
  destroy(): void;
}

const CLOSE_KICKED = 4029; // guard server đá
const CLOSE_REPLACED = 4409; // tài khoản mở ở nơi khác
const DROP_CLOSE = 4010; // CloseCode.MAY_TRY_RECONNECT: socket rơi bất thường, SDK báo onDrop

function healthUrl(server: string): string {
  const u = new URL(server);
  u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:';
  u.pathname = '/health';
  u.search = '';
  return u.toString();
}

export function createNet(opts: NetOptions): Net {
  const client = new Client(opts.server);
  let room: Room<any, any> | null = null;
  let destroyed = false;
  let rtt: number | null = null;
  let status: Status = 'connecting';
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let leaving = false; // pagehide: đã rời có chủ ý
  let flowId = 0; // huỷ luồng retry cũ khi bắt đầu luồng mới

  const setStatus = (s: Status) => {
    if (status === s) return;
    status = s;
    opts.onStatus(s);
  };
  const sleep = (ms: number) =>
    new Promise<void>((res) => {
      const t = setTimeout(() => { timers.delete(t); res(); }, ms);
      timers.add(t);
    });
  const saveToken = (r: Room<any, any>) => {
    try { sessionStorage.setItem(TOKEN_KEY, r.reconnectionToken); } catch { /* bỏ qua */ }
  };
  const loadToken = () => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } };
  const clearToken = () => { try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* bỏ qua */ } };

  function adopt(r: Room<any, any>) {
    if (destroyed) { void r.leave(); return; }
    room = r;
    // Mặc định SDK chỉ tự nối lại khi phòng đã sống ≥ minUptime (5 s); rớt sớm hơn thì onLeave ngay
    // và ta vào phiên mới (mất id/vị trí). Server giữ chỗ 30 s nên cho nối lại ngay từ đầu.
    r.reconnection.minUptime = 0;
    // Lần thử đầu sau ~300 ms (backoff 2^n * delay) để server kịp chạy onDrop/allowReconnection.
    r.reconnection.delay = 150;
    // Mất bất thường: dùng reconnect có sẵn của SDK (server giữ chỗ 30 s qua onDrop).
    saveToken(r);
    const push = () => {
      const rows: PlayerRow[] = [];
      r.state?.players?.forEach((p: any, key: string) => {
        rows.push({ id: p.id ?? key, displayName: String(p.displayName ?? ''), x: p.x, y: p.y, lastSeq: p.lastSeq ?? 0 });
      });
      opts.onPlayers(rows, r.sessionId);
    };
    r.onStateChange(push);
    r.onMessage('correct', (m: CorrectMsg) => opts.onCorrect(m));
    r.onDrop((code) => { console.debug(`[reconnect] drop code=${code}`); if (room === r && !destroyed) setStatus('reconnecting'); });
    r.onReconnect(() => {
      console.debug('[reconnect] ok');
      if (room !== r || destroyed) return;
      saveToken(r); // token đổi sau mỗi lần nối lại
      setStatus('connected');
      opts.onJoined(r.sessionId);
      push();
    });
    r.onLeave((code) => {
      console.debug(`[reconnect] leave code=${code}`);
      // SDK báo hết hạn / token bị từ chối / bị đóng hẳn: join mới, không treo.
      if (destroyed || room !== r) return;
      room = null;
      stopPing();
      clearToken();
      // Bị đá / mở ở nơi khác / đang rời trang: không tự vào lại.
      if (code === CLOSE_KICKED) { setStatus('denied'); return; }
      if (code === CLOSE_REPLACED) { setStatus('replaced'); return; }
      if (leaving) return;
      void joinFlow();
    });
    setStatus('connected');
    opts.onJoined(r.sessionId);
    if (r.state?.players) push();
    startPing(r);
  }

  function startPing(r: Room<any, any>) {
    stopPing();
    const tick = () => { if (room === r) r.ping((ms) => { rtt = ms; }); };
    tick();
    pingTimer = setInterval(tick, 2000);
  }
  function stopPing() {
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = null;
    rtt = null;
  }

  type JoinOutcome = 'joined' | 'denied' | 'busy' | 'network';

  async function tryJoin(): Promise<JoinOutcome> {
    const seat = await opts.requestSeat();
    if (destroyed) return 'network';
    if (!seat.ok) {
      console.debug(`[reconnect] seat failed kind=${seat.kind} status=${seat.status ?? '-'}`);
      if (seat.kind === 'denied') setStatus('denied');
      return seat.kind;
    }
    try {
      const r = await client.joinById(seat.roomId, { ticket: seat.ticket });
      if (destroyed) { void r.leave(); return 'network'; }
      adopt(r);
      return 'joined';
    } catch (e: any) {
      // Đã có ghế mà vào phòng hỏng (phòng biến mất / khoá / auth từ chối): không phải 'denied',
      // coi như bận và xin ghế mới ở lượt sau.
      console.debug(`[reconnect] joinById failed code=${e?.code ?? e?.name}`);
      return 'busy';
    }
  }

  /** Vòng thử vào: busy → thử lại theo retryDelay; network → ping /health (máy chủ ngủ) rồi thử lại. */
  async function joinFlow() {
    const id = ++flowId;
    setStatus('connecting');
    const t0 = performance.now();
    for (;;) {
      const out = await tryJoin();
      if (destroyed || id !== flowId) return;
      if (out === 'joined' || out === 'denied') return;
      const d = retryDelay('waking', performance.now() - t0);
      if (d === null) { setStatus('failed'); return; }
      setStatus(out === 'network' ? 'waking' : 'connecting');
      await sleep(d);
      if (destroyed || id !== flowId) return;
      if (out === 'network') {
        try { await fetch(healthUrl(opts.server), { mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(5000) }); } catch { /* đang ngủ */ }
        if (destroyed || id !== flowId) return;
      }
    }
  }

    // Đóng tab: rời gọn (consented) để server giải phóng ghế ngay, không giữ chỗ 30 s.
  const onPageHide = () => {
    leaving = true;
    clearToken();
    const r = room;
    if (r) void r.leave(true).catch(() => {});
  };
  // Trang khôi phục từ bfcache: kết nối cũ đã đóng, vào lại.
  const onPageShow = (e: Event) => {
    if (!(e as PageTransitionEvent).persisted || destroyed || !leaving) return;
    leaving = false;
    room = null;
    void joinFlow();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
  }

  async function start() {
    const token = loadToken();
    if (token) {
      // tải lại trang: thử vào lại chỗ cũ một lần
      try {
        const r = await client.reconnect(token);
        adopt(r);
        return;
      } catch { clearToken(); }
      if (destroyed) return;
    }
    await joinFlow();
  }
  void start();

  return {
    sendMove(x, y, seq) { if (room?.connection.isOpen) room.send('move', { x, y, seq }); },
    sendRaw(type, payload) { if (room?.connection.isOpen) room.send(type, payload); },
    disconnectHard() { room?.connection.close(DROP_CLOSE); },
    rtt: () => rtt,
    selfId: () => room?.sessionId ?? null,
    destroy() {
      destroyed = true;
      flowId++;
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', onPageHide);
        window.removeEventListener('pageshow', onPageShow);
      }
      for (const t of timers) clearTimeout(t);
      timers.clear();
      stopPing();
      const r = room;
      room = null;
      if (r) {
        r.removeAllListeners();
        void r.leave().catch(() => {});
      }
      clearToken(); // rời có chủ ý: không giữ chỗ cũ
    },
  };
}
