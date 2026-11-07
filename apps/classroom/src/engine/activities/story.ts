import type { ExploreActivity, StorySceneActivity } from '../types';
import type { ActivityFactory, ActivityHost } from './host';
import { sound } from '../fx/audio';
import { narrator } from '../fx/speech';
import { strings } from '../strings';
import { h } from './ui';

/**
 * Cho phép chạm vào nhân vật/vật có `label` để nghe tên (từ vựng) — ngay cả
 * trong cảnh xem truyện, trẻ vẫn được "chạm thử" mà không làm hỏng mạch truyện.
 */
export function enableLabelTaps(host: ActivityHost, only?: string[], onTap?: (id: string) => void): () => void {
  const offs: Array<() => void> = [];
  for (const [id, e] of host.stage.entities) {
    if (!e.def.label || e.def.decor || (only && !only.includes(id))) continue;
    e.el.classList.add('tappable');
    const fn = () => {
      if (e.hidden) return;
      host.touch();
      sound.play('tap');
      e.el.classList.remove('fx-bounce');
      void e.el.offsetWidth;
      e.el.classList.add('fx-bounce');
      showWord(host, id, e.def.label!);
      void narrator.speak(e.def.label!);
      onTap?.(id);
    };
    e.el.addEventListener('pointerdown', fn);
    offs.push(() => {
      e.el.removeEventListener('pointerdown', fn);
      e.el.classList.remove('tappable');
    });
  }
  return () => offs.forEach((f) => f());
}

/** Thẻ chữ nảy lên trên đầu vật vừa chạm. */
export function showWord(host: ActivityHost, id: string, word: string) {
  const e = host.stage.entity(id);
  if (!e) return;
  host.stage.ui.querySelectorAll(`.word-pop[data-for="${id}"]`).forEach((n) => n.remove());
  const p = host.stage.worldToUi(e.top);
  const el = h('div', 'word-pop', { 'data-for': id }, [word]);
  el.style.left = `${p.x}px`;
  el.style.top = `${Math.max(70, p.y - 10)}px`;
  host.stage.ui.appendChild(el);
  setTimeout(() => el.classList.add('out'), 1600);
  setTimeout(() => el.remove(), 2000);
}

export const storyScene: ActivityFactory<StorySceneActivity> = (a, host) => {
  let off = () => {};
  return {
    async start() {
      await host.runTimeline(a.intro);
      await host.runTimeline(a.timeline);
      if (host.signal.aborted) return;
      host.complete();
      off = enableLabelTaps(host);
    },
    destroy: () => off(),
  };
};

export const explore: ActivityFactory<ExploreActivity> = (a, host) => {
  let off = () => {};
  return {
    async start() {
      await host.runTimeline(a.intro);
      if (host.signal.aborted) return;
      // Khay "bộ sưu tập": hình mờ của từng vật cần tìm, sáng lên khi trẻ chạm.
      const tray = h('div', 'collect-tray');
      const slots = new Map<string, HTMLElement>();
      for (const id of a.targets) {
        const e = host.stage.entity(id);
        if (!e?.def.asset) continue;
        const s = h('div', 'collect-slot', { 'data-slot': id });
        s.appendChild(host.assets.render(e.def.asset));
        tray.appendChild(s);
        slots.set(id, s);
      }
      host.stage.ui.appendChild(tray);
      const found = new Set<string>();
      off = enableLabelTaps(host, a.targets, (id) => {
        if (found.has(id)) return;
        found.add(id);
        const e = host.stage.entity(id)!;
        host.stage.fx.burst('sparkle', e.x, e.y, 0.8);
        slots.get(id)?.classList.add('found');
        sound.play('chime');
        if (found.size === a.targets.length) {
          setTimeout(async () => {
            if (host.signal.aborted) return;
            host.celebrate({ x: 800, y: 420 }, strings.allFound);
            await host.runTimeline(a.outro);
            host.complete();
          }, 900);
        }
      });
      host.onIdle(9000, () => {
        for (const id of a.targets) if (!found.has(id)) host.stage.entity(id)?.el.classList.add('hint');
      });
      await host.instruct(a.instruction);
    },
    destroy: () => off(),
  };
};
