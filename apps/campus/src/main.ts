import { mountCampus, type CampusHandle } from './game/campus-game';
import { DEFAULT_PORT, type CampusState } from './net/protocol';

declare global {
  interface Window {
    __campus: {
      state(): CampusState;
      moveTo(x: number, y: number): void;
      sendRaw(type: string, payload: unknown): void;
      disconnectHard(): void;
      mount(): void;
      unmount(): void;
    };
  }
}

const q = new URLSearchParams(location.search);
const name = (q.get('name') || '').trim() || 'Khách';
const server = q.get('server') || `ws://${location.hostname}:${DEFAULT_PORT}`;
const harness = q.get('harness') === '1';

let handle: CampusHandle | null = null;

const idle: CampusState = { status: 'connecting', connected: false, self: null, players: [], fps: 0, rtt: null };

window.__campus = {
  state: () => handle?.state() ?? idle,
  moveTo: (x, y) => handle?.moveTo(x, y),
  sendRaw: (type, payload) => handle?.sendRaw(type, payload),
  disconnectHard: () => handle?.disconnectHard(),
  mount() {
    if (handle) return;
    const el = document.getElementById('game');
    if (el) handle = mountCampus(el, { name, server });
  },
  unmount() {
    handle?.destroy();
    handle = null;
  },
};

if (!harness) window.__campus.mount();
