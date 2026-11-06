import type { StoryRecallActivity } from '../types';
import type { ActivityFactory } from './host';
import { sound } from '../fx/audio';
import { h, makeCard, staggerIn } from './ui';

/**
 * Kể lại chuyện: dải tranh theo thứ tự. Chạm một tranh → phóng to, đọc câu
 * gợi mở. Không có đúng/sai — trẻ kể bằng lời, giáo viên dẫn dắt.
 */
export const storyRecall: ActivityFactory<StoryRecallActivity> = (a, host) => {
  return {
    async start() {
      await host.runTimeline(a.intro);
      if (host.signal.aborted) return;
      const strip = h('div', 'film-strip');
      strip.style.setProperty('--n', String(a.frames.length));
      const visited = new Set<string>();
      const spot = h('div', 'recall-spot');
      const cards = a.frames.map((f, i) => {
        const card = makeCard({ id: f.id, label: f.label, visual: f.visual, assets: host.assets, className: 'recall-card' });
        card.prepend(h('span', 'frame-num', {}, [String(i + 1)]));
        card.addEventListener('click', async () => {
          host.touch();
          sound.play('page');
          cards.forEach((c) => c.classList.toggle('active', c === card));
          visited.add(f.id);
          card.classList.add('seen');
          spot.replaceChildren(
            makeCard({ id: `${f.id}-big`, label: f.label, visual: f.visual, assets: host.assets, className: 'recall-big' }),
          );
          spot.classList.remove('show');
          void spot.offsetWidth;
          spot.classList.add('show');
          await host.say(f.prompt);
          if (visited.size === a.frames.length && !host.signal.aborted) {
            host.complete();
          }
        });
        strip.appendChild(card);
        return card;
      });
      host.stage.ui.append(h('div', 'scrim soft'), spot, strip);
      staggerIn(cards, 150, 120);
      host.onIdle(8000, () => cards.find((c) => !c.classList.contains('seen'))?.classList.add('hint'));
      await host.instruct(a.instruction);
      await host.runTimeline(a.outro);
    },
  };
};
