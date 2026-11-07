// Scene đi dạo offline: một người chơi + vài bạn NPC đi lang thang. Không mạng, không lưu dữ liệu.
import Phaser from 'phaser';
import { MAPS, type MapDef, type MapId } from './maps';
import { facing, randomFreePoint, rng, stepDirection, stepTarget, type Vec } from './walk';
import { frameDtSeconds } from '../game/predict';

export const PLAYER_SPEED = 200; // px/s
const NPC_SPEED = 70;
const R = 14; // bán kính va chạm ở chân

interface Look { shirt: number; hair: number; skin: number }

class Kid {
  readonly box: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Container;
  private face: 'left' | 'right' = 'right';
  private t = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, name: string, look: Look, isSelf: boolean) {
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.18).fillEllipse(0, 0, 34, 12);
    const b = scene.add.graphics();
    b.fillStyle(0x37474f, 1).fillRoundedRect(-9, -14, 7, 14, 3).fillRoundedRect(2, -14, 7, 14, 3); // chân
    b.fillStyle(look.shirt, 1).fillRoundedRect(-13, -38, 26, 28, 9); // áo
    b.fillStyle(look.skin, 1).fillCircle(0, -52, 15); // đầu
    b.fillStyle(look.hair, 1).fillEllipse(0, -61, 32, 16).fillCircle(-12, -54, 5);
    b.fillStyle(0x263238, 1).fillCircle(5, -51, 2.2).fillCircle(11, -51, 2.2); // mắt nhìn sang phải
    b.fillStyle(0xf48fb1, 0.8).fillCircle(9, -45, 3);
    this.body = scene.add.container(0, 0, [b]);
    const label = scene.add.text(0, -74, name, {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', fontStyle: 'bold',
      color: isSelf ? '#fff59d' : '#ffffff', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5, 1);
    const parts: Phaser.GameObjects.GameObject[] = [g, this.body, label];
    if (isSelf) {
      const ring = scene.add.graphics();
      ring.lineStyle(3, 0xfff59d, 0.9).strokeEllipse(0, 0, 40, 16);
      parts.splice(1, 0, ring);
    }
    this.box = scene.add.container(x, y, parts);
  }

  place(p: Vec, prev: Vec, dt: number) {
    const dx = p.x - prev.x;
    const dy = p.y - prev.y;
    const moving = Math.hypot(dx, dy) > 0.05;
    this.face = facing(dx, dy, this.face);
    this.t = moving ? this.t + dt * 14 : 0;
    this.body.setScale(this.face === 'left' ? -1 : 1, 1);
    this.body.y = moving ? -Math.abs(Math.sin(this.t)) * 3 : 0;
    this.box.setPosition(p.x, p.y).setDepth(10 + p.y / 1000);
  }
}

interface Npc { name: string; pos: Vec; target: Vec | null; wait: number; kid: Kid }

const NPC_NAMES = ['Bông', 'Bin', 'Na', 'Tí', 'Mít'];
const LOOKS: Look[] = [
  { shirt: 0xef5350, hair: 0x4e342e, skin: 0xffe0bd },
  { shirt: 0x42a5f5, hair: 0x212121, skin: 0xf1c27d },
  { shirt: 0x66bb6a, hair: 0x6d4c41, skin: 0xffdbac },
  { shirt: 0xab47bc, hair: 0x3e2723, skin: 0xe0ac69 },
  { shirt: 0xffa726, hair: 0x212121, skin: 0xffe0bd },
  { shirt: 0x26c6da, hair: 0x5d4037, skin: 0xf1c27d },
];

export interface DemoState { map: MapId; self: Vec; target: Vec | null; npcs: { name: string; x: number; y: number }[] }

export class WalkScene extends Phaser.Scene {
  private map: MapDef = MAPS.campus;
  private self: Vec = { ...MAPS.campus.spawn };
  private target: Vec | null = null;
  private me: Kid | null = null;
  private npcs: Npc[] = [];
  private marker: Phaser.GameObjects.Graphics | null = null;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private lastFrameAt: number | null = null;
  private rand = rng(1);
  /** Hướng từ cần điều khiển trên màn hình cảm ứng (−1..1). */
  joy: Vec = { x: 0, y: 0 };
  /** Đã dựng xong bản đồ hiện tại. */
  isReady = false;

  constructor() { super('walk'); }

  init(data: { mapId?: MapId }) {
    this.map = MAPS[data?.mapId ?? 'campus'];
    this.self = { ...this.map.spawn };
    this.target = null;
    this.npcs = [];
    this.me = null;
    this.lastFrameAt = null;
    this.isReady = false;
    this.rand = rng(this.map.id.length * 7919);
  }

  create() {
    const g = this.add.graphics().setDepth(0);
    this.map.draw(g);
    for (const l of this.map.labels) {
      this.add.text(l.x, l.y, l.text, {
        fontFamily: 'system-ui, sans-serif', fontSize: '15px', fontStyle: 'bold',
        color: '#3e2723', backgroundColor: 'rgba(255,255,255,0.78)', padding: { x: 8, y: 3 },
      }).setOrigin(0.5, 0.5).setDepth(5);
    }
    this.marker = this.add.graphics().setDepth(2);
    const kb = this.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.keys = {
        left: kb.addKey(K.LEFT), right: kb.addKey(K.RIGHT), up: kb.addKey(K.UP), down: kb.addKey(K.DOWN),
        a: kb.addKey(K.A), d: kb.addKey(K.D), w: kb.addKey(K.W), s: kb.addKey(K.S),
      };
    }
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.moveTo(p.worldX, p.worldY));
    this.me = new Kid(this, this.self.x, this.self.y, 'Bạn', LOOKS[5], true);
    const n = this.map.id === 'campus' ? 4 : 5;
    for (let i = 0; i < n; i++) {
      const p = randomFreePoint(this.rand, this.map.npcArea, this.map.obstacles, R, this.map.bounds);
      if (!p) continue;
      const name = NPC_NAMES[i % NPC_NAMES.length];
      this.npcs.push({ name, pos: p, target: null, wait: this.rand() * 2, kid: new Kid(this, p.x, p.y, name, LOOKS[i % 5], false) });
    }
    this.isReady = true;
  }

  moveTo(x: number, y: number) {
    this.target = { x: Math.max(R, Math.min(this.map.bounds.w - R, x)), y: Math.max(R, Math.min(this.map.bounds.h - R, y)) };
  }

  state(): DemoState {
    return {
      map: this.map.id,
      self: { ...this.self },
      target: this.target ? { ...this.target } : null,
      npcs: this.npcs.map((n) => ({ name: n.name, x: n.pos.x, y: n.pos.y })),
    };
  }

  update() {
    const now = performance.now();
    const dt = frameDtSeconds(this.lastFrameAt === null ? 0 : now - this.lastFrameAt);
    this.lastFrameAt = now;
    const m = this.map;
    const prev = this.self;

    const k = this.keys;
    let dx = this.joy.x;
    let dy = this.joy.y;
    if (k.left?.isDown || k.a?.isDown) dx -= 1;
    if (k.right?.isDown || k.d?.isDown) dx += 1;
    if (k.up?.isDown || k.w?.isDown) dy -= 1;
    if (k.down?.isDown || k.s?.isDown) dy += 1;
    if (Math.hypot(dx, dy) > 0.15) {
      this.target = null;
      this.self = stepDirection(this.self, dx, dy, PLAYER_SPEED, dt, m.obstacles, R, m.bounds);
    } else if (this.target) {
      const r = stepTarget(this.self, this.target, PLAYER_SPEED, dt, m.obstacles, R, m.bounds);
      this.self = r.pos;
      if (r.done) this.target = null;
    }
    this.me?.place(this.self, prev, dt);

    for (const n of this.npcs) {
      const before = n.pos;
      if (n.wait > 0) n.wait -= dt;
      else if (!n.target) n.target = randomFreePoint(this.rand, m.npcArea, m.obstacles, R, m.bounds);
      else {
        const r = stepTarget(n.pos, n.target, NPC_SPEED, dt, m.obstacles, R, m.bounds);
        n.pos = r.pos;
        if (r.done) { n.target = null; n.wait = 1 + this.rand() * 3; }
      }
      n.kid.place(n.pos, before, dt);
    }

    const mk = this.marker;
    if (mk) {
      mk.clear();
      if (this.target) mk.lineStyle(3, 0xffffff, 0.9).strokeEllipse(this.target.x, this.target.y, 26, 12);
    }
  }
}
