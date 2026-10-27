/**
 * Zone locale de la carte de combat : on prend la portion de plan autour du lieu choisi, et on y place
 * les vrais éléments de l'Atlas (passages = tracés, points = lieux, repères du MJ) à leur position relative.
 * Les passages secrets restent fermés tant que le MJ ne les a pas découverts ; chacun a un DC à obtenir.
 */
import type { AtlasData, AtlasFeature, AtlasGeometry, AtlasMap } from '../atlas/types';
import { dmFeature } from '../atlas/lore';
import type { MapMarker } from '../mapStore';
import { generateTerrain, type LocationHint, type TerrainElement, type TerrainKind } from './terrain';
import type { PassageLink } from '../mapStore';

export type LocalElement = TerrainElement & {
  id: string;
  /** Destination déduite de l'Atlas (ancre reliée à un autre plan). Le MJ peut la remplacer. */
  auto?: PassageLink;
  title: string;
  category: string;
  subtitle?: string;
  summary?: string;
  trace?: string;
  /** DC à obtenir pour découvrir un élément secret (indicatif, tiré de la fiche ou par défaut). */
  dc?: number;
  checkLabel?: string;
};

export type LocalMap = {
  window: { x0: number; y0: number; w: number; h: number };
  base: string;
  elements: LocalElement[];
};

/** Épaisseur d'un passage, en cases, selon son type. Seuls les passages du tracé sont repris : les lieux et repères
 * sont affichés à part, avec leur état de découverte. */
const RADIUS: Record<string, number> = { tunnel: 0, galerie: 0, boyau: 0, etroit: 0, crevasse: 0, ruisseau: 0, secret: 0 };

/** Lieux dont le nom décrit un obstacle visible sur la carte de navigation. */
const OBSTACLES: [RegExp, TerrainKind, number][] = [
  [/stalagm|stalact|pilier|colonne|concretion/, 'I', 0],
  [/eboulis|gravat|decombre|rocaille/, ':', 1],
  [/lac|etang|source|cascade|bassin|mare|flaque/, '~', 1],
];
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Sol = intérieur des cavités dessinées sur la carte de navigation ; le reste est de la roche. */
function floorFromCavities(cols: number, rows: number, win: { x0: number; y0: number; w: number; h: number }, cavs: { cx: number; cy: number; rx: number; ry: number }[]): string | undefined {
  if (!cavs.length) return undefined;
  let floor = 0;
  const out: string[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const px = win.x0 + ((x + 0.5) / cols) * win.w, py = win.y0 + ((y + 0.5) / rows) * win.h;
    const open = cavs.some((c) => ((px - c.cx) / c.rx) ** 2 + ((py - c.cy) / c.ry) ** 2 <= 1);
    if (open) floor++;
    out.push(open ? '.' : '#');
  }
  return floor > 0 ? out.join('') : undefined;
}
const MAX_ELEMENTS = 60;

/** Premier test de la fiche qui porte un DD ; à défaut, un DD indicatif pour un passage secret. */
function dcOf(f: AtlasFeature): { dc: number; checkLabel: string } | null {
  const check = dmFeature(f).checks.find((c) => c.dc);
  return check?.dc ? { dc: check.dc, checkLabel: check.label } : null;
}

export function buildLocalMap(p: {
  atlas: AtlasData; plan: AtlasMap; markers: MapMarker[]; centerId: string; cols: number; rows: number;
  hint: LocationHint; seed: number;
}): LocalMap {
  const { atlas, plan, markers, centerId, cols, rows } = p;
  const byId = new Map(atlas.features.map((f) => [f.id, f]));
  const onPlan = atlas.geometries.filter((g) => g.mapId === plan.id);

  // Centre : le lieu choisi (point, ou milieu du tracé), sinon le centre du plan.
  let cx = 0.5, cy = 0.5;
  const mk = centerId.startsWith('mk-') ? markers.find((m) => `mk-${m.id}` === centerId) : null;
  if (mk) { cx = mk.x; cy = mk.y; } else {
    const g = onPlan.find((x) => x.featureId === centerId);
    if (g) {
      const pts = g.type === 'point' ? [g.coordinates as [number, number]] : (g.coordinates as [number, number][]);
      cx = pts.reduce((s, q) => s + q[0], 0) / pts.length;
      cy = pts.reduce((s, q) => s + q[1], 0) / pts.length;
    }
  }
  // Fenêtre carrée en pixels de plan : une case a la même taille en largeur et en hauteur.
  const w = 0.16;
  const h = w * (plan.width / plan.height) * (rows / cols);
  const win = { x0: cx - w / 2, y0: cy - h / 2, w, h };
  const toCell = (x: number, y: number) => ({ x: Math.floor(((x - win.x0) / win.w) * cols), y: Math.floor(((y - win.y0) / win.h) * rows) });
  const inside = (c: { x: number; y: number }) => c.x >= 0 && c.y >= 0 && c.x < cols && c.y < rows;

  const elements: LocalElement[] = [];

  // Passages (tracés) : rasterisés en cases, épaisseur selon le type.
  // Les repères du MJ sont ajoutés plus bas : on ignore leurs copies dans le jeu de données.
  for (const g of onPlan) {
    if (g.type !== 'polyline' || g.featureId.startsWith('mk-')) continue;
    const f = byId.get(g.featureId);
    if (!f || f.area) continue;
    const cells = new Set<number>();
    const pts = g.coordinates as [number, number][];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const a = toCell(ax, ay), b = toCell(bx, by);
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 4));
      for (let s = 0; s <= steps; s++) {
        const x = Math.round(a.x + ((b.x - a.x) * s) / steps), y = Math.round(a.y + ((b.y - a.y) * s) / steps);
        const r = RADIUS[f.trace ?? ''] ?? 0;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const c = { x: x + dx, y: y + dy };
          if (inside(c)) cells.add(c.y * cols + c.x);
        }
      }
    }
    if (cells.size === 0) continue;
    const secret = f.trace === 'secret';
    const d = secret ? dcOf(f) : null;
    elements.push({
      id: f.id, kind: 'passage', title: f.title, category: f.category, subtitle: f.subtitle, summary: f.summary,
      trace: f.trace, secret, cells: [...cells], floor: f.trace === 'crevasse' ? 'X' : f.trace === 'ruisseau' ? '~' : '.',
      ...(secret ? { dc: d?.dc ?? 14, checkLabel: d?.checkLabel ?? 'Perception (Sagesse)' } : {}),
    });
  }

  // Lieux de l'Atlas (corde, piton, carcasse…) : des points nommés, sur la case où ils se trouvent.
  for (const g of onPlan) {
    if (g.type !== 'point' || g.featureId.startsWith('mk-')) continue;
    const f = byId.get(g.featureId);
    if (!f || f.area || !f.category) continue;
    const [px, py] = g.coordinates as [number, number];
    const c = toCell(px, py);
    if (!inside(c)) continue;
    elements.push({
      id: f.id, kind: 'point', secret: false, title: f.title, category: f.category, subtitle: f.subtitle, summary: f.summary,
      cell: c.y * cols + c.x,
    });
  }

  // Les plus proches du centre d'abord ; on garde une lisibilité raisonnable.
  const centre = toCell(cx, cy);
  const dist = (e: LocalElement) => {
    const c = e.cells ? { x: e.cells[0] % cols, y: Math.floor(e.cells[0] / cols) } : { x: e.cell! % cols, y: Math.floor(e.cell! / cols) };
    return Math.hypot(c.x - centre.x, c.y - centre.y);
  };
  elements.sort((a, b) => dist(a) - dist(b));

  // Terrain : les cavités de la carte de navigation, sinon le terrain généré. Puis les obstacles nommés sur la carte.
  const cavs = atlas.cavities[plan.id] ?? [];
  // Un lieu de type couloir est presque entièrement de la roche : seuls ses passages sont praticables.
  const corridor = ['boyau', 'etroit', 'galerie', 'tunnel', 'secret'].includes(p.hint.trace ?? '') || p.hint.category === 'voie';
  let base = corridor
    ? '#'.repeat(cols * rows)
    : floorFromCavities(cols, rows, win, cavs) ?? generateTerrain(cols, rows, p.hint, p.seed);
  for (const g of onPlan) {
    if (g.type !== 'point') continue;
    const f = byId.get(g.featureId);
    if (!f || f.area) continue;
    const rule = OBSTACLES.find(([re]) => re.test(norm(f.title)));
    if (!rule) continue;
    const [, kind, radius] = rule;
    const [px, py] = g.coordinates as [number, number];
    const c = toCell(px, py);
    if (!inside(c)) continue;
    const chars = base.split('') as TerrainKind[];
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const x = c.x + dx, y = c.y + dy;
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      if (chars[y * cols + x] === '.') chars[y * cols + x] = kind;
    }
    base = chars.join('');
  }
  // Destination de chaque passage, lue dans les connexions de l'Atlas quand elle existe.
  // Un passage secret n'apparaît que s'il mène quelque part dans l'Atlas : les autres n'existent pas pour le combat.
  const places = onPlan.filter((g) => g.type === 'point').map((g) => ({ g, f: byId.get(g.featureId) })).filter((x): x is { g: AtlasGeometry; f: AtlasFeature } => !!x.f && !x.f.area && !!x.f.category);
  // Dans un couloir, seul le passage du lieu est praticable : les autres de la zone ne sont pas accessibles d'ici.
  const scoped = corridor ? elements.filter((e) => e.kind !== 'passage' || e.id === centerId) : elements;
  const kept = scoped
    .map((e) => (e.kind === 'passage' ? { ...e, auto: autoLink(atlas, plan, e.id, places) } : e))
    .filter((e) => e.kind !== 'passage' || !e.secret || e.auto)
    .slice(0, MAX_ELEMENTS);
  return { window: win, base, elements: kept };
}

/** Destination d'un tracé : une de ses extrémités tombe sur une ancre reliée à une ancre d'un autre plan. */
function autoLink(atlas: AtlasData, plan: AtlasMap, featureId: string, places: { g: AtlasGeometry; f: AtlasFeature }[]): PassageLink | undefined {
  const g = atlas.geometries.find((x) => x.featureId === featureId && x.type === 'polyline');
  if (!g) return undefined;
  const pts = g.coordinates as [number, number][];
  // 1. Connexion de l'Atlas : l'extrémité tombe sur une ancre reliée à un autre plan.
  const viaAnchor = anchorLink(atlas, plan, pts);
  if (viaAnchor) return viaAnchor;
  // 2. À défaut, le lieu nommé au bout du tracé : le passage relie deux lieux du plan.
  const near = (p: [number, number]) => {
    let best: { f: AtlasFeature } | undefined; let bd = 0.012;
    for (const x of places) {
      const [qx, qy] = x.g.coordinates as [number, number];
      const d = Math.hypot(qx - p[0], qy - p[1]);
      if (d < bd) { bd = d; best = x; }
    }
    return best;
  };
  const a = near(pts[0]), b = near(pts[pts.length - 1]);
  if (a && b && a.f.id !== b.f.id) return { kind: 'feature', id: b.f.id, planId: plan.id, label: b.f.title };
  return undefined;
}

function anchorLink(atlas: AtlasData, plan: AtlasMap, pts: [number, number][]): PassageLink | undefined {
  for (const e of [pts[0], pts[pts.length - 1]]) {
    for (const from of atlas.anchors.filter((a) => a.mapId === plan.id && Math.hypot(a.at[0] - e[0], a.at[1] - e[1]) < 0.02)) {
      for (const c of atlas.connections) {
        const to = c.fromAnchorId === from.id ? c.toAnchorId : c.toAnchorId === from.id ? c.fromAnchorId : null;
        const target = to && atlas.anchors.find((a) => a.id === to);
        if (target && target.mapId !== plan.id) {
          const mapTitle = atlas.maps.find((m) => m.id === target.mapId)?.title ?? target.mapId;
          return { kind: 'anchor', id: target.id, planId: target.mapId, label: `${target.label} · ${mapTitle}` };
        }
      }
    }
  }
  return undefined;
}

/** Case de la grille où tombe un point du plan, si elle est dans la zone. */
export function cellIn(win: { x0: number; y0: number; w: number; h: number }, cols: number, rows: number, x: number, y: number): number | undefined {
  const c = Math.floor(((x - win.x0) / win.w) * cols), r = Math.floor(((y - win.y0) / win.h) * rows);
  return c >= 0 && r >= 0 && c < cols && r < rows ? r * cols + c : undefined;
}
