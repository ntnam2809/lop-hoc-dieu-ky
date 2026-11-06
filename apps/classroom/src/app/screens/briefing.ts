import { orderedActivities } from '../../engine/content/package';
import { activityIcon, activityTypeName, icons } from '../../engine/icons';
import { sound } from '../../engine/fx/audio';
import { catalog, lessonBundle } from '../state';
import { go } from '../router';
import { coverArt, floatingDecor, h, statusBadge, topbar } from '../widgets';

/** "Trước hoạt động" — trang chuẩn bị cho giáo viên. */
export async function briefingScreen(root: HTMLElement, lessonId: string): Promise<() => void> {
  const [cat, bundle] = await Promise.all([catalog(), lessonBundle(lessonId)]);
  const l = bundle.lesson;
  const d = cat.domains.find((x) => x.id === l.domainId);
  const acts = orderedActivities(bundle);

  const page = h('main', 'page page-brief');
  if (d) {
    page.style.setProperty('--primary', d.theme.primary);
    page.style.setProperty('--accent', d.theme.accent);
    page.style.setProperty('--soft', d.theme.soft);
  }
  page.append(floatingDecor(), topbar({ back: () => go(d ? { name: 'domain', id: d.id } : { name: 'home' }) }));

  const hero = h('section', 'brief-hero');
  const art = h('div', 'brief-art');
  art.append(await coverArt(l.cover, bundle.assets));
  const info = h('div', 'brief-info');
  const chips = h('div', 'chips');
  const clock = h('span', 'chip');
  clock.innerHTML = `${icons.clock}${l.estimatedMinutes} phút`;
  const n = h('span', 'chip');
  n.innerHTML = `${icons.list}${acts.length} hoạt động`;
  const age = h('span', 'chip', {}, [`${l.targetAge} tuổi`]);
  chips.append(clock, n, age, statusBadge(l.status));
  const start = h('button', 'btn btn-start', { type: 'button', 'data-action': 'start' });
  start.innerHTML = `${icons.play}<span>Bắt đầu bài học</span>`;
  start.addEventListener('click', () => {
    sound.unlock();
    sound.play('fanfare');
    go({ name: 'play', id: l.id });
  });
  info.append(h('span', 'domain-name', {}, [d?.title ?? '']), h('h1', '', {}, [l.title]), h('p', 'brief-sub', {}, [l.subtitle ?? '']), chips, h('p', 'brief-overview', {}, [l.teacherGuide.overview]), start);
  if (l.status !== 'published') {
    info.append(h('p', 'review-note', {}, ['Nội dung do AI hỗ trợ soạn, đang chờ chuyên môn duyệt. Cô xem kỹ trước khi dùng chính thức.']));
  }
  hero.append(art, info);

  const grid = h('section', 'brief-grid');
  const panel = (title: string, icon: string, items: Array<string | Node>, cls = '') => {
    const p = h('article', `brief-panel ${cls}`);
    const ht = h('h2', '');
    ht.innerHTML = `${icon}<span>${title}</span>`;
    const ul = h('ul');
    items.forEach((it) => ul.append(h('li', '', {}, [it])));
    p.append(ht, ul);
    return p;
  };
  grid.append(
    panel('Mục tiêu', icons.target, l.learningObjectives.map((o) => o.text), 'objectives'),
    panel('Chuẩn bị', icons.box, [...l.teacherGuide.materials, ...l.teacherGuide.preparation]),
    panel('Quan sát mong đợi', icons.eye, l.teacherGuide.expectedObservations),
    panel('Câu hỏi mở rộng', icons.bulb, l.teacherGuide.extensionQuestions),
  );

  // Dòng hoạt động — mỗi bước có câu hỏi gợi ý cho cô (mở/đóng).
  const flow = h('section', 'flow');
  flow.append(h('h2', 'flow-title', {}, ['Tiến trình & câu hỏi gợi ý']));
  const list = h('ol', 'flow-list');
  acts.forEach((a, i) => {
    const li = h('li', 'flow-item');
    const head = h('button', 'flow-head', { type: 'button', 'aria-expanded': 'false' });
    const ic = h('span', 'flow-icon');
    ic.innerHTML = activityIcon[a.type] ?? icons.star;
    head.append(h('span', 'flow-num', {}, [String(i + 1)]), ic, h('span', 'flow-type', {}, [activityTypeName[a.type] ?? a.type]), h('span', 'flow-instr', {}, [a.instruction]));
    const body = h('div', 'flow-body');
    const pr = h('ul', 'prompts');
    a.teacherPrompts.forEach((p) => pr.append(h('li', '', {}, [`“${p}”`])));
    body.append(pr);
    if (a.observation) body.append(h('p', 'observe', {}, [a.observation]));
    head.addEventListener('click', () => {
      const open = li.classList.toggle('open');
      head.setAttribute('aria-expanded', String(open));
      sound.play('tap');
    });
    li.append(head, body);
    list.append(li);
  });
  flow.append(list);

  page.append(hero, grid, flow);
  root.replaceChildren(page);
  return () => {};
}
