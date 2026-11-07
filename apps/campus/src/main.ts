import { mountCampus, type CampusHandle } from './game/campus-game';
import { createSeatRequester } from './net/seat';
import { DEFAULT_PORT, type CampusState } from './net/protocol';

declare global {
  interface Window {
    // Chỉ có ở bản dev / measure (TEST_HOOKS); bản production không gắn.
    __campus?: {
      state(): CampusState;
      moveTo(x: number, y: number): void;
      sendRaw(type: string, payload: unknown): void;
      disconnectHard(): void;
      mount(): void;
      unmount(): void;
    };
  }
}

// Hook test và ?server=/?harness=/?as=/?school= chỉ tồn tại ở dev và `--mode measure`.
// Bản production không đọc các tham số này (tránh link chuyển token sang server lạ) và không có token dev.
const TEST_HOOKS = import.meta.env.DEV || import.meta.env.MODE === 'measure';

const q = new URLSearchParams(location.search);
const server =
  (TEST_HOOKS && q.get('server')) || import.meta.env.VITE_SERVER_URL || `ws://${location.hostname}:${DEFAULT_PORT}`;

// Token: bản production chưa có đăng nhập (Firebase, M3) nên getToken từ chối → luồng waking, không có token dev.
let getToken: () => Promise<string> = () => Promise.reject(new Error('NO_AUTH'));
let schoolId: string | undefined;
if (TEST_HOOKS) {
  const as = q.get('as') ?? 'u01';
  if (/^[a-z0-9-]{1,32}$/.test(as)) {
    const token = `dev:${as}`;
    getToken = () => Promise.resolve(token);
  }
  schoolId = q.get('school') || undefined;
}

let handle: CampusHandle | null = null;

function mount() {
  if (handle) return;
  const el = document.getElementById('game');
  if (el) {
    const requestSeat = createSeatRequester({ server, getToken, ...(schoolId !== undefined ? { schoolId } : {}) });
    handle = mountCampus(el, { server, requestSeat });
  }
}

if (TEST_HOOKS) {
  const idle: CampusState = { status: 'connecting', connected: false, self: null, players: [], fps: 0, rtt: null };
  window.__campus = {
    state: () => handle?.state() ?? idle,
    moveTo: (x, y) => handle?.moveTo(x, y),
    sendRaw: (type, payload) => handle?.sendRaw(type, payload),
    disconnectHard: () => handle?.disconnectHard(),
    mount,
    unmount() {
      handle?.destroy();
      handle = null;
    },
  };
  if (q.get('harness') !== '1') mount();
} else {
  mount();
}
