/**
 * Cours de ferme sur les plans de cités et de hameaux : bétail (jetons vus du dessus de la Banque Loresmith) et objets de
 * cour (meule, abreuvoir, charrette, puits…) autour de chaque corps de ferme (`ground.fm`), à leur taille réelle.
 *
 * Déterministe (même plan, même saison → mêmes bêtes aux mêmes places). Rien ne se pose sur un bâtiment ni sur une rue.
 * JavaScript pur : testé par banque.test.mjs.
 */
import { hash, pickElement } from './banque.js';

/** Bétail : nom de la créature dans la banque, taille d'un troupeau (min, max), poids. */
const HERDS = [
  { noms: ['Vache'], n: [2, 4], w: 3 }, { noms: ['Mouton'], n: [3, 6], w: 3 }, { noms: ['Cochon'], n: [2, 4], w: 2 },
  { noms: ['Cheval', 'Cheval de trait'], n: [1, 3], w: 2 }, { noms: ['Chèvre'], n: [2, 4], w: 1 }, { noms: ['Âne'], n: [1, 2], w: 1 },
];
const COUR = ['Poule', 'Coq', 'Oie', 'Canard'];
const COMPAGNONS = ['Chien', 'Chat'];
/** Objets de cour, par usage (cf. scripts/banque/build.py). */
const OBJETS = ['foin', 'ecurie', 'charrette', 'puits', 'bois', 'fumier', 'tonneau', 'sac', 'outil', 'seau'];

function rng(seed) {
  let a = hash(seed) | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Le point (x, y) tombe-t-il dans un bâtiment (`b` : x, y, l, p, angle ; marge `pad`) ? */
function inBuilding(b, x, y, pad) {
  for (let i = 0; i + 4 < b.length; i += 5) {
    const [cx, cy, w, d, ang] = b.slice(i, i + 5);
    const c = Math.cos(-ang), s = Math.sin(-ang), dx = x - cx, dy = y - cy;
    if (Math.abs(dx * c - dy * s) <= w / 2 + pad && Math.abs(dx * s + dy * c) <= d / 2 + pad) return true;
  }
  return false;
}
/** … ou sur une rue, une rivière, un mur (`{ pts, hw }`) ? */
function onLine(lines, x, y, pad) {
  for (const l of lines ?? []) {
    const p = l.pts;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = p[i], ay = p[i + 1], bx = p[i + 2], by = p[i + 3];
      const vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / L));
      if (Math.hypot(x - ax - t * vx, y - ay - t * vy) <= (l.hw ?? 0) + pad) return true;
    }
  }
  return false;
}
const sizeOf = (img, fallback) => (Array.isArray(img?.taille) ? img.taille : typeof img?.taille === 'number' ? [img.taille, img.taille] : [fallback, fallback]);

/**
 * Sprites des cours de ferme d'un plan : { key, img, x, y, w, h, a } en unités du plan. `scale` : mètres par unité ;
 * `ctx` : { climat, saison } ; `seed` : identifiant du plan.
 */
export function farmyardSprites(ground, scale, images, ctx = {}, seed = '') {
  const fm = ground?.fm ?? [];
  if (!fm.length || !scale) return [];
  const M = (m) => m / scale;
  const beasts = new Map();
  for (const img of images) if (img.type === 'creature' && (img.region ?? ['surface']).includes('surface') && !img.exclu) beasts.set(img.nom, [...(beasts.get(img.nom) ?? []), img]);
  const herds = HERDS.filter((h) => h.noms.some((n) => beasts.has(n)));
  const pickBeast = (noms, r) => { const all = noms.flatMap((n) => beasts.get(n) ?? []); return all.length ? all[Math.floor(r() * all.length)] : null; };
  const blockers = [...(ground.b ?? [])];
  const lines = [...(ground.roads ?? []), ...(ground.water ?? []).filter((w) => !w.closed), ...(ground.walls ?? [])];
  const out = [];
  const taken = [];
  const winter = ctx.saison === 'hiver';
  for (let i = 0; i + 5 < fm.length; i += 6) {
    const [x, y, w, d, ang, face] = fm.slice(i, i + 6);
    const r = rng(`${seed}:ferme:${i}`);
    // La cour s'étend derrière le bâtiment (à l'opposé de la rue) et sur ses côtés.
    const back = face + Math.PI;
    const reach = Math.max(w, d) / 2;
    const place = (sizeM, key, img, spread = 1) => {
      const half = M(sizeM) / 2;
      for (let k = 0; k < 14; k++) {
        const a = back + (r() - 0.5) * Math.PI * 1.3 * spread;
        const dist = reach + M(2.5) + r() * M(9) * spread;
        const px = x + Math.cos(a) * dist, py = y + Math.sin(a) * dist;
        if (inBuilding(blockers, px, py, half + M(0.6)) || onLine(lines, px, py, half + M(0.8))) continue;
        if (taken.some(([tx, ty, tr]) => Math.hypot(tx - px, ty - py) < tr + half)) continue;
        taken.push([px, py, half]);
        out.push({ key, img, x: px, y: py, w: M(sizeM), h: M(sizeM), a: r() * Math.PI * 2 });
        return true;
      }
      return false;
    };
    // Objets de cour : deux à quatre, à leur taille réelle.
    const nObj = 2 + Math.floor(r() * 3);
    const usages = [...OBJETS].sort(() => r() - 0.5).slice(0, nObj);
    for (const usage of usages) {
      const img = pickElement(images, { cats: ['ferme'], usage, climat: ctx.climat, saison: ctx.saison, seed: `${seed}:ferme:${i}:${usage}` });
      if (!img?.usage?.includes(usage)) continue;
      const [tw, th] = sizeOf(img, 1.5);
      if (place(Math.max(tw, th), `fo${i}:${usage}`, img, 0.8) && (tw !== th)) {
        const sp = out[out.length - 1]; sp.w = M(tw); sp.h = M(th);
      }
    }
    // Un troupeau (en hiver, les bêtes restent surtout à l'étable), des volailles, parfois un chien ou un chat.
    if (herds.length) {
      const tot = herds.reduce((s, h) => s + h.w, 0);
      let pick = r() * tot, herd = herds[0];
      for (const h of herds) { pick -= h.w; if (pick <= 0) { herd = h; break; } }
      let n = herd.n[0] + Math.floor(r() * (herd.n[1] - herd.n[0] + 1));
      if (winter) n = Math.min(n, 1);
      for (let k = 0; k < n; k++) {
        const img = pickBeast(herd.noms, r); if (!img) break;
        place(sizeOf(img, 2)[0], `fb${i}:${k}`, img, 1.2);
      }
    }
    const birds = winter ? Math.floor(r() * 2) : 2 + Math.floor(r() * 4);
    for (let k = 0; k < birds; k++) { const img = pickBeast(COUR, r); if (img) place(sizeOf(img, 0.5)[0], `fv${i}:${k}`, img, 0.7); }
    if (r() < 0.45) { const img = pickBeast(COMPAGNONS, r); if (img) place(sizeOf(img, 1)[0], `fc${i}`, img, 0.5); }
  }
  return out;
}
