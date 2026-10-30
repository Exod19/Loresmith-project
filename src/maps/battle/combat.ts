/**
 * Combat sur la carte : initiative, tours, jets d'attaque et de dégâts, états, et conseils tactiques pour le MJ.
 * Tout se lit dans les fiches SRD (« +4 au toucher, allonge 1,5 m. Touché : 5 (1d6 + 2) perforants. »).
 */
import { STATS, type Stat } from '../atlas/statblocks';
import type { Battle, BattleToken } from '../mapStore';
import { pathCost } from './terrain';
import { attackCells, rangedCells, speedCells } from './ranges';

const FT_PER_M = 3.28084;
const num = (s: string) => parseFloat(s.replace(',', '.'));
const cellsOf = (metres: string) => Math.round((num(metres) * FT_PER_M) / 5);
const abilityMod = (v: number) => Math.floor((v - 10) / 2);

export type Attack = {
  name: string;
  kind: 'melee' | 'ranged' | 'other';
  toHit?: number;
  /** Dés de dégâts (« 1d6+2 ») et moyenne indiquée par la fiche. */
  dice?: string;
  avg?: number;
  dmgType?: string;
  /** Allonge ou portée courte, en cases. */
  reach?: number;
  /** Recharge ou usage limité (« Recharge 5–6 », « 1/jour »…). */
  limited?: string;
  text: string;
};

export const statOf = (t: Pick<BattleToken, 'statId'>): Stat | undefined => (t.statId ? STATS[t.statId] : undefined);

/** Attaques et actions d'une fiche, avec ce qu'il faut pour lancer les dés. */
export function attacksOf(stat?: Stat): Attack[] {
  if (!stat) return [];
  return stat.actions.map(([rawName, text]) => {
    const hit = /([+−-])\s?(\d+) au toucher/.exec(text);
    const dmg = /Touché\s*:\s*(\d+)\s*\(([^)]+)\)\s*(?:dégâts\s+)?([a-zà-ÿ]+)/i.exec(text);
    const reach = /allonge ([\d,]+) m/.exec(text);
    const range = /portée ([\d,]+)\/[\d,]+ m/.exec(text);
    const limited = /\(([^)]*(?:recharge|jour|repos)[^)]*)\)/i.exec(rawName);
    return {
      name: rawName.replace(/\s*\([^)]*\)\s*$/, ''),
      kind: reach ? 'melee' : range ? 'ranged' : 'other',
      toHit: hit ? (hit[1] === '+' ? 1 : -1) * Number(hit[2]) : undefined,
      dice: dmg ? dmg[2].replace(/\s+/g, '') : undefined,
      avg: dmg ? Number(dmg[1]) : undefined,
      dmgType: dmg ? dmg[3] : undefined,
      reach: reach ? cellsOf(reach[1]) : range ? cellsOf(range[1]) : undefined,
      limited: limited ? limited[1] : undefined,
      text,
    };
  });
}

/** Bonus d'initiative : Dextérité de la fiche, ou valeur saisie pour un joueur. */
export function initModOf(t: BattleToken): number {
  if (t.initMod !== undefined) return t.initMod;
  const s = statOf(t);
  return s ? abilityMod(s.abil[1]) : 0;
}

export type Roll = { total: number; text: string; natural?: number };

/** Lance une expression de dés : « 1d20+4 », « 2d6 + 3 », « d8 ». */
export function roll(expr: string, rng: () => number = Math.random): Roll {
  const parts: string[] = [];
  let total = 0;
  let natural: number | undefined;
  const re = /([+-]?)\s*(\d*)d(\d+)|([+-]?)\s*(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr.replace(/−/g, '-')))) {
    if (m[3]) {
      const sign = m[1] === '-' ? -1 : 1;
      const n = Number(m[2] || 1), faces = Number(m[3]);
      const dice = Array.from({ length: n }, () => 1 + Math.floor(rng() * faces));
      if (faces === 20 && n === 1) natural = dice[0];
      total += sign * dice.reduce((a, b) => a + b, 0);
      parts.push(`${sign < 0 ? '−' : parts.length ? '+' : ''}[${dice.join(',')}]`);
    } else if (m[5]) {
      const v = (m[4] === '-' ? -1 : 1) * Number(m[5]);
      total += v;
      parts.push(v < 0 ? `−${-v}` : `+${v}`);
    }
  }
  return { total, text: parts.join(' '), natural };
}

/** Double les dés d'une expression (coup critique) : « 1d6+2 » → « 2d6+2 ». */
export const critical = (dice: string) => dice.replace(/(\d*)d(\d+)/g, (_, n, f) => `${Number(n || 1) * 2}d${f}`);

/** Ordre d'initiative : du plus haut au plus bas ; à égalité, le meilleur bonus. Sans initiative : à la fin. */
export function initiativeOrder(tokens: BattleToken[]): BattleToken[] {
  return [...tokens].sort((a, b) => {
    if (a.init === undefined && b.init === undefined) return 0;
    if (a.init === undefined) return 1;
    if (b.init === undefined) return -1;
    return b.init - a.init || initModOf(b) - initModOf(a);
  });
}

/** Un combattant est hors de combat à 0 PV (les joueurs restent dans l'ordre : jets contre la mort). */
export const isOut = (t: BattleToken) => t.kind !== 'pc' && t.hp !== undefined && t.hp <= 0;

/** États 5e qui laissent une créature neutralisée (ni action ni réaction). */
const NEUTRALISE = ['Inconscient', 'Paralysé', 'Pétrifié', 'Étourdi', 'Neutralisé'];
/** Apparence d'un jeton selon son état : vivant, à l'agonie, stabilisé, mort, neutralisé ; couché s'il est à terre. */
export type Vital = 'mort' | 'agonie' | 'stable' | 'neutralise';
export function vitalOf(t: Pick<BattleToken, 'kind' | 'hp' | 'conditions' | 'dying'>): { vital?: Vital; down: boolean; cause?: string } {
  const conds = t.conditions ?? [];
  let vital: Vital | undefined;
  if (t.kind !== 'pc' && t.hp !== undefined && t.hp <= 0) vital = 'mort';
  else if (t.kind === 'pc' && t.hp !== undefined && t.hp <= 0) vital = t.dying ?? 'agonie';
  const cause = conds.find((c) => NEUTRALISE.includes(c));
  if (!vital && cause) vital = 'neutralise';
  return { vital, down: !!vital && vital !== 'neutralise' || conds.includes('À terre') || conds.includes('Inconscient'), cause };
}

/** Tour suivant : saute les créatures hors de combat. Revenir au premier fait passer au round suivant. */
export function nextTurn(b: Battle): Pick<Battle, 'turn' | 'round'> {
  const order = initiativeOrder(b.tokens).filter((t) => t.init !== undefined && !isOut(t));
  if (!order.length) return { turn: undefined, round: b.round };
  const i = order.findIndex((t) => t.id === b.turn);
  const next = i < 0 ? 0 : (i + 1) % order.length;
  return { turn: order[next].id, round: i >= 0 && next === 0 ? b.round + 1 : b.round };
}

export function previousTurn(b: Battle): Pick<Battle, 'turn' | 'round'> {
  const order = initiativeOrder(b.tokens).filter((t) => t.init !== undefined && !isOut(t));
  if (!order.length) return { turn: undefined, round: b.round };
  const i = order.findIndex((t) => t.id === b.turn);
  const prev = i <= 0 ? order.length - 1 : i - 1;
  return { turn: order[prev].id, round: i === 0 && b.round > 1 ? b.round - 1 : b.round };
}

/** Avance (ou recule) d'un tour, avec la ligne de journal qui va avec. */
export function advanceBattle(b: Battle, dir: 1 | -1): Partial<Battle> {
  const next = dir > 0 ? nextTurn(b) : previousTurn(b);
  const who = b.tokens.find((t) => t.id === next.turn);
  if (!who) return next;
  const line = { id: Math.random().toString(36).slice(2, 10), text: `${next.round !== b.round ? `Round ${next.round} · ` : ''}Tour de ${who.name}`, tone: 'info' as const };
  return { ...next, log: [line, ...(b.log ?? [])].slice(0, 30) };
}

/** Peuples qui voient dans le noir (18 m = 12 cases) ; les autres portent une torche (6 m vive + 6 m faible = 8 cases). */
const DARKVISION = /nain|elfe|gnome|orc|orque|tieffelin|drow|duergar|svirfneblin|tabaxi|aasimar|dwarf|elf|tiefling/i;
export const sightFor = (race?: string) => (race && DARKVISION.test(race) ? 12 : 8);

/** Portée de vue d'un jeton : saisie, sinon selon la fiche (vision dans le noir), sinon une torche. */
export function sightOf(t: BattleToken): number {
  if (t.sight !== undefined) return t.sight;
  const s = statOf(t);
  const dv = s && /vision dans le noir ([\d,]+) m/.exec(s.senses);
  return dv ? Math.round((parseFloat(dv[1].replace(',', '.')) * FT_PER_M) / 5) : 8;
}

/** Perception passive d'un jeton : saisie, sinon lue dans la fiche (« Perception passive 12 »), sinon 10. */
export function passiveOfToken(t: BattleToken): number {
  if (t.passive !== undefined) return t.passive;
  const m = statOf(t) && /Perception passive (\d+)/.exec(statOf(t)!.senses);
  return m ? Number(m[1]) : 10;
}

/** États de D&D 5e, avec leur effet en une ligne. */
export const CONDITIONS: { name: string; rule: string }[] = [
  { name: 'À terre', rule: 'Se relever coûte la moitié du déplacement. Avantage aux attaques au contact contre lui, désavantage à distance.' },
  { name: 'Agrippé', rule: 'Vitesse 0.' },
  { name: 'Aveuglé', rule: 'Rate les tests de vue. Désavantage à ses attaques, avantage contre lui.' },
  { name: 'Charmé', rule: 'Ne peut pas attaquer le charmeur, qui a l’avantage aux tests sociaux contre lui.' },
  { name: 'Assourdi', rule: 'Rate les tests d’ouïe.' },
  { name: 'Effrayé', rule: 'Désavantage tant que la source est en vue ; ne peut pas s’en approcher.' },
  { name: 'Empoisonné', rule: 'Désavantage aux jets d’attaque et aux tests de caractéristique.' },
  { name: 'Entravé', rule: 'Vitesse 0. Désavantage à ses attaques et en Dextérité, avantage contre lui.' },
  { name: 'Étourdi', rule: 'Neutralisé, rate les sauvegardes de Force et de Dextérité, avantage contre lui.' },
  { name: 'Inconscient', rule: 'Neutralisé, à terre. Tout coup au contact à 1,5 m est un critique.' },
  { name: 'Invisible', rule: 'Avantage à ses attaques, désavantage contre lui.' },
  { name: 'Neutralisé', rule: 'Aucune action ni réaction.' },
  { name: 'Paralysé', rule: 'Neutralisé, rate Force et Dextérité. Tout coup au contact à 1,5 m est un critique.' },
  { name: 'Pétrifié', rule: 'Neutralisé, résistance à tous les dégâts.' },
  { name: 'Concentration', rule: 'Sauvegarde de Constitution (DC 10 ou moitié des dégâts) à chaque blessure.' },
];

export type Hint = { tone: 'move' | 'attack' | 'power' | 'warn' | 'story'; text: string };

type Ctx = { b: Battle; grid?: string };

/** Distance de marche jusqu'à une case voisine de la cible (terrain compté), ou à vol d'oiseau à défaut. */
function stepsTo(c: Ctx, from: BattleToken, to: BattleToken) {
  const straight = Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y));
  if (!c.grid) return straight;
  let best = Infinity;
  for (let dy = -1; dy <= to.size; dy++) for (let dx = -1; dx <= to.size; dx++) {
    const x = to.x + dx, y = to.y + dy;
    if (x < 0 || y < 0 || x >= c.b.cols || y >= c.b.rows) continue;
    if (c.b.tokens.some((t) => t.id !== from.id && x >= t.x && x < t.x + t.size && y >= t.y && y < t.y + t.size)) continue;
    const cost = pathCost(c.grid, c.b.cols, c.b.rows, from, { x, y });
    if (cost !== null) best = Math.min(best, cost);
  }
  return best === Infinity ? straight : best;
}

const gap = (a: BattleToken, b: BattleToken) =>
  Math.max(0, Math.max(a.x - (b.x + b.size - 1), b.x - (a.x + a.size - 1)), Math.max(a.y - (b.y + b.size - 1), b.y - (a.y + a.size - 1)));

const hpRatio = (t: BattleToken) => (t.hp !== undefined && t.maxHp ? t.hp / t.maxHp : 1);

/** Conseils pour le tour d'un combattant : qui viser, où aller, quelle capacité sortir. */
export function turnHints(c: Ctx, active: BattleToken): Hint[] {
  const hints: Hint[] = [];
  const stat = statOf(active);
  const foes = c.b.tokens.filter((t) => (active.kind === 'pc' ? t.kind === 'monster' : t.kind === 'pc') && !isOut(t) && (t.hp === undefined || t.hp > 0));
  if (active.kind === 'pc') {
    const threats = foes.filter((m) => gap(m, active) <= attackCells(statOf(m)));
    if (threats.length) hints.push({ tone: 'warn', text: `${active.name} est au contact de ${threats.map((t) => t.name).join(', ')} : s’éloigner provoque une attaque d’opportunité (sauf Se désengager).` });
    const weak = [...foes].sort((a, b) => hpRatio(a) - hpRatio(b))[0];
    if (weak && hpRatio(weak) < 0.5) hints.push({ tone: 'story', text: `${weak.name} est en sang (${weak.hp}/${weak.maxHp}) : décris sa blessure, un coup bien placé peut l’achever.` });
    if (!hints.length) hints.push({ tone: 'story', text: `Tour de ${active.name} : demande son intention avant les dés, et décris le terrain autour de lui.` });
    return hints;
  }
  if (!foes.length) return [{ tone: 'story', text: 'Aucune cible en vue : la créature se cache, guette ou rejoint un allié.' }];

  const attacks = attacksOf(stat);
  const melee = attackCells(stat), ranged = rangedCells(stat), speed = speedCells(stat);
  const best = (list: Attack[]) => [...list].sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))[0];
  const meleeAtk = best(attacks.filter((a) => a.kind === 'melee'));
  const rangedAtk = best(attacks.filter((a) => a.kind === 'ranged'));
  const multi = attacks.find((a) => /attaques multiples/i.test(a.name));
  const pack = stat?.traits?.some(([n]) => /meute/i.test(n));
  const allies = c.b.tokens.filter((t) => t.kind === active.kind && t.id !== active.id && !isOut(t));

  // Cible : au contact d'abord, puis la plus fragile (PV bas, CA basse) ; tactique de meute : celle qu'un allié touche déjà.
  const scored = foes.map((f) => {
    const steps = stepsTo(c, active, f);
    const packBonus = pack && allies.some((a) => gap(a, f) <= 1) ? -3 : 0;
    return { f, steps, adj: gap(active, f) <= melee, score: hpRatio(f) * 10 + (f.ac ?? 12) / 2 + steps / 2 + packBonus };
  }).sort((a, b) => a.score - b.score);
  const target = scored.find((s) => s.adj) ?? scored[0];

  if (active.hp !== undefined && active.maxHp && active.hp / active.maxHp < 0.3) {
    const brave = stat && /mort-vivant|vase|élémentaire|créature artificielle|plante/i.test(stat.meta);
    hints.push({ tone: 'warn', text: brave ? `${active.name} est presque détruit mais ne connaît pas la peur : il se bat jusqu’au bout.` : `${active.name} n’a plus que ${active.hp} PV : il pourrait fuir, se rendre ou appeler à l’aide (Se désengager, puis courir).` });
  }

  if (target.adj && meleeAtk) {
    hints.push({ tone: 'attack', text: `Attaque ${target.f.name} au contact avec ${meleeAtk.name}${meleeAtk.toHit !== undefined ? ` (+${meleeAtk.toHit}` : ''}${meleeAtk.dice ? `, ${meleeAtk.dice}` : ''}${meleeAtk.toHit !== undefined ? ')' : ''}.` });
  } else if (rangedAtk && ranged > 0 && gap(active, target.f) <= ranged) {
    hints.push({ tone: 'attack', text: `Reste à distance et tire sur ${target.f.name} avec ${rangedAtk.name} (+${rangedAtk.toHit ?? 0}, ${rangedAtk.dice ?? '—'}). S’il est au contact d’un ennemi, désavantage : recule d’abord.` });
  } else if (target.steps <= speed && meleeAtk) {
    hints.push({ tone: 'move', text: `Avance de ${target.steps} case${target.steps > 1 ? 's' : ''} jusqu’à ${target.f.name}, puis ${meleeAtk.name}.` });
  } else {
    hints.push({ tone: 'move', text: `${target.f.name} est hors d’atteinte (${target.steps} cases pour ${speed} de vitesse) : Se précipiter, ou se mettre à couvert pour le prochain round.` });
  }
  if (multi) hints.push({ tone: 'power', text: `${multi.name} : ${multi.text.split('.')[0]}.` });
  for (const a of attacks.filter((x) => x.limited)) {
    if (active.spent?.includes(a.name)) hints.push({ tone: 'power', text: `${a.name} est utilisée (${a.limited}) : au début du tour, lance 1d6 pour voir si elle revient.` });
    else hints.push({ tone: 'power', text: `${a.name} est disponible (${a.limited}) : à sortir quand deux cibles ou plus sont proches, ou pour renverser le combat.` });
  }
  for (const [name, text] of stat?.traits ?? []) {
    if (/meute/i.test(name)) hints.push({ tone: 'power', text: `Tactique de meute : avantage si un allié est à 1,5 m de la cible. Vise ${target.f.name}${allies.some((a) => gap(a, target.f) <= 1) ? ', un allié y est déjà' : ' et rapproche un allié'}.` });
    else if (/embuscade|surprise|camouflage|discrétion/i.test(name)) hints.push({ tone: 'power', text: `${name} : ${text.split('.')[0]}.` });
    else if (/charge|élan|bond/i.test(name)) hints.push({ tone: 'power', text: `${name} : ${text.split('.')[0]}.` });
    else if (/régénération|résistance à la magie|sang/i.test(name)) hints.push({ tone: 'power', text: `${name} : ${text.split('.')[0]}.` });
  }
  return hints;
}

/** Conseils de rythme, pour tout le combat : équilibre, terrain, rebondissements. */
export function paceHints(c: Ctx): Hint[] {
  const hints: Hint[] = [];
  const pcs = c.b.tokens.filter((t) => t.kind === 'pc');
  const foes = c.b.tokens.filter((t) => t.kind === 'monster');
  const alive = foes.filter((t) => !isOut(t));
  const ratio = (list: BattleToken[]) => {
    const withHp = list.filter((t) => t.maxHp);
    return withHp.length ? withHp.reduce((s, t) => s + Math.max(0, t.hp ?? 0), 0) / withHp.reduce((s, t) => s + (t.maxHp ?? 0), 0) : 1;
  };
  if (!foes.length) return [{ tone: 'story', text: 'Aucune créature sur le plateau : lance une rencontre depuis la carte de navigation, ou ajoute des jetons.' }];
  if (foes.some((t) => t.init === undefined) || pcs.some((t) => t.init === undefined)) {
    hints.push({ tone: 'story', text: 'Initiative incomplète : « Lancer l’initiative » tire celle des créatures ; saisis celle des joueurs.' });
  }
  const hidden = alive.filter((t) => !t.visible);
  if (hidden.length) hints.push({ tone: 'story', text: `${hidden.length} créature${hidden.length > 1 ? 's' : ''} cachée${hidden.length > 1 ? 's' : ''} aux joueurs : révèle-les au moment le plus dramatique (embuscade, renforts).` });
  const foeRatio = ratio(alive.length ? foes : []), pcRatio = ratio(pcs);
  if (alive.length && foeRatio < 0.35 && c.b.round >= 3) hints.push({ tone: 'story', text: 'Les créatures sont à bout : propose une reddition, une fuite par un passage, ou un retournement (renfort, effondrement du plafond).' });
  if (pcs.length && pcRatio < 0.4) hints.push({ tone: 'warn', text: 'Le groupe souffre : une créature commet une erreur, ou une issue s’ouvre (passage secret, pont, galerie latérale).' });
  if (alive.length && foeRatio > 0.8 && c.b.round >= 3) hints.push({ tone: 'story', text: 'Le combat traîne : fais bouger les créatures (repli vers un meilleur terrain, cible isolée) ou ajoute un enjeu (le plafond craque, l’eau monte).' });
  if (c.grid) {
    if (c.grid.includes('X')) hints.push({ tone: 'story', text: 'Un gouffre est sur le plateau : une poussée (Athlétisme contre Athlétisme ou Acrobaties) peut y précipiter quelqu’un.' });
    if (c.grid.includes(':') || c.grid.includes('~')) hints.push({ tone: 'story', text: 'Éboulis et eau sont du terrain difficile : les créatures agiles s’y battent mieux, les lourdes s’y enlisent.' });
  }
  if (!alive.length) hints.push({ tone: 'story', text: 'Toutes les créatures sont tombées : décris la fin du combat, puis la fouille des lieux.' });
  return hints;
}

/** Résumé compact du combat pour l'IA : qui est où, en quel état, avec quelles armes. */
export function combatBrief(b: Battle, place?: string): string {
  const order = initiativeOrder(b.tokens);
  const lines = order.map((t) => {
    const s = statOf(t);
    const atk = attacksOf(s).map((a) => `${a.name}${a.toHit !== undefined ? ` +${a.toHit}` : ''}${a.dice ? ` ${a.dice}` : ''}${a.reach ? ` ${a.reach}c` : ''}${a.limited ? ` (${a.limited})` : ''}`).join('; ');
    const traits = (s?.traits ?? []).map(([n]) => n).join(', ');
    return `- ${t.id === b.turn ? '▶ ' : ''}${t.name} [${t.kind === 'pc' ? 'joueur' : t.kind === 'monster' ? 'créature' : 'autre'}] init ${t.init ?? '?'}, PV ${t.hp ?? '?'}/${t.maxHp ?? '?'}, CA ${t.ac ?? '?'}, case (${t.x},${t.y})${t.conditions?.length ? `, états: ${t.conditions.join(', ')}` : ''}${t.visible ? '' : ', caché aux joueurs'}${s ? `, ${s.meta}` : ''}${atk ? `. Actions: ${atk}` : ''}${traits ? `. Traits: ${traits}` : ''}`;
  });
  return [`Lieu : ${place ?? 'inconnu'}. Round ${b.round}. Grille ${b.cols}×${b.rows} cases de 5 pieds.`, ...lines].join('\n');
}
