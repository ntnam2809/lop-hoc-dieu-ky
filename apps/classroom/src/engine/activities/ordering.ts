import type { OrderCard, SentenceActivity, SequenceActivity } from '../types';
import type { ActivityFactory, ActivityHost } from './host';
import { sound } from '../fx/audio';
import { shuffle } from '../runtime/random';
import { wait } from '../runtime/ticker';
import { strings } from '../strings';
import { flyInto, h, hitTest, makeCard, makeDraggable, staggerIn, uiCenter } from './ui';

interface BoardOptions {
  id: string;
  cards: OrderCard[];
  correctOrder: string[];
  variant: 'story' | 'words';
  onDone: (slots: HTMLElement[]) => Promise<void>;
}

/**
 * Bảng sắp thứ tự dùng chung cho `sequence` (tranh truyện) và
 * `sentence_builder` (khối hình–chữ). Kéo thẻ vào ô, hoặc chạm thẻ rồi chạm
 * ô (cho bảng tương tác/chuột). Thẻ đặt sai ô sẽ bay về khay — không phạt.
 */
function orderingBoard(host: ActivityHost, o: BoardOptions): () => void {
  const offs: Array<() => void> = [];
  const board = h('div', `board board-${o.variant}`);
  board.style.setProperty('--n', String(o.correctOrder.length));
  const slotRow = h('div', 'slot-row');
  const tray = h('div', 'tray');
  const slots: HTMLElement[] = o.correctOrder.map((_, i) => {
    const s = h('div', 'slot', { 'data-slot': String(i) });
    if (o.variant === 'story') s.appendChild(h('span', 'slot-num', {}, [String(i + 1)]));
    slotRow.appendChild(s);
    return s;
  });
  if (o.variant === 'words') slotRow.appendChild(h('span', 'sentence-dot', {}, ['.']));
  board.append(slotRow, tray);
  host.stage.ui.append(h('div', 'scrim'), board);

  let selected: HTMLElement | null = null;
  let filled = 0;
  const select = (c: HTMLElement | null) => {
    selected?.classList.remove('selected');
    selected = c;
    c?.classList.add('selected');
    slots.forEach((s) => s.classList.toggle('awaiting', !!c && !s.dataset.filled));
  };

  const place = async (card: HTMLElement, slotIndex: number): Promise<boolean> => {
    const slot = slots[slotIndex];
    if (slot.dataset.filled) return false;
    if (o.correctOrder[slotIndex] !== card.dataset.card) {
      host.encourage(card);
      slot.classList.add('nope');
      setTimeout(() => slot.classList.remove('nope'), 500);
      return false;
    }
    slot.dataset.filled = '1';
    card.classList.add('locked', 'placed');
    select(null);
    await flyInto(host.stage, card, slot);
    sound.play('drop');
    const c = uiCenter(host.stage, slot);
    host.stage.fx.burst('sparkle', ...worldXY(host, c), 0.7);
    slot.classList.add('filled');
    filled++;
    if (filled === slots.length) void o.onDone(slots);
    return true;
  };

  const cards = shuffle(o.cards, o.id).map((oc) => {
    const card = makeCard({ id: oc.id, label: oc.label, visual: oc.visual, assets: host.assets, className: `order-card ${o.variant}` });
    tray.appendChild(card);
    offs.push(
      makeDraggable({
        stage: host.stage,
        el: card,
        onStart: () => {
          host.touch();
          select(null);
        },
        onMove: (p) => slots.forEach((s) => s.classList.toggle('over', !s.dataset.filled && hitTest(host.stage, s, p, 10))),
        onDrop: async (p) => {
          slots.forEach((s) => s.classList.remove('over'));
          const i = slots.findIndex((s) => !s.dataset.filled && hitTest(host.stage, s, p, 24));
          if (i < 0) return false;
          return place(card, i);
        },
        onTap: () => {
          host.touch();
          sound.play('pickup');
          select(selected === card ? null : card);
        },
      }),
    );
    return card;
  });
  slots.forEach((s, i) => {
    const fn = () => {
      if (selected) void place(selected, i);
    };
    s.addEventListener('click', fn);
    offs.push(() => s.removeEventListener('click', fn));
  });
  staggerIn(cards, 200);
  host.onIdle(10000, () => slots.find((s) => !s.dataset.filled)?.classList.add('hint'));
  return () => offs.forEach((f) => f());
}

function worldXY(host: ActivityHost, p: { x: number; y: number }): [number, number] {
  const w = host.stage.uiToWorld(p);
  return [w.x, w.y];
}

export const sequence: ActivityFactory<SequenceActivity> = (a, host) => {
  let off = () => {};
  return {
    async start() {
      await host.runTimeline(a.intro);
      if (host.signal.aborted) return;
      off = orderingBoard(host, {
        id: a.id,
        cards: a.cards,
        correctOrder: a.correctOrder,
        variant: 'story',
        onDone: async (slots) => {
          host.celebrate({ x: 800, y: 640 }, strings.sequenceDone);
          await wait(900, host.signal);
          // Kể lại theo thứ tự: từng tranh sáng lên và được đọc to.
          for (let i = 0; i < slots.length; i++) {
            if (host.signal.aborted) return;
            slots[i].classList.add('spot');
            sound.play('chime');
            const card = a.cards.find((c) => c.id === a.correctOrder[i]);
            await host.say(`${i + 1}. ${card?.label ?? ''}`);
            slots[i].classList.remove('spot');
          }
          await host.runTimeline(a.outro);
          host.complete();
        },
      });
      await host.instruct(a.instruction);
    },
    destroy: () => off(),
  };
};

export const sentenceBuilder: ActivityFactory<SentenceActivity> = (a, host) => {
  let off = () => {};
  return {
    async start() {
      await host.runTimeline(a.intro);
      if (host.signal.aborted) return;
      off = orderingBoard(host, {
        id: a.id,
        cards: a.blocks,
        correctOrder: a.correctOrder,
        variant: 'words',
        onDone: async (slots) => {
          host.celebrate({ x: 800, y: 640 });
          slots.forEach((s, i) => setTimeout(() => s.classList.add('wave'), i * 140));
          await host.say(a.sentence);
          host.stage.ui.querySelector('.board')?.classList.add('lift');
          await host.runTimeline(a.outro);
          host.complete();
        },
      });
      await host.instruct(a.instruction);
    },
    destroy: () => off(),
  };
};
