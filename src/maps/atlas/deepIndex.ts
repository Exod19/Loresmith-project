/**
 * Lieux sauvages de l'Underdark (lot 28) : raccord entre le tirage (deepWilds.js) et l'application. Les brouillons
 * d'un plan sont calculés pour le MJ seulement ; les lieux enregistrés vivent dans le calque de l'Atlas
 * (`overlay.wilds`) et rejoignent ses données (les joueurs ne voient que ceux qui sont révélés).
 */
import { deepSightOf, deepSitesOn, type DeepSite } from './deepWilds';
import { cavityPoints } from './model';
import { wildFeatureOf, type WildRecord } from '../world/generate';
import { lengthOf, project, subpath } from '../journey';
import type { AtlasData, AtlasFeature, AtlasGeometry } from './types';

/** Seuil de zoom des lieux sauvages de l'Underdark (un peu avant les lieux « locaux » de l'Atlas, pour que le MJ les repère). */
const DEEP_ZOOM = 5;
const base = { canonStatus: 'creation' as const, placementStatus: 'documented' as const };

/** Enregistrement d'un lieu tiré au sort (pour le garder, le définir, l'écarter ou le montrer). */
export const deepRecordOf = (s: DeepSite): WildRecord => ({
  key: s.key, planId: s.planId, at: s.at, kind: s.kind, cat: s.cat, title: s.title, teneur: s.teneur, danger: s.danger,
  text: s.text, scene: s.scene, hook: s.hook,
});

/** Lieu et géométrie d'un lieu sauvage de l'Underdark. */
function featureOf(w: WildRecord, draft: boolean): { f: AtlasFeature; g: AtlasGeometry } {
  const f = { ...base, ...wildFeatureOf(w, w.planId!), minZoom: DEEP_ZOOM, importance: draft ? 'detail' as const : 'local' as const, ...(draft ? { draft: true } : {}) } as AtlasFeature;
  return { f, g: { id: `g-${f.id}`, mapId: w.planId!, featureId: f.id, type: 'point', coordinates: w.at! } };
}

/** L'Atlas avec ses lieux sauvages enregistrés (sauf écartés). */
export function withDeepWilds(atlas: AtlasData, wilds: Record<string, WildRecord>): AtlasData {
  const list = Object.values(wilds).filter((w) => w && !w.excluded && w.planId && w.at);
  if (!list.length) return atlas;
  const out = list.map((w) => featureOf(w, false));
  return { ...atlas, features: [...atlas.features, ...out.map((x) => x.f)], geometries: [...atlas.geometries, ...out.map((x) => x.g)] };
}

const planCache = new Map<string, DeepSite[]>();
/** Tous les lieux tirés au sort d'un plan (gardés en mémoire : le plan ne change pas). */
type Density = 'rare' | 'normale' | 'riche';
function sitesOf(atlas: AtlasData, planId: string, density: Density = 'normale'): DeepSite[] {
  const ck = `${planId}|${density}`;
  let s = planCache.get(ck);
  if (!s) {
    const byId = new Map(atlas.features.map((f) => [f.id, f]));
    const onPlan = atlas.geometries.filter((g) => g.mapId === planId && !g.featureId.includes(':wild-') && !g.featureId.startsWith('mk-'));
    const trails = onPlan.filter((g) => g.type === 'polyline').map((g) => ({ id: g.featureId, trace: byId.get(g.featureId)?.trace, pts: g.coordinates as [number, number][] }));
    const caves = (atlas.cavities[planId] ?? []).map((c) => cavityPoints(c, 1, 1, 0, 32));
    const points = onPlan.filter((g) => g.type === 'point').map((g) => g.coordinates as [number, number]);
    s = deepSitesOn({ planId, trails, caves, points, density });
    planCache.set(ck, s);
    if (planCache.size > 8) planCache.delete(planCache.keys().next().value!);
  }
  return s;
}

/** Brouillons d'un plan de l'Atlas (MJ seulement), hors des lieux déjà enregistrés. */
export function deepDrafts(atlas: AtlasData, planId: string, wilds: Record<string, WildRecord> = {}, density?: Density) {
  const sites = sitesOf(atlas, planId, density).filter((s) => !wilds[s.key]);
  const out = sites.map((s) => featureOf(deepRecordOf(s), true));
  return { key: `deep:${planId}:${density ?? 'normale'}:${sites.length}`, sites, features: out.map((x) => x.f), geometries: out.map((x) => x.g) };
}

/** Un lieu aperçu depuis la galerie : où (le long du trajet, en unités de plan), de quel côté, et s'il faut le chercher. */
export type DeepSighting = { record: WildRecord; id: string; s: number; d: number; at: [number, number]; side: 'gauche' | 'droite'; known: boolean; dc?: number; line: string };

/** Lieux sauvages visibles le long d'un trajet d'un plan de l'Atlas (`pts` en 0–1), dans l'ordre de la marche. */
export function deepAlong(atlas: AtlasData, planId: string, pts: [number, number][], wilds: Record<string, WildRecord> = {}, revealed: string[] = [], density?: Density): DeepSighting[] {
  if (pts.length < 2) return [];
  const drafts = sitesOf(atlas, planId, density).filter((s) => !wilds[s.key]).map(deepRecordOf);
  const kept = Object.values(wilds).filter((w) => w && !w.excluded && w.planId === planId && w.at);
  const total = lengthOf(pts);
  const out: DeepSighting[] = [];
  for (const r of [...drafts, ...kept]) {
    const pr = project(pts, r.at!);
    const sight = deepSightOf(r);
    if (pr.d > sight.reach) continue;
    const ahead = subpath(pts, pr.s, Math.min(total, pr.s + 0.004));
    const a = ahead[0], b = ahead[ahead.length - 1];
    const cross = (b[0] - a[0]) * (r.at![1] - pr.at[1]) - (b[1] - a[1]) * (r.at![0] - pr.at[0]);
    const id = `${planId}:wild-${r.key}`;
    out.push({ record: r, id, s: pr.s, d: pr.d, at: r.at!, side: cross > 0 ? 'droite' : 'gauche', known: revealed.includes(id), dc: sight.dc, line: sight.line });
  }
  return out.sort((x, y) => x.s - y.s);
}
