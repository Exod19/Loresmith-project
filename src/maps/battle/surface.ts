/**
 * Terrain des cartes de combat, en couches : l'apparence (textures, contours naturels) d'un côté, les règles de l'autre.
 *
 * - Fond : la grille de base (terrain généré du lieu, ou un sol uni choisi par le MJ), une texture par case.
 * - Zones : rivières, chemins, boue, lave… dessinées en courbes (contour fermé, ou tracé avec une largeur).
 * - Éléments : rochers, arbres, ponts… avec une empreinte de collision distincte de leur image.
 * - Murs : sur les arêtes de la grille, entre deux cases.
 *
 * Les règles viennent de ces données, jamais des images : chaque case reçoit un terrain principal unique, celui présent
 * au centre de la case. Si plusieurs zones s'y superposent, la plus prioritaire l'emporte (égalité : identifiant le plus
 * petit). Une correction du MJ prime sur tout. La géométrie qui dessine une zone est celle qui sert au calcul des cases.
 */

/* ——— Types de terrain : apparence et règles ——— */

/** Mode de déplacement qu'impose un terrain. `vide` : rien pour marcher (gouffre) ; `bloque` : rien ne passe. */
export type Mode = 'marche' | 'nage' | 'escalade' | 'vide' | 'bloque';

export type TerrainId =
  | 'sol' | 'roche' | 'pilier' | 'eboulis' | 'eau_peu_profonde' | 'eau_profonde' | 'gouffre' | 'pont' | 'gue'
  | 'herbe' | 'herbes_hautes' | 'mousse' | 'sous_bois' | 'sol_tropical' | 'terre' | 'chemin' | 'route' | 'dalles' | 'plancher'
  | 'boue' | 'tourbiere' | 'sable' | 'neige' | 'glace' | 'terre_craquelee' | 'toundra' | 'granite' | 'roche_veinee'
  | 'eboulis_granite' | 'ronces' | 'cendre' | 'lave' | 'escarpement' | 'paroi';

export interface TerrainDef {
  id: TerrainId;
  label: string;
  /** Texture (chemin sous public/images/combat-map) et couleur de base. */
  tex: string;
  color: string;
  mode: Mode;
  difficult?: boolean;
  /** Glissant : jet de sauvegarde de Dextérité (DD 10) pour qui se presse, selon le MJ. */
  slippery?: boolean;
  /** Danger à l'entrée (texte de règle pour le MJ). Le tracé l'évite quand c'est possible. */
  danger?: string;
  /** Priorité par défaut d'une zone de ce terrain (une zone peut la changer). */
  priority: number;
  /** Groupe affiché dans les palettes. */
  group: 'Caverne' | 'Végétation' | 'Sols' | 'Eau et glace' | 'Roche' | 'Feu';
}

const T = (id: TerrainId, label: string, tex: string, color: string, mode: Mode, priority: number, group: TerrainDef['group'], extra: Partial<TerrainDef> = {}): TerrainDef =>
  ({ id, label, tex, color, mode, priority, group, ...extra });

/** Ordre stable : il départage aussi les égalités (socle d'une grande créature). */
export const TERRAINS: TerrainDef[] = [
  T('sol', 'Sol de caverne', 'textures/sol.webp', '#2b241b', 'marche', 10, 'Caverne'),
  T('roche', 'Roche massive', 'textures/roche.webp', '#4a3c2a', 'bloque', 80, 'Caverne'),
  T('pilier', 'Stalagmite ou pilier', 'textures/roche.webp', '#4a3c2a', 'bloque', 80, 'Caverne'),
  T('eboulis', 'Éboulis', 'textures/eboulis.webp', '#3e3429', 'marche', 30, 'Caverne', { difficult: true }),
  T('gouffre', 'Gouffre', 'textures/gouffre.webp', '#030303', 'vide', 70, 'Caverne'),
  T('roche_veinee', 'Roche veinée', 'terrains/roche_violette.webp', '#3a2c40', 'marche', 15, 'Caverne'),
  T('herbe', 'Herbe', 'terrains/herbe.webp', '#4f6b2a', 'marche', 10, 'Végétation'),
  T('herbes_hautes', 'Herbes folles', 'terrains/herbes_folles.webp', '#7a7340', 'marche', 12, 'Végétation'),
  T('mousse', 'Mousse fleurie', 'terrains/mousse.webp', '#3e5a2c', 'marche', 12, 'Végétation'),
  T('sous_bois', 'Sous-bois', 'terrains/sous_bois.webp', '#4a3626', 'marche', 12, 'Végétation'),
  T('sol_tropical', 'Sol de jungle', 'terrains/sol_tropical.webp', '#5a3a26', 'marche', 12, 'Végétation'),
  T('ronces', 'Ronces', 'terrains/ronces.webp', '#3d3a26', 'marche', 31, 'Végétation', { difficult: true }),
  T('terre', 'Terre', 'terrains/terre.webp', '#6a4a30', 'marche', 10, 'Sols'),
  T('chemin', 'Chemin de terre', 'terrains/terre.webp', '#6a4a30', 'marche', 35, 'Sols'),
  T('route', 'Route pavée', 'terrains/paves.webp', '#6b675e', 'marche', 36, 'Sols'),
  T('dalles', 'Dalles', 'terrains/dalles.webp', '#77736a', 'marche', 20, 'Sols'),
  T('plancher', 'Plancher', 'terrains/planches.webp', '#5c4128', 'marche', 20, 'Sols'),
  T('sable', 'Sable', 'terrains/sable.webp', '#c99a52', 'marche', 15, 'Sols'),
  T('terre_craquelee', 'Terre craquelée', 'terrains/terre_craquelee.webp', '#b56a42', 'marche', 14, 'Sols'),
  T('toundra', 'Toundra', 'terrains/toundra.webp', '#5d6158', 'marche', 14, 'Sols'),
  T('boue', 'Boue', 'terrains/boue.webp', '#5a3a22', 'marche', 32, 'Sols', { difficult: true }),
  T('tourbiere', 'Tourbière', 'terrains/tourbiere.webp', '#3c3f2a', 'marche', 33, 'Sols', { difficult: true }),
  T('eau_peu_profonde', 'Eau peu profonde', 'terrains/eau_claire.webp', '#3f8a86', 'marche', 40, 'Eau et glace', { difficult: true }),
  T('eau_profonde', 'Eau profonde', 'terrains/eau_sombre.webp', '#123c45', 'nage', 50, 'Eau et glace'),
  T('gue', 'Gué', 'terrains/eau_claire.webp', '#5e9a8e', 'marche', 60, 'Eau et glace', { difficult: true }),
  T('neige', 'Neige', 'terrains/neige.webp', '#e8ecef', 'marche', 25, 'Eau et glace', { difficult: true }),
  T('glace', 'Glace', 'terrains/glace.webp', '#a9c6d6', 'marche', 26, 'Eau et glace', { difficult: true, slippery: true }),
  T('granite', 'Sol rocheux', 'terrains/granite.webp', '#77736d', 'marche', 15, 'Roche'),
  T('eboulis_granite', 'Éboulis de granite', 'terrains/eboulis_granite.webp', '#6c6a66', 'marche', 30, 'Roche', { difficult: true }),
  T('escarpement', 'Escarpement', 'terrains/escarpement.webp', '#8b877e', 'escalade', 45, 'Roche'),
  T('paroi', 'Paroi rocheuse', 'terrains/flanc_granite.webp', '#6d6a63', 'escalade', 46, 'Roche'),
  T('cendre', 'Cendres', 'terrains/cendre.webp', '#3a3533', 'marche', 16, 'Feu'),
  T('lave', 'Lave', 'terrains/lave.webp', '#3a1a10', 'marche', 65, 'Feu', { danger: 'Lave : 10d10 dégâts de feu en y entrant, puis à chaque tour passé dedans (MJ).' }),
  T('pont', 'Pont', 'terrains/planches.webp', '#6b4c2a', 'marche', 90, 'Sols'),
];
export const TERRAIN_DEF = Object.fromEntries(TERRAINS.map((t) => [t.id, t])) as Record<TerrainId, TerrainDef>;
export const TERRAIN_RANK = Object.fromEntries(TERRAINS.map((t, i) => [t.id, i])) as Record<TerrainId, number>;
export const texUrl = (tex: string) => `${import.meta.env?.BASE_URL ?? '/'}images/combat-map/${tex}`;

/** Grille de base (terrain généré, un caractère par case) → terrain. `.` et `,` prennent le sol choisi par le MJ. */
const LEGACY: Record<string, TerrainId> = { '#': 'roche', I: 'pilier', '~': 'eau_peu_profonde', ':': 'eboulis', '=': 'pont', X: 'gouffre' };

/* ——— Zones : courbes et tracés ——— */

export type Pt = [number, number];

export interface TerrainZone {
  id: string;
  terrain: TerrainId;
  /** `area` : contour fermé (lac, mare de boue) ; `line` : tracé avec une largeur (rivière, chemin). */
  shape: 'area' | 'line';
  /** Points de contrôle, en cases (0 à cols, 0 à rows) : la courbe passe par eux. */
  points: Pt[];
  /** Largeur d'un tracé, en cases. */
  width?: number;
  /** Priorité en cas de superposition (défaut : celle du terrain). */
  priority?: number;
  /** Élévation en pieds (plateau, fosse). Plus de 5 pieds d'écart entre deux cases : il faut escalader. */
  elevation?: number;
  label?: string;
}

/** Courbe de Catmull-Rom passant par les points, découpée en segments : la même pour le dessin et pour les règles. */
function smooth(points: Pt[], closed: boolean, steps = 8): Pt[] {
  const n = points.length;
  if (n < 3) return points.slice();
  const at = (i: number) => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
  const out: Pt[] = [];
  const spans = closed ? n : n - 1;
  for (let i = 0; i < spans; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  if (!closed) out.push(points[n - 1]);
  return out;
}

const outlineCache = new WeakMap<TerrainZone, Pt[]>();
/** Contour d'une zone (polygone fermé) ou axe d'un tracé, lissé. */
export function outlineOf(z: TerrainZone): Pt[] {
  let o = outlineCache.get(z);
  if (!o) { o = smooth(z.points, z.shape === 'area'); outlineCache.set(z, o); }
  return o;
}
export const zoneWidth = (z: TerrainZone) => Math.max(0.3, z.width ?? 2);

function inPolygon(poly: Pt[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function distToPolyline(line: Pt[], x: number, y: number) {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = line[i], [bx, by] = line[i + 1];
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1e-9;
    const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
    best = Math.min(best, Math.hypot(ax + k * dx - x, ay + k * dy - y));
  }
  return best;
}
/** Un point (en cases) est-il dans la zone ? */
export function zoneHas(z: TerrainZone, x: number, y: number) {
  const o = outlineOf(z);
  return z.shape === 'area' ? o.length >= 3 && inPolygon(o, x, y) : distToPolyline(o, x, y) <= zoneWidth(z) / 2;
}

/** Points d'échantillonnage d'une case (centre en premier) : servent à repérer les bordures trompeuses. */
const SAMPLES: Pt[] = [[0.5, 0.5], [0.17, 0.17], [0.5, 0.17], [0.83, 0.17], [0.17, 0.5], [0.83, 0.5], [0.17, 0.83], [0.5, 0.83], [0.83, 0.83]];

/** Cases touchées par une zone : bit 0 = centre, bits 1-8 = autres échantillons. Mis en cache par zone (immuable). */
const rasterCache = new WeakMap<TerrainZone, { cols: number; rows: number; bits: Uint16Array }>();
function rasterOf(z: TerrainZone, cols: number, rows: number) {
  const hit = rasterCache.get(z);
  if (hit && hit.cols === cols && hit.rows === rows) return hit.bits;
  const bits = new Uint16Array(cols * rows);
  const o = outlineOf(z);
  if (o.length) {
    const pad = z.shape === 'line' ? zoneWidth(z) / 2 + 1 : 1;
    const x0 = Math.max(0, Math.floor(Math.min(...o.map((p) => p[0])) - pad)), x1 = Math.min(cols - 1, Math.ceil(Math.max(...o.map((p) => p[0])) + pad));
    const y0 = Math.max(0, Math.floor(Math.min(...o.map((p) => p[1])) - pad)), y1 = Math.min(rows - 1, Math.ceil(Math.max(...o.map((p) => p[1])) + pad));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let m = 0;
      SAMPLES.forEach(([sx, sy], k) => { if (zoneHas(z, x + sx, y + sy)) m |= 1 << k; });
      bits[y * cols + x] = m;
    }
  }
  rasterCache.set(z, { cols, rows, bits });
  return bits;
}

/* ——— Éléments : décor, obstacles, ponts ——— */

/** `decor` : sans effet ; `partiel` : terrain difficile et couvert ; `bloquant` : on ne peut pas y entrer. */
export type Collision = 'decor' | 'partiel' | 'bloquant';
export type ObjectKind = 'rocher' | 'gros_rocher' | 'pierres' | 'arbre' | 'buisson' | 'souche' | 'tonneau' | 'caisses' | 'fleurs' | 'pont' | 'passerelle';

export interface ObjectDef {
  kind: ObjectKind;
  label: string;
  collision: Collision;
  /** Couvert offert à qui s'abrite derrière (règles 5e). */
  cover: 'aucun' | 'demi' | 'trois-quarts' | 'total';
  /** Bloque la ligne de vue (brouillard). */
  opaque?: boolean;
  /** Empreinte de collision : cercle (rayon en cases) ou rectangle (longueur × largeur, orienté). */
  radius?: number;
  /** Tablier praticable au-dessus du terrain (pont) : une surface à part, distincte de l'eau en dessous. */
  deck?: boolean;
  /** Taille par défaut d'un pont (cases). */
  len?: number; wid?: number;
  text: string;
}
export const OBJECTS: ObjectDef[] = [
  { kind: 'rocher', label: 'Rocher', collision: 'bloquant', cover: 'trois-quarts', opaque: true, radius: 0.42, text: 'Bloque sa case (empreinte au centre) ; couvert aux trois quarts.' },
  { kind: 'gros_rocher', label: 'Gros rocher', collision: 'bloquant', cover: 'total', opaque: true, radius: 0.95, text: 'Bloque environ 2 × 2 cases ; couvert total derrière.' },
  { kind: 'pierres', label: 'Pierres éparses', collision: 'partiel', cover: 'aucun', radius: 0.45, text: 'Terrain difficile sur sa case.' },
  { kind: 'arbre', label: 'Arbre', collision: 'bloquant', cover: 'demi', opaque: true, radius: 0.32, text: 'Le tronc bloque sa case ; le feuillage est du décor.' },
  { kind: 'buisson', label: 'Buisson', collision: 'partiel', cover: 'demi', radius: 0.45, text: 'Terrain difficile ; demi-couvert.' },
  { kind: 'souche', label: 'Souche', collision: 'partiel', cover: 'demi', radius: 0.3, text: 'Terrain difficile ; demi-couvert.' },
  { kind: 'tonneau', label: 'Tonneau', collision: 'partiel', cover: 'demi', radius: 0.3, text: 'Terrain difficile ; demi-couvert.' },
  { kind: 'caisses', label: 'Caisses empilées', collision: 'bloquant', cover: 'trois-quarts', opaque: true, radius: 0.45, text: 'Bloque sa case ; couvert aux trois quarts.' },
  { kind: 'fleurs', label: 'Fleurs, touffes', collision: 'decor', cover: 'aucun', radius: 0.35, text: 'Décor : aucun effet sur le déplacement.' },
  { kind: 'pont', label: 'Pont', collision: 'decor', cover: 'aucun', deck: true, len: 4, wid: 2, text: 'Tablier praticable au-dessus de l’eau ou du vide. On y monte par ses extrémités.' },
  { kind: 'passerelle', label: 'Passerelle', collision: 'decor', cover: 'aucun', deck: true, len: 4, wid: 1, text: 'Passerelle étroite (une case de large), praticable.' },
];
export const OBJECT_DEF = Object.fromEntries(OBJECTS.map((o) => [o.kind, o])) as Record<ObjectKind, ObjectDef>;

export interface BattleObject {
  id: string;
  kind: ObjectKind;
  /** Centre, en cases (continu : un objet n'est pas forcé sur la grille). */
  x: number; y: number;
  /** Orientation (degrés) et dimensions d'un pont (cases). */
  rot?: number; len?: number; wid?: number;
  /** Caché aux joueurs. */
  hidden?: boolean;
}

/**
 * Pont droit (0°, 90°…) : son tablier est calé sur la grille, pour qu'aucune case ne soit à moitié dessus.
 * Une largeur paire centre le pont sur une ligne de la grille, une largeur impaire sur un centre de case.
 */
export function alignDeck(o: BattleObject): BattleObject {
  const d = OBJECT_DEF[o.kind];
  if (!d?.deck) return o;
  const rot = (((o.rot ?? 0) % 180) + 180) % 180;
  if (rot % 90) return o;
  const len = o.len ?? d.len ?? 4, wid = o.wid ?? d.wid ?? 1;
  const snap = (v: number, n: number) => (n % 2 ? Math.floor(v) + 0.5 : Math.round(v));
  const [along, across] = rot === 0 ? [o.x, o.y] : [o.y, o.x];
  const a = snap(along, len), c = snap(across, wid);
  return rot === 0 ? { ...o, x: a, y: c } : { ...o, x: c, y: a };
}

/** Le point (en cases) est-il dans l'empreinte de l'objet ? */
export function objectHas(o: BattleObject, px: number, py: number) {
  const d = OBJECT_DEF[o.kind];
  if (!d) return false;
  if (d.deck) {
    const a = ((o.rot ?? 0) * Math.PI) / 180, dx = px - o.x, dy = py - o.y;
    const u = dx * Math.cos(a) + dy * Math.sin(a), v = -dx * Math.sin(a) + dy * Math.cos(a);
    return Math.abs(u) <= (o.len ?? d.len ?? 4) / 2 && Math.abs(v) <= (o.wid ?? d.wid ?? 1) / 2;
  }
  return Math.hypot(px - o.x, py - o.y) <= (d.radius ?? 0.4);
}

/* ——— Murs, falaises, murets : sur les arêtes de la grille ——— */

export type WallKind = 'mur' | 'falaise' | 'muret';
export const WALLS: { kind: WallKind; label: string; text: string }[] = [
  { kind: 'mur', label: 'Mur', text: 'Infranchissable, même en volant ; bloque la vue.' },
  { kind: 'falaise', label: 'Falaise', text: 'Il faut escalader pour la franchir (le vol passe).' },
  { kind: 'muret', label: 'Muret', text: 'Franchissable : compte double ; demi-couvert.' },
];
export interface BattleWall { id: string; kind: WallKind; /** Sommets de la grille (entiers). */ points: Pt[] }

/** Clés des arêtes : `h x,y` sépare (x, y-1) de (x, y) ; `v x,y` sépare (x-1, y) de (x, y). */
export function wallEdges(w: BattleWall): string[] {
  const out: string[] = [];
  for (let i = 0; i < w.points.length - 1; i++) {
    let [x, y] = w.points[i].map(Math.round) as Pt;
    const [sx, sy] = [x, y];
    const [tx, ty] = w.points[i + 1].map(Math.round) as Pt;
    const DX = Math.abs(tx - sx) || 1, DY = Math.abs(ty - sy) || 1;
    // Une diagonale devient un escalier d'arêtes, en suivant au plus près la droite.
    while (x !== tx || y !== ty) {
      const ex = tx - x, ey = ty - y;
      const goX = ey === 0 || (ex !== 0 && Math.abs(ex) / DX >= Math.abs(ey) / DY);
      if (goX) { const nx = x + Math.sign(ex); out.push(`h${Math.min(x, nx)},${y}`); x = nx; } else { const ny = y + Math.sign(ey); out.push(`v${x},${Math.min(y, ny)}`); y = ny; }
    }
  }
  return out;
}

/* ——— Corrections du MJ ——— */

/** Correction d'une case : terrain imposé et/ou règle imposée (`normal` ignore obstacles et terrain). */
export interface CellFix { t?: TerrainId; rule?: 'normal' | 'difficile' | 'bloquee' }

/* ——— Compilation : une règle par case ——— */

export interface CellInfo {
  /** Terrain principal (au centre de la case). */
  t: TerrainId;
  /** D'où vient la classification. */
  src: 'fond' | 'zone' | 'mj';
  zone?: string;
  elev: number;
  /** Obstacle dont l'empreinte couvre le centre de la case. */
  obs?: { id: string; kind: ObjectKind; c: Exclude<Collision, 'decor'> };
  /** Tablier de pont au-dessus (objet). */
  deck?: string;
  /** Règle imposée par le MJ. */
  rule?: CellFix['rule'];
  /** Bordure ou élément dont l'apparence peut tromper : à vérifier. */
  amb?: string;
}
export interface SurfaceRules { cols: number; rows: number; cells: CellInfo[]; walls: Record<string, WallKind> }

export interface SurfaceInput {
  cols: number; rows: number;
  /** Grille de base (un caractère par case) ; absente : tout le plateau est du sol. */
  base?: string;
  ground?: TerrainId;
  zones?: TerrainZone[];
  objects?: BattleObject[];
  walls?: BattleWall[];
  fixes?: Record<string, CellFix>;
}

const prio = (z: TerrainZone) => z.priority ?? TERRAIN_DEF[z.terrain]?.priority ?? 0;
/** Ordre de résolution : priorité, puis identifiant (le plus petit l'emporte). Stable, quel que soit l'ordre de pose. */
const beats = (a: TerrainZone, b: TerrainZone) => prio(a) > prio(b) || (prio(a) === prio(b) && a.id < b.id);

/** Catégorie de règle d'un terrain (pour comparer deux terrains : seules les différences de règle trompent). */
export const ruleKey = (t: TerrainId) => { const d = TERRAIN_DEF[t]; return d ? `${d.mode}${d.difficult ? 'd' : ''}${d.danger ? '!' : ''}` : '?'; };

let memo: { key: unknown[]; out: SurfaceRules } | null = null;

/** Classification de toutes les cases. Recalculée seulement si une donnée de la scène change (zones mises en cache). */
export function compileSurface(s: SurfaceInput): SurfaceRules {
  const key = [s.cols, s.rows, s.base, s.ground, s.zones, s.objects, s.walls, s.fixes];
  if (memo && memo.key.every((k, i) => k === key[i])) return memo.out;
  const { cols, rows } = s;
  const ground = s.ground && TERRAIN_DEF[s.ground] ? s.ground : 'sol';
  const zones = (s.zones ?? []).filter((z) => TERRAIN_DEF[z.terrain]);
  const masks = zones.map((z) => rasterOf(z, cols, rows));
  const cells: CellInfo[] = new Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) {
    const baseT: TerrainId = (s.base && LEGACY[s.base[i]]) || ground;
    // Terrain gagnant à chaque échantillon de la case (le centre décide ; les autres servent à repérer les bordures).
    const winnerAt = (k: number) => {
      let best = -1;
      for (let z = 0; z < zones.length; z++) if (masks[z][i] & (1 << k) && (best < 0 || beats(zones[z], zones[best]))) best = z;
      return best;
    };
    const w = winnerAt(0);
    const c: CellInfo = w >= 0
      ? { t: zones[w].terrain, src: 'zone', zone: zones[w].id, elev: zones[w].elevation ?? 0 }
      : { t: baseT, src: 'fond', elev: 0 };
    let other = 0, otherT: TerrainId | null = null;
    if (masks.some((m) => m[i])) {
      for (let k = 1; k < SAMPLES.length; k++) {
        const wk = winnerAt(k);
        const tk = wk >= 0 ? zones[wk].terrain : baseT;
        if (ruleKey(tk) !== ruleKey(c.t)) { other++; otherT = tk; }
      }
    }
    if (other >= 3 && otherT) c.amb = `Bordure : « ${TERRAIN_DEF[c.t].label} » au centre, « ${TERRAIN_DEF[otherT].label} » sur ${other}/8 du reste de la case.`;
    cells[i] = c;
  }
  // Éléments : l'empreinte couvre-t-elle le centre de la case ? Un bloquant l'emporte sur un partiel (égalité : identifiant).
  for (const o of s.objects ?? []) {
    const d = OBJECT_DEF[o.kind];
    if (!d) continue;
    const reach = d.deck ? Math.hypot(o.len ?? d.len ?? 4, o.wid ?? d.wid ?? 1) / 2 + 1 : (d.radius ?? 0.4) + 1;
    for (let y = Math.max(0, Math.floor(o.y - reach)); y <= Math.min(rows - 1, Math.ceil(o.y + reach)); y++) {
      for (let x = Math.max(0, Math.floor(o.x - reach)); x <= Math.min(cols - 1, Math.ceil(o.x + reach)); x++) {
        const c = cells[y * cols + x];
        const centre = objectHas(o, x + 0.5, y + 0.5);
        if (d.deck) { if (centre && (!c.deck || o.id < c.deck)) c.deck = o.id; continue; }
        if (d.collision === 'decor') continue;
        const covered = SAMPLES.filter(([sx, sy]) => objectHas(o, x + sx, y + sy)).length;
        if (centre) {
          const stronger = !c.obs || (d.collision === 'bloquant' && c.obs.c === 'partiel') || (d.collision === c.obs.c && o.id < c.obs.id);
          if (stronger) c.obs = { id: o.id, kind: o.kind, c: d.collision };
          if (covered <= 3) c.amb = `« ${d.label} » occupe peu la case mais en couvre le centre : la case compte comme ${d.collision === 'bloquant' ? 'bloquée' : 'difficile'}.`;
        } else if (covered >= 3 && !c.obs) {
          c.amb = `« ${d.label} » déborde sur la case sans en couvrir le centre : elle reste praticable.`;
        }
      }
    }
  }
  // Corrections du MJ : elles priment, et la case n'est plus signalée.
  for (const [k, f] of Object.entries(s.fixes ?? {})) {
    const c = cells[Number(k)];
    if (!c) continue;
    if (f.t && TERRAIN_DEF[f.t]) { c.t = f.t; c.src = 'mj'; c.zone = undefined; }
    if (f.rule) { c.rule = f.rule; c.src = 'mj'; }
    c.amb = undefined;
  }
  const walls: Record<string, WallKind> = {};
  for (const w of s.walls ?? []) for (const e of wallEdges(w)) walls[e] = w.kind;
  const out = { cols, rows, cells, walls };
  memo = { key, out };
  return out;
}

/* ——— Lecture d'une case ——— */

/** Catégorie d'une case pour la surcouche du MJ. */
export type Category = 'normal' | 'difficile' | 'special' | 'bloquee' | 'danger';
export function categoryOf(c: CellInfo): Category {
  if (c.rule === 'bloquee') return 'bloquee';
  if (c.rule === 'normal') return 'normal';
  if (c.rule === 'difficile') return 'difficile';
  if (c.obs?.c === 'bloquant' && !c.deck) return 'bloquee';
  const d = TERRAIN_DEF[c.t];
  if (d.mode === 'bloque') return 'bloquee';
  if (d.danger) return 'danger';
  if (d.mode !== 'marche') return 'special';
  return d.difficult || c.obs?.c === 'partiel' ? 'difficile' : 'normal';
}
export const CATEGORY_LABEL: Record<Category, string> = {
  normal: 'Terrain normal', difficile: 'Terrain difficile', special: 'Déplacement particulier (nage, escalade, vol)', bloquee: 'Case bloquée', danger: 'Zone dangereuse',
};

/** Ce que dit une case : « Eau profonde — nage », « Boue — terrain difficile ». */
export function cellLabel(c: CellInfo, layer: 'sol' | 'pont' = 'sol'): string {
  if (layer === 'pont' && c.deck) return 'Pont — praticable';
  if (c.rule === 'bloquee') return `${TERRAIN_DEF[c.t].label} — case bloquée (MJ)`;
  if (c.rule === 'normal') return `${TERRAIN_DEF[c.t].label} — praticable (MJ)`;
  if (c.rule === 'difficile') return `${TERRAIN_DEF[c.t].label} — terrain difficile (MJ)`;
  if (c.obs?.c === 'bloquant') return `${OBJECT_DEF[c.obs.kind].label} — infranchissable`;
  const d = TERRAIN_DEF[c.t];
  const parts = [
    d.mode === 'nage' ? 'nage' : d.mode === 'escalade' ? 'escalade' : d.mode === 'vide' ? 'vide : vol seulement' : d.mode === 'bloque' ? 'infranchissable' : null,
    d.difficult || c.obs?.c === 'partiel' ? 'terrain difficile' : null,
    d.slippery ? 'glissant' : null,
    d.danger ? 'dangereux' : null,
  ].filter(Boolean);
  const under = c.obs?.c === 'partiel' ? ` (${OBJECT_DEF[c.obs.kind].label.toLowerCase()})` : '';
  return `${d.label}${under} — ${parts.length ? parts.join(', ') : 'praticable'}`;
}

/** Origine de la classification, pour la fiche de la case (MJ). */
export function originOf(c: CellInfo, zones: TerrainZone[] = []): string {
  if (c.src === 'mj') return 'Correction du MJ';
  if (c.src === 'zone') {
    const z = zones.find((q) => q.id === c.zone);
    return `Zone « ${z?.label || TERRAIN_DEF[c.t].label} » (priorité ${z ? prio(z) : '?'}) au centre de la case`;
  }
  return 'Fond de la carte';
}

/* ——— Grille compatible (brouillard, placement, IA) ——— */

/**
 * Grille d'un caractère par case, au sens des anciennes règles : `#` bloque et cache, `X` bloque sans cacher, `:` difficile,
 * `.` praticable. Les modules qui ne connaissent que cette grille respectent ainsi zones, éléments et corrections.
 */
export function compatGrid(r: SurfaceRules, objects: BattleObject[] = []): string {
  const opaque = new Set(objects.filter((o) => OBJECT_DEF[o.kind]?.opaque).map((o) => o.id));
  return r.cells.map((c) => {
    const cat = categoryOf(c);
    if (c.deck && cat !== 'bloquee') return '.';
    if (cat === 'bloquee') return TERRAIN_DEF[c.t].mode === 'bloque' || (c.obs && opaque.has(c.obs.id)) ? '#' : 'X';
    if (TERRAIN_DEF[c.t].mode === 'vide' && c.rule !== 'normal') return 'X';
    return cat === 'normal' ? '.' : ':';
  }).join('');
}

/* ——— Socles ——— */

export type SocleMode = { mode: 'auto' } | { mode: 'aucun' } | { mode: 'manuel'; t: TerrainId };

/**
 * Socle d'un jeton à sa position validée : le terrain majoritaire sous son empreinte (le pont s'il y est),
 * égalité départagée par l'ordre des terrains. Purement visuel : il ne change ni la taille ni les règles.
 */
export function socleOf(r: SurfaceRules | undefined, t: { x: number; y: number; size: number; layer?: 'pont'; socle?: SocleMode }): TerrainId | null {
  if (t.socle?.mode === 'aucun') return null;
  if (t.socle?.mode === 'manuel') return TERRAIN_DEF[t.socle.t] ? t.socle.t : null;
  if (!r) return null;
  const count = new Map<TerrainId, number>();
  for (let dy = 0; dy < t.size; dy++) for (let dx = 0; dx < t.size; dx++) {
    const c = r.cells[(t.y + dy) * r.cols + t.x + dx];
    if (!c) continue;
    const id: TerrainId = c.deck && t.layer === 'pont' ? 'pont' : c.t;
    count.set(id, (count.get(id) ?? 0) + 1);
  }
  let best: TerrainId | null = null;
  for (const [id, n] of count) if (!best || n > count.get(best)! || (n === count.get(best)! && TERRAIN_RANK[id] < TERRAIN_RANK[best])) best = id;
  return best;
}
