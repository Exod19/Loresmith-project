/**
 * Terrain naturel des plans de cité (d'après le prototype « loresmith-terrain » fourni par l'utilisateur).
 *
 * - Coordonnées en MÈTRES, globales au plan : un même point garde toujours le même aspect, quel que soit le cadrage.
 * - Herbe et terre nue en bruit de valeur à trois échelles (macro, moyenne, grain fin) ; teinte selon le climat,
 *   la saison et la neige.
 * - Routes : une seule surface de terre battue, union des distances à tous les segments (aucun anneau ni raccord aux
 *   carrefours, aucune bordure dessinée) ; bord irrégulier par un bruit.
 * - Places : pavés, polygones.
 * - Les segments sont indexés par cases (`index`) : chaque tuile ne regarde que les routes proches.
 *
 * Rendu seulement : rien ne change les règles de déplacement ni le sol de combat. JavaScript pur, testé.
 */
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

export function hash(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function noise(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y), u = smooth(x - i), v = smooth(y - j);
  return lerp(lerp(hash(i, j, s), hash(i + 1, j, s), u), lerp(hash(i, j + 1, s), hash(i + 1, j + 1, s), u), v);
}
function segDist(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, q = dx * dx + dy * dy;
  const t = q ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / q)) : 0;
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}
/** Distance signée au réseau (négative sur la chaussée) : union de toutes les routes, en mètres. */
export function roadDistance(x, y, segs) {
  let d = Infinity;
  for (const s of segs) d = Math.min(d, segDist(x, y, s[0], s[1], s[2], s[3]) - s[4]);
  return d;
}
/** Distance signée à un polygone (négative dedans). */
export function polygonDistance(x, y, pts) {
  let inside = false, d = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
    d = Math.min(d, segDist(x, y, a[0], a[1], b[0], b[1]));
  }
  return inside ? -d : d;
}

/** Teintes : herbe (deux bornes de la variation macro), terre nue, chemin. */
export function paletteOf({ climate = 'tempere', season, snow = 0 } = {}) {
  if (snow >= 0.3) return { grassA: [196, 204, 210], grassB: [226, 232, 236], bare: [170, 172, 170], dirt: [142, 132, 118], paving: [120, 118, 116] };
  if (climate === 'chaud') return { grassA: [112, 100, 58], grassB: [146, 128, 80], bare: [158, 132, 90], dirt: [176, 148, 104], paving: [150, 136, 112] };
  if (climate === 'froid') return { grassA: [48, 56, 46], grassB: [74, 82, 70], bare: [98, 94, 86], dirt: [120, 110, 94], paving: [110, 108, 104] };
  if (season === 'automne') return { grassA: [62, 60, 34], grassB: [96, 86, 46], bare: [100, 84, 54], dirt: [127, 109, 77], paving: [118, 112, 104] };
  if (season === 'hiver') return { grassA: [58, 60, 48], grassB: [84, 84, 68], bare: [96, 88, 70], dirt: [118, 104, 82], paving: [114, 110, 106] };
  return { grassA: [46, 58, 35], grassB: [80, 93, 58], bare: [91, 81, 53], dirt: [127, 109, 77], paving: [116, 112, 106] };
}

/**
 * Scène d'un plan : `roads` [{ points: [[x, y], …], width }] et `plazas` [{ points }] en mètres, `seed`, palette.
 * Renvoie { sample(x, y, detail), segmentsNear(x0, y0, x1, y1) }.
 */
export function createTerrain({ seed, roads = [], plazas = [], palette = paletteOf() }) {
  if (!Number.isFinite(seed)) throw new Error('seed requis');
  const segs = [];
  for (const r of roads) {
    if (!(r.width > 0) || r.points.length < 2) continue;
    for (let i = 1; i < r.points.length; i++) {
      const [ax, ay] = r.points[i - 1], [bx, by] = r.points[i];
      if ([ax, ay, bx, by].every(Number.isFinite)) segs.push([ax, ay, bx, by, r.width / 2]);
    }
  }
  // Index : cases de 32 m ; chaque segment est rangé dans les cases que couvre sa boîte élargie.
  const CELL = 32, grid = new Map();
  segs.forEach((s, k) => {
    const pad = s[4] + 6;
    for (let gx = Math.floor((Math.min(s[0], s[2]) - pad) / CELL); gx <= Math.floor((Math.max(s[0], s[2]) + pad) / CELL); gx++)
      for (let gy = Math.floor((Math.min(s[1], s[3]) - pad) / CELL); gy <= Math.floor((Math.max(s[1], s[3]) + pad) / CELL); gy++) {
        const key = `${gx},${gy}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(k);
      }
  });
  const segmentsNear = (x0, y0, x1, y1) => {
    const ks = new Set();
    for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++)
      for (let gy = Math.floor(y0 / CELL); gy <= Math.floor(y1 / CELL); gy++) for (const k of grid.get(`${gx},${gy}`) ?? []) ks.add(k);
    return [...ks].map((k) => segs[k]);
  };
  const P = palette;

  /** Couleur [r, g, b] du point (x, y) en mètres ; `detail` (0–1) atténue le grain quand on voit de loin. `near` : segments utiles. */
  function sample(x, y, detail = 1, near = segs, plz = plazas) {
    const macro = noise(x / 44, y / 44, seed), mid = noise(x / 9, y / 9, seed + 1), fine = noise(x / 0.7, y / 0.7, seed + 2);
    const grain = (fine - 0.5) * 18 * Math.min(1, detail);
    const t = clamp01(macro * 0.8 + mid * 0.2);
    let c = [0, 1, 2].map((i) => lerp(P.grassA[i], P.grassB[i], t));
    const bare = smooth(clamp01((noise(x / 28, y / 28, seed + 6) - 0.48) * 3));
    c = c.map((v, i) => lerp(v, P.bare[i], bare * 0.65) + grain);
    // Une seule distance d'union : pas de contour, pas de double couche aux carrefours.
    let rd = near.length ? roadDistance(x, y, near) : Infinity;
    rd += (noise(x / 5, y / 5, seed + 3) - 0.5) * 1.2 + (noise(x / 1.2, y / 1.2, seed + 4) - 0.5) * 0.3;
    const edge = smooth(clamp01((1 - rd) / 2));
    if (edge > 0) {
      const dirt = [0, 1, 2].map((i) => P.dirt[i] + mid * 16 + grain);
      c = c.map((v, i) => lerp(v, dirt[i], edge));
    }
    if (plz.length) {
      let pd = Infinity;
      for (const p of plz) pd = Math.min(pd, polygonDistance(x, y, p.points));
      const paving = smooth(clamp01((0.4 - pd) / 0.8));
      if (paving > 0) {
        // Pavés de 60 × 40 cm, joints de 6 cm, rangs décalés.
        const row = Math.floor(y / 0.4), xx = x + (row % 2) * 0.3, bx = Math.floor(xx / 0.6);
        const fx = ((xx % 0.6) + 0.6) % 0.6, fy = ((y % 0.4) + 0.4) % 0.4;
        const mortar = detail > 0.5 && (fx < 0.06 || fy < 0.06);
        const v = hash(bx, row, seed + 9);
        const k = mortar ? 0.6 : 0.9 + v * 0.25;
        c = c.map((a, i) => lerp(a, P.paving[i] * k + grain * 0.35, paving));
      }
    }
    return c.map((v) => Math.max(0, Math.min(255, Math.round(v))));
  }
  return { sample, segmentsNear, segments: segs };
}

/**
 * Peint une tuile : `px` × `px` pixels couvrant le carré [x0, x0 + size] × [y0, y0 + size] (mètres). Renvoie les octets
 * RGBA (Uint8ClampedArray), prêts pour un ImageData.
 */
export function paintTile(terrain, plazas, x0, y0, size, px) {
  const out = new Uint8ClampedArray(px * px * 4);
  const near = terrain.segmentsNear(x0 - 8, y0 - 8, x0 + size + 8, y0 + size + 8);
  const plz = plazas.filter((p) => p.points.some(([x, y]) => x > x0 - size && x < x0 + 2 * size && y > y0 - size && y < y0 + 2 * size));
  const detail = Math.min(1, px / size / 2); // pixels par mètre / 2 : grain complet dès 2 px par mètre
  for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) {
    const c = terrain.sample(x0 + ((i + 0.5) * size) / px, y0 + ((j + 0.5) * size) / px, detail, near, plz);
    const k = (j * px + i) * 4;
    out[k] = c[0]; out[k + 1] = c[1]; out[k + 2] = c[2]; out[k + 3] = 255;
  }
  return out;
}
