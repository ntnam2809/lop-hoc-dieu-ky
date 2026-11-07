import { describe, expect, it } from 'vitest';
import { blocked, moveWithCollision, randomFreePoint, rng, stepDirection, stepTarget, type Rect } from '../src/demo/walk';
import { MAP_ORDER, MAPS, isMapId } from '../src/demo/maps';

const B = { w: 400, h: 300 };
const wall: Rect = { x: 200, y: 0, w: 20, h: 300 };

describe('walk — va chạm', () => {
  it('biên và vật cản tính cả bán kính', () => {
    expect(blocked({ x: 5, y: 100 }, [], 10, B)).toBe(true);
    expect(blocked({ x: 50, y: 100 }, [], 10, B)).toBe(false);
    expect(blocked({ x: 195, y: 100 }, [wall], 10, B)).toBe(true);
    expect(blocked({ x: 185, y: 100 }, [wall], 10, B)).toBe(false);
  });

  it('không xuyên tường dù bước rất dài', () => {
    const p = moveWithCollision({ x: 100, y: 100 }, 500, 0, [wall], 10, B);
    expect(p.x).toBeLessThanOrEqual(190);
    expect(p.x).toBeGreaterThan(180);
  });

  it('chạm tường chéo thì trượt theo trục còn đi được', () => {
    const p = moveWithCollision({ x: 185, y: 100 }, 20, 20, [wall], 10, B);
    expect(p.x).toBeLessThanOrEqual(190);
    expect(p.y).toBeCloseTo(120, 5);
  });

  it('đi chéo không nhanh hơn đi thẳng', () => {
    const a = stepDirection({ x: 100, y: 100 }, 1, 1, 200, 0.1, [], 10, B);
    expect(Math.hypot(a.x - 100, a.y - 100)).toBeCloseTo(20, 5);
  });

  it('đi tới đích thì xong; bị chặn thì cũng xong, không kẹt mãi', () => {
    let p = { x: 50, y: 50 };
    let done = false;
    for (let i = 0; i < 100 && !done; i++) ({ pos: p, done } = stepTarget(p, { x: 150, y: 50 }, 200, 0.05, [], 10, B));
    expect(done).toBe(true);
    expect(p.x).toBeCloseTo(150, 0);
    done = false;
    for (let i = 0; i < 100 && !done; i++) ({ pos: p, done } = stepTarget(p, { x: 300, y: 50 }, 200, 0.05, [wall], 10, B));
    expect(done).toBe(true);
    expect(p.x).toBeLessThanOrEqual(190);
  });

  it('rng có hạt giống thì lặp lại được', () => {
    const a = rng(42); const b = rng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('maps — bản đồ chơi thử', () => {
  it('có sân trường và hai bố cục lớp', () => {
    expect(MAP_ORDER).toEqual(['campus', 'class-playful', 'class-traditional']);
    expect(isMapId('class-playful')).toBe(true);
    expect(isMapId('toString')).toBe(false);
  });

  for (const id of MAP_ORDER) {
    const m = MAPS[id];
    it(`${id}: điểm xuất phát trống và NPC có chỗ đứng`, () => {
      expect(blocked(m.spawn, m.obstacles, 14, m.bounds)).toBe(false);
      const r = rng(7);
      for (let i = 0; i < 5; i++) expect(randomFreePoint(r, m.npcArea, m.obstacles, 14, m.bounds)).not.toBeNull();
    });

    it(`${id}: từ chỗ xuất phát đi được ra nhiều phía (không bị nhốt)`, () => {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1]]) {
        let p = m.spawn;
        for (let i = 0; i < 20; i++) p = stepDirection(p, dx, dy, 200, 0.05, m.obstacles, 14, m.bounds);
        expect(Math.hypot(p.x - m.spawn.x, p.y - m.spawn.y)).toBeGreaterThan(50);
      }
    });
  }
});
