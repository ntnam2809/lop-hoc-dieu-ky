import { icons } from '../../engine/icons';
import { sound } from '../../engine/fx/audio';
import { ParticleSystem } from '../../engine/fx/particles';
import { AssetStore } from '../../engine/runtime/assets';
import { renderVisual } from '../../engine/activities/ui';
import { STAGE_W, type ExperimentActivity, type PredictionActivity, type ChoiceOption } from '../../engine/types';
import { catalog, lastRun, lessonBundle } from '../state';
import { go } from '../router';
import { floatingDecor, h, topbar } from '../widgets';

/** "Sau hoạt động" — tổng kết ngắn: mục tiêu, kết quả thí nghiệm, gợi ý mở rộng. */
export async function summaryScreen(root: HTMLElement, lessonId: string): Promise<() => void> {
  const [cat, bundle] = await Promise.all([catalog(), lessonBundle(lessonId)]);
  const l = bundle.lesson;
  const d = cat.domains.find((x) => x.id === l.domainId);
  const run = lastRun?.lessonId === lessonId ? lastRun : null;

  const page = h('main', 'page page-summary');
  if (d) {
    page.style.setProperty('--primary', d.theme.primary);
    page.style.setProperty('--accent', d.theme.accent);
    page.style.setProperty('--soft', d.theme.soft);
  }
  page.append(floatingDecor(), topbar({ back: () => go({ name: 'lesson', id: lessonId }) }));

  const canvas = h('canvas', 'summary-fx');
  page.append(canvas);
  const fx = new ParticleSystem(canvas);
  fx.resize(window.innerWidth / STAGE_W);
  fx.setAmbient(['pollen']);

  const head = h('section', 'summary-head');
  const stars = h('div', 'big-stars');
  for (let i = 0; i < 3; i++) {
    const s = h('span', 'big-star');
    s.innerHTML = icons.star;
    s.style.animationDelay = `${300 + i * 260}ms`;
    stars.append(s);
    setTimeout(() => sound.play('sparkle'), 300 + i * 260);
  }
  head.append(stars, h('h1', '', {}, ['Hoàn thành bài học!']), h('p', '', {}, [l.title]));
  page.append(head);

  const grid = h('section', 'summary-grid');
  const objPanel = h('article', 'brief-panel objectives');
  const oh = h('h2');
  oh.innerHTML = `${icons.target}<span>Mục tiêu</span>`;
  const ul = h('ul', 'checklist');
  for (const o of l.learningObjectives) {
    const covered = bundle.activities.filter((a) => a.learningObjectives.includes(o.id));
    const done = run ? covered.some((a) => run.session.completed.has(a.id)) : false;
    const li = h('li', done ? 'done' : 'todo');
    const mark = h('span', 'mark');
    mark.innerHTML = done ? icons.check : '';
    li.append(mark, h('span', '', {}, [o.text]));
    ul.append(li);
  }
  objPanel.append(oh, ul);
  if (!run) objPanel.append(h('p', 'muted', {}, ['(Chưa có dữ liệu buổi học — mở bài và chơi đến cuối để xem tổng kết.)']));
  grid.append(objPanel);

  // Bảng dự đoán ↔ kết quả (bài khoa học).
  if (run?.session.results.length) {
    const outcomes = new Map<string, ChoiceOption>();
    for (const a of bundle.activities) {
      if (a.type === 'experiment') (a as ExperimentActivity).outcomes.forEach((o) => outcomes.set(o.id, o));
      if (a.type === 'prediction') (a as PredictionActivity).options.forEach((o) => outcomes.set(o.id, o));
    }
    const store = new AssetStore(bundle.assets);
    const visuals = [...outcomes.values()].flatMap((o) => o.visual?.layers.map((x) => x.asset) ?? []);
    await store.preload(visuals);
    const panel = h('article', 'brief-panel results');
    const rh = h('h2');
    rh.innerHTML = `${icons.eye}<span>Dự đoán & kết quả</span>`;
    const table = h('div', 'result-table');
    table.append(h('span', 'th', {}, ['Vật']), h('span', 'th', {}, ['Con đoán']), h('span', 'th', {}, ['Kết quả']));
    for (const r of run.session.results) {
      const cell = (id?: string) => {
        const c = h('span', 'td');
        const o = id ? outcomes.get(id) : undefined;
        if (o) c.append(renderVisual(o.visual, store), h('small', '', {}, [o.label]));
        else c.append(h('small', 'muted', {}, ['—']));
        return c;
      };
      const match = r.prediction === r.result;
      const name = h('span', `td name ${r.prediction ? (match ? 'match' : 'surprise') : ''}`, {}, [r.label]);
      table.append(name, cell(r.prediction), cell(r.result));
    }
    panel.append(rh, table, h('p', 'muted', {}, ['Sai dự đoán không sao cả — điều quan trọng là con thử và quan sát.']));
    grid.append(panel);
  }

  const ext = h('article', 'brief-panel extension');
  const eh = h('h2');
  eh.innerHTML = `${icons.bulb}<span>Gợi ý mở rộng</span>`;
  const eul = h('ul');
  [...l.teacherGuide.followUp, ...l.teacherGuide.extensionQuestions].forEach((t) => eul.append(h('li', '', {}, [t])));
  ext.append(eh, eul);
  grid.append(ext);
  page.append(grid);

  const actions = h('div', 'summary-actions');
  const again = h('button', 'btn btn-primary', { type: 'button' });
  again.innerHTML = `${icons.replay}<span>Chơi lại</span>`;
  again.addEventListener('click', () => go({ name: 'play', id: lessonId }));
  const other = h('button', 'btn btn-ghost', { type: 'button' });
  other.innerHTML = `${icons.list}<span>Chọn bài khác</span>`;
  other.addEventListener('click', () => go(d ? { name: 'domain', id: d.id } : { name: 'home' }));
  actions.append(again, other);
  page.append(actions);

  root.replaceChildren(page);
  const timers = [
    setTimeout(() => fx.burst('confetti', 400, 900, 1.2), 200),
    setTimeout(() => fx.burst('confetti', 1200, 900, 1.2), 450),
    setTimeout(() => fx.burst('stars', 800, 260, 1.4), 900),
  ];
  sound.play('fanfare');
  return () => {
    timers.forEach(clearTimeout);
    fx.destroy();
  };
}
