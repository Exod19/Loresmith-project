/** Accès, catégories, routage, sens de circulation et validation des données de l'Atlas. */
import type {
  AtlasAnchor, AtlasConnection, AtlasData, AtlasLevel, AtlasMap, AtlasSpace, AtlasStratum, Cavity, ConnectionKind, FeatureCategory, PlacementStatus,
} from './types';

export const CATEGORIES: Record<FeatureCategory, { label: string; color: string; glyph: string }> = {
  cite: { label: 'Cité / site', color: '#c5ab7f', glyph: '⌂' },
  sanctuaire: { label: 'Sanctuaire', color: '#b6ad9b', glyph: '◈' },
  grotte: { label: 'Grotte / cavité', color: '#8fb6b3', glyph: '⌕' },
  voie: { label: 'Galerie / passage', color: '#bd9a74', glyph: '⋯' },
  eau: { label: 'Eaux souterraines', color: '#85b0aa', glyph: '≋' },
  danger: { label: 'Zone à risque', color: '#b57b64', glyph: '!' },
  ressource: { label: 'Ressource', color: '#c9a86a', glyph: '◇' },
  vivant: { label: 'Habitat / vivant', color: '#8fae84', glyph: '✿' },
  evenement: { label: 'Événement historique', color: '#b9939f', glyph: '◷' },
  institution: { label: 'Institution', color: '#d8cdb8', glyph: '▤' },
  ruine: { label: 'Ruine / structure', color: '#9b948a', glyph: '⌗' },
  garde: { label: 'Poste / cache', color: '#9db1ad', glyph: '⌑' },
  indetermine: { label: 'Point indéterminé', color: '#7e898a', glyph: '?' },
};

export const CONNECTION_LABEL: Record<ConnectionKind, string> = {
  tunnel: 'Tunnel', galerie: 'Galerie', escalier: 'Escalier', puits: 'Puits', ascenseur: 'Treuil / ascenseur',
  pont: 'Pont', portail: 'Portail', naturel: 'Passage naturel', inconnu: 'Passage inconnu',
};

export const PLACEMENT_LABEL: Record<PlacementStatus, string> = {
  documented: 'Position documentée', approximate: 'Position approximative', illustrative: 'Position illustrative', unknown: 'Position non documentée',
};

/** Paliers de densité (cahier §6), locaux à chaque carte. */
export const DENSITY = [{ min: 0, label: 'Repères' }, { min: 1.3, label: 'Régional' }, { min: 2.6, label: 'Local' }, { min: 4.2, label: 'Détail' }];
export const densityOf = (zoom: number) => [...DENSITY].reverse().find((d) => zoom >= d.min)!;

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
/** Jeu de données actif (Atlas intégré ou carte personnalisée). Les index suivent via `setAtlasData`. */
/** Vide tant que le fichier des Archives n'est pas chargé (voir feeds/underdark.ts, setAtlasData). */
const EMPTY: AtlasData = { version: '', levels: [], strata: [], spaces: [], maps: [], cavities: {}, features: [], geometries: [], anchors: [], connections: [] };
export let ATLAS: AtlasData = EMPTY;
export let levels = byId(EMPTY.levels);
export let strata = byId(EMPTY.strata);
export let spaces = byId(EMPTY.spaces);
export let maps = byId(EMPTY.maps);
export let features = byId(EMPTY.features);
export let anchors = byId(EMPTY.anchors);
/** Bascule vers un autre jeu de données, avant le rendu d'une carte. */
export function setAtlasData(d: AtlasData) {
  ATLAS = d; levels = byId(d.levels); strata = byId(d.strata); spaces = byId(d.spaces);
  maps = byId(d.maps); features = byId(d.features); anchors = byId(d.anchors);
}

export const cavitiesOf = (mapId: string): Cavity[] => ATLAS.cavities[mapId] ?? [];
export const geometriesOn = (mapId: string) => ATLAS.geometries.filter((g) => g.mapId === mapId);
export const anchorsOn = (mapId: string) => ATLAS.anchors.filter((a) => a.mapId === mapId);
export const placementsOf = (featureId: string) => ATLAS.geometries.filter((g) => g.featureId === featureId);
export const strataOf = (levelId: string) => ATLAS.strata.filter((s) => s.levelId === levelId).sort((a, b) => a.relativeDepthOrder - b.relativeDepthOrder);
export const floorsOf = (siteId: string) => ATLAS.spaces.filter((s) => s.kind === 'palier' && s.siteId === siteId).sort((a, b) => (a.floorOrder ?? 0) - (b.floorOrder ?? 0));
export const sitesIn = (stratumId: string) => ATLAS.spaces.filter((s) => s.kind === 'site' && s.stratumIds.includes(stratumId));
/** Profondeur relative d'un espace de transit (3.5 = entre I-3 et I-4). */
export const depthOf = (s: AtlasSpace) => s.depth ?? (s.stratumIds.reduce((a, id) => a + (strata.get(id)?.relativeDepthOrder ?? 0), 0) / Math.max(1, s.stratumIds.length));
export const betweenSpaces = (levelId: string) => ATLAS.spaces.filter((s) => s.kind === 'entre-strate' && s.levelId === levelId).sort((a, b) => depthOf(a) - depthOf(b));
/** Libellé court d'imbrication : entre-strate, entre-entre, entre³… */
export const nestingLabel = (s: AtlasSpace) => ((s.nesting ?? 1) <= 1 ? 'entre-strate' : (s.nesting ?? 1) === 2 ? 'entre-entre' : `entre${'⁰¹²³⁴⁵'[s.nesting ?? 3]}`);

/**
 * Connexion d'une ancre et extrémité opposée.
 * `canFollow` respecte le sens de circulation : un passage `forward` ne se suit pas depuis son arrivée.
 */
export function connectionAt(anchorId: string): { connection: AtlasConnection; other: AtlasAnchor; canFollow: boolean; isStart: boolean } | null {
  const c = ATLAS.connections.find((x) => x.fromAnchorId === anchorId || x.toAnchorId === anchorId);
  if (!c) return null;
  const isStart = c.fromAnchorId === anchorId;
  return { connection: c, other: anchors.get(isStart ? c.toAnchorId : c.fromAnchorId)!, canFollow: c.direction === 'both' || isStart, isStart };
}

/** Lieu (niveau, strate ou espace) d'une carte, pour libellés et fil d'Ariane. */
export type AtlasContext = { level?: AtlasLevel; stratum?: AtlasStratum; site?: AtlasSpace; floor?: AtlasSpace; between?: AtlasSpace };
export function contextOf(map: AtlasMap): AtlasContext {
  const sc = map.scope;
  if (sc.kind === 'niveau') return { level: levels.get(sc.id) };
  if (sc.kind === 'strate') { const s = strata.get(sc.id); return { level: s && levels.get(s.levelId), stratum: s }; }
  if (sc.kind === 'espace') { const b = spaces.get(sc.id); return { level: b && levels.get(b.levelId), between: b, stratum: b && strata.get(b.stratumIds[0]) }; }
  const site = spaces.get(sc.id);
  return { level: site && levels.get(site.levelId), stratum: site && strata.get(site.stratumIds[0]), site, floor: sc.floorId ? spaces.get(sc.floorId) : undefined };
}

/** Libellé court d'une carte (« Strate I-4 », « Entre-strate I-3 / I-4 », « Site d’essai · Palier 2 »). */
export function placeName(map: AtlasMap) {
  const c = contextOf(map);
  if (c.floor && c.site) return `${c.site.name} · ${c.floor.name}`;
  return c.between?.name ?? c.stratum?.title ?? c.level?.title ?? map.title;
}

/** URL d'une carte ; `arrivee` recentre sur une ancre, `point` sur un lieu. */
export function mapRoute(map: AtlasMap, opts: { arrivee?: string; point?: string } = {}) {
  const q = new URLSearchParams();
  if (map.scope.floorId) q.set('palier', map.scope.floorId);
  if (opts.arrivee) q.set('arrivee', opts.arrivee);
  if (opts.point) q.set('point', opts.point);
  const qs = q.toString() ? `?${q}` : '';
  const base = { niveau: '/atlas/niveau/', strate: '/atlas/strate/', espace: '/atlas/espace/', site: '/atlas/site/' }[map.scope.kind];
  return `${base}${map.scope.id}${qs}`;
}

export const openRoute = (o: { kind: 'strate' | 'site'; id: string }) => (o.kind === 'strate' ? `/atlas/strate/${o.id}` : `/atlas/site/${o.id}`);

/** Vue d'ambiance de chaque grand niveau (illustrations fournies ; ambiance, pas topographie). */
export const levelImage = (levelId?: string, w: 860 | 1600 = 1600) => (levelId && /^niveau-[123]$/.test(levelId) ? `images/archives/atlas/${levelId}-${w}.webp` : undefined);

/** Validation au chargement (cahier §11.3). Renvoie la liste des anomalies. */
export function validate(d: AtlasData = ATLAS): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  for (const x of [...d.levels, ...d.strata, ...d.spaces, ...d.maps, ...d.features, ...d.geometries, ...d.anchors, ...d.connections]) {
    if (ids.has(x.id)) errs.push(`Identifiant en double : ${x.id}`);
    ids.add(x.id);
  }
  const L = byId(d.levels), S = byId(d.strata), SP = byId(d.spaces), M = byId(d.maps), F = byId(d.features), A = byId(d.anchors);
  if (d.levels.length !== 3) errs.push('L’atlas doit compter trois grands niveaux.');
  for (const lv of d.levels) for (const sid of lv.strataIds) if (S.get(sid)?.levelId !== lv.id) errs.push(`Niveau ${lv.id} : strate ${sid} incohérente.`);
  for (const s of d.strata) {
    if (!L.has(s.levelId)) errs.push(`Strate ${s.id} : niveau inconnu.`);
    if (s.mapId && !M.has(s.mapId)) errs.push(`Strate ${s.id} : carte ${s.mapId} inconnue.`);
  }
  for (const s of d.spaces) {
    if (s.levelId && !L.has(s.levelId)) errs.push(`Espace ${s.id} : niveau inconnu.`);
    for (const st of s.stratumIds) if (!S.has(st)) errs.push(`Espace ${s.id} : strate ${st} inconnue.`);
    if (s.mapId && !M.has(s.mapId)) errs.push(`Espace ${s.id} : carte inconnue.`);
    if (s.siteId && SP.get(s.siteId)?.kind !== 'site') errs.push(`Palier ${s.id} : site inconnu.`);
    if (s.entryFloorId && SP.get(s.entryFloorId)?.siteId !== s.id) errs.push(`Site ${s.id} : palier d’accueil incohérent.`);
  }
  for (const m of d.maps) {
    if (!m.width || !m.height) errs.push(`Carte ${m.id} : dimensions nulles.`);
    const target = m.scope.kind === 'niveau' ? L.get(m.scope.id) : m.scope.kind === 'strate' ? S.get(m.scope.id) : SP.get(m.scope.id);
    if (!target) errs.push(`Carte ${m.id} : portée inconnue.`);
    if (m.scope.floorId && !SP.has(m.scope.floorId)) errs.push(`Carte ${m.id} : palier inconnu.`);
  }
  const inBounds = (p: [number, number]) => p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1;
  for (const g of d.geometries) {
    if (!M.has(g.mapId)) errs.push(`Géométrie ${g.id} : carte inconnue.`);
    if (!F.has(g.featureId)) errs.push(`Géométrie ${g.id} : point inconnu.`);
    const pts = (g.type === 'point' ? [g.coordinates] : g.coordinates) as [number, number][];
    if (!pts.every(inBounds)) errs.push(`Géométrie ${g.id} : hors des bornes de la carte.`);
  }
  for (const a of d.anchors) {
    if (!M.has(a.mapId)) errs.push(`Ancre ${a.id} : carte inconnue.`);
    if (!inBounds(a.at)) errs.push(`Ancre ${a.id} : hors des bornes.`);
  }
  for (const c of d.connections) {
    if (!A.has(c.fromAnchorId) || !A.has(c.toAnchorId)) errs.push(`Connexion ${c.id} : extrémité manquante.`);
    if (c.direction !== 'both' && c.direction !== 'forward') errs.push(`Connexion ${c.id} : sens « ${c.direction} » inconnu.`);
    if (c.fromAnchorId === c.toAnchorId) errs.push(`Connexion ${c.id} : boucle sur une seule ancre.`);
  }
  for (const id of Object.keys(d.cavities)) if (!M.has(id)) errs.push(`Cavités : carte ${id} inconnue.`);
  return errs;
}

/** Sommets du contour d'une cavité (même tirage que le dessin) : sert aussi à savoir ce qui est dedans. */
export function cavityPoints(c: Cavity, W: number, H: number, grow = 0, n = 44): [number, number][] {
  let z = (c.seed * 2654435761) >>> 0;
  const r = () => ((z = (1664525 * z + 1013904223) >>> 0) / 4294967296);
  const harm = [2, 3, 5, 7].map((f, i) => ({ f, a: [0.13, 0.09, 0.05, 0.03][i] * (0.6 + r() * 0.8), p: r() * Math.PI * 2 }));
  const P: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    let k = 1 + (r() - 0.5) * 0.07;
    for (const h of harm) k += h.a * Math.sin(h.f * a + h.p);
    P.push([c.cx * W + Math.cos(a) * (c.rx * W * k + grow), c.cy * H + Math.sin(a) * (c.ry * H * k + grow)]);
  }
  return P;
}

/**
 * Contour organique stable d'une cavité (graine déterministe), en unités de plan :
 * quelques lobes de basse fréquence, un relief plus fin, puis lissage par courbes.
 */
export function cavityPath(c: Cavity, W: number, H: number, grow = 0, n = 44) {
  const P = cavityPoints(c, W, H, grow, n);
  const f = (v: number) => v.toFixed(1);
  const m = (i: number) => { const a = P[i % n], b = P[(i + 1) % n]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  let d = `M${f(m(0)[0])} ${f(m(0)[1])}`;
  for (let i = 1; i <= n; i++) { const q = P[i % n], e = m(i); d += `Q${f(q[0])} ${f(q[1])} ${f(e[0])} ${f(e[1])}`; }
  return d + 'Z';
}

/** Tracé adouci (courbes passant par les milieux) d'une galerie. */
export function smoothPath(pts: [number, number][], W: number, H: number) {
  const P = pts.map(([x, y]) => [x * W, y * H]);
  if (P.length < 3) return `M${P.map((p) => p.join(' ')).join('L')}`;
  let d = `M${P[0][0]} ${P[0][1]}`;
  for (let i = 1; i < P.length - 1; i++) {
    const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2;
    d += ` Q${P[i][0]} ${P[i][1]} ${mx} ${my}`;
  }
  const last = P[P.length - 1];
  return `${d} L${last[0]} ${last[1]}`;
}
