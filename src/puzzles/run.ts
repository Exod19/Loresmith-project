/**
 * Une énigme jouée sur la carte de combat : on la lance depuis un verrou (porte, herse, coffre…), on applique les
 * actions des joueurs et du MJ, et une fois résolue, le verrou cède (la porte s'ouvre).
 */
import type { Battle, PuzzleRun } from '../maps/mapStore';
import { createState, dispatchPuzzle, publicProjection } from './engine';
import type { Clue, Puzzle, PuzzleAction, PublicPuzzle } from './types';

export type LockTarget = { kind: 'wall' | 'object'; id: string };

/** Le verrou d'une porte ou d'un objet du plateau. */
export function lockOf(b: Battle, on: LockTarget) {
  return on.kind === 'wall' ? b.walls?.find((w) => w.id === on.id)?.lock : b.objects?.find((o) => o.id === on.id)?.lock;
}

/** Pose, change ou retire (null) le verrou d'une porte ou d'un objet. */
export function withLock(b: Battle, on: LockTarget, puzzleId: string | null): Partial<Battle> {
  const lock = puzzleId ? { puzzleId } : undefined;
  if (on.kind === 'wall') return { walls: (b.walls ?? []).map((w) => (w.id === on.id ? { ...w, lock, ...(lock ? { open: false } : {}) } : w)) };
  return { objects: (b.objects ?? []).map((o) => (o.id === on.id ? { ...o, lock } : o)) };
}

/** Lance (ou reprend) l'énigme d'un verrou. Une énigme déjà commencée sur ce verrou reprend où elle en était. */
export function startRun(b: Battle, on: LockTarget, puzzle: Puzzle): PuzzleRun {
  const cur = b.puzzle;
  if (cur && cur.on.kind === on.kind && cur.on.id === on.id && cur.puzzleId === puzzle.id) return cur;
  return { on, puzzleId: puzzle.id, state: createState(puzzle), shown: false };
}

/**
 * Applique une action à l'énigme en cours. Si elle est résolue, le verrou cède : la porte ou la herse s'ouvre, l'objet
 * est déverrouillé. Rend les changements du plateau, ou une erreur lisible (l'état ne change pas).
 */
export function act(b: Battle, puzzle: Puzzle, action: PuzzleAction, role: 'player' | 'gm'): { patch?: Partial<Battle>; error?: string } {
  const run = b.puzzle;
  if (!run || run.puzzleId !== puzzle.id) return { error: 'Aucune énigme en cours' };
  let state;
  try { state = dispatchPuzzle(puzzle, run.state, action, role); } catch (e) { return { error: (e as Error).message }; }
  const patch: Partial<Battle> = { puzzle: { ...run, state } };
  if (state.status === 'solved' && run.state.status !== 'solved') Object.assign(patch, unlocked(b, run.on));
  return { patch };
}

/** Le verrou cède : marqué résolu, et une porte ou une herse s'ouvre. */
export function unlocked(b: Battle, on: LockTarget): Partial<Battle> {
  if (on.kind === 'wall') return { walls: (b.walls ?? []).map((w) => (w.id === on.id && w.lock ? { ...w, open: true, lock: { ...w.lock, solved: true } } : w)) };
  return { objects: (b.objects ?? []).map((o) => (o.id === on.id && o.lock ? { ...o, lock: { ...o.lock, solved: true } } : o)) };
}

/** Ce que l'écran joueur doit montrer : l'énigme en cours, si le MJ la projette. */
export function shownPuzzle(b: Battle | undefined, puzzles: Puzzle[], clues: Clue[]): PublicPuzzle | undefined {
  const run = b?.puzzle;
  if (!run?.shown) return undefined;
  const p = puzzles.find((x) => x.id === run.puzzleId);
  return p ? publicProjection(p, run.state, clues) : undefined;
}
