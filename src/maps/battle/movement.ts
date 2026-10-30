/**
 * Déplacements sur le plateau de combat (règles D&D 5e), à partir de la classification des cases (surface.ts).
 * Une seule fonction sert à l'aperçu (cases accessibles, trajet, coût) et à la validation : chez le MJ comme chez les joueurs.
 *
 * Règles retenues (configurables ici) :
 * - Une diagonale compte comme une case droite (règle de base du PHB, « 5 pieds par case »).
 * - Terrain difficile : chaque case compte double. Plusieurs sources ne se cumulent pas (règle 5e).
 * - Nage et escalade : chaque case compte double, sauf pour qui a une vitesse de nage ou d'escalade.
 * - Vol : ignore le sol (eau, vide, terrain difficile, obstacles) ; seuls la roche massive, les murs et les cases
 *   bloquées par le MJ l'arrêtent. Le budget est alors la vitesse de vol.
 * - Plus de 5 pieds de dénivelé entre deux cases : il faut escalader.
 * - Pas de diagonale à travers un mur, ni entre deux obstacles qui se touchent par le coin.
 * - Une grande créature : toutes les cases de son empreinte doivent être praticables ; le pas le plus coûteux compte.
 * - Pont : une surface à part. On y monte depuis la rive (pas depuis l'eau) ; dessous, on nage.
 * - On ne traverse pas une créature hostile ; traverser une créature non hostile compte comme terrain difficile.
 *   La case d'arrivée doit être libre (vérifiée à part).
 * - Budget : la vitesse, doublée en cas de Foncer, moins ce qui a déjà été parcouru pendant ce tour.
 */
import { cellLabel, OBJECT_DEF, TERRAIN_DEF, type CellInfo, type SurfaceRules } from './surface';

export type Layer = 'sol' | 'pont';
export interface Mover {
  size: number;
  /** Budget de déplacement, en cases (vitesse de vol pour une créature qui vole). */
  speed: number;
  swim?: boolean; climb?: boolean; fly?: boolean;
  /** Cases occupées par les autres créatures : hostiles (infranchissables) ou non (terrain difficile). */
  occ?: Map<number, 'ennemi' | 'allie'>;
}

/** Créatures sur le plateau, vues par celle qui se déplace : joueurs contre créatures, les autres sont neutres. */
export function occupancy(cols: number, me: { id: string; kind: string }, tokens: { id: string; kind: string; x: number; y: number; size: number; unplaced?: boolean }[]) {
  const occ = new Map<number, 'ennemi' | 'allie'>();
  for (const t of tokens) {
    if (t.id === me.id || t.unplaced) continue;
    const hostile = (me.kind === 'pc' && t.kind === 'monster') || (me.kind === 'monster' && t.kind === 'pc');
    for (let dy = 0; dy < t.size; dy++) for (let dx = 0; dx < t.size; dx++) {
      const i = (t.y + dy) * cols + t.x + dx;
      if (hostile || !occ.has(i)) occ.set(i, hostile ? 'ennemi' : 'allie');
    }
  }
  return occ;
}
export type Spot = { x: number; y: number; layer?: Layer };

const FT_PER_M = 3.28084;
/** Vitesses lues dans une fiche (« 9 m, nage 9 m, vol 18 m, escalade 6 m »), en cases de 5 pieds. */
export function speedsOf(text: string | undefined) {
  const cells = (m: string) => Math.round((parseFloat(m.replace(',', '.')) * FT_PER_M) / 5);
  const t = text ?? '';
  const walk = /^\s*([\d,]+)\s*m/.exec(t);
  const swim = /nage\s+([\d,]+)\s*m/i.exec(t), fly = /vol\s+([\d,]+)\s*m/i.exec(t), climb = /escalade\s+([\d,]+)\s*m/i.exec(t);
  return { walk: walk ? cells(walk[1]) : undefined, swim: swim ? cells(swim[1]) : undefined, fly: fly ? cells(fly[1]) : undefined, climb: climb ? cells(climb[1]) : undefined };
}

/** Capacités d'un jeton : vitesses de sa fiche, et modes accordés par le MJ (sort de vol, anneau de nage…). */
export function moverOf(t: { size: number; move?: number; modes?: { vol?: boolean; nage?: boolean; escalade?: boolean } }, speedText?: string, fallback = 6): Mover {
  const s = speedsOf(speedText);
  const walk = t.move ?? s.walk ?? fallback;
  const fly = t.modes?.vol ?? !!s.fly;
  return {
    size: t.size, speed: fly ? Math.max(walk, s.fly ?? walk) : walk,
    swim: t.modes?.nage ?? !!s.swim, climb: t.modes?.escalade ?? !!s.climb, fly,
  };
}

type Enter = { cost: number; tags: string[] } | { blocked: string };

/** Entrer dans une case (sur le sol ou sur un pont) : coût et nature du pas, ou la raison du refus. */
export function enterCell(c: CellInfo | undefined, layer: Layer, m: Mover): Enter {
  if (!c) return { blocked: 'Hors du plateau' };
  if (layer === 'pont') return c.deck ? { cost: 1, tags: [] } : { blocked: 'Pas de pont ici' };
  if (c.rule === 'bloquee') return { blocked: 'Case bloquée par le MJ' };
  if (c.rule === 'normal') return { cost: 1, tags: [] };
  const d = TERRAIN_DEF[c.t];
  if (d.mode === 'bloque') return { blocked: `${d.label} : infranchissable` };
  if (m.fly) return { cost: 1, tags: ['vol'] };
  if (c.rule === 'difficile') return { cost: 2, tags: ['difficile'] };
  if (c.obs?.c === 'bloquant') return { blocked: `${OBJECT_DEF[c.obs.kind].label} : infranchissable` };
  if (d.mode === 'vide') return { blocked: `${d.label} : il faut voler` };
  const tags: string[] = [];
  let cost = 1;
  if (d.mode === 'nage') { cost = m.swim ? 1 : 2; tags.push('nage'); }
  if (d.mode === 'escalade') { cost = m.climb ? 1 : 2; tags.push('escalade'); }
  if (d.difficult || c.obs?.c === 'partiel') { cost = Math.max(cost, 2); tags.push('difficile'); }
  if (d.slippery) tags.push('glissant');
  if (d.danger) tags.push('danger');
  return { cost, tags };
}

/** Petite pénalité pour un pas dangereux : le trajet évite la lave quand un autre chemin coûte autant. */
const DANGER_PENALTY = 0.01;
/** Infime surcoût d'une diagonale, pour préférer un trajet droit à coût égal (n'influe jamais sur le coût affiché). */
const DIAGONAL_TIE = 0.001;

interface Step { cost: number; tags: string[] }

/** Passage d'une case à sa voisine (murs, coins, dénivelé), pour une case de l'empreinte. */
function crossing(r: SurfaceRules, m: Mover, x: number, y: number, dx: number, dy: number, layer: Layer): Step | null {
  const wall = (k: string) => r.walls[k];
  const edgeX = (cx: number, cy: number, sx: number) => wall(`v${sx > 0 ? cx + 1 : cx},${cy}`); // entre (cx,cy) et (cx+sx,cy)
  const edgeY = (cx: number, cy: number, sy: number) => wall(`h${cx},${sy > 0 ? cy + 1 : cy}`); // entre (cx,cy) et (cx,cy+sy)
  const tags: string[] = [];
  let cost = 0;
  const wallCost = (k: string | undefined) => {
    if (!k) return true;
    if (k === 'mur') return false;
    if (k === 'falaise') { if (!m.fly) { cost = Math.max(cost, m.climb ? 1 : 2); tags.push('escalade'); } return true; }
    if (!m.fly) { cost = Math.max(cost, 2); tags.push('difficile'); } // muret
    return true;
  };
  if (dx && dy) {
    // Diagonale : il faut qu'un des deux chemins en L soit libre (case intermédiaire praticable, aucune arête de mur).
    const free = (ix: number, iy: number, e1: string | undefined, e2: string | undefined) => {
      if (e1 || e2) return false;
      return !('blocked' in enterCell(r.cells[iy * r.cols + ix], layer === 'pont' && r.cells[iy * r.cols + ix]?.deck ? 'pont' : 'sol', m));
    };
    const viaX = x + dx >= 0 && x + dx < r.cols && free(x + dx, y, edgeX(x, y, dx), edgeY(x + dx, y, dy));
    const viaY = y + dy >= 0 && y + dy < r.rows && free(x, y + dy, edgeY(x, y, dy), edgeX(x, y + dy, dx));
    if (!viaX && !viaY) return null;
  } else if (dx) { if (!wallCost(edgeX(x, y, dx))) return null; } else if (!wallCost(edgeY(x, y, dy))) return null;
  if (layer === 'sol' && !m.fly) {
    const a = r.cells[y * r.cols + x], b = r.cells[(y + dy) * r.cols + x + dx];
    if (a && b && Math.abs(a.elev - b.elev) > 5) { cost = Math.max(cost, m.climb ? 1 : 2); tags.push('escalade'); }
  }
  return { cost, tags };
}

/** Un pas de l'ancre (x, y, couche) vers (x+dx, y+dy, couche suivante), pour toute l'empreinte. */
function step(r: SurfaceRules, m: Mover, x: number, y: number, la: Layer, dx: number, dy: number, lb: Layer): Step | null {
  const nx = x + dx, ny = y + dy, s = m.size;
  if (nx < 0 || ny < 0 || nx + s > r.cols || ny + s > r.rows) return null;
  // Monter sur un pont : depuis la rive (ou en volant), jamais depuis l'eau ou le vide.
  if (la === 'sol' && lb === 'pont' && !m.fly) {
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
      const c = r.cells[(y + j) * r.cols + x + i];
      const mode = c?.rule ? 'marche' : TERRAIN_DEF[c?.t ?? 'sol'].mode;
      if (!c?.deck && mode !== 'marche') return null;
    }
  }
  let cost = 0;
  const tags: string[] = [];
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    const cx = nx + i, cy = ny + j;
    const wasIn = la === lb && cx >= x && cx < x + s && cy >= y && cy < y + s;
    if (!wasIn) {
      const e = enterCell(r.cells[cy * r.cols + cx], lb, m);
      if ('blocked' in e) return null;
      cost = Math.max(cost, e.cost);
      tags.push(...e.tags);
      const who = m.occ?.get(cy * r.cols + cx);
      if (who === 'ennemi') return null;
      if (who === 'allie') { cost = Math.max(cost, 2); tags.push('allie'); }
    }
  }
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    const c = crossing(r, m, x + i, y + j, dx, dy, la === 'pont' && lb === 'pont' ? 'pont' : 'sol');
    if (!c) return null;
    cost = Math.max(cost, c.cost);
    tags.push(...c.tags);
  }
  // Départage des trajets de même coût : les pas droits d'abord (pas de zigzag), le danger évité.
  return { cost: Math.max(1, cost) + (tags.includes('danger') ? DANGER_PENALTY : 0) + (dx && dy ? DIAGONAL_TIE : 0), tags };
}

export interface MoveField { r: SurfaceRules; m: Mover; dist: Float64Array; prev: Int32Array; tags: string[][] }

/** Coût minimal depuis une case vers toutes les autres (sol et pont), jusqu'à `limit` cases. */
export function moveField(r: SurfaceRules, m: Mover, from: Spot, limit = Infinity): MoveField {
  const n = r.cols * r.rows * 2;
  const dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1);
  const tags: string[][] = new Array(n);
  const start = (from.y * r.cols + from.x) * 2 + (from.layer === 'pont' ? 1 : 0);
  dist[start] = 0;
  // Tas binaire minimal (état, coût).
  const heap: [number, number][] = [[0, start]];
  const push = (e: [number, number]) => { heap.push(e); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let k = i; if (a < heap.length && heap[a][0] < heap[k][0]) k = a; if (b < heap.length && heap[b][0] < heap[k][0]) k = b; if (k === i) break; [heap[k], heap[i]] = [heap[i], heap[k]]; i = k; } } return top; };
  while (heap.length) {
    const [d, u] = pop();
    if (d > dist[u] || d > limit) continue;
    const cell = u >> 1, la: Layer = u & 1 ? 'pont' : 'sol', x = cell % r.cols, y = Math.floor(cell / r.cols);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      for (const lb of ['sol', 'pont'] as const) {
        const st = step(r, m, x, y, la, dx, dy, lb);
        if (!st) continue;
        const v = ((y + dy) * r.cols + x + dx) * 2 + (lb === 'pont' ? 1 : 0);
        const nd = d + st.cost;
        if (nd < dist[v] - 1e-9) { dist[v] = nd; prev[v] = u; tags[v] = st.tags; push([nd, v]); }
      }
    }
  }
  return { r, m, dist, prev, tags };
}

/** Coût affiché (les petites pénalités de danger ne comptent pas). */
const shown = (d: number) => Math.round(d);

/** Cases d'arrivée accessibles avec le budget (coin haut-gauche de l'empreinte). */
export function reachable(f: MoveField, budget = f.m.speed): number[] {
  const out: number[] = [];
  for (let c = 0; c < f.r.cols * f.r.rows; c++) if (Math.min(f.dist[c * 2], f.dist[c * 2 + 1]) <= budget + 0.4) out.push(c);
  return out;
}

/** Cases accessibles, et celles où l'on entre par un pas qui coûte plus (terrain difficile, nage, escalade, allié). */
export function reachDetail(f: MoveField, budget = f.m.speed): { cells: number[]; costly: number[] } {
  const cells: number[] = [], costly: number[] = [];
  for (let c = 0; c < f.r.cols * f.r.rows; c++) {
    const s0 = f.dist[c * 2], s1 = f.dist[c * 2 + 1];
    const st = s1 < s0 ? c * 2 + 1 : c * 2;
    if (Math.min(s0, s1) > budget + 0.4) continue;
    cells.push(c);
    const p = f.prev[st];
    if (p >= 0 && f.dist[st] - f.dist[p] > 1.5) costly.push(c);
  }
  return { cells, costly };
}

export interface MovePlan {
  /** Un chemin existe. */
  possible: boolean;
  /** …et il tient dans le budget. */
  ok: boolean;
  cost: number;
  steps: Spot[];
  layer: Layer;
  /** Terrain d'arrivée : « Eau profonde — nage ». */
  dest: string;
  /** Ce que traverse le trajet (nage, escalade, terrain difficile, danger…). */
  notes: string[];
  /** Pourquoi c'est impossible. */
  reason?: string;
}

const NOTE: Record<string, string> = { nage: 'nage', escalade: 'escalade', difficile: 'terrain difficile', glissant: 'sol glissant', danger: 'zone dangereuse', vol: 'en vol', allie: 'à travers un allié' };

/** Le trajet le moins coûteux vers une case, avec ce qu'il traverse : le même calcul pour l'aperçu et la validation. */
export function planMove(r: SurfaceRules, m: Mover, from: Spot, to: { x: number; y: number }, budget = m.speed, field?: MoveField): MovePlan {
  const f = field ?? moveField(r, m, from);
  const cell = to.y * r.cols + to.x;
  const ds = f.dist[cell * 2], dp = f.dist[cell * 2 + 1];
  const layer: Layer = dp < ds ? 'pont' : 'sol';
  const best = Math.min(ds, dp);
  const c = r.cells[cell];
  const dest = c ? cellLabel(c, layer) : 'Hors du plateau';
  if (!Number.isFinite(best)) {
    // Pourquoi : la case elle-même, ou le chemin (murs, obstacles).
    const here = enterCell(c, c?.deck ? 'pont' : 'sol', m);
    let reason = 'blocked' in here ? here.blocked : 'Aucun passage : murs, obstacles ou créatures hostiles en travers';
    for (let j = 0; j < m.size; j++) for (let i = 0; i < m.size; i++) if (m.occ?.get((to.y + j) * r.cols + to.x + i) === 'ennemi') reason = 'Une créature hostile occupe la place';
    if (!('blocked' in here) && m.size > 1) {
      for (let j = 0; j < m.size; j++) for (let i = 0; i < m.size; i++) {
        const q = r.cells[(to.y + j) * r.cols + to.x + i];
        const e = enterCell(q, q?.deck ? 'pont' : 'sol', m);
        if ('blocked' in e) reason = `Empreinte trop large : ${e.blocked.charAt(0).toLowerCase()}${e.blocked.slice(1)}`;
      }
    }
    return { possible: false, ok: false, cost: Infinity, steps: [], layer, dest, notes: [], reason };
  }
  const steps: Spot[] = [];
  const seen = new Set<string>();
  for (let s = cell * 2 + (layer === 'pont' ? 1 : 0); s >= 0; s = f.prev[s]) {
    const k = s >> 1;
    steps.unshift({ x: k % r.cols, y: Math.floor(k / r.cols), layer: s & 1 ? 'pont' : 'sol' });
    for (const t of f.tags[s] ?? []) seen.add(t);
  }
  const cost = shown(best);
  const ok = cost <= budget;
  const notes = [...seen].map((t) => NOTE[t]).filter(Boolean);
  return { possible: true, ok, cost, steps, layer, dest, notes, reason: ok ? undefined : `Trop loin : ${cost} cases pour ${budget} disponibles` };
}
