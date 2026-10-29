/**
 * Champ de bataille improvisé : difficulté d'une rencontre (règles du Guide du maître 5e), proposition d'ennemis
 * pour une difficulté visée, et placement tactique sur le plateau.
 *
 * Difficulté : XP des créatures × multiplicateur selon leur nombre, comparés aux seuils du groupe (somme par niveau).
 * Un groupe entamé (PV bas) trouve tout plus dur : ses seuils sont réduits d'autant.
 */
import { STATS, type Stat } from '../atlas/statblocks';
import type { Battle, BattleToken } from '../mapStore';
import { blocksCell, cellKind } from './terrain';
import { effectiveOf, fits } from './placement';
import { attackCells, rangedCells } from './ranges';
import { iconFor } from './encounter';

/** Seuils facile / moyen / difficile / mortel par niveau de personnage (1 à 20). */
const THRESHOLDS: [number, number, number, number][] = [
  [25, 50, 75, 100], [50, 100, 150, 200], [75, 150, 225, 400], [125, 250, 375, 500], [250, 500, 750, 1100],
  [300, 600, 900, 1400], [350, 750, 1100, 1700], [450, 900, 1400, 2100], [550, 1100, 1600, 2400], [600, 1200, 1900, 2800],
  [800, 1600, 2400, 3600], [1000, 2000, 3000, 4500], [1100, 2200, 3400, 5100], [1250, 2500, 3800, 5700], [1400, 2800, 4300, 6400],
  [1600, 3200, 4800, 7200], [2000, 3900, 5900, 8800], [2100, 4200, 6300, 9500], [2400, 4900, 7300, 10900], [2800, 5700, 8500, 12700],
];

export const DIFFICULTY = ['Trivial', 'Facile', 'Moyen', 'Difficile', 'Mortel'] as const;

/** XP d'une fiche (« 1/4 (50 PX) » → 50). */
export const xpOf = (st?: Pick<Stat, 'cr'>) => {
  const m = /\(([\d\s  ]+)\s*PX\)/.exec(st?.cr ?? '');
  return m ? Number(m[1].replace(/\D/g, '')) : 0;
};
/** Facteur de puissance (FP) en nombre : « 1/4 » → 0,25. */
export const crOf = (st?: Pick<Stat, 'cr'>) => {
  const raw = (st?.cr ?? '0').split(' ')[0];
  if (raw.includes('/')) { const [a, b] = raw.split('/').map(Number); return a / b; }
  return Number(raw) || 0;
};

/** Multiplicateur selon le nombre de créatures (un petit groupe de héros, < 3, compte un cran au-dessus). */
export function multiplier(count: number, partySize: number) {
  const steps = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];
  let i = count <= 0 ? 1 : count === 1 ? 1 : count === 2 ? 2 : count <= 6 ? 3 : count <= 10 ? 4 : count <= 14 ? 5 : 6;
  if (partySize < 3) i += 1;
  if (partySize >= 6) i -= 1;
  return steps[Math.max(0, Math.min(steps.length - 1, i))];
}

export type Party = { levels: number[]; hpRatio: number };

/** Seuils du groupe, réduits s'il est entamé (à 50 % de PV, ils ne valent plus qu'environ 70 %). */
export function thresholds(p: Party): [number, number, number, number] {
  const lv = p.levels.length ? p.levels : [1, 1, 1, 1];
  const sum = [0, 1, 2, 3].map((k) => lv.reduce((s, l) => s + THRESHOLDS[Math.max(1, Math.min(20, Math.round(l))) - 1][k], 0));
  const wear = 0.4 + 0.6 * Math.max(0, Math.min(1, p.hpRatio));
  return sum.map((v) => Math.round(v * wear)) as [number, number, number, number];
}

export type Rating = { xp: number; adjusted: number; score: number; label: typeof DIFFICULTY[number]; thresholds: [number, number, number, number] };

/** Difficulté d'un groupe d'ennemis (XP de chacun) pour ce groupe de héros. `score` va de 0 (trivial) à 4,x (mortel). */
export function rate(xps: number[], p: Party): Rating {
  const th = thresholds(p);
  const xp = xps.reduce((s, x) => s + x, 0);
  const adjusted = Math.round(xp * multiplier(xps.length, p.levels.length || 4));
  let score: number;
  if (adjusted < th[0]) score = adjusted / th[0];
  else if (adjusted < th[1]) score = 1 + (adjusted - th[0]) / (th[1] - th[0]);
  else if (adjusted < th[2]) score = 2 + (adjusted - th[1]) / (th[2] - th[1]);
  else if (adjusted < th[3]) score = 3 + (adjusted - th[2]) / (th[3] - th[2]);
  else score = 4 + Math.min(1, (adjusted - th[3]) / th[3]);
  return { xp, adjusted, score, label: DIFFICULTY[Math.min(4, Math.floor(score))], thresholds: th };
}

/** Familles de créatures pour une rencontre cohérente. */
export const THEMES: { id: string; label: string; ids: string[] }[] = [
  { id: 'all', label: 'Au hasard', ids: [] },
  { id: 'goblin', label: 'Gobelinoïdes', ids: ['goblin', 'goblin-boss', 'hobgoblin', 'bugbear', 'worg'] },
  { id: 'orc', label: 'Orcs et brutes', ids: ['orc', 'ogre', 'worg', 'thug'] },
  { id: 'kobold', label: 'Kobolds', ids: ['kobold', 'giant-lizard'] },
  { id: 'undead', label: 'Morts-vivants', ids: ['skeleton', 'zombie', 'ghoul', 'shadow'] },
  { id: 'beast', label: 'Bêtes', ids: ['wolf', 'dire-wolf', 'brown-bear', 'giant-spider', 'giant-lizard', 'giant-centipede', 'bat-swarm'] },
  { id: 'bandit', label: 'Bandits', ids: ['bandit', 'thug', 'scout', 'spy', 'veteran'] },
  { id: 'cult', label: 'Culte', ids: ['cultist', 'cult-fanatic', 'priest', 'mage'] },
  { id: 'underdark', label: 'Outreterre', ids: ['duergar', 'drow', 'grick', 'darkmantle', 'giant-spider', 'umber-hulk', 'roper', 'otyugh'] },
  { id: 'ooze', label: 'Vases et champignons', ids: ['gray-ooze', 'ochre-jelly', 'gelatinous-cube', 'violet-fungus', 'shrieker'] },
  { id: 'giant', label: 'Géants', ids: ['ogre', 'troll'] },
];

export type Pick_ = { stat: string; n: number };
export type Proposal = { groups: Pick_[]; rating: Rating };

function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Propose des ennemis pour une difficulté visée (1 facile … 4 mortel) : un chef et sa troupe, une horde, ou un duo
 * de familles. On tire beaucoup de compositions et on garde celle qui tombe le plus près du milieu de la tranche.
 */
export function propose(p: Party, target: number, theme: string, seed: number, extra: Stat[] = []): Proposal | null {
  const th = thresholds(p);
  const goal = target >= 4 ? th[3] * 1.15 : (th[target - 1] + th[target]) / 2;
  const avg = p.levels.length ? p.levels.reduce((s, l) => s + l, 0) / p.levels.length : 1;
  const all = [...Object.values(STATS), ...extra].filter((s) => xpOf(s) > 0 && !/neutre bon|loyal bon|chaotique bon/.test(s.meta));
  const ids = THEMES.find((t) => t.id === theme)?.ids ?? [];
  let pool = ids.length ? all.filter((s) => ids.includes(s.id)) : all;
  pool = pool.filter((s) => crOf(s) <= Math.max(1, avg + 2));
  if (!pool.length) return null;
  const rand = rng(seed);
  const pick = (list: Stat[]) => list[Math.floor(rand() * list.length)];
  let best: Proposal | null = null;
  for (let i = 0; i < 400; i++) {
    const groups: Pick_[] = [];
    const shape = rand();
    const lead = pick(pool);
    if (shape < 0.45) {
      // Un chef (le plus fort) et sa troupe, plus faible.
      const minions = pool.filter((s) => crOf(s) < crOf(lead));
      groups.push({ stat: lead.id, n: 1 });
      if (minions.length) groups.push({ stat: pick(minions).id, n: 1 + Math.floor(rand() * 6) });
    } else if (shape < 0.8) {
      groups.push({ stat: lead.id, n: 1 + Math.floor(rand() * 6) });
    } else {
      const other = pick(pool);
      groups.push({ stat: lead.id, n: 1 + Math.floor(rand() * 3) });
      if (other.id !== lead.id) groups.push({ stat: other.id, n: 1 + Math.floor(rand() * 3) });
    }
    const xps = groups.flatMap((g) => Array.from({ length: g.n }, () => xpOf(STATS[g.stat] ?? extra.find((e) => e.id === g.stat))));
    if (xps.length > 10) continue;
    const rating = rate(xps, p);
    const miss = Math.abs(rating.adjusted - goal) / goal + (Math.min(4, Math.floor(rating.score)) !== Math.min(4, target) ? 1 : 0);
    const bestMiss = best ? Math.abs(best.rating.adjusted - goal) / goal + (Math.min(4, Math.floor(best.rating.score)) !== Math.min(4, target) ? 1 : 0) : Infinity;
    if (miss < bestMiss) best = { groups, rating };
  }
  return best;
}

/** Distance de marche (en cases) depuis un ensemble de cases, obstacles contournés. */
function walkFrom(grid: string | undefined, cols: number, rows: number, starts: { x: number; y: number }[]): number[] {
  const dist = new Array<number>(cols * rows).fill(Infinity);
  const queue: number[] = [];
  for (const s of starts) { const i = s.y * cols + s.x; if (dist[i] !== 0) { dist[i] = 0; queue.push(i); } }
  for (let q = 0; q < queue.length; q++) {
    const u = queue[q], ux = u % cols, uy = Math.floor(u / cols);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = ux + dx, y = uy + dy;
      if ((!dx && !dy) || x < 0 || y < 0 || x >= cols || y >= rows) continue;
      const v = y * cols + x;
      if (dist[v] !== Infinity || blocksCell(grid, cols, x, y)) continue;
      dist[v] = dist[u] + 1;
      queue.push(v);
    }
  }
  return dist;
}

/** Nombre de cases opaques (roche, pilier) autour d'une case : de quoi s'abriter. */
const shelter = (grid: string | undefined, cols: number, x: number, y: number) => {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const k = cellKind(grid, cols, x + dx, y + dy);
    if ((dx || dy) && (k === '#' || k === 'I')) n++;
  }
  return n;
};

export type Role = 'leader' | 'melee' | 'ranged' | 'skirmisher';

/** Rôle tactique d'une fiche : tireur, combattant au contact, chef (le plus fort de la rencontre), rôdeur discret. */
export function roleOf(st: Stat | undefined, isLeader: boolean): Role {
  if (isLeader) return 'leader';
  if (!st) return 'melee';
  const ranged = rangedCells(st), reach = attackCells(st);
  if (ranged >= 8 && (/arc|arbalète|fronde|trait/i.test(st.actions.map(([n]) => n).join(' ')) || reach === 0)) return 'ranged';
  if (/Discrétion \+[4-9]/.test(st.skills ?? '')) return 'skirmisher';
  return 'melee';
}

/** Zone visée selon le rôle, en cases de marche depuis le héros le plus proche. */
const BAND: Record<Role, [number, number]> = { melee: [3, 6], skirmisher: [4, 8], ranged: [7, 12], leader: [6, 10] };

/**
 * Pose les créatures de façon tactique : au contact pour les combattants, en retrait et à l'abri pour les tireurs et
 * le chef, sur les flancs pour les rôdeurs. Sans héros sur le plateau, le groupe est posé d'abord sur le bord gauche.
 * Les créatures arrivent cachées aux joueurs.
 */
export function placeTactically(b: Battle, groups: Pick_[], seed: number, opts: { party?: Omit<BattleToken, 'x' | 'y'>[]; extra?: Stat[] } = {}): BattleToken[] {
  const grid = effectiveOf(b);
  const rand = rng(seed);
  let board: Battle = { ...b, tokens: [...b.tokens] };
  const added: BattleToken[] = [];
  const put = (t: BattleToken) => { added.push(t); board = { ...board, tokens: [...board.tokens, t] }; };

  // Les héros absents du plateau : regroupés sur une case libre du bord gauche (ou la plus à gauche possible).
  if (opts.party?.length) {
    const cy = Math.floor(b.rows / 2);
    const spots: { x: number; y: number }[] = [];
    for (let x = 0; x < b.cols; x++) for (let y = 0; y < b.rows; y++) spots.push({ x, y });
    spots.sort((p, q) => p.x * 3 + Math.abs(p.y - cy) - (q.x * 3 + Math.abs(q.y - cy)));
    for (const h of opts.party) {
      const s = spots.find((c) => fits(board, null, h.size, c.x, c.y));
      if (s) put({ ...h, ...s } as BattleToken);
    }
  }

  const heroes = board.tokens.filter((t) => t.kind === 'pc');
  const dist = heroes.length ? walkFrom(grid, b.cols, b.rows, heroes.map((h) => ({ x: h.x, y: h.y }))) : null;
  const statOf = (id: string) => STATS[id] ?? opts.extra?.find((e) => e.id === id);
  const leadId = [...groups].sort((x, y) => crOf(statOf(y.stat)) - crOf(statOf(x.stat)))[0]?.stat;
  const hasLeader = groups.length > 1 || (groups[0]?.n ?? 0) === 1;
  // Axe principal : du groupe vers le côté opposé du plateau, pour situer les flancs.
  const hx = heroes.length ? heroes.reduce((s, h) => s + h.x, 0) / heroes.length : 0;
  const hy = heroes.length ? heroes.reduce((s, h) => s + h.y, 0) / heroes.length : b.rows / 2;

  for (const g of groups) {
    const st = statOf(g.stat);
    const size: 1 | 2 = st && /taille (G|TG)/.test(st.meta) ? 2 : 1;
    const hp = st ? parseInt(st.hp, 10) : undefined;
    const ac = st ? parseInt(st.ac, 10) : undefined;
    for (let i = 0; i < g.n; i++) {
      const role = roleOf(st, hasLeader && g.stat === leadId && i === 0 && g.n === 1);
      const [lo, hi] = BAND[role];
      let best: { x: number; y: number; score: number } | null = null;
      for (let y = 0; y < b.rows; y++) for (let x = 0; x < b.cols; x++) {
        if (!fits(board, null, size, x, y)) continue;
        const d = dist ? dist[y * b.cols + x] : x;
        if (d === Infinity) continue;
        let score = dist ? -(d < lo ? (lo - d) * 3 : d > hi ? (d - hi) : 0) : x / b.cols * 4;
        if (role === 'ranged' || role === 'leader') score += shelter(grid, b.cols, x, y) * 0.8;
        if (role === 'skirmisher') score += Math.min(4, Math.abs(y - hy) * 0.6) + shelter(grid, b.cols, x, y) * 0.4;
        if (role === 'melee') {
          // Les combattants restent groupés : bonus près des alliés déjà posés.
          const near = added.filter((t) => t.kind === 'monster' && Math.max(Math.abs(t.x - x), Math.abs(t.y - y)) <= 2).length;
          score += Math.min(2, near) * 0.7;
        }
        // Ne pas s'agglutiner contre une autre créature (1 case d'air), et un peu de hasard.
        if (added.some((t) => t.kind === 'monster' && Math.max(Math.abs(t.x - x), Math.abs(t.y - y)) < 2)) score -= 1.5;
        score += rand() * 0.9 - Math.abs(x - hx) * 0.001;
        if (!best || score > best.score) best = { x, y, score };
      }
      if (!best) continue;
      const name = st?.name ?? g.stat;
      put({
        id: `s-${seed.toString(36)}-${added.length}`,
        name: g.n > 1 ? `${name} ${i + 1}` : name,
        kind: 'monster', x: best.x, y: best.y, size, visible: false,
        hp, maxHp: hp, ac, statId: st ? g.stat : undefined, icon: iconFor('monster', st),
      });
    }
  }
  return added;
}
