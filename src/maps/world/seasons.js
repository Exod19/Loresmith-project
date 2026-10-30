/**
 * Saisons du monde (choisies par le MJ) : neige selon le climat, eaux gelées, affluence dans les bâtiments, et ce que
 * les gens disent en vous voyant entrer (« Fait froid dehors, hein ? »). Banques de phrases, sans IA.
 *
 * JavaScript pur, déterministe : testé par world.test.mjs.
 */

export const SEASONS = { printemps: '🌱 Printemps', ete: '☀ Été', automne: '🍂 Automne', hiver: '❄ Hiver' };

/** Température sous laquelle la carte du monde est enneigée, selon la saison (sans saison : les neiges éternelles). */
export const SNOW_LINE = { hiver: 0.45, automne: 0.22, printemps: 0.22, ete: 0.1 };

/**
 * Neige et glace d'une cité selon la saison et son climat : `snow` (part du sol couverte de congères, terrain
 * difficile au combat) et `frozen` (« tout » : rivière et mer gelées ; « rivieres » : seulement les rivières). La glace se
 * traverse à pied, en terrain difficile.
 */
export function snowOf(season, climate) {
  if (season === 'hiver') return climate === 'froid' ? { snow: 0.35, frozen: 'tout' } : climate === 'tempere' ? { snow: 0.15, frozen: 'rivieres' } : {};
  if ((season === 'automne' || season === 'printemps') && climate === 'froid') return { snow: 0.06 };
  return {};
}

/** Affluence selon la saison : on se réfugie à la taverne l'hiver, on est aux champs l'été. */
const CROWD = {
  hiver: { taverne: 1.5, auberge: 1.4, temple: 1.3, echoppe: 0.7, ferme: 1.4, maison: 1.3, forge: 1.2 },
  ete: { taverne: 1.2, echoppe: 1.2, ferme: 0.4, temple: 0.8 },
  automne: { echoppe: 1.3, ferme: 0.7, entrepot: 1.4 },
  printemps: { ferme: 0.5, echoppe: 1.1 },
};
export const crowdFactor = (season, type) => CROWD[season]?.[type] ?? 1;
/** Part des gens qui restent chez eux (étage) : plus grande l'hiver. */
export const homeBonus = (season) => (season === 'hiver' ? 0.15 : season === 'ete' ? -0.1 : 0);

/** Groupe de répliques d'un rôle. */
const GROUP = {
  tavernier: 'accueil', serveur: 'accueil',
  marchand: 'marchand', artisan: 'marchand', colporteur: 'marchand', manutentionnaire: 'marchand',
  forgeron: 'forge', apprenti: 'forge', palefrenier: 'forge',
  pretre: 'pretre', acolyte: 'pretre', fidele: 'pretre', pelerin: 'pretre',
  garde: 'garde', soldat: 'garde', sergent: 'garde', veilleur: 'garde', geolier: 'garde',
  fermier: 'maison', habitant: 'maison', maitre_maison: 'maison', domestique: 'maison', intendant: 'maison', serviteur: 'maison',
  buveur: 'client', habitue: 'client', client: 'client', joueur: 'client', voyageur: 'client', badaud: 'client', membre: 'client',
  mercenaire: 'client', barde: 'client', courtisan: 'client', solliciteur: 'client', visiteur: 'client',
  mendiant: 'mendiant',
};

/** Répliques par saison et par groupe ; `groupe:climat` remplace la réplique ordinaire sous ce climat. */
const LINES = {
  hiver: {
    accueil: ['Fait froid dehors, hein ? Viens te réchauffer près du feu.', 'Ferme la porte, tu fais entrer l’hiver !', 'Un vin chaud aux épices pour te dégeler ?', 'Secoue ta neige dehors, pas sur mon plancher.'],
    'accueil:chaud': ['Encore cette pluie… Entre te sécher.', 'La saison des pluies, que veux-tu. Une soupe chaude ?'],
    marchand: ['Des mitaines ? Des bas de laine ? Tout ce qu’il faut pour l’hiver.', 'Le bois de chauffage a doublé de prix, j’y peux rien.'],
    'marchand:chaud': ['Les caravanes se font rares avec les pluies.'],
    forge: ['Approche, la forge est l’endroit le plus chaud de la ville.', 'Des crampons à glace pour les chevaux ? C’est la saison.'],
    pretre: ['Que la lumière vous garde des longues nuits.', 'On sert la soupe aux démunis après l’office.'],
    garde: ['Sale temps pour monter la garde.', 'J’sens plus mes orteils.'],
    'garde:chaud': ['Ces pluies n’en finissent plus.'],
    maison: ['Les bêtes sont rentrées, on attend le dégel.', 'Pourvu que les réserves tiennent jusqu’au printemps.'],
    client: ['Brr… je reste ici jusqu’au printemps.', 'Paraît que le col est fermé par la neige.'],
    'client:chaud': ['Les routes sont des rivières de boue.'],
    mendiant: ['Une pièce pour un peu de chaleur ?'],
  },
  ete: {
    accueil: ['Viens te rafraîchir avec une pinte !', 'Bière fraîche, tout droit de la cave.', 'Quelle chaleur ! Assieds-toi à l’ombre.'],
    'accueil:chaud': ['Ferme vite, la chaleur entre ! De l’eau fraîche ?', 'À cette heure-ci, seuls les fous marchent au soleil. Assieds-toi.'],
    'accueil:froid': ['Profite du soleil, ça dure jamais longtemps par ici !'],
    marchand: ['Fruits frais du jour !', 'Chapeaux de paille, pour le soleil !'],
    forge: ['Fait chaud comme dans un four, ici. Littéralement.'],
    pretre: ['La moisson approche ; prions pour qu’il ne grêle pas.'],
    garde: ['Sous ce casque, je cuis.'],
    maison: ['Les foins sont rentrés, la moisson arrive.'],
    'maison:chaud': ['Le puits baisse de jour en jour.'],
    client: ['Trop chaud pour faire quoi que ce soit.', 'Les routes sont sèches : bonne saison pour voyager.'],
    mendiant: ['Un peu d’eau, par pitié ?'],
  },
  automne: {
    accueil: ['Le cidre nouveau est arrivé, tu goûtes ?', 'Les jours raccourcissent… une soupe à la courge ?'],
    'accueil:froid': ['Les premières neiges arrivent. Profite du feu tant qu’il reste du bois.'],
    marchand: ['Pommes, noix, châtaignes : la récolte est bonne.'],
    forge: ['Faut ferrer les chevaux avant les gels.'],
    pretre: ['C’est le temps de rendre grâce pour les récoltes.'],
    garde: ['Les feuilles mortes cachent les traces, faut ouvrir l’œil.'],
    maison: ['On rentre les dernières récoltes avant les pluies.'],
    client: ['Paraît que l’hiver sera rude cette année.'],
    mendiant: ['Les nuits fraîchissent… une pièce ?'],
  },
  printemps: {
    accueil: ['Enfin le dégel ! Ça mérite une tournée.', 'Les routes rouvrent, les voyageurs reviennent. Entre !'],
    marchand: ['Nouvelles marchandises, arrivées avec les premières caravanes !'],
    forge: ['Les charrues à réparer, c’est la saison.'],
    pretre: ['Bénissons les semailles.'],
    garde: ['De la boue partout… les routes sont impraticables.'],
    maison: ['On sème, si la pluie veut bien s’arrêter.'],
    client: ['Ça sent bon le printemps, hein ?'],
    mendiant: ['Le pire de l’hiver est passé, grâce aux bonnes âmes.'],
  },
};

/** Réplique de saison d'un rôle (ou `undefined`) : stable pour un même tirage. */
export function seasonLine(roleKey, season, climate, rand) {
  const lines = LINES[season];
  const g = GROUP[roleKey];
  if (!lines || !g) return undefined;
  const pool = lines[`${g}:${climate}`] ?? lines[g];
  return pool?.[Math.floor(rand() * pool.length)];
}

/** Les rôles qui accueillent toujours le visiteur (les autres parlent une fois sur trois). */
export const greets = (roleKey) => ['accueil', 'marchand', 'forge', 'pretre', 'garde'].includes(GROUP[roleKey]);
