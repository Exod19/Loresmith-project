/**
 * Placement sur le plateau de combat : terrain effectif, cases libres, et première case libre près du centre.
 * Partagé par la carte de combat et par le module Combat qui y ajoute des combattants.
 */
import type { Battle, BattleToken } from '../mapStore';
import { blocksCell, effectiveGrid } from './terrain';
import { applyBuild } from './build';
import { compatGrid, compileSurface, type SurfaceRules } from './surface';

/** Grille de base dessinée : terrain généré, passages creusés (secrets fermés tant qu'ils ne sont pas découverts), retouches. */
let baseMemo: { key: unknown[]; grid: string | undefined } | null = null;

export function baseGridOf(b: Battle): string | undefined {
  if (!b.terrain) return undefined;
  // Appelée pour chaque case testée (placement, trajets, couverts) : on ne recalcule que si la scène a changé.
  const key = [b.terrain, b.local, b.build];
  if (baseMemo && baseMemo.key.every((k, i) => k === key[i])) return baseMemo.grid;
  const local = b.local;
  const grid = applyBuild(effectiveGrid(b.terrain.grid, local?.elements ?? [], local?.discovered ?? [], (local?.elements ?? []).map((e) => e.id)), b.build);
  baseMemo = { key, grid };
  return grid;
}

/** Classification des cases (fond, zones, éléments, murs, corrections du MJ) : la source des règles de déplacement. */
export function surfaceOf(b: Battle): SurfaceRules {
  return compileSurface({ cols: b.cols, rows: b.rows, base: baseGridOf(b), ground: b.ground, zones: b.zones, objects: b.objects, walls: b.walls, fixes: b.cellFix });
}

const hasSurface = (b: Battle) => !!(b.zones?.length || b.objects?.length || b.walls?.length || (b.cellFix && Object.keys(b.cellFix).length) || b.ground);

/**
 * Terrain effectif, une case par caractère (brouillard, placement, IA) : la grille de base, ou, dès que la scène a des
 * zones, éléments, murs ou corrections, la grille déduite de la classification.
 */
export function effectiveOf(b: Battle): string | undefined {
  if (!hasSurface(b)) return baseGridOf(b);
  return compatGrid(surfaceOf(b), b.objects);
}

/** Le jeton peut-il occuper ce coin sans chevaucher un autre jeton, un obstacle, ni sortir du plateau ? */
export function fits(b: Battle, id: string | null, size: number, x: number, y: number) {
  if (x < 0 || y < 0 || x + size > b.cols || y + size > b.rows) return false;
  const grid = effectiveOf(b);
  for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) if (blocksCell(grid, b.cols, x + dx, y + dy)) return false;
  return !b.tokens.some((t) => t.id !== id && t.x < x + size && x < t.x + t.size && t.y < y + size && y < t.y + t.size);
}

/** Tour en cours : le déplacement parcouru se remet à zéro à chaque changement de tour. */
export const turnKey = (b: Battle) => `${b.round}:${b.turn ?? ''}`;
const movedNow = (b: Battle) => (b.moved?.key === turnKey(b) ? b.moved : undefined);
export const isDashing = (b: Battle, id: string) => !!movedNow(b)?.dash?.includes(id);
export const usedMove = (b: Battle, id: string) => movedNow(b)?.used[id] ?? 0;
/** Déplacement restant dans le tour, en cases : la vitesse (doublée en fonçant), moins ce qui a été parcouru. */
export const moveLeft = (b: Battle, id: string, speed: number) => Math.max(0, speed * (isDashing(b, id) ? 2 : 1) - usedMove(b, id));
/** Note un déplacement (en cases), ou change l'état « Foncer ». */
export function withMove(b: Battle, id: string, patch: { cost?: number; dash?: boolean; reset?: boolean }): NonNullable<Battle['moved']> {
  const cur = movedNow(b) ?? { key: turnKey(b), used: {}, dash: [] };
  const used = { ...cur.used };
  if (patch.reset) delete used[id];
  if (patch.cost) used[id] = (used[id] ?? 0) + patch.cost;
  const dash = patch.dash === undefined ? cur.dash ?? [] : patch.dash ? [...new Set([...(cur.dash ?? []), id])] : (cur.dash ?? []).filter((x) => x !== id);
  return { key: turnKey(b), used, dash };
}

/** La place est-elle hors du plateau ou déjà prise par un autre jeton ? (le terrain n'est pas regardé) */
export function overlaps(b: Battle, id: string | null, size: number, x: number, y: number) {
  if (x < 0 || y < 0 || x + size > b.cols || y + size > b.rows) return true;
  return b.tokens.some((t) => t.id !== id && t.x < x + size && x < t.x + t.size && t.y < y + size && y < t.y + t.size);
}

/** Case libre la plus proche du centre du plateau (ou d'un point donné). */
export function freeNear(b: Battle, size: 1 | 2, near?: { x: number; y: number }): { x: number; y: number } | null {
  const cx = near?.x ?? Math.floor(b.cols / 2), cy = near?.y ?? Math.floor(b.rows / 2);
  const spots: { x: number; y: number; d: number }[] = [];
  for (let y = 0; y < b.rows; y++) for (let x = 0; x < b.cols; x++) spots.push({ x, y, d: Math.max(Math.abs(x - cx), Math.abs(y - cy)) + Math.abs(x - cx) * 0.01 });
  spots.sort((p, q) => p.d - q.d);
  return spots.find((p) => fits(b, null, size, p.x, p.y)) ?? null;
}

/** Pose des jetons sur les premières cases libres près du centre (ceux qui ne trouvent pas de place sont ignorés). */
export function placeTokens(b: Battle, list: Omit<BattleToken, 'x' | 'y'>[], near?: { x: number; y: number }): BattleToken[] {
  let next = b;
  const placed: BattleToken[] = [];
  for (const t of list) {
    const spot = freeNear(next, t.size, near);
    if (!spot) break;
    const token = { ...t, ...spot } as BattleToken;
    placed.push(token);
    next = { ...next, tokens: [...next.tokens, token] };
  }
  return placed;
}
