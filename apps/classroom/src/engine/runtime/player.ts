import type { Activity, LessonBundle, Point, Scenario } from '../types';
import type { ActivityController, ActivityHost } from '../activities/host';
import { getFactory } from '../activities/registry';
import { h } from '../activities/ui';
import { orderedActivities } from '../content/package';
import { sound } from '../fx/audio';
import { narrator } from '../fx/speech';
import { icons } from '../icons';
import type { AssetStore } from './assets';
import { Session } from './session';
import { Stage } from './stage';
import { ticker, wait } from './ticker';
import { runTimeline } from './timeline';
import { tween } from './tween';

export interface PlayerOptions {
  autoAdvance?: boolean;
  /** Màu màn chuyển cảnh (theo mảng học). */
  transitionColor?: string;
}

/**
 * Bộ điều phối bài học: dựng cảnh cho từng hoạt động, tạo controller từ
 * registry, cung cấp ActivityHost, và nhận lệnh của giáo viên (tiếp, lùi,
 * tạm dừng, phát lại, bỏ qua). Không chứa logic riêng của bài học nào.
 */
export class Player extends EventTarget {
  readonly stage: Stage;
  readonly activities: Activity[];
  readonly session = new Session();
  index = -1;
  paused = false;
  private ctrl: ActivityController | null = null;
  private abort: AbortController | null = null;
  private iris: HTMLElement;
  private banner: HTMLElement;
  /** Đang chuyển cảnh. */
  busy = false;
  private idle: { ms: number; fn: () => void; t: number; fired: boolean } | null = null;
  private offIdle: () => void;

  constructor(container: HTMLElement, readonly bundle: LessonBundle, readonly assets: AssetStore, private opts: PlayerOptions = {}) {
    super();
    this.stage = new Stage(container, assets);
    this.activities = orderedActivities(bundle);
    this.iris = h('div', 'iris', {}, [h('div', 'iris-hole'), h('div', 'iris-star', {}, [])]);
    this.iris.querySelector('.iris-star')!.innerHTML = icons.star;
    if (opts.transitionColor) this.iris.style.setProperty('--iris', opts.transitionColor);
    this.banner = h('div', 'instruction');
    this.stage.stage.append(this.banner, this.iris);
    this.stage.viewport.addEventListener('pointerdown', () => {
      sound.unlock();
      this.touch();
    });
    this.offIdle = ticker.add((dt) => {
      if (!this.idle || this.idle.fired) return;
      this.idle.t += dt;
      if (this.idle.t >= this.idle.ms) {
        this.idle.fired = true;
        this.idle.fn();
      }
    });
  }

  get current(): Activity | undefined {
    return this.activities[this.index];
  }

  isCompleted(i = this.index): boolean {
    const a = this.activities[i];
    return !!a && this.session.completed.has(a.id);
  }

  private scenarioOf(a: Activity): Scenario | undefined {
    return this.bundle.scenarios.find((s) => s.id === a.scenarioId);
  }

  private touch() {
    if (this.idle) {
      this.idle.t = 0;
      this.idle.fired = false;
      this.stage.viewport.querySelectorAll('.hint').forEach((n) => n.classList.remove('hint'));
    }
  }

  private async irisTo(r: number, duration: number) {
    const hole = this.iris.querySelector<HTMLElement>('.iris-hole')!;
    const from = Number(hole.dataset.r ?? 1000);
    this.iris.classList.add('on');
    await tween({
      duration,
      ease: r < from ? 'easeIn' : 'easeOut',
      onUpdate: (k) => {
        const v = from + (r - from) * k;
        hole.dataset.r = String(v);
        this.iris.style.setProperty('--k', String(Math.max(0, 1 - v / 260)));
        hole.style.width = hole.style.height = `${v * 2}px`;
      },
    });
    if (r >= 1000) this.iris.classList.remove('on');
  }

  async goTo(i: number, mode: 'iris' | 'soft' | 'none' = 'iris') {
    if (i < 0 || i >= this.activities.length || this.busy) return;
    this.busy = true;
    if (this.paused) this.setPaused(false);
    const changing = i !== this.index;
    const first = this.index < 0;
    if (mode === 'iris') {
      if (!first) sound.play('whoosh');
      await this.irisTo(0, first ? 0 : 420);
    }
    this.teardown();
    this.index = i;
    const a = this.activities[i];
    this.session.visited.add(a.id);
    this.dispatchEvent(new CustomEvent('change', { detail: { index: i, activity: a } }));
    const sc = this.scenarioOf(a);
    const scene = sc?.scenes.find((s) => s.id === a.sceneId);
    if (scene) this.stage.load(scene, a.sceneOverrides);
    if (mode === 'soft' && !changing) this.stage.viewport.classList.add('soft-reset');
    if (mode === 'iris') await this.irisTo(1000, first ? 800 : 520);
    this.stage.viewport.classList.remove('soft-reset');
    this.busy = false;
    this.startActivity(a, sc);
  }

  private startActivity(a: Activity, sc: Scenario | undefined) {
    const abort = new AbortController();
    this.abort = abort;
    const factory = getFactory(a.type);
    if (!factory || !sc) {
      this.stage.ui.appendChild(h('div', 'unsupported', {}, [`Chưa hỗ trợ hoạt động "${a.type}"`]));
      return;
    }
    const host = this.makeHost(a, sc, abort.signal);
    try {
      this.ctrl = factory(a, host);
      this.ctrl.start().catch((err) => this.fail(err));
    } catch (err) {
      this.fail(err);
    }
  }

  private fail(err: unknown) {
    console.error('[activity]', err);
    this.stage.ui.appendChild(h('div', 'unsupported', {}, ['Hoạt động gặp lỗi — cô có thể bấm "Tiếp"']));
  }

  private makeHost(a: Activity, sc: Scenario, signal: AbortSignal): ActivityHost {
    const stage = this.stage;
    const host: ActivityHost = {
      stage,
      assets: this.assets,
      bundle: this.bundle,
      scenario: sc,
      session: this.session,
      signal,
      complete: () => {
        if (signal.aborted || this.session.completed.has(a.id)) return;
        this.session.completed.add(a.id);
        this.dispatchEvent(new CustomEvent('complete', { detail: { index: this.index, activity: a } }));
        if (this.opts.autoAdvance) {
          const idx = this.index;
          void wait(2600, signal).then(() => {
            if (!signal.aborted && this.index === idx) this.next();
          });
        }
      },
      runTimeline: async (t, args) => {
        if (t?.length) await runTimeline(t, { stage, templates: sc.timelines ?? {}, signal }, args);
      },
      say: async (text, target) => {
        await runTimeline([{ do: 'say', text, target }], { stage, templates: {}, signal });
      },
      instruct: async (text) => {
        this.showInstruction(text);
        await narrator.speak(text, signal);
      },
      hideInstruction: () => this.banner.classList.remove('show'),
      celebrate: (at: Point, text?: string) => {
        const w = stage.uiToWorld(at);
        stage.fx.burst('stars', w.x, w.y, 1);
        sound.play('correct');
        if (text) this.praise(at, text);
      },
      encourage: (el, text) => {
        sound.play('retry');
        el.classList.remove('fx-wiggle');
        void el.offsetWidth;
        el.classList.add('fx-wiggle');
        setTimeout(() => el.classList.remove('fx-wiggle'), 650);
        if (text) void host.say(text);
      },
      onIdle: (ms, fn) => {
        this.idle = { ms, fn, t: 0, fired: false };
      },
      touch: () => this.touch(),
    };
    return host;
  }

  private showInstruction(text: string) {
    this.banner.replaceChildren();
    const btn = h('button', 'instruction-speak', { type: 'button', 'aria-label': 'Nghe lại' });
    btn.innerHTML = icons.speaker;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      sound.play('tap');
      void narrator.speak(text);
    });
    this.banner.append(btn, h('span', 'instruction-text', {}, [text]));
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
  }

  private praise(at: Point, text: string) {
    const el = h('div', 'praise');
    [...text].forEach((ch, i) => {
      const s = h('span', '', {}, [ch === ' ' ? ' ' : ch]);
      s.style.animationDelay = `${i * 35}ms`;
      el.appendChild(s);
    });
    el.style.left = `${Math.min(1350, Math.max(250, at.x))}px`;
    el.style.top = `${Math.max(140, at.y - 120)}px`;
    this.stage.ui.appendChild(el);
    setTimeout(() => el.classList.add('out'), 1500);
    setTimeout(() => el.remove(), 1900);
  }

  private teardown() {
    this.abort?.abort();
    this.abort = null;
    try {
      this.ctrl?.destroy?.();
    } catch (err) {
      console.error(err);
    }
    this.ctrl = null;
    this.idle = null;
    narrator.stop();
    this.banner.classList.remove('show');
  }

  next() {
    if (this.busy) return;
    if (this.index >= this.activities.length - 1) {
      this.teardown();
      this.dispatchEvent(new CustomEvent('finish'));
      return;
    }
    void this.goTo(this.index + 1);
  }

  prev() {
    if (this.index > 0) void this.goTo(this.index - 1);
  }

  replay() {
    void this.goTo(this.index, 'soft');
  }

  setPaused(p: boolean) {
    this.paused = p;
    ticker.setPaused(p);
    narrator.pause(p);
    sound.suspend(p);
    this.dispatchEvent(new CustomEvent('pause', { detail: { paused: p } }));
  }

  destroy() {
    this.teardown();
    this.offIdle();
    if (this.paused) this.setPaused(false);
    this.stage.destroy();
  }
}
