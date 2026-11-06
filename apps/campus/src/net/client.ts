import { Client, type Room } from '@colyseus/sdk';
import { CorrectMsg, PlayerRow, ROOM, Status, TOKEN_KEY } from './protocol';
import { retryDelay } from './retry';

export interface NetOptions {
  server: string; // ws://host:port
  name: string;
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
    r.onDrop(() => { if (room === r && !destroyed) setStatus('reconnecting'); });
    r.onReconnect(() => {
      if (room !== r || destroyed) return;
      saveToken(r); // token đổi sau mỗi lần nối lại
      setStatus('connected');
      opts.onJoined(r.sessionId);
      push();
    });
    r.onLeave(() => {
      // SDK báo hết hạn / token bị từ chối / bị đóng hẳn: join mới, không treo.
      if (destroyed || room !== r) return;
      room = null;
      stopPing();
      clearToken();
      void freshJoin();
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

  async function tryJoin(): Promise<boolean> {
    try {
      // Room đầy (20) thì joinOrCreate tự mở room thứ hai = instance phụ (ADR-0008);
      // spike không có UI chọn instance, client chỉ thấy người trong room của mình.
      const r = await client.joinOrCreate(ROOM, { name: opts.name });
      if (destroyed) { void r.leave(); return false; }
      adopt(r);
      return true;
    } catch {
      return false;
    }
  }

  async function wakingFlow() {
    const id = ++flowId;
    setStatus('waking');
    const t0 = performance.now();
    for (;;) {
      const d = retryDelay('waking', performance.now() - t0);
      if (d === null) { if (id === flowId && !destroyed) setStatus('failed'); return; }
      try { await fetch(healthUrl(opts.server), { mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(5000) }); } catch { /* đang ngủ */ }
      if (destroyed || id !== flowId) return;
      if (await tryJoin()) return;
      if (destroyed || id !== flowId) return;
      await sleep(d);
      if (destroyed || id !== flowId) return;
    }
  }

  async function freshJoin() {
    const id = ++flowId;
    setStatus('connecting');
    if (await tryJoin()) return;
    if (!destroyed && id === flowId) await wakingFlow();
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
    await freshJoin();
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
