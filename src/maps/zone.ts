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
