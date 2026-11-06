import { Player } from '../../engine/runtime/player';
import { AssetStore } from '../../engine/runtime/assets';
import { referencedAssetIds } from '../../engine/content/package';
import { activityIcon, activityTypeName, icons } from '../../engine/icons';
import { sound } from '../../engine/fx/audio';
import { narrator } from '../../engine/fx/speech';
import { catalog, lessonBundle, setLastRun, settings } from '../state';
import { go } from '../router';
import { h, iconButton } from '../widgets';

/** Màn trình chiếu: sân khấu cho trẻ + bảng điều khiển của giáo viên. */
export async function playScreen(root: HTMLElement, lessonId: string, startAt = 0): Promise<() => void> {
  const [cat, bundle] = await Promise.all([catalog(), lessonBundle(lessonId)]);
  const domain = cat.domains.find((d) => d.id === bundle.lesson.domainId);

  const page = h('main', 'page-play');
  if (domain) {
    page.style.setProperty('--primary', domain.theme.primary);
    page.style.setProperty('--accent', domain.theme.accent);
    page.style.setProperty('--soft', domain.theme.soft);
  }
  const stageBox = h('div', 'play-stage');
  page.append(stageBox);
  root.replaceChildren(page);

  // ── Tải trước asset ─────────────────────────────────────────────
  const loader = h('div', 'loader');
  const bar = h('div', 'loader-bar', {}, [h('span')]);
  loader.append(h('div', 'loader-dots', {}, [h('i'), h('i'), h('i')]), h('p', '', {}, ['Đang chuẩn bị sân khấu…']), bar);
  page.append(loader);
  const assets = new AssetStore(bundle.assets);
  const failed = await assets.preload(referencedAssetIds(bundle), (p) => {
    (bar.firstChild as HTMLElement).style.width = `${Math.round(p * 100)}%`;
  });
  if (failed.length) console.warn('[assets] thiếu:', failed);
  loader.classList.add('out');
  setTimeout(() => loader.remove(), 400);

  const player = new Player(stageBox, bundle, assets, {
    autoAdvance: settings.autoAdvance,
    transitionColor: domain?.theme.primary,
  });
  (window as unknown as { __player?: Player }).__player = player;

  // ── HUD trên: thoát · tên bài · tiến trình ─────────────────────
  const hud = h('div', 'hud-top');
  const exit = iconButton(icons.close, 'Thoát bài học', () => go({ name: 'lesson', id: lessonId }), 'hud-exit');
  const title = h('div', 'hud-title');
  const titleMain = h('b', '', {}, [bundle.lesson.title]);
  const titleSub = h('small');
  title.append(titleMain, titleSub);
  const dots = h('div', 'progress-dots');
  const dotEls = player.activities.map((a, i) => {
    const d = h('button', 'pdot', { type: 'button', 'aria-label': `${i + 1}. ${activityTypeName[a.type] ?? a.type}`, title: `${i + 1}. ${a.instruction}` });
    d.innerHTML = activityIcon[a.type] ?? icons.star;
    d.addEventListener('click', () => void player.goTo(i));
    dots.append(d);
    return d;
  });
  hud.append(exit, title, dots);

  // ── Bảng điều khiển của giáo viên ───────────────────────────────
  const dock = h('nav', 'dock', { 'aria-label': 'Điều khiển của giáo viên' });
  const btn = (icon: string, label: string, key: string, fn: () => void, cls = '') => {
    const b = h('button', `dock-btn ${cls}`, { type: 'button', 'aria-label': label, 'data-dock': key });
    b.innerHTML = `${icon}<span>${label}</span>`;
    b.addEventListener('click', () => {
      sound.unlock();
      sound.play('tap');
      fn();
      showDock();
    });
    return b;
  };
  const prevBtn = btn(icons.prev, 'Trước', 'prev', () => player.prev());
  const pauseBtn = btn(icons.pause, 'Tạm dừng', 'pause', () => togglePause());
  const replayBtn = btn(icons.replay, 'Phát lại', 'replay', () => player.replay());
  const promptBtn = btn(icons.prompt, 'Gợi ý', 'prompt', () => toggleDrawer());
  const skipBtn = btn(icons.skip, 'Bỏ qua', 'skip', () => player.next());
  const nextBtn = btn(icons.next, 'Tiếp', 'next', () => player.next(), 'primary');
  dock.append(prevBtn, pauseBtn, replayBtn, promptBtn, skipBtn, nextBtn);
  const handle = h('button', 'dock-handle', { type: 'button', 'aria-label': 'Hiện bảng điều khiển' });
  handle.innerHTML = `${icons.hand}<span>Cô</span>`;
  handle.addEventListener('click', () => showDock());

  // ── Ngăn gợi ý cho giáo viên ────────────────────────────────────
  const drawer = h('aside', 'prompt-drawer', { 'aria-label': 'Gợi ý cho giáo viên' });
  const renderDrawer = () => {
    const a = player.current;
    drawer.replaceChildren();
    if (!a) return;
    const close = iconButton(icons.close, 'Đóng', () => toggleDrawer(false), 'drawer-close');
    const head = h('div', 'drawer-head');
    const ic = h('span', 'drawer-icon');
    ic.innerHTML = activityIcon[a.type] ?? icons.star;
    head.append(ic, h('div', '', {}, [h('small', '', {}, [`Hoạt động ${player.index + 1}/${player.activities.length}`]), h('b', '', {}, [activityTypeName[a.type] ?? a.type])]));
    const list = h('ul', 'drawer-prompts');
    a.teacherPrompts.forEach((p) => {
      const li = h('li');
      const say = iconButton(icons.speaker, 'Đọc to', () => void narrator.speak(p), 'mini');
      li.append(h('span', '', {}, [`“${p}”`]), say);
      list.append(li);
    });
    drawer.append(close, head, h('h4', '', {}, ['Câu hỏi gợi ý']), list);
    if (a.observation) drawer.append(h('h4', '', {}, ['Quan sát']), h('p', 'observe', {}, [a.observation]));
    const objs = bundle.lesson.learningObjectives.filter((o) => a.learningObjectives.includes(o.id));
    if (objs.length) {
      const ul = h('ul', 'drawer-objs');
      objs.forEach((o) => ul.append(h('li', '', {}, [o.text])));
      drawer.append(h('h4', '', {}, ['Mục tiêu']), ul);
    }
    drawer.append(h('p', 'kbd-help', {}, ['Phím tắt: ← → chuyển · Space tạm dừng · R phát lại · P gợi ý']));
  };
  const toggleDrawer = (force?: boolean) => {
    const open = force ?? !drawer.classList.contains('open');
    drawer.classList.toggle('open', open);
    promptBtn.classList.toggle('active', open);
    if (open) renderDrawer();
  };

  // ── Lớp tạm dừng ────────────────────────────────────────────────
  const pauseLayer = h('div', 'pause-layer');
  const pauseIcon = h('div', 'pause-badge');
  pauseIcon.innerHTML = icons.pause;
  pauseLayer.append(pauseIcon, h('p', '', {}, ['Tạm dừng — cả lớp cùng trò chuyện nhé!']), h('small', '', {}, ['Chạm để tiếp tục']));
  pauseLayer.addEventListener('click', () => togglePause(false));
  const togglePause = (force?: boolean) => {
    player.setPaused(force ?? !player.paused);
  };
  player.addEventListener('pause', (e) => {
    const p = (e as CustomEvent).detail.paused as boolean;
    page.classList.toggle('paused', p);
    pauseBtn.innerHTML = `${p ? icons.play : icons.pause}<span>${p ? 'Tiếp tục' : 'Tạm dừng'}</span>`;
  });

  page.append(hud, pauseLayer, drawer, dock, handle);

  // ── Ẩn bảng điều khiển khi không dùng chuột ─────────────────────
  let hideTimer = 0;
  const showDock = () => {
    page.classList.remove('dock-hidden');
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (!player.paused && !drawer.classList.contains('open')) page.classList.add('dock-hidden');
    }, 4000);
  };
  const onMouse = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') showDock();
  };
  window.addEventListener('pointermove', onMouse);
  // Trẻ chạm vào sân khấu → thu bảng điều khiển để không bấm nhầm nút của cô.
  stageBox.addEventListener('pointerdown', () => {
    if (!player.paused && !drawer.classList.contains('open')) page.classList.add('dock-hidden');
  });

  // ── Trạng thái theo hoạt động ───────────────────────────────────
  player.addEventListener('change', (e) => {
    const i = (e as CustomEvent).detail.index as number;
    const a = player.activities[i];
    titleSub.textContent = `${i + 1}/${player.activities.length} · ${activityTypeName[a.type] ?? a.type}`;
    dotEls.forEach((d, k) => {
      d.classList.toggle('current', k === i);
      d.classList.toggle('done', player.isCompleted(k));
    });
    prevBtn.disabled = i === 0;
    nextBtn.classList.remove('ready');
    nextBtn.querySelector('span')!.textContent = i === player.activities.length - 1 ? 'Kết thúc' : 'Tiếp';
    if (drawer.classList.contains('open')) renderDrawer();
  });
  player.addEventListener('complete', (e) => {
    const i = (e as CustomEvent).detail.index as number;
    dotEls[i]?.classList.add('done', 'pop');
    if (i === player.index) nextBtn.classList.add('ready');
    page.dataset.completed = String(player.session.completed.size);
  });
  player.addEventListener('finish', () => {
    setLastRun({ lessonId, session: player.session });
    go({ name: 'summary', id: lessonId });
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown') player.next();
    else if (k === 'ArrowLeft' || k === 'PageUp') player.prev();
    else if (k === ' ') togglePause();
    else if (k === 'r' || k === 'R') player.replay();
    else if (k === 'p' || k === 'P') toggleDrawer();
    else if (k === 'Escape') {
      if (drawer.classList.contains('open')) toggleDrawer(false);
      else if (player.paused) togglePause(false);
      else return;
    } else return;
    e.preventDefault();
    showDock();
  };
  window.addEventListener('keydown', onKey);

  // ── Màn "Sẵn sàng": một chạm để mở âm thanh/giọng đọc (yêu cầu của trình duyệt) ──
  const ready = h('div', 'ready-layer');
  const go_ = h('button', 'ready-btn', { type: 'button', 'data-action': 'ready' });
  go_.innerHTML = icons.play;
  ready.append(h('h1', '', {}, [bundle.lesson.title]), go_, h('p', '', {}, ['Chạm để bắt đầu']));
  page.append(ready);
  go_.addEventListener('click', () => {
    sound.unlock();
    sound.play('fanfare');
    ready.classList.add('out');
    setTimeout(() => ready.remove(), 500);
    showDock();
    void player.goTo(Math.min(Math.max(0, startAt), player.activities.length - 1));
  }, { once: true });
  if (new URLSearchParams(location.search).has('autostart')) go_.click();

  return () => {
    clearTimeout(hideTimer);
    window.removeEventListener('pointermove', onMouse);
    window.removeEventListener('keydown', onKey);
    player.destroy();
    delete (window as unknown as { __player?: Player }).__player;
  };
}
