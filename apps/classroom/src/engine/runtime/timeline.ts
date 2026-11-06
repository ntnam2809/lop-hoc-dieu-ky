import type { Point, Step, TemplateArgs, Timeline } from '../types';
import { sound } from '../fx/audio';
import { narrator } from '../fx/speech';
import { ticker, wait } from './ticker';
import { lerp, tween } from './tween';
import type { Stage } from './stage';

export interface TimelineContext {
  stage: Stage;
  templates: Record<string, Timeline>;
  signal: AbortSignal;
}

/** Thay `$ten` bằng tham số khi gọi timeline mẫu ({ do: "play", args }). */
export function substitute<T>(value: T, args: TemplateArgs): T {
  if (!Object.keys(args).length) return value;
  if (typeof value === 'string') {
    // "$x" đứng một mình → giữ nguyên kiểu (số vẫn là số, để dùng làm toạ độ).
    if (/^\$\w+$/.test(value) && value.slice(1) in args) return args[value.slice(1)] as T;
    return value.replace(/\$([a-zA-Z_]\w*)/g, (m, k: string) => (k in args ? String(args[k]) : m)) as T;
  }
  if (Array.isArray(value)) return value.map((v) => substitute(v, args)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = substitute(v, args);
    return out as T;
  }
  return value;
}

/** Ước lượng thời lượng đọc một câu (khi không có giọng đọc). */
export const readingTime = (text: string) => 900 + text.length * 55;

export async function runTimeline(steps: Timeline, ctx: TimelineContext, args: TemplateArgs = {}): Promise<void> {
  for (const raw of steps) {
    if (ctx.signal.aborted) return;
    await runStep(substitute(raw, args), ctx, args);
  }
}

async function runStep(step: Step, ctx: TimelineContext, args: TemplateArgs): Promise<void> {
  const { stage, signal } = ctx;
  const ent = (id: string) => stage.entity(id);
  switch (step.do) {
    case 'move': {
      const e = ent(step.target);
      if (!e) return;
      const from = { x: e.x, y: e.y };
      const to: Point = stage.resolvePoint(step.to, step.offset);
      const arc = step.arc ?? 0;
      await tween({
        duration: step.duration ?? 800,
        ease: step.ease ?? 'easeInOut',
        signal,
        onUpdate: (k, raw) => {
          e.x = lerp(from.x, to.x, k);
          e.y = lerp(from.y, to.y, k) - arc * 4 * raw * (1 - raw);
          e.apply();
        },
      });
      return;
    }
    case 'show': {
      const e = ent(step.target);
      if (!e) return;
      const target = e.def.scale ?? 1;
      e.hidden = false;
      if (step.effect === 'fade') {
        await tween({ duration: 450, ease: 'easeOut', signal, onUpdate: (k) => { e.opacity = k; e.apply(); } });
      } else if (step.effect === 'grow') {
        await tween({ duration: 650, ease: 'easeOut', signal, onUpdate: (k) => { e.scale = target * k; e.apply(); } });
      } else {
        sound.play('pop');
        await tween({ duration: 420, ease: 'backOut', signal, onUpdate: (k) => { e.scale = target * k; e.opacity = 1; e.apply(); } });
      }
      return;
    }
    case 'hide': {
      const e = ent(step.target);
      if (!e) return;
      const s0 = e.scale;
      if (step.effect === 'fade') {
        await tween({ duration: 400, ease: 'easeIn', signal, onUpdate: (k) => { e.opacity = 1 - k; e.apply(); } });
      } else {
        await tween({ duration: 320, ease: 'backIn', signal, onUpdate: (k) => { e.scale = s0 * (1 - k); e.apply(); } });
      }
      e.hidden = true;
      e.opacity = 1;
      e.scale = s0;
      e.apply();
      return;
    }
    case 'anim':
      ent(step.target)?.setPreset(step.preset);
      return;
    case 'emote': {
      const e = ent(step.target);
      if (!e) return;
      e.emote(step.emote, step.duration ?? 1800);
      if (step.emote === 'heart') stage.fx.burst('hearts', e.top.x, e.top.y, 0.8);
      if (step.emote === 'tear') stage.fx.burst('tears', e.x, e.y - e.h * 0.18, 1);
      if (step.emote === 'sparkle' || step.emote === 'idea') sound.play('sparkle');
      return;
    }
    case 'fx': {
      const p = stage.resolvePoint(step.at, step.offset);
      stage.fx.burst(step.fx, p.x, p.y, step.size ?? 1);
      return;
    }
    case 'say': {
      const done = stage.caption(step.text, step.target);
      const minHold = step.hold ?? readingTime(step.text);
      await Promise.all([narrator.speak(step.text, signal), wait(minHold, signal)]);
      done();
      return;
    }
    case 'wait':
      await wait(step.ms, signal);
      return;
    case 'sound':
      sound.play(step.sound);
      return;
    case 'flip': {
      const e = ent(step.target);
      if (!e) return;
      e.flip = step.value;
      e.apply();
      return;
    }
    case 'scale': {
      const e = ent(step.target);
      if (!e) return;
      const s0 = e.scale;
      await tween({ duration: step.duration ?? 500, ease: step.ease ?? 'backOut', signal, onUpdate: (k) => { e.scale = lerp(s0, step.to, k); e.apply(); } });
      return;
    }
    case 'rotate': {
      const e = ent(step.target);
      if (!e) return;
      const r0 = e.rot;
      await tween({ duration: step.duration ?? 500, ease: step.ease ?? 'easeInOut', signal, onUpdate: (k) => { e.rot = lerp(r0, step.to, k); e.apply(); } });
      return;
    }
    case 'camera': {
      const c0 = { ...stage.camera };
      const f = step.focus ? stage.resolvePoint(step.focus) : { x: c0.x, y: c0.y };
      await tween({
        duration: step.duration ?? 900,
        ease: step.ease ?? 'easeInOut',
        signal,
        onUpdate: (k) => stage.setCamera(lerp(c0.zoom, step.zoom, k), { x: lerp(c0.x, f.x, k), y: lerp(c0.y, f.y, k) }),
      });
      return;
    }
    case 'parallel':
      await Promise.all(step.steps.map((s) => runStep(s, ctx, args)));
      return;
    case 'play': {
      const tpl = ctx.templates[step.timeline];
      if (!tpl) return;
      await runTimeline(tpl, ctx, { ...args, ...(step.args ?? {}) });
      return;
    }
  }
}

/** Dùng trong hoạt động: nhảy nhẹ + rung để phản hồi một lần chạm. */
export async function nudge(el: HTMLElement, kind: 'wiggle' | 'bounce' | 'press' = 'bounce') {
  el.classList.remove('fx-wiggle', 'fx-bounce', 'fx-press');
  void el.offsetWidth;
  el.classList.add(`fx-${kind}`);
  await wait(kind === 'wiggle' ? 600 : 450);
  el.classList.remove(`fx-${kind}`);
}

export { ticker };
