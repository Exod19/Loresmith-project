/**
 * Brouillard de guerre : les cases que voient les héros (portée de vue et ligne de vue), et celles déjà explorées.
 * Une case de roche ou un pilier se voit, mais cache ce qui est derrière. Un gouffre ou de l'eau ne cachent rien.
 */
import type { Battle, BattleToken } from '../mapStore';
import { cellKind } from './terrain';
import { sightOf } from './combat';
import { wallEdges } from './surface';

/** Murs qui cachent la vue (arêtes de la grille, cf. surface.ts). Les falaises et murets laissent voir. */
type Walls = Record<string, string> | undefined;
const wallsOf = (b: Battle): Walls => (b.walls?.length ? Object.fromEntries(b.walls.filter((w) => !w.open).flatMap((w) => wallEdges(w).map((e) => [e, w.kind]))) : undefined);
/** Un mur sépare-t-il deux cases voisines (diagonale : les deux chemins en L sont coupés) ? */
function walled(w: Walls, ax: number, ay: number, bx: number, by: number) {
  if (!w) return false;
  // Un mur et une porte fermée cachent la vue ; une herse baissée laisse voir.
  const v = (x: number, y: number, sx: number) => /^(mur|porte)$/.test(w[`v${sx > 0 ? x + 1 : x},${y}`] ?? '');
  const h = (x: number, y: number, sy: number) => /^(mur|porte)$/.test(w[`h${x},${sy > 0 ? y + 1 : y}`] ?? '');
  const dx = Math.sign(bx - ax), dy = Math.sign(by - ay);
  if (dx && !dy) return v(ax, ay, dx);
  if (dy && !dx) return h(ax, ay, dy);
  if (!dx && !dy) return false;
  return (v(ax, ay, dx) || h(ax + dx, ay, dy)) && (h(ax, ay, dy) || v(ax, ay + dy, dx));
}

const opaque = (grid: string | undefined, cols: number, x: number, y: number) => {
  const k = cellKind(grid, cols, x, y);
  return k === '#' || k === 'I';
};

/** La ligne entre les centres de deux cases traverse-t-elle une case opaque (les extrémités exclues) ? */
function clear(grid: string | undefined, cols: number, ax: number, ay: number, bx: number, by: number, w?: Walls) {
  const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 4;
  let px = ax, py = ay;
  for (let i = 1; i <= steps; i++) {
    const x = Math.floor(ax + 0.5 + ((bx - ax) * i) / steps), y = Math.floor(ay + 0.5 + ((by - ay) * i) / steps);
    if ((x !== px || y !== py) && walled(w, px, py, x, y)) return false;
    px = x; py = y;
    if ((x === ax && y === ay) || (x === bx && y === by)) continue;
    if (opaque(grid, cols, x, y)) return false;
  }
  return true;
}

/** Cases vues par un jeton. */
export function seenBy(b: Battle, grid: string | undefined, t: BattleToken, range = sightOf(t), w: Walls = wallsOf(b)): number[] {
  const out: number[] = [];
  for (let y = Math.max(0, t.y - range); y <= Math.min(b.rows - 1, t.y + t.size - 1 + range); y++) {
    for (let x = Math.max(0, t.x - range); x <= Math.min(b.cols - 1, t.x + t.size - 1 + range); x++) {
      const dx = x < t.x ? t.x - x : x > t.x + t.size - 1 ? x - (t.x + t.size - 1) : 0;
      const dy = y < t.y ? t.y - y : y > t.y + t.size - 1 ? y - (t.y + t.size - 1) : 0;
      if (Math.hypot(dx, dy) > range + 0.5) continue;
      if (dx === 0 && dy === 0) { out.push(y * b.cols + x); continue; }
      const ox = Math.min(Math.max(x, t.x), t.x + t.size - 1), oy = Math.min(Math.max(y, t.y), t.y + t.size - 1);
      if (clear(grid, b.cols, ox, oy, x, y, w)) out.push(y * b.cols + x);
    }
  }
  return out;
}

/** Cases vues par le groupe (héros conscients). */
export function partyVision(b: Battle, grid: string | undefined): Set<number> {
  const seen = new Set<number>();
  const w = wallsOf(b);
  for (const t of b.tokens) if (t.kind === 'pc' && !t.unplaced && !(t.hp !== undefined && t.hp <= 0)) for (const c of seenBy(b, grid, t, sightOf(t), w)) seen.add(c);
  return seen;
}

/** Un jeton est-il dans le champ de vision ? (une de ses cases suffit) */
export const inSight = (b: Battle, seen: Set<number>, t: Pick<BattleToken, 'x' | 'y' | 'size'>) => {
  for (let dy = 0; dy < t.size; dy++) for (let dx = 0; dx < t.size; dx++) if (seen.has((t.y + dy) * b.cols + t.x + dx)) return true;
  return false;
};
