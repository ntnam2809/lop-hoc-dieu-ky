export type Route =
  | { name: 'home' }
  | { name: 'domain'; id: string }
  | { name: 'lesson'; id: string }
  | { name: 'play'; id: string; at?: number }
  | { name: 'summary'; id: string };

export function parse(hash = location.hash): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'domain':
      return parts[1] ? { name: 'domain', id: parts[1] } : { name: 'home' };
    case 'lesson':
      return parts[1] ? { name: 'lesson', id: parts[1] } : { name: 'home' };
    case 'play':
      return parts[1] ? { name: 'play', id: parts[1], at: parts[2] ? Number(parts[2]) : undefined } : { name: 'home' };
    case 'summary':
      return parts[1] ? { name: 'summary', id: parts[1] } : { name: 'home' };
    default:
      return { name: 'home' };
  }
}

export function href(r: Route): string {
  switch (r.name) {
    case 'home':
      return '#/';
    case 'play':
      return `#/play/${encodeURIComponent(r.id)}${r.at !== undefined ? `/${r.at}` : ''}`;
    default:
      return `#/${r.name}/${encodeURIComponent(r.id)}`;
  }
}

export function go(r: Route) {
  location.hash = href(r);
}
