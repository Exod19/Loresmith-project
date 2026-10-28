/**
 * Brouillard de guerre : les cases que voient les héros (portée de vue et ligne de vue), et celles déjà explorées.
 * Une case de roche ou un pilier se voit, mais cache ce qui est derrière. Un gouffre ou de l'eau ne cachent rien.
 */
import type { Battle, BattleToken } from '../mapStore';
import { cellKind } from './terrain';
import { sightOf } from './combat';

const opaque = (grid: string | undefined, cols: number, x: number, y: number) => {
  const k = cellKind(grid, cols, x, y);
  return k === '#' || k === 'I';
};

/** La ligne entre les centres de deux cases traverse-t-elle une case opaque (les extrémités exclues) ? */
function clear(grid: string | undefined, cols: number, ax: number, ay: number, bx: number, by: number) {
  const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 4;
  for (let i = 1; i < steps; i++) {
    const x = Math.floor(ax + 0.5 + ((bx - ax) * i) / steps), y = Math.floor(ay + 0.5 + ((by - ay) * i) / steps);
    if ((x === ax && y === ay) || (x === bx && y === by)) continue;
    if (opaque(grid, cols, x, y)) return false;
  }
  return true;
}

/** Cases vues par un jeton. */
export function seenBy(b: Battle, grid: string | undefined, t: BattleToken, range = sightOf(t)): number[] {
  const out: number[] = [];
  for (let y = Math.max(0, t.y - range); y <= Math.min(b.rows - 1, t.y + t.size - 1 + range); y++) {
    for (let x = Math.max(0, t.x - range); x <= Math.min(b.cols - 1, t.x + t.size - 1 + range); x++) {
      const dx = x < t.x ? t.x - x : x > t.x + t.size - 1 ? x - (t.x + t.size - 1) : 0;
      const dy = y < t.y ? t.y - y : y > t.y + t.size - 1 ? y - (t.y + t.size - 1) : 0;
      if (Math.hypot(dx, dy) > range + 0.5) continue;
      if (dx === 0 && dy === 0) { out.push(y * b.cols + x); continue; }
      const ox = Math.min(Math.max(x, t.x), t.x + t.size - 1), oy = Math.min(Math.max(y, t.y), t.y + t.size - 1);
      if (clear(grid, b.cols, ox, oy, x, y)) out.push(y * b.cols + x);
    }
  }
  return out;
}

/** Cases vues par le groupe (héros conscients). */
export function partyVision(b: Battle, grid: string | undefined): Set<number> {
  const seen = new Set<number>();
  for (const t of b.tokens) if (t.kind === 'pc' && !(t.hp !== undefined && t.hp <= 0)) for (const c of seenBy(b, grid, t)) seen.add(c);
  return seen;
}

/** Un jeton est-il dans le champ de vision ? (une de ses cases suffit) */
export const inSight = (b: Battle, seen: Set<number>, t: Pick<BattleToken, 'x' | 'y' | 'size'>) => {
  for (let dy = 0; dy < t.size; dy++) for (let dx = 0; dx < t.size; dx++) if (seen.has((t.y + dy) * b.cols + t.x + dx)) return true;
  return false;
};
