/** Tạo phần tử DOM gọn: h('div', 'class', { attr }, [children]). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = '',
  attrs: Record<string, string> = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) el.append(c);
  return el;
}
