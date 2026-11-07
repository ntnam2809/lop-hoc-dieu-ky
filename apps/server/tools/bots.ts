// Dùng: tsx tools/bots.ts --n 27 --url ws://localhost:2567 --seconds 60
// Cần server dev (AUTH_MODE=dev, đã seed u01..u30). Bot thứ i dùng nhãn u03.. (tối đa u29 → 27 bot).
import { Client, type Room } from '@colyseus/sdk';
import { MAX_SPEED, WORLD } from '../src/sim/constants.js';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : def;
}
const MAX_BOTS = 27; // u03..u29: người lớn cùng trường play (u01/u02 để người thật thử)
const N_REQ = Number(arg('n', '30'));
const N = Math.min(N_REQ, MAX_BOTS);
if (N < N_REQ) console.log(`bots: chỉ có nhãn dev cho ${MAX_BOTS} bot, giảm --n từ ${N_REQ} xuống ${N}`);
const URL = arg('url', 'ws://localhost:2567');
const SECONDS = Number(arg('seconds', '60'));
const TICK_MS = 100;
const STEP = MAX_SPEED * 0.9 * (TICK_MS / 1000);

const rooms: Room[] = [];
const timers: NodeJS.Timeout[] = [];
let corrections = 0;
let failed = 0;

/** POST /campus/seat với token dev; ticket chỉ nằm trong bộ nhớ, không log. */
async function requestSeat(label: string): Promise<{ roomId: string; ticket: string }> {
  const u = new globalThis.URL(URL);
  u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:';
  u.pathname = '/campus/seat';
  u.search = '';
  const res = await fetch(u, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer dev:${label}` },
    body: '{}',
  });
  if (res.status !== 200) throw new Error(`${label}: xin ghế thất bại (HTTP ${res.status})`);
  const j = (await res.json()) as { roomId?: unknown; ticket?: unknown };
  if (typeof j.roomId !== 'string' || typeof j.ticket !== 'string') throw new Error(`${label}: phản hồi ghế hỏng`);
  return { roomId: j.roomId, ticket: j.ticket };
}

async function runBot(i: number) {
  const label = `u${String(i + 3).padStart(2, '0')}`;
  const seat = await requestSeat(label);
  const room = await new Client(URL).joinById(seat.roomId, { ticket: seat.ticket });
  rooms.push(room);
  let x = WORLD.w / 2;
  let y = WORLD.h / 2;
  let seq = 0;
  let tx = x;
  let ty = y;
  let nextTarget = 0;
  room.onMessage('correct', (m: { x: number; y: number }) => {
    corrections++;
    x = m.x;
    y = m.y;
  });
  room.onMessage('*', () => {});
  // Vị trí thật do server đặt; đồng bộ lần đầu qua state.
  room.onStateChange.once(() => {
    const me = (room.state as any).players.get(room.sessionId);
    if (me) {
      x = me.x;
      y = me.y;
    }
  });
  timers.push(
    setInterval(() => {
      const now = Date.now();
      if (now >= nextTarget) {
        tx = Math.random() * WORLD.w;
        ty = Math.random() * WORLD.h;
        nextTarget = now + 2000 + Math.random() * 2000;
      }
      const d = Math.hypot(tx - x, ty - y);
      if (d > 1) {
        const k = Math.min(1, STEP / d);
        x += (tx - x) * k;
        y += (ty - y) * k;
      }
      room.send('move', { x, y, seq: ++seq });
    }, TICK_MS),
  );
}

async function shutdown() {
  timers.forEach(clearInterval);
  await Promise.allSettled(rooms.map((r) => r.leave()));
  console.log(`bots: ${rooms.length}/${N} vào được, ${failed} lỗi, ${corrections} correct`);
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const results = await Promise.allSettled(Array.from({ length: N }, (_, i) => runBot(i)));
for (const r of results) {
  if (r.status === 'rejected') {
    failed++;
    console.log('bot lỗi:', (r.reason as Error)?.message ?? r.reason);
  }
}
console.log(`bots: ${rooms.length}/${N} đã vào, chạy ${SECONDS}s`);
setTimeout(shutdown, SECONDS * 1000);
