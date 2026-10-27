/**
 * Construction manuelle du plateau : terrain peint case par case (pinceau, ligne, contour, zone) et objets déposés.
 * Les modifications sont des surcharges sur le terrain généré : « Régénérer » les efface, « Gomme » restaure le généré.
 */
import type { BattleBuild } from '../mapStore';
import type { TerrainKind } from './terrain';

export type BuildShape = 'pinceau' | 'ligne' | 'contour' | 'zone';

export const SHAPES: { id: BuildShape; label: string; hint: string }[] = [
  { id: 'pinceau', label: 'Pinceau', hint: 'Glisse sur les cases à peindre.' },
  { id: 'ligne', label: 'Ligne', hint: 'Glisse d’un point à l’autre : un mur ou un couloir droit.' },
  { id: 'contour', label: 'Contour', hint: 'Glisse entre deux coins opposés : le pourtour d’une salle.' },
  { id: 'zone', label: 'Zone', hint: 'Glisse entre deux coins opposés : un rectangle plein.' },
];

/** Outil courant : peindre le terrain (type et forme), ou déposer un objet (ou le retirer). */
export type Brush =
  | { tool: 'terrain'; kind: TerrainKind | 'gomme'; shape: BuildShape }
  | { tool: 'objet'; prop: string | 'gomme' };

export const DEFAULT_BRUSH: Brush = { tool: 'terrain', kind: '#', shape: 'pinceau' };

/** Types de terrain que le MJ peut poser à la main, avec des libellés courts. */
export const BUILD_TERRAIN: { kind: TerrainKind; label: string }[] = [
  { kind: '.', label: 'Sol' },
  { kind: '#', label: 'Roche' },
  { kind: '~', label: 'Eau' },
  { kind: ':', label: 'Éboulis' },
  { kind: '=', label: 'Pont' },
  { kind: 'X', label: 'Gouffre' },
  { kind: 'I', label: 'Pilier' },
  { kind: ',', label: 'Décor' },
];

/** Objets d'archives (public/images/combat-map/props). Décoratifs : ils ne bloquent pas le déplacement. */
export const PROPS: { key: string; label: string }[] = [
  { key: 'bureau_consultation', label: 'Bureau de consultation' },
  { key: 'bureau_ecriture', label: 'Bureau d’écriture' },
  { key: 'bureau_notes', label: 'Bureau aux notes' },
  { key: 'bureau_recherche', label: 'Bureau de recherche' },
  { key: 'bureau_cartographie', label: 'Table de cartographie' },
  { key: 'bureau_alchimie', label: 'Table d’alchimie' },
  { key: 'etagere_livres', label: 'Étagère' },
  { key: 'pile_livres', label: 'Pile de livres' },
  { key: 'livres_ouverts', label: 'Livres ouverts' },
  { key: 'livres_fermes', label: 'Livres fermés' },
  { key: 'chariot_livres', label: 'Chariot à livres' },
  { key: 'echelle_bibliotheque', label: 'Échelle' },
  { key: 'chaise', label: 'Chaise' },
  { key: 'tabouret', label: 'Tabouret' },
  { key: 'table_ronde', label: 'Table ronde' },
  { key: 'banc', label: 'Banc' },
  { key: 'coffre', label: 'Coffre' },
  { key: 'caisse_parchemins', label: 'Caisse de parchemins' },
  { key: 'chandelier', label: 'Chandelier' },
  { key: 'bougies', label: 'Bougies' },
  { key: 'encrier', label: 'Encrier' },
  { key: 'loupe_cristal', label: 'Globe de cristal' },
  { key: 'lunettes', label: 'Lunettes' },
  { key: 'parchemin', label: 'Parchemin' },
  { key: 'carte', label: 'Carte' },
  { key: 'notes', label: 'Notes' },
  { key: 'coussin', label: 'Coussin' },
  { key: 'tapis_peau', label: 'Peau en tapis' },
  { key: 'tapis', label: 'Tapis' },
  { key: 'plante', label: 'Plante lumineuse' },
];

export const PROP_LABEL: Record<string, string> = Object.fromEntries(PROPS.map((p) => [p.key, p.label]));
export const propUrl = (key: string) => `${import.meta.env.BASE_URL}images/combat-map/props/${key}.webp`;

/** Cases d'une forme tracée entre deux points (index de case). */
export function shapeCells(shape: BuildShape, a: { x: number; y: number }, b: { x: number; y: number }, cols: number): number[] {
  const out: number[] = [];
  if (shape === 'pinceau') return [b.y * cols + b.x];
  if (shape === 'ligne') {
    // Tracé de Bresenham : une suite de cases connexes entre les deux points.
    let x = a.x, y = a.y;
    const dx = Math.abs(b.x - a.x), dy = -Math.abs(b.y - a.y);
    const sx = a.x < b.x ? 1 : -1, sy = a.y < b.y ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      out.push(y * cols + x);
      if (x === b.x && y === b.y) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
    return out;
  }
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (shape === 'zone' || y === y0 || y === y1 || x === x0 || x === x1) out.push(y * cols + x);
  }
  return out;
}

/** Applique les surcharges du MJ sur le terrain (effectif) ; sans terrain, rien à appliquer. */
export function applyBuild(grid: string | undefined, build: BattleBuild | undefined): string | undefined {
  if (!grid || !build) return grid;
  const g = grid.split('');
  for (const [cell, kind] of Object.entries(build.edits)) {
    const i = Number(cell);
    if (i >= 0 && i < g.length) g[i] = kind;
  }
  return g.join('');
}
