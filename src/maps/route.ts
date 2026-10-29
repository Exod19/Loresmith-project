/**
 * Réseau des chemins d'un plan, vu par le MJ : quels lieux chaque sentier relie, et si le suivre rapproche le groupe
 * de son objectif ou l'en éloigne, en tenant compte de tout le labyrinthe (plus court chemin, pas la ligne droite).
 * Les passages secrets en font partie (le MJ les connaît) ; on signale quand le meilleur trajet en emprunte un.
 */
import type { AtlasData } from './atlas/types';
import type { PartyPlace } from './mapStore';
import { placeNear } from './party';

type Pt = [number, number];
export type RouteEdge = { a: string; b: string; trailId: string; len: number; secret: boolean };
export type RouteGraph = { places: Map<string, PartyPlace & { at: Pt }>; edges: RouteEdge[]; ends: Map<string, [string, string]> };

const JOIN_R = 0.04;
const polyLen = (pts: Pt[]) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

/** Le lieu (ou l'ancre) au bout d'un tracé ; à défaut, un carrefour anonyme, partagé par les tracés qui s'y rejoignent. */
function nodeAt(data: AtlasData, planId: string, p: Pt, places: RouteGraph['places']): string {
  const place = placeNear(data, planId, p, { radius: JOIN_R });
  const anchor = data.anchors
    .filter((a) => a.mapId === planId)
    .map((a) => ({ a, d: Math.hypot(a.at[0] - p[0], a.at[1] - p[1]) }))
    .filter((x) => x.d <= JOIN_R)
    .sort((x, y) => x.d - y.d)[0];
  if (anchor && (!place || anchor.d < 0.02)) {
    places.set(anchor.a.id, { id: anchor.a.id, kind: 'anchor', title: anchor.a.label, planId, at: anchor.a.at as Pt });
    return anchor.a.id;
  }
  if (place) {
    const g = data.geometries.find((x) => x.featureId === place.id && x.mapId === planId && x.type === 'point');
    places.set(place.id, { ...place, at: (g?.coordinates as Pt) ?? p });
    return place.id;
  }
  // Carrefour : on arrondit pour que deux tracés qui se touchent partagent le même nœud.
  const key = `j:${Math.round(p[0] / 0.012)},${Math.round(p[1] / 0.012)}`;
  if (!places.has(key)) places.set(key, { id: key, kind: 'feature', title: 'carrefour', planId, at: p });
  return key;
}

/** Réseau d'un plan : chaque sentier relie deux nœuds (lieux, ancres ou carrefours). */
export function buildRoutes(data: AtlasData, planId: string): RouteGraph {
  const places: RouteGraph['places'] = new Map();
  const edges: RouteEdge[] = [];
  const ends = new Map<string, [string, string]>();
  const byId = new Map(data.features.map((f) => [f.id, f]));
  for (const g of data.geometries) {
    if (g.mapId !== planId || g.type !== 'polyline') continue;
    const f = byId.get(g.featureId);
    if (!f?.trace) continue;
    const pts = g.coordinates as Pt[];
    if (pts.length < 2) continue;
    const a = nodeAt(data, planId, pts[0], places), b = nodeAt(data, planId, pts[pts.length - 1], places);
    if (a === b) continue;
    edges.push({ a, b, trailId: f.id, len: polyLen(pts), secret: f.trace === 'secret' });
    ends.set(f.id, [a, b]);
  }
  return { places, edges, ends };
}

export type Reach = { dist: number; hops: number; viaSecret: boolean };

/** Distance de chaque nœud jusqu'à l'objectif (plus court chemin le long des sentiers). */
export function distancesTo(graph: RouteGraph, targets: string[]): Map<string, Reach> {
  const best = new Map<string, Reach>();
  const queue: [string, Reach][] = targets.filter((t) => graph.places.has(t)).map((t) => [t, { dist: 0, hops: 0, viaSecret: false }]);
  for (const [t, r] of queue) best.set(t, r);
  const adj = new Map<string, RouteEdge[]>();
  for (const e of graph.edges) {
    adj.set(e.a, [...(adj.get(e.a) ?? []), e]);
    adj.set(e.b, [...(adj.get(e.b) ?? []), e]);
  }
  // Dijkstra simple (quelques centaines de nœuds au plus).
  while (queue.length) {
    queue.sort((x, y) => x[1].dist - y[1].dist);
    const [u, ru] = queue.shift()!;
    if ((best.get(u)?.dist ?? Infinity) < ru.dist) continue;
    for (const e of adj.get(u) ?? []) {
      const v = e.a === u ? e.b : e.a;
      const r = { dist: ru.dist + e.len, hops: ru.hops + 1, viaSecret: ru.viaSecret || e.secret };
      if (r.dist < (best.get(v)?.dist ?? Infinity)) { best.set(v, r); queue.push([v, r]); }
    }
  }
  return best;
}

/** Nœuds qui représentent l'objectif : le lieu lui-même, sinon les nœuds du réseau à sa portée. */
export function goalNodes(graph: RouteGraph, dest: PartyPlace, destAt: Pt | null): string[] {
  if (graph.places.has(dest.id)) return [dest.id];
  if (!destAt) return [];
  const near = [...graph.places.values()]
    .map((p) => ({ id: p.id, d: Math.hypot(p.at[0] - destAt[0], p.at[1] - destAt[1]) }))
    .filter((x) => x.d <= 0.07)
    .sort((x, y) => x.d - y.d);
  return near.length ? [near[0].id] : [];
}

/** Les nœuds où se trouve le groupe : son lieu, et ceux de la salle qu'il occupe (à quelques pas). */
export function nodesOf(graph: RouteGraph, at: PartyPlace | undefined, atXY: Pt | null, radius = 0.045): string[] {
  const out = new Set<string>();
  if (at && graph.places.has(at.id)) out.add(at.id);
  if (atXY) for (const p of graph.places.values()) if (Math.hypot(p.at[0] - atXY[0], p.at[1] - atXY[1]) <= radius) out.add(p.id);
  if (!out.size) { const n = nodeOf(graph, at, atXY); if (n) out.add(n); }
  return [...out];
}

/** Le nœud où se trouve le groupe (son lieu, sinon le nœud le plus proche). */
export function nodeOf(graph: RouteGraph, at: PartyPlace | undefined, atXY: Pt | null): string | null {
  if (at && graph.places.has(at.id)) return at.id;
  if (!atXY) return null;
  const near = [...graph.places.values()]
    .map((p) => ({ id: p.id, d: Math.hypot(p.at[0] - atXY[0], p.at[1] - atXY[1]) }))
    .filter((x) => x.d <= 0.06)
    .sort((x, y) => x.d - y.d)[0];
  return near?.id ?? null;
}

export type TrailVerdict = {
  /** Où mène le sentier depuis le groupe (lieu, ancre ou carrefour). */
  to: (PartyPlace & { at: Pt }) | null;
  verdict: 'goal' | 'best' | 'detour' | 'farther' | 'dead' | 'unknown' | 'off';
  /** Étapes (sentiers) restantes jusqu'à l'objectif : d'ici, et après ce sentier. */
  hopsNow?: number; hopsAfter?: number;
  viaSecret?: boolean;
};

/**
 * Verdict d'un sentier pour le MJ : mène-t-il à l'objectif, s'en rapproche-t-il, s'en éloigne-t-il ? `off` : le groupe
 * n'est pas à un bout de ce sentier ; `unknown` : pas d'objectif, ou objectif hors de ce réseau.
 */
export function judgeTrail(graph: RouteGraph, reach: Map<string, Reach> | null, group: { node: string | null; at: Pt | null }, trailId: string): TrailVerdict {
  const ends = graph.ends.get(trailId);
  if (!ends) return { to: null, verdict: 'unknown' };
  const pa = graph.places.get(ends[0])!, pb = graph.places.get(ends[1])!;
  // Départ : le bout où se trouve le groupe (son nœud), sinon le bout le plus proche de lui, à quelques pas au plus.
  const near = (p: PartyPlace & { at: Pt }) => (group.at ? Math.hypot(p.at[0] - group.at[0], p.at[1] - group.at[1]) : Infinity);
  const startId = ends.includes(group.node ?? '') ? group.node! : near(pa) <= near(pb) ? ends[0] : ends[1];
  const start = graph.places.get(startId)!;
  if (startId !== group.node && near(start) > 0.06) return { to: null, verdict: 'off' };
  const toId = ends[0] === startId ? ends[1] : ends[0];
  const to = graph.places.get(toId) ?? null;
  if (!reach || !reach.size) return { to, verdict: 'unknown' };
  const now = (group.node && reach.get(group.node)) || reach.get(startId);
  const after = reach.get(toId);
  if (after && after.hops === 0) return { to, verdict: 'goal', hopsNow: now?.hops, hopsAfter: 0 };
  if (!after) return { to, verdict: 'dead', hopsNow: now?.hops };
  if (!now) return { to, verdict: 'best', hopsAfter: after.hops, viaSecret: after.viaSecret };
  const len = graph.edges.find((e) => e.trailId === trailId)?.len ?? 0;
  const walk = startId === group.node || !group.node ? 0 : Math.hypot(start.at[0] - graph.places.get(group.node)!.at[0], start.at[1] - graph.places.get(group.node)!.at[1]);
  // Sur un plus court chemin : aller au départ + ce sentier + le reste depuis l'arrivée ≈ la distance d'ici (8 % près).
  const onBest = walk + len + after.dist <= now.dist * 1.08 + 1e-6;
  const verdict = onBest ? 'best' : after.dist < now.dist - 1e-6 ? 'detour' : 'farther';
  return { to, verdict, hopsNow: now.hops, hopsAfter: after.hops, viaSecret: after.viaSecret };
}

/** Phrase courte pour le MJ. */
export function verdictText(v: TrailVerdict, goal?: string): string {
  const n = (k?: number) => (k === undefined ? '?' : `${k} étape${k > 1 ? 's' : ''}`);
  switch (v.verdict) {
    case 'goal': return `🎯 Mène droit à l’objectif${goal ? ` (${goal})` : ''}.`;
    case 'best': return `↗ Meilleur chemin vers l’objectif : encore ${n(v.hopsAfter)} après celui-ci${v.viaSecret ? ' (le trajet passe par un passage secret)' : ''}.`;
    case 'detour': return `↝ Rapproche, mais par un détour : encore ${n(v.hopsAfter)} après celui-ci (le meilleur trajet d’ici en compte ${n(v.hopsNow)}).`;
    case 'farther': return `↘ Éloigne de l’objectif : encore ${n(v.hopsAfter)} après celui-ci (le meilleur trajet d’ici en compte ${n(v.hopsNow)}).`;
    case 'dead': return '⛔ Impasse pour l’objectif : on ne l’atteint plus par là.';
    case 'off': return 'Le groupe n’est pas à un bout de ce chemin.';
    default: return goal ? 'Objectif hors de ce plan ou hors du réseau de chemins.' : 'Aucun objectif fixé (« En faire la destination » sur la fiche d’un lieu).';
  }
}

