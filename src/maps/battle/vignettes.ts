/**
 * Vignettes de la carte de combat (public/images/combat-map/vignettes) : jetons, portraits de créatures,
 * icônes des lieux et des éléments cachés. Une créature de la fiche SRD a son portrait ; à défaut, un jeton générique.
 */
const BASE = `${import.meta.env.BASE_URL}images/combat-map/vignettes/`;
export const vignette = (name: string) => `${BASE}${name}.webp`;

/** Portrait de chaque créature de la fiche SRD (identifiant de la fiche → vignette). */
const CREATURE: Record<string, string> = {
  duergar: 'creature_duergar', drow: 'creature_drow', svirfneblin: 'creature_svirfneblin', commoner: 'creature_commoner',
  guard: 'creature_guard', bandit: 'creature_bandit', thug: 'creature_thug', scout: 'creature_scout', veteran: 'creature_veteran',
  priest: 'creature_priest', spy: 'creature_spy', 'giant-lizard': 'creature_giant_lizard', 'bat-swarm': 'creature_bat_swarm',
  'giant-centipede': 'creature_giant_centipede', 'giant-spider': 'creature_giant_spider', 'violet-fungus': 'creature_violet_fungus',
  shrieker: 'creature_shrieker', 'gray-ooze': 'creature_gray_ooze', grick: 'creature_grick', darkmantle: 'creature_darkmantle',
  'ochre-jelly': 'creature_ochre_jelly', 'gelatinous-cube': 'creature_gelatinous_cube', ghoul: 'creature_ghoul', shadow: 'creature_shadow',
  otyugh: 'creature_otyugh', 'umber-hulk': 'creature_umber_hulk', roper: 'creature_roper',
};

/** Icône de chaque catégorie de lieu. */
export const CATEGORY_IMG: Record<string, string> = {
  eau: 'lieu_eau', danger: 'lieu_danger', ruine: 'lieu_ruine', grotte: 'lieu_grotte', ressource: 'lieu_ressource', vivant: 'lieu_vivant',
  garde: 'lieu_garde', sanctuaire: 'lieu_sanctuaire', institution: 'lieu_institution', cite: 'lieu_cite', voie: 'lieu_voie', indetermine: 'lieu_indetermine',
};

/** Image d'un jeton : celle que le MJ a importée, sinon le portrait de la créature, sinon un jeton générique. */
export function tokenImage(t: { kind: 'pc' | 'monster' | 'other'; statId?: string; image?: string }): string {
  if (t.image) return t.image;
  if (t.kind === 'pc') return vignette('jeton_joueur');
  if (t.statId && CREATURE[t.statId]) return vignette(CREATURE[t.statId]);
  if (t.kind === 'monster') return vignette('jeton_creature_defaut');
  return vignette('jeton_autre');
}
