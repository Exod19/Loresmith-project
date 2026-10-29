/**
 * Fiches créées à la volée (créature générique rapide, ou fiche écrite par l'IA) : gardées dans ce navigateur et
 * ajoutées au bestiaire SRD, pour que la carte de combat, le module Combat et les fiches de jeton les retrouvent.
 */
import { STATS, type Stat } from './statblocks';

const KEY = 'loresmith:custom-stats:v1';

function load(): Stat[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
for (const s of load()) if (s?.id && !STATS[s.id]) STATS[s.id] = s;

export function customStats(): Stat[] {
  return load();
}

/** Ajoute (ou remplace) une fiche personnelle et la rend disponible partout. */
export function registerStat(s: Stat): Stat {
  STATS[s.id] = s;
  try { localStorage.setItem(KEY, JSON.stringify([...load().filter((x) => x.id !== s.id), s])); } catch { /* stockage indisponible : la fiche reste pour la session */ }
  return s;
}

/** Valeurs de référence d'une créature selon son FP (Guide du maître, « Créer un monstre »). */
const BY_CR: Record<string, { ac: number; hp: number; atk: number; dmg: number; dc: number; xp: number; prof: number }> = {
  '0': { ac: 12, hp: 4, atk: 3, dmg: 1, dc: 13, xp: 10, prof: 2 },
  '1/8': { ac: 13, hp: 9, atk: 3, dmg: 3, dc: 13, xp: 25, prof: 2 },
  '1/4': { ac: 13, hp: 13, atk: 3, dmg: 5, dc: 13, xp: 50, prof: 2 },
  '1/2': { ac: 13, hp: 28, atk: 3, dmg: 7, dc: 13, xp: 100, prof: 2 },
  '1': { ac: 13, hp: 78, atk: 3, dmg: 11, dc: 13, xp: 200, prof: 2 },
  '2': { ac: 13, hp: 93, atk: 3, dmg: 17, dc: 13, xp: 450, prof: 2 },
  '3': { ac: 13, hp: 108, atk: 4, dmg: 23, dc: 13, xp: 700, prof: 2 },
  '4': { ac: 14, hp: 123, atk: 5, dmg: 29, dc: 14, xp: 1100, prof: 2 },
  '5': { ac: 15, hp: 138, atk: 6, dmg: 35, dc: 15, xp: 1800, prof: 3 },
  '6': { ac: 15, hp: 153, atk: 6, dmg: 41, dc: 15, xp: 2300, prof: 3 },
  '7': { ac: 15, hp: 168, atk: 6, dmg: 47, dc: 15, xp: 2900, prof: 3 },
  '8': { ac: 16, hp: 183, atk: 7, dmg: 53, dc: 16, xp: 3900, prof: 3 },
  '9': { ac: 16, hp: 198, atk: 7, dmg: 59, dc: 16, xp: 5000, prof: 4 },
  '10': { ac: 17, hp: 213, atk: 7, dmg: 65, dc: 16, xp: 5900, prof: 4 },
};
export const QUICK_CRS = Object.keys(BY_CR);

/**
 * Créature générique en un clic : un nom, un FP, un style (brute, tireur, lanceur de sorts). Les valeurs suivent la
 * table du Guide du maître ; les PV sont pris en bas de la fourchette pour un combat qui ne s'éternise pas.
 */
export function quickStat(name: string, cr: string, style: 'brute' | 'tireur' | 'mage' = 'brute'): Stat {
  const r = BY_CR[cr] ?? BY_CR['1'];
  const hp = Math.max(4, Math.round(cr === '1' ? 32 : cr.includes('/') || cr === '0' ? r.hp * 0.8 : r.hp * 0.55));
  const perHit = Math.max(1, Math.round(Number(cr) >= 3 ? r.dmg / 2 : r.dmg));
  const die = perHit >= 10 ? [2, 8] : perHit >= 6 ? [1, 10] : perHit >= 4 ? [1, 6] : [1, 4];
  const bonus = Math.max(0, perHit - Math.round(die[0] * (die[1] + 1) / 2));
  const dmg = `${perHit} (${die[0]}d${die[1]}${bonus ? ` + ${bonus}` : ''})`;
  const main = 10 + (r.atk - r.prof) * 2;
  const actions: [string, string][] = [];
  if (Number(cr) >= 3) actions.push(['Attaques multiples', 'Deux attaques.']);
  if (style === 'brute') actions.push(['Frappe', `Attaque d’arme au corps à corps : +${r.atk + 2} au toucher, allonge 1,5 m. Touché : ${dmg} contondants.`]);
  if (style === 'tireur') {
    actions.push(['Lame courte', `Attaque d’arme au corps à corps : +${r.atk + 2} au toucher, allonge 1,5 m. Touché : ${dmg} perforants.`]);
    actions.push(['Arc', `Attaque d’arme à distance : +${r.atk + 2} au toucher, portée 24/96 m. Touché : ${dmg} perforants.`]);
  }
  if (style === 'mage') {
    actions.push(['Trait mystique', `Attaque de sort à distance : +${r.atk + 2} au toucher, portée 36/36 m. Touché : ${dmg} de force.`]);
    actions.push(['Onde de choc (recharge 5–6)', `Chaque créature dans un cube de 4,5 m réussit une sauvegarde de Constitution DD ${r.dc} ou subit ${Math.round(r.dmg * 1.2)} dégâts de tonnerre et est repoussée de 3 m (moitié des dégâts si réussite).`]);
  }
  const abil: Stat['abil'] = style === 'brute' ? [main, 12, main, 8, 10, 8] : style === 'tireur' ? [10, main, 12, 10, 12, 8] : [8, 12, 12, main, 12, 10];
  return {
    id: `custom-${Date.now().toString(36)}`,
    name: name.trim() || 'Créature',
    meta: `Créature de taille M (fiche rapide, FP ${cr})`,
    ac: String(r.ac), hp: `${hp}`, speed: '9 m', abil,
    senses: `Perception passive ${10 + Math.floor((abil[4] - 10) / 2)}`, languages: '—',
    cr: `${cr} (${r.xp.toLocaleString('fr-CA')} PX)`,
    actions,
  };
}
