/**
 * Zones d'effet des sorts (D&D 5e) : sphère (ou cylindre), cône, ligne, cube. Une case est touchée si son centre est dans
 * la forme (même règle que le terrain) et si rien ne coupe la ligne d'effet depuis l'origine : mur, porte fermée, roche,
 * rocher ou arbre. Une herse laisse passer les sorts.
 */
import { OBJECT_DEF, TERRAIN_DEF, type SurfaceRules } from './surface';

export type AoeShape = 'sphere' | 'cone' | 'ligne' | 'cube';
export interface BattleAoe {
  id: string;
  shape: AoeShape;
  /** Rayon (sphère), longueur (cône, ligne) ou côté (cube), en pieds. */
  size: number;
  /** Origine, en cases (continu) ; direction en degrés (0 = vers la droite). */
  x: number; y: number; dir: number;
  label?: string;
  /** Dégâts de la zone (facultatif) : résolus à la pose, pour chaque créature touchée. */
  effect?: AoeEffect;
}

export const AOE_SHAPES: { shape: AoeShape; label: string; sizes: number[]; hint: string }[] = [
  { shape: 'sphere', label: 'Sphère', sizes: [5, 10, 15, 20, 30, 40], hint: 'Rayon autour d’un point (boule de feu : 20 pi).' },
  { shape: 'cone', label: 'Cône', sizes: [15, 30, 60], hint: 'Depuis le lanceur ; aussi large que long (mains brûlantes : 15 pi).' },
  { shape: 'ligne', label: 'Ligne', sizes: [30, 60, 100, 120], hint: 'Large de 5 pi (éclair : 100 pi).' },
  { shape: 'cube', label: 'Cube', sizes: [5, 10, 15, 20, 30], hint: 'Depuis une face (vague tonnante : 15 pi).' },
];

/** Demi-angle d'un cône 5e : sa largeur égale sa distance à l'origine. */
const CONE_HALF = Math.atan(0.5);

/** Le point (en cases) est-il dans la forme ? */
export function aoeHas(a: BattleAoe, px: number, py: number, feetPerCell = 5): boolean {
  const L = a.size / feetPerCell;
  const dx = px - a.x, dy = py - a.y;
  if (a.shape === 'sphere') return Math.hypot(dx, dy) <= L + 1e-6;
  const t = (a.dir * Math.PI) / 180;
  const u = dx * Math.cos(t) + dy * Math.sin(t), v = -dx * Math.sin(t) + dy * Math.cos(t);
  if (a.shape === 'cone') return u > 0 && Math.hypot(u, v) <= L + 1e-6 && Math.abs(Math.atan2(v, u)) <= CONE_HALF + 1e-6;
  if (a.shape === 'ligne') return u >= 0 && u <= L && Math.abs(v) <= 0.5;
  return u >= 0 && u <= L && Math.abs(v) <= L / 2;
}

/** La ligne d'effet entre l'origine et le centre d'une case est-elle libre ? */
function clearLine(r: SurfaceRules, ax: number, ay: number, cx: number, cy: number) {
  const solid = (k?: string) => k === 'mur' || k === 'porte';
  const v = (x: number, y: number, sx: number) => r.walls[`v${sx > 0 ? x + 1 : x},${y}`];
  const h = (x: number, y: number, sy: number) => r.walls[`h${x},${sy > 0 ? y + 1 : y}`];
  const steps = Math.max(2, Math.ceil(Math.hypot(cx - ax, cy - ay) * 6));
  const target = Math.floor(cy) * r.cols + Math.floor(cx);
  let px = Math.floor(ax), py = Math.floor(ay);
  for (let i = 1; i <= steps; i++) {
    const x = Math.floor(ax + ((cx - ax) * i) / steps), y = Math.floor(ay + ((cy - ay) * i) / steps);
    if (x !== px || y !== py) {
      const sx = Math.sign(x - px), sy = Math.sign(y - py);
      if (sx && !sy && solid(v(px, py, sx))) return false;
      if (sy && !sx && solid(h(px, py, sy))) return false;
      if (sx && sy && (solid(v(px, py, sx)) || solid(h(px + sx, py, sy))) && (solid(h(px, py, sy)) || solid(v(px, py + sy, sx)))) return false;
      px = x; py = y;
    }
    const i2 = y * r.cols + x;
    if (i2 === target) continue;
    const c = r.cells[i2];
    if (c && (TERRAIN_DEF[c.t]?.mode === 'bloque' || (c.obs && OBJECT_DEF[c.obs.kind]?.opaque))) return false;
  }
  return true;
}

/** Cases touchées par la zone. */
export function aoeCells(a: BattleAoe, r: SurfaceRules, feetPerCell = 5): number[] {
  const out: number[] = [];
  const L = a.size / feetPerCell + 1;
  for (let y = Math.max(0, Math.floor(a.y - L)); y <= Math.min(r.rows - 1, Math.ceil(a.y + L)); y++) {
    for (let x = Math.max(0, Math.floor(a.x - L)); x <= Math.min(r.cols - 1, Math.ceil(a.x + L)); x++) {
      if (!aoeHas(a, x + 0.5, y + 0.5, feetPerCell)) continue;
      const c = r.cells[y * r.cols + x];
      if (c && TERRAIN_DEF[c.t]?.mode === 'bloque') continue;
      if (clearLine(r, a.x, a.y, x + 0.5, y + 0.5)) out.push(y * r.cols + x);
    }
  }
  return out;
}

/** Contour exact de la forme (pour le dessin), en cases. */
export function aoeOutline(a: BattleAoe, feetPerCell = 5): string {
  const L = a.size / feetPerCell;
  if (a.shape === 'sphere') return `M${a.x - L} ${a.y}a${L} ${L} 0 1 0 ${2 * L} 0a${L} ${L} 0 1 0 ${-2 * L} 0Z`;
  const t = (a.dir * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  const P = (u: number, v: number) => `${(a.x + u * c - v * s).toFixed(3)} ${(a.y + u * s + v * c).toFixed(3)}`;
  if (a.shape === 'cone') {
    const pts = [P(0, 0)];
    for (let k = -8; k <= 8; k++) { const ang = (k / 8) * CONE_HALF; pts.push(P(L * Math.cos(ang), L * Math.sin(ang))); }
    return `M${pts.join('L')}Z`;
  }
  const w = a.shape === 'ligne' ? 0.5 : L / 2;
  return `M${P(0, -w)}L${P(L, -w)}L${P(L, w)}L${P(0, w)}Z`;
}

export const AOE_LABEL: Record<AoeShape, string> = { sphere: 'sphère', cone: 'cône', ligne: 'ligne', cube: 'cube' };
export const aoeName = (a: BattleAoe) => `${a.label ? `${a.label} · ` : ''}${AOE_LABEL[a.shape]} ${a.size} pi`;

/** Vue d'une zone (dessin, chez le MJ comme chez les joueurs). */
export function aoeView(a: BattleAoe, r: SurfaceRules, feetPerCell = 5, draft = false) {
  return { id: a.id, label: aoeName(a), outline: aoeOutline(a, feetPerCell), cells: aoeCells(a, r, feetPerCell), at: [a.x, a.y] as [number, number], draft };
}

/* ——— Effet d'une zone : dégâts, sauvegarde, camp épargné ——— */

export type SaveAbility = 'for' | 'dex' | 'con' | 'int' | 'sag' | 'cha';
export interface AoeEffect {
  /** Dés de dégâts (« 8d6 »), un seul jet pour toute la zone (règle 5e). */
  dice: string;
  /** Nature des dégâts (cf. DAMAGE_TYPES). */
  type: string;
  /** Jet de sauvegarde : caractéristique, DD, moitié des dégâts en cas de réussite (sinon aucun). */
  save?: { ability: SaveAbility; dc: number; half: boolean };
  /** Camp épargné (sort sculpté, souffle orienté) ; par défaut la zone touche tout le monde, alliés compris. */
  spare?: 'pc' | 'monster';
}

/** Les 13 natures de dégâts de D&D 5e, avec le radical cherché dans les résistances des fiches. */
export const DAMAGE_TYPES: { id: string; label: string; stem: string }[] = [
  { id: 'acide', label: 'Acide', stem: 'acid' },
  { id: 'contondant', label: 'Contondant', stem: 'contond' },
  { id: 'feu', label: 'Feu', stem: 'feu' },
  { id: 'foudre', label: 'Foudre', stem: 'foudre' },
  { id: 'force', label: 'Force', stem: 'force' },
  { id: 'froid', label: 'Froid', stem: 'froid' },
  { id: 'necrotique', label: 'Nécrotique', stem: 'necrot' },
  { id: 'perforant', label: 'Perforant', stem: 'perfor' },
  { id: 'poison', label: 'Poison', stem: 'poison' },
  { id: 'psychique', label: 'Psychique', stem: 'psych' },
  { id: 'radiant', label: 'Radiant', stem: 'radiant' },
  { id: 'tonnerre', label: 'Tonnerre', stem: 'tonnerre' },
  { id: 'tranchant', label: 'Tranchant', stem: 'tranch' },
];
export const SAVE_LABEL: Record<SaveAbility, string> = { for: 'Force', dex: 'Dextérité', con: 'Constitution', int: 'Intelligence', sag: 'Sagesse', cha: 'Charisme' };

/** Sorts et souffles classiques (SRD 5.1) : forme, taille et effet. Le DD reste à régler selon le lanceur. */
export const AOE_PRESETS: { label: string; shape: AoeShape; size: number; effect: AoeEffect }[] = [
  { label: 'Boule de feu', shape: 'sphere', size: 20, effect: { dice: '8d6', type: 'feu', save: { ability: 'dex', dc: 15, half: true } } },
  { label: 'Mains brûlantes', shape: 'cone', size: 15, effect: { dice: '3d6', type: 'feu', save: { ability: 'dex', dc: 13, half: true } } },
  { label: 'Éclair', shape: 'ligne', size: 100, effect: { dice: '8d6', type: 'foudre', save: { ability: 'dex', dc: 15, half: true } } },
  { label: 'Cône de froid', shape: 'cone', size: 60, effect: { dice: '8d8', type: 'froid', save: { ability: 'con', dc: 17, half: true } } },
  { label: 'Vague tonnante', shape: 'cube', size: 15, effect: { dice: '2d8', type: 'tonnerre', save: { ability: 'con', dc: 13, half: true } } },
  { label: 'Fracassement', shape: 'sphere', size: 10, effect: { dice: '3d8', type: 'tonnerre', save: { ability: 'con', dc: 14, half: true } } },
  { label: 'Colonne de flamme', shape: 'sphere', size: 10, effect: { dice: '8d6', type: 'feu', save: { ability: 'dex', dc: 16, half: true } } },
  { label: 'Cercle de mort', shape: 'sphere', size: 60, effect: { dice: '8d6', type: 'necrotique', save: { ability: 'con', dc: 17, half: true } } },
  { label: 'Souffle de jeune dragon rouge', shape: 'cone', size: 30, effect: { dice: '16d6', type: 'feu', save: { ability: 'dex', dc: 17, half: true } } },
  { label: 'Souffle de jeune dragon blanc', shape: 'cone', size: 30, effect: { dice: '10d8', type: 'froid', save: { ability: 'con', dc: 15, half: true } } },
  { label: 'Souffle de jeune dragon noir', shape: 'ligne', size: 30, effect: { dice: '11d8', type: 'acide', save: { ability: 'dex', dc: 14, half: true } } },
  { label: 'Spores (champignon violet)', shape: 'sphere', size: 10, effect: { dice: '2d6', type: 'poison', save: { ability: 'con', dc: 12, half: true } } },
];

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Multiplicateur de dégâts selon la fiche : immunité 0, résistance ½, vulnérabilité ×2. Un sort est magique : une
 * résistance « aux attaques non magiques » ne s'applique pas.
 */
export function damageFactor(type: string, sheet: { resist?: string; immune?: string; vuln?: string }) {
  const stem = DAMAGE_TYPES.find((d) => d.id === type)?.stem ?? fold(type);
  const has = (text?: string) => !!text && fold(text).split(/[;\n]/).some((seg) => seg.includes(stem) && !/non magi/.test(seg));
  return has(sheet.immune) ? 0 : has(sheet.resist) ? 0.5 : has(sheet.vuln) ? 2 : 1;
}

/** Bonus de sauvegarde : celui écrit sur la fiche (« Dex +5 »), sinon le modificateur de la caractéristique. */
export function saveBonus(ability: SaveAbility, sheet: { saves?: string; score?: number }) {
  const keys: Record<SaveAbility, RegExp> = { for: /\b(for|str)\w*\.?\s*([+-]\d+)/, dex: /\bdex\w*\.?\s*([+-]\d+)/, con: /\bcon\w*\.?\s*([+-]\d+)/, int: /\bint\w*\.?\s*([+-]\d+)/, sag: /\b(sag|wis)\w*\.?\s*([+-]\d+)/, cha: /\bcha\w*\.?\s*([+-]\d+)/ };
  const m = keys[ability].exec(fold(sheet.saves ?? ''));
  if (m) return { bonus: Number(m[m.length - 1]), proficient: true };
  return { bonus: Math.floor(((sheet.score ?? 10) - 10) / 2), proficient: false };
}

/** Dégâts subis par une créature : sauvegarde réussie (moitié ou rien), puis résistance. */
export function aoeDamage(raw: number, effect: AoeEffect, saved: boolean | null, factor: number) {
  const base = effect.save && saved ? (effect.save.half ? Math.floor(raw / 2) : 0) : raw;
  return Math.floor(base * factor);
}
