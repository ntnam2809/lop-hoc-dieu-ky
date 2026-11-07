import { getContentSource } from '../../engine/content/source';
import { icons } from '../../engine/icons';
import { sound } from '../../engine/fx/audio';
import { catalog } from '../state';
import { go } from '../router';
import { coverArt, floatingDecor, h, statusBadge, topbar } from '../widgets';
import { tiltCard } from './shared';

export async function domainScreen(root: HTMLElement, domainId: string): Promise<() => void> {
  const cat = await catalog();
  const d = cat.domains.find((x) => x.id === domainId);
  if (!d) throw new Error('Không tìm thấy khu vực học');
  const source = await getContentSource();
  const lessons = cat.lessons.filter((l) => l.domainId === d.id);
  const assets = await source.loadAssets(lessons.flatMap((l) => l.cover?.layers.map((x) => x.asset) ?? []));

  const page = h('main', 'page page-domain');
  page.style.setProperty('--primary', d.theme.primary);
  page.style.setProperty('--accent', d.theme.accent);
  page.style.setProperty('--soft', d.theme.soft);
  page.append(floatingDecor(), topbar({ back: () => go({ name: 'home' }) }));

  const head = h('section', 'domain-head');
  head.append(h('span', 'domain-name', {}, [d.name]), h('h1', '', {}, [d.title]), h('p', '', {}, [d.description]));
  page.append(head);

  const topics = cat.topics.filter((t) => t.domainId === d.id);
  for (const t of topics) {
    const tl = lessons.filter((l) => l.topicId === t.id);
    if (!tl.length) continue;
    const sec = h('section', 'topic');
    sec.append(h('h2', 'topic-title', {}, [t.name]), h('p', 'topic-desc', {}, [t.description]));
    const grid = h('div', 'lesson-grid');
    for (const [i, l] of tl.entries()) {
      const card = h('button', 'lesson-card', { type: 'button', 'data-lesson': l.id });
      card.style.animationDelay = `${100 + i * 110}ms`;
      const art = h('div', 'lesson-art');
      art.append(await coverArt(l.cover, assets));
      const meta = h('div', 'lesson-meta');
      const chips = h('div', 'chips');
      const clock = h('span', 'chip');
      clock.innerHTML = `${icons.clock}${l.estimatedMinutes} phút`;
      const obj = h('span', 'chip');
      obj.innerHTML = `${icons.target}${l.learningObjectives.length} mục tiêu`;
      chips.append(clock, obj, statusBadge(l.status));
      meta.append(h('h3', '', {}, [l.title]), h('p', '', {}, [l.subtitle ?? '']), chips);
      card.append(art, meta);
      card.addEventListener('click', () => {
        sound.play('pop');
        go({ name: 'lesson', id: l.id });
      });
      tiltCard(card, 5);
      grid.append(card);
    }
    sec.append(grid);
    page.append(sec);
  }
  root.replaceChildren(page);
  return () => {};
}
