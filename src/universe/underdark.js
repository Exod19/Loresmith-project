/**
 * Ce qui est propre à l'Underdark (Archives, Atlas des profondeurs, cité de Hosten Valak, strates, peuples et créatures
 * de l'Outreterre) ne sort jamais des univers Underdark. Un univers est « Underdark » quand le MJ l'a relié aux Archives
 * de l'Underdark (`universe.archives === 'underdark'`).
 *
 * Seul le niveau application (règles, interface, images communes de la banque) est partagé entre tous les univers.
 * JavaScript pur (testé par underdark.test.mjs).
 */

export const isUnderdarkUniverse = (u) => u?.archives === 'underdark';

/** Indices sûrs qu'un texte désigne un lieu ou un élément de l'Underdark (pas un simple mot comme « souterrain »). */
const MARKS = /\bunderdark\b|\boutreterre\b|hosten[\s-]*valak|atlas des profondeurs|\bentre-strates?\b|\bstrate\s+[ivx]+\s*[-–]\s*\d|\bmoriquendi\b|\bnorrianiss\b/i;

/**
 * Fiche de bibliothèque propre à l'Underdark : importée des Archives de l'Underdark (`sourceId`), ou dont le titre, le
 * sous-titre ou le résumé nomme un lieu de l'Underdark (« La Porte souterraine (Hosten Valak · Niveau 1) »).
 */
export function underdarkSpecific(entry) {
  if (!entry) return false;
  if (entry.sourceId || entry.source?.kind === 'archives') return true;
  return MARKS.test([entry.title, entry.name, entry.subtitle, entry.shortSummary, entry.summary].filter(Boolean).join(' '));
}

/** Texte libre (campagne, scène, note) qui nomme l'Underdark. */
export const mentionsUnderdark = (text) => MARKS.test(String(text ?? ''));

/** Les fiches qu'un univers peut utiliser : toutes dans un univers Underdark ; sinon, sans celles de l'Underdark. */
export const scopedEntries = (universe, entries = []) => (isUnderdarkUniverse(universe) ? entries : entries.filter((e) => !underdarkSpecific(e)));
