/**
 * Générateur de la carte du monde : un plan « monde » (cités, routes, forêts, rivières) et un plan par cité
 * (muraille, château, haute-ville, marché, rues, bâtiments, faubourgs, fermes).
 *
 * Tout est déterministe : une même graine et les mêmes paramètres donnent toujours le même dessin, au mètre près.
 * Le résultat est un jeu de données au format de l'Atlas (src/maps/atlas/types.ts) : le moteur existant
 * (navigation, brouillard, suivi du groupe, écran joueurs, combat) s'en sert sans le savoir.
 *
 * JavaScript pur, sans dépendance : testé par generate.test.mjs.
 */

/** Dimensions des plans (unités de plan) et échelle du monde (mètres par unité). */
export const CITY_W = 1240;
export const CITY_H = 1000;
export const WORLD_W = 1240;
export const WORLD_H = 860;
export const WORLD_SCALE = 40;

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = (v) => Math.round(v * 10) / 10;
const r5 = (v) => Math.round(v * 1e5) / 1e5;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** Graine stable à partir d'un texte (FNV-1a), comme battle/terrain.ts. */
export function hashSeed(text) {
  let h = 2166136261;
  for (const c of String(text)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
export function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

import { generateInterior } from './interior.js';

/* ——— Types de bâtiments ——— */

/**
 * Types d'emplacements. `category` : catégorie de l'Atlas (pictogramme, couleur) ; `rank` : importance sur la carte.
 * Les lieux du lore sont classés dans ces types (voir lore.js) pour trouver un bâtiment qui leur convient.
 */
export const SLOT_TYPES = {
  chateau: { label: 'Donjon', category: 'cite', rank: 'landmark' },
  temple: { label: 'Temple', category: 'sanctuaire', rank: 'regional' },
  guilde: { label: 'Maison de guilde', category: 'institution', rank: 'local' },
  caserne: { label: 'Corps de garde', category: 'garde', rank: 'detail' },
  auberge: { label: 'Auberge', category: 'institution', rank: 'local' },
  taverne: { label: 'Taverne', category: 'institution', rank: 'local' },
  ecurie: { label: 'Écurie', category: 'vivant', rank: 'detail' },
  forge: { label: 'Forge', category: 'ressource', rank: 'detail' },
  entrepot: { label: 'Entrepôt', category: 'ressource', rank: 'detail' },
  echoppe: { label: 'Échoppe', category: 'ressource', rank: 'detail' },
  atelier: { label: 'Atelier', category: 'ressource', rank: 'detail' },
  manoir: { label: 'Hôtel particulier', category: 'cite', rank: 'detail' },
  ferme: { label: 'Ferme', category: 'vivant', rank: 'detail' },
  maison: { label: 'Maison', category: 'indetermine', rank: 'detail' },
};

/** Seuil de zoom selon l'importance (mêmes paliers que les cartes personnalisées). */
const MIN_ZOOM = { landmark: 0, regional: 0, local: 1.3, detail: 2.6 };

/** Noms de rues et de lieux (tirés sans remise, selon la graine). */
const STREETS = ['des Tanneurs', 'des Orfèvres', 'du Puits', 'des Chandeliers', 'aux Herbes', 'des Tisserands', 'du Four', 'des Potiers',
  'de la Lanterne', 'des Cordiers', 'du Vieux-Pont', 'des Merciers', 'aux Moines', 'des Selliers', 'du Corbeau', 'des Bouchers',
  'de l’Échelle', 'des Drapiers', 'du Cerf', 'des Chaudronniers', 'de la Fontaine', 'des Vanniers', 'du Pilori', 'des Brasseurs'];
const LANES = ['du Chat-qui-dort', 'des Fileuses', 'de la Pie', 'du Mauvais-Pas', 'des Chiffonniers', 'du Rat', 'des Étuves',
  'des Lavandières', 'de l’Ours', 'des Brumes', 'du Coq', 'des Lanternes', 'du Guet', 'des Mendiants', 'du Bœuf', 'des Gantiers',
  'de la Truie-qui-file', 'des Clercs', 'du Soufflet', 'des Cloches'];
const NAME_A = ['Val', 'Mor', 'Gris', 'Haut', 'Roc', 'Bel', 'Fon', 'Bru', 'Clair', 'Sombre', 'Vieux', 'Cor', 'Aube', 'Fer', 'Lune', 'Brande'];
const NAME_B = ['mont', 'fort', 'combe', 'bois', 'val', 'lande', 'roche', 'marais', 'rive', 'pierre', 'chêne', 'fange', 'mère', 'brune'];
const RIVERS = ['l’Aurelle', 'la Sombrevive', 'la Brève', 'le Gué-Noir', 'la Lézarde', 'l’Orne-Grise', 'la Vive', 'le Ruisseau-Clair'];

const placeName = (rand) => {
  const a = NAME_A[Math.floor(rand() * NAME_A.length)], b = NAME_B[Math.floor(rand() * NAME_B.length)];
  return a.endsWith(b[0]) ? a + b.slice(1) : a + b;
};
const shuffled = (rand, arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

/** Point cardinal (écran : y vers le bas). */
function dirName(a) {
  const d = ((a * 180) / Math.PI + 360) % 360;
  return d < 45 || d >= 315 ? 'Est' : d < 135 ? 'Sud' : d < 225 ? 'Ouest' : 'Nord';
}
const OF_DIR = { Est: 'de l’Est', Sud: 'du Sud', Ouest: 'de l’Ouest', Nord: 'du Nord' };

/* ——— Géométrie ——— */

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function lineDist(px, py, pts) {
  let m = Infinity;
  for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, segDist(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return m;
}
const polyLen = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

/** Point et direction à la distance `t` le long d'une polyligne. */
function along(pts, t) {
  let rest = t;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const l = Math.hypot(bx - ax, by - ay);
    if (rest <= l || i === pts.length - 2) {
      const k = l ? clamp(rest / l, 0, 1) : 0;
      return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, ang: Math.atan2(by - ay, bx - ax) };
    }
    rest -= l;
  }
  const [x, y] = pts[pts.length - 1];
  return { x, y, ang: 0 };
}

/** Coins d'un rectangle orienté (centre, largeur le long de l'angle, profondeur). */
function corners(b) {
  const c = Math.cos(b.ang), s = Math.sin(b.ang), hw = b.w / 2, hd = b.d / 2;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => [b.x + u * c - v * s, b.y + u * s + v * c]);
}
/** Deux rectangles orientés se chevauchent-ils ? (axes séparateurs) */
function overlap(a, b, margin = 0) {
  const A = corners({ ...a, w: a.w + margin, d: a.d + margin }), B = corners({ ...b, w: b.w + margin, d: b.d + margin });
  for (const ang of [a.ang, a.ang + Math.PI / 2, b.ang, b.ang + Math.PI / 2]) {
    const ax = Math.cos(ang), ay = Math.sin(ang);
    const pa = A.map(([x, y]) => x * ax + y * ay), pb = B.map(([x, y]) => x * ax + y * ay);
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
  }
  return true;
}
const inRect = (x, y, b) => {
  const c = Math.cos(-b.ang), s = Math.sin(-b.ang), dx = x - b.x, dy = y - b.y;
  return Math.abs(dx * c - dy * s) <= b.w / 2 && Math.abs(dx * s + dy * c) <= b.d / 2;
};
function insidePoly(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Grille de hachage pour tester vite les chevauchements. */
function spatial(cell) {
  const m = new Map();
  const key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  return {
    add(item, x, y) { const k = key(x, y); if (!m.has(k)) m.set(k, []); m.get(k).push(item); },
    near(x, y, r = 1) {
      const out = [], cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) { const l = m.get(`${cx + i},${cy + j}`); if (l) out.push(...l); }
      return out;
    },
  };
}

/* ——— Tracés SVG (unités de plan) ——— */

const f1 = (v) => (Math.round(v * 10) / 10).toString();
const rectPath = (pts) => `M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z`;
const linePath = (pts) => `M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}`;
const circlePath = (x, y, r) => `M${f1(x - r)} ${f1(y)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0`;
/** Contour organique stable (lobes harmoniques), en coordonnées libres. */
function blob(rand, cx, cy, rx, ry, n = 28) {
  const harm = [2, 3, 5].map((f, i) => ({ f, a: [0.16, 0.1, 0.06][i] * (0.5 + rand()), p: rand() * TAU }));
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (TAU * i) / n;
    let k = 1;
    for (const h of harm) k += h.a * Math.sin(h.f * a + h.p);
    out.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return out;
}

/* ——— Cité ——— */

/** Valeurs par défaut d'une cité (fiche incomplète, ou cité créée à la main). */
export function citySpecDefaults(spec) {
  const population = clamp(Math.round(Number(spec.population) || 1500), 40, 25000);
  return {
    id: String(spec.id), name: spec.name || 'Cité sans nom', seed: (spec.seed ?? hashSeed(`cite:${spec.id}`)) >>> 0, population,
    people: spec.people || 'humains',
    walls: spec.walls ?? population >= 400,
    castle: spec.castle ?? population >= 1200,
    highTown: spec.highTown ?? population >= 1000,
    faubourgs: spec.faubourgs ?? population >= 500,
    farms: spec.farms ?? true,
    river: spec.river ?? false,
    /** Village ou hameau : une chapelle, une taverne, une forge, des fermes ; ni guilde, ni caserne, ni entrepôt. */
    village: spec.village ?? population < 400,
    entryId: spec.entryId, at: spec.at,
  };
}

/**
 * Génère le plan d'une cité. `planId` : identifiant du plan ; `bindings` : lieux du lore posés sur des emplacements
 * (identifiant d'emplacement → titre, résumé, PNJ…).
 * Renvoie le plan (avec son sol pour la carte de combat), les lieux, les tracés, les ancres de sortie et les emplacements.
 */
export function generateCity(rawSpec, planId, bindings = {}) {
  const spec = citySpecDefaults(rawSpec);
  const rand = rng(spec.seed);
  const pop = spec.population;
  // Superficie intra-muros : environ 170 habitants à l'hectare.
  const R = Math.sqrt(((pop / 170) * 10000) / Math.PI);
  const ext = R * (spec.farms ? 2.45 : spec.faubourgs ? 1.9 : 1.5);
  const W = CITY_W, H = CITY_H;
  /** Mètres par unité de plan. */
  const scale = (2 * ext) / H;
  const hx = (W / 2) * scale, hy = (H / 2) * scale;
  const inPlan = (x, y, m = 0) => Math.abs(x) < hx - m && Math.abs(y) < hy - m;
  const U = (x, y) => [r1(x / scale + W / 2), r1(y / scale + H / 2)];
  const N = (x, y) => [r5((x / scale + W / 2) / W), r5((y / scale + H / 2) / H)];
  const pre = `${planId}:`;

  // Muraille : rayon irrégulier, gonflé pour contenir le château.
  const ph = [rand() * TAU, rand() * TAU, rand() * TAU];
  const amp = [0.045 + rand() * 0.03, 0.025 + rand() * 0.02, 0.012];
  const baseR = (a) => R * (1 + amp[0] * Math.sin(3 * a + ph[0]) + amp[1] * Math.sin(5 * a + ph[1]) + amp[2] * Math.sin(7 * a + ph[2]));
  const thC = rand() * TAU;
  const C = spec.castle ? { r: clamp(R * 0.2, 20, 75), d: R * 0.8 } : null;
  if (C) { C.x = Math.cos(thC) * C.d; C.y = Math.sin(thC) * C.d; }
  const wallR = (a) => {
    let r = baseR(a);
    if (C) {
      const da = angDiff(a, thC), s = C.d * Math.sin(da), rr = C.r + 7;
      if (Math.abs(s) < rr && Math.cos(da) > 0) r = Math.max(r, C.d * Math.cos(da) + Math.sqrt(rr * rr - s * s) + 2);
    }
    return r;
  };
  const polar = (x, y) => ({ r: Math.hypot(x, y), a: Math.atan2(y, x) });
  const intra = (x, y, m = 0) => { const p = polar(x, y); return p.r < wallR(p.a) - m; };
  const inCastle = (x, y, m = 0) => !!C && Math.hypot(x - C.x, y - C.y) < C.r + m;
  const inHigh = (x, y) => spec.highTown && (() => { const p = polar(x, y); return Math.abs(angDiff(p.a, thC)) < 0.95 && p.r > R * 0.6 && p.r < wallR(p.a); })() && !inCastle(x, y, 3);

  // Place du marché (ou du village).
  const vrand = rng((spec.seed ^ 0x5bd1e995) >>> 0);
  const orngVillage = () => vrand();
  const mk = { x: (rand() - 0.5) * R * 0.16, y: (rand() - 0.5) * R * 0.16, a: clamp(R * 0.12, 12, 44), ang: rand() * Math.PI };
  mk.b = mk.a * 0.7;
  const market = { x: mk.x, y: mk.y, w: mk.a * 2, d: mk.b * 2, ang: mk.ang };
  const inMarket = (x, y, m = 0) => inRect(x, y, { ...market, w: market.w + 2 * m, d: market.d + 2 * m });

  // Portes : à l'opposé du château, réparties autour de l'enceinte.
  const nG = pop < 700 ? 2 : pop < 4000 ? 3 : 4;
  const gBase = thC + Math.PI + (rand() - 0.5) * 0.4;
  const usedDir = new Map();
  const gates = Array.from({ length: nG }, (_, i) => {
    let a = gBase + (i - (nG - 1) / 2) * (TAU / nG) * 0.92 + (rand() - 0.5) * 0.22;
    if (C && Math.abs(angDiff(a, thC)) < 0.75) a = thC + Math.sign(angDiff(a, thC) || 1) * 0.75;
    const r = spec.walls ? wallR(a) : R * 0.95;
    const dir = dirName(a);
    const n = (usedDir.get(dir) ?? 0) + 1; usedDir.set(dir, n);
    const name = !spec.walls ? `Entrée ${OF_DIR[dir]}${n > 1 ? ` ${n}` : ''}` : n === 1 ? `Porte ${OF_DIR[dir]}` : `Porte ${['', '', 'Neuve', 'Basse', 'Vieille'][n]} ${OF_DIR[dir]}`;
    return { i, a: ((a % TAU) + TAU) % TAU, x: Math.cos(a) * r, y: Math.sin(a) * r, dir, name };
  });

  // ——— Rues ———
  /** `kind` : main (grand-rue), ring (rue de ceinture), lane (ruelle), ronde (chemin de ronde), road (route), approach (montée du château). */
  const streets = [];
  const HW = { main: 3.6, ring: 2.7, lane: 1.7, ronde: 2, road: 3.2, approach: 3.2 };
  const streetNames = shuffled(rand, STREETS), laneNames = shuffled(rand, LANES);
  let sn = 0, ln = 0;
  const addStreet = (kind, name, pts) => { if (pts.length >= 2 && polyLen(pts) > 4) streets.push({ id: `${pre}rue-${streets.length}`, kind, name, pts, hw: HW[kind] }); };
  const ringR = R * 0.58;
  const ringAt = (a) => [Math.cos(a) * ringR, Math.sin(a) * ringR];
  const rondeAt = (a) => { const r = wallR(a) - 9; return [Math.cos(a) * r, Math.sin(a) * r]; };
  const marketEdge = (tx, ty) => { const a = Math.atan2(ty - mk.y, tx - mk.x); return [mk.x + Math.cos(a) * mk.b * 0.95, mk.y + Math.sin(a) * mk.b * 0.95]; };
  const wiggle = (a, b, k) => { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, l = Math.hypot(b[0] - a[0], b[1] - a[1]); const j = (rand() - 0.5) * l * k; const nx = -(b[1] - a[1]) / (l || 1), ny = (b[0] - a[0]) / (l || 1); return [mx + nx * j, my + ny * j]; };

  // Angles où la ceinture est coupée en tronçons (grand-rues, montée, ruelles) : les rues s'y rejoignent.
  const cuts = gates.map((g) => g.a);
  if (C) cuts.push(((thC % TAU) + TAU) % TAU);
  const sorted0 = [...cuts].sort((a, b) => a - b);
  const laneAngles = [];
  for (let i = 0; i < sorted0.length; i++) {
    const a0 = sorted0[i], a1 = i === sorted0.length - 1 ? sorted0[0] + TAU : sorted0[i + 1];
    const n = clamp(Math.round(((a1 - a0) * ringR) / 85), 0, 4);
    for (let k = 1; k <= n; k++) {
      const a = a0 + ((a1 - a0) * k) / (n + 1) + (rand() - 0.5) * 0.08;
      if (C && Math.abs(angDiff(a, thC)) < 0.55) continue;
      laneAngles.push(((a % TAU) + TAU) % TAU);
    }
  }
  const allCuts = [...cuts, ...laneAngles].sort((a, b) => a - b);

  gates.forEach((g, i) => {
    const P = ringAt(g.a), M = marketEdge(P[0], P[1]);
    addStreet('main', i === 0 ? 'Grand-Rue' : `Rue de la ${g.name}`, [M, wiggle(M, P, 0.12), P]);
    addStreet('main', i === 0 ? 'Grand-Rue' : `Rue de la ${g.name}`, [P, wiggle(P, [g.x, g.y], 0.1), [g.x, g.y]]);
  });
  if (C) {
    const P = ringAt(thC), M = marketEdge(P[0], P[1]);
    const toC = Math.atan2(-C.y, -C.x);
    const G = [C.x + Math.cos(toC) * C.r, C.y + Math.sin(toC) * C.r];
    addStreet('approach', 'Montée du Château', [M, wiggle(M, P, 0.1), P]);
    addStreet('approach', 'Montée du Château', [P, G]);
  }
  // Ceinture : un tronçon entre deux coupures, nommé comme une rue.
  for (let i = 0; i < allCuts.length; i++) {
    const a0 = allCuts[i], a1 = i === allCuts.length - 1 ? allCuts[0] + TAU : allCuts[i + 1];
    if (a1 - a0 < 0.02) continue;
    const pts = [];
    const n = Math.max(2, Math.ceil(((a1 - a0) * ringR) / 14));
    for (let k = 0; k <= n; k++) pts.push(ringAt(a0 + ((a1 - a0) * k) / n));
    if (pts.some(([x, y]) => inCastle(x, y, 2))) continue;
    addStreet('ring', `Rue ${streetNames[sn++ % streetNames.length]}`, pts);
  }
  // Ruelles : de la ceinture vers le cœur et vers le rempart.
  for (const a of laneAngles) {
    const P = ringAt(a);
    const name = `Ruelle ${laneNames[ln++ % laneNames.length]}`;
    const inner = [Math.cos(a) * R * 0.27 + mk.x * 0.3, Math.sin(a) * R * 0.27 + mk.y * 0.3];
    if (!inMarket(inner[0], inner[1], 4)) addStreet('lane', name, [P, wiggle(P, inner, 0.2), inner]);
    const outer = spec.walls ? rondeAt(a) : [Math.cos(a) * R * 0.88, Math.sin(a) * R * 0.88];
    if (!inCastle(outer[0], outer[1], 4)) addStreet('lane', name, [P, wiggle(P, outer, 0.15), outer]);
  }
  // Chemin de ronde : longe le rempart, de porte en ruelle.
  if (spec.walls) {
    const rc = [...gates.map((g) => g.a), ...laneAngles].sort((a, b) => a - b);
    for (let i = 0; i < rc.length; i++) {
      const a0 = rc[i], a1 = i === rc.length - 1 ? rc[0] + TAU : rc[i + 1];
      const pts = [];
      const n = Math.max(2, Math.ceil(((a1 - a0) * R) / 14));
      for (let k = 0; k <= n; k++) {
        const a = a0 + ((a1 - a0) * k) / n;
        const isGate = gates.find((g) => Math.abs(angDiff(g.a, a)) < 1e-6);
        pts.push(isGate ? [isGate.x, isGate.y] : rondeAt(a));
      }
      if (pts.some(([x, y]) => inCastle(x, y, 3))) continue;
      addStreet('ronde', 'Chemin de ronde', pts);
    }
  }
  // Routes : de chaque porte au bord du plan.
  const roadExits = [];
  for (const g of gates) {
    const pts = [[g.x, g.y]];
    let x = g.x, y = g.y, a = g.a;
    for (let k = 0; k < 80; k++) {
      a += (rand() - 0.5) * 0.18;
      a = g.a + clamp(angDiff(a, g.a), -0.35, 0.35);
      const nx = x + Math.cos(a) * 45, ny = y + Math.sin(a) * 45;
      if (!inPlan(nx, ny, 1)) {
        // Arrêt exact sur le bord du plan.
        const tx = Math.cos(a) > 0 ? (hx - 1 - x) / Math.cos(a) : Math.cos(a) < 0 ? (-hx + 1 - x) / Math.cos(a) : Infinity;
        const ty = Math.sin(a) > 0 ? (hy - 1 - y) / Math.sin(a) : Math.sin(a) < 0 ? (-hy + 1 - y) / Math.sin(a) : Infinity;
        const t = Math.max(0, Math.min(tx, ty));
        pts.push([x + Math.cos(a) * t, y + Math.sin(a) * t]);
        break;
      }
      pts.push([nx, ny]); x = nx; y = ny;
    }
    addStreet('road', `Route de la ${g.name}`, pts);
    roadExits.push({ gate: g, end: pts[pts.length - 1], pts });
  }

  // Rivière (facultative) : passe à l'extérieur du rempart, du côté du château.
  let river = null;
  if (spec.river) {
    const off = thC + (rand() - 0.5) * 0.8;
    const d = (C ? C.d + C.r : R) + 28;
    const ox = Math.cos(off) * d, oy = Math.sin(off) * d, dx = -Math.sin(off), dy = Math.cos(off);
    const pts = [];
    for (let t = -1.6 * Math.max(hx, hy); t <= 1.6 * Math.max(hx, hy); t += 30) {
      const w = Math.sin(t / 90 + ph[0]) * 18 + Math.sin(t / 37 + ph[1]) * 6;
      pts.push([ox + dx * t + Math.cos(off) * w, oy + dy * t + Math.sin(off) * w]);
    }
    river = { pts: pts.filter(([x, y]) => inPlan(x, y, -60)), hw: clamp(R * 0.06, 6, 16), name: RIVERS[Math.floor(rand() * RIVERS.length)] };
  }

  // ——— Bâtiments ———
  const segs = streets.flatMap((s) => s.pts.slice(1).map((p, i) => ({ a: s.pts[i], b: p, hw: s.hw, id: s.id })));
  const nearStreet = (x, y, pad, own) => segs.some((s) => s.id !== own && segDist(x, y, s.a[0], s.a[1], s.b[0], s.b[1]) < s.hw + pad);
  const grid = spatial(24);
  const buildings = [];
  const fields = [];
  const castleParts = [];
  const free = (b, margin) => !grid.near(b.x, b.y).some((o) => overlap(b, o, margin));
  const add = (b) => { buildings.push(b); grid.add(b, b.x, b.y); return b; };

  if (C) {
    // Château : donjon, grande salle, chapelle castrale, dans une enceinte flanquée de tours.
    const keep = { x: C.x + Math.cos(thC) * C.r * 0.25, y: C.y + Math.sin(thC) * C.r * 0.25, w: C.r * 0.62, d: C.r * 0.62, ang: thC, district: 'chateau', type: 'chateau', label: 'Donjon' };
    const toM = thC + Math.PI;
    const hall = { x: C.x + Math.cos(toM + 0.9) * C.r * 0.45, y: C.y + Math.sin(toM + 0.9) * C.r * 0.45, w: C.r * 0.62, d: C.r * 0.26, ang: toM + 0.9 + Math.PI / 2, district: 'chateau', type: 'caserne', label: 'Grande salle' };
    const chapel = { x: C.x + Math.cos(toM - 1) * C.r * 0.5, y: C.y + Math.sin(toM - 1) * C.r * 0.5, w: C.r * 0.34, d: C.r * 0.2, ang: toM - 1 + Math.PI / 2, district: 'chateau', type: 'temple', label: 'Chapelle castrale' };
    for (const b of [keep, hall, chapel]) castleParts.push(add(b));
  }

  const cap = Math.round(pop / 4.2);
  let intraCount = 0;
  const districtOf = (x, y) => (inCastle(x, y) ? 'chateau' : inHigh(x, y) ? 'haute' : intra(x, y) ? (Math.hypot(x - mk.x, y - mk.y) < mk.a + 40 ? 'marche' : 'ville') : 'faubourg');

  /** Rangée de bâtiments le long d'une rue, des deux côtés. `zone` : où ils ont le droit d'être. */
  const rowAlong = (s, zone, opts = {}) => {
    const L = polyLen(s.pts);
    for (const side of [-1, 1]) {
      let t = 3 + rand() * 4;
      while (t < L - 3) {
        if (zone === 'intra' && intraCount >= cap) return;
        const probe = along(s.pts, t);
        const px = probe.x - Math.sin(probe.ang) * side * (s.hw + 8), py = probe.y + Math.cos(probe.ang) * side * (s.hw + 8);
        const dist = districtOf(px, py);
        const high = dist === 'haute';
        const front = high ? 13 + rand() * 7 : zone === 'faubourg' ? 7 + rand() * 5 : 6.5 + rand() * 4.5;
        const depth = high ? 12 + rand() * 6 : zone === 'faubourg' ? 7 + rand() * 5 : 8.5 + rand() * 6;
        const gap = high ? 3 + rand() * 3 : zone === 'faubourg' ? 2 + rand() * 6 : 0.4 + rand() * 0.8;
        const p = along(s.pts, t + front / 2);
        const off = s.hw + 0.7 + depth / 2;
        // La porte donne sur la rue : à l'opposé du décalage qui a éloigné le bâtiment de la rue.
        const face = Math.atan2(-Math.cos(p.ang) * side, Math.sin(p.ang) * side);
        const b = { x: p.x - Math.sin(p.ang) * side * off, y: p.y + Math.cos(p.ang) * side * off, w: front, d: depth, ang: p.ang, district: dist, face };
        if (accept(b, zone, s.id)) {
          add(b);
          if (zone === 'intra') intraCount++;
          // Seconde rangée (arrière-cour) dans la basse-ville dense.
          if (opts.back && !high && zone === 'intra' && rand() < 0.65 && intraCount < cap) {
            const d2 = 7 + rand() * 5, off2 = off + depth / 2 + 1.2 + d2 / 2;
            const b2 = { x: p.x - Math.sin(p.ang) * side * off2, y: p.y + Math.cos(p.ang) * side * off2, w: front * (0.8 + rand() * 0.3), d: d2, ang: p.ang, district: districtOf(b.x, b.y), face };
            if (accept(b2, zone, s.id)) { add(b2); intraCount++; }
          }
          t += front + gap;
        } else t += 2.5;
      }
    }
  };
  function accept(b, zone, own) {
    if (!inPlan(b.x, b.y, 8)) return false;
    const pts = corners(b);
    if (river && pts.some(([x, y]) => lineDist(x, y, river.pts) < river.hw + 3)) return false;
    if (pts.some(([x, y]) => inMarket(x, y, 1.5) || inCastle(x, y, 5))) return false;
    if (zone === 'intra') { if (!pts.every(([x, y]) => intra(x, y, spec.walls ? 4.5 : 0))) return false; }
    else if (zone === 'faubourg') { const r = Math.hypot(b.x, b.y); if (pts.some(([x, y]) => intra(x, y, -7)) || r > R * 1.6) return false; }
    else if (zone === 'farm') { if (pts.some(([x, y]) => Math.hypot(x, y) < R * 1.45)) return false; }
    if (nearStreet(b.x, b.y, Math.min(b.w, b.d) * 0.45 + 0.4, own)) return false;
    if (pts.some(([x, y]) => nearStreet(x, y, 0.4, own))) return false;
    return free(b, zone === 'intra' ? 0.3 : 1.5);
  }

  const order = ['main', 'approach', 'ring', 'lane', 'ronde'];
  for (const kind of order) for (const s of streets.filter((x) => x.kind === kind)) rowAlong(s, 'intra', { back: kind !== 'ronde' });
  if (spec.faubourgs) {
    let fb = 0;
    for (const s of streets.filter((x) => x.kind === 'road')) {
      const before = buildings.length;
      rowAlong(s, 'faubourg');
      fb += buildings.length - before;
      if (fb > pop / 12) break;
    }
  }

  // Fermes : un corps de ferme et ses champs en lanières, le long des routes ; puis des champs épars.
  if (spec.farms) {
    for (const s of streets.filter((x) => x.kind === 'road')) {
      const L = polyLen(s.pts);
      let t = R * 0.6 + rand() * 30, side = rand() < 0.5 ? -1 : 1;
      while (t < L - 30) {
        const p = along(s.pts, t);
        const off = 32 + rand() * 30;
        const n = [-Math.sin(p.ang) * side, Math.cos(p.ang) * side];
        const house = { x: p.x + n[0] * off, y: p.y + n[1] * off, w: 13 + rand() * 4, d: 8 + rand() * 2, ang: p.ang, district: 'ferme', type: 'ferme', face: Math.atan2(-n[1], -n[0]) };
        if (accept(house, 'farm', s.id)) {
          add(house);
          const barn = { x: house.x + Math.cos(p.ang) * (house.w / 2 + 11), y: house.y + Math.sin(p.ang) * (house.w / 2 + 11), w: 17, d: 10, ang: p.ang + Math.PI / 2, district: 'ferme', type: 'ferme', label: 'Grange', face: Math.atan2(-n[1], -n[0]) };
          if (accept(barn, 'farm', s.id)) add(barn);
          for (let k = 0; k < 4; k++) {
            const fw = 60 + rand() * 40, fd = 18 + rand() * 9;
            const fo = off + 22 + k * (fd + 3) + fd / 2;
            const fld = { x: p.x + n[0] * fo + Math.cos(p.ang) * (rand() - 0.5) * 20, y: p.y + n[1] * fo + Math.sin(p.ang) * (rand() - 0.5) * 20, w: fw, d: fd, ang: p.ang };
            if (fieldOk(fld)) fields.push(fld);
          }
        }
        t += 80 + rand() * 50; side = -side;
      }
    }
    for (let k = 0; k < 140 && fields.length < 90; k++) {
      const a = rand() * TAU, r = R * (1.55 + rand() * 1.3);
      const fld = { x: Math.cos(a) * r, y: Math.sin(a) * r, w: 50 + rand() * 50, d: 16 + rand() * 12, ang: a + Math.PI / 2 + (rand() - 0.5) * 0.6 };
      if (fieldOk(fld)) fields.push(fld);
    }
  }
  function fieldOk(f) {
    const pts = corners(f);
    if (!pts.every(([x, y]) => inPlan(x, y, 4))) return false;
    if (pts.some(([x, y]) => Math.hypot(x, y) < R * 1.4)) return false;
    if (river && pts.some(([x, y]) => lineDist(x, y, river.pts) < river.hw + 4)) return false;
    if (nearStreet(f.x, f.y, Math.min(f.w, f.d) / 2 + 2) || pts.some(([x, y]) => nearStreet(x, y, 2))) return false;
    if (fields.some((o) => overlap(f, o, 2))) return false;
    return free(f, 3);
  }

  // Bosquets : des arbres en grappes, loin des rues et des champs.
  const trees = [];
  if (spec.farms || spec.faubourgs) {
    const clumps = 4 + Math.floor(rand() * 4);
    for (let c = 0; c < clumps; c++) {
      const a = rand() * TAU, r = R * (1.5 + rand() * 1.1);
      const cx = Math.cos(a) * r, cy = Math.sin(a) * r, spread = 25 + rand() * 45;
      for (let k = 0; k < 70; k++) {
        const ta = rand() * TAU, tr = Math.sqrt(rand()) * spread;
        const x = cx + Math.cos(ta) * tr, y = cy + Math.sin(ta) * tr, rr = 2.5 + rand() * 3.5;
        if (!inPlan(x, y, 3) || Math.hypot(x, y) < R * 1.35 || nearStreet(x, y, rr + 1)) continue;
        if (river && lineDist(x, y, river.pts) < river.hw + rr) continue;
        if (fields.some((f) => inRect(x, y, { ...f, w: f.w + rr * 2, d: f.d + rr * 2 }))) continue;
        if (grid.near(x, y).some((b) => inRect(x, y, { ...b, w: b.w + rr * 2, d: b.d + rr * 2 }))) continue;
        trees.push([x, y, rr]);
      }
    }
  }

  // ——— Emplacements : un type par bâtiment ———
  const slots = buildings.map((b, i) => ({ b, i, type: b.type ?? null, label: b.label }));
  const dist = (b, x, y) => Math.hypot(b.x - x, b.y - y);
  /** Choisit `n` bâtiments pour un type : les mieux placés d'abord, mais jamais deux du même type côte à côte. */
  const take = (type, n, score, filter = () => true) => {
    const cand = slots.filter((s) => !s.type && filter(s)).map((s) => ({ s, k: score(s.b) + rand() * 18 }));
    const picked = [];
    for (let k = 0; k < n && cand.length; k++) {
      let bi = -1, bk = Infinity;
      cand.forEach((c, i) => {
        const crowd = picked.reduce((m, p) => m + (dist(c.s.b, p.b.x, p.b.y) < 55 ? 120 : 0), 0);
        if (c.k + crowd < bk) { bk = c.k + crowd; bi = i; }
      });
      const [c] = cand.splice(bi, 1);
      c.s.type = type; picked.push(c.s);
    }
  };
  const nearGate = (b) => Math.min(...gates.map((g) => dist(b, g.x, g.y)));
  const intraSlot = (s) => ['ville', 'marche'].includes(s.b.district);
  if (spec.village) {
    // Village : une chapelle près de la place, une taverne, une forge ; une auberge et une échoppe s'il est assez grand.
    take('temple', 1, (b) => Math.abs(dist(b, mk.x, mk.y) - (mk.a + 15)) - b.w * b.d * 0.05);
    for (const sl of slots) if (sl.type === 'temple' && !sl.label) sl.label = 'Chapelle';
    take('taverne', 1, (b) => dist(b, mk.x, mk.y), (s) => s.b.district !== 'ferme');
    if (pop >= 150) take('auberge', 1, nearGate, (s) => s.b.district !== 'ferme');
    if (pop >= 80) take('forge', 1, nearGate, (s) => s.b.district !== 'ferme');
    if (pop >= 120) take('echoppe', 1, (b) => dist(b, mk.x, mk.y), (s) => s.b.district !== 'ferme');
    // Les maisons du village sont pour moitié des fermes.
    for (const sl of slots) if (!sl.type && orngVillage() < 0.45) sl.type = 'ferme';
  } else {
  take('temple', 1 + (pop > 2500 ? 1 : 0) + (pop > 8000 ? 1 : 0), (b) => Math.abs(dist(b, mk.x, mk.y) - (mk.a + 35)) - b.w * b.d * 0.05, intraSlot);
  take('guilde', 1 + (pop > 3000 ? 1 : 0), (b) => dist(b, mk.x, mk.y), (s) => s.b.district === 'marche' || intraSlot(s));
  take('caserne', Math.max(1, Math.round(nG * 0.6)), nearGate, intraSlot);
  take('auberge', Math.max(1, Math.round(pop / 650)), nearGate, (s) => s.b.district !== 'haute' && s.b.district !== 'ferme');
  take('ecurie', Math.max(1, Math.floor(nG / 2)), nearGate, (s) => s.b.district !== 'haute' && s.b.district !== 'ferme');
  take('taverne', Math.max(2, Math.round(pop / 300)), (b) => Math.min(nearGate(b), dist(b, mk.x, mk.y)) * 0.8, (s) => s.b.district !== 'haute' && s.b.district !== 'ferme');
  take('forge', Math.max(1, Math.round(pop / 500)), nearGate, (s) => s.b.district !== 'haute' && s.b.district !== 'ferme');
  take('entrepot', Math.max(1, Math.round(pop / 800)), nearGate, (s) => s.b.district !== 'haute' && s.b.district !== 'ferme');
  take('echoppe', Math.max(3, Math.round(pop / 45)), (b) => dist(b, mk.x, mk.y), (s) => s.b.district === 'marche' || s.b.district === 'ville');
  take('atelier', Math.round(slots.filter((s) => s.b.district === 'faubourg').length * 0.3), () => 0, (s) => s.b.district === 'faubourg');
  }
  for (const s of slots) if (!s.type) s.type = s.b.district === 'haute' ? 'manoir' : s.b.district === 'ferme' ? 'ferme' : 'maison';

  // ——— Lieux de l'Atlas ———
  const features = [];
  const geometries = [];
  const addPoint = (f, x, y) => { features.push(f); geometries.push({ id: `g-${f.id}`, mapId: planId, featureId: f.id, type: 'point', coordinates: N(x, y) }); };
  const base = { canonStatus: 'creation', placementStatus: 'documented' };
  const slotOut = [];
  for (const s of slots) {
    const b = s.b, id = `${pre}b${s.i}`;
    const bound = bindings[id];
    const T = SLOT_TYPES[bound?.type ?? s.type] ?? SLOT_TYPES.maison;
    const type = bound?.type ?? s.type;
    // Façade (porte) : vers la rue ; à défaut (château), vers le centre de la ville.
    const face = b.face ?? Math.atan2(mk.y - b.y, mk.x - b.x);
    slotOut.push({ id, type: s.type, label: s.label, district: b.district, at: N(b.x, b.y), x: b.x, y: b.y, w: r1(b.w), d: r1(b.d), ang: Math.round(b.ang * 1000) / 1000, face: Math.round(face * 1000) / 1000 });
    if (type === 'maison' && !bound) continue;
    const rank = bound ? (T.rank === 'landmark' ? 'landmark' : T.rank === 'regional' ? 'regional' : 'local') : T.rank;
    const npcLine = bound?.npcs?.length ? `Sur place : ${bound.npcs.map((n) => (n.role ? `${n.name} (${n.role})` : n.name)).join(', ')}.` : '';
    addPoint({
      ...base, id, category: T.category, importance: rank, minZoom: MIN_ZOOM[rank],
      title: bound?.title || s.label || T.label,
      subtitle: bound ? (s.label && bound.type === s.type ? s.label : T.label) : (b.district === 'haute' && type !== 'manoir' ? 'Haute-ville' : undefined),
      summary: [bound?.summary, npcLine].filter(Boolean).join('\n\n') || undefined,
      entryId: bound?.entryId, relatedEntryIds: bound?.npcs?.map((n) => n.id),
    }, b.x, b.y);
  }
  // Repères de la ville : marché, portes, quartiers.
  addPoint({ ...base, id: `${pre}marche`, title: spec.village ? 'Place du village' : 'Place du marché', category: 'institution', importance: 'regional', minZoom: 0, summary: spec.village ? 'Le puits, un vieil orme et le banc des anciens.' : 'Étals, puits et crieurs : le cœur de la ville.' }, mk.x, mk.y);
  for (const g of gates) addPoint({ ...base, id: `${pre}porte-${g.i}`, title: g.name, category: 'garde', importance: 'regional', minZoom: 0, subtitle: spec.walls ? 'Porte de l’enceinte' : spec.village ? 'Entrée du village' : 'Entrée de la ville' }, g.x, g.y);
  const area = (id, title, x, y, importance = 'regional', category = 'cite') => addPoint({ ...base, id: `${pre}${id}`, title, category, importance, minZoom: importance === 'landmark' ? 0 : 0.9, area: true }, x, y);
  if (C) { const far = inPlan(C.x + Math.cos(thC) * C.r * 1.6, C.y + Math.sin(thC) * C.r * 1.6, 30) ? 1.6 : -0.2; area('q-chateau', `Château de ${spec.name}`, C.x + Math.cos(thC) * C.r * far, C.y + Math.sin(thC) * C.r * far, 'regional'); }
  if (spec.highTown) area('q-haute', 'Haute-ville', Math.cos(thC + 0.55) * R * 0.74, Math.sin(thC + 0.55) * R * 0.74);
  area('q-basse', spec.highTown ? 'Basse-ville' : spec.name, Math.cos(thC + Math.PI) * R * 0.42, Math.sin(thC + Math.PI) * R * 0.42, spec.highTown ? 'regional' : 'landmark');
  if (spec.faubourgs) for (const e of roadExits) {
    const p = along(e.pts, R * 0.3);
    if (inPlan(p.x, p.y, 20)) area(`q-faubourg-${e.gate.i}`, `Faubourg ${OF_DIR[e.gate.dir]}`, p.x - Math.sin(p.ang) * 30, p.y + Math.cos(p.ang) * 30, 'local');
  }
  if (spec.farms && fields.length) { const f = fields[Math.floor(fields.length / 2)]; area('q-champs', 'Les Champs', f.x, f.y, 'local', 'vivant'); }
  if (river) { const p = along(river.pts, polyLen(river.pts) * 0.3); area('q-riviere', river.name.replace(/^./, (c) => c.toUpperCase()), p.x, p.y, 'local', 'eau'); }

  // Rues : tracés du moteur de l'Atlas (chemins que le groupe peut suivre).
  const TRACE = { main: 'tunnel', road: 'tunnel', approach: 'galerie', ring: 'galerie', lane: 'boyau', ronde: 'boyau' };
  const RANK = { main: 'regional', road: 'regional', approach: 'regional', ring: 'local', lane: 'detail', ronde: 'detail' };
  for (const s of streets) {
    features.push({ ...base, id: s.id, title: s.name, category: 'voie', importance: RANK[s.kind], minZoom: s.kind === 'lane' || s.kind === 'ronde' ? 0.8 : 0, trace: TRACE[s.kind] });
    geometries.push({ id: `g-${s.id}`, mapId: planId, featureId: s.id, type: 'polyline', coordinates: s.pts.map(([x, y]) => N(x, y)) });
  }
  const anchors = roadExits.map((e) => ({ id: `${pre}sortie-${e.gate.i}`, mapId: planId, at: N(e.end[0], e.end[1]), label: `Route ${OF_DIR[e.gate.dir]}` }));

  // ——— Dessin (décor) et sol de la carte de combat ———
  const bound = new Set(Object.keys(bindings));
  const roofKind = (s) => (s.b.district === 'chateau' ? 'keep' : s.b.district === 'haute' ? 'roof-noble'
    : bound.has(`${pre}b${s.i}`) || !['maison', 'ferme', 'manoir', 'atelier'].includes(s.type) ? 'roof-civic'
      : s.b.district === 'faubourg' || s.b.district === 'ferme' ? 'roof-farm' : 'roof');
  const decor = [];
  const paths = {};
  const push = (k, d) => { (paths[k] ??= []).push(d); };
  for (const f of fields) push('plot', rectPath(corners(f).map(([x, y]) => U(x, y))));
  for (const [x, y, rr] of trees) push('tree', circlePath(...U(x, y), rr / scale));
  if (river) decor.push({ kind: 'river', d: linePath(river.pts.map(([x, y]) => U(x, y))), w: r1((river.hw * 2) / scale) });
  push('square', rectPath(corners(market).map(([x, y]) => U(x, y))));
  // Rempart : une seule enceinte, avec des tours à intervalles réguliers (une brèche à chaque porte).
  const wallPts = [];
  if (spec.walls) {
    for (let k = 0; k <= 96; k++) { const a = (TAU * k) / 96; const r = wallR(a); wallPts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    decor.push({ kind: 'wall', d: linePath(wallPts.map(([x, y]) => U(x, y))), w: r1(3.2 / scale) });
    for (let k = 0; k < 96; k += 4) {
      const [x, y] = wallPts[k];
      if (!gates.some((g) => Math.hypot(g.x - x, g.y - y) < 9)) push('tower', circlePath(...U(x, y), 3.6 / scale));
    }
    for (const g of gates) { push('tower', circlePath(...U(g.x + Math.cos(g.a + Math.PI / 2) * 6, g.y + Math.sin(g.a + Math.PI / 2) * 6), 4.4 / scale)); push('tower', circlePath(...U(g.x - Math.cos(g.a + Math.PI / 2) * 6, g.y - Math.sin(g.a + Math.PI / 2) * 6), 4.4 / scale)); }
  }
  const castleWall = [];
  if (C) {
    for (let k = 0; k <= 40; k++) { const a = (TAU * k) / 40; castleWall.push([C.x + Math.cos(a) * C.r, C.y + Math.sin(a) * C.r]); }
    push('court', rectPath(castleWall.map(([x, y]) => U(x, y))));
    decor.push({ kind: 'wall', d: linePath(castleWall.map(([x, y]) => U(x, y))), w: r1(4 / scale) });
    for (let k = 0; k < 6; k++) { const a = thC + (TAU * k) / 6 + 0.3; push('tower', circlePath(...U(C.x + Math.cos(a) * C.r, C.y + Math.sin(a) * C.r), 5.5 / scale)); }
  }
  for (const s of slots) push(roofKind(s), rectPath(corners(s.b).map(([x, y]) => U(x, y))));
  push('fountain', circlePath(...U(mk.x, mk.y), 2.6 / scale));
  // Ponts : là où une rue franchit la rivière.
  const bridges = [];
  if (river) for (const s of streets) for (let i = 0; i < s.pts.length - 1; i++) {
    const a = s.pts[i], b = s.pts[i + 1];
    for (let k = 0; k <= 10; k++) {
      const x = a[0] + ((b[0] - a[0]) * k) / 10, y = a[1] + ((b[1] - a[1]) * k) / 10;
      if (lineDist(x, y, river.pts) < river.hw && !bridges.some((q) => Math.hypot(q[0] - x, q[1] - y) < river.hw * 2)) {
        bridges.push([x, y]);
        push('bridge', rectPath(corners({ x, y, w: river.hw * 2.6, d: s.hw * 2 + 2, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) }).map(([px, py]) => U(px, py))));
      }
    }
  }
  const ORDER = ['plot', 'tree', 'square', 'court', 'roof-farm', 'roof', 'roof-noble', 'roof-civic', 'keep', 'bridge', 'tower', 'fountain'];
  // Le décor est dessiné dans cet ordre : champs et arbres d'abord, rivière, puis les rues (moteur), toits, ponts, tours.
  const decorOut = [
    ...ORDER.slice(0, 2).filter((k) => paths[k]).map((k) => ({ kind: k, d: paths[k].join('') })),
    ...decor.filter((x) => x.kind === 'river'),
    ...ORDER.slice(2, 4).filter((k) => paths[k]).map((k) => ({ kind: k, d: paths[k].join('') })),
    ...decor.filter((x) => x.kind === 'wall'),
    ...ORDER.slice(4).filter((k) => paths[k]).map((k) => ({ kind: k, d: paths[k].join('') })),
  ];

  const flatRect = (b) => [r1(b.x / scale + W / 2), r1(b.y / scale + H / 2), r1(b.w / scale), r1(b.d / scale), Math.round(b.ang * 1000) / 1000];
  const ground = {
    b: buildings.flatMap(flatRect),
    f: fields.flatMap(flatRect),
    t: trees.flatMap(([x, y, rr]) => [...U(x, y), r1(rr / scale)]),
    walls: [
      ...(spec.walls ? splitAtGates(wallPts, gates, 7).map((pts) => ({ pts: pts.flatMap(([x, y]) => U(x, y)), hw: r1(1.8 / scale) })) : []),
      ...(C ? splitAtGates(castleWall, [{ x: C.x - Math.cos(thC) * C.r, y: C.y - Math.sin(thC) * C.r }], 5).map((pts) => ({ pts: pts.flatMap(([x, y]) => U(x, y)), hw: r1(2 / scale) })) : []),
    ],
    water: river ? [{ pts: river.pts.flatMap(([x, y]) => U(x, y)), hw: r1(river.hw / scale) }] : [],
    roads: streets.map((s) => ({ pts: s.pts.flatMap(([x, y]) => U(x, y)), hw: r1(s.hw / scale) })),
  };

  const map = {
    id: planId, title: spec.name, scope: { kind: 'site', id: `${pre}site` }, width: W, height: H,
    defaultViewport: { x: 0.5, y: 0.5, zoom: 1 }, decor: decorOut,
    surface: { scale: r5(scale), theme: 'cite', ground },
  };
  return {
    spec, map, features, geometries, anchors, slots: slotOut,
    gates: gates.map((g) => ({ i: g.i, a: g.a, dir: g.dir, name: g.name, anchorId: `${pre}sortie-${g.i}` })),
    stats: { radius: R, buildings: buildings.length, intra: intraCount, fields: fields.length, trees: trees.length, streets: streets.length },
  };
}

/** Coupe un contour fermé en tronçons, en ménageant une ouverture de `gap` mètres à chaque porte. */
function splitAtGates(pts, gates, gap) {
  const out = [];
  let cur = [];
  for (const p of pts) {
    if (gates.some((g) => Math.hypot(g.x - p[0], g.y - p[1]) < gap)) { if (cur.length > 1) out.push(cur); cur = []; } else cur.push(p);
  }
  if (cur.length > 1) out.push(cur);
  // Le contour est fermé : réunit le dernier tronçon au premier s'ils se touchent.
  if (out.length > 1 && out[0][0] === pts[0] && out[out.length - 1][out[out.length - 1].length - 1] === pts[pts.length - 1]) {
    out[0] = [...out.pop(), ...out[0]];
  }
  return out;
}

/* ——— Monde ——— */

/** Identifiants des plans d'un monde (le plan monde a l'identifiant attendu par le reste de l'application). */
export const worldPlanId = (mapRecordId) => `map-${mapRecordId}`;
export const cityPlanId = (mapRecordId, cityId) => `map-${mapRecordId}-c-${cityId}`;

/**
 * Position d'une nouvelle cité sur le plan monde : loin des autres, tirée de la graine du monde et de l'identifiant
 * de la cité. À enregistrer avec la cité : ajouter une cité ne déplace jamais les autres.
 */
export function placeCity(world, cityId) {
  const rand = rng(hashSeed(`place:${world.seed}:${cityId}`));
  const others = (world.cities ?? []).filter((c) => c.id !== cityId && c.at).map((c) => c.at);
  let best = [0.5, 0.5], bestD = -1;
  for (let k = 0; k < 60; k++) {
    const p = [0.12 + rand() * 0.76, 0.14 + rand() * 0.72];
    const d = others.length ? Math.min(...others.map((o) => Math.hypot((o[0] - p[0]) * WORLD_W, (o[1] - p[1]) * WORLD_H))) : 400 - Math.hypot((p[0] - 0.5) * WORLD_W, (p[1] - 0.5) * WORLD_H);
    // Ni trop près (les cités se touchent), ni au bout du monde : la meilleure place entre 140 et 380 unités.
    const score = others.length ? (d < 140 ? d - 1000 : d > 380 ? 380 - (d - 380) * 0.5 : d) : d;
    if (score > bestD) { bestD = score; best = p; }
  }
  return [r5(best[0]), r5(best[1])];
}

/**
 * Jeu de données complet d'un monde : plan monde + un plan par cité, au format de l'Atlas.
 * `world` : { seed, name, cities: CitySpec[], bindings: { [entryId]: Binding } }.
 */
export function generateWorld(world, mapRecordId) {
  const seed = (world.seed ?? hashSeed(mapRecordId)) >>> 0;
  const rand = rng(hashSeed(`monde:${seed}`));
  const W = WORLD_W, H = WORLD_H, S = WORLD_SCALE;
  const wid = worldPlanId(mapRecordId);
  const name = world.name || 'Le Monde';
  const base = { canonStatus: 'creation', placementStatus: 'documented' };
  const features = [], geometries = [], anchors = [], connections = [], spaces = [], maps = [];
  const addPoint = (f, x, y, mapId = wid) => { features.push(f); geometries.push({ id: `g-${f.id}`, mapId, featureId: f.id, type: 'point', coordinates: [r5(x), r5(y)] }); };

  const cities = (world.cities ?? []).map((c) => ({ ...citySpecDefaults(c), at: c.at ?? [0.5, 0.5] }));
  const byCity = new Map();
  for (const b of Object.values(world.bindings ?? {})) {
    if (!b || !b.cityId || !b.slotId || b.excluded) continue;
    if (!byCity.has(b.cityId)) byCity.set(b.cityId, {});
    byCity.get(b.cityId)[b.slotId] = b;
  }
  const cityOut = cities.map((c) => {
    const pid = cityPlanId(mapRecordId, c.id);
    const g = cachedCity(c, pid, byCity.get(c.id) ?? {});
    maps.push(g.map);
    features.push(...g.features); geometries.push(...g.geometries); anchors.push(...g.anchors);
    spaces.push({ id: g.map.scope.id, kind: 'site', name: c.name, levelId: 'monde', stratumIds: [], mapId: pid });
    return { c, g, pid };
  });

  // Terrain du monde : forêts, rivières, lac, collines (loin des cités).
  const decor = [];
  const paths = {};
  const push = (k, d) => { (paths[k] ??= []).push(d); };
  const cityXY = cities.map((c) => [c.at[0] * W, c.at[1] * H]);
  const farFromCities = (x, y, m) => cityXY.every(([cx, cy]) => Math.hypot(cx - x, cy - y) > m);
  const forests = [];
  const nF = 8 + Math.floor(rand() * 5);
  for (let k = 0; k < nF * 4 && forests.length < nF; k++) {
    const x = 40 + rand() * (W - 80), y = 40 + rand() * (H - 80), rx = 22 + rand() * 60, ry = rx * (0.55 + rand() * 0.5);
    if (!farFromCities(x, y, Math.max(rx, ry) + 18)) continue;
    if (forests.some((f) => Math.hypot(f.x - x, f.y - y) < f.r + Math.max(rx, ry))) continue;
    const poly = blob(rand, x, y, rx, ry);
    forests.push({ x, y, r: Math.max(rx, ry), poly, name: `${rand() < 0.5 ? 'Forêt' : 'Bois'} de ${placeName(rand)}` });
  }
  for (const f of forests) {
    push('forest', rectPath(f.poly));
    for (let x = f.x - f.r; x < f.x + f.r; x += 7) for (let y = f.y - f.r; y < f.y + f.r; y += 7) {
      const jx = x + (rand() - 0.5) * 5, jy = y + (rand() - 0.5) * 5;
      if (insidePoly(jx, jy, f.poly)) push('tree', circlePath(jx, jy, 2 + rand() * 1.6));
    }
  }
  const rivers = [];
  const nR = 1 + (rand() < 0.55 ? 1 : 0);
  for (let k = 0; k < nR; k++) {
    // Source sur un bord, embouchure sur le bord opposé, méandres aléatoires.
    const vertical = rand() < 0.5;
    let x = vertical ? 80 + rand() * (W - 160) : -10, y = vertical ? -10 : 80 + rand() * (H - 160);
    let a = vertical ? Math.PI / 2 : 0;
    const base0 = a;
    const pts = [[x, y]];
    for (let s = 0; s < 120; s++) {
      a = base0 + clamp(angDiff(a + (rand() - 0.5) * 0.7, base0), -0.9, 0.9);
      x += Math.cos(a) * 16; y += Math.sin(a) * 16;
      pts.push([x, y]);
      if (x < -20 || y < -20 || x > W + 20 || y > H + 20) break;
    }
    rivers.push({ pts, name: RIVERS[Math.floor(rand() * RIVERS.length)] });
  }
  for (const r of rivers) decor.push({ kind: 'river', d: linePath(r.pts), w: 3.4 });
  if (rand() < 0.6) {
    for (let k = 0; k < 20; k++) {
      const x = 80 + rand() * (W - 160), y = 80 + rand() * (H - 160), rx = 14 + rand() * 26;
      if (!farFromCities(x, y, rx + 25) || forests.some((f) => Math.hypot(f.x - x, f.y - y) < f.r + rx)) continue;
      const poly = blob(rand, x, y, rx, rx * 0.7, 22);
      push('lake', rectPath(poly));
      addPoint({ ...base, id: `${wid}:lac`, title: `Lac de ${placeName(rand)}`, category: 'eau', importance: 'local', minZoom: 0.9, area: true }, x / W, y / H);
      rivers.push({ pts: poly.concat([poly[0]]), name: '', lake: true });
      break;
    }
  }
  for (let k = 0; k < 5; k++) {
    const x = 60 + rand() * (W - 120), y = 60 + rand() * (H - 120);
    if (!farFromCities(x, y, 45)) continue;
    for (let j = 0; j < 7; j++) {
      const hx2 = x + (rand() - 0.5) * 70, hy2 = y + (rand() - 0.5) * 40, w = 10 + rand() * 10;
      push('hill', `M${f1(hx2 - w)} ${f1(hy2)}Q${f1(hx2)} ${f1(hy2 - w * 0.8)} ${f1(hx2 + w)} ${f1(hy2)}`);
    }
  }
  forests.forEach((f, i) => addPoint({ ...base, id: `${wid}:foret-${i}`, title: f.name, category: 'vivant', importance: 'local', minZoom: 0.9, area: true }, f.x / W, f.y / H));
  rivers.filter((r) => !r.lake).forEach((r, i) => {
    const p = r.pts[Math.floor(r.pts.length * 0.4)];
    if (p) addPoint({ ...base, id: `${wid}:riviere-${i}`, title: r.name.replace(/^./, (ch) => ch.toUpperCase()), category: 'eau', importance: 'local', minZoom: 0.9, area: true }, clamp(p[0] / W, 0.02, 0.98), clamp(p[1] / H, 0.02, 0.98));
  });

  // Cités sur le plan monde : un point (qui ouvre la cité) et sa silhouette.
  for (const { c, g } of cityOut) {
    const [x, y] = [c.at[0] * W, c.at[1] * H];
    const rr = Math.max(3, g.stats.radius / S);
    push('town', circlePath(x, y, rr));
    addPoint({
      ...base, id: `${wid}:cite-${c.id}`, title: c.name, category: 'cite', importance: 'landmark', minZoom: 0,
      subtitle: `Cité · ${c.population.toLocaleString('fr-CA')} habitants`, opens: { kind: 'site', id: g.map.scope.id }, entryId: c.entryId,
    }, c.at[0], c.at[1]);
    // Chaque porte de la cité mène au monde : à l'entrée de la cité sur le plan monde (une seule ancre, sous son point).
    const aid = `${wid}:entree-${c.id}`;
    anchors.push({ id: aid, mapId: wid, at: [r5(c.at[0]), r5(c.at[1])], label: c.name });
    for (const gt of g.gates) connections.push({ id: `cx-${c.id}-${gt.i}`, kind: 'naturel', fromAnchorId: gt.anchorId, toAnchorId: aid, direction: 'both', title: `${gt.name} de ${c.name}`, ...base });
  }

  // Routes entre cités : un arbre couvrant (les plus proches d'abord), plus un raccourci quand il est court.
  const roads = [];
  if (cities.length > 1) {
    const inTree = new Set([0]);
    while (inTree.size < cities.length) {
      let best = null;
      for (const i of inTree) for (let j = 0; j < cities.length; j++) {
        if (inTree.has(j)) continue;
        const d = Math.hypot(cityXY[i][0] - cityXY[j][0], cityXY[i][1] - cityXY[j][1]);
        if (!best || d < best.d) best = { i, j, d };
      }
      inTree.add(best.j); roads.push([best.i, best.j]);
    }
    for (let i = 0; i < cities.length; i++) for (let j = i + 1; j < cities.length; j++) {
      if (roads.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) continue;
      const d = Math.hypot(cityXY[i][0] - cityXY[j][0], cityXY[i][1] - cityXY[j][1]);
      if (d < 330 && roads.filter(([a, b]) => a === i || b === i).length < 3) roads.push([i, j]);
    }
  }
  const worldRoads = [];
  const hamlets = [];
  const villages = [];
  const placesOut = [...cityOut];
  for (const [i, j] of roads) {
    const A = cityOut[i], B = cityOut[j];
    const [a, b] = A.c.id < B.c.id ? [A, B] : [B, A];
    const r = rng(hashSeed(`route:${seed}:${a.c.id}:${b.c.id}`));
    // La route va d'une cité à l'autre (de l'entrée de l'une à l'entrée de l'autre).
    const p0 = a.c.at, p1 = b.c.at;
    const pts = [[p0[0] * W, p0[1] * H]];
    const L = Math.hypot((p1[0] - p0[0]) * W, (p1[1] - p0[1]) * H);
    const n = Math.max(2, Math.round(L / 45));
    for (let k = 1; k < n; k++) {
      const t = k / n, jit = Math.sin(t * Math.PI) * (r() - 0.5) * L * 0.12;
      const x = (p0[0] + (p1[0] - p0[0]) * t) * W, y = (p0[1] + (p1[1] - p0[1]) * t) * H;
      const nx = -(p1[1] - p0[1]) * H / L, ny = (p1[0] - p0[0]) * W / L;
      pts.push([x + nx * jit, y + ny * jit]);
    }
    pts.push([p1[0] * W, p1[1] * H]);
    const id = `${wid}:route-${a.c.id}-${b.c.id}`;
    features.push({ ...base, id, title: `Route de ${a.c.name} à ${b.c.name}`, category: 'voie', importance: 'regional', minZoom: 0, trace: 'tunnel' });
    geometries.push({ id: `g-${id}`, mapId: wid, featureId: id, type: 'polyline', coordinates: pts.map(([x, y]) => [r5(x / W), r5(y / H)]) });
    worldRoads.push({ pts: pts.flatMap(([x, y]) => [r1(x), r1(y)]), hw: 0.2 });
    // Un hameau à mi-chemin sur les routes assez longues : quelques toits et leurs champs.
    if (L > 160) {
      const p = along(pts, L * (0.4 + r() * 0.2));
      const side = r() < 0.5 ? -1 : 1;
      const hx2 = p.x - Math.sin(p.ang) * side * 5, hy2 = p.y + Math.cos(p.ang) * side * 5;
      if (farFromCities(hx2, hy2, 40) && !forests.some((f) => insidePoly(hx2, hy2, f.poly))) {
        for (let k = 0; k < 6; k++) push('roof', rectPath(corners({ x: hx2 + (r() - 0.5) * 6, y: hy2 + (r() - 0.5) * 5, w: 1.3 + r() * 0.6, d: 0.9, ang: p.ang + (r() - 0.5) * 0.5 })));
        for (let k = 0; k < 5; k++) push('plot', rectPath(corners({ x: hx2 + (r() - 0.5) * 22, y: hy2 + (r() - 0.5) * 18, w: 5 + r() * 4, d: 2 + r() * 1.5, ang: p.ang + (r() - 0.5) * 0.8 })));
        hamlets.push([r1(hx2), r1(hy2), 3]);
        // Le hameau s'explore comme une cité : son plan est généré, sans muraille, avec ses fermes.
        const hname = `Hameau de ${placeName(r)}`;
        const hid = `hameau-${a.c.id}-${b.c.id}`;
        const spec = citySpecDefaults({ id: hid, name: hname, population: 50 + Math.floor(r() * 170), village: true, walls: false, castle: false, highTown: false, faubourgs: false, farms: true, river: false, at: [r5(hx2 / W), r5(hy2 / H)] });
        const hpid = cityPlanId(mapRecordId, hid);
        const hg = cachedCity(spec, hpid, byCity.get(hid) ?? {});
        maps.push(hg.map); features.push(...hg.features); geometries.push(...hg.geometries); anchors.push(...hg.anchors);
        spaces.push({ id: hg.map.scope.id, kind: 'site', name: hname, levelId: 'monde', stratumIds: [], mapId: hpid });
        villages.push(spec); placesOut.push({ c: spec, g: hg, pid: hpid });
        addPoint({ ...base, id: `${id}:hameau`, title: hname, category: 'cite', importance: 'local', minZoom: 0.9, subtitle: `Hameau · ${spec.population} habitants`, opens: { kind: 'site', id: hg.map.scope.id } }, hx2 / W, hy2 / H);
        const aid = `${wid}:entree-${hid}`;
        anchors.push({ id: aid, mapId: wid, at: [r5(hx2 / W), r5(hy2 / H)], label: hname });
        for (const gt of hg.gates) connections.push({ id: `cx-${hid}-${gt.i}`, kind: 'naturel', fromAnchorId: gt.anchorId, toAnchorId: aid, direction: 'both', title: `${gt.name} · ${hname}`, ...base });
      }
    }
  }
  // Intérieurs des bâtiments où le groupe est entré : un plan chacun, relié à la rue par sa porte.
  for (const slotId of world.interiors ?? []) {
    const city = placesOut.find(({ pid }) => slotId.startsWith(`${pid}:b`));
    const slot = city?.g.slots.find((s) => s.id === slotId);
    if (!city || !slot) continue;
    const bound = byCity.get(city.c.id)?.[slotId];
    const it = cachedInterior(slot, bound, city.g.map.scope.id, world.time ?? 'jour', world.residents?.[slotId] ?? []);
    for (const lv of [it, ...it.levels]) { maps.push(lv.map); features.push(...lv.features); geometries.push(...lv.geometries); anchors.push(...lv.anchors); spaces.push(lv.space); }
    connections.push(...it.connections);
    // Côté rue : une ancre sous le bâtiment (cachée sous son repère s'il en a un).
    anchors.push({ id: `${slotId}:porte`, mapId: city.pid, at: slot.at, label: it.space.name });
    connections.push({ id: `cx-${slotId}`, kind: 'naturel', fromAnchorId: `${slotId}:porte`, toAnchorId: `${interiorPlanId(slotId)}:sortie`, direction: 'both', title: `Porte · ${it.space.name}`, ...base });
  }

  // Champs autour des cités, à l'échelle du monde.
  for (const { c, g } of cityOut) {
    const r = rng(hashSeed(`champs:${seed}:${c.id}`));
    const [x, y] = [c.at[0] * W, c.at[1] * H], rr = Math.max(3, g.stats.radius / S);
    for (let k = 0; k < 16; k++) {
      const a = r() * TAU, d = rr * (1.6 + r() * 2.2);
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      if (forests.some((f) => insidePoly(px, py, f.poly))) continue;
      push('plot', rectPath(corners({ x: px, y: py, w: 3 + r() * 3, d: 1.2 + r(), ang: a + Math.PI / 2 })));
    }
  }

  const ORDER = ['plot', 'forest', 'tree', 'lake', 'hill', 'town', 'roof'];
  const worldDecor = [
    ...ORDER.slice(0, 4).filter((k) => paths[k]).map((k) => ({ kind: k, d: paths[k].join('') })),
    ...decor,
    ...ORDER.slice(4).filter((k) => paths[k]).map((k) => ({ kind: k, d: paths[k].join('') })),
  ];
  maps.unshift({
    id: wid, title: name, scope: { kind: 'niveau', id: 'monde' }, width: W, height: H, defaultViewport: { x: 0.5, y: 0.5, zoom: 1 },
    decor: worldDecor,
    surface: {
      scale: S, theme: 'monde',
      ground: {
        b: [], f: [], t: [], walls: [],
        forests: forests.map((f) => f.poly.flatMap(([x, y]) => [r1(x), r1(y)])),
        water: rivers.map((r) => ({ pts: r.pts.flatMap(([x, y]) => [r1(x), r1(y)]), hw: r.lake ? 0 : 0.8, closed: !!r.lake })),
        roads: worldRoads,
        towns: [...cityOut.map(({ c, g }) => [r1(c.at[0] * W), r1(c.at[1] * H), r1(Math.max(3, g.stats.radius / S))]).flat(), ...hamlets.flat()],
      },
    },
  });

  // Lumière du moment : le soir et la nuit, les plans de surface s'assombrissent (sans toucher aux plans gardés en cache).
  const light = world.time === 'nuit' || world.time === 'soir' ? world.time : null;
  const shown = light ? maps.map((m) => (m.surface ? { ...m, surface: { ...m.surface, light } } : m)) : maps;
  return {
    version: 'monde-1',
    /** Hameaux générés le long des routes (paramètres de cité) : le lore peut y poser des lieux. */
    villages,
    levels: [{ id: 'monde', order: 1, title: name, description: '', strataIds: [], survey: 'cartographie' }],
    strata: [], spaces, maps: shown, cavities: {}, features, geometries, anchors, connections,
  };
}

/** Les cités changent rarement : leur génération est gardée en mémoire (clé = paramètres + lieux posés). */
const cityCache = new Map();
function cachedCity(spec, planId, bindings) {
  const key = `${planId}|${JSON.stringify(spec)}|${JSON.stringify(bindings)}`;
  const hit = cityCache.get(key);
  if (hit) return hit;
  const out = generateCity(spec, planId, bindings);
  cityCache.set(key, out);
  if (cityCache.size > 24) cityCache.delete(cityCache.keys().next().value);
  return out;
}

/** Identifiant du plan intérieur d'un bâtiment. */
export const interiorPlanId = (slotId) => `${slotId}:int`;
const interiorCache = new Map();
function cachedInterior(slot, bound, parentSiteId, period, residents) {
  const key = `${slot.id}|${period}|${JSON.stringify(bound ?? null)}|${JSON.stringify(residents)}`;
  let hit = interiorCache.get(key);
  if (!hit) {
    hit = generateInterior({ slot, planId: interiorPlanId(slot.id), siteId: `${slot.id}:site`, parentSiteId, bound, period, residents });
    interiorCache.set(key, hit);
    if (interiorCache.size > 60) interiorCache.delete(interiorCache.keys().next().value);
  }
  return hit;
}

/** Emplacements d'une cité (sans les lieux posés), pour l'assignation du lore. */
export function citySlots(spec, planId) {
  return cachedCity(citySpecDefaults(spec), planId, {}).slots;
}

/* ——— Carte de combat : sol réel autour du lieu ——— */

/**
 * Grille de combat (cols × rows caractères, cf. battle/terrain.ts) tirée du sol d'un plan de surface.
 * `win` : fenêtre en coordonnées 0–1 du plan. Bâtiments et remparts = infranchissables ; rivière = eau ;
 * pont = pont ; arbres = obstacles ; champs et sous-bois = décor praticable ; rues et prés = sol.
 */
export function rasterGround(surface, W, H, win, cols, rows, seed = 0) {
  const g = surface.ground ?? {};
  const rects = [];
  for (const [list, kind] of [[g.b ?? [], 'b'], [g.f ?? [], 'f'], [g.o ?? [], 'o']]) for (let i = 0; i + 4 < list.length; i += 5) rects.push({ x: list[i], y: list[i + 1], w: list[i + 2], d: list[i + 3], ang: list[i + 4], kind });
  const pairs = (flat) => { const out = []; for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i], flat[i + 1]]); return out; };
  const walls = (g.walls ?? []).map((w) => ({ pts: pairs(w.pts), hw: w.hw }));
  const water = (g.water ?? []).map((w) => ({ pts: pairs(w.pts), hw: w.hw, closed: w.closed }));
  const roads = (g.roads ?? []).map((w) => ({ pts: pairs(w.pts), hw: w.hw }));
  const forests = (g.forests ?? []).map(pairs);
  const towns = [];
  for (let i = 0; i + 2 < (g.towns ?? []).length; i += 3) towns.push(g.towns.slice(i, i + 3));
  const trees = [];
  for (let i = 0; i + 2 < (g.t ?? []).length; i += 3) trees.push(g.t.slice(i, i + 3));
  // Ne garder que ce qui touche la fenêtre (avec une marge).
  const x0 = win.x0 * W, y0 = win.y0 * H, x1 = (win.x0 + win.w) * W, y1 = (win.y0 + win.h) * H, m = 30;
  const near = (x, y, r = 0) => x > x0 - m - r && x < x1 + m + r && y > y0 - m - r && y < y1 + m + r;
  const R = rects.filter((b) => near(b.x, b.y, Math.max(b.w, b.d)));
  const T = trees.filter(([x, y, r]) => near(x, y, r));
  const lineNear = (l) => l.pts.some(([x, y]) => near(x, y, 60));
  const Wl = walls.filter(lineNear), Wa = water.filter(lineNear), Ro = roads.filter(lineNear);
  const rand = rng(seed);
  const out = [];
  const doors = pairs(g.doors ?? []);
  // Taille d'une case en unités de plan : un mur plus fin qu'une case (cloison) en occupe quand même une, et un petit
  // meuble compte s'il couvre une partie de la case (centre ou quarts), pas seulement son centre.
  const cw = (x1 - x0) / cols, ch = (y1 - y0) / rows;
  const samples = (x, y) => [[x, y], [x - cw / 4, y - ch / 4], [x + cw / 4, y - ch / 4], [x - cw / 4, y + ch / 4], [x + cw / 4, y + ch / 4]];
  // Murs : on suit chaque tronçon à petits pas et on bloque les cases traversées (un mur fin occupe une case, coins
  // compris) ; puis chaque ouverture rouvre la case où elle tombe.
  const cellOf = (x, y) => { const c = Math.floor((x - x0) / cw), r = Math.floor((y - y0) / ch); return c >= 0 && r >= 0 && c < cols && r < rows ? r * cols + c : -1; };
  const wallCells = new Set(), doorCells = new Set();
  for (const w of Wl) for (let i = 0; i < w.pts.length - 1; i++) {
    const [ax, ay] = w.pts[i], [bx, by] = w.pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (Math.min(cw, ch) * 0.25)));
    for (let k = 0; k <= n; k++) { const ci = cellOf(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n); if (ci >= 0) wallCells.add(ci); }
  }
  for (const [dx, dy] of doors) { const ci = cellOf(dx, dy); if (ci >= 0) doorCells.add(ci); }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = x0 + ((c + 0.5) / cols) * (x1 - x0), y = y0 + ((r + 0.5) / rows) * (y1 - y0);
    const jitter = rand();
    const b = R.find((q) => q.kind !== 'o' && inRect(x, y, q));
    if (b && b.kind === 'b') { out.push('#'); continue; }
    const idx = r * cols + c;
    if (!doorCells.has(idx) && (wallCells.has(idx) || Wl.some((w) => lineDist(x, y, w.pts) <= w.hw))) { out.push('#'); continue; }
    if (R.some((q) => q.kind === 'o' && samples(x, y).some(([sx, sy]) => inRect(sx, sy, q)))) { out.push('I'); continue; }
    const wet = Wa.some((w) => (w.closed ? insidePoly(x, y, w.pts) : lineDist(x, y, w.pts) <= w.hw));
    const road = Ro.some((w) => lineDist(x, y, w.pts) <= w.hw);
    if (wet) { out.push(road ? '=' : '~'); continue; }
    if (road) { out.push('.'); continue; }
    if (towns.some(([tx, ty, tr]) => Math.hypot(tx - x, ty - y) < tr)) { out.push(jitter < 0.55 ? '#' : '.'); continue; }
    if (T.some(([tx, ty, tr]) => Math.hypot(tx - x, ty - y) <= tr * 0.6)) { out.push('I'); continue; }
    if (T.some(([tx, ty, tr]) => Math.hypot(tx - x, ty - y) <= tr)) { out.push(','); continue; }
    if (forests.some((p) => insidePoly(x, y, p))) { out.push(jitter < 0.2 ? 'I' : jitter < 0.55 ? ',' : '.'); continue; }
    if ((b && b.kind === 'f') || R.some((q) => q.kind === 'f' && samples(x, y).some(([sx, sy]) => inRect(sx, sy, q)))) { out.push(','); continue; }
    out.push('.');
  }
  return out.join('');
}
