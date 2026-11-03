/**
 * Voies de la carte du monde, des plus sûres aux plus sauvages :
 * - route royale : pavée, entretenue, patrouillée, entre les grandes cités ;
 * - chemin : terre battue, entre une cité et ses voisines plus modestes ;
 * - sentier : vers un grand lieu de la nature (lac, lisière, lieu sauvage), depuis la route ou le village le plus proche ;
 * - piste forestière : un sentier qui s'enfonce sous les arbres, peu fréquenté ;
 * - sentier de montagne : vers les sommets, par les cols.
 * Chaque voie a sa trace (dessin, vitesse, repérage), son danger perçu et une courte description pour le MJ.
 *
 * JavaScript pur, testé par voies.test.mjs.
 */

export const VOIES = {
  royale: {
    trace: 'tunnel', label: 'Route royale', hwM: 7, danger: 1,
    text: 'Grande route pavée, bordée de bornes et de relais. Entretenue par la couronne et patrouillée par la garde : une patrouille croise le groupe toutes les quelques heures. Très fréquentée (marchands, courriers, pèlerins) ; les brigands s’y risquent rarement.',
  },
  chemin: {
    trace: 'galerie', label: 'Chemin', hwM: 4.5, danger: 1,
    text: 'Chemin de terre battue, creusé d’ornières, entretenu tant bien que mal par les villages. Patrouilles rares ; charrettes, paysans et colporteurs y passent chaque jour.',
  },
  sentier: {
    trace: 'boyau', label: 'Sentier', hwM: 1.5, danger: 2,
    text: 'Sentier de terre, à peine plus large qu’un homme, que seuls les gens du pays connaissent. Aucune patrouille ; on y croise un berger, un chasseur, parfois personne de la journée.',
  },
  piste: {
    trace: 'etroit', label: 'Piste forestière', hwM: 1, danger: 3,
    text: 'Piste envahie de racines et de ronces, qui se perd par endroits sous les arbres. Rarement empruntée : bûcherons, braconniers, et ce qui vit dans la forêt. Un pisteur la suit sans peine ; les autres risquent de s’égarer.',
  },
  col: {
    trace: 'etroit', label: 'Sentier de montagne', hwM: 1, danger: 3,
    text: 'Sentier caillouteux qui grimpe en lacets vers les cols. Éboulis, vent et à-pics ; praticable à la belle saison, dangereux sous la neige. Seuls les chevriers et les contrebandiers l’empruntent.',
  },
};

/**
 * Nature d'une route entre deux cités, selon leur population : route royale entre deux grandes cités (ou entre une très
 * grande cité, 5 000 habitants et plus, et une cité moyenne), chemin sinon.
 */
export function roadKind(popA = 0, popB = 0) {
  const lo = Math.min(popA, popB), hi = Math.max(popA, popB);
  return lo >= 2500 || (hi >= 5000 && lo >= 1200) ? 'royale' : 'chemin';
}

/**
 * Nature d'un sentier d'après le terrain qu'il traverse : `forest` (part moyenne sous les arbres, 0–1), `high` (part du
 * tracé au-dessus de 1 600 m), `toMountain` (il mène aux sommets).
 */
export function trailKind({ forest = 0, high = 0, toMountain = false } = {}) {
  if (toMountain || high > 0.25) return 'col';
  if (forest > 0.55) return 'piste';
  return 'sentier';
}

/** Titre d'une voie vers un lieu : « Sentier vers le lac Brumeux », « Piste forestière vers la forêt de Vaux ». */
export function trailTitle(kind, place) {
  const p = String(place ?? '').trim();
  const lower = p.replace(/^(Lac|Bois|Forêt|Monts|Mont)\b/, (w) => w.toLowerCase());
  const art = /^(lac|bois|mont)\b/.test(lower) ? 'le ' : /^forêt\b/.test(lower) ? 'la ' : /^monts\b/.test(lower) ? 'les ' : '';
  return `${VOIES[kind].label} vers ${art}${lower}`;
}
