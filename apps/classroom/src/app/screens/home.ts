import { getContentSource } from '../../engine/content/source';
import { icons } from '../../engine/icons';
import { sound } from '../../engine/fx/audio';
import { catalog } from '../state';
import { go } from '../router';
import { coverArt, floatingDecor, h, topbar } from '../widgets';
import { tiltCard } from './shared';

export async function homeScreen(root: HTMLElement): Promise<() => void> {
  const cat = await catalog();
  const source = await getContentSource();
  const assets = await source.loadAssets(cat.domains.flatMap((d) => d.cover?.layers.map((l) => l.asset) ?? []));

  const page = h('main', 'page page-home');
  page.append(floatingDecor(), topbar());

  const hero = h('section', 'hero');
  hero.append(
    h('p', 'hero-kicker', {}, ['Chào cô! Hôm nay lớp mình…']),
    h('h1', 'hero-title', {}, ['Cùng ', h('em', '', {}, ['khám phá']), ' điều gì nào?']),
    h('p', 'hero-sub', {}, ['Chọn một khu vực, rồi chọn bài. Trò chơi là đồ dùng dạy học — cô vẫn là người dẫn dắt.']),
  );

  const grid = h('section', 'domain-grid');
  for (const [i, d] of cat.domains.entries()) {
    const lessons = cat.lessons.filter((l) => l.domainId === d.id);
    const card = h('button', 'domain-card', { type: 'button', 'data-domain': d.id });
    card.style.setProperty('--primary', d.theme.primary);
    card.style.setProperty('--accent', d.theme.accent);
    card.style.setProperty('--soft', d.theme.soft);
    card.style.animationDelay = `${120 + i * 140}ms`;
    const art = h('div', 'domain-art');
    art.append(await coverArt(d.cover, assets));
    const body = h('div', 'domain-body');
    body.append(
      h('span', 'domain-name', {}, [d.name]),
      h('h2', 'domain-title', {}, [d.title]),
      h('p', 'domain-desc', {}, [d.description]),
    );
    if (d.learningLoop?.length) {
      const loop = h('div', 'loop');
      d.learningLoop.forEach((s, k) => {
        if (k) loop.append(h('span', 'loop-arrow', {}, ['→']));
        loop.append(h('span', 'loop-step', {}, [s]));
      });
      body.append(loop);
    }
    const foot = h('div', 'domain-foot');
    const go_ = h('span', 'domain-go');
    go_.innerHTML = `${lessons.length} bài học ${icons.next}`;
    foot.append(go_);
    body.append(foot);
    card.append(art, body);
    card.addEventListener('click', () => {
      sound.unlock();
      sound.play('pop');
      go({ name: 'domain', id: d.id });
    });
    tiltCard(card);
    grid.append(card);
  }
  page.append(hero, grid);
  if (!cat.domains.length) page.append(h('p', 'empty', {}, ['Chưa có nội dung đã xuất bản.']));
  if (source.name === 'local') {
    page.append(h('footer', 'source-note', {}, ['Đang dùng gói nội dung cục bộ (chế độ soạn & duyệt) — hiển thị cả bản nháp.']));
  }
  root.replaceChildren(page);
  return () => {};
}
