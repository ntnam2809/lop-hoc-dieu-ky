import type { ChoiceOption, ClassificationActivity, ExperimentActivity, PredictionActivity, Visual } from '../types';
import type { ActivityFactory, ActivityHost } from './host';
import { sound } from '../fx/audio';
import { wait } from '../runtime/ticker';
import { pick, shuffle } from '../runtime/random';
import { strings } from '../strings';
import { flyInto, h, hitTest, makeCard, makeDraggable, renderVisual, staggerIn, uiCenter } from './ui';

/** Bong bóng suy nghĩ hiển thị dự đoán phía trên vật. */
function thoughtBubble(host: ActivityHost, entityId: string, opt: ChoiceOption, title = strings.yourGuess): HTMLElement {
  host.stage.ui.querySelectorAll(`.thought[data-for="${entityId}"]`).forEach((n) => n.remove());
  const e = host.stage.entity(entityId);
  const el = h('div', 'thought', { 'data-for': entityId });
  el.append(h('span', 'thought-title', {}, [title]), renderVisual(opt.visual, host.assets), h('span', 'thought-label', {}, [opt.label]));
  if (e) {
    const p = host.stage.worldToUi(e.top);
    el.style.left = `${Math.min(1440, Math.max(160, p.x))}px`;
    el.style.top = `${Math.max(120, p.y - 30)}px`;
  }
  host.stage.ui.appendChild(el);
  return el;
}

/** Dự đoán: phóng to vật, trẻ chọn kết quả mình đoán. Mọi lựa chọn đều được nhận. */
export const prediction: ActivityFactory<PredictionActivity> = (a, host) => ({
  async start() {
    const e = host.stage.entity(a.subject);
    if (e) {
      e.el.classList.add('spotlit');
      e.setPreset('pulse');
    }
    await host.runTimeline(a.intro ?? (e ? [{ do: 'camera', zoom: 1.35, focus: a.subject, duration: 900 }] : []));
    if (host.signal.aborted) return;
    const row = h('div', 'choice-row predict-row');
    row.style.setProperty('--n', String(a.options.length));
    const cards = a.options.map((opt) => {
      const card = makeCard({ id: opt.id, label: opt.label, visual: opt.visual, assets: host.assets, className: 'choice-card predict-card' });
      card.dataset.option = opt.id;
      card.addEventListener('click', async () => {
        host.touch();
        sound.play('pop');
        const first = !host.session.predictions.has(a.predictionKey);
        host.session.predict(a.predictionKey, opt.id);
        cards.forEach((c) => c.classList.toggle('chosen', c === card));
        const bubble = thoughtBubble(host, a.subject, opt);
        bubble.classList.add('pop');
        const c = host.stage.uiToWorld(uiCenter(host.stage, card));
        host.stage.fx.burst('sparkle', c.x, c.y, 0.6);
        e?.setPreset('think');
        if (first) {
          await host.say(`${strings.predictionSaved}: ${opt.label}!`);
          await host.runTimeline(a.outro);
          if (!host.signal.aborted) host.complete();
        }
      });
      row.appendChild(card);
      return card;
    });
    host.stage.ui.appendChild(row);
    staggerIn(cards, 100, 120);
    host.onIdle(9000, () => cards.forEach((c) => c.classList.add('hint')));
    await host.instruct(a.instruction);
  },
});

/** Bảng kết quả nhỏ trên cùng: mỗi vật một ô, điền kết quả sau khi thử. */
function tallyBoard(host: ActivityHost, a: ExperimentActivity): Map<string, HTMLElement> {
  const board = h('div', 'tally');
  const cells = new Map<string, HTMLElement>();
  for (const s of a.subjects) {
    const e = host.stage.entity(s.entity);
    const cell = h('div', 'tally-cell', { 'data-subject': s.entity });
    const thumb = h('div', 'tally-thumb');
    if (e?.def.asset) thumb.appendChild(host.assets.render(e.def.asset));
    cell.append(thumb, h('div', 'tally-result'));
    board.appendChild(cell);
    cells.set(s.entity, cell);
  }
  if (a.subjects.length > 1) host.stage.ui.appendChild(board);
  return cells;
}

/** Thí nghiệm: chạy mô phỏng tất định từ timeline, hiện kết quả, so với dự đoán. */
export const experiment: ActivityFactory<ExperimentActivity> = (a, host) => ({
  async start() {
    await host.instruct(a.instruction);
    host.hideInstruction();
    await host.runTimeline(a.intro);
    const cells = tallyBoard(host, a);
    for (const s of a.subjects) {
      if (host.signal.aborted) return;
      const outcome = a.outcomes.find((o) => o.id === s.result);
      const guessId = s.predictionKey ? host.session.predictions.get(s.predictionKey) : undefined;
      const guess = a.outcomes.find((o) => o.id === guessId);
      cells.get(s.entity)?.classList.add('now');
      if (guess) thoughtBubble(host, s.entity, guess).classList.add('pop', 'small');
      await host.runTimeline(s.timeline);
      if (host.signal.aborted) return;
      host.stage.ui.querySelectorAll(`.thought[data-for="${s.entity}"]`).forEach((n) => n.remove());

      // Huy hiệu kết quả bật lên cạnh vật.
      const e = host.stage.entity(s.entity);
      const badge = h('div', 'result-badge');
      badge.append(h('span', 'thought-title', {}, [strings.result]), renderVisual(outcome?.visual, host.assets), h('span', 'thought-label', {}, [outcome?.label ?? s.result]));
      if (e) {
        const p = host.stage.worldToUi(e.center);
        badge.style.left = `${Math.min(1420, p.x + 230)}px`;
        badge.style.top = `${Math.max(150, Math.min(700, p.y - 60))}px`;
      }
      host.stage.ui.appendChild(badge);
      sound.play('chime');

      const cell = cells.get(s.entity);
      if (cell) {
        cell.classList.remove('now');
        cell.classList.add('done');
        cell.querySelector('.tally-result')?.replaceChildren(renderVisual(outcome?.visual, host.assets));
      }
      host.session.record({ key: s.predictionKey ?? s.entity, label: s.label, prediction: guessId, result: s.result });

      const at = e ? host.stage.worldToUi(e.center) : { x: 800, y: 400 };
      if (guess && guess.id === s.result) {
        host.celebrate(at);
        await host.say(`${s.label} ${outcome?.label.toLowerCase() ?? ''}. ${strings.resultMatch}`);
      } else if (guess) {
        const w = host.stage.uiToWorld(at);
        host.stage.fx.burst('sparkle', w.x, w.y, 1.1);
        e?.emote('exclaim', 1600);
        await host.say(`${s.label} ${outcome?.label.toLowerCase() ?? ''}. ${strings.resultSurprise}`);
      } else {
        host.celebrate(at);
        await host.say(`${s.label} ${outcome?.label.toLowerCase() ?? ''}!`);
      }
      await wait(500, host.signal);
      badge.classList.add('out');
      setTimeout(() => badge.remove(), 300);
    }
    await host.runTimeline(a.outro);
    if (!host.signal.aborted) host.complete();
  },
});

/** Phân loại: kéo vật vào giỏ. "check" bật lại khi sai; "predict" ghi nhận dự đoán. */
export const classification: ActivityFactory<ClassificationActivity> = (a, host) => {
  const offs: Array<() => void> = [];
  return {
    async start() {
      await host.runTimeline(a.intro);
      if (host.signal.aborted) return;
      const board = h('div', `sort-board mode-${a.mode}`);
      const tray = h('div', 'sort-tray');
      const bins = h('div', 'bins');
      bins.style.setProperty('--n', String(a.categories.length));
      const binEls = a.categories.map((cat) => {
        const bin = h('div', 'bin', { 'data-bin': cat.id });
        const head = h('div', 'bin-head');
        head.append(renderVisual(cat.visual as Visual | undefined, host.assets), h('span', 'bin-label', {}, [cat.label]));
        bin.append(head, h('div', 'bin-stack'));
        bins.appendChild(bin);
        return bin;
      });
      board.append(tray, bins);
      host.stage.ui.append(h('div', 'scrim soft'), board);

      let remaining = a.items.length;
      let selected: HTMLElement | null = null;
      const select = (c: HTMLElement | null) => {
        selected?.classList.remove('selected');
        selected = c;
        c?.classList.add('selected');
        binEls.forEach((b) => b.classList.toggle('awaiting', !!c));
      };

      const drop = async (card: HTMLElement, bin: HTMLElement): Promise<boolean> => {
        const item = a.items.find((i) => i.id === card.dataset.card)!;
        const catId = bin.dataset.bin!;
        if (a.mode === 'check' && item.category !== catId) {
          host.encourage(card, pick(strings.encourage, item.id));
          bin.classList.add('nope');
          setTimeout(() => bin.classList.remove('nope'), 500);
          return false;
        }
        if (a.mode === 'predict' && item.predictionKey) host.session.predict(item.predictionKey, catId);
        card.classList.add('locked', 'binned');
        select(null);
        await flyInto(host.stage, card, bin.querySelector('.bin-stack') as HTMLElement);
        sound.play(a.mode === 'check' ? 'chime' : 'drop');
        bin.classList.add('gulp');
        setTimeout(() => bin.classList.remove('gulp'), 500);
        const w = host.stage.uiToWorld(uiCenter(host.stage, bin));
        host.stage.fx.burst('sparkle', w.x, w.y - 40, 0.8);
        remaining--;
        if (remaining === 0) {
          await wait(400, host.signal);
          host.celebrate({ x: 800, y: 300 }, a.mode === 'check' ? strings.sortDone : undefined);
          if (a.mode === 'predict') await host.say(strings.predictSortDone);
          await host.runTimeline(a.outro);
          if (!host.signal.aborted) host.complete();
        }
        return true;
      };

      const cards = shuffle(a.items, a.id).map((item) => {
        const card = makeCard({ id: item.id, label: item.label, visual: item.visual, assets: host.assets, className: 'sort-card' });
        tray.appendChild(card);
        offs.push(
          makeDraggable({
            stage: host.stage,
            el: card,
            onStart: () => { host.touch(); select(null); },
            onMove: (p) => binEls.forEach((b) => b.classList.toggle('over', hitTest(host.stage, b, p, 0))),
            onDrop: (p) => {
              binEls.forEach((b) => b.classList.remove('over'));
              const bin = binEls.find((b) => hitTest(host.stage, b, p, 20));
              return bin ? drop(card, bin) : false;
            },
            onTap: () => { host.touch(); sound.play('pickup'); select(selected === card ? null : card); },
          }),
        );
        return card;
      });
      binEls.forEach((b) => {
        const fn = () => { if (selected) void drop(selected, b); };
        b.addEventListener('click', fn);
        offs.push(() => b.removeEventListener('click', fn));
      });
      staggerIn(cards, 150);
      host.onIdle(10000, () => cards.find((c) => !c.classList.contains('binned'))?.classList.add('hint'));
      await host.instruct(a.instruction);
    },
    destroy: () => offs.forEach((f) => f()),
  };
};
