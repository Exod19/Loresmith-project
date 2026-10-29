/**
 * Sentiers de l'Atlas devenus terrain sur la carte de combat : chaque type de tracé a sa règle (goulot, escalade,
 * courant), un sentier incertain ou périlleux déclenche son épreuve de passage quand on y entre, et une sortie au
 * bord du plateau permet de quitter la carte.
 */
import type { Battle, BattleToken } from '../mapStore';
import type { Note } from './tactics';
import type { LocalElement } from './local';
import { trailProfile } from '../atlas/trails';
import { trailHazard } from '../atlas/hazards';
import { blocksCell } from './terrain';

type Passage = LocalElement & { cells: number[] };

/** Passages praticables du plateau (un secret ne compte qu'une fois découvert). */
export function openPassages(b: Battle): Passage[] {
  const found = new Set(b.local?.discovered ?? []);
  return (b.local?.elements ?? []).filter((e): e is Passage => e.kind === 'passage' && !!e.cells?.length && (!e.secret || found.has(e.id)));
}

const cellsOf = (t: Pick<BattleToken, 'x' | 'y' | 'size'>, cols: number) => {
  const out: number[] = [];
  for (let dy = 0; dy < t.size; dy++) for (let dx = 0; dx < t.size; dx++) out.push((t.y + dy) * cols + t.x + dx);
  return out;
};

/** Le passage sous un jeton (s'il y en a un). */
export function passageUnder(b: Battle, t: Pick<BattleToken, 'x' | 'y' | 'size'>): Passage | undefined {
  const mine = new Set(cellsOf(t, b.cols));
  return openPassages(b).find((p) => p.cells.some((c) => mine.has(c)));
}

/** Règle de terrain d'un type de tracé. */
const RULE: Record<string, { label: string; why: string; tone: Note['tone'] }> = {
  etroit: { label: 'Étroiture : file indienne', why: 'Passage étroit : une seule créature de front. Une créature de taille M ou plus s’y faufile : chaque case compte double, désavantage aux attaques et aux sauvegardes de Dextérité, avantage aux attaques contre elle.', tone: 'malus' },
  boyau: { label: 'Boyau : on rampe', why: 'Boyau bas : on avance à quatre pattes (chaque case compte double). Pas d’arme à deux mains ni d’arme lourde efficace ici.', tone: 'malus' },
  crevasse: { label: 'Crevasse : escalade', why: 'Progresser dans la crevasse demande d’escalader : chaque case compte double, et un test de Force (Athlétisme) DD 12 peut être exigé à chaque tour. Tomber = 1d6 par 3 m.', tone: 'malus' },
  ruisseau: { label: 'Courant : terrain difficile', why: 'Eau courante jusqu’aux genoux : terrain difficile. Une créature à terre ou de taille P peut être emportée (Force DD 10).', tone: 'malus' },
};

/** Cases voisines praticables : peu de voisins = goulot (peu d'ennemis peuvent atteindre celui qui le tient). */
function openNeighbours(b: Battle, grid: string | undefined, t: BattleToken) {
  let n = 0;
  for (let y = t.y - 1; y <= t.y + t.size; y++) for (let x = t.x - 1; x <= t.x + t.size; x++) {
    if (x >= t.x && x < t.x + t.size && y >= t.y && y < t.y + t.size) continue;
    if (x < 0 || y < 0 || x >= b.cols || y >= b.rows || blocksCell(grid, b.cols, x, y)) continue;
    n++;
  }
  return n;
}

/** Ce que le sentier sous le jeton change pour lui (règle du tracé, goulot, sortie au bord). */
export function trailNotes(b: Battle, grid: string | undefined, t: BattleToken): Note[] {
  const notes: Note[] = [];
  const p = passageUnder(b, t);
  if (p) {
    const rule = RULE[p.trace ?? ''];
    if (rule) notes.push({ tone: rule.tone, label: rule.label, why: `${p.title}. ${rule.why}` });
  }
  const free = openNeighbours(b, grid, t);
  if (free <= 2) {
    notes.push({ tone: 'buff', label: `Goulot : au plus ${free} ennemi${free > 1 ? 's' : ''} au contact`, why: `Seulement ${free} case${free > 1 ? 's' : ''} libre${free > 1 ? 's' : ''} autour de ${t.name} : on ne peut l’encercler. Bonne position pour tenir un passage.` });
  }
  const exit = exitAt(b, t);
  if (exit) notes.push({ tone: 'chance', label: `Sortie : ${exit.label}`, why: `${t.name} est au bord du plateau, sur la sortie ${exit.label}. Il peut quitter la carte (fuite, poursuite, renforts).` });
  return notes;
}

/** Entrer dans un sentier : sa règle, et l'épreuve de passage s'il est incertain ou périlleux. */
export function trailMoveNotes(b: Battle, t: BattleToken, to: { x: number; y: number }): Note[] {
  const before = passageUnder(b, t);
  const after = passageUnder(b, { ...t, ...to });
  if (!after || after.id === before?.id) return [];
  const profile = trailProfile({ title: after.title, trace: after.trace });
  const hazard = trailHazard({ title: after.title, trace: after.trace }, profile);
  const notes: Note[] = [];
  if (hazard) {
    notes.push({
      tone: 'alert',
      label: `🎲 Épreuve : ${hazard.check} DD ${hazard.dc}`,
      why: `${t.name} s’engage dans « ${after.title} » (${profile.danger.label.toLowerCase()}). Échec : ${hazard.fail}${hazard.damage ? ` ${hazard.damage} dégâts.` : ''}${hazard.setback ? ` ${hazard.setback}` : ''} Réussite : ${hazard.success}`,
    });
  }
  const rule = RULE[after.trace ?? ''];
  if (rule) notes.push({ tone: 'malus', label: rule.label, why: `${after.title}. ${rule.why}` });
  return notes;
}

export type Exit = { id: string; cell: number; dir: 'n' | 's' | 'e' | 'w'; label: string; known: boolean };

/**
 * Sorties : les passages qui touchent le bord du plateau. `labelOf` donne la destination quand elle est connue
 * (sinon rien : les joueurs ne voient que la flèche).
 */
export function exitsOf(b: Battle, labelOf: (p: Passage) => string | null = () => null): Exit[] {
  const out: Exit[] = [];
  for (const p of openPassages(b)) {
    const edge = p.cells.find((c) => { const x = c % b.cols, y = Math.floor(c / b.cols); return x === 0 || y === 0 || x === b.cols - 1 || y === b.rows - 1; });
    // Deux galeries qui sortent par la même case : une seule flèche.
    if (edge === undefined || out.some((e) => e.cell === edge)) continue;
    const x = edge % b.cols, y = Math.floor(edge / b.cols);
    const dir = y === 0 ? 'n' : y === b.rows - 1 ? 's' : x === 0 ? 'w' : 'e';
    const label = labelOf(p);
    out.push({ id: p.id, cell: edge, dir, label: label ? `vers ${label}` : '', known: !!label });
  }
  return out;
}

/** La sortie sur laquelle se trouve un jeton (il occupe la case du bord). */
export function exitAt(b: Battle, t: Pick<BattleToken, 'x' | 'y' | 'size'>, exits: Exit[] = exitsOf(b, (p) => (p.auto?.label ?? p.title).split(' · ')[0])): Exit | undefined {
  const mine = new Set(cellsOf(t, b.cols));
  return exits.find((e) => mine.has(e.cell));
}
