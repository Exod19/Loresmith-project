/**
 * Lecture tactique du plateau : abri (cover), avantages et malus de position, menaces d'attaque d'opportunité.
 *
 * Abri : règle de la grille du Guide du maître. L'attaquant choisit un coin de sa case et trace une ligne vers chacun
 * des quatre coins de la case de la cible. 1 ou 2 lignes coupées → abri partiel (+2 CA et sauvegardes de Dex),
 * 3 → abri aux trois quarts (+5), 4 → abri total (pas de ligne de vue). Une ligne qui longe le bord d'un obstacle
 * ne compte pas. Une créature sur la ligne ne donne au mieux qu'un abri partiel.
 */
import type { Battle, BattleToken } from '../mapStore';
import { cellKind, TERRAIN } from './terrain';
import { attackCells, rangedCells } from './ranges';
import { isOut, statOf } from './combat';
import { trailMoveNotes, trailNotes } from './trailRules';
import { surfaceOf } from './placement';
import { OBJECT_DEF, type SurfaceRules } from './surface';

export type Note = { tone: 'buff' | 'malus' | 'alert' | 'chance'; label: string; why: string };

/** Ce qu'une créature sait faire sur le plateau : allonge et portée (en cases), Tactique de groupe. */
export type Profile = { reach: number; ranged: number; pack: boolean };

export function profileFromStat(t: BattleToken): Profile {
  const st = statOf(t);
  return {
    reach: st ? Math.max(attackCells(st), 0) : 1,
    ranged: st ? rangedCells(st) : 0,
    pack: !!st?.traits?.some(([n]) => /tactique de groupe/i.test(n)),
  };
}

/** Deux camps : les joueurs (et leurs alliés) contre les créatures. Les jetons « autre » sont neutres. */
export const hostile = (a: BattleToken, b: BattleToken) =>
  (a.kind === 'pc' && b.kind === 'monster') || (a.kind === 'monster' && b.kind === 'pc');

const alive = (t: BattleToken) => !isOut(t) && !(t.kind === 'pc' && t.hp !== undefined && t.hp <= 0);

/** Distance en cases entre deux jetons (1 = au contact, diagonale comprise ; 0 = superposés). */
export function gap(a: BattleToken | { x: number; y: number; size: number }, b: BattleToken | { x: number; y: number; size: number }) {
  const dx = Math.max(0, a.x - (b.x + b.size - 1), b.x - (a.x + a.size - 1));
  const dy = Math.max(0, a.y - (b.y + b.size - 1), b.y - (a.y + a.size - 1));
  return Math.max(dx, dy);
}
/** À `cells` cases d'allonge : 1 case (1,5 m) = au contact. */
const within = (a: Parameters<typeof gap>[0], b: Parameters<typeof gap>[0], cells: number) => gap(a, b) <= Math.max(cells, 1);

/** Ce qui arrête la vue : la roche et les piliers (un gouffre ou de l'eau ne cachent rien). */
const opaque = (grid: string | undefined, cols: number, x: number, y: number) => {
  const k = cellKind(grid, cols, x, y);
  return k === '#' || k === 'I';
};

type Block = { wall: string | null; creature: string | null };

/** Murs de la scène (arêtes) et obstacles partiels (buisson, tonneau, muret) : ils comptent pour l'abri. */
function sceneOf(b: Battle): SurfaceRules | null {
  return b.walls?.length || b.objects?.length ? surfaceOf(b) : null;
}
/** Mur entre deux cases voisines (diagonale : les deux chemins en L sont coupés). */
function wallBetween(r: SurfaceRules, ax: number, ay: number, bx: number, by: number): string | undefined {
  const v = (x: number, y: number, sx: number) => r.walls[`v${sx > 0 ? x + 1 : x},${y}`];
  const h = (x: number, y: number, sy: number) => r.walls[`h${x},${sy > 0 ? y + 1 : y}`];
  const dx = Math.sign(bx - ax), dy = Math.sign(by - ay);
  if (dx && !dy) return v(ax, ay, dx);
  if (dy && !dx) return h(ax, ay, dy);
  if (!dx && !dy) return undefined;
  const a = v(ax, ay, dx) || h(ax + dx, ay, dy), c = h(ax, ay, dy) || v(ax, ay + dy, dx);
  return a && c ? (a === 'mur' || c === 'mur' ? 'mur' : a) : undefined;
}

/** Ce qui coupe la ligne entre deux points (en coordonnées de case), sans compter les cases des deux jetons. */
function lineBlock(b: Battle, grid: string | undefined, ax: number, ay: number, bx: number, by: number, skip: Set<number>, tokens: BattleToken[], scene: SurfaceRules | null = null): Block {
  const len = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(2, Math.ceil(len * 10));
  const eps = 1e-6;
  let wall: string | null = null, creature: string | null = null;
  // Case traversée au pas précédent (au centre du segment), pour repérer le franchissement d'un mur.
  let prev: { x: number; y: number } | null = null;
  for (let i = 1; i < steps; i++) {
    const px = ax + ((bx - ax) * i) / steps, py = ay + ((by - ay) * i) / steps;
    if (scene) {
      const here = { x: Math.floor(px - (bx - ax) * 1e-4), y: Math.floor(py - (by - ay) * 1e-4) };
      if (prev && (prev.x !== here.x || prev.y !== here.y)) {
        const k = wallBetween(scene, prev.x, prev.y, here.x, here.y);
        if (k === 'mur') return { wall: 'un mur', creature };
        if (k === 'muret' && !creature) creature = 'un muret';
      }
      prev = here;
    }
    // Sur un bord de case, la ligne ne compte comme coupée que si les cases des deux côtés la coupent (elle « longe »).
    const xs = Math.abs(px - Math.round(px)) < eps ? [Math.round(px) - 1, Math.round(px)] : [Math.floor(px)];
    const ys = Math.abs(py - Math.round(py)) < eps ? [Math.round(py) - 1, Math.round(py)] : [Math.floor(py)];
    const cells = xs.flatMap((x) => ys.map((y) => ({ x, y })));
    if (cells.every((c) => skip.has(c.y * b.cols + c.x))) continue;
    const rest = cells.filter((c) => !skip.has(c.y * b.cols + c.x));
    if (rest.every((c) => opaque(grid, b.cols, c.x, c.y))) {
      const c = rest[0];
      wall = `${TERRAIN[cellKind(grid, b.cols, c.x, c.y) ?? '#'].label.split(' :')[0].toLowerCase()} en (${c.x + 1}, ${c.y + 1})`;
      return { wall, creature };
    }
    if (!creature) {
      const who = rest.map((c) => tokens.find((t) => c.x >= t.x && c.x < t.x + t.size && c.y >= t.y && c.y < t.y + t.size));
      if (who.every(Boolean)) creature = who[0]!.name;
    }
    if (!creature && scene) {
      // Buisson, tonneau, souche : un obstacle bas qui ne donne qu'un abri partiel.
      const low = rest.map((c) => scene.cells[c.y * b.cols + c.x]?.obs).filter((o) => o?.c === 'partiel');
      if (low.length === rest.length && low[0]) creature = `${OBJECT_DEF[low[0].kind].label.toLowerCase()}`;
    }
  }
  return { wall, creature };
}

export type Cover = { level: 0 | 1 | 2 | 3; ac: number; label: string; why: string };
const COVER: Omit<Cover, 'why'>[] = [
  { level: 0, ac: 0, label: 'À découvert' },
  { level: 1, ac: 2, label: 'Abri partiel' },
  { level: 2, ac: 5, label: 'Abri aux trois quarts' },
  { level: 3, ac: 0, label: 'Abri total' },
];

const cellsOf = (t: BattleToken) => {
  const out: { x: number; y: number }[] = [];
  for (let dy = 0; dy < t.size; dy++) for (let dx = 0; dx < t.size; dx++) out.push({ x: t.x + dx, y: t.y + dy });
  return out;
};

/** Abri de `target` contre une attaque de `attacker` (le meilleur coin pour l'attaquant). */
export function coverAgainst(b: Battle, grid: string | undefined, attacker: BattleToken, target: BattleToken): Cover {
  const skip = new Set([...cellsOf(attacker), ...cellsOf(target)].map((c) => c.y * b.cols + c.x));
  const scene = sceneOf(b);
  const others = b.tokens.filter((t) => t.id !== attacker.id && t.id !== target.id && alive(t));
  const corners = (x: number, y: number) => [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];
  const from = cellsOf(attacker).flatMap((c) => corners(c.x, c.y));
  let best: { walls: number; creatures: number; reasons: string[] } | null = null;
  // La cible choisit sa case la mieux protégée seulement si elle est grande ; l'attaquant vise la plus exposée.
  for (const tc of cellsOf(target)) {
    const to = corners(tc.x, tc.y);
    for (const [ax, ay] of from) {
      let walls = 0, creatures = 0;
      const reasons: string[] = [];
      for (const [bx, by] of to) {
        const r = lineBlock(b, grid, ax, ay, bx, by, skip, others, scene);
        if (r.wall) { walls++; reasons.push(r.wall); } else if (r.creature) { creatures++; reasons.push(r.creature); }
      }
      const score = walls * 10 + creatures;
      if (!best || score < best.walls * 10 + best.creatures) best = { walls, creatures, reasons };
      if (best.walls === 0 && best.creatures === 0) break;
    }
  }
  const { walls, creatures, reasons } = best!;
  const blocked = walls + creatures;
  let level: Cover['level'] = blocked === 0 ? 0 : walls === 4 ? 3 : walls >= 3 ? 2 : 1;
  if (walls === 0 && creatures > 0) level = 1;
  if (blocked === 4 && walls < 4 && level > 1) level = 2;
  const uniq = [...new Set(reasons)];
  const why = level === 0
    ? `Depuis ${attacker.name} : les 4 lignes vers ${target.name} sont dégagées.`
    : level === 3
      ? `Depuis ${attacker.name} : aucune ligne n'atteint ${target.name} (${uniq.join(', ')}). Pas de ligne de vue.`
      : `Depuis le meilleur coin de ${attacker.name} : ${blocked} ligne${blocked > 1 ? 's' : ''} sur 4 vers ${target.name} coupée${blocked > 1 ? 's' : ''} par ${uniq.join(', ')}${walls === 0 ? ' (une créature ou un obstacle bas ne donne qu’un abri partiel)' : ''}.`;
  return { ...COVER[level], why };
}

const plural = (names: string[]) => (names.length <= 2 ? names.join(' et ') : `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`);

/**
 * Situation tactique d'un jeton : abris contre chaque ennemi, avantages et malus de position, menaces et occasions.
 */
export function tacticalNotes(b: Battle, grid: string | undefined, id: string, profileOf: (t: BattleToken) => Profile = profileFromStat): Note[] {
  const me = b.tokens.find((t) => t.id === id);
  if (!me || !alive(me)) return [];
  const notes: Note[] = [];
  const foes = b.tokens.filter((t) => hostile(me, t) && alive(t));
  const friends = b.tokens.filter((t) => t.id !== me.id && !hostile(me, t) && t.kind === me.kind && alive(t));
  const mine = profileOf(me);

  // Abri contre chaque ennemi qui pourrait l'attaquer.
  const byLevel = new Map<number, { names: string[]; why: string[] }>();
  for (const f of foes) {
    const c = coverAgainst(b, grid, f, me);
    if (c.level === 0) continue;
    const e = byLevel.get(c.level) ?? { names: [], why: [] };
    e.names.push(f.name); e.why.push(c.why);
    byLevel.set(c.level, e);
  }
  for (const [level, e] of [...byLevel.entries()].sort((x, y) => y[0] - x[0])) {
    const c = COVER[level];
    notes.push({
      tone: 'buff',
      label: level === 3 ? `Hors de vue de ${plural(e.names)}` : `${c.label} (+${c.ac} CA) contre ${plural(e.names)}`,
      why: `${e.why.join('\n')}${level < 3 ? `\n${c.label} : +${c.ac} à la CA et aux sauvegardes de Dextérité.` : '\nNe peut pas être pris pour cible directement.'}`,
    });
  }

  // Terrain sous ses pieds.
  const ground = cellKind(grid, b.cols, me.x, me.y);
  if (ground && TERRAIN[ground].difficult) {
    notes.push({ tone: 'malus', label: 'Terrain difficile', why: `${TERRAIN[ground].label}. Chaque case quittée coûte le double de déplacement.` });
  }

  // Ennemis au contact.
  const touching = foes.filter((f) => within(me, f, 1));
  if (mine.ranged > 0 && touching.length) {
    notes.push({ tone: 'malus', label: 'Désavantage à distance', why: `${plural(touching.map((f) => f.name))} au contact : ses attaques à distance ont un désavantage tant qu’un ennemi conscient est à 1,5 m.` });
  }

  // Menaces : qui le frapperait s'il s'éloignait.
  const threats = foes.filter((f) => { const p = profileOf(f); return p.reach > 0 && within(me, f, p.reach); });
  if (threats.length) {
    notes.push({ tone: 'alert', label: `S’éloigner provoque ${threats.length > 1 ? `${threats.length} attaques` : 'une attaque'} d’opportunité`, why: `${plural(threats.map((f) => f.name))} l’${threats.length > 1 ? 'ont' : 'a'} à son allonge. Quitter cette allonge sans se désengager (action) leur permet une attaque de réaction.` });
  }

  // Occasions : avantage de groupe, tenaille, cibles à découvert.
  for (const f of foes) {
    if (!within(me, f, Math.max(mine.reach, 1))) continue;
    const helpers = friends.filter((a) => within(a, f, 1));
    if (mine.pack && helpers.length) {
      notes.push({ tone: 'chance', label: `Avantage contre ${f.name} (Tactique de groupe)`, why: `${plural(helpers.map((h) => h.name))} se trouve à 1,5 m de ${f.name} : avantage aux jets d’attaque contre lui.` });
    }
    const flank = helpers.find((a) => {
      const cx = f.x + (f.size - 1) / 2, cy = f.y + (f.size - 1) / 2;
      const v1 = [me.x - cx, me.y - cy], v2 = [a.x - cx, a.y - cy];
      return v1[0] * v2[0] + v1[1] * v2[1] < 0 && Math.sign(v1[0]) === -Math.sign(v2[0]) && Math.sign(v1[1]) === -Math.sign(v2[1]);
    });
    if (flank) notes.push({ tone: 'chance', label: `Prise en tenaille de ${f.name}`, why: `${me.name} et ${flank.name} sont de part et d’autre de ${f.name}. Règle optionnelle du Guide du maître : avantage aux attaques au corps à corps.` });
  }
  if (mine.ranged > 0) {
    const open = foes.filter((f) => gap(me, f) <= mine.ranged && coverAgainst(b, grid, me, f).level === 0 && !within(me, f, 1));
    if (open.length) notes.push({ tone: 'chance', label: `À découvert à portée de tir : ${plural(open.map((f) => f.name))}`, why: `Aucun abri entre ${me.name} et ${plural(open.map((f) => f.name))}, à moins de ${mine.ranged * 1.5} m (portée courte).` });
  }
  return [...notes, ...trailNotes(b, grid, me)];
}

/**
 * Déplacement d'un jeton : les ennemis dont il quitte l'allonge (attaques d'opportunité) et ceux dont il entre dans
 * l'allonge en finissant son mouvement.
 */
export function moveAlerts(b: Battle, id: string, to: { x: number; y: number }, profileOf: (t: BattleToken) => Profile = profileFromStat): Note[] {
  const me = b.tokens.find((t) => t.id === id);
  if (!me || (me.x === to.x && me.y === to.y)) return [];
  const there = { ...me, ...to };
  const notes: Note[] = [];
  const foes = b.tokens.filter((t) => hostile(me, t) && alive(t));
  const leaving = foes.filter((f) => { const r = profileOf(f).reach; return r > 0 && within(me, f, r) && !within(there, f, r); });
  if (leaving.length) {
    notes.push({ tone: 'alert', label: `⚠ Attaque d’opportunité : ${plural(leaving.map((f) => f.name))}`, why: `${me.name} quitte l’allonge de ${plural(leaving.map((f) => f.name))}. Sauf Désengagement, ${leaving.length > 1 ? 'chacun peut' : 'il peut'} l’attaquer par une réaction.` });
  }
  const entering = foes.filter((f) => { const r = profileOf(f).reach; return r > 0 && !within(me, f, r) && within(there, f, r); });
  if (entering.length) {
    notes.push({ tone: 'malus', label: `Entre à l’allonge de ${plural(entering.map((f) => f.name))}`, why: `En finissant ici, ${me.name} s’expose aux attaques de ${plural(entering.map((f) => f.name))}, et partir ensuite provoquera une attaque d’opportunité.` });
  }
  return [...notes, ...trailMoveNotes(b, me, to)];
}
