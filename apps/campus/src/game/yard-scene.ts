import Phaser from 'phaser';
import { Avatar } from './avatar';
import {
  clampToWorld, frameDtSeconds, interpolate, pickTarget, pruneSamples, pushSample,
  stepByDirection, stepToward, type Sample, type Vec,
} from './predict';
import {
  CLIENT_SPEED, CorrectMsg, MOVE_HZ, PlayerRow, PublicPlayer, WORLD_H, WORLD_W,
} from '../net/protocol';

export interface YardOptions {
  /** Gửi move; scene gọi tối đa MOVE_HZ lần/giây. */
  sendMove(x: number, y: number, seq: number): void;
  isConnected(): boolean;
}

interface Remote { name: string; buf: Sample[]; avatar: Avatar | null; pos: Vec }

// Sân trường tạm: toàn bộ vẽ bằng hình khối Phaser, chưa phải art cuối.
export class YardScene extends Phaser.Scene {
  private self: Vec = { x: WORLD_W / 2, y: WORLD_H * 0.78 };
  private selfId: string | null = null;
  private selfName = '';
  private selfAvatar: Avatar | null = null;
  private target: Vec | null = null;
  private seq = 0;
  private lastSent: Vec | null = null;
  private lastFrameAt: number | null = null;
  private lastSendAt = -Infinity;
  private remotes = new Map<string, Remote>();
  private ready = false;
  private keys: { left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key; up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; a: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key; w: Phaser.Input.Keyboard.Key; s: Phaser.Input.Keyboard.Key } | null = null;
  private marker: Phaser.GameObjects.Graphics | null = null;

  constructor(private readonly opts: YardOptions) {
    super('yard');
  }

  // ---- API cho campus-game ----
  applyPlayers(rows: PlayerRow[], selfId: string) {
    this.selfId = selfId;
    const now = performance.now();
    const seen = new Set<string>();
    for (const r of rows) {
      seen.add(r.id);
      if (r.id === selfId) { this.selfName = r.displayName; continue; }
      let rem = this.remotes.get(r.id);
      if (!rem) { rem = { name: r.displayName, buf: [], avatar: null, pos: { x: r.x, y: r.y } }; this.remotes.set(r.id, rem); }
      rem.name = r.displayName;
      pushSample(rem.buf, { t: now, x: r.x, y: r.y });
    }
    for (const [id, rem] of this.remotes) {
      if (!seen.has(id)) { rem.avatar?.destroy(); this.remotes.delete(id); }
    }
  }
  /** Vào (lại) phòng: lấy vị trí từ state server làm gốc. */
  restoreFrom(rows: PlayerRow[], selfId: string) {
    const me = rows.find((r) => r.id === selfId);
    if (me) { this.self = { x: me.x, y: me.y }; this.target = null; this.lastSent = { x: me.x, y: me.y }; }
  }
  applyCorrect(c: CorrectMsg) {
    this.self = { x: c.x, y: c.y };
    this.target = null;
    this.lastSent = { x: c.x, y: c.y };
  }
  moveTo(x: number, y: number) { this.target = pickTarget({ x, y }); }
  getSelf(): { id: string; x: number; y: number } | null {
    return this.selfId ? { id: this.selfId, x: this.self.x, y: this.self.y } : null;
  }
  getPlayers(): PublicPlayer[] {
    const out: PublicPlayer[] = [];
    if (this.selfId) out.push({ id: this.selfId, displayName: this.selfName, x: this.self.x, y: this.self.y });
    for (const [id, r] of this.remotes) out.push({ id, displayName: r.name, x: r.pos.x, y: r.pos.y });
    return out;
  }
  resetNet() {
    // mất kết nối: bỏ người khác, giữ vị trí mình tới khi vào lại
    for (const r of this.remotes.values()) r.avatar?.destroy();
    this.remotes.clear();
    this.target = null;
  }

  // ---- Phaser ----
  create() {
    this.drawYard();
    this.marker = this.add.graphics().setDepth(1);
    const kb = this.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.keys = {
        left: kb.addKey(K.LEFT), right: kb.addKey(K.RIGHT), up: kb.addKey(K.UP), down: kb.addKey(K.DOWN),
        a: kb.addKey(K.A), d: kb.addKey(K.D), w: kb.addKey(K.W), s: kb.addKey(K.S),
      };
    }
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.moveTo(p.worldX, p.worldY));
    this.ready = true;
  }

  update() {
    if (!this.ready) return;
    // Không dùng `delta` của Phaser: nó làm mượt/reset về ~16 ms khi khung hình chậm (đo được
    // delta ≤ 17 ms trong khi khoảng cách thật giữa hai khung > 100 ms), làm nhân vật đi rất chậm.
    const now = performance.now();
    const dt = frameDtSeconds(this.lastFrameAt === null ? 0 : now - this.lastFrameAt);
    this.lastFrameAt = now;
    this.stepSelf(dt);
    this.sendMaybe(now);
    this.renderAll();
  }

  private stepSelf(dt: number) {
    const k = this.keys;
    let dx = 0;
    let dy = 0;
    if (k) {
      if (k.left.isDown || k.a.isDown) dx -= 1;
      if (k.right.isDown || k.d.isDown) dx += 1;
      if (k.up.isDown || k.w.isDown) dy -= 1;
      if (k.down.isDown || k.s.isDown) dy += 1;
    }
    if (dx !== 0 || dy !== 0) {
      this.target = null;
      this.self = clampToWorld(stepByDirection(this.self, dx, dy, CLIENT_SPEED, dt));
    } else if (this.target) {
      const r = stepToward(this.self, this.target, CLIENT_SPEED, dt);
      this.self = r.pos;
      if (r.arrived) this.target = null;
    }
  }

  // Theo đồng hồ thật (performance.now), ≤ MOVE_HZ. Khung bị giật thì gửi một lần với vị trí
  // hiện tại, không bù dồn.
  private sendMaybe(now: number) {
    if (now - this.lastSendAt < 1000 / MOVE_HZ) return;
    this.lastSendAt = now;
    if (!this.opts.isConnected()) return;
    const ls = this.lastSent;
    if (ls && ls.x === this.self.x && ls.y === this.self.y) return;
    this.lastSent = { x: this.self.x, y: this.self.y };
    this.opts.sendMove(this.self.x, this.self.y, ++this.seq);
  }

  private renderAll() {
    const now = performance.now();
    if (this.selfId) {
      if (!this.selfAvatar) this.selfAvatar = new Avatar(this, this.selfId, this.selfName, this.self.x, this.self.y);
      this.selfAvatar.setName(this.selfName);
      this.selfAvatar.setPos(this.self.x, this.self.y);
      this.selfAvatar.setDepth(10 + this.self.y / 1000);
    }
    for (const [id, r] of this.remotes) {
      pruneSamples(r.buf, now);
      const p = interpolate(r.buf, now);
      if (!p) continue;
      r.pos = p;
      if (!r.avatar) r.avatar = new Avatar(this, id, r.name, p.x, p.y);
      r.avatar.setName(r.name);
      r.avatar.setPos(p.x, p.y);
      r.avatar.setDepth(10 + p.y / 1000);
    }
    const m = this.marker;
    if (m) {
      m.clear();
      if (this.target) {
        m.lineStyle(2, 0xffffff, 0.8);
        m.strokeCircle(this.target.x, this.target.y, 8);
      }
    }
  }

  // Nền tạm: cỏ, vòng cây, nhà trường + cửa, lối đi.
  private drawYard() {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x6bbf59, 1).fillRect(0, 0, WORLD_W, WORLD_H);
    g.fillStyle(0x62b351, 1);
    for (let x = 0; x < WORLD_W; x += 160) for (let y = (x / 160) % 2 ? 0 : 80; y < WORLD_H; y += 160) g.fillRect(x, y, 80, 80);
    // lối đi
    g.fillStyle(0xe2cf9c, 1);
    g.fillRect(600, 250, 80, 470); // từ cửa xuống
    g.fillRect(140, 540, 1000, 70); // ngang
    // nhà trường
    g.fillStyle(0xd96c5b, 1).fillRect(420, 70, 440, 180);
    g.fillStyle(0xa84a3d, 1).fillRect(400, 50, 480, 30);
    g.fillStyle(0xbfe3f5, 1);
    for (const x of [450, 520, 710, 780]) g.fillRect(x, 120, 50, 50);
    g.fillStyle(0x7a4a2b, 1).fillRect(610, 160, 60, 90); // cửa
    g.fillStyle(0xf5d76e, 1).fillCircle(660, 210, 4);
    // vòng cây
    const tree = (cx: number, cy: number, r: number) => {
      g.fillStyle(0x6e4b2a, 1).fillRect(cx - 5, cy, 10, r * 0.7);
      g.fillStyle(0x2f7d3a, 1).fillCircle(cx, cy - 4, r);
      g.fillStyle(0x3f9a4a, 1).fillCircle(cx - r * 0.3, cy - r * 0.4, r * 0.5);
    };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      tree(200 + Math.cos(a) * 90, 300 + Math.sin(a) * 90, 24);
      tree(1060 + Math.cos(a) * 90, 300 + Math.sin(a) * 90, 24);
    }
    tree(100, 650, 30);
    tree(1180, 650, 30);
  }
}
