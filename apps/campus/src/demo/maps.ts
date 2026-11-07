// Bản đồ của bản chơi thử: sân trường + hai bố cục lớp (vui nhộn · truyền thống).
// Hình vẽ bằng khối Phaser, là art tạm. Bố cục chỉ là trình bày: không mang độ tuổi, cấp học hay quyền.
import type Phaser from 'phaser';
import type { Bounds, Rect, Vec } from './walk';

export type MapId = 'campus' | 'class-playful' | 'class-traditional';

export interface Label { x: number; y: number; text: string }

export interface MapDef {
  id: MapId;
  title: string;
  bounds: Bounds;
  spawn: Vec;
  obstacles: Rect[];
  /** Vùng NPC đi dạo. */
  npcArea: Rect;
  labels: Label[];
  draw(g: Phaser.GameObjects.Graphics): void;
}

const W = 1280;
const H = 720;

// ---------- Sân trường ----------
const campusTrees: Vec[] = [
  { x: 90, y: 110 }, { x: 200, y: 80 }, { x: 1080, y: 80 }, { x: 1190, y: 110 },
  { x: 70, y: 640 }, { x: 1210, y: 640 }, { x: 330, y: 650 }, { x: 950, y: 650 },
];

const campus: MapDef = {
  id: 'campus',
  title: 'Sân trường',
  bounds: { w: W, h: H },
  spawn: { x: 640, y: 460 },
  obstacles: [
    { x: 380, y: 40, w: 520, h: 190 }, // nhà trường
    { x: 150, y: 250, w: 16, h: 70 }, { x: 290, y: 250, w: 16, h: 70 }, // cột xích đu
    { x: 1000, y: 300, w: 140, h: 60 }, // cầu trượt
    { x: 430, y: 300, w: 120, h: 34 }, { x: 730, y: 300, w: 120, h: 34 }, // bồn hoa hai bên lối
    { x: 455, y: 560, w: 90, h: 22 }, { x: 735, y: 560, w: 90, h: 22 }, // ghế đá
    { x: 905, y: 240, w: 10, h: 40 }, // cột cờ
    ...campusTrees.map((t) => ({ x: t.x - 10, y: t.y, w: 20, h: 20 })),
  ],
  npcArea: { x: 60, y: 260, w: 1160, h: 380 },
  labels: [
    { x: 640, y: 30, text: 'Nhà trường' },
    { x: 228, y: 236, text: 'Xích đu' },
    { x: 200, y: 400, text: 'Hộp cát' },
    { x: 1070, y: 286, text: 'Cầu trượt' },
    { x: 640, y: 270, text: 'Vào lớp: chọn trong menu' },
  ],
  draw(g) {
    g.fillStyle(0x7cc96a, 1).fillRect(0, 0, W, H);
    g.fillStyle(0x72bf60, 1);
    for (let x = 0; x < W; x += 80) for (let y = (x / 80) % 2 ? 0 : 40; y < H; y += 80) g.fillRect(x, y, 40, 40);
    // hàng rào
    g.fillStyle(0xfaf3e0, 1);
    for (let x = 0; x < W; x += 24) { g.fillRect(x + 4, 0, 10, 14); g.fillRect(x + 4, H - 14, 10, 14); }
    // lối đi lát gạch
    g.fillStyle(0xead9a8, 1).fillRect(580, 230, 120, 490).fillRect(0, 470, W, 70);
    g.lineStyle(1, 0xd4bf86, 1);
    for (let y = 230; y < H; y += 24) g.lineBetween(580, y, 700, y);
    // nhà trường
    g.fillStyle(0xf2a65a, 1).fillRect(380, 70, 520, 160);
    g.fillStyle(0xd9534f, 1).fillTriangle(360, 80, 920, 80, 640, 20);
    g.fillStyle(0xbfe6f7, 1);
    for (const x of [410, 480, 550, 730, 800]) g.fillRoundedRect(x, 110, 46, 46, 6);
    g.fillStyle(0x8a5a35, 1).fillRoundedRect(610, 150, 60, 80, { tl: 30, tr: 30, bl: 0, br: 0 });
    g.fillStyle(0xffd54f, 1).fillCircle(658, 195, 4);
    g.fillStyle(0xfff3c4, 1).fillRoundedRect(560, 84, 160, 26, 8);
    // cột cờ
    g.fillStyle(0x9e9e9e, 1).fillRect(906, 150, 6, 130);
    g.fillStyle(0xe53935, 1).fillRect(912, 150, 40, 26);
    g.fillStyle(0xffeb3b, 1).fillCircle(932, 163, 6);
    // xích đu
    g.fillStyle(0x6d4c41, 1).fillRect(150, 250, 16, 70).fillRect(290, 250, 16, 70).fillRect(150, 246, 156, 10);
    g.lineStyle(2, 0x5d4037, 1).lineBetween(195, 256, 195, 300).lineBetween(260, 256, 260, 300);
    g.fillStyle(0xef5350, 1).fillRect(183, 300, 24, 8).fillRect(248, 300, 24, 8);
    // hộp cát
    g.fillStyle(0xa1887f, 1).fillRoundedRect(110, 410, 180, 110, 14);
    g.fillStyle(0xf6dfa4, 1).fillRoundedRect(120, 420, 160, 90, 10);
    g.fillStyle(0x42a5f5, 1).fillCircle(170, 450, 9);
    g.fillStyle(0xff7043, 1).fillTriangle(220, 480, 250, 480, 235, 455);
    // cầu trượt
    g.fillStyle(0x1e88e5, 1).fillRect(1000, 300, 40, 60);
    g.fillStyle(0xffca28, 1).fillTriangle(1040, 300, 1040, 360, 1150, 360);
    g.fillStyle(0x1565c0, 1).fillRect(1000, 296, 40, 8);
    // bồn hoa
    for (const x of [430, 730]) {
      g.fillStyle(0x8d6e63, 1).fillRoundedRect(x, 300, 120, 34, 10);
      for (let i = 0; i < 6; i++) {
        g.fillStyle([0xf06292, 0xffee58, 0xba68c8][i % 3], 1).fillCircle(x + 14 + i * 19, 312 + (i % 2) * 8, 7);
      }
    }
    // ghế đá
    g.fillStyle(0xb0bec5, 1).fillRoundedRect(455, 560, 90, 22, 6).fillRoundedRect(735, 560, 90, 22, 6);
    // cây
    for (const t of campusTrees) {
      g.fillStyle(0x000000, 0.15).fillEllipse(t.x, t.y + 18, 60, 16);
      g.fillStyle(0x795548, 1).fillRect(t.x - 7, t.y - 10, 14, 30);
      g.fillStyle(0x2e7d32, 1).fillCircle(t.x, t.y - 30, 34);
      g.fillStyle(0x43a047, 1).fillCircle(t.x - 12, t.y - 42, 18).fillCircle(t.x + 14, t.y - 34, 16);
    }
  },
};

// ---------- Phần chung cho lớp ----------
const WALL_H = 150;

function drawRoom(g: Phaser.GameObjects.Graphics, wall: number, floor: number, floorLine: number) {
  g.fillStyle(floor, 1).fillRect(0, WALL_H, W, H - WALL_H);
  g.lineStyle(1, floorLine, 1);
  for (let y = WALL_H; y < H; y += 40) g.lineBetween(0, y, W, y);
  g.fillStyle(wall, 1).fillRect(0, 0, W, WALL_H);
  g.fillStyle(0x000000, 0.12).fillRect(0, WALL_H - 10, W, 10);
  // cửa sổ
  g.fillStyle(0xbfe6f7, 1);
  for (const x of [60, 1110]) { g.fillRoundedRect(x, 30, 110, 80, 8); }
  g.lineStyle(4, 0xffffff, 1);
  for (const x of [60, 1110]) { g.strokeRoundedRect(x, 30, 110, 80, 8); g.lineBetween(x + 55, 30, x + 55, 110); }
  // cửa ra (vẽ thôi, đổi phòng bằng menu)
  g.fillStyle(0x8a5a35, 1).fillRect(590, H - 12, 100, 12);
}

// ---------- Lớp bố cục vui nhộn ----------
const playfulTables: Vec[] = [{ x: 300, y: 330 }, { x: 980, y: 330 }, { x: 300, y: 540 }, { x: 980, y: 540 }];

const classPlayful: MapDef = {
  id: 'class-playful',
  title: 'Lớp học — bố cục vui nhộn',
  bounds: { w: W, h: H },
  spawn: { x: 640, y: 640 },
  obstacles: [
    { x: 0, y: 0, w: W, h: WALL_H }, // tường
    { x: 520, y: 165, w: 240, h: 50 }, // bàn cô
    { x: 20, y: 300, w: 60, h: 300 }, // kệ sách
    { x: 1190, y: 420, w: 70, h: 180 }, // kệ đồ chơi
    ...playfulTables.map((t) => ({ x: t.x - 70, y: t.y - 32, w: 140, h: 64 })),
  ],
  npcArea: { x: 100, y: 240, w: 1080, h: 460 },
  labels: [
    { x: 640, y: 128, text: 'Bảng của lớp' },
    { x: 50, y: 286, text: 'Góc sách' },
    { x: 1225, y: 406, text: 'Góc đồ chơi' },
    { x: 640, y: 380, text: 'Thảm kể chuyện' },
  ],
  draw(g) {
    drawRoom(g, 0xfff1c9, 0xf3d9a4, 0xe6c88c);
    // dây cờ
    const cols = [0xef5350, 0xffca28, 0x66bb6a, 0x42a5f5, 0xab47bc];
    for (let i = 0; i < 18; i++) {
      g.fillStyle(cols[i % cols.length], 1).fillTriangle(200 + i * 48, 12, 236 + i * 48, 12, 218 + i * 48, 36);
    }
    // bảng xanh nhạt + hình vẽ
    g.fillStyle(0x4db6ac, 1).fillRoundedRect(450, 40, 380, 96, 12);
    g.fillStyle(0xffffff, 1).fillCircle(520, 88, 16);
    g.fillStyle(0xffeb3b, 1).fillCircle(760, 76, 18);
    g.fillStyle(0xff8a65, 1).fillTriangle(600, 110, 660, 110, 630, 66);
    // bàn cô
    g.fillStyle(0xa1887f, 1).fillRoundedRect(520, 165, 240, 50, 10);
    g.fillStyle(0xe57373, 1).fillCircle(560, 182, 8);
    // thảm tròn
    g.fillStyle(0x81d4fa, 1).fillEllipse(640, 440, 380, 220);
    g.fillStyle(0xfff59d, 1).fillEllipse(640, 440, 260, 140);
    g.fillStyle(0xf48fb1, 1).fillEllipse(640, 440, 120, 60);
    // bàn tròn + ghế nhỏ nhiều màu
    playfulTables.forEach((t, i) => {
      const seat = [0xef5350, 0xffca28, 0x66bb6a, 0x42a5f5];
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        g.fillStyle(seat[(k + i) % 4], 1).fillRoundedRect(t.x + Math.cos(a) * 92 - 14, t.y + Math.sin(a) * 50 - 12, 28, 24, 6);
      }
      g.fillStyle(0x000000, 0.12).fillEllipse(t.x, t.y + 8, 150, 64);
      g.fillStyle([0xffe082, 0xc5e1a5, 0xb3e5fc, 0xf8bbd0][i], 1).fillEllipse(t.x, t.y, 140, 64);
    });
    // kệ sách
    g.fillStyle(0x8d6e63, 1).fillRect(20, 300, 60, 300);
    for (let r = 0; r < 5; r++) for (let k = 0; k < 4; k++) {
      g.fillStyle([0xe53935, 0x1e88e5, 0xfdd835, 0x43a047][(r + k) % 4], 1).fillRect(26 + k * 12, 310 + r * 58, 10, 44);
    }
    // kệ đồ chơi + khối gỗ
    g.fillStyle(0x8d6e63, 1).fillRect(1190, 420, 70, 180);
    for (let k = 0; k < 6; k++) g.fillStyle([0xef5350, 0x42a5f5, 0xffca28][k % 3], 1).fillRect(1200 + (k % 2) * 28, 432 + Math.floor(k / 2) * 56, 22, 22);
    g.fillStyle(0xff7043, 1).fillCircle(1150, 640, 16);
  },
};

// ---------- Lớp bố cục truyền thống ----------
const DESK_W = 150;
const DESK_H = 40;
const deskCols = [220, 450, 680, 910];
const deskRows = [300, 410, 520];

const classTraditional: MapDef = {
  id: 'class-traditional',
  title: 'Lớp học — bố cục truyền thống',
  bounds: { w: W, h: H },
  spawn: { x: 640, y: 650 },
  obstacles: [
    { x: 0, y: 0, w: W, h: WALL_H },
    { x: 540, y: 175, w: 200, h: 50 }, // bàn giáo viên
    { x: 1180, y: 250, w: 80, h: 120 }, // tủ
    ...deskRows.flatMap((y) => deskCols.map((x) => ({ x, y, w: DESK_W, h: DESK_H }))),
  ],
  npcArea: { x: 60, y: 240, w: 1160, h: 460 },
  labels: [
    { x: 640, y: 20, text: 'Bảng' },
    { x: 640, y: 165, text: 'Bàn giáo viên' },
  ],
  draw(g) {
    drawRoom(g, 0xe8eef2, 0xd7c4a3, 0xc5b08a);
    // bảng phấn
    g.fillStyle(0x6d4c41, 1).fillRect(380, 26, 520, 110);
    g.fillStyle(0x2e5e4e, 1).fillRect(390, 34, 500, 94);
    g.lineStyle(3, 0xffffff, 0.85).lineBetween(430, 70, 520, 70).lineBetween(430, 96, 600, 96);
    g.fillStyle(0xffffff, 0.85).fillCircle(760, 80, 14);
    // bàn giáo viên
    g.fillStyle(0x795548, 1).fillRect(540, 175, 200, 50);
    g.fillStyle(0x5d4037, 1).fillRect(540, 175, 200, 8);
    g.fillStyle(0x90caf9, 1).fillRect(660, 186, 40, 24);
    // tủ
    g.fillStyle(0x8d6e63, 1).fillRect(1180, 250, 80, 120);
    g.lineStyle(2, 0x5d4037, 1).lineBetween(1220, 250, 1220, 370);
    // dãy bàn + ghế
    for (const y of deskRows) for (const x of deskCols) {
      g.fillStyle(0x000000, 0.12).fillRect(x + 4, y + 6, DESK_W, DESK_H);
      g.fillStyle(0xa1887f, 1).fillRect(x, y, DESK_W, DESK_H);
      g.fillStyle(0x8d6e63, 1).fillRect(x, y, DESK_W, 6);
      g.fillStyle(0x546e7a, 1).fillRect(x + 25, y + DESK_H + 6, 34, 12).fillRect(x + 91, y + DESK_H + 6, 34, 12);
    }
  },
};

export const MAPS: Record<MapId, MapDef> = {
  campus,
  'class-playful': classPlayful,
  'class-traditional': classTraditional,
};

export const MAP_ORDER: MapId[] = ['campus', 'class-playful', 'class-traditional'];

export function isMapId(s: string | null | undefined): s is MapId {
  return !!s && Object.prototype.hasOwnProperty.call(MAPS, s);
}
