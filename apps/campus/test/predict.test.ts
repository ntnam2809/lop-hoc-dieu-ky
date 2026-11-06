import { describe, expect, it } from 'vitest';
import {
  clampToWorld, hashHue, interpolate, limitStep, pickTarget, pruneSamples, pushSample,
  stepByDirection, stepToward, type Sample,
} from '../src/game/predict';
import { CLIENT_SPEED, SERVER_MAX_SPEED } from '../src/net/protocol';

describe('nội suy', () => {
  const buf: Sample[] = [{ t: 1000, x: 0, y: 0 }, { t: 1100, x: 100, y: 50 }];
  it('ở giữa hai mẫu', () => {
    expect(interpolate(buf, 1150)).toEqual({ x: 50, y: 25 });
  });
  it('trước mẫu đầu / sau mẫu cuối: không ngoại suy', () => {
    expect(interpolate(buf, 900)).toEqual({ x: 0, y: 0 });
    expect(interpolate(buf, 5000)).toEqual({ x: 100, y: 50 });
  });
  it('đệm rỗng → null', () => {
    expect(interpolate([], 10)).toBeNull();
  });
  it('pushSample gộp mẫu đứng yên và giới hạn độ dài', () => {
    const b: Sample[] = [];
    pushSample(b, { t: 0, x: 1, y: 1 });
    pushSample(b, { t: 50, x: 1, y: 1 });
    pushSample(b, { t: 100, x: 1, y: 1 });
    expect(b).toHaveLength(2);
    const c: Sample[] = [];
    for (let i = 0; i < 100; i++) pushSample(c, { t: i, x: i, y: 0 }, 10);
    expect(c).toHaveLength(10);
  });
  it('pruneSamples giữ mốc trước renderT', () => {
    const b: Sample[] = [{ t: 0, x: 0, y: 0 }, { t: 100, x: 1, y: 0 }, { t: 200, x: 2, y: 0 }, { t: 300, x: 3, y: 0 }];
    pruneSamples(b, 350);
    expect(b[0]!.t).toBe(200);
  });
});

describe('giới hạn bước', () => {
  it('không vượt maxDist', () => {
    const p = limitStep({ x: 0, y: 0 }, { x: 300, y: 400 }, 100);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(100);
    expect(p).toEqual({ x: 60, y: 80 });
  });
  it('đích gần hơn thì tới đúng đích', () => {
    expect(limitStep({ x: 0, y: 0 }, { x: 3, y: 4 }, 100)).toEqual({ x: 3, y: 4 });
  });
  it('tốc độ client dưới trần server', () => {
    expect(CLIENT_SPEED).toBeLessThan(SERVER_MAX_SPEED);
    const { pos } = stepToward({ x: 100, y: 100 }, { x: 1000, y: 100 }, CLIENT_SPEED, 0.1);
    expect(pos.x - 100).toBeCloseTo(20);
  });
  it('stepToward báo đã tới', () => {
    const r = stepToward({ x: 0, y: 0 }, { x: 5, y: 0 }, CLIENT_SPEED, 1);
    expect(r.arrived).toBe(true);
  });
  it('đi chéo không nhanh hơn', () => {
    const p = stepByDirection({ x: 0, y: 0 }, 1, 1, 200, 1);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(200);
    expect(stepByDirection({ x: 5, y: 5 }, 0, 0, 200, 1)).toEqual({ x: 5, y: 5 });
  });
});

describe('chọn đích bằng chạm', () => {
  it('trong khung giữ nguyên', () => {
    expect(pickTarget({ x: 640, y: 360 })).toEqual({ x: 640, y: 360 });
  });
  it('ngoài khung bị kẹp', () => {
    const t = pickTarget({ x: -50, y: 9999 })!;
    expect(t.x).toBeGreaterThanOrEqual(0);
    expect(t.y).toBeLessThanOrEqual(720);
    expect(clampToWorld({ x: 2000, y: -3 }).x).toBeLessThanOrEqual(1280);
  });
  it('không hợp lệ → null', () => {
    expect(pickTarget({ x: NaN, y: 1 })).toBeNull();
  });
  it('hash màu ổn định', () => {
    expect(hashHue('abc')).toBe(hashHue('abc'));
    expect(hashHue('abc')).toBeGreaterThanOrEqual(0);
    expect(hashHue('abc')).toBeLessThan(360);
  });
});
