/**
 * Sauvegardes des héros : maîtrises (deux par classe en 5e, modifiables sur la fiche) et bonus total
 * (modificateur de caractéristique + bonus de maîtrise du niveau). Utilisé par la résolution des zones d'effet.
 */
import type { SaveAbility } from '../maps/battle/aoe';

export const SAVE_ABILITIES: { id: SaveAbility; label: string; key: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha' }[] = [
  { id: 'for', label: 'For', key: 'str' },
  { id: 'dex', label: 'Dex', key: 'dex' },
  { id: 'con', label: 'Con', key: 'con' },
  { id: 'int', label: 'Int', key: 'int' },
  { id: 'sag', label: 'Sag', key: 'wis' },
  { id: 'cha', label: 'Cha', key: 'cha' },
];

/** Maîtrises de sauvegarde de chaque classe (SRD 5.1), noms français et anglais. */
const CLASS_SAVES: [RegExp, SaveAbility[]][] = [
  [/barbar/, ['for', 'con']],
  [/barde|bard/, ['dex', 'cha']],
  [/clerc|cleric|pretre/, ['sag', 'cha']],
  [/druid/, ['int', 'sag']],
  [/guerri|fighter/, ['for', 'con']],
  [/moine|monk/, ['for', 'dex']],
  [/paladin/, ['sag', 'cha']],
  [/rodeur|ranger/, ['for', 'dex']],
  [/roublard|voleur|rogue/, ['dex', 'int']],
  [/occult|sorcier|warlock/, ['sag', 'cha']],
  [/ensorcel|sorc/, ['con', 'cha']],
  [/magicien|mage|wizard/, ['int', 'sag']],
  [/artificier|artificer/, ['con', 'int']],
];

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export type HeroLike = { cls?: string; level?: number | string; saveProfs?: SaveAbility[] } & Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number | string>>;

/** Maîtrises par défaut d'une classe (la première classe reconnue, pour un multiclassé). */
export function classSaves(cls = ''): SaveAbility[] {
  const c = fold(cls);
  return CLASS_SAVES.find(([re]) => re.test(c))?.[1] ?? [];
}

/** Maîtrises du héros : celles cochées sur sa fiche, sinon celles de sa classe. */
export function heroSaveProfs(h: HeroLike): SaveAbility[] {
  return Array.isArray(h.saveProfs) ? h.saveProfs : classSaves(h.cls);
}

export const profBonus = (level: number | string | undefined) => 2 + Math.floor((Math.max(1, Number(level) || 1) - 1) / 4);

/** Bonus de sauvegarde du héros pour chaque caractéristique. */
export function heroSaves(h: HeroLike) {
  const profs = heroSaveProfs(h);
  const pb = profBonus(h.level);
  return SAVE_ABILITIES.map((a) => {
    const mod = Math.floor(((Number(h[a.key]) || 10) - 10) / 2);
    const proficient = profs.includes(a.id);
    return { ...a, proficient, bonus: mod + (proficient ? pb : 0) };
  });
}

/** Texte des sauvegardes maîtrisées, au format des fiches (« Dex +5, Cha +4 »), lu par `saveBonus`. */
export function heroSavesText(h: HeroLike) {
  return heroSaves(h).filter((s) => s.proficient).map((s) => `${s.label} ${s.bonus >= 0 ? '+' : ''}${s.bonus}`).join(', ');
}
