// Bản chơi thử offline: đi dạo sân trường và lớp học. Không mạng, không đăng nhập, không lưu dữ liệu.
import Phaser from 'phaser';
import { MAP_ORDER, MAPS, isMapId, type MapId } from './maps';
import { WalkScene, type DemoState } from './walk-scene';

declare global {
  interface Window { __demo: { state(): DemoState | null; go(id: MapId): void; moveTo(x: number, y: number): void } }
}

const HINT: Record<MapId, string> = {
  campus: 'Khuôn viên ngoài trời',
  'class-playful': 'Bàn tròn, thảm, góc đồ chơi',
  'class-traditional': 'Dãy bàn, bảng phấn, bàn giáo viên',
};
const ICON: Record<MapId, string> = { campus: '🌳', 'class-playful': '🧸', 'class-traditional': '📚' };

const scene = new WalkScene();
const W = MAPS.campus.bounds.w;
const H = MAPS.campus.bounds.h;
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#2b3a2f',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { touch: true },
  scene: [],
});

const q = new URLSearchParams(location.search);
let current: MapId = isMapId(q.get('map')) ? (q.get('map') as MapId) : 'campus';

game.scene.add('walk', scene, true, { mapId: current });

const places = document.getElementById('places')!;
const buttons = new Map<MapId, HTMLButtonElement>();
for (const id of MAP_ORDER) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.map = id;
  b.innerHTML = `${ICON[id]} ${MAPS[id].title}<small>${HINT[id]}</small>`;
  b.addEventListener('click', () => go(id));
  places.appendChild(b);
  buttons.set(id, b);
}
const mark = () => { for (const [id, b] of buttons) b.setAttribute('aria-pressed', String(id === current)); };
mark();

function go(id: MapId) {
  current = id;
  mark();
  scene.joy = { x: 0, y: 0 };
  scene.scene.restart({ mapId: id });
  try {
    const u = new URL(location.href);
    u.searchParams.set('map', id);
    history.replaceState(null, '', u);
  } catch { /* khung nhúng có thể chặn đổi URL — bỏ qua */ }
}

const menu = document.getElementById('menu')!;
const toggle = document.getElementById('toggle')!;
const setMin = (min: boolean) => {
  menu.classList.toggle('min', min);
  toggle.textContent = min ? '+' : '–';
  toggle.setAttribute('aria-label', min ? 'Mở menu' : 'Thu gọn menu');
};
toggle.addEventListener('click', () => setMin(!menu.classList.contains('min')));
// màn nhỏ: thu gọn sẵn để không che sân
if (window.innerWidth < 700) setMin(true);

// Cần điều khiển cảm ứng: kéo núm để đi, thả ra thì dừng.
const joy = document.getElementById('joy')!;
const knob = document.getElementById('knob')!;
let joyId: number | null = null;
const setJoy = (cx: number, cy: number) => {
  const r = joy.getBoundingClientRect();
  let dx = (cx - (r.left + r.width / 2)) / (r.width / 2);
  let dy = (cy - (r.top + r.height / 2)) / (r.height / 2);
  const len = Math.hypot(dx, dy);
  if (len > 1) { dx /= len; dy /= len; }
  scene.joy = { x: dx, y: dy };
  knob.style.transform = `translate(${dx * 35}px, ${dy * 35}px)`;
};
joy.addEventListener('pointerdown', (e) => { joyId = e.pointerId; joy.setPointerCapture(e.pointerId); setJoy(e.clientX, e.clientY); e.stopPropagation(); });
joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) setJoy(e.clientX, e.clientY); });
const endJoy = (e: PointerEvent) => {
  if (e.pointerId !== joyId) return;
  joyId = null;
  scene.joy = { x: 0, y: 0 };
  knob.style.transform = '';
};
joy.addEventListener('pointerup', endJoy);
joy.addEventListener('pointercancel', endJoy);

window.__demo = {
  state: () => (scene.isReady ? scene.state() : null),
  go,
  moveTo: (x, y) => scene.moveTo(x, y),
};
