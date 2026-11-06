import { describe, expect, it, vi } from 'vitest';
import { assetManifestSchema, stepSchema, visualSchema } from '../../tools/schema';
import { runTimeline, substitute } from '../../src/engine/runtime/timeline';
import { pickVoice } from '../../src/engine/fx/speech';
import * as tweenMod from '../../src/engine/runtime/tween';

const calls: string[] = [];
vi.mock('../../src/engine/runtime/tween', async (orig) => {
  const m = await orig<typeof import('../../src/engine/runtime/tween')>();
  return { ...m, tween: vi.fn(async () => { calls.push('tween'); }) };
});

describe('tham số $x ở ms / to', () => {
  it('schema nhận "$delay" và "$rot", từ chối chuỗi lạ', () => {
    expect(stepSchema.safeParse({ do: 'wait', ms: '$delay' }).success).toBe(true);
    expect(stepSchema.safeParse({ do: 'rotate', target: 'a', to: '$rot' }).success).toBe(true);
    expect(stepSchema.safeParse({ do: 'scale', target: 'a', to: '$s' }).success).toBe(true);
    expect(stepSchema.safeParse({ do: 'wait', ms: 'abc' }).success).toBe(false);
    expect(stepSchema.safeParse({ do: 'rotate', target: 'a', to: 'abc' }).success).toBe(false);
  });
  it('substitute ra số khi có tham số', () => {
    expect(substitute({ do: 'wait', ms: '$delay' }, { delay: 300 })).toEqual({ do: 'wait', ms: 300 });
    expect(substitute({ do: 'rotate', target: 'a', to: '$rot' }, { rot: -20 })).toEqual({ do: 'rotate', target: 'a', to: -20 });
  });
});

describe('id asset loại liquid', () => {
  const entry = (id: string, type = 'object') => ({ assets: [{ id, type, status: 'placeholder', version: 'v01' }] });
  it('nhận liquid, vẫn từ chối loại lạ', () => {
    expect(assetManifestSchema.safeParse(entry('science_cabbage_liquid_purple_v01')).success).toBe(true);
    expect(assetManifestSchema.safeParse(entry('science_cabbage_potion_purple_v01')).success).toBe(false);
  });
});

describe('visual.layers rỗng', () => {
  const layer = { asset: 'a', x: 0, y: 0, w: 10, h: 10 };
  it('rỗng + bg hợp lệ; rỗng không bg bị từ chối; không rỗng hợp lệ', () => {
    expect(visualSchema.safeParse({ bg: 'radial-gradient(#fff,#000)', layers: [] }).success).toBe(true);
    const r = visualSchema.safeParse({ layers: [] });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('Visual rỗng');
    expect(visualSchema.safeParse({ layers: [layer] }).success).toBe(true);
  });
});

describe('show/fade không chớp', () => {
  it('opacity về 0 và apply() chạy trước khi tween bắt đầu', async () => {
    calls.length = 0;
    const e: any = { def: {}, hidden: true, opacity: 1, apply: () => calls.push(`apply:${e.opacity}`) };
    const stage: any = { entity: () => e };
    await runTimeline([{ do: 'show', target: 'x', effect: 'fade' }], { stage, templates: {}, signal: new AbortController().signal });
    expect(vi.mocked(tweenMod.tween)).toHaveBeenCalled();
    expect(calls).toEqual(['apply:0', 'tween']);
    expect(e.hidden).toBe(false);
  });
});

describe('chọn giọng đọc', () => {
  const v = (name: string, lang: string) => ({ name, lang });
  const list = [v('Alex', 'en-US'), v('Linh', 'vi-VN'), v('Google Tiếng Việt', 'VI-vn'), v('Hoai My', 'vi-VN')];
  it('chỉ giọng vi, ưu tiên google/hoai my, rồi vi đầu tiên', () => {
    expect(pickVoice(list)?.name).toBe('Google Tiếng Việt');
    expect(pickVoice([v('Alex', 'en-US'), v('Linh', 'vi-VN'), v('Nam', 'vi-VN')])?.name).toBe('Linh');
    expect(pickVoice([v('Linh', 'vi-VN'), v('Hoai My', 'vi-VN')])?.name).toBe('Hoai My');
    expect(pickVoice([v('HoaiMy', 'vi-VN')])?.name).toBe('HoaiMy');
  });
  it('?voice= ép đúng (không phân biệt hoa thường), chỉ trong giọng vi', () => {
    expect(pickVoice(list, 'LINH')?.name).toBe('Linh');
    expect(pickVoice(list, 'alex')?.name).toBe('Google Tiếng Việt');
  });
  it('null khi không có giọng vi', () => {
    expect(pickVoice([v('Alex', 'en-US')])).toBeNull();
    expect(pickVoice([], 'x')).toBeNull();
  });
});
