/**
 * Zone locale de la carte de combat : on prend la portion de plan autour du lieu choisi, et on y place
 * les vrais éléments de l'Atlas (passages = tracés, points = lieux, repères du MJ) à leur position relative.
 * Les passages secrets restent fermés tant que le MJ ne les a pas découverts ; chacun a un DC à obtenir.
 */
import type { AtlasData, AtlasFeature, AtlasMap } from '../atlas/types';
import { dmFeature } from '../atlas/lore';
import type { MapMarker } from '../mapStore';
import { generateTerrain, type LocationHint, type TerrainElement } from './terrain';
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
const RADIUS: Record<string, number> = { tunnel: 1, galerie: 1, boyau: 0, etroit: 0, crevasse: 0, ruisseau: 0, secret: 0 };
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
      trace: f.trace, secret, cells: [...cells],
      ...(secret ? { dc: d?.dc ?? 14, checkLabel: d?.checkLabel ?? 'Perception (Sagesse)' } : {}),
    });
  }

  // Les plus proches du centre d'abord ; on garde une lisibilité raisonnable.
  const centre = toCell(cx, cy);
  const dist = (e: LocalElement) => {
    const c = e.cells ? { x: e.cells[0] % cols, y: Math.floor(e.cells[0] / cols) } : { x: e.cell! % cols, y: Math.floor(e.cell! / cols) };
    return Math.hypot(c.x - centre.x, c.y - centre.y);
  };
  elements.sort((a, b) => dist(a) - dist(b));

  const base = generateTerrain(cols, rows, p.hint, p.seed);
  // Destination de chaque passage, lue dans les connexions de l'Atlas quand elle existe.
  // Un passage secret n'apparaît que s'il mène quelque part dans l'Atlas : les autres n'existent pas pour le combat.
  const kept = elements
    .map((e) => (e.kind === 'passage' ? { ...e, auto: autoLink(atlas, plan, e.id) } : e))
    .filter((e) => e.kind !== 'passage' || !e.secret || e.auto)
    .slice(0, MAX_ELEMENTS);
  return { window: win, base, elements: kept };
}

/** Destination d'un tracé : une de ses extrémités tombe sur une ancre reliée à une ancre d'un autre plan. */
function autoLink(atlas: AtlasData, plan: AtlasMap, featureId: string): PassageLink | undefined {
  const g = atlas.geometries.find((x) => x.featureId === featureId && x.type === 'polyline');
  if (!g) return undefined;
  const pts = g.coordinates as [number, number][];
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
