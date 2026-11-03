/**
 * Moteur des énigmes déductives, porté du kit (deduction-core.mjs, v2). Il tourne dans la console du MJ, qui fait
 * autorité : l'écran joueur n'envoie que des actions et ne reçoit que `publicProjection` (aucune solution).
 * Les règles de chaque mécanisme sont causales et constantes : la réponse se déduit, elle ne se devine pas.
 */
import type { Clue, Effect, Mechanic, Puzzle, PuzzleAction, PuzzleState, PublicPuzzle } from './types';

export const MECHANICS: { id: Mechanic; label: string }[] = [
  { id: 'braziers', label: 'Brasiers et leviers' },
  { id: 'heavy-stone', label: 'Galets et balance' },
  { id: 'jugs', label: 'Jarres et volumes' },
  { id: 'mirrors', label: 'Miroirs et rayon' },
  { id: 'statues', label: 'Statues et vérité' },
  { id: 'prime-tiles', label: 'Dalles numérotées' },
  { id: 'chronology', label: 'Fresques à ordonner' },
  { id: 'glyphs', label: 'Glyphes à composer' },
  { id: 'cycles', label: 'Cycles et marées' },
  { id: 'equal-balance', label: 'Offrandes en équilibre' },
  { id: 'gears', label: 'Engrenages' },
  { id: 'light-network', label: 'Réseau de lueurs' },
];
export const MECHANIC_LABEL = Object.fromEntries(MECHANICS.map((m) => [m.id, m.label])) as Record<Mechanic, string>;

const must = (condition: unknown, msg: string) => { if (!condition) throw new Error(msg); };
const integer = (v: unknown): v is number => Number.isInteger(v);
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));
const isPrime = (n: number) => { if (!integer(n) || n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
export { isPrime };

export function initialDraft(p: Puzzle): any {
  const c = p.engine.publicConfig;
  switch (p.mechanic) {
    case 'braziers': return { levers: Object.fromEntries(c.leverIds.map((x: string) => [x, false])), warmed: Object.fromEntries(c.leverIds.map((x: string) => [x, false])), inspected: false, observations: null, guess: Object.fromEntries(c.brazierIds.map((x: string) => [x, ''])) };
    case 'heavy-stone': return { placements: Object.fromEntries(c.stoneIds.map((x: string) => [x, 'reserve'])), weighings: [], guess: '' };
    case 'jugs': return { amounts: clone(c.initial), moves: 0 };
    case 'statues': return { guess: '' };
    case 'mirrors': return { orientations: clone(c.initial) };
    case 'prime-tiles': return { path: [clone(c.start)], mistakes: 0 };
    case 'chronology': return { order: clone(c.initialOrder) };
    case 'glyphs': return { pair: [c.firstGlyphs[0], c.secondGlyphs[0]] };
    case 'cycles': return { tick: c.currentTick };
    case 'equal-balance': return { placements: Array(c.weights.length).fill('reserve') };
    case 'gears': return { installed: Object.fromEntries(c.optionalGearIds.map((x: string) => [x, false])) };
    case 'light-network': return { lights: clone(c.initial), presses: 0 };
    default: throw new Error('Mécanisme inconnu');
  }
}

export function createState(p: Puzzle): PuzzleState {
  must(MECHANICS.some((m) => m.id === p.mechanic), 'Mécanisme inconnu');
  return { puzzleId: p.id, revision: 0, status: 'active', draft: initialDraft(p), attempts: 0, hintLevel: 0, sceneInspected: false, feedback: null, history: [], effects: [] };
}

/** Trajet du rayon dans la grille des miroirs : entre à gauche sur `sourceRow`, sort (ou non) à droite sur `targetRow`. */
export function traceMirrors(c: { grid: number; sourceRow: number; targetRow: number; mirrors: [number, number][] }, orientations: string[]) {
  const points: { x: number; y: number }[] = [];
  let x = -1, y = c.sourceRow, dx = 1, dy = 0;
  const visited = new Set<string>();
  for (let step = 0; step < c.grid * c.grid * 6; step++) {
    x += dx; y += dy;
    points.push({ x, y });
    if (x < 0 || y < 0 || x >= c.grid || y >= c.grid) return { hit: x === c.grid && y === c.targetRow, points, loop: false };
    const index = c.mirrors.findIndex((pos) => pos[0] === x && pos[1] === y);
    if (index !== -1) {
      if (orientations[index] === '/') { const prev = dx; dx = -dy; dy = -prev; } else { const prev = dx; dx = dy; dy = prev; }
    }
    const sig = `${x},${y},${dx},${dy}`;
    if (visited.has(sig)) return { hit: false, points, loop: true };
    visited.add(sig);
  }
  return { hit: false, points, loop: true };
}

export function evaluatePuzzle(p: Puzzle, draft: any): boolean {
  const c = p.engine.publicConfig, s = p.engine.serverConfig ?? {};
  switch (p.mechanic) {
    case 'braziers': return !!draft.inspected && c.brazierIds.every((n: string, i: number) => draft.guess[n] === s.brazierToLever[i]) && new Set(Object.values(draft.guess)).size === c.brazierIds.length;
    case 'heavy-stone': return draft.weighings.length <= c.maxWeighings && draft.guess === s.heavyStoneId;
    case 'jugs': return draft.amounts.includes(c.target);
    case 'statues': return draft.guess === s.correctChest;
    case 'mirrors': return traceMirrors(c, draft.orientations).hit;
    case 'prime-tiles': return equal(draft.path.at(-1), c.end);
    case 'chronology': return equal(draft.order, s.orderedEvents);
    case 'glyphs': return equal(draft.pair, s.correct);
    case 'cycles': {
      const periods: number[] = c.periods, tick: number = draft.tick;
      return tick > c.currentTick && periods.every((x) => tick % x === 0)
        && !Array.from({ length: tick - c.currentTick - 1 }, (_, i) => c.currentTick + i + 1).some((k) => periods.every((x) => k % x === 0));
    }
    case 'equal-balance': {
      const placed: string[] = draft.placements;
      const sum = (side: string) => c.weights.reduce((a: number, x: number, i: number) => a + (placed[i] === side ? x : 0), 0);
      return placed.every((x) => x !== 'reserve') && sum('left') === c.targetPerSide && sum('right') === c.targetPerSide;
    }
    case 'gears': return Object.values(draft.installed).filter(Boolean).length % 2 === 1;
    case 'light-network': return equal(draft.lights, c.target);
    default: return false;
  }
}

/**
 * Applique une action et rend le nouvel état (l'ancien n'est jamais modifié). Les actions `gm.*` sont réservées au MJ.
 * Lève une erreur (message en français) si l'action est impossible : l'état reste alors inchangé.
 */
export function dispatchPuzzle(p: Puzzle, state: PuzzleState, action: PuzzleAction, role: 'player' | 'gm' = 'player'): PuzzleState {
  must(state.puzzleId === p.id, 'Mauvaise énigme');
  must(action && typeof action.type === 'string', 'Action invalide');
  must(!integer(action.expectedRevision) || action.expectedRevision === state.revision, 'Le mécanisme a changé entre-temps');
  const next = clone(state), d = next.draft, c = p.engine.publicConfig, s = p.engine.serverConfig ?? {};
  if (action.type.startsWith('gm.')) {
    must(role === 'gm', 'Action réservée au MJ');
    if (action.type === 'gm.reset') {
      const reset = createState(p);
      reset.revision = state.revision + 1;
      reset.history = [{ revision: reset.revision, type: 'gm.reset' }];
      return reset;
    }
    if (action.type === 'gm.forceSuccess') { next.status = 'solved'; next.feedback = { kind: 'success', message: 'Le mécanisme cède.' }; }
    else if (action.type === 'gm.revealHint') { must(next.hintLevel < p.gm.nonSpoilerHints.length, 'Tous les indices sont déjà donnés'); next.hintLevel++; }
    else if (action.type === 'gm.pause') next.status = 'paused';
    else if (action.type === 'gm.resume') { must(next.status === 'paused', 'L’épreuve n’est pas suspendue'); next.status = 'active'; }
    else if (action.type === 'gm.handleEffect') { const e = next.effects[Number(action.index)]; must(e, 'Conséquence inconnue'); e.handled = true; }
    else throw new Error('Action MJ inconnue');
    next.revision++;
    return next;
  }
  must(next.status === 'active', next.status === 'solved' ? 'L’épreuve est résolue' : 'Le MJ a suspendu l’épreuve');
  if (action.type === 'scene.inspect') {
    next.sceneInspected = true;
    next.revision++;
    next.history.push({ revision: next.revision, type: action.type });
    return next;
  }
  if (action.type === 'submit') {
    next.attempts++;
    const solved = evaluatePuzzle(p, d);
    if (solved) next.status = 'solved';
    next.feedback = { kind: solved ? 'success' : 'failure', message: solved ? 'Le mécanisme répond : le verrou cède.' : 'Le dispositif demeure clos.' };
    if (!solved && p.gm.failureForward.threshold > 0 && next.attempts % p.gm.failureForward.threshold === 0) {
      next.effects.push({ kind: 'gm-resolution', text: p.gm.failureForward.onWrongAnswer, handled: false });
    }
  } else {
    next.feedback = null;
    switch (p.mechanic) {
      case 'braziers':
        if (action.type === 'braziers.toggle') {
          must(!d.inspected, 'Les leviers sont figés depuis l’inspection');
          must(c.leverIds.includes(action.id), 'Levier inconnu');
          d.levers[action.id as string] = !d.levers[action.id as string];
          if (d.levers[action.id as string]) d.warmed[action.id as string] = true;
        } else if (action.type === 'braziers.inspect') {
          must(!d.inspected, 'La grille ne s’ouvre qu’une fois');
          d.inspected = true;
          d.observations = Object.fromEntries(c.brazierIds.map((b: string, i: number) => {
            const lever = s.brazierToLever[i];
            return [b, d.levers[lever] ? 'flamme' : d.warmed[lever] ? 'chaud' : 'froid'];
          }));
        } else if (action.type === 'braziers.guess') {
          must(d.inspected, 'Il faut d’abord ouvrir la grille');
          must(c.brazierIds.includes(action.brazier), 'Brasier inconnu');
          must(action.lever === '' || c.leverIds.includes(action.lever), 'Levier inconnu');
          d.guess[action.brazier as string] = action.lever;
        } else throw new Error('Action inconnue');
        break;
      case 'heavy-stone':
        if (action.type === 'heavy.move') {
          must(c.stoneIds.includes(action.id), 'Galet inconnu');
          must(['reserve', 'left', 'right'].includes(action.side as string), 'Plateau inconnu');
          d.placements[action.id as string] = action.side;
        } else if (action.type === 'heavy.weigh') {
          must(d.weighings.length < c.maxWeighings, 'La balance est verrouillée');
          const left = c.stoneIds.filter((x: string) => d.placements[x] === 'left'), right = c.stoneIds.filter((x: string) => d.placements[x] === 'right');
          must(left.length > 0 && left.length === right.length, 'Placer autant de galets (au moins un) sur chaque plateau');
          const result = left.includes(s.heavyStoneId) ? 'left' : right.includes(s.heavyStoneId) ? 'right' : 'equal';
          d.weighings.push({ left, right, result });
          d.placements = Object.fromEntries(c.stoneIds.map((x: string) => [x, 'reserve']));
        } else if (action.type === 'heavy.guess') {
          must(c.stoneIds.includes(action.id), 'Galet inconnu');
          d.guess = action.id;
        } else throw new Error('Action inconnue');
        break;
      case 'jugs': {
        must(['jugs.fill', 'jugs.empty', 'jugs.pour'].includes(action.type), 'Action inconnue');
        const i = action.i as number, j = action.j as number;
        must([0, 1].includes(i), 'Jarre inconnue');
        if (action.type === 'jugs.fill') d.amounts[i] = c.capacities[i];
        if (action.type === 'jugs.empty') d.amounts[i] = 0;
        if (action.type === 'jugs.pour') {
          must([0, 1].includes(j) && i !== j, 'Destination invalide');
          const volume = Math.min(d.amounts[i], c.capacities[j] - d.amounts[j]);
          d.amounts[i] -= volume; d.amounts[j] += volume;
        }
        d.moves++;
        break;
      }
      case 'statues':
        must(action.type === 'statues.choose' && c.coffrets.includes(action.value), 'Coffret inconnu');
        d.guess = action.value;
        break;
      case 'mirrors':
        must(action.type === 'mirrors.rotate' && integer(action.index) && action.index >= 0 && action.index < c.mirrors.length, 'Miroir inconnu');
        d.orientations[action.index as number] = d.orientations[action.index as number] === '/' ? '\\' : '/';
        break;
      case 'prime-tiles': {
        must(action.type === 'prime.step' && integer(action.x) && integer(action.y), 'Mouvement invalide');
        const [x, y] = d.path.at(-1);
        must(Math.abs(x - (action.x as number)) + Math.abs(y - (action.y as number)) === 1, 'Seulement vers une dalle voisine (pas en diagonale)');
        must((action.x as number) >= 0 && (action.x as number) < c.grid[0].length && (action.y as number) >= 0 && (action.y as number) < c.grid.length, 'Hors de la passerelle');
        if (isPrime(c.grid[action.y as number][action.x as number])) d.path.push([action.x, action.y]);
        else { d.mistakes++; next.effects.push({ kind: 'warning', text: 'La dalle tremble sous le pied et se dérobe : retour en arrière.', handled: false }); }
        break;
      }
      case 'chronology':
        must(action.type === 'chronology.reorder' && Array.isArray(action.order) && action.order.length === c.events.length, 'Ordre invalide');
        must(new Set(action.order as string[]).size === c.events.length && (action.order as string[]).every((x) => c.events.includes(x)), 'Fresque inconnue');
        d.order = clone(action.order);
        break;
      case 'glyphs':
        must(action.type === 'glyphs.choose' && [0, 1].includes(action.slot as number), 'Emplacement invalide');
        must((action.slot === 0 ? c.firstGlyphs : c.secondGlyphs).includes(action.glyph), 'Glyphe inconnu');
        d.pair[action.slot as number] = action.glyph;
        break;
      case 'cycles':
        must(action.type === 'cycles.set' && integer(action.tick) && action.tick > c.currentTick && action.tick <= c.maxTick, 'Pulsation impossible');
        d.tick = action.tick;
        break;
      case 'equal-balance':
        must(action.type === 'equal.move' && integer(action.index) && action.index >= 0 && action.index < c.weights.length, 'Poids inconnu');
        must(['reserve', 'left', 'right'].includes(action.side as string), 'Plateau inconnu');
        d.placements[action.index as number] = action.side;
        break;
      case 'gears':
        must(action.type === 'gears.toggle' && c.optionalGearIds.includes(action.id), 'Roue inconnue');
        d.installed[action.id as string] = !d.installed[action.id as string];
        break;
      case 'light-network':
        must(action.type === 'lights.press' && integer(action.index) && action.index >= 0 && action.index < c.count, 'Pierre inconnue');
        for (const offset of [-1, 0, 1]) { const k = ((action.index as number) + offset + c.count) % c.count; d.lights[k] = !d.lights[k]; }
        d.presses++;
        break;
      default: throw new Error('Mécanisme inconnu');
    }
  }
  next.revision++;
  next.history.push({ revision: next.revision, type: action.type });
  if (next.history.length > 50) next.history = next.history.slice(-50);
  return next;
}

/** Les observations à découvrir en examinant (tout ce qui n'est pas visible d'emblée). */
const initial = (o: { available: string }) => o.available === 'initiale';

/**
 * Vue de l'écran joueur : liste blanche explicite. Ni `serverConfig`, ni `gm`, ni les textes déplacés dans le carnet
 * (le groupe ne les voit que s'il les a ramassés), ni les conséquences réservées au MJ.
 */
export function publicProjection(p: Puzzle, state: PuzzleState, clues: Clue[] = []): PublicPuzzle {
  const pl = p.player;
  return clone({
    id: p.id, title: p.title, mechanic: p.mechanic,
    player: {
      location: pl.location, sceneDescription: pl.sceneDescription, objective: pl.objective,
      observations: pl.observations.filter((o) => initial(o) || state.sceneInspected),
      interactions: pl.interactions, accessibility: pl.accessibility,
      readables: (pl.readables ?? []).filter((r) => !r.clueId).map((r) => ({ source: r.source, text: r.text })),
      canInspectScene: !state.sceneInspected && pl.observations.some((o) => !initial(o)),
    },
    publicConfig: p.engine.publicConfig,
    state: {
      revision: state.revision, status: state.status, draft: state.draft, attempts: state.attempts, feedback: state.feedback,
      hints: p.gm.nonSpoilerHints.slice(0, state.hintLevel).map((h) => h.text),
      effects: state.effects.filter((e: Effect) => e.kind !== 'gm-resolution').map((e) => ({ kind: e.kind, text: e.text })),
    },
    carnet: clues.filter((c) => c.held).map((c) => ({ id: c.id, title: c.title, kind: c.kind, text: c.text, ...(c.image ? { image: c.image } : {}) })),
  });
}
