/**
 * Placement des créatures d'une rencontre sur le plateau. Une caravane reste groupée ; des mineurs se dispersent.
 * Le choix se fait d'après le rôle indiqué par la rencontre, et à défaut d'après le nombre de créatures.
 */
import { STATS, type Stat } from '../atlas/statblocks';
import type { BattleToken } from '../mapStore';

export type EncounterGroup = { stat: string; role?: string; n: number; detail: string };

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const CLUSTER = /caravane|escorte|garde|troupe|groupe|meute|bande|soldat|cortege|famille|patrouille|escadron/;
const SPREAD = /mineur|eclaireur|guetteur|chasseur|isole|disperse|eparpille|ramasseur|pilleur|rodeur/;

/** Icône d'une créature d'après le type de sa fiche (humanoïde, bête, mort-vivant…). */
export function iconFor(kind: BattleToken['kind'], stat?: Stat) {
  if (kind === 'pc') return '🧝';
  if (!stat) return kind === 'monster' ? '👹' : '✨';
  const m = norm(stat.meta);
  if (/mort-vivant/.test(m)) return '💀';
  if (/bete/.test(m)) return '🐺';
  if (/elementaire/.test(m)) return '🔥';
  if (/monstruosite/.test(m)) return '👾';
  if (/aberration/.test(m)) return '🐙';
  if (/plante/.test(m)) return '🌿';
  if (/fielon|celeste/.test(m)) return '😈';
  if (/vase/.test(m)) return '🟢';
  if (/humanoide/.test(m)) return '🧌';
  return '👹';
}

export function groupMode(g: EncounterGroup): 'cluster' | 'spread' {
  const r = norm(g.role ?? '');
  if (SPREAD.test(r)) return 'spread';
  if (CLUSTER.test(r)) return 'cluster';
  return g.n >= 3 ? 'cluster' : 'spread';
}

/** Graine simple et stable : même rencontre, même placement. */
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
 * Place les créatures. `free(x, y, size)` dit si la case peut recevoir un jeton (terrain, autres jetons).
 * Les créatures sont cachées (visible: false) : le MJ les révèle quand elles entrent en scène.
 */
export function placeEncounter(
  groups: EncounterGroup[], cols: number, rows: number, free: (x: number, y: number, size: 1 | 2) => boolean,
  seed: number,
): BattleToken[] {
  const rand = rng(seed);
  const tokens: BattleToken[] = [];
  const placed: { x: number; y: number }[] = [];
  const far = (x: number, y: number, d: number) => placed.every((p) => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) >= d);
  const cells = Array.from({ length: cols * rows }, (_, i) => ({ x: i % cols, y: Math.floor(i / cols) }));

  for (const g of groups) {
    const st: Stat | undefined = STATS[g.stat];
    const size: 1 | 2 = st && /taille (G|TG)/.test(st.meta) ? 2 : 1;
    const hp = st ? parseInt(st.hp, 10) : undefined;
    const ac = st ? parseInt(st.ac, 10) : undefined;
    const mode = groupMode(g);
    let anchor: { x: number; y: number } | null = null;
    if (mode === 'cluster') {
      // Ancre : une case libre de l'espace où l'on peut se regrouper (quelques cases libres autour).
      const options = cells.filter((c) => free(c.x, c.y, size) && cells.filter((d) => Math.abs(d.x - c.x) <= 1 && Math.abs(d.y - c.y) <= 1 && free(d.x, d.y, 1)).length >= 6);
      anchor = options.length ? options[Math.floor(rand() * options.length)] : null;
    }
    for (let i = 0; i < g.n; i++) {
      let spot: { x: number; y: number } | null = null;
      if (mode === 'cluster' && anchor) {
        // La case libre la plus proche de l'ancre.
        spot = cells
          .filter((c) => free(c.x, c.y, size) && !tokens.some((t) => Math.abs(t.x - c.x) < size && Math.abs(t.y - c.y) < size))
          .sort((a, b) => Math.hypot(a.x - anchor!.x, a.y - anchor!.y) - Math.hypot(b.x - anchor!.x, b.y - anchor!.y))[0] ?? null;
      } else {
        // Dispersé : une case libre, à au moins 3 cases des autres créatures si possible.
        const pool = cells.filter((c) => free(c.x, c.y, size));
        const apart = pool.filter((c) => far(c.x, c.y, 3));
        const choices = apart.length ? apart : pool;
        spot = choices.length ? choices[Math.floor(rand() * choices.length)] : null;
      }
      if (!spot) continue;
      placed.push(spot);
      const name = st?.name ?? g.stat;
      tokens.push({
        id: `e-${seed.toString(36)}-${tokens.length}`,
        name: g.n > 1 ? `${name} ${i + 1}` : name,
        kind: 'monster', x: spot.x, y: spot.y, size, visible: false,
        hp, maxHp: hp, ac, statId: st ? g.stat : undefined, icon: iconFor('monster', st),
      });
    }
  }
  return tokens;
}
