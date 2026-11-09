/**
 * Placement des créatures d'une rencontre sur le plateau. Une caravane reste groupée ; des mineurs se dispersent.
 * Le choix se fait d'après le rôle indiqué par la rencontre, et à défaut d'après le nombre de créatures.
 */
import { STATS, type Stat } from '../atlas/statblocks';
import type { BattleToken } from '../mapStore';

/**
 * Groupe de créatures d'une rencontre. `stat` : fiche SRD (ou simple nom). Une créature de PNJ & Créatures
 * apporte son nom, son jeton et ses valeurs (`name`, `image`, `hp`, `ac`, `size`), prioritaires sur la fiche SRD.
 */
export type EncounterGroup = { stat: string; role?: string; n: number; detail: string; name?: string; image?: string; hp?: number; ac?: number; size?: 1 | 2;
  /** Fiche de PNJ & Créatures (bestiaire Underdark importé) : le combattant reprend ses statistiques et ses actions. */
  npcId?: string };

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

/**
 * Posture d'un groupe au début du combat, d'après son rôle, son nom et sa fiche :
 * - `monte` : cavaliers, montures (dehors, devant l'entrée) ;
 * - `garde` : gardes, soldats, sentinelles (près des portes) ;
 * - `distance` : archers, frondeurs, mages, prêtres, éclaireurs (à distance, à couvert) ;
 * - `embuscade` : rôdeurs, assassins, araignées, ombres (cachés derrière un obstacle) ;
 * - `melee` : tous les autres (au contact, à quelques cases des héros).
 */
export type Posture = 'monte' | 'garde' | 'distance' | 'embuscade' | 'melee';
export function postureOf(g: EncounterGroup): Posture {
  const t = norm(`${g.role ?? ''} ${g.name ?? ''} ${g.stat} ${STATS[g.stat]?.name ?? ''} ${g.detail ?? ''}`);
  if (/cheval|chevaux|monture|monte|cavalier|chevalier|destrier|warhorse|riding|mounted/.test(t)) return 'monte';
  if (/embuscade|rodeur|assassin|tapi|cache|araignee|ombre|spider|shadow/.test(t)) return 'embuscade';
  if (/archer|arbaletrier|frondeur|mage|chaman|sorcier|pretre|lanceur|tireur|eclaireur|guetteur|scout|priest|archer/.test(t)) return 'distance';
  if (/garde|sentinelle|soldat|milicien|guet|vigile|portier|guard|soldier|veteran/.test(t)) return 'garde';
  return 'melee';
}

/**
 * Ce que le plateau dit au placement : sa grille (murs `#`, obstacles `I`), la position des héros, et le dehors d'un
 * bâtiment (cases hors des murs). Sans contexte, le placement reste groupé ou dispersé, au hasard.
 */
export type PlaceContext = { grid?: string; heroes?: { x: number; y: number }[]; outside?: Set<number> };

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
  seed: number, ctx?: PlaceContext,
): BattleToken[] {
  if (ctx?.heroes?.length || ctx?.outside?.size) return placeTactical(groups, cols, rows, free, seed, ctx);
  const rand = rng(seed);
  const tokens: BattleToken[] = [];
  const placed: { x: number; y: number }[] = [];
  const far = (x: number, y: number, d: number) => placed.every((p) => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) >= d);
  const cells = Array.from({ length: cols * rows }, (_, i) => ({ x: i % cols, y: Math.floor(i / cols) }));

  for (const g of groups) {
    const st: Stat | undefined = STATS[g.stat];
    const size: 1 | 2 = g.size ?? (st && /taille (G|TG)/.test(st.meta) ? 2 : 1);
    const hp = g.hp ?? (st ? parseInt(st.hp, 10) : undefined);
    const ac = g.ac ?? (st ? parseInt(st.ac, 10) : undefined);
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
      const name = g.name ?? st?.name ?? g.stat;
      tokens.push({
        id: `e-${seed.toString(36)}-${tokens.length}`,
        name: g.n > 1 ? `${name} ${i + 1}` : name,
        kind: 'monster', x: spot.x, y: spot.y, size, visible: false,
        hp, maxHp: hp, ac, statId: st ? g.stat : undefined, icon: iconFor('monster', st), image: g.image, npcId: g.npcId,
      });
    }
  }
  return tokens;
}

/**
 * Placement tactique : chaque créature prend la case libre la mieux notée pour sa posture, pour que le combat commence
 * tout de suite (cavaliers dehors devant l'entrée, garde près de la porte, archers à distance et à couvert, les autres
 * à portée de charge). Une même rencontre donne toujours la même disposition.
 */
function placeTactical(groups: EncounterGroup[], cols: number, rows: number, free: (x: number, y: number, size: 1 | 2) => boolean, seed: number, ctx: PlaceContext): BattleToken[] {
  const rand = rng(seed);
  const grid = ctx.grid ?? '';
  const heroes = ctx.heroes ?? [];
  const outside = ctx.outside ?? new Set<number>();
  const building = outside.size > 0 && outside.size < cols * rows;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= cols || y >= rows ? '#' : grid[y * cols + x] ?? '.');
  // Seuils : cases du dedans qui touchent le dehors (portes) et cases du dehors qui touchent le dedans (devant la porte).
  const doorsIn: number[] = [], doorsOut: number[] = [];
  if (building) {
    for (let i = 0; i < cols * rows; i++) {
      const x = i % cols, y = Math.floor(i / cols);
      if (at(x, y) === '#') continue;
      const n4 = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < cols && b < rows && at(a, b) !== '#');
      if (!outside.has(i) && n4.some(([a, b]) => outside.has(b * cols + a))) doorsIn.push(i);
      if (outside.has(i) && n4.some(([a, b]) => !outside.has(b * cols + a))) doorsOut.push(i);
    }
  }
  const dist = (i: number, list: number[]) => (list.length ? Math.min(...list.map((j) => Math.max(Math.abs((j % cols) - (i % cols)), Math.abs(Math.floor(j / cols) - Math.floor(i / cols))))) : 99);
  const dHero = (x: number, y: number) => (heroes.length ? Math.min(...heroes.map((h) => Math.max(Math.abs(h.x - x), Math.abs(h.y - y)))) : 6);
  const cover = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].filter(([dx, dy]) => /[#I]/.test(at(x + dx, y + dy))).length;
  const IDEAL: Record<Posture, number> = { monte: 6, garde: 4, distance: 7, embuscade: 5, melee: 3 };
  const tokens: BattleToken[] = [];
  const taken = (x: number, y: number, size: number) => tokens.some((t) => t.x < x + size && x < t.x + t.size && t.y < y + size && y < t.y + t.size);
  for (const g of groups) {
    const st: Stat | undefined = STATS[g.stat];
    const size: 1 | 2 = g.size ?? (st && /taille (G|TG)/.test(st.meta) ? 2 : 1);
    const hp = g.hp ?? (st ? parseInt(st.hp, 10) : undefined);
    const ac = g.ac ?? (st ? parseInt(st.ac, 10) : undefined);
    const post = postureOf(g);
    const mine: { x: number; y: number }[] = [];
    for (let k = 0; k < g.n; k++) {
      let best: { x: number; y: number; s: number } | null = null;
      for (let i = 0; i < cols * rows; i++) {
        const x = i % cols, y = Math.floor(i / cols);
        if (!free(x, y, size) || taken(x, y, size)) continue;
        const dh = dHero(x, y);
        if (heroes.length && dh < 2) continue; // jamais collé aux héros au premier round
        let s = -Math.abs(dh - IDEAL[post]) * 2 + rand() * 0.6;
        if (building) {
          const out = outside.has(i);
          if (post === 'monte') s += out ? 6 - Math.min(5, dist(i, doorsOut)) : -40; // à cheval, on reste dehors
          else if (post === 'garde') s += !out ? 5 - Math.min(5, dist(i, doorsIn)) * 1.5 : -6;
          else s += out ? -4 : 0;
        }
        if (post === 'distance') s += cover(x, y) * 1.2;
        if (post === 'embuscade') s += cover(x, y) * 2;
        // Même groupe : au coude à coude (contact, cavaliers, garde), ou espacés (tireurs, embusqués).
        if (mine.length) {
          const dm = Math.min(...mine.map((p) => Math.max(Math.abs(p.x - x), Math.abs(p.y - y))));
          s += post === 'distance' || post === 'embuscade' ? (dm >= 2 ? 1 : -3) : -Math.max(0, dm - 1.5) * 1.5;
        }
        if (!best || s > best.s) best = { x, y, s };
      }
      if (!best) continue;
      mine.push(best);
      const name = g.name ?? st?.name ?? g.stat;
      tokens.push({
        id: `e-${seed.toString(36)}-${tokens.length}`, name: g.n > 1 ? `${name} ${k + 1}` : name,
        kind: 'monster', x: best.x, y: best.y, size, visible: false,
        hp, maxHp: hp, ac, statId: st ? g.stat : undefined, icon: iconFor('monster', st), image: g.image, npcId: g.npcId,
      });
    }
  }
  return tokens;
}
