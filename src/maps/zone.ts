/**
 * Zone où se trouve le groupe : la caverne qu'il occupe (les cavités dessinées qui se fondent en une seule salle),
 * ou, hors de toute caverne, le tunnel qu'il emprunte. Sert à ne proposer que ce qui est vraiment là :
 * les éléments de cette salle et les chemins qui y débouchent, jamais ceux de la caverne voisine.
 */
import type { AtlasData } from './atlas/types';
import { cavityPoints } from './atlas/model';

type Pt = [number, number];
export type Zone =
  | { kind: 'cave'; polys: Pt[][] }
  | { kind: 'tunnel'; lines: Pt[][] }
  | { kind: 'spot'; at: Pt };

const inside = (p: Pt, poly: Pt[]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const segDist = (p: Pt, a: Pt, b: Pt) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};
const lineDist = (p: Pt, pts: Pt[]) => pts.slice(1).reduce((m, q, i) => Math.min(m, segDist(p, pts[i], q)), Infinity);

/** Zone du groupe sur un plan (coordonnées 0–1 du plan). */
export function zoneOf(data: AtlasData, planId: string, at: Pt): Zone {
  const cavs = (data.cavities[planId] ?? []).map((c) => ({ c, poly: cavityPoints(c, 1, 1, 0, 44) }));
  const hit = cavs.filter((x) => inside(at, x.poly));
  if (hit.length) {
    // Les cavités qui se recouvrent largement (le centre de l'une dans l'autre) forment la même salle. Pas de
    // propagation de proche en proche : une salle voisine qui ne fait que toucher reste une autre salle.
    const room = new Set(hit);
    for (const x of cavs) {
      if (room.has(x)) continue;
      if (hit.some((h) => inside([x.c.cx, x.c.cy], h.poly) || inside([h.c.cx, h.c.cy], x.poly))) room.add(x);
    }
    return { kind: 'cave', polys: [...room].map((x) => x.poly) };
  }
  // Hors caverne : le ou les tracés sur lesquels se tient le groupe.
  const lines = data.geometries
    .filter((g) => g.mapId === planId && g.type === 'polyline' && data.features.some((f) => f.id === g.featureId && f.trace))
    .map((g) => g.coordinates as Pt[])
    .filter((pts) => lineDist(at, pts) <= 0.012);
  return lines.length ? { kind: 'tunnel', lines } : { kind: 'spot', at };
}

/** Un point (lieu, repère) est-il dans la zone ? */
export function inZone(z: Zone, p: Pt): boolean {
  if (z.kind === 'cave') return z.polys.some((poly) => inside(p, poly));
  if (z.kind === 'tunnel') return z.lines.some((l) => lineDist(p, l) <= 0.01);
  return Math.hypot(p[0] - z.at[0], p[1] - z.at[1]) <= 0.02;
}

/** Un chemin débouche-t-il dans la zone (un de ses bouts, ou son tracé, y entre) ? */
export function trailInZone(z: Zone, pts: Pt[]): boolean {
  if (z.kind === 'tunnel') return z.lines.some((l) => l === pts || inZone(z, pts[0]) || inZone(z, pts[pts.length - 1]) || l.some((q) => lineDist(q, pts) <= 0.004));
  // Échantillonne le tracé : un passage qui traverse la salle y débouche aussi.
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      if (inZone(z, [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t])) return true;
    }
  }
  return false;
}

/* ——— Brouillard de la carte de navigation : ce que le groupe voit, arrêté par les parois ——— */

export type Shapes = { polys: Pt[][]; lines: Pt[][] };

/** Distance d'un point au contour d'un polygone (sommets denses : approximation suffisante). */
const polyDist = (p: Pt, poly: Pt[]) => (inside(p, poly) ? 0 : poly.reduce((m, q, i) => Math.min(m, segDist(p, q, poly[(i + 1) % poly.length])), Infinity));

/** Partie d'un tracé à moins de `reach` (le long du tracé) de l'endroit où il quitte la zone vue. */
function stub(pts: Pt[], seen: (p: Pt) => boolean, reach: number, blocked: (p: Pt) => boolean = () => false): Pt[][] {
  const out: Pt[][] = [];
  // Densifie le tracé pour couper proprement.
  const dense: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const n = Math.max(1, Math.ceil(Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) / 0.004));
    for (let k = 0; k < n; k++) dense.push([pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * k) / n, pts[i][1] + ((pts[i + 1][1] - pts[i][1]) * k) / n]);
  }
  dense.push(pts[pts.length - 1]);
  // Distance (le long du tracé) au point vu le plus proche, dans les deux sens.
  const along = new Array<number>(dense.length).fill(Infinity);
  // Une autre caverne au bout du tunnel arrête le regard : on n'en voit pas l'intérieur.
  const wall = dense.map((p) => !seen(p) && blocked(p));
  for (let i = 0; i < dense.length; i++) if (seen(dense[i])) along[i] = 0;
  for (let i = 1; i < dense.length; i++) if (!wall[i]) along[i] = Math.min(along[i], along[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  for (let i = dense.length - 2; i >= 0; i--) if (!wall[i]) along[i] = Math.min(along[i], along[i + 1] + Math.hypot(dense[i][0] - dense[i + 1][0], dense[i][1] - dense[i + 1][1]));
  let cur: Pt[] = [];
  for (let i = 0; i < dense.length; i++) {
    if (along[i] <= reach) cur.push(dense[i]);
    else if (cur.length) { if (cur.length > 1) out.push(cur); cur = []; }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

const traces = (data: AtlasData, planId: string) => {
  const byId = new Map(data.features.map((f) => [f.id, f]));
  return data.geometries.filter((g) => g.mapId === planId && g.type === 'polyline' && byId.get(g.featureId)?.trace && byId.get(g.featureId)?.trace !== 'secret').map((g) => g.coordinates as Pt[]);
};

/**
 * Ce que voit le groupe depuis `at` : toute la caverne où il se tient (pas la voisine, derrière la paroi), et l'entrée
 * des tunnels qui en partent sur quelques pas ; dans un tunnel, le tunnel lui-même sur une courte distance.
 */
export function visionShapes(data: AtlasData, planId: string, at: Pt, reach = { tunnel: 0.022, inTunnel: 0.04 }): Shapes {
  const z = zoneOf(data, planId, at);
  const lines: Pt[][] = [];
  const cavs = (data.cavities[planId] ?? []).map((c) => cavityPoints(c, 1, 1, 0, 44));
  if (z.kind === 'cave') {
    const own = new Set(z.polys.map((p) => p.map((q) => q.join()).join()));
    const others = cavs.filter((p) => !own.has(p.map((q) => q.join()).join()));
    const seen = (p: Pt) => z.polys.some((poly) => polyDist(p, poly) <= 0.002);
    const blocked = (p: Pt) => others.some((poly) => inside(p, poly));
    for (const pts of traces(data, planId)) if (trailInZone(z, pts)) lines.push(...stub(pts, seen, reach.tunnel, blocked));
    return { polys: z.polys, lines };
  }
  const here = (p: Pt) => Math.hypot(p[0] - at[0], p[1] - at[1]) <= 0.006;
  const blocked = (p: Pt) => cavs.some((poly) => inside(p, poly));
  const lines0 = z.kind === 'tunnel' ? z.lines : [];
  for (const pts of lines0) lines.push(...stub(pts, here, reach.inTunnel, blocked));
  if (!lines.length) return { polys: [], lines: [[at, [at[0] + 0.0001, at[1]]]] };
  return { polys: [], lines };
}

/**
 * Mémoire du brouillard, sans traverser les parois : les cavernes où le groupe a vu quelque chose et les tracés
 * parcourus. Les points mémorisés ne dévoilent que l'intérieur de ces formes.
 */
export function memoryShapes(data: AtlasData, planId: string, explored: Pt[]): Shapes {
  const cavs = (data.cavities[planId] ?? []).map((c) => cavityPoints(c, 1, 1, 0, 44));
  const polys = cavs.filter((poly) => explored.some((p) => inside(p, poly)));
  const lines = traces(data, planId).filter((pts) => explored.some((p) => lineDist(p, pts) <= 0.006));
  return { polys, lines };
}
