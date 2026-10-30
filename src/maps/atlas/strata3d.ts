/**
 * Atlas en strates (copie de l'Atlas des profondeurs) : la profondeur en mètres, en trois dimensions.
 *
 * - L'Underdark compte des niveaux ; chaque niveau, des strates (et des entre-strates) ; chaque strate, des paliers.
 *   Deux grottes d'une même strate ne sont donc pas forcément à la même profondeur.
 * - Chaque grotte reçoit un palier (1 à 4), un sol et une voûte : déterministes (même carte, mêmes profondeurs), et
 *   groupés par secteurs (des grottes voisines partagent souvent leur palier).
 * - Un passage relie ses deux bouts en pente. Il débouche par le sol, par la paroi, par le plafond (il faut descendre),
 *   ou en balcon dans une salle qu'il traverse à mi-hauteur. Une salle qu'il croise au-dessus ou en dessous de sa
 *   voûte ou de son sol n'a pas d'ouverture : on ne peut pas s'y arrêter.
 *
 * Les profondeurs sont des créations automatiques, en attendant d'être corrigées à la main.
 */
import type { AtlasData, AtlasGeometry, Cavity } from './types';
import type { PartyPlace } from '../mapStore';
import { hoursOf, lengthOf, project, subpath, towardOf, type Leg } from '../journey';

type Pt = [number, number];

/** Épaisseur d'une strate (m), hauteur d'un palier (m), profondeur du haut de la première strate (m). */
const STRATUM = 60, PALIER = 12, TOP = -30;

/** Profondeur du haut d'un plan (m) : sa strate, ou l'entre-strate entre deux strates. */
export function planTop(data: AtlasData, planId: string): number {
  const map = data.maps.find((m) => m.id === planId);
  if (!map) return TOP;
  const level = Number(/niveau-(\d)/.exec(map.scope?.kind === 'strate' ? data.strata.find((s) => s.id === map.scope.id)?.levelId ?? '' : '')?.[1] ?? 1);
  const byOrder = (order: number) => TOP - (order - 1) * STRATUM - (level - 1) * STRATUM * 6;
  if (map.scope.kind === 'strate') return byOrder(data.strata.find((s) => s.id === map.scope.id)?.relativeDepthOrder ?? 1);
  const space = data.spaces.find((s) => s.id === map.scope.id);
  if (space) {
    if (space.depth != null) return byOrder(space.depth);
    const orders = (space.stratumIds ?? []).map((id) => data.strata.find((s) => s.id === id)?.relativeDepthOrder ?? 1);
    if (orders.length) return byOrder(orders.reduce((a, b) => a + b, 0) / orders.length + (space.kind === 'entre-strate' ? 0.5 : 0));
  }
  return TOP;
}

export interface CaveDepth { palier: number; floor: number; ceiling: number }

/** Palier, sol et voûte d'une grotte : groupés par secteur (bruit doux sur la position), plus un léger écart propre. */
export function caveDepth(c: Cavity, top: number): CaveDepth {
  const n = (Math.sin(c.cx * 9.1 + 1.3) + Math.sin(c.cy * 7.7 + 0.4) + Math.sin((c.cx + c.cy) * 4.3)) / 3; // −1…1
  const palier = Math.max(0, Math.min(3, Math.floor((n + 1) * 2)));
  const floor = top - 6 - palier * PALIER - (c.seed % 5);
  const ceiling = floor + 6 + ((c.seed >> 3) % 16);
  return { palier: palier + 1, floor, ceiling };
}

export const metres = (z: number) => `${z < 0 ? '−' : ''}${Math.abs(Math.round(z))} m`;

/** Grotte qui contient un point (la plus petite, si plusieurs se chevauchent). */
function caveAt(cavs: Cavity[], p: Pt): number {
  let best = -1, area = Infinity;
  cavs.forEach((c, i) => {
    if (((p[0] - c.cx) / c.rx) ** 2 + ((p[1] - c.cy) / c.ry) ** 2 <= 1) {
      const a = c.rx * c.ry;
      if (a < area) { area = a; best = i; }
    }
  });
  return best;
}

export type Opening = 'paroi' | 'sol' | 'plafond' | 'balcon';
export const OPENING_LABEL: Record<Opening, string> = { paroi: 'par la paroi', sol: 'ouverture au sol', plafond: 'ouverture au plafond', balcon: 'en balcon' };

/** Une salle sur le tracé : son abscisse, la profondeur du passage à cet endroit, et s'il y débouche. */
export interface Crossing { cave: number; s: number; z: number; open: boolean; opening?: Opening; drop?: number; rel?: 'au-dessus' | 'en dessous' }
export interface Passage3D {
  pts: Pt[]; L: number;
  /** Profondeur du passage à ses deux bouts, et comment il y débouche. */
  ends: [Crossing | null, Crossing | null];
  z0: number; z1: number;
  /** Salles traversées entre les deux bouts (ouvertes ou non). */
  crossings: Crossing[];
  zAt: (s: number) => number;
}

const cache = new WeakMap<AtlasGeometry, Passage3D>();

/** Le passage en 3D : pente d'un bout à l'autre, ouvertures, salles croisées. */
export function passage3d(data: AtlasData, planId: string, g: AtlasGeometry): Passage3D {
  const hit = cache.get(g);
  if (hit) return hit;
  const cavs = data.cavities[planId] ?? [];
  const top = planTop(data, planId);
  const pts = g.coordinates as Pt[];
  const L = lengthOf(pts);
  const iA = caveAt(cavs, pts[0]), iB = caveAt(cavs, pts[pts.length - 1]);
  const dA = iA >= 0 ? caveDepth(cavs[iA], top) : null, dB = iB >= 0 ? caveDepth(cavs[iB], top) : null;
  const fA = dA?.floor ?? dB?.floor ?? top - 20, fB = dB?.floor ?? dA?.floor ?? top - 20;
  // Bouts : à plat, on entre par la paroi ; en pente forte, on quitte la grotte haute par un trou dans le sol, et l'on
  // débouche dans la grotte basse par sa voûte (il faut descendre).
  let z0 = fA, z1 = fB, o0: Opening = 'paroi', o1: Opening = 'paroi', drop0 = 0, drop1 = 0;
  if (Math.abs(fA - fB) > 6) {
    const aHigh = fA > fB;
    const low = aHigh ? dB : dA;
    const lowFloor = aHigh ? fB : fA, highFloor = aHigh ? fA : fB;
    const steep = highFloor - lowFloor > PALIER && low;
    const lowEnd = steep ? low!.ceiling : lowFloor;
    if (aHigh) { o0 = 'sol'; o1 = steep ? 'plafond' : 'paroi'; z1 = lowEnd; drop1 = steep ? low!.ceiling - low!.floor : 0; }
    else { o1 = 'sol'; o0 = steep ? 'plafond' : 'paroi'; z0 = lowEnd; drop0 = steep ? low!.ceiling - low!.floor : 0; }
  }
  const zAt = (s: number) => z0 + (z1 - z0) * (L ? s / L : 0);
  const ends: [Crossing | null, Crossing | null] = [
    iA >= 0 ? { cave: iA, s: 0, z: z0, open: true, opening: o0, drop: drop0 || undefined } : null,
    iB >= 0 ? { cave: iB, s: L, z: z1, open: true, opening: o1, drop: drop1 || undefined } : null,
  ];
  // Salles croisées entre les deux bouts : échantillonnage le long du tracé, une entrée par traversée.
  const crossings: Crossing[] = [];
  const step = 0.003;
  let acc = 0, inside = -1, enter = 0;
  const flush = (exitS: number) => {
    if (inside < 0 || inside === iA || inside === iB) return;
    const s = (enter + exitS) / 2, z = zAt(s), d = caveDepth(cavs[inside], top);
    if (Math.abs(z - d.floor) <= 3) crossings.push({ cave: inside, s, z, open: true, opening: 'paroi' });
    else if (z > d.floor && z <= d.ceiling) crossings.push({ cave: inside, s, z, open: true, opening: 'balcon', drop: Math.round(z - d.floor) });
    else crossings.push({ cave: inside, s, z, open: false, rel: z > d.ceiling ? 'au-dessus' : 'en dessous' });
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    const n = Math.max(1, Math.ceil(seg / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, p: Pt = [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
      const s = acc + seg * t, c = caveAt(cavs, p);
      if (c !== inside) { flush(s); inside = c; enter = s; }
    }
    acc += seg;
  }
  flush(L);
  const out: Passage3D = { pts, L, ends, z0, z1, crossings, zAt };
  cache.set(g, out);
  return out;
}

/** La salle nommée d'une grotte (son étiquette de l'Atlas), sinon une place sur la grotte elle-même. */
export function cavePlace(data: AtlasData, planId: string, i: number, top = planTop(data, planId)): PartyPlace {
  const c = data.cavities[planId]?.[i];
  const byId = new Map(data.features.map((f) => [f.id, f]));
  let best: PartyPlace | null = null, bd = Infinity;
  for (const g of data.geometries) {
    if (g.mapId !== planId || g.type !== 'point' || !c) continue;
    const f = byId.get(g.featureId);
    if (!f?.area || f.trace) continue;
    const [x, y] = g.coordinates as Pt;
    const d = ((x - c.cx) / c.rx) ** 2 + ((y - c.cy) / c.ry) ** 2;
    if (d <= 1 && d < bd) { bd = d; best = { id: f.id, kind: 'feature', title: f.title, planId }; }
  }
  if (best) return best;
  const dp = c ? caveDepth(c, top) : null;
  return { id: `grotte:${planId}:${i}`, kind: 'spot', title: `Grotte, palier ${dp?.palier ?? '?'}`, planId, at: c ? [c.cx, c.cy] : [0.5, 0.5] };
}

/** Ce qu'une étape 3D ajoute à une étape ordinaire : profondeurs, ouverture d'arrivée, salles croisées sans arrêt. */
export interface Leg3D extends Leg {
  v3: { zFrom: number; zTo: number; opening: Opening; drop?: number; passed: { title: string; rel: 'au-dessus' | 'en dessous' }[]; palier?: number };
}

/**
 * Étapes d'un passage depuis le groupe, en 3D : on ne s'arrête qu'aux salles où le passage débouche (ses bouts, ou
 * une salle qu'il traverse à hauteur de sol ou en balcon). Les salles croisées sans ouverture sont seulement notées.
 */
export function legs3dOf(data: AtlasData, planId: string, g: AtlasGeometry, from: Pt, trace?: string, exclude?: string): Leg3D[] {
  const p3 = passage3d(data, planId, g);
  const top = planTop(data, planId);
  const cavs = data.cavities[planId] ?? [];
  const here = project(p3.pts, from);
  const hereCave = caveAt(cavs, from);
  const stops = [...(p3.ends[0] ? [p3.ends[0]] : []), ...p3.crossings.filter((c) => c.open), ...(p3.ends[1] ? [p3.ends[1]] : [])];
  const legs: Leg3D[] = [];
  for (const dir of ['a', 'b'] as const) {
    const ahead = (s: number) => (dir === 'b' ? s > here.s + 0.012 : s < here.s - 0.012);
    const endS = dir === 'b' ? p3.L : 0;
    if (Math.abs(endS - here.s) < 0.012) continue;
    const stop = stops.filter((c) => ahead(c.s) && c.cave !== hereCave).sort((x, y) => (dir === 'b' ? x.s - y.s : y.s - x.s))[0];
    const s1 = stop ? stop.s : endS;
    const route = subpath(p3.pts, here.s, s1);
    const to = stop ? cavePlace(data, planId, stop.cave, top) : null;
    if (to && to.id === exclude) continue;
    const points: Pt[] = [from, ...route];
    const lo = Math.min(here.s, s1), hi = Math.max(here.s, s1);
    const passed = p3.crossings.filter((c) => !c.open && c.s > lo && c.s < hi).map((c) => ({ title: cavePlace(data, planId, c.cave, top).title, rel: c.rel! }));
    const zFrom = p3.zAt(here.s), zTo = stop ? stop.z : p3.zAt(s1);
    // Une pente se paie : un quart d'heure de plus par tranche de 10 m de dénivelé.
    const hours = hoursOf(lengthOf(points), trace) + Math.abs(zTo - zFrom) / 40;
    const probe = subpath(p3.pts, here.s, dir === 'b' ? Math.min(p3.L, here.s + 0.05) : Math.max(0, here.s - 0.05));
    const far = probe[probe.length - 1];
    const arriveOpening: Opening = stop?.opening ?? 'paroi';
    legs.push({
      dir, to, points, hours, toward: towardOf(far[0] - from[0], far[1] - from[1]),
      v3: { zFrom, zTo, opening: arriveOpening, drop: stop?.drop, passed, palier: stop ? caveDepth(cavs[stop.cave], top).palier : undefined },
    });
  }
  return legs;
}

/** Une ligne pour le MJ : « ↘ 15 m · arrivée par le plafond (descente de 15 m) · passe sous la Caverne Humide ». */
export function legNote(l: Leg3D) {
  const dz = Math.round(l.v3.zTo - l.v3.zFrom);
  const slope = Math.abs(dz) < 3 ? 'à plat' : dz < 0 ? `↘ descend ${-dz} m` : `↗ monte ${dz} m`;
  const arrive = l.v3.opening === 'plafond' ? `arrivée au plafond (descente de ${l.v3.drop ?? '?'} m)`
    : l.v3.opening === 'balcon' ? `arrivée en balcon (${l.v3.drop ?? '?'} m au-dessus du sol)`
    : l.v3.opening === 'sol' ? 'arrivée par un trou du sol (il faut grimper)' : 'arrivée par la paroi';
  const passed = l.v3.passed.length ? ` · passe ${l.v3.passed.map((p) => `${p.rel === 'au-dessus' ? 'au-dessus de' : 'sous'} ${p.title}`).join(', ')} sans ouverture` : '';
  return `${slope} · ${arrive}${l.v3.palier ? ` · palier ${l.v3.palier}` : ''}${passed}`;
}

/** Épreuve à l'arrivée d'une étape : descendre d'un plafond ou d'un balcon, ou grimper par un trou du sol. */
export function arrivalHazard(l: Leg3D) {
  const h = l.v3.drop ?? 0;
  if ((l.v3.opening === 'plafond' || l.v3.opening === 'balcon') && h >= 3) {
    return {
      check: 'Force (Athlétisme)', ability: 'str' as const, save: false, dc: h >= 12 ? 15 : 12,
      fail: `Chute de ${h} m : ${Math.max(1, Math.floor(h / 3))}d6 dégâts contondants, à terre en arrivant.`,
      damage: `${Math.max(1, Math.floor(h / 3))}d6`,
      success: `Descente de ${h} m sans encombre (une corde aide : avantage).`,
    };
  }
  if (l.v3.opening === 'sol' && Math.round(l.v3.zTo - l.v3.zFrom) >= 6) {
    return { check: 'Force (Athlétisme)', ability: 'str' as const, save: false, dc: 12, fail: 'Glisse : il faut recommencer (1d4 dégâts contondants).', damage: '1d4', success: 'Le groupe se hisse par le trou du sol.' };
  }
  return null;
}
