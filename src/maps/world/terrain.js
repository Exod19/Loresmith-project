/**
 * Terrain du monde, version 2 : un relief continu en kilomètres (altitude, climat, humidité, forêts), défini partout par
 * des bruits lisses tirés de la graine du monde. Agrandir le monde ne change donc rien à ce qui est déjà dessiné.
 *
 *  - Échelle par monde : région (~50 km), royaume (~500 km) ou continent (~2000 km). Tout est à taille réelle : une
 *    chaîne de montagnes fait des centaines de kilomètres, une forêt des dizaines, une cité un ou deux.
 *  - Mers : seulement là où le monde en a (cités portuaires). Côtes irrégulières : baies, péninsules, îles.
 *  - Montagnes : altitude réelle (jusqu'à ~4 000 m), neige en altitude, pentes raides au combat.
 *  - Distances en km et en jours (rythmes de D&D 5e), routes tracées par les vallées (A* sur le relief).
 *
 * JavaScript pur, déterministe : testé par world.test.mjs. Le dessin du relief (renderRelief) produit des pixels ; la
 * mise en image se fait dans le navigateur (MapCanvas).
 */
import { biomeOf, smoothNoise, temperatureAt } from './climate.js';
import { SNOW_LINE } from './seasons.js';

/** Échelles d'un monde : mètres par unité de plan, et taille de départ (km). */
export const SCALES = {
  region: { label: 'Région (~50 km)', m: 40, w: 50, h: 35 },
  royaume: { label: 'Royaume (~500 km)', m: 400, w: 500, h: 350 },
  continent: { label: 'Continent (~2 000 km)', m: 1600, w: 2000, h: 1400 },
};
/** Rythmes de voyage de D&D 5e (18, 24, 30 milles par jour), en km par jour. */
export const PACE = { lent: 29, normal: 38, rapide: 48 };
/** Autres moyens (estimations) : à cheval (relais), en charrette, en navire à voile. */
export const TRAVEL = { pied: 38, cheval: 50, charrette: 29, navire: 120 };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;
const r5 = (v) => Math.round(v * 1e5) / 1e5;
/** Hachage FNV-1a (même principe que generate.js, recopié pour éviter une dépendance circulaire). */
const hash = (text) => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const prng = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/* ——— Cadre du monde : échelle, bornes (km), taille du plan (unités) ——— */

/**
 * Cadre d'un monde. Un monde créé avant le lot 12 (sans `terrain: 2`) garde l'ancienne carte : 1240 × 860 unités de
 * 40 m, positions des cités en 0–1.
 */
export function worldFrame(world) {
  if (world?.terrain !== 2) return { legacy: true, scale: 'region', m: 40, x0: 0, y0: 0, x1: 49.6, y1: 34.4, W: 1240, H: 860, lat: [0, 34.4] };
  const key = SCALES[world.scale] ? world.scale : 'royaume';
  const sc = SCALES[key];
  const b = world.bounds ?? [-sc.w / 2, -sc.h / 2, sc.w / 2, sc.h / 2];
  return {
    legacy: false, scale: key, m: sc.m, x0: b[0], y0: b[1], x1: b[2], y1: b[3],
    W: Math.round(((b[2] - b[0]) * 1000) / sc.m), H: Math.round(((b[3] - b[1]) * 1000) / sc.m),
    // Latitudes du climat : celles du monde de départ (l'agrandir vers le nord donne des terres plus froides).
    lat: world.lat ?? [-sc.h / 2, sc.h / 2],
  };
}
export const toAt = (f, [x, y]) => [r5((x - f.x0) / (f.x1 - f.x0)), r5((y - f.y0) / (f.y1 - f.y0))];
export const toKm = (f, [u, v]) => [r3(f.x0 + u * (f.x1 - f.x0)), r3(f.y0 + v * (f.y1 - f.y0))];
/** Position d'une cité en km (les anciens mondes la gardent en 0–1). */
export const cityKm = (f, c) => (c.km && !f.legacy ? c.km : toKm(f, c.at ?? [0.5, 0.5]));
/** Rayon d'une cité, faubourgs et champs compris (km) : même formule que generateCity. */
export function cityRadiusKm(c) {
  const pop = clamp(Math.round(Number(c.population) || 1500), 40, 25000);
  const village = c.village ?? pop < 400;
  const R = Math.sqrt(((pop / (village ? 45 : 170)) * 10000) / Math.PI);
  return (R * ((c.farms ?? true) ? 2.45 : 1.5)) / 1000;
}
/** Jours de voyage pour une distance (km) et un rythme. */
export const daysOf = (km, perDay = PACE.normal) => km / perDay;
/** « 3 jours », « ½ journée », « 2 h » : une durée de marche lisible. */
export function daysLabel(days) {
  if (days < 0.3) return `${Math.max(1, Math.round(days * 8))} h de marche`;
  if (days < 0.75) return '½ journée de marche';
  const d = Math.round(days * 2) / 2;
  return `${String(d).replace('.5', ' ½')} jour${d >= 2 ? 's' : ''} de marche`;
}
const DIRS = ['est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest', 'nord', 'nord-est'];
/** Direction (rose des vents) de `a` vers `b` (y vers le bas = sud). */
export const dirName = (a, b) => DIRS[((Math.round(Math.atan2(b[1] - a[1], b[0] - a[0]) / (Math.PI / 4)) % 8) + 8) % 8];
/** « au nord », « à l’est » : la préposition qui va avec une direction. */
export const atDir = (d) => (/^(est|ouest)/.test(d) ? `à l’${d}` : `au ${d}`);
export const DIR_ANGLE = Object.fromEntries(DIRS.map((d, i) => [d, (i * Math.PI) / 4]));

/* ——— Champs du relief ——— */

/** Descripteur du relief : tout ce qu'il faut pour le recalculer (dessin, combat), en JSON. */
export function reliefOf(world, frame, cities) {
  return {
    v: 2, seed: (world.seed ?? 1) >>> 0, m: frame.m, bounds: [frame.x0, frame.y0, frame.x1, frame.y1], lat: frame.lat,
    climate: { hemisphere: world.climate?.hemisphere ?? 'nord', range: world.climate?.range ?? 'complet' },
    season: world.season ?? null,
    seas: (world.seas ?? []).map((s) => ({ x: s.x, y: s.y, r: s.r, ...(s.ax && s.side ? { ax: s.ax, side: s.side } : {}) })),
    // Les cités aplanissent le terrain autour d'elles (une cité ne s'accroche pas à un pic) ; leurs champs colorent la campagne.
    flats: cities.map((c) => ({ x: r3(c.km[0]), y: r3(c.km[1]), r: r3(Math.max(cityRadiusKm(c), 0.4)), port: !!c.port })),
  };
}

const fieldCache = new Map();
/** Bruits d'un relief (gardés en mémoire) : longueurs d'onde en km, plus fines quand l'échelle est fine. */
function fieldsOf(relief) {
  const key = `${relief.seed}|${relief.m}`;
  let F = fieldCache.get(key);
  if (F) return F;
  const s = relief.seed, h = (k) => hash(`${s}:${k}`);
  const minW = (relief.m * 8) / 1000;
  const waves = [360, 180, 90, 45, 22, 11, 5.5, 2.8, 1.4, 0.7, 0.35].filter((w) => w >= minW);
  const amp = waves.map((w) => w ** 0.85), sum = amp.reduce((a, b) => a + b, 0);
  const base = waves.map((w) => smoothNoise(h(`b${w}`), w));
  F = {
    minW,
    fbm: (x, y) => { let v = 0; for (let i = 0; i < base.length; i++) v += base[i](x, y) * amp[i]; return v / sum; },
    mask: smoothNoise(h('mask'), 320), belt: smoothNoise(h('belt'), 420), r1: smoothNoise(h('r1'), 240), r2: smoothNoise(h('r2'), 95), r3: smoothNoise(h('r3'), Math.max(minW, 30)),
    moist: smoothNoise(h('moist'), 300), moist2: smoothNoise(h('m2'), 70),
    forest: smoothNoise(h('for'), 45), forest2: smoothNoise(h('for2'), Math.max(minW, 18)), canopy: smoothNoise(h('canopee'), Math.max(minW / 3, 0.05)),
    temp: smoothNoise(h('climat'), 150), temp2: smoothNoise(h('climat2'), 55), farm: smoothNoise(h('farm'), Math.max(minW / 2, 0.15)),
    coast: new Map(),
  };
  // Crêtes et vallées des montagnes : un bruit « en arêtes » sur plusieurs octaves.
  const rw = [70, 34, 16, 8, 4, 2].filter((w) => w >= minW);
  const rn = rw.map((w) => smoothNoise(h(`arete${w}`), w)), ra = rw.map((w) => w ** 0.7), rs = ra.reduce((a, b) => a + b, 0);
  F.rough = (x, y) => { let v = 0, wgt = 1; for (let i = 0; i < rn.length; i++) { const r = ridge(rn[i](x, y)) ** 2; v += r * ra[i] * wgt; wgt = 0.55 + 0.45 * r; } return v / rs; };
  // Une chaîne garantie dans le monde de départ (tous les royaumes ont leurs montagnes), tirée de la graine.
  const sc = Object.values(SCALES).find((x) => x.m === relief.m) ?? SCALES.royaume;
  const ar = prng(h('chaine'));
  const ac = [(ar() - 0.5) * sc.w * 0.6, (ar() - 0.5) * sc.h * 0.6], aa = ar() * Math.PI, al = sc.w * (0.2 + ar() * 0.15);
  F.chain = { ax: ac[0] - Math.cos(aa) * al, ay: ac[1] - Math.sin(aa) * al, bx: ac[0] + Math.cos(aa) * al, by: ac[1] + Math.sin(aa) * al, hw: sc.w * 0.045 };
  fieldCache.set(key, F);
  if (fieldCache.size > 8) fieldCache.delete(fieldCache.keys().next().value);
  return F;
}
/** Bruit des côtes d'une mer (baies, péninsules, îles), à l'échelle de la mer. */
function coastNoise(F, relief, sea) {
  const k = `${sea.r}`;
  let f = F.coast.get(k);
  if (!f) {
    const ws = [sea.r / 2, sea.r / 5, sea.r / 12, sea.r / 30, sea.r / 70].filter((w) => w >= F.minW / 2);
    const ns = ws.map((w, i) => smoothNoise(hash(`${relief.seed}:cote:${i}:${Math.round(w * 10)}`), w));
    const amp = ws.map((w) => w ** 0.7), sum = amp.reduce((a, b) => a + b, 0) || 1;
    f = (x, y) => { let v = 0; for (let i = 0; i < ns.length; i++) v += ns[i](x, y) * amp[i]; return v / sum; };
    F.coast.set(k, f);
  }
  return f;
}
const ridge = (n) => 1 - Math.abs(2 * n - 1);
/** Allongement d'une mer le long de son côté (les mers d'avant le lot 14 restent rondes). */
const seaStretch = (s) => (s.ax && s.side ? (s.side === 'N' || s.side === 'S' ? [s.ax, 1] : [1, s.ax]) : [1, 1]);
/** Distance « elliptique » au centre d'une mer (km, ramenée au rayon). */
const seaDist = (s, x, y) => { const [sx, sy] = seaStretch(s); return Math.hypot((x - s.x) / sx, (y - s.y) / sy); };

/** Altitude (m) en un point (km) : collines, chaînes de montagnes, plaines des cités, mers. */
export function elevationAt(relief, x, y) {
  const F = fieldsOf(relief);
  // Le bruit fractal se resserre autour de 0,5 : on lui rend du contraste (plaines basses, collines franches).
  const b = 0.5 + (F.fbm(x, y) - 0.5) * 2.3;
  let e = 40 + Math.max(0, b - 0.3) * 1000;
  // Les montagnes forment des chaînes : une zone propice, traversée de « ceintures » allongées.
  const mask = smooth(0.45, 0.62, F.mask(x, y)) * smooth(0.6, 0.88, ridge(F.belt(x, y)));
  if (mask > 0) {
    const rr = ridge(F.r1(x, y)) ** 2.2 * 0.6 + ridge(F.r2(x, y)) ** 2 * 0.4;
    e += mask * rr * (0.3 + 0.9 * F.rough(x, y)) * 3800;
  }
  {
    const { ax, ay, bx, by, hw } = F.chain;
    const vx = bx - ax, vy = by - ay, t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy), 0, 1);
    const d = Math.hypot(x - ax - vx * t, y - ay - vy * t) / (hw * (0.7 + 0.6 * F.mask(x * 3, y * 3)));
    if (d < 2.5) e += Math.exp(-d * d) * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.02)) ** 0.5 * (0.2 + 1.0 * F.rough(x, y)) * 3600;
  }
  for (const c of relief.flats) {
    const d = Math.hypot(x - c.x, y - c.y);
    if (d > c.r * 5.5) continue;
    // La plaine d'une cité a un contour irrégulier (pas un cratère rond).
    const a = Math.atan2(y - c.y, x - c.x), reach = c.r * (3 + 2.5 * F.farm(c.x * 3 + Math.cos(a) * 3.2, c.y * 3 + Math.sin(a) * 3.2));
    if (d < reach) e = Math.min(e, 220) + (e - Math.min(e, 220)) * smooth(c.r, reach, d);
  }
  for (const s of relief.seas) {
    const d = seaDist(s, x, y);
    if (d > s.r * 1.6) continue;
    const v = (s.r - d) / s.r + (coastNoise(F, relief, s)(x, y) - 0.5) * 0.7;
    e -= smooth(-0.06, 0.2, v) * (900 + 2500 * clamp(v, 0, 1));
  }
  // Une cité portuaire est sur la terre ferme, au bord de l'eau.
  for (const c of relief.flats) {
    if (!c.port) continue;
    const d = Math.hypot(x - c.x, y - c.y);
    if (d < c.r * 1.3) e = Math.max(e, 6 + 30 * (1 - d / (c.r * 1.3)));
  }
  return e;
}

/** Tout ce qu'on sait d'un point (km) : altitude, température, humidité, biome, densité de forêt. */
export function terrainAt(relief, x, y, e = elevationAt(relief, x, y)) {
  const F = fieldsOf(relief);
  const lat = (y - relief.lat[0]) / (relief.lat[1] - relief.lat[0]);
  const T = temperatureAt(relief.climate, lat, (F.temp(x, y) - 0.5) * 0.3 + (F.temp2(x, y) - 0.5) * 0.12) - Math.max(0, e) / 1000 * 0.11;
  const moist = clamp(0.6 * F.moist(x, y) + 0.4 * F.moist2(x, y) + (e < 150 ? 0.08 : 0), 0, 1);
  const snowLine = SNOW_LINE[relief.season] ?? 0.17;
  const sea = e < 0;
  let biome = sea ? 'mer' : T < snowLine ? 'neige' : biomeOf(T, moist);
  if (biome === 'neige' && T >= snowLine) biome = 'taiga';
  const rock = !sea && e > 1700;
  const fd = 0.55 * F.forest(x, y) + 0.45 * F.forest2(x, y) + (moist - 0.5) * 0.6;
  const thr = { taiga: 0.47, tempere: 0.56, steppe: 0.74 }[biome];
  const forest = !sea && !rock && thr !== undefined && e < 1900 ? smooth(thr, thr + 0.08, fd) : 0;
  return { e, T, moist, biome, forest, sea, rock };
}
/** Pente (m/m) en un point, sur une distance `step` (km). */
export function slopeAt(relief, x, y, step) {
  const dx = elevationAt(relief, x + step, y) - elevationAt(relief, x - step, y);
  const dy = elevationAt(relief, x, y + step) - elevationAt(relief, x, y - step);
  return Math.hypot(dx, dy) / (2 * step * 1000);
}

/* ——— Dessin du relief : couleurs du biome, ombrage des pentes, neige, mer ——— */

const COLORS = {
  neige: [232, 236, 239], taiga: [86, 104, 82], tempere: [111, 138, 74], steppe: [163, 154, 92], desert: [209, 180, 122],
  forest: { taiga: [44, 70, 52], tempere: [52, 88, 46], steppe: [92, 110, 60] },
  rock: [128, 120, 106], sand: [214, 196, 140], shallow: [64, 124, 140], deep: [26, 58, 78], field: [150, 140, 80],
};
const SEASON_TINT = {
  automne: { forest: [128, 78, 34], grass: [140, 128, 70] },
  ete: { grass: [138, 140, 70] },
  printemps: { grass: [98, 146, 70] },
  hiver: { grass: [120, 118, 98] },
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** Couleur du sol, fondue d'un biome à l'autre selon la température (et l'humidité dans le chaud). */
function groundColor(t, tint, snowLine) {
  const grass = tint.grass ?? COLORS.tempere;
  const dry = mix(COLORS.steppe, COLORS.desert, smooth(0.78, 0.9, t.T) * (1 - smooth(0.6, 0.85, t.moist)));
  const warm = mix(grass, dry, smooth(0.6, 0.74, t.T) * (1 - smooth(0.7, 0.9, t.moist) * 0.7));
  const cool = mix(COLORS.taiga, warm, smooth(0.26, 0.38, t.T));
  return mix(COLORS.neige, cool, smooth(snowLine - 0.02, snowLine + 0.05, t.T));
}

/**
 * Pixels du relief (RGBA, `w` × `h`) sur les bornes du monde. Calcul pur : le navigateur en fait une image.
 */
export function renderRelief(relief, w, h, win) {
  // `win` (km) : une fenêtre du monde, rendue plus finement quand on zoome.
  const [x0, y0, x1, y1] = win ?? relief.bounds;
  const px = (x1 - x0) / w, py = (y1 - y0) / h;
  const E = new Float32Array((w + 1) * (h + 1));
  for (let j = 0; j <= h; j++) for (let i = 0; i <= w; i++) E[j * (w + 1) + i] = elevationAt(relief, x0 + i * px, y0 + j * py);
  // Zoom avant : un micro-relief pour l'ombrage seulement (le terrain du jeu, lui, ne change pas). Plus marqué en montagne.
  const fine = [fieldsOf(relief).minW / 2, fieldsOf(relief).minW / 4, fieldsOf(relief).minW / 8].filter((wl) => wl >= px * 2.5);
  if (win && fine.length) {
    const ns = fine.map((wl) => [wl, smoothNoise(hash(`${relief.seed}:fin:${wl.toFixed(3)}`), wl)]);
    for (let j = 0; j <= h; j++) for (let i = 0; i <= w; i++) {
      const k = j * (w + 1) + i, e = E[k];
      if (e < 0) continue;
      // Coordonnées tournées : pas d'alignement sur la grille du bruit.
      const x = x0 + i * px, y = y0 + j * py, rx = x * 0.8 + y * 0.6, ry = y * 0.8 - x * 0.6;
      const m = smooth(600, 2200, e), rough = 0.025 + m * 0.25;
      let d = 0;
      for (const [wl, n] of ns) { const v = n(rx, ry); d += (m > 0.3 ? ridge(v) - 0.5 : v - 0.5) * wl * 1000 * rough; }
      E[k] = e + d;
    }
  }
  const out = new Uint8ClampedArray(w * h * 4);
  const F = fieldsOf(relief);
  const tint = SEASON_TINT[relief.season] ?? {};
  // Exagération du relief pour l'ombrage : plus forte quand un pixel couvre beaucoup de terrain.
  const ex = clamp((px * 1000) / 60, 2, 40);
  const L = [-0.6, -0.6, 0.53].map((v) => v / Math.hypot(0.6, 0.6, 0.53));
  // Symboles de carte (arbres, conifères, sommets, touffes d'herbe), dessinés dans l'image : une case de ~6 px, ancrée
  // sur une grille en km (puissance de deux) pour ne pas « grouiller » quand on fait glisser la carte.
  const ck = 2 ** Math.round(Math.log2(6 * px)), mk = ck * 2.5;
  const seedH = relief.seed | 0;
  const hh = (a, b, salt) => { let v = Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(seedH + salt, 83492791); v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
  const cellAt = (x, y, size, salt) => {
    const ci = Math.floor(x / size), cj = Math.floor(y / size);
    const cx = (ci + 0.5 + (hh(ci, cj, salt) - 0.5) * 0.6) * size, cy = (cj + 0.5 + (hh(ci, cj, salt + 1) - 0.5) * 0.6) * size;
    return { u: (x - cx) / size, v: (y - cy) / size, r: hh(ci, cj, salt + 2), q: hh(ci, cj, salt + 3) };
  };
  const step = px * 1000 < 300 ? 200 : 500;
  const shadeBy = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * (w + 1) + i;
    const e = (E[k] + E[k + 1] + E[k + w + 1] + E[k + w + 2]) / 4;
    const x = x0 + (i + 0.5) * px, y = y0 + (j + 0.5) * py;
    let c;
    if (e < 0) {
      c = mix(COLORS.shallow, COLORS.deep, clamp(-e / 1400, 0, 1));
      // Près des côtes : eaux claires, et un trait de rivage.
      const coast = E[k] >= 0 || E[k + 1] >= 0 || E[k + w + 1] >= 0 || E[k + w + 2] >= 0;
      if (coast) c = [32, 52, 60];
      else if (e > -90) c = mix(c, [120, 178, 186], (1 - -e / 90) * 0.45 * (0.75 + 0.25 * Math.sin((x + y) / (ck * 1.6))));
    } else {
      const t = terrainAt(relief, x, y, e);
      c = groundColor(t, tint, SNOW_LINE[relief.season] ?? 0.17);
      const fc = t.forest > 0 ? (t.biome === 'tempere' && tint.forest ? tint.forest : COLORS.forest[t.biome] ?? COLORS.forest.tempere) : null;
      if (fc) {
        // La canopée : un grain fin d'arbres, plus sombre au cœur de la forêt.
        c = mix(c, mix(fc, [fc[0] * 0.7, fc[1] * 0.7, fc[2] * 0.7], F.canopy(x, y)), t.forest * 0.75);
      }
      // Champs autour des cités : une marqueterie de parcelles.
      // Le terroir n'est pas un disque : son bord suit le terrain (bruit), avec des parcelles qui s'effilochent.
      const farmR = (f) => { const a = Math.atan2(y - f.y, x - f.x); return f.r * 2.2 * (0.55 + 0.9 * F.farm(f.x * 3 + Math.cos(a) * 3.2, f.y * 3 + Math.sin(a) * 3.2)); };
      let farmed = false;
      for (const f of relief.flats) {
        const d = Math.hypot(x - f.x, y - f.y), R = farmR(f);
        if (d < R && e < 600 && t.biome !== 'neige') { c = mix(c, COLORS.field, (1 - d / R) ** 0.6 * (0.3 + 0.45 * F.farm(x, y))); farmed = true; break; }
      }
      if (e > 1300) c = mix(c, COLORS.rock, smooth(1300, 2300, e));
      if (t.T < (SNOW_LINE[relief.season] ?? 0.17) + 0.02 && e > 900) c = mix(c, COLORS.neige, smooth(900, 1600, e));
      if (e < 14 && relief.seas.length) c = mix(c, COLORS.sand, 1 - e / 14);
      // Désert : des rides de dunes ; steppe et prairie : quelques touffes d'herbe.
      if (t.biome === 'desert' && !fc) c = shadeBy(c, 1 + 0.08 * Math.sin(((x * 0.8 + y * 0.35) / (ck * 2.4)) * 6.283 + F.moist2(x, y) * 14));
      // Courbes de niveau (tous les 500 m, 200 m de près) : on lit le relief même sans ombrage.
      const lv = Math.floor(E[k] / step);
      if (e > 60 && (lv !== Math.floor(E[k + 1] / step) || lv !== Math.floor(E[k + w + 1] / step))) c = shadeBy(c, 0.86);
      // Symboles.
      const cell = cellAt(x, y, ck, 11);
      if (fc && cell.r < t.forest * 0.95) {
        const dark = shadeBy(fc, 0.72), light = mix(fc, [200, 210, 150], 0.18);
        if (t.biome === 'taiga' || t.T < 0.3) {
          // Conifère : un triangle, face éclairée à gauche.
          const hw = 0.34 * ((cell.v + 0.5) / 0.9);
          if (cell.v > -0.5 && cell.v < 0.4 && Math.abs(cell.u) < hw) c = cell.u < 0 ? light : dark;
          else if (cell.v > -0.3 && cell.v < 0.5 && cell.u > 0 && cell.u < hw + 0.12) c = shadeBy(c, 0.8);
        } else {
          // Feuillu : une boule, éclairée en haut à gauche, avec son ombre portée.
          const d = Math.hypot(cell.u, cell.v);
          if (d < 0.4) c = cell.u + cell.v < -0.2 ? light : d > 0.28 && cell.u + cell.v > 0.05 ? dark : fc;
          else if (Math.hypot(cell.u - 0.12, cell.v - 0.12) < 0.42) c = shadeBy(c, 0.78);
        }
      } else if (!fc && (t.biome === 'steppe' || t.biome === 'tempere') && e < 1200 && cell.q < (t.biome === 'steppe' ? 0.32 : 0.14)) {
        // Touffe d'herbe : un petit « v ».
        if (Math.abs(cell.u) < 0.2 && Math.abs(cell.v - 0.1 - Math.abs(cell.u) * 1.2) < 0.07) c = shadeBy(c, 0.74);
      }
      // Sommets : un pic dessiné, face au soleil claire, versant opposé sombre, coiffé de neige quand il fait froid.
      if (e > 1800 && !fc) {
        const pk = cellAt(x, y, mk, 23);
        if (pk.r < 0.5) {
          const hw = 0.42 * ((pk.v + 0.45) / 0.85);
          if (pk.v > -0.45 && pk.v < 0.4 && Math.abs(pk.u) < hw) {
            const snowy = t.T < 0.3 || e > 2700;
            c = pk.v < -0.2 && snowy ? (pk.u < 0 ? [240, 243, 246] : [196, 206, 218]) : pk.u < 0 ? mix(COLORS.rock, [235, 225, 205], 0.35) : shadeBy(COLORS.rock, 0.62);
          }
        }
      }
      // Champs de près : les limites des parcelles.
      if (px < 0.15 && farmed) {
        const fs = 0.35, a = (x * 0.94 + y * 0.34) / fs, b = (y * 0.94 - x * 0.34) / (fs * 0.6);
        if (a - Math.floor(a) < 0.07 || b - Math.floor(b) < 0.07) c = shadeBy(c, 0.85);
      }
      // Ombrage des pentes (lumière du nord-ouest).
      const dx = ((E[k + 1] + E[k + w + 2]) - (E[k] + E[k + w + 1])) / (2 * px * 1000);
      const dy = ((E[k + w + 1] + E[k + w + 2]) - (E[k] + E[k + 1])) / (2 * py * 1000);
      const nx = -dx * ex, ny = -dy * ex, nl = Math.hypot(nx, ny, 1);
      const shade = clamp(1 + 0.95 * ((nx * L[0] + ny * L[1] + L[2]) / nl - L[2]), 0.5, 1.3);
      c = [c[0] * shade, c[1] * shade, c[2] * shade];
      // Neige à l'ombre : un reflet bleuté.
      if (t.biome === 'neige' && shade < 1) c = mix(c, [176, 192, 220], (1 - shade) * 0.8);
    }
    const o = (j * w + i) * 4;
    out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 255;
  }
  return out;
}

/* ——— Rivières, lacs, noms des forêts et des montagnes ——— */

/** Cases fixes (km) qui couvrent les bornes : chaque case a sa graine, ce qui garde le monde stable s'il s'agrandit. */
function cells(relief, size) {
  const [x0, y0, x1, y1] = relief.bounds;
  const out = [];
  for (let i = Math.floor(x0 / size); i * size < x1; i++) for (let j = Math.floor(y0 / size); j * size < y1; j++) out.push([i, j]);
  return out;
}
/** Taille des cases (km) d'un relief : proportionnelle à l'échelle. */
const cellKm = (relief, k) => (relief.m / 400) * k;
const inBounds = (relief, x, y, m = 0) => x > relief.bounds[0] - m && x < relief.bounds[2] + m && y > relief.bounds[1] - m && y < relief.bounds[3] + m;

/**
 * Rivières : elles naissent en altitude, là où il pleut, et descendent la pente jusqu'à la mer, au bord du monde ou à
 * un creux où elles forment un lac. `blob(rand, cx, cy, rx, ry)` dessine un lac.
 */
export function riversOf(relief, blob) {
  const size = cellKm(relief, 110), step = Math.max(fieldsOf(relief).minW * 0.6, size / 45);
  const rivers = [], lakes = [];
  const near = (x, y, d) => rivers.some((r) => r.pts.some(([px, py]) => Math.abs(px - x) < d && Math.abs(py - y) < d));
  for (const [i, j] of cells(relief, size)) {
    const r = prng(hash(`${relief.seed}:source:${i}:${j}`));
    let x = (i + 0.15 + r() * 0.7) * size, y = (j + 0.15 + r() * 0.7) * size;
    if (!inBounds(relief, x, y) || r() > 0.75) continue;
    const t0 = terrainAt(relief, x, y);
    if (t0.e < 650 || t0.moist < 0.4 || t0.biome === 'desert') continue;
    const pts = [[x, y]];
    let e = t0.e, prev = null, end = 'bord';
    for (let s = 0; s < 500; s++) {
      let best = null;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const nx = x + Math.cos(a) * step, ny = y + Math.sin(a) * step;
        let ne = elevationAt(relief, nx, ny);
        if (prev) ne += (1 - Math.cos(a - prev)) * 4; // un peu d'élan : pas de zigzag
        if (!best || ne < best.e) best = { x: nx, y: ny, e: ne, a };
      }
      if (best.e >= e + 2) { end = 'lac'; break; }
      x = best.x; y = best.y; e = Math.min(e, best.e); prev = best.a;
      pts.push([x, y]);
      if (e < 0) { end = 'mer'; break; }
      if (!inBounds(relief, x, y, step * 2)) break;
      if (s > 3 && near(x, y, step * 0.8)) { end = 'affluent'; break; }
    }
    if (pts.length < 6) continue;
    rivers.push({ id: `${i}_${j}`, pts, end });
    if (end === 'lac') {
      const lr = prng(hash(`${relief.seed}:lac:${i}:${j}`));
      const rx = step * (2.5 + lr() * 3);
      lakes.push({ id: `${i}_${j}`, x, y, poly: blob(lr, x, y, rx, rx * (0.6 + lr() * 0.3), 22) });
    }
  }
  // Quelques lacs de plaine, dans les creux humides.
  const ls = cellKm(relief, 140);
  for (const [i, j] of cells(relief, ls)) {
    const r = prng(hash(`${relief.seed}:etang:${i}:${j}`));
    if (r() > 0.35) continue;
    const x = (i + 0.2 + r() * 0.6) * ls, y = (j + 0.2 + r() * 0.6) * ls;
    if (!inBounds(relief, x, y)) continue;
    const t = terrainAt(relief, x, y);
    if (t.e < 20 || t.e > 400 || t.moist < 0.5 || relief.flats.some((c) => Math.hypot(c.x - x, c.y - y) < c.r * 6)) continue;
    const rx = ls * (0.03 + r() * 0.06);
    lakes.push({ id: `p${i}_${j}`, x, y, poly: blob(r, x, y, rx, rx * (0.55 + r() * 0.35), 22) });
  }
  return { rivers, lakes };
}

/** Forêts et chaînes de montagnes à nommer : le point le plus boisé (ou le plus haut) de chaque case. */
export function landmarksOf(relief) {
  const out = [];
  const fs = cellKm(relief, 80);
  for (const [i, j] of cells(relief, fs)) {
    let best = null;
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      const x = (i + (a + 0.5) / 3) * fs, y = (j + (b + 0.5) / 3) * fs;
      if (!inBounds(relief, x, y)) continue;
      const t = terrainAt(relief, x, y);
      if (t.forest > 0.85 && (!best || t.forest > best.f)) best = { x, y, f: t.forest, biome: t.biome };
    }
    if (best) out.push({ kind: 'foret', id: `${i}_${j}`, x: best.x, y: best.y, biome: best.biome });
  }
  const ms = cellKm(relief, 170);
  for (const [i, j] of cells(relief, ms)) {
    let best = null;
    for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) {
      const x = (i + (a + 0.5) / 5) * ms, y = (j + (b + 0.5) / 5) * ms;
      if (!inBounds(relief, x, y)) continue;
      const e = elevationAt(relief, x, y);
      if (e > 1900 && (!best || e > best.e)) best = { x, y, e };
    }
    if (best) out.push({ kind: 'monts', id: `${i}_${j}`, x: best.x, y: best.y, e: Math.round(best.e) });
  }
  return out;
}

/* ——— Routes et temps de voyage ——— */

/**
 * Grille de coût du voyage : la pente, la haute montagne et la forêt ralentissent ; la mer et les lacs bloquent.
 * `lakes` : polygones (km).
 */
export function travelGrid(relief, lakes = [], mode = 'terre') {
  const [x0, y0, x1, y1] = relief.bounds;
  const g = Math.max(fieldsOf(relief).minW * 1.2, (x1 - x0) / 220);
  const cols = Math.ceil((x1 - x0) / g) + 1, rows = Math.ceil((y1 - y0) / g) + 1;
  const E = new Float32Array(cols * rows), cost = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) E[j * cols + i] = elevationAt(relief, x0 + i * g, y0 + j * g);
  const inLake = (x, y) => lakes.some((p) => { let ins = false; for (let a = 0, b = p.length - 1; a < p.length; b = a++) { const [xa, ya] = p[a], [xb, yb] = p[b]; if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) ins = !ins; } return ins; });
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i, e = E[k];
        // Les navires longent volontiers les côtes et les îles (eaux moyennes), sans raser les hauts-fonds ; la haute mer coûte un peu plus.
    if (mode === 'mer') { cost[k] = e < -500 ? 1.35 : e < -15 ? 1 : e < 0 ? 1.4 : Infinity; continue; }
    if (e < 0) { cost[k] = Infinity; continue; }
    const dx = (E[j * cols + Math.min(cols - 1, i + 1)] - E[j * cols + Math.max(0, i - 1)]) / (2 * g * 1000);
    const dy = (E[Math.min(rows - 1, j + 1) * cols + i] - E[Math.max(0, j - 1) * cols + i]) / (2 * g * 1000);
    const slope = Math.hypot(dx, dy);
    const x = x0 + i * g, y = y0 + j * g;
    if (lakes.length && inLake(x, y)) { cost[k] = Infinity; continue; }
    const t = terrainAt(relief, x, y, e);
    cost[k] = 1 + slope * 30 + (e > 1800 ? 2.5 : 0) + t.forest * 0.5 + (t.biome === 'neige' ? 0.6 : 0);
  }
  return { g, cols, rows, x0, y0, cost, E };
}

/** Chemin le moins coûteux de `a` à `b` (km), par A* sur la grille ; lissé. Renvoie points (km), longueur et effort (km). */
export function routeOn(grid, a, b) {
  const { g, cols, rows, x0, y0, cost } = grid;
  const idx = ([x, y]) => clamp(Math.round((y - y0) / g), 0, rows - 1) * cols + clamp(Math.round((x - x0) / g), 0, cols - 1);
  const s = idx(a), t = idx(b);
  const tx = t % cols, ty = Math.floor(t / cols);
  const G = new Float32Array(cols * rows).fill(Infinity), from = new Int32Array(cols * rows).fill(-1);
  const heap = [];
  const pushH = (k, f) => { heap.push([f, k]); let n = heap.length - 1; while (n) { const p = (n - 1) >> 1; if (heap[p][0] <= heap[n][0]) break; [heap[p], heap[n]] = [heap[n], heap[p]]; n = p; } };
  const popH = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let n = 0; for (;;) { const l = 2 * n + 1, r = l + 1; let m = n; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === n) break; [heap[m], heap[n]] = [heap[n], heap[m]]; n = m; } } return top; };
  const cs = (k) => (k === s || k === t ? Math.min(cost[k], 3) : cost[k]);
  G[s] = 0; pushH(s, 0);
  const N8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  while (heap.length) {
    const [, k] = popH();
    if (k === t) break;
    const i = k % cols, j = Math.floor(k / cols);
    for (const [di, dj, w] of N8) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
      const nk = nj * cols + ni, c = (cs(k) + cs(nk)) / 2;
      if (!Number.isFinite(c)) continue;
      const ng = G[k] + c * w;
      if (ng < G[nk]) { G[nk] = ng; from[nk] = k; pushH(nk, ng + Math.hypot(tx - ni, ty - nj)); }
    }
  }
  if (!Number.isFinite(G[t])) return null;
  const cellsPath = [];
  for (let k = t; k !== -1; k = from[k]) cellsPath.push([x0 + (k % cols) * g, y0 + Math.floor(k / cols) * g]);
  cellsPath.reverse();
  // Simplifier (Douglas-Peucker) puis lisser (Chaikin) : une route qui suit le terrain sans marches d'escalier.
  const simp = (pts, tol) => {
    if (pts.length < 3) return pts;
    let md = 0, mi = 0;
    const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1], L = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L; if (d > md) { md = d; mi = i; } }
    return md > tol ? [...simp(pts.slice(0, mi + 1), tol).slice(0, -1), ...simp(pts.slice(mi), tol)] : [pts[0], pts[pts.length - 1]];
  };
  let pts = [a, ...simp(cellsPath, g * 0.6).slice(1, -1), b];
  for (let n = 0; n < 2; n++) {
    const o = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) { const [p, q] = [pts[i], pts[i + 1]]; o.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25], [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]); }
    o.push(pts[pts.length - 1]); pts = o;
  }
  let km = 0, effort = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const c = cost[idx(pts[i])];
    km += d;
    // Sur une route, la forêt ne ralentit plus ; la pente, si (lacets, cols).
    effort += d * (Number.isFinite(c) ? 1 + Math.max(0, c - 1) * 0.35 : 1);
  }
  return { pts: pts.map(([x, y]) => [r3(x), r3(y)]), km: r1(km), effort: r1(effort) };
}

/** Point d'eau navigable le plus proche (km) d'un port, dans un rayon donné : le départ d'une traversée. */
export function nearestWater(grid, km, maxKm) {
  const { g, cols, rows, x0, y0, cost } = grid;
  const ci = Math.round((km[0] - x0) / g), cj = Math.round((km[1] - y0) / g), n = Math.ceil(maxKm / g);
  let best = null;
  for (let j = Math.max(0, cj - n); j <= Math.min(rows - 1, cj + n); j++) for (let i = Math.max(0, ci - n); i <= Math.min(cols - 1, ci + n); i++) {
    if (!Number.isFinite(cost[j * cols + i])) continue;
    const d = Math.hypot(i - ci, j - cj);
    if (!best || d < best.d) best = { d, p: [x0 + i * g, y0 + j * g] };
  }
  return best ? best.p : null;
}

/** Effort (km équivalents) à travers champs, en ligne droite : la pente et la forêt comptent pleinement. */
export function crossCountry(grid, a, b) {
  const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / grid.g));
  let effort = 0, blocked = false;
  for (let i = 0; i < n; i++) {
    const x = a[0] + ((b[0] - a[0]) * (i + 0.5)) / n, y = a[1] + ((b[1] - a[1]) * (i + 0.5)) / n;
    const k = clamp(Math.round((y - grid.y0) / grid.g), 0, grid.rows - 1) * grid.cols + clamp(Math.round((x - grid.x0) / grid.g), 0, grid.cols - 1);
    const c = grid.cost[k];
    if (!Number.isFinite(c)) blocked = true;
    effort += (Math.hypot(b[0] - a[0], b[1] - a[1]) / n) * (Number.isFinite(c) ? c : 1);
  }
  return { effort: r1(effort), blocked };
}

/* ——— Placement des cités ——— */

/** Côté de la mer (N, S, E, O) pour un port : la direction où l'eau est la plus proche. */
export function seaSideAt(relief, km, r) {
  let best = null;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    for (const f of [1, 2, 4]) {
      const e = elevationAt(relief, km[0] + Math.cos(a) * r * f, km[1] + Math.sin(a) * r * f);
      if (e < 0) { if (!best || f < best.f || (f === best.f && e < best.e)) best = { a, f, e }; break; }
    }
  }
  if (!best) return null;
  const a = ((best.a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return a < Math.PI / 4 || a >= (7 * Math.PI) / 4 ? 'E' : a < (3 * Math.PI) / 4 ? 'S' : a < (5 * Math.PI) / 4 ? 'O' : 'N';
}

/** Nouvelle mer au-delà du bord de carte le plus proche d'un point (km). */
export function seaBeyond(frame, km, id, forced) {
  const sc = Object.values(SCALES).find((x) => x.m === frame.m) ?? SCALES.royaume;
  const d = { O: km[0] - frame.x0, E: frame.x1 - km[0], N: km[1] - frame.y0, S: frame.y1 - km[1] };
  const side = forced ?? Object.entries(d).sort((a, b) => a[1] - b[1])[0][0];
  const r = Math.min(sc.w, sc.h) * 0.55;
  // Le centre est au large : le rivage passe à peu près par le point demandé (jamais plus loin que le bord).
  const reach = Math.max(r * 0.55, r * 0.92 - d[side]);
  const c = side === 'O' ? [frame.x0 - reach, km[1]] : side === 'E' ? [frame.x1 + reach, km[1]] : side === 'N' ? [km[0], frame.y0 - reach] : [km[0], frame.y1 + reach];
  // Une mer s'allonge le long de la côte (un bras de mer d'un bord à l'autre), pas un lac rond.
  return { id, x: r3(c[0]), y: r3(c[1]), r: r3(r), side, ax: 2.4 };
}

/**
 * Meilleure place (km) pour une cité. Respecte autant que possible les distances voulues (`spec.near` résolues en
 * `wants` : { km: [x, y] de la cité cible, dist: km, dir?: angle }), reste à l'écart des autres cités, en plaine et sur
 * la terre ferme ; un port va sur une côte.
 */
export function placeOn(relief, frame, others, spec, wants = [], seed = 1) {
  const r = prng(hash(`place2:${seed}:${spec.id}`));
  const w = frame.x1 - frame.x0, h = frame.y1 - frame.y0;
  // Écarts mesurés sur le monde de départ : agrandir le monde ne doit pas éloigner les cités.
  const sw = (Object.values(SCALES).find((x) => x.m === frame.m) ?? SCALES.royaume).w;
  const minSep = sw * 0.05, rc = Math.max(cityRadiusKm(spec), 0.4);
  let best = null;
  const tryAt = (x, y) => {
    if (!inBounds(relief, x, y, -Math.min(w, h) * 0.04)) return;
    const e = elevationAt(relief, x, y);
    if (e < 4 || e > 1400) return;
    let score = -e / 900 - slopeAt(relief, x, y, Math.max(rc, frame.m * 4 / 1000)) * 15;
    if (spec.port) {
      const side = seaSideAt(relief, [x, y], rc * 1.5);
      if (!side) return;
      score += 2;
    }
    const dmin = others.length ? Math.min(...others.map((o) => Math.hypot(o[0] - x, o[1] - y))) : Infinity;
    if (dmin < minSep) score -= 20 + (minSep - dmin) / minSep * 20;
    else if (!wants.length) score += others.length ? (dmin < sw * 0.35 ? dmin / sw : 0.35 - (dmin / sw - 0.35)) * 4 : -Math.hypot(x - (frame.x0 + w / 2), y - (frame.y0 + h / 2)) / w * 3;
    for (const want of wants) {
      const d = Math.hypot(x - want.km[0], y - want.km[1]);
      score -= Math.abs(d - want.dist) / Math.max(want.dist, minSep) * 6;
      if (want.dir !== undefined) {
        const a = Math.atan2(y - want.km[1], x - want.km[0]);
        score -= Math.abs(Math.atan2(Math.sin(a - want.dir), Math.cos(a - want.dir))) * 2.5;
      }
    }
    if (!best || score > best.score) best = { km: [r3(x), r3(y)], score };
  };
  // Candidats : au hasard, plus une couronne autour de chaque distance voulue.
  for (let k = 0; k < 260; k++) tryAt(frame.x0 + r() * w, frame.y0 + r() * h);
  for (const want of wants) for (let k = 0; k < 120; k++) {
    const a = want.dir !== undefined ? want.dir + (r() - 0.5) * 1.2 : r() * Math.PI * 2, d = want.dist * (0.75 + r() * 0.5);
    tryAt(want.km[0] + Math.cos(a) * d, want.km[1] + Math.sin(a) * d);
  }
  // Un port cherche sa côte le long des rives connues.
  if (spec.port) for (const s of relief.seas) for (let k = 0; k < 160; k++) {
    const a = r() * Math.PI * 2;
    for (let f = 0.55; f < 1.3; f += 0.04) {
      const [sx, sy] = seaStretch(s);
      const x = s.x + Math.cos(a) * s.r * f * sx, y = s.y + Math.sin(a) * s.r * f * sy;
      if (elevationAt(relief, x, y) > 4) { tryAt(x + Math.cos(a) * rc * 0.5, y + Math.sin(a) * rc * 0.5); break; }
    }
  }
  return best;
}
