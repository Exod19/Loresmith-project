import { addPlaces, emptyPlaceMap } from '../maps/placeMap.js';

/**
 * Forge d'univers : contenu et logique pure de l'assistant de création.
 * Aucune dépendance à React : tout ce qui est ici est testable.
 */

/** Exemples de styles : ils inspirent la description libre, ils ne la remplacent pas. */
export const STYLE_EXAMPLES = [
  'Fantasy sombre où chaque sort coûte un souvenir à celui qui le lance.',
  'Steampunk victorien sur des îles flottantes reliées par des dirigeables marchands.',
  'Space-opera décadent : des dynasties de marchands se disputent les vestiges d’un empire.',
  'Western fantastique, poussière et revolvers, où les morts ne restent pas toujours enterrés.',
  'Mythologie nordique réinventée, sagas, honneur et fin du monde imminente.',
  'Horreur cosmique dans une ville portuaire des années 1920.',
];

/** Exemples de spécificités : règles, tabous, objets, curiosités qui rendent l'univers unique. */
export const SPECIFIC_EXAMPLES = [
  'La magie est interdite par l’Église, mais tout le monde en use en secret.',
  'Il n’y a jamais de nuit : le soleil ne se couche plus depuis un siècle.',
  'Les dieux sont réels, mortels, et peuvent être tués.',
  'Aucune monnaie : tout s’échange contre des souvenirs ou des faveurs.',
];

/** Exemples de points de départ : l'univers se découvre ensuite, campagne après campagne. */
export const START_EXAMPLES = [
  'Brumecombe, un port de pêche que la brume avale chaque soir.',
  'Les Trois-Ponts, une ville marchande bâtie sur un fleuve sacré.',
  'Fort-Cendre, un avant-poste isolé au bord d’un désert de verre.',
  'Le marché flottant d’Aïzel, où l’on vend tout, même les noms.',
];

export const SIZES = [
  { id: 'lieu', label: 'Un lieu', hint: 'une cité, un donjon, une vallée' },
  { id: 'region', label: 'Une région', hint: 'quelques villes, un royaume' },
  { id: 'continent', label: 'Un continent', hint: 'plusieurs nations, des routes, des frontières' },
  { id: 'monde', label: 'Un monde', hint: 'planète entière, climats, océans' },
  { id: 'multivers', label: 'Plusieurs plans', hint: 'mondes reliés, voyages entre eux' },
];

export const COMPLEXITIES = [
  { id: 'leger', label: 'Léger', hint: 'quelques idées fortes, on improvise le reste' },
  { id: 'moyen', label: 'Équilibré', hint: 'factions, lieux et enjeux clairs' },
  { id: 'dense', label: 'Dense', hint: 'histoire, politique et règles détaillées' },
];

/**
 * Questions guidées, toujours optionnelles. `why` explique à quoi sert la réponse,
 * `example` montre le genre de réponse attendue.
 */
export const GUIDED_QUESTIONS = [
  {
    id: 'conflit',
    question: 'Quel est le conflit central de cet univers ?',
    why: 'Un univers vivant a une tension : c’est elle qui génère les aventures.',
    example: 'Deux guildes marchandes se disputent le dernier port libre avant l’hiver.',
  },
  {
    id: 'pouvoir',
    question: 'Qui détient le pouvoir, et comment le garde-t-il ?',
    why: 'Le pouvoir en place crée des alliés, des ennemis et des abus à renverser.',
    example: 'Un conseil de sept familles, qui contrôle l’eau potable.',
  },
  {
    id: 'magie',
    question: 'Quelle est la place de la magie, de la technologie ou du surnaturel ?',
    why: 'Fixe ce que les joueurs peuvent espérer, et ce qui doit rester mystérieux.',
    example: 'Rare, dangereuse et surveillée : un mage s’enregistre comme une arme.',
  },
  {
    id: 'peuples',
    question: 'Quels peuples ou espèces habitent cet univers, et comment cohabitent-ils ?',
    why: 'Donne de la variété aux personnages non-joueurs et des tensions sociales.',
    example: 'Humains des côtes, nains des mines sous embargo, esprits des marais.',
  },
  {
    id: 'peur',
    question: 'De quoi les gens ont-ils peur, ou que respectent-ils ?',
    why: 'Les peurs et les croyances colorent chaque scène, du marché au champ de bataille.',
    example: 'On craint la brume, qu’on dit habitée. On respecte ceux qui reviennent.',
  },
  {
    id: 'lieu',
    question: 'Quel lieu emblématique tout le monde connaît ?',
    why: 'Un point d’ancrage pour les premières séances et pour les joueurs.',
    example: 'La Tour des Cent Cloches, qu’on entend depuis tous les quartiers.',
  },
  {
    id: 'secret',
    question: 'Quel secret les personnages ignorent-ils (et que toi seul connais) ?',
    why: 'Le moteur des révélations. Il reste réservé au MJ.',
    example: 'Le roi est mort depuis dix ans ; son conseiller gouverne à sa place.',
  },
  {
    id: 'quotidien',
    question: 'À quoi ressemble la vie de tous les jours ?',
    why: 'Les détails concrets rendent un monde crédible : repas, métiers, fêtes, argent.',
    example: 'On troque plus qu’on n’achète. Les fêtes se font au solstice, sur les toits.',
  },
];

/** Brief vide de départ. */
export function emptyBrief() {
  return {
    mode: 'full', // 'full' : on bâtit tout maintenant · 'discover' : on part d'un lieu et le monde se découvre en jouant
    start: { name: '', description: '', tension: '' },
    name: '',
    style: '',
    size: '',
    complexity: '',
    specifics: '',
    answers: {},
    skipped: {},
    extraQuestions: [],
  };
}

const clean = (s) => String(s ?? '').trim();

/** Le nom est la seule information obligatoire pour forger l'univers. */
export function canForge(brief) {
  if (clean(brief?.name).length === 0) return false;
  return brief?.mode !== 'discover' || clean(brief?.start?.name).length > 0;
}

/** Combien de questions guidées (fixes ou ajoutées) ont reçu une réponse. */
export function answeredCount(brief) {
  return Object.values(brief?.answers || {}).filter((a) => clean(a)).length;
}

/** Questions mises de côté (« je ne sais pas encore »), sans réponse écrite. */
export function skippedCount(brief) {
  const skipped = brief?.skipped || {};
  return Object.keys(skipped).filter((id) => skipped[id] && !clean(brief?.answers?.[id])).length;
}

/** Texte « ton » d'une ligne pour l'univers : on garde la première phrase du style. */
export function toneFromBrief(brief) {
  const style = clean(brief?.style);
  if (!style) return '';
  const first = style.split(/(?<=[.!?])\s/)[0];
  return first.length > 160 ? `${first.slice(0, 157)}…` : first;
}

/**
 * Canon de départ composé sans IA, à partir des réponses.
 * Il reste un point de départ : le MJ le modifie ensuite dans la page Univers.
 */
export function composeLore(brief) {
  const out = [];
  const style = clean(brief?.style);
  if (style) out.push(style);

  const size = SIZES.find((s) => s.id === brief?.size);
  const cx = COMPLEXITIES.find((c) => c.id === brief?.complexity);
  const frame = [
    size && `Ampleur : ${size.label.toLowerCase()} (${size.hint}).`,
    cx && `Complexité : ${cx.label.toLowerCase()} (${cx.hint}).`,
  ].filter(Boolean);
  if (frame.length) out.push(frame.join(' '));

  const specifics = clean(brief?.specifics);
  if (specifics) out.push(`Spécificités : ${specifics}`);

  if (brief?.mode === 'discover') {
    const st = brief.start || {};
    const place = [clean(st.name), clean(st.description)].filter(Boolean).join(' : ');
    if (place) out.push(`Point de départ : ${place}`);
    if (clean(st.tension)) out.push(`Tension du moment : ${clean(st.tension)}`);
    out.push('Cet univers se découvre en jouant : seul le point de départ est connu pour l’instant. Le reste sera établi au fil des campagnes et des séances.');
  }

  const questions = [...GUIDED_QUESTIONS, ...(brief?.extraQuestions || [])];
  for (const q of questions) {
    const a = clean(brief?.answers?.[q.id]);
    if (a) out.push(`${q.question}\n${a}`);
  }
  return out.join('\n\n');
}

/** Objet univers prêt pour l'action ADD_UNIVERSE (le brief est conservé pour pouvoir y revenir). */
export function buildUniverse(brief, { id, createdAt, lore }) {
  return {
    id,
    name: clean(brief.name) || 'Nouvel univers',
    tone: toneFromBrief(brief),
    lore: lore ?? composeLore(brief),
    createdAt,
    growth: brief.mode === 'discover' ? 'discover' : 'built',
    forgeBrief: {
      mode: brief.mode || 'full',
      start: { ...(brief.start || {}) },
      style: clean(brief.style),
      size: brief.size || '',
      complexity: brief.complexity || '',
      specifics: clean(brief.specifics),
      answers: { ...brief.answers },
      skipped: { ...brief.skipped },
    },
  };
}

/** Prompt pour demander à l'IA des questions adaptées au brief. */
export function questionsPrompt(brief) {
  return {
    system:
      'Tu aides un maître de jeu à bâtir un univers de fiction jouable. Pose des questions courtes, concrètes, qui font avancer la création. Langue : français.',
    user: `Nom : ${clean(brief.name) || '(sans nom)'}
Style : ${clean(brief.style) || '(non précisé)'}
Spécificités : ${clean(brief.specifics) || '(aucune)'}

Propose 5 questions qui ne répètent pas celles-ci : ${GUIDED_QUESTIONS.map((q) => q.question).join(' | ')}

Retourne exactement : {"questions":[{"question":"…","why":"…","example":"…"}]}`,
  };
}

/** Normalise la réponse de l'IA en questions utilisables (jamais de plantage sur un JSON douteux). */
export function parseExtraQuestions(data) {
  const list = Array.isArray(data?.questions) ? data.questions : [];
  return list
    .map((q, i) => ({
      id: `ia-${i + 1}`,
      question: clean(q?.question),
      why: clean(q?.why),
      example: clean(q?.example),
    }))
    .filter((q) => q.question)
    .slice(0, 6);
}

/**
 * Tout ce qu'il faut créer à la fin de la forge. En mode « découverte », l'univers naît avec son lieu de départ :
 * une fiche de lieu et une carte des lieux découverts qui ne montre que lui. La suite vient des séances.
 * `nextView` : la page où atterrir (la création de campagne en mode découverte, le tableau de bord sinon).
 */
export function buildForgeResult(brief, lore, { newId, now }) {
  const universe = buildUniverse(brief, { id: newId(), createdAt: now, lore: lore ?? undefined });
  if (brief.mode !== 'discover') return { universe, entry: null, map: null, nextView: 'dashboard' };
  const st = brief.start || {};
  const entry = {
    id: newId(),
    archiveType: 'place',
    title: clean(st.name),
    subtitle: '',
    shortSummary: clean(st.description),
    body: [clean(st.description), clean(st.tension) && `Tension du moment : ${clean(st.tension)}`].filter(Boolean).join('\n\n'),
    secrets: '',
    tags: [],
    linkedCampaignIds: [],
    related: [],
    source: { kind: 'forge-start' },
    createdAt: now,
    updatedAt: now,
  };
  const { map } = addPlaces(emptyPlaceMap(universe.id, now), [entry], { now });
  return { universe, entry, map, nextView: 'forge' };
}
