/**
 * Suivi du groupe, partagé par la carte de navigation et la Table de jeu :
 * déplacer le groupe, et trouver le lieu nommé au bout d'un sentier.
 */
import type { AtlasData, AtlasGeometry } from './atlas/types';
import type { MapOverlay, PartyPlace } from './mapStore';

/** Déplace le groupe : l'ancienne position rejoint le parcours, et la destination atteinte s'efface. */
export function withPartyAt(base: MapOverlay, p: PartyPlace): MapOverlay {
  const cur = base.party ?? { trail: [] };
  if (cur.at?.id === p.id) return base;
  const trail = cur.at ? [...cur.trail.filter((x) => x.id !== cur.at!.id && x.id !== p.id), cur.at].slice(-8) : cur.trail;
  return { ...base, party: { at: p, dest: cur.dest?.id === p.id ? undefined : cur.dest, trail } };
}

/**
 * Lieu nommé le plus proche d'un point du plan : celui qui porte `name` d'abord, puis les lieux importants ;
 * les détails (flaque, galets) en dernier. Rien au-delà de `radius`.
 */
export function placeNear(data: AtlasData, planId: string, at: [number, number], opts: { name?: string; radius?: number; exclude?: string } = {}): PartyPlace | null {
  const radius = opts.radius ?? 0.06;
  const byId = new Map(data.features.map((f) => [f.id, f]));
  let best: PartyPlace | null = null, bestScore = radius;
  for (const g of data.geometries) {
    if (g.mapId !== planId || g.type !== 'point' || g.featureId.startsWith('mk-') || g.featureId === opts.exclude) continue;
    const f = byId.get(g.featureId);
    if (!f || f.area || f.trace) continue;
    const [x, y] = g.coordinates as [number, number];
    const d = Math.hypot(x - at[0], y - at[1]);
    if (d > radius) continue;
    const score = d + (opts.name && f.title === opts.name ? -1 : 0) + (f.importance === 'detail' ? 0.04 : 0);
    if (score < bestScore) { bestScore = score; best = { id: f.id, kind: 'feature', title: f.title, planId }; }
  }
  return best;
}

/** Extrémité d'un tracé la plus éloignée d'un point : là où mène le sentier quand on part de ce point. */
export function farEnd(g: AtlasGeometry, from: [number, number]): [number, number] {
  const pts = g.coordinates as [number, number][];
  const a = pts[0], b = pts[pts.length - 1];
  return Math.hypot(a[0] - from[0], a[1] - from[1]) > Math.hypot(b[0] - from[0], b[1] - from[1]) ? a : b;
}
