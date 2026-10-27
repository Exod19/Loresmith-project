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
export const GROUPS = ['Mobilier', 'Livres & écrits', 'Savoir & alchimie', 'Lumière', 'Textiles', 'Nature'] as const;
export const PROPS: { key: string; label: string; group: string; text: string }[] = [
  { key: 'bureau_consultation', label: 'Bureau de consultation', group: 'Mobilier', text: 'Un bureau couvert de cartes et de bougies, où l’on reçoit les visiteurs.' },
  { key: 'bureau_ecriture', label: 'Bureau d’écriture', group: 'Mobilier', text: 'Un bureau d’écriture : encrier, plume et feuilles à moitié remplies.' },
  { key: 'bureau_notes', label: 'Bureau aux notes', group: 'Mobilier', text: 'Un bureau jonché de notes et de parchemins annotés à la hâte.' },
  { key: 'bureau_recherche', label: 'Bureau de recherche', group: 'Mobilier', text: 'Un bureau de recherche : un grand livre ouvert sous une loupe.' },
  { key: 'bureau_cartographie', label: 'Table de cartographie', group: 'Mobilier', text: 'Une table où l’on déroule les cartes des galeries connues.' },
  { key: 'bureau_alchimie', label: 'Table d’alchimie', group: 'Mobilier', text: 'Une table d’alchimie chargée de fioles, de cristaux et d’instruments.' },
  { key: 'etagere_livres', label: 'Étagère', group: 'Mobilier', text: 'Une étagère pleine de reliures usées, avec une échelle pour atteindre les rangs hauts.' },
  { key: 'pile_livres', label: 'Pile de livres', group: 'Livres & écrits', text: 'Une pile de livres aux couvertures sombres, certains ornés de symboles.' },
  { key: 'livres_ouverts', label: 'Livres ouverts', group: 'Livres & écrits', text: 'Deux livres ouverts, leurs pages couvertes d’une écriture serrée.' },
  { key: 'livres_fermes', label: 'Livres fermés', group: 'Livres & écrits', text: 'Une pile de livres fermés, scellés par des fermoirs.' },
  { key: 'chariot_livres', label: 'Chariot à livres', group: 'Mobilier', text: 'Un chariot à roulettes chargé de livres et de rouleaux.' },
  { key: 'echelle_bibliotheque', label: 'Échelle', group: 'Mobilier', text: 'Une échelle de bibliothèque sur rail, appuyée contre les rayonnages.' },
  { key: 'chaise', label: 'Chaise', group: 'Mobilier', text: 'Une chaise de cuir usé, à l’assise ornée.' },
  { key: 'tabouret', label: 'Tabouret', group: 'Mobilier', text: 'Un tabouret capitonné, sans dossier.' },
  { key: 'table_ronde', label: 'Table ronde', group: 'Mobilier', text: 'Une table ronde couverte de bougies éteintes et d’un vieux plateau.' },
  { key: 'banc', label: 'Banc', group: 'Mobilier', text: 'Un banc long et bas, recouvert de cuir.' },
  { key: 'coffre', label: 'Coffre', group: 'Mobilier', text: 'Un coffre de bois cerclé de fer. Son couvercle est entrouvert.' },
  { key: 'caisse_parchemins', label: 'Caisse de parchemins', group: 'Livres & écrits', text: 'Une caisse de bois pleine de parchemins roulés et de vieux codex.' },
  { key: 'chandelier', label: 'Chandelier', group: 'Lumière', text: 'Un chandelier de laiton à plusieurs branches, dont les bougies brûlent.' },
  { key: 'bougies', label: 'Bougies', group: 'Lumière', text: 'Des bougies de cire blanche, leurs flammes vacillantes.' },
  { key: 'encrier', label: 'Encrier', group: 'Savoir & alchimie', text: 'Un encrier de métal sombre et une plume posée sur un plateau.' },
  { key: 'loupe_cristal', label: 'Globe de cristal', group: 'Savoir & alchimie', text: 'Un globe de cristal sur un socle de laiton. Sa surface reflète la lumière.' },
  { key: 'lunettes', label: 'Lunettes', group: 'Savoir & alchimie', text: 'Des lunettes rondes posées sur un étui ouvert.' },
  { key: 'parchemin', label: 'Parchemin', group: 'Livres & écrits', text: 'Un parchemin roulé, scellé d’une cire ancienne.' },
  { key: 'carte', label: 'Carte', group: 'Livres & écrits', text: 'Une carte déroulée, tracée à l’encre et retenue par des pinces.' },
  { key: 'notes', label: 'Notes', group: 'Livres & écrits', text: 'Des feuillets épars, couverts de notes manuscrites.' },
  { key: 'coussin', label: 'Coussin', group: 'Textiles', text: 'Un coussin de velours bleu brodé, posé sur une peau.' },
  { key: 'tapis_peau', label: 'Peau en tapis', group: 'Textiles', text: 'Une peau de bête étalée sur le sol, chaude et épaisse.' },
  { key: 'tapis', label: 'Tapis', group: 'Textiles', text: 'Un tapis sombre orné de motifs dorés.' },
  { key: 'plante', label: 'Plante lumineuse', group: 'Nature', text: 'Une plante en pot dont les champignons luisent d’une lueur violette.' },
];
export const PROP_BY_KEY: Record<string, (typeof PROPS)[number]> = Object.fromEntries(PROPS.map((p) => [p.key, p]));

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
