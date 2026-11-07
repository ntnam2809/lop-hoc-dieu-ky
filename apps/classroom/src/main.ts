// Font đóng gói cùng app (có bộ chữ tiếng Việt) — chạy được cả khi lớp học mất mạng.
import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/baloo-2/800.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './styles/base.css';
import './styles/pages.css';
import './styles/stage.css';
import './styles/activities.css';
import { parse, type Route } from './app/router';
import { applySettings } from './app/state';
import { homeScreen } from './app/screens/home';
import { domainScreen } from './app/screens/domain';
import { briefingScreen } from './app/screens/briefing';
import { playScreen } from './app/screens/play';
import { summaryScreen } from './app/screens/summary';
import { errorView } from './app/screens/shared';

const root = document.getElementById('app')!;
let cleanup: () => void = () => {};
let token = 0;

async function render(route: Route) {
  const my = ++token;
  cleanup();
  cleanup = () => {};
  document.body.dataset.route = route.name;
  window.scrollTo(0, 0);
  try {
    let c: () => void;
    switch (route.name) {
      case 'home': c = await homeScreen(root); break;
      case 'domain': c = await domainScreen(root, route.id); break;
      case 'lesson': c = await briefingScreen(root, route.id); break;
      case 'play': c = await playScreen(root, route.id, route.at); break;
      case 'summary': c = await summaryScreen(root, route.id); break;
    }
    if (my !== token) c();
    else cleanup = c;
  } catch (err) {
    if (my === token) errorView(root, err, () => render(route));
  }
}

applySettings();
window.addEventListener('hashchange', () => render(parse()));
void render(parse());
