/**
 * Trajets du groupe le long d'un chemin de la carte de navigation : on s'arrête à chaque caverne ou lieu rencontré
 * sur le tracé (une étape), on choisit sa direction depuis le milieu d'un tunnel, et on estime le temps de marche
 * (en heures de jeu) pour les jets de rencontre.
 */
import type { AtlasData, AtlasGeometry } from './atlas/types';
import type { PartyPlace } from './mapStore';
import { placeNear } from './party';

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

/** Une direction possible sur un chemin depuis le groupe : jusqu'à la prochaine étape (ou au bout). */
export type Leg = { dir: 'a' | 'b'; to: PartyPlace | null; points: Pt[]; hours: number; toward: string };

/**
 * Les étapes d'un chemin depuis le groupe : vers chacun de ses deux bouts, la prochaine caverne ou le prochain lieu
 * posé sur le tracé ; à défaut, le lieu au bout du chemin.
 */
export function legsOf(data: AtlasData, planId: string, g: AtlasGeometry, from: Pt, trace?: string, exclude?: string): Leg[] {
  const pts = g.coordinates as Pt[];
  const L = lengthOf(pts);
  const here = project(pts, from);
  const byId = new Map(data.features.map((f) => [f.id, f]));
  const stops: { s: number; place: PartyPlace; at: Pt }[] = [];
  for (const q of data.geometries) {
    if (q.mapId !== planId || q.type !== 'point' || q.featureId === exclude || q.featureId.startsWith('mk-')) continue;
    const f = byId.get(q.featureId);
    if (!f || f.trace || f.area) continue;
    const p = q.coordinates as Pt;
    const pr = project(pts, p);
    if (pr.d <= 0.018) stops.push({ s: pr.s, place: { id: f.id, kind: 'feature', title: f.title, planId }, at: p });
  }
  const legs: Leg[] = [];
  for (const dir of ['a', 'b'] as const) {
    const ahead = stops.filter((x) => (dir === 'b' ? x.s > here.s + 0.012 : x.s < here.s - 0.012)).sort((x, y) => (dir === 'b' ? x.s - y.s : y.s - x.s));
    const endS = dir === 'b' ? L : 0;
    if (Math.abs(endS - here.s) < 0.012) continue; // déjà à ce bout
    const stop = ahead[0];
    const s1 = stop ? stop.s : endS;
    const route = subpath(pts, here.s, s1);
    const end = stop ? stop.at : route[route.length - 1];
    const to = stop ? stop.place : placeNear(data, planId, end, { radius: 0.04, exclude });
    const points: Pt[] = [from, ...route, end];
    // Direction : un peu plus loin sur le tracé (même règle que sur l'écran joueur).
    const probe = subpath(pts, here.s, dir === 'b' ? Math.min(L, here.s + 0.05) : Math.max(0, here.s - 0.05));
    const far = probe[probe.length - 1];
    legs.push({ dir, to, points, hours: hoursOf(lengthOf(points), trace), toward: towardOf(far[0] - from[0], far[1] - from[1]) });
  }
  return legs;
}
