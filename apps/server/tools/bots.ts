// Dùng: tsx tools/bots.ts --n 30 --url ws://localhost:2567 --seconds 60
import { Client, type Room } from '@colyseus/sdk';
import { MAX_SPEED, ROOM, WORLD } from '../src/sim/constants.js';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : def;
}
const N = Number(arg('n', '30'));
const URL = arg('url', 'ws://localhost:2567');
const SECONDS = Number(arg('seconds', '60'));
const TICK_MS = 100;
const STEP = MAX_SPEED * 0.9 * (TICK_MS / 1000);

const rooms: Room[] = [];
const timers: NodeJS.Timeout[] = [];
let corrections = 0;
let failed = 0;

async function runBot(i: number) {
  const name = `Bot-${String(i + 1).padStart(2, '0')}`;
  const room = await new Client(URL).joinOrCreate(ROOM, { name });
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
