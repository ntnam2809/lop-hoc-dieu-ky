import Phaser from 'phaser';
import { createNet, type Net } from '../net/client';
import { CampusState, STATUS_LABEL, Status, WORLD_H, WORLD_W } from '../net/protocol';
import { YardScene } from './yard-scene';

export interface CampusOptions { name: string; server: string }

export interface CampusHandle {
  destroy(): void;
  state(): CampusState;
  moveTo(x: number, y: number): void;
  sendRaw(type: string, payload: unknown): void;
  disconnectHard(): void;
}

export function mountCampus(el: HTMLElement, opts: CampusOptions): CampusHandle {
  let status: Status = 'connecting';
  let destroyed = false;
  let net: Net | null = null;

  const label = document.createElement('div');
  label.style.cssText =
    'position:absolute;top:12px;left:50%;transform:translateX(-50%);padding:6px 14px;border-radius:14px;' +
    'background:rgba(0,0,0,.65);color:#fff;font:15px system-ui,sans-serif;pointer-events:none;z-index:5;display:none';
  el.appendChild(label);
  const showStatus = (s: Status) => {
    status = s;
    const t = STATUS_LABEL[s];
    label.textContent = t ?? '';
    label.style.display = t ? 'block' : 'none';
  };
  showStatus('connecting');

  const scene = new YardScene({
    sendMove: (x, y, seq) => net?.sendMove(x, y, seq),
    isConnected: () => status === 'connected',
  });

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: el,
    width: WORLD_W,
    height: WORLD_H,
    backgroundColor: '#000000',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { touch: true },
    scene,
  });

  let pendingRestore = false;
  net = createNet({
    server: opts.server,
    name: opts.name,
    onStatus: (s) => {
      if (destroyed) return;
      showStatus(s);
      if (s !== 'connected') scene.resetNet();
    },
    onJoined: () => { pendingRestore = true; },
    onPlayers: (rows, selfId) => {
      if (destroyed) return;
      if (pendingRestore && rows.some((r) => r.id === selfId)) {
        pendingRestore = false;
        scene.restoreFrom(rows, selfId);
      }
      scene.applyPlayers(rows, selfId);
    },
    onCorrect: (c) => { if (!destroyed) scene.applyCorrect(c); },
  });

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      net?.destroy();
      net = null;
      game.destroy(true);
      label.remove();
    },
    state() {
      return {
        status,
        connected: status === 'connected',
        self: status === 'connected' ? scene.getSelf() : null,
        players: status === 'connected' ? scene.getPlayers() : [],
        fps: Math.round(game.loop.actualFps * 10) / 10,
        rtt: net?.rtt() ?? null,
      };
    },
    moveTo: (x, y) => scene.moveTo(x, y),
    sendRaw: (type, payload) => net?.sendRaw(type, payload),
    disconnectHard: () => net?.disconnectHard(),
  };
}
