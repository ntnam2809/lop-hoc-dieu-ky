import type { ChoiceActivity } from '../types';
import type { ActivityFactory } from './host';
import { sound } from '../fx/audio';
import { pick, shuffle } from '../runtime/random';
import { strings } from '../strings';
import { showWord } from './story';
import { h, makeCard, staggerIn, uiCenter } from './ui';

/**
 * Primitive "chọn một đáp án" — dùng chung cho nhận biết đồ vật / nhân vật /
 * hành động, chọn từ theo tranh, so sánh, nguyên nhân–kết quả. Hai cách
 * trình bày: chạm thẳng vào cảnh (`scene`) hoặc thẻ lớn (`cards`).
 */
export const choice: ActivityFactory<ChoiceActivity> = (a, host) => {
  const cleanups: Array<() => void> = [];
  let solved = false;

  const succeed = async (optionId: string, el: HTMLElement, at: { x: number; y: number }) => {
    solved = true;
    const opt = a.options.find((o) => o.id === optionId)!;
    el.classList.add('correct');
    host.celebrate(at, a.praise ? undefined : pick(strings.praise, a.id));
    if (opt.entity) {
      const e = host.stage.entity(opt.entity);
      e?.setPreset('cheer');
      setTimeout(() => e?.setPreset(e.def.anim ?? 'idle'), 1600);
    }
    host.stage.ui.querySelectorAll<HTMLElement>('[data-option]').forEach((n) => {
      if (n !== el) n.classList.add('dim');
      n.classList.add('locked');
    });
    await host.say(a.praise ?? opt.label);
    await host.runTimeline(a.outro);
    if (!host.signal.aborted) host.complete();
  };

  const choose = (optionId: string, el: HTMLElement, at: { x: number; y: number }) => {
    if (solved || host.signal.aborted) return;
    host.touch();
    if (optionId === a.correctAnswer) {
      void succeed(optionId, el, at);
    } else {
      const opt = a.options.find((o) => o.id === optionId);
      host.encourage(el, opt ? `${opt.label}. ${pick(strings.encourage, a.id + optionId)}` : undefined);
    }
  };

  return {
    async start() {
      await host.runTimeline(a.intro);
      if (host.signal.aborted) return;

      if (a.presentation === 'scene') {
        for (const opt of a.options) {
          const e = opt.entity ? host.stage.entity(opt.entity) : undefined;
          if (!e) continue;
          e.el.classList.add('choosable');
          e.el.dataset.option = opt.id;
          const fn = (ev: Event) => {
            ev.stopPropagation();
            sound.play('tap');
            if (opt.id !== a.correctAnswer && !e.def.zone) showWord(host, e.def.id, opt.label);
            choose(opt.id, e.el, host.stage.worldToUi(e.center));
          };
          e.el.addEventListener('pointerdown', fn);
          cleanups.push(() => {
            e.el.removeEventListener('pointerdown', fn);
            e.el.classList.remove('choosable', 'hint');
            delete e.el.dataset.option;
          });
        }
        // Nhắc khéo: mọi lựa chọn cùng nhấp nháy — gợi "chạm vào đây", không lộ đáp án.
        host.onIdle(9000, () => a.options.forEach((o) => host.stage.entity(o.entity ?? '')?.el.classList.add('hint')));
      } else {
        const row = h('div', 'choice-row');
        row.style.setProperty('--n', String(a.options.length));
        const cards: HTMLElement[] = [];
        for (const opt of shuffle(a.options, a.id)) {
          const card = makeCard({ id: opt.id, label: opt.label, visual: opt.visual, assets: host.assets, className: 'choice-card' });
          card.dataset.option = opt.id;
          card.addEventListener('click', () => {
            sound.play('tap');
            choose(opt.id, card, uiCenter(host.stage, card));
          });
          cards.push(card);
          row.appendChild(card);
        }
        host.stage.ui.appendChild(h('div', 'scrim'));
        host.stage.ui.appendChild(row);
        staggerIn(cards, 150);
        host.onIdle(10000, () => cards.forEach((c) => c.classList.add('hint')));
      }
      await host.instruct(a.instruction);
    },
    destroy() {
      cleanups.forEach((f) => f());
    },
  };
};
