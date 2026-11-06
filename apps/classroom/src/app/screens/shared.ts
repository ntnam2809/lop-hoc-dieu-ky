/** Thẻ nghiêng 3D theo con trỏ — chỉ hiệu ứng trang trí cho màn giáo viên. */
export function tiltCard(el: HTMLElement, max = 7) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', `${-y * max}deg`);
    el.style.setProperty('--ry', `${x * max}deg`);
    el.style.setProperty('--gx', `${(x + 0.5) * 100}%`);
    el.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
  });
  el.addEventListener('pointerleave', () => {
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  });
}

export function errorView(root: HTMLElement, err: unknown, retry?: () => void) {
  console.error(err);
  const box = document.createElement('div');
  box.className = 'error-view';
  box.innerHTML = `<h2>Ôi, chưa tải được nội dung</h2><p></p>`;
  box.querySelector('p')!.textContent = err instanceof Error ? err.message : String(err);
  if (retry) {
    const b = document.createElement('button');
    b.className = 'btn btn-primary';
    b.textContent = 'Thử lại';
    b.onclick = retry;
    box.append(b);
  }
  const home = document.createElement('a');
  home.className = 'btn btn-ghost';
  home.href = '#/';
  home.textContent = 'Về trang chủ';
  box.append(home);
  root.replaceChildren(box);
}
