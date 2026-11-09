/**
 * Genres des univers et des images de la banque.
 *
 * Deux axes indépendants :
 *  - le **genre** de l'univers (fantasy, steampunk, moderne…) : un univers en a un ou plusieurs (`universe.genres`) ;
 *  - le **monde** d'un lieu dans l'univers (surface, Outreterre, mer…) : le champ `region` des images (cf. banque.js).
 *
 * Une image porte `genres` : `['*']` pour tous les univers (une texture d'herbe, un rocher), ou les genres où elle a sa
 * place (`['fantasy']` pour un centaure, `['steampunk', 'moderne']` pour un réverbère à gaz…). Loresmith ne la propose
 * d'office que si l'un de ses genres est celui de l'univers ; le MJ, lui, peut toujours la poser à la main.
 *
 * JavaScript pur (testé par genres.test.mjs).
 */

/** Genres connus, dans l'ordre des réglages. Un nouveau genre s'ajoute ici et dans les dossiers du Drive. */
export const GENRES = [
  { id: 'fantasy', label: 'Fantasy (médiévale, magie)' },
  { id: 'steampunk', label: 'Steampunk' },
  { id: 'historique', label: 'Historique réaliste' },
  { id: 'moderne', label: 'Moderne, contemporain' },
  { id: 'postapo', label: 'Post-apocalyptique' },
  { id: 'scifi', label: 'Science-fiction, futuriste' },
  { id: 'cyberpunk', label: 'Cyberpunk' },
  { id: 'pirate', label: 'Pirates, flibuste' },
  { id: 'horreur', label: 'Horreur' },
];
/** Toutes les familles d'univers : une image commune (sol, eau, roche, végétation ordinaire). */
export const TOUS = '*';
/** Genre des univers et des images d'avant les genres : tout Loresmith était de la fantasy. */
export const GENRE_DEFAUT = 'fantasy';

/** Genres d'un univers (au moins un). */
export const genresOf = (universe) => (Array.isArray(universe?.genres) && universe.genres.length ? universe.genres : [GENRE_DEFAUT]);

/** L'image a-t-elle sa place dans un univers de ces genres ? */
export function fitsGenres(img, genres) {
  const g = Array.isArray(img?.genres) && img.genres.length ? img.genres : [GENRE_DEFAUT];
  return g.includes(TOUS) || g.some((x) => genres.includes(x));
}
