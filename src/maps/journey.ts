/**
 * Trajets du groupe le long d'un chemin de la carte de navigation : on s'arrête à chaque caverne ou lieu rencontré
 * sur le tracé (une étape), on choisit sa direction depuis le milieu d'un tunnel, et on estime le temps de marche
 * (en heures de jeu) pour les jets de rencontre.
 */
import type { AtlasData, AtlasGeometry } from './atlas/types';
import type { PartyPlace } from './mapStore';
import { placeNear } from './party';
import { cavityPoints } from './atlas/model';

type Pt = [number, number];

/** Traverser toute la largeur d'un plan prend environ 16 heures de marche prudente ; certains passages ralentissent. */
const HOURS_PER_PLAN = 16;
const SLOW: Record<string, number> = { tunnel: 1, galerie: 1, ruisseau: 1.4, boyau: 1.6, secret: 1.5, etroit: 1.8, crevasse: 2 };

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Position d'un point projeté sur un tracé : abscisse curviligne `s`, distance au tracé `d`, point projeté. */
export function project(pts: Pt[], p: Pt): { s: number; d: number; at: Pt } {
  let best = { s: 0, d: Infinity, at: pts[0] };
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-9;
    const k = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (L * L)));
    const at: Pt = [a[0] + k * dx, a[1] + k * dy];
    const d = dist(at, p);
    if (d < best.d) best = { s: acc + k * L, d, at };
    acc += L;
  }
  return best;
}

export const lengthOf = (pts: Pt[]) => pts.reduce((sum, p, i) => (i ? sum + dist(pts[i - 1], p) : 0), 0);

/** Portion du tracé entre deux abscisses (dans un sens ou dans l'autre), coins compris. */
export function subpath(pts: Pt[], s0: number, s1: number): Pt[] {
  const forward = s1 >= s0;
  const lo = Math.min(s0, s1), hi = Math.max(s0, s1);
  const at = (s: number): Pt => {
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const L = dist(pts[i], pts[i + 1]);
      if (acc + L >= s) { const k = L ? (s - acc) / L : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k]; }
      acc += L;
    }
    return pts[pts.length - 1];
  };
  const out: Pt[] = [at(lo)];
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    acc += dist(pts[i], pts[i + 1]);
    if (acc > lo && acc < hi) out.push(pts[i + 1]);
  }
  out.push(at(hi));
  return forward ? out : out.reverse();
}

const COMPASS = ['l’est', 'le nord-est', 'le nord', 'le nord-ouest', 'l’ouest', 'le sud-ouest', 'le sud', 'le sud-est'];
export const towardOf = (dx: number, dy: number) => COMPASS[((Math.round(Math.atan2(-dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];

/** Heures de marche (jeu) pour une longueur de tracé, selon le type de passage. */
export const hoursOf = (len: number, trace?: string) => len * HOURS_PER_PLAN * (SLOW[trace ?? ''] ?? 1.2);

/** « 1 h 20 », « 40 min » (arrondi à 10 minutes). */
export function hoursLabel(h: number) {
  const m = Math.max(10, Math.round((h * 60) / 10) * 10);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}`;
}

/* ——— Cavernes traversées : seuls leurs lieux (et ceux posés sur le tracé) sont des étapes ——— */

const inside = (p: Pt, poly: Pt[]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const cavesCache = new WeakMap<AtlasData, Map<string, Pt[][]>>();
/** Contours des cavernes d'un plan (même tirage que le dessin), calculés une fois. */
function cavesOf(data: AtlasData, planId: string): Pt[][] {
  let byPlan = cavesCache.get(data);
  if (!byPlan) { byPlan = new Map(); cavesCache.set(data, byPlan); }
  let caves = byPlan.get(planId);
  if (!caves) { caves = (data.cavities[planId] ?? []).map((c) => cavityPoints(c, 1, 1, 0, 44)); byPlan.set(planId, caves); }
  return caves;
}
/** Le tracé passe-t-il à l'intérieur de cette caverne ? (échantillonné le long des segments) */
function crosses(pts: Pt[], poly: Pt[]) {
  for (let i = 0; i < pts.length - 1; i++) {
    const n = Math.max(2, Math.ceil(dist(pts[i], pts[i + 1]) / 0.003));
    for (let k = 0; k <= n; k++) if (inside([pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * k) / n, pts[i][1] + ((pts[i + 1][1] - pts[i][1]) * k) / n], poly)) return true;
  }
  return false;
}
/** Distance maximale d'un lieu au tracé pour être « sur le chemin » quand il n'est dans aucune caverne traversée. */
const ON_TRAIL = 0.005;

/** Un lieu à l'écart du tracé est vu de plus loin que ça : le groupe s'arrête sur le chemin, vis-à-vis, sans y aller. */
const ASIDE = 0.004;

/** Lieu vu en passant, à côté du chemin : où il est, et de quel côté (dans le sens de la marche). */
export type Aside = { place: PartyPlace; at: Pt; side: 'gauche' | 'droite' };

/**
 * Une direction possible sur un chemin depuis le groupe : jusqu'à la prochaine étape (ou au bout). Si l'étape est un
 * lieu à côté du chemin, le trajet s'arrête sur le tracé, vis-à-vis (`aside`) : les joueurs choisissent d'y aller ou non.
 */
export type Leg = { dir: 'a' | 'b'; to: PartyPlace | null; points: Pt[]; hours: number; toward: string; aside?: Aside };

/**
 * Les étapes d'un chemin depuis le groupe : vers chacun de ses deux bouts, la prochaine caverne ou le prochain lieu
 * posé sur le tracé ; à défaut, le lieu au bout du chemin.
 */
export function legsOf(data: AtlasData, planId: string, g: AtlasGeometry, from: Pt, trace?: string, exclude?: string): Leg[] {
  const pts = g.coordinates as Pt[];
  const L = lengthOf(pts);
  const here = project(pts, from);
  const byId = new Map(data.features.map((f) => [f.id, f]));
  // Étapes : les lieux des cavernes que le chemin traverse (pas les cavernes voisines ni celles d'un chemin
  // transversal), et ceux posés sur le tracé même. La caverne où se tient déjà le groupe n'est pas une étape.
  const caves = cavesOf(data, planId);
  // Les cavernes aux deux bouts du chemin ne sont pas des étapes : on y arrive (c'est la destination), on n'y passe pas.
  const crossed = caves.filter((poly) => crosses(pts, poly) && !inside(from, poly) && !inside(pts[0], poly) && !inside(pts[pts.length - 1], poly));
  const stops: { s: number; place: PartyPlace; at: Pt; d: number; on: Pt }[] = [];
  for (const q of data.geometries) {
    if (q.mapId !== planId || q.type !== 'point' || q.featureId === exclude || q.featureId.startsWith('mk-')) continue;
    const f = byId.get(q.featureId);
    // Un simple détail (piton, éboulis, racine…) se voit en passant : ce n'est pas une étape.
    if (!f || f.trace || f.area || f.importance === 'detail') continue;
    const p = q.coordinates as Pt;
    const pr = project(pts, p);
    if (pr.d > 0.03) continue;
    const inCrossedCave = crossed.some((poly) => inside(p, poly));
    const inOtherCave = !inCrossedCave && caves.some((poly) => inside(p, poly));
    if (inCrossedCave || (!inOtherCave && pr.d <= ON_TRAIL)) stops.push({ s: pr.s, place: { id: f.id, kind: 'feature', title: f.title, planId }, at: p, d: pr.d, on: pr.at });
  }
  const legs: Leg[] = [];
  for (const dir of ['a', 'b'] as const) {
    const ahead = stops.filter((x) => (dir === 'b' ? x.s > here.s + 0.012 : x.s < here.s - 0.012)).sort((x, y) => (dir === 'b' ? x.s - y.s : y.s - x.s));
    const endS = dir === 'b' ? L : 0;
    if (Math.abs(endS - here.s) < 0.012) continue; // déjà à ce bout
    const stop = ahead[0];
    const s1 = stop ? stop.s : endS;
    const route = subpath(pts, here.s, s1);
    // Un lieu à côté du chemin : on s'arrête sur le tracé, vis-à-vis, au lieu de quitter le sentier pour le rejoindre.
    const aside = stop && stop.d > ASIDE ? stop : null;
    const end = aside ? aside.on : stop ? stop.at : route[route.length - 1];
    // Au bout du chemin : un lieu de la caverne où il aboutit, sinon un lieu tout proche du bout (jamais la voisine).
    const endCave = caves.find((poly) => inside(end, poly));
    const atEnd = placeNear(data, planId, end, { radius: endCave ? 0.03 : 0.01, exclude });
    const endAt = atEnd ? (data.geometries.find((x) => x.featureId === atEnd.id && x.mapId === planId)?.coordinates as Pt | undefined) : undefined;
    const to = stop ? stop.place : atEnd && (!endCave || (endAt && inside(endAt, endCave))) ? atEnd : null;
    const points: Pt[] = [from, ...route, end];
    // Direction : un peu plus loin sur le tracé (même règle que sur l'écran joueur).
    const probe = subpath(pts, here.s, dir === 'b' ? Math.min(L, here.s + 0.05) : Math.max(0, here.s - 0.05));
    const far = probe[probe.length - 1];
    let side: Aside | undefined;
    if (aside) {
      // De quel côté, dans le sens de la marche (y vers le bas : produit vectoriel positif = à droite).
      const before = route.length > 1 ? route[route.length - 2] : from;
      const tx = end[0] - before[0], ty = end[1] - before[1];
      const cross = tx * (aside.at[1] - end[1]) - ty * (aside.at[0] - end[0]);
      side = { place: aside.place, at: aside.at, side: cross > 0 ? 'droite' : 'gauche' };
    }
    const walk = aside ? [from, ...route] : points;
    legs.push({ dir, to, points: walk, hours: hoursOf(lengthOf(walk), trace), toward: towardOf(far[0] - from[0], far[1] - from[1]), aside: side });
  }
  return legs;
}
