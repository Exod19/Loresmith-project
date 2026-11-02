/**
 * Rend un élément visible en ne faisant défiler que son conteneur le plus proche (liste, bandeau), jamais la page :
 * moins coûteux que `scrollIntoView`, qui recalcule la mise en page de tous les ancêtres et peut décaler l'écran.
 */
export function revealIn(el: Element | null | undefined, smooth = false) {
  if (!(el instanceof HTMLElement)) return;
  // À l'image suivante : la mise en page est alors calculée une seule fois, avec le reste du rendu.
  requestAnimationFrame(() => { if (el.isConnected) reveal(el, smooth); });
}

function reveal(el: HTMLElement, smooth: boolean) {
  let box = el.parentElement;
  while (box && box !== document.body) {
    const s = getComputedStyle(box);
    if (/(auto|scroll)/.test(s.overflowX + s.overflowY) && (box.scrollWidth > box.clientWidth || box.scrollHeight > box.clientHeight)) break;
    box = box.parentElement;
  }
  if (!box || box === document.body) return;
  const a = box.getBoundingClientRect(), b = el.getBoundingClientRect();
  let dx = 0, dy = 0;
  if (b.left < a.left) dx = b.left - a.left; else if (b.right > a.right) dx = b.right - a.right;
  if (b.top < a.top) dy = b.top - a.top; else if (b.bottom > a.bottom) dy = b.bottom - a.bottom;
  if (dx || dy) box.scrollBy({ left: dx, top: dy, behavior: smooth ? 'smooth' : 'auto' });
}
