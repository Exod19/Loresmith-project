/**
 * Portées des créatures : déplacement (cases atteignables, terrain compté) et attaque (allonge ou portée courte).
 * Tout se lit dans la fiche SRD : « 9 m » pour la vitesse, « allonge 1,5 m » et « portée 9/36 m » pour les attaques.
 */
import type { Stat } from '../atlas/statblocks';
import { blocksCell, TERRAIN } from './terrain';

const FT_PER_M = 3.28084;
const FT_PER_CELL = 5;
/** Valeur par défaut pour un joueur (ou une créature sans fiche) : 9 m de vitesse, allonge 1,5 m. */
const DEFAULT_SPEED_CELLS = 6;
const DEFAULT_REACH_CELLS = 1;

const numberIn = (text: string) => parseFloat(text.replace(',', '.'));

/** Vitesse de marche en cases (la première valeur de la fiche : « 9 m, vol 9 m » → 9 m). */
export function speedCells(stat?: Stat): number {
  if (!stat) return DEFAULT_SPEED_CELLS;
  const m = numberIn(stat.speed);
  return Number.isFinite(m) ? Math.round((m * FT_PER_M) / FT_PER_CELL) : DEFAULT_SPEED_CELLS;
}

const cellsOf = (metres: string) => Math.round((numberIn(metres) * FT_PER_M) / FT_PER_CELL);

/** Allonge au corps à corps en cases : la plus grande de la fiche. 0 si la créature n'attaque pas au contact. */
export function attackCells(stat?: Stat): number {
  if (!stat) return DEFAULT_REACH_CELLS;
  let best = 0;
  for (const [, text] of stat.actions) {
    const melee = /allonge ([\d,]+) m/i.exec(text);
    if (melee) best = Math.max(best, cellsOf(melee[1]));
  }
  return best;
}

/** Portée courte d'une attaque à distance, en cases (0 si aucune). La portée longue n'est pas dessinée. */
export function rangedCells(stat?: Stat): number {
  if (!stat) return 0;
  let best = 0;
  for (const [, text] of stat.actions) {
    const ranged = /portée ([\d,]+)\/[\d,]+ m/i.exec(text);
    if (ranged) best = Math.max(best, cellsOf(ranged[1]));
  }
  return best;
}

/** Cases atteignables depuis une case, avec un budget de cases. Le terrain difficile compte double, les obstacles bloquent. */
export function reachableCells(grid: string | undefined, cols: number, rows: number, from: { x: number; y: number }, budget: number): number[] {
  const n = cols * rows;
  const cost = new Array<number>(n).fill(Infinity);
  const done = new Array<boolean>(n).fill(false);
  const start = from.y * cols + from.x;
  cost[start] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && cost[i] < Infinity && (u < 0 || cost[i] < cost[u])) u = i;
    if (u < 0 || cost[u] > budget) break;
    done[u] = true;
    const ux = u % cols, uy = Math.floor(u / cols);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = ux + dx, y = uy + dy;
      if ((!dx && !dy) || x < 0 || y < 0 || x >= cols || y >= rows || blocksCell(grid, cols, x, y)) continue;
      const k = grid ? (grid[y * cols + x] as keyof typeof TERRAIN) : '.';
      const step = TERRAIN[k]?.difficult ? 2 : 1;
      const v = y * cols + x;
      if (cost[u] + step < cost[v]) cost[v] = cost[u] + step;
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (cost[i] <= budget) out.push(i);
  return out;
}
