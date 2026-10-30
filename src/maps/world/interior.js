/**
 * Intérieurs des bâtiments de la carte du monde.
 *
 * Un bâtiment donne toujours le même intérieur : la graine vient de son emplacement, le gabarit de son type
 * (une taverne a sa salle commune, son comptoir, sa cuisine et son cellier ; un temple sa nef et son autel…),
 * et ses dimensions de son empreinte sur le plan de la cité (agrandie si elle est trop petite pour le gabarit).
 * Les PNJ du lieu sont placés selon leur rôle : la tenancière derrière le comptoir, le forgeron à l'enclume.
 *
 * JavaScript pur : testé par world.test.mjs.
 */
import { crowdFactor, greets, homeBonus, seasonLine } from './seasons.js';
import { SLOT_TYPES, hashSeed, rng } from './generate.js';

const W = 1240, H = 1000;
const TAU2 = Math.PI * 2;
const r1 = (v) => Math.round(v * 10) / 10;
const r5 = (v) => Math.round(v * 1e5) / 1e5;
const f1 = (v) => (Math.round(v * 10) / 10).toString();
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Gabarits. Coordonnées relatives à l'intérieur du bâtiment : u de 0 à 1 le long de la façade, v de 0 (mur du fond)
 * à 1 (façade, où s'ouvre la porte). `walls` : cloisons (les ouvertures sont les trous entre deux tronçons).
 * `items` : [genre, u0, v0, u1, v1, nom?]. `spots` : où se tiennent les PNJ selon leur rôle.
 */
const TPL = {
  taverne: {
    min: [12, 10],
    rooms: [['Salle commune', 0, 0.38, 1, 1], ['Cuisine', 0, 0, 0.55, 0.38], ['Cellier', 0.55, 0, 1, 0.38]],
    walls: [[0, 0.38, 0.2, 0.38], [0.32, 0.38, 0.7, 0.38], [0.82, 0.38, 1, 0.38], [0.55, 0, 0.55, 0.38]],
    items: [['counter', 0.1, 0.45, 0.6, 0.51, 'Comptoir'], ['hearth', 0.92, 0.52, 1, 0.74, 'Cheminée'], ['tables', 0.06, 0.6, 0.86, 0.9],
      ['barrels', 0.72, 0.04, 0.96, 0.22, 'Tonneaux'], ['table', 0.08, 0.1, 0.42, 0.2], ['hearth', 0, 0.04, 0.07, 0.22, 'Four']],
    spots: { counter: [0.35, 0.42], hearth: [0.85, 0.63], kitchen: [0.27, 0.27], back: [0.78, 0.33], main: [0.45, 0.76], door: [0.5, 0.95] },
  },
  auberge: {
    min: [14, 12],
    rooms: [['Salle commune', 0, 0.4, 1, 1], ['Cuisine', 0, 0, 0.45, 0.4], ['Escalier des chambres', 0.45, 0, 0.7, 0.4], ['Réserve', 0.7, 0, 1, 0.4]],
    walls: [[0, 0.4, 0.18, 0.4], [0.3, 0.4, 0.5, 0.4], [0.64, 0.4, 0.78, 0.4], [0.9, 0.4, 1, 0.4], [0.45, 0, 0.45, 0.4], [0.7, 0, 0.7, 0.4]],
    items: [['counter', 0.08, 0.47, 0.5, 0.53, 'Comptoir'], ['hearth', 0.93, 0.5, 1, 0.72, 'Cheminée'], ['tables', 0.06, 0.62, 0.88, 0.9],
      ['stair', 0.5, 0.05, 0.65, 0.34, 'Escalier'], ['barrels', 0.73, 0.05, 0.97, 0.22, 'Tonneaux'], ['table', 0.06, 0.1, 0.36, 0.2]],
    spots: { counter: [0.3, 0.44], hearth: [0.86, 0.62], kitchen: [0.22, 0.28], back: [0.84, 0.34], main: [0.5, 0.76], door: [0.5, 0.95] },
  },
  echoppe: {
    min: [7, 8],
    rooms: [['Boutique', 0, 0.45, 1, 1], ['Arrière-boutique', 0, 0, 1, 0.45]],
    walls: [[0, 0.45, 0.62, 0.45], [0.82, 0.45, 1, 0.45]],
    items: [['counter', 0.15, 0.55, 0.85, 0.62, 'Comptoir'], ['shelf', 0, 0.62, 0.07, 0.95, 'Étals'], ['shelf', 0.93, 0.62, 1, 0.95, 'Étals'], ['crates', 0.05, 0.05, 0.6, 0.38, 'Réserve']],
    spots: { counter: [0.5, 0.52], back: [0.75, 0.25], main: [0.5, 0.8], door: [0.5, 0.95] },
  },
  forge: {
    min: [9, 8],
    rooms: [['Atelier', 0, 0.4, 1, 1], ['Logis', 0, 0, 1, 0.4]],
    walls: [[0, 0.4, 0.65, 0.4], [0.85, 0.4, 1, 0.4]],
    items: [['hearth', 0.05, 0.45, 0.32, 0.62, 'Forge'], ['anvil', 0.42, 0.6, 0.52, 0.68, 'Enclume'], ['trough', 0.06, 0.7, 0.26, 0.8, 'Bac de trempe'], ['rack', 0.93, 0.45, 1, 0.92, 'Râtelier'], ['bed', 0.05, 0.06, 0.3, 0.32], ['table', 0.55, 0.1, 0.85, 0.22]],
    spots: { anvil: [0.47, 0.74], hearth: [0.36, 0.55], back: [0.7, 0.3], main: [0.6, 0.8], door: [0.5, 0.95] },
  },
  temple: {
    min: [12, 16],
    rooms: [['Nef', 0, 0.2, 1, 1], ['Chœur', 0, 0, 0.72, 0.2], ['Sacristie', 0.72, 0, 1, 0.2]],
    walls: [[0.72, 0, 0.72, 0.13], [0.72, 0.2, 0.8, 0.2], [0.92, 0.2, 1, 0.2]],
    items: [['altar', 0.26, 0.06, 0.46, 0.12, 'Autel'], ['benches', 0.1, 0.3, 0.9, 0.86], ['shelf', 0.75, 0.02, 0.98, 0.07, 'Armoire aux reliques']],
    spots: { altar: [0.36, 0.16], back: [0.86, 0.1], main: [0.5, 0.9], door: [0.5, 0.95] },
  },
  maison: {
    min: [6, 7],
    rooms: [['Salle', 0, 0.45, 1, 1], ['Chambre', 0, 0, 1, 0.45]],
    walls: [[0, 0.45, 0.6, 0.45], [0.82, 0.45, 1, 0.45]],
    items: [['hearth', 0.86, 0.55, 1, 0.75, 'Âtre'], ['table', 0.2, 0.62, 0.6, 0.76], ['bed', 0.06, 0.06, 0.45, 0.36]],
    spots: { hearth: [0.75, 0.66], back: [0.6, 0.25], main: [0.45, 0.85], door: [0.5, 0.95] },
  },
  manoir: {
    min: [16, 13],
    rooms: [['Vestibule', 0.32, 0.55, 0.68, 1], ['Salon', 0, 0.55, 0.32, 1], ['Cuisine', 0.68, 0.55, 1, 1], ['Bibliothèque', 0, 0, 0.5, 0.55], ['Chambre', 0.5, 0, 1, 0.55]],
    walls: [[0, 0.55, 0.12, 0.55], [0.22, 0.55, 0.42, 0.55], [0.58, 0.55, 0.78, 0.55], [0.88, 0.55, 1, 0.55], [0.32, 0.55, 0.32, 0.7], [0.32, 0.82, 0.32, 1], [0.68, 0.55, 0.68, 0.7], [0.68, 0.82, 0.68, 1], [0.5, 0, 0.5, 0.55]],
    items: [['hearth', 0, 0.68, 0.05, 0.86, 'Cheminée'], ['table', 0.08, 0.66, 0.26, 0.8], ['shelf', 0.02, 0.02, 0.48, 0.07, 'Rayonnages'], ['table', 0.15, 0.25, 0.35, 0.35], ['bed', 0.62, 0.05, 0.92, 0.3], ['counter', 0.74, 0.62, 0.97, 0.68, 'Plan de travail'], ['rug', 0.44, 0.62, 0.62, 0.92]],
    spots: { main: [0.5, 0.75], hearth: [0.12, 0.85], back: [0.75, 0.4], kitchen: [0.84, 0.8], door: [0.5, 0.95], study: [0.25, 0.42] },
  },
  caserne: {
    min: [12, 9],
    rooms: [['Salle d’armes', 0, 0.5, 1, 1], ['Dortoir', 0, 0, 0.7, 0.5], ['Cachot', 0.7, 0, 1, 0.5]],
    walls: [[0, 0.5, 0.3, 0.5], [0.42, 0.5, 0.78, 0.5], [0.9, 0.5, 1, 0.5], [0.7, 0, 0.7, 0.5]],
    items: [['rack', 0, 0.55, 0.05, 0.95, 'Râtelier d’armes'], ['table', 0.3, 0.65, 0.7, 0.78], ['beds', 0.04, 0.05, 0.66, 0.45], ['bars', 0.7, 0.28, 1, 0.3, 'Grille']],
    spots: { door: [0.5, 0.9], main: [0.5, 0.86], back: [0.85, 0.14] },
  },
  chateau: {
    min: [20, 18],
    rooms: [['Grande salle', 0, 0.35, 1, 1], ['Appartements', 0, 0, 0.6, 0.35], ['Salle des archives', 0.6, 0, 1, 0.35]],
    walls: [[0, 0.35, 0.25, 0.35], [0.35, 0.35, 0.7, 0.35], [0.8, 0.35, 1, 0.35], [0.6, 0, 0.6, 0.35]],
    items: [['throne', 0.44, 0.38, 0.56, 0.45, 'Trône'], ['dais', 0.3, 0.37, 0.7, 0.48], ['longtable', 0.2, 0.6, 0.8, 0.68, 'Grande table'], ['hearth', 0, 0.5, 0.03, 0.7, 'Cheminée'], ['hearth', 0.97, 0.5, 1, 0.7, 'Cheminée'], ['bed', 0.05, 0.05, 0.3, 0.25], ['shelf', 0.62, 0.02, 0.98, 0.06, 'Archives'], ['rug', 0.42, 0.48, 0.58, 0.98]],
    spots: { throne: [0.5, 0.5], main: [0.5, 0.78], door: [0.5, 0.94], back: [0.3, 0.2], study: [0.8, 0.2] },
  },
  guilde: {
    min: [12, 10],
    rooms: [['Grande salle', 0, 0.45, 1, 1], ['Bureau', 0, 0, 0.5, 0.45], ['Archives', 0.5, 0, 1, 0.45]],
    walls: [[0, 0.45, 0.18, 0.45], [0.3, 0.45, 0.7, 0.45], [0.82, 0.45, 1, 0.45], [0.5, 0, 0.5, 0.45]],
    items: [['longtable', 0.15, 0.62, 0.85, 0.72, 'Table du conseil'], ['table', 0.12, 0.12, 0.38, 0.24], ['shelf', 0.52, 0.02, 0.98, 0.07, 'Registres'], ['shelf', 0.93, 0.1, 0.98, 0.42, 'Registres'], ['hearth', 0.96, 0.6, 1, 0.8, 'Cheminée']],
    spots: { study: [0.25, 0.3], main: [0.5, 0.82], back: [0.75, 0.25], door: [0.5, 0.95] },
  },
  ecurie: {
    min: [10, 12],
    rooms: [['Écurie', 0, 0, 1, 1]],
    walls: [],
    items: [['stalls', 0, 0.05, 0.3, 0.9, 'Stalles'], ['stalls', 0.7, 0.05, 1, 0.9, 'Stalles'], ['trough', 0.4, 0.05, 0.6, 0.1, 'Abreuvoir'], ['crates', 0.42, 0.15, 0.58, 0.3, 'Foin']],
    spots: { main: [0.5, 0.6], back: [0.5, 0.35], door: [0.5, 0.95] },
  },
  entrepot: {
    min: [12, 10],
    rooms: [['Entrepôt', 0, 0, 1, 1]],
    walls: [],
    items: [['crates', 0.05, 0.05, 0.4, 0.4, 'Caisses'], ['crates', 0.6, 0.05, 0.95, 0.4, 'Caisses'], ['barrels', 0.05, 0.55, 0.35, 0.8, 'Tonneaux'], ['crates', 0.65, 0.55, 0.95, 0.8, 'Ballots']],
    spots: { main: [0.5, 0.6], back: [0.5, 0.2], door: [0.5, 0.95] },
  },
  atelier: {
    min: [9, 8],
    rooms: [['Atelier', 0, 0, 1, 1]],
    walls: [],
    items: [['longtable', 0.1, 0.2, 0.9, 0.3, 'Établi'], ['crates', 0.05, 0.55, 0.3, 0.8, 'Matériaux'], ['rack', 0.93, 0.4, 1, 0.9, 'Outils']],
    spots: { main: [0.5, 0.42], back: [0.3, 0.12], door: [0.5, 0.95] },
  },
  ferme: {
    min: [12, 8],
    rooms: [['Salle commune', 0, 0, 0.55, 1], ['Étable', 0.55, 0, 1, 1]],
    walls: [[0.55, 0, 0.55, 0.62], [0.55, 0.76, 0.55, 1]],
    items: [['hearth', 0, 0.3, 0.06, 0.55, 'Âtre'], ['table', 0.15, 0.45, 0.42, 0.6], ['bed', 0.05, 0.05, 0.35, 0.22], ['stalls', 0.6, 0.05, 0.95, 0.6, 'Stalles']],
    spots: { hearth: [0.12, 0.42], main: [0.3, 0.75], back: [0.75, 0.75], door: [0.3, 0.95] },
  },
};
TPL.manoir.door = 0.5; TPL.ferme.door = 0.3;

/**
 * Étages et sous-sols, là où c'est pertinent. `up` : escalier vers l'étage ; `down` : trappe ou escalier vers la cave,
 * en coordonnées (u, v) du rez-de-chaussée ; l'autre niveau a son escalier exactement au même endroit.
 * `etage` : ce qu'on trouve en haut ; `cave` : ce qu'on trouve en bas. `minArea` : seulement si le bâtiment est assez grand (m²).
 */
const LEVELS = {
  taverne: { up: [0.47, 0.27], down: [0.66, 0.31], etage: 'chambres', cave: 'cellier' },
  auberge: { up: [0.575, 0.2], down: [0.85, 0.32], etage: 'chambres', cave: 'cellier' },
  manoir: { up: [0.37, 0.76], down: [0.74, 0.9], etage: 'appartements', cave: 'cellier' },
  chateau: { up: [0.08, 0.9], down: [0.92, 0.9], etage: 'appartements', cave: 'cachots' },
  temple: { down: [0.66, 0.1], cave: 'crypte' },
  guilde: { up: [0.9, 0.9], down: [0.75, 0.35], etage: 'bureaux', cave: 'reserve' },
  echoppe: { up: [0.9, 0.2], etage: 'logis' },
  maison: { up: [0.9, 0.2], etage: 'logis', minArea: 55 },
  ferme: { down: [0.45, 0.12], cave: 'cellier' },
  entrepot: { down: [0.5, 0.48], cave: 'cellier' },
};
const ETAGE_ROOMS = {
  chambres: (i) => `Chambre ${i + 1}`,
  appartements: (i) => ['Chambre d’apparat', 'Salon', 'Cabinet', 'Chambre', 'Garde-robe', 'Chapelle privée'][i] ?? `Pièce ${i + 1}`,
  bureaux: (i) => ['Bureau du maître', 'Salle des comptes', 'Archives', 'Bureau'][i] ?? `Bureau ${i + 1}`,
  logis: (i) => ['Chambre', 'Logis', 'Grenier'][i] ?? `Pièce ${i + 1}`,
};
const CAVE_NAME = { cellier: 'Cellier', cachots: 'Cachots', crypte: 'Crypte', reserve: 'Réserve' };
const LEVEL_TITLE = { etage: 'étage', cave: 'cave' };

/** Où se tient un PNJ, selon son rôle. */
const ROLE_SPOT = [
  [/tenanci|aubergist|barman|barmaid|serveu|cabaretier|tavernier|patron|patronne|hote|hotesse|marchand|vendeu|boutiqu|apothic|herbor|boulang|boucher|orfevre|commis|joailli|epici|libraire|cordonni|tailleur/, 'counter'],
  [/forgeron|armurier|marechal/, 'anvil'],
  [/pretre|pretresse|clerc|moine|moniale|chapelain|eveque|abbe|abbesse|acolyte|diacre|oracle|pretre/, 'altar'],
  [/\broi\b|reine|seigneur|duc|duchesse|comte|comtesse|baron|baronne|prince|princesse|chatelain|monarque|souverain/, 'throne'],
  [/garde|sergent|soldat|portier|videur|capitaine|milicien|sentinelle/, 'door'],
  [/cuisini|marmiton|cuistot/, 'kitchen'],
  [/scribe|archiviste|tresorier|notaire|maitre de guilde|bourgmestre|intendant|savant|mage|erudit/, 'study'],
];

/** Milieux des ouvertures d'une cloison : les trous entre deux tronçons alignés, ou entre un tronçon et un mur. */
function openingsOf(walls) {
  const out = [];
  const lines = new Map();
  for (const [u0, v0, u1, v1] of walls) {
    const horiz = Math.abs(v0 - v1) < 1e-6;
    const key = horiz ? `h${v0}` : `v${u0}`;
    if (!lines.has(key)) lines.set(key, { horiz, at: horiz ? v0 : u0, segs: [] });
    lines.get(key).segs.push(horiz ? [Math.min(u0, u1), Math.max(u0, u1)] : [Math.min(v0, v1), Math.max(v0, v1)]);
  }
  for (const { horiz, at, segs } of lines.values()) {
    segs.sort((a, b) => a[0] - b[0]);
    // Les tronçons d'une même ligne : les trous entre eux sont des passages. Une cloison qui s'arrête avant un mur
    // est une cloison partielle : rien à ouvrir.
    for (let i = 0; i < segs.length - 1; i++) {
      const mid = (segs[i][1] + segs[i + 1][0]) / 2;
      if (segs[i + 1][0] - segs[i][1] > 0.01) out.push(horiz ? [mid, at] : [at, mid]);
    }
  }
  return out;
}

/** Où vont les PNJ du lore selon leur rôle, quand le bâtiment a ce niveau : [motif, niveau, place]. */
const NPC_LEVEL = [
  [/prisonni|captif|captive|detenu|otage|enchaine|condamne/, 'cave', 'cell'],
  [/geolier|tourmenteur|bourreau|guichetier/, 'cave', 'guard'],
  [/fossoyeur|gardien de la crypte|gardienne de la crypte|necromancien|embaumeu/, 'cave', 'main'],
  [/caviste|sommelier|commis de cave/, 'cave', 'main'],
  [/voyageu|pensionnaire|locataire|client de passage|dort a l etage|colporteu|pelerin/, 'etage', 'room'],
  [/epouse|epoux|femme d|mari d|fille d|fils d|enfant|famille|servante|domestique|valet|chambriere|dame de compagnie|chambellan/, 'etage', 'room'],
];
/** Un PNJ expressément caché (embusqué, dissimulé…) n'apparaît pas aux joueurs tant que le MJ ne le révèle pas. */
export const isHiddenNpc = (npc) => /\b(cache|cachee|caches|dissimule|dissimulee|embusque|embusquee|tapi|tapie|invisible|incognito|en secret|clandestin|clandestine)\b/.test(norm(`${npc.role ?? ''} ${npc.desc ?? ''}`));
/** Prénoms des occupants anonymes, avec leur genre (pour accorder le rôle : geôlier ou geôlière). */
const NAMES = [['Aldric', 0], ['Bérénice', 1], ['Gaspard', 0], ['Isaure', 1], ['Thibaut', 0], ['Mahaut', 1], ['Enguerrand', 0], ['Ysolde', 1],
  ['Perrin', 0], ['Clémence', 1], ['Godefroy', 0], ['Aliénor', 1], ['Renaud', 0], ['Ermengarde', 1], ['Baudouin', 0], ['Sibylle', 1],
  ['Anselme', 0], ['Héloïse', 1], ['Garin', 0], ['Ombeline', 1], ['Hugues', 0], ['Aveline', 1], ['Lothaire', 0], ['Guenièvre', 1]];
/** Rôles au masculin et au féminin. */
const ROLE = {
  garde: ['garde', 'garde'], chambellan: ['chambellan', 'chambellane'], domestique: ['domestique', 'domestique'], commis: ['commis', 'commise'],
  scribe: ['scribe', 'scribe'], enfant: ['fils du propriétaire', 'fille du propriétaire'], geolier: ['geôlier', 'geôlière'],
  voyageur: ['voyageur', 'voyageuse'], marchand: ['marchand de passage', 'marchande de passage'], pelerin: ['pèlerin', 'pèlerine'],
  mercenaire: ['mercenaire', 'mercenaire'], colporteur: ['colporteur', 'colporteuse'], barde: ['barde itinérant', 'barde itinérante'],
  prisonnier: ['prisonnier', 'prisonnière'], captif: ['captif', 'captive'],
  habitant: ['habitant', 'habitante'], maitre_maison: ['maître de maison', 'maîtresse de maison'], tavernier: ['tavernier', 'tavernière'],
  serveur: ['serveur', 'serveuse'], buveur: ['buveur', 'buveuse'], joueur: ['joueur de dés', 'joueuse de dés'], musicien: ['musicien', 'musicienne'],
  habitue: ['habitué', 'habituée'], client: ['client', 'cliente'], badaud: ['badaud', 'badaude'], forgeron: ['forgeron', 'forgeronne'],
  apprenti: ['apprenti', 'apprentie'], pretre: ['prêtre', 'prêtresse'], acolyte: ['acolyte', 'acolyte'], fidele: ['fidèle', 'fidèle'],
  mendiant: ['mendiant', 'mendiante'], maitre: ['maître de guilde', 'maîtresse de guilde'], membre: ['membre de la guilde', 'membre de la guilde'],
  sergent: ['sergent', 'sergente'], soldat: ['soldat', 'soldate'], intendant: ['intendant', 'intendante'], courtisan: ['courtisan', 'courtisane'],
  serviteur: ['serviteur', 'servante'], solliciteur: ['solliciteur', 'solliciteuse'], visiteur: ['visiteur', 'visiteuse'], fermier: ['fermier', 'fermière'],
  palefrenier: ['palefrenier', 'palefrenière'], manutentionnaire: ['manutentionnaire', 'manutentionnaire'], veilleur: ['veilleur de nuit', 'veilleuse de nuit'],
  artisan: ['artisan', 'artisane'],
};
const TRAVELLERS = ['voyageur', 'marchand', 'pelerin', 'mercenaire', 'colporteur', 'barde'];
const PRISONERS = ['prisonnier', 'prisonnier', 'prisonnier', 'captif'];
/** Une ligne de description par rôle (tirée au sort quand il y en a plusieurs). */
const TEXT = {
  voyageur: ['De passage pour la nuit ; repart à l’aube.', 'Attend une diligence qui a du retard.'],
  marchand: ['Garde sa bourse sous son oreiller.', 'Vante sa marchandise à qui veut l’entendre.'],
  pelerin: ['En route vers un sanctuaire lointain.'],
  mercenaire: ['Cherche un contrat ; garde l’épée à portée de main.'],
  colporteur: ['Sa balle de marchandises ne le quitte jamais.'],
  barde: ['Joue le soir contre le gîte et le couvert.'],
  prisonnier: ['Accusé de vol ; clame son innocence.', 'Une dette impayée l’a mené ici.', 'Cuve son vin en attendant le jour.'],
  captif: ['Personne ne sait vraiment pourquoi on l’a enfermé ici.'],
  geolier: ['Garde les clés des cellules à sa ceinture.'],
  garde: ['Surveille l’entrée, la main sur la garde de son arme.'],
  chambellan: ['Tient l’agenda du seigneur et sait tout ce qui se dit au château.'],
  domestique: ['Fait le ménage ; a l’oreille de toute la maisonnée.'],
  commis: ['Recopie les registres à la chandelle.'],
  scribe: ['Compte et recompte les recettes.'],
  enfant: ['Observe les inconnus avec curiosité.'],
  habitant: ['Vaque à ses occupations.', 'Prépare le repas.'],
  maitre_maison: ['Le maître des lieux.'],
  tavernier: ['Essuie les chopes derrière le comptoir.'],
  serveur: ['Slalome entre les tables, un plateau à la main.'],
  buveur: ['Noie ses soucis dans la bière.', 'A déjà trop bu.', 'Raconte la même histoire pour la troisième fois.'],
  joueur: ['Joue aux dés et triche un peu.', 'Mise plus qu’il ne peut perdre.'],
  musicien: ['Gratte un luth désaccordé.'],
  habitue: ['Toujours à la même table, toujours la même boisson.'],
  client: ['Hésite devant la marchandise.', 'Marchande âprement.'],
  badaud: ['Regarde sans acheter.'],
  forgeron: ['Martèle le fer rouge.'],
  apprenti: ['Actionne le soufflet en sueur.', 'Range les outils sous l’œil du maître.'],
  pretre: ['Prépare l’office.'],
  acolyte: ['Allume les cierges.'],
  fidele: ['Prie à voix basse.', 'Dépose une offrande.'],
  mendiant: ['Tend la main à la sortie de l’office.'],
  maitre: ['Reçoit les membres de la guilde.'],
  membre: ['Discute affaires à voix basse.', 'Attend son tour pour présenter une requête.'],
  sergent: ['Aboie des ordres.'],
  soldat: ['Astique son équipement.', 'Joue aux cartes entre deux tours de garde.'],
  intendant: ['Veille à l’ordre de la maison.'],
  courtisan: ['Guette la faveur du seigneur.', 'Colporte les dernières rumeurs de la cour.'],
  serviteur: ['Apporte les plats.'],
  solliciteur: ['Attend une audience depuis l’aube.'],
  visiteur: ['En visite chez les maîtres de maison.'],
  fermier: ['Rentre des champs, les bottes crottées.'],
  palefrenier: ['Bouchonne un cheval.'],
  manutentionnaire: ['Déplace des caisses en jurant.'],
  veilleur: ['Fait sa ronde, lanterne à la main.'],
  artisan: ['Travaille à son établi.'],
};
const pickText = (rand, key) => { const t = TEXT[key]; return t ? t[Math.floor(rand() * t.length)] : undefined; };

/**
 * Qui est là, selon le bâtiment et le moment de la journée. `closed` : moments où le bâtiment est fermé (personne au
 * rez-de-chaussée, sauf `nightStaff` et ceux qui y dorment) ; `staff` : [rôle, place], seulement s'il manque au lore ;
 * `crowd` : clientèle (zone du gabarit, rôles, nombre par moment) ; `nightZone` / `nightN` : où et combien dorment au
 * rez-de-chaussée la nuit.
 */
const SCHEDULE = {
  taverne: { staff: [['tavernier', 'counter'], ['serveur', 'main']], crowd: { zone: [0.08, 0.58, 0.86, 0.92], roles: ['buveur', 'buveur', 'joueur', 'musicien', 'habitue', 'marchand', 'mercenaire'], n: { matin: [0, 1], jour: [1, 3], soir: [4, 8], nuit: [1, 3] } } },
  auberge: { staff: [['tavernier', 'counter'], ['serveur', 'main']], crowd: { zone: [0.08, 0.6, 0.86, 0.92], roles: ['buveur', 'voyageur', 'joueur', 'musicien', 'marchand'], n: { matin: [1, 3], jour: [1, 2], soir: [3, 6], nuit: [0, 1] } } },
  echoppe: { closed: ['nuit'], staff: [['marchand', 'counter']], crowd: { zone: [0.15, 0.66, 0.85, 0.9], roles: ['client', 'client', 'badaud'], n: { matin: [0, 1], jour: [1, 3], soir: [0, 1] } } },
  forge: { closed: ['nuit'], staff: [['forgeron', 'anvil'], ['apprenti', 'hearth']], crowd: { zone: [0.5, 0.76, 0.9, 0.92], roles: ['client'], n: { matin: [0, 1], jour: [0, 2], soir: [0, 1] } } },
  temple: { staff: [['pretre', 'altar'], ['acolyte', 'back']], crowd: { zone: [0.1, 0.3, 0.9, 0.86], roles: ['fidele', 'fidele', 'fidele', 'pelerin', 'mendiant'], n: { matin: [3, 7], jour: [1, 3], soir: [2, 5], nuit: [0, 1] } } },
  guilde: { closed: ['nuit'], staff: [['maitre', 'study'], ['garde', 'door']], crowd: { zone: [0.15, 0.55, 0.85, 0.85], roles: ['membre', 'membre', 'marchand'], n: { matin: [1, 2], jour: [2, 5], soir: [1, 3] } } },
  caserne: { staff: [['sergent', 'main'], ['garde', 'door']], crowd: { zone: [0.08, 0.56, 0.66, 0.92], roles: ['soldat'], n: { matin: [2, 4], jour: [1, 3], soir: [2, 5], nuit: [0, 0] } }, nightZone: [0.06, 0.08, 0.64, 0.42], nightN: [3, 6] },
  chateau: { staff: [['garde', 'door'], ['garde', 'door'], ['intendant', 'main']], crowd: { zone: [0.15, 0.55, 0.85, 0.92], roles: ['courtisan', 'serviteur', 'solliciteur'], n: { matin: [1, 3], jour: [3, 6], soir: [2, 5], nuit: [0, 0] } } },
  manoir: { staff: [['domestique', 'kitchen']], crowd: { zone: [0.36, 0.62, 0.64, 0.95], roles: ['visiteur'], n: { matin: [0, 0], jour: [0, 1], soir: [0, 2], nuit: [0, 0] } } },
  maison: { crowd: { zone: [0.15, 0.56, 0.85, 0.92], roles: ['habitant', 'habitant', 'enfant'], n: { matin: [1, 2], jour: [0, 1], soir: [1, 3], nuit: [0, 0] } }, nightZone: [0.06, 0.06, 0.94, 0.4], nightN: [1, 3] },
  ferme: { crowd: { zone: [0.06, 0.62, 0.5, 0.95], roles: ['fermier', 'habitant'], n: { matin: [1, 2], jour: [0, 1], soir: [1, 3], nuit: [0, 0] } }, nightZone: [0.05, 0.05, 0.4, 0.26], nightN: [1, 3] },
  ecurie: { closed: ['nuit'], staff: [['palefrenier', 'main']] },
  entrepot: { closed: ['nuit'], staff: [['manutentionnaire', 'main']], nightStaff: [['veilleur', 'door']], crowd: { zone: [0.2, 0.44, 0.8, 0.54], roles: ['manutentionnaire', 'marchand'], n: { matin: [0, 2], jour: [1, 3], soir: [0, 1] } } },
  atelier: { closed: ['nuit'], staff: [['artisan', 'main'], ['apprenti', 'back']] },
};

const shuffle = (rand, arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** Identifiants des niveaux d'un bâtiment : rez-de-chaussée, étage, cave. */
export const levelPlanId = (rdcPlanId, level) => (level === 'rdc' ? rdcPlanId : `${rdcPlanId}:${level === 'etage' ? 'e1' : 'cave'}`);

/** Niveaux d'un bâtiment (rez-de-chaussée compris), selon son type et sa taille. */
export function levelsOf(slot, type) {
  const L = LEVELS[type];
  if (!L || ((slot.w ?? 0) * (slot.d ?? 0) < (L.minArea ?? 0))) return ['rdc'];
  return ['rdc', ...(L.up ? ['etage'] : []), ...(L.down ? ['cave'] : [])];
}

/**
 * Plans d'un bâtiment : le rez-de-chaussée (porte sur la rue, PNJ à leur place), puis l'étage et la cave s'il en a.
 * Tous les niveaux partagent les mêmes dimensions et la même orientation : les escaliers tombent au même endroit.
 * `slot` : emplacement de la cité (dimensions et façade) ; `bound` : lieu du lore posé dessus.
 */
export function generateInterior({ slot, planId, siteId, parentSiteId, bound, period = 'jour', residents = [], season, climate }) {
  const type = bound?.type ?? slot.type;
  const tpl0 = TPL[type] ?? TPL.maison;
  const rand = rng(hashSeed(`interieur:${slot.id}`));
  // Une fois sur deux, le gabarit est retourné (porte et pièces à l'envers) : deux tavernes ne se ressemblent pas.
  const flip = rand() < 0.5;
  const U = (u) => (flip ? 1 - u : u);
  const iw = Math.max(slot.w ?? tpl0.min[0], tpl0.min[0]), id = Math.max(slot.d ?? tpl0.min[1], tpl0.min[1]);
  const scale = Math.max((iw + 12) / W, (id + 15) / H, 40 / W);
  const ox = (W * scale - iw) / 2, oy = (H * scale - id) / 2 - 2.5;
  /** Point de l'intérieur (u, v) en unités de plan, et en coordonnées 0–1. */
  const P = (u, v) => [(ox + U(u) * iw) / scale, (oy + v * id) / scale];
  const Nn = (u, v) => { const [x, y] = P(u, v); return [r5(x / W), r5(y / H)]; };
  const box = (u0, v0, u1, v1) => { const [a, b] = P(u0, v0), [c, d] = P(u1, v1); return [Math.min(a, c), Math.min(b, d), Math.abs(c - a), Math.abs(d - b)]; };
  const rectD = ([x, y, w, h]) => `M${f1(x)} ${f1(y)}h${f1(w)}v${f1(h)}h${f1(-w)}Z`;
  const circleD = (x, y, r) => `M${f1(x - r)} ${f1(y)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0`;
  const m = (v) => v / scale; // mètres → unités de plan
  const T = SLOT_TYPES[type] ?? SLOT_TYPES.maison;
  const title = bound?.title || slot.label || T.label;
  const base = { canonStatus: 'creation', placementStatus: 'documented' };
  const L = LEVELS[type] ?? {};
  const levels = levelsOf({ w: iw, d: id }, type);
  const ids = Object.fromEntries(levels.map((lv) => [lv, levelPlanId(planId, lv)]));
  /** Escalier vers un autre niveau : son ancre ici, et celle du niveau d'arrivée. */
  const stairAnchor = (from, to) => `${ids[from]}:esc-${to}`;

  /**
   * Dessine un niveau : murs (porte sur la rue au rez-de-chaussée seulement), cloisons, mobilier, pièces, escaliers.
   * `stairs` : [niveau d'arrivée, (u, v), libellé, montée ?].
   */
  const drawLevel = ({ lv, rooms, walls, items, door, stairs, frontV = 0.6 }) => {
    const pid = ids[lv], pre = `${pid}:`;
    const paths = {};
    const push = (k, d) => { (paths[k] ??= []).push(d); };
    const ground = { b: [], f: [], t: [], o: [], walls: [], water: [], roads: [] };
    const rectFlat = ([x, y, w, h]) => [r1(x + w / 2), r1(y + h / 2), r1(w), r1(h), 0];
    const features = [], geometries = [], anchors = [];
    const addPoint = (f, at) => { features.push({ ...base, ...f }); geometries.push({ id: `g-${f.id}`, mapId: pid, featureId: f.id, type: 'point', coordinates: at }); };
    push(lv === 'cave' ? 'floor-stone' : 'floor', rectD(box(0, 0, 1, 1)));
    const half = 1 / iw;
    const addWall = (pts, w) => {
      const pp = pts.map(([u, v]) => P(u, v));
      ground.walls.push({ pts: pp.flat().map(r1), hw: r1(m(w)) });
      paths.walls ??= []; paths.walls.push(`M${pp.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}`);
    };
    addWall(door != null ? [[door + half, 1], [1, 1], [1, 0], [0, 0], [0, 1], [door - half, 1]] : [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]], 0.3);
    for (const [u0, v0, u1, v1] of walls) addWall([[u0, v0], [u1, v1]], 0.12);
    // Ouvertures (porte et passages entre pièces) : la grille de combat les garde ouvertes, quelle que soit sa trame.
    ground.doors = [...(door != null ? P(door, 1) : []), ...openingsOf(walls).flatMap(([u, v]) => P(u, v))].map(r1);

    const named = [];
    for (const [kind, u0, v0, u1, v1, label] of items) {
      const bx = box(u0, v0, u1, v1);
      const [cx, cy] = [bx[0] + bx[2] / 2, bx[1] + bx[3] / 2];
      if (kind === 'tables') {
        // Tables d'une salle commune : posées au gré des clients, pas au cordeau. Rondes ou longues, un peu tournées,
        // avec leurs tabourets ; jamais collées entre elles ni sur un escalier.
        const placed = [];
        const want = Math.max(2, Math.round((bx[2] * bx[3]) / (m(2.6) * m(2.6))));
        for (let tries = 0; placed.length < want && tries < want * 25; tries++) {
          const round = rand() < 0.45;
          const tw = m(round ? 1.1 : 1.6 + rand() * 0.8), th = m(round ? 1.1 : 0.85);
          const x = bx[0] + tw / 2 + rand() * Math.max(0, bx[2] - tw), y = bx[1] + th / 2 + rand() * Math.max(0, bx[3] - th);
          const ang = round ? 0 : (rand() - 0.5) * 0.7;
          if (placed.some((q) => Math.hypot(q.x - x, q.y - y) < m(2.3))) continue;
          if (stairs.some(([, [su, sv]]) => { const [sx, sy] = P(su, sv); return Math.hypot(sx - x, sy - y) < m(2); })) continue;
          placed.push({ x, y });
          if (round) push('furn', circleD(x, y, tw / 2));
          else {
            const c = Math.cos(ang), sn = Math.sin(ang), hw = tw / 2, hh = th / 2;
            const pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([u, v]) => [x + u * c - v * sn, y + u * sn + v * c]);
            push('furn', `M${pts.map(([px, py]) => `${f1(px)} ${f1(py)}`).join('L')}Z`);
          }
          ground.f.push(r1(x), r1(y), r1(tw), r1(th), Math.round(ang * 1000) / 1000);
          // Tabourets autour.
          const seats = round ? 3 + Math.floor(rand() * 2) : 4;
          for (let k = 0; k < seats; k++) {
            const a2 = (TAU2 * k) / seats + rand() * 0.5 + ang, rr = (round ? tw / 2 : tw / 2.4) + m(0.45);
            push('stool', circleD(x + Math.cos(a2) * rr, y + Math.sin(a2) * rr * (round ? 1 : 0.75), m(0.22)));
          }
        }
        if (label) named.push([label, cx, cy]);
        continue;
      }
      if (kind === 'benches' || kind === 'beds' || kind === 'stalls' || kind === 'pillars' || kind === 'tombs') {
        // Une rangée d'éléments réguliers, au mètre près, dans la zone.
        const size = { tables: [1.8, 0.9], benches: [3.2, 0.5], beds: [0.9, 1.9], stalls: [2.4, 2.8], pillars: [0.7, 0.7], tombs: [1, 2.2] }[kind];
        const gap = { tables: [1.4, 1.3], benches: [1, 0.9], beds: [0.6, 0.8], stalls: [0.2, 0.3], pillars: [3.3, 3.3], tombs: [1.2, 1.2] }[kind];
        const [ww, hh] = [m(size[0]), m(size[1])];
        const nx = Math.max(1, Math.floor((bx[2] + m(gap[0])) / (ww + m(gap[0])))), ny = Math.max(1, Math.floor((bx[3] + m(gap[1])) / (hh + m(gap[1]))));
        const x0 = bx[0] + (bx[2] - (nx * ww + (nx - 1) * m(gap[0]))) / 2, y0 = bx[1] + (bx[3] - (ny * hh + (ny - 1) * m(gap[1]))) / 2;
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
          if (kind === 'tables' && rand() < 0.12) continue;
          const r = [x0 + i * (ww + m(gap[0])), y0 + j * (hh + m(gap[1])), ww, hh];
          // Rien sur un escalier.
          if (stairs.some(([, [su, sv]]) => { const [sx, sy] = P(su, sv); return Math.abs(sx - (r[0] + r[2] / 2)) < m(1.6) && Math.abs(sy - (r[1] + r[3] / 2)) < m(1.8); })) continue;
          push({ beds: 'bed', stalls: 'stall', pillars: 'pillar', tombs: 'altar' }[kind] ?? 'furn', rectD(r));
          (kind === 'pillars' || kind === 'tombs' ? ground.o : ground.f).push(...rectFlat(r));
        }
        if (label) named.push([label, cx, cy]);
        continue;
      }
      if (kind === 'barrels' || kind === 'crates') {
        const n = Math.max(3, Math.round((bx[2] * bx[3]) / (m(1) * m(1)) / 2.2));
        for (let k = 0; k < n; k++) {
          const x = bx[0] + rand() * bx[2], y = bx[1] + rand() * bx[3];
          if (kind === 'barrels') { push('barrel', circleD(x, y, m(0.4))); ground.o.push(r1(x), r1(y), r1(m(0.8)), r1(m(0.8)), 0); } else { const sz = m(0.8 + rand() * 0.4); push('crate', rectD([x - sz / 2, y - sz / 2, sz, sz])); ground.o.push(r1(x), r1(y), r1(sz), r1(sz), 0); }
        }
        if (label) named.push([label, cx, cy]);
        continue;
      }
      const decorKind = { counter: 'furn', table: 'furn', longtable: 'furn', hearth: 'hearth', bed: 'bed', altar: 'altar', shelf: 'furn', anvil: 'anvil', rack: 'furn', trough: 'trough', stair: 'stair', throne: 'altar', dais: 'dais', rug: 'rug', bars: 'bars', chest: 'crate' }[kind] ?? 'furn';
      push(decorKind, rectD(bx));
      // Sol de combat : ce qui bloque (comptoir, âtre, autel…), ce qui gêne (tables, lits, estrade), l'eau, et le reste.
      if (['counter', 'hearth', 'altar', 'shelf', 'anvil', 'rack', 'throne', 'bars'].includes(kind)) ground.o.push(...rectFlat(bx));
      else if (kind === 'trough') ground.water.push({ pts: [r1(bx[0]), r1(cy), r1(bx[0] + bx[2]), r1(cy)], hw: r1(bx[3] / 2) });
      else if (!['rug', 'dais', 'stair'].includes(kind)) ground.f.push(...rectFlat(bx));
      if (label) named.push([label, cx, cy]);
    }

    // Escaliers : marches (montée) ou trappe (descente), un court passage, et l'ancre qui mène à l'autre niveau.
    for (const [to, [su, sv], label, upward, drawn] of stairs) {
      const sw = 1.1 / iw, sh = 1.2 / id;
      if (!drawn) push(upward ? 'stair' : 'hatch', rectD(box(su - sw, sv - (upward ? sh * 1.8 : sh), su + sw, sv + (upward ? sh * 1.8 : sh))));
      const at = Nn(su, sv);
      const from = Nn(su, Math.min(0.97, sv + (sv < 0.5 ? 1 : -1) * (2 / id)));
      const aid = stairAnchor(lv, to);
      anchors.push({ id: aid, mapId: pid, at, label });
      features.push({ ...base, id: `${pre}escalier-${to}`, title: label.split(' · ')[0], subtitle: label.split(' · ')[1], category: 'voie', importance: 'local', minZoom: 0, trace: 'etroit' });
      geometries.push({ id: `g-${pre}escalier-${to}`, mapId: pid, featureId: `${pre}escalier-${to}`, type: 'polyline', coordinates: [from, at] });
      // Là où l'on se tient en arrivant par cet escalier (ou avant de le prendre).
      const spotTitle = lv === 'etage' ? 'Haut de l’escalier' : lv === 'cave' ? 'Bas de l’escalier' : upward ? 'Pied de l’escalier' : 'Trappe';
      addPoint({ id: `${pre}palier-${to}`, title: spotTitle, category: 'voie', importance: 'local', minZoom: 0 }, from);
    }

    rooms.forEach(([name, u0, v0, u1, v1], i) => addPoint({
      id: `${pre}piece-${i}`, title: name, category: 'cite', importance: 'local', minZoom: 0, area: true,
    }, Nn((u0 + u1) / 2, v0 + (v1 - v0) * (i === 0 && lv === 'rdc' ? 0.25 : 0.5))));
    named.forEach(([label, x, y], i) => addPoint({ id: `${pre}objet-${i}`, title: label, category: 'indetermine', importance: 'detail', minZoom: 1.3 }, [r5(x / W), r5(y / H)]));

    const ORDER = ['floor', 'floor-stone', 'rug', 'dais', 'stall', 'stool', 'furn', 'bed', 'hearth', 'altar', 'anvil', 'trough', 'stair', 'hatch', 'barrel', 'crate', 'bars', 'pillar'];
    const decor = [
      ...ORDER.filter((k) => paths[k]).map((k) => ({ kind: k, d: paths[k].join('') })),
      { kind: 'wall-in', d: paths.walls.join(''), w: r1(m(0.45)) },
    ];
    const map = {
      id: pid, title: lv === 'rdc' ? `${title} · intérieur` : `${title} · ${LEVEL_TITLE[lv]}`, scope: { kind: 'site', id: lv === 'rdc' ? siteId : `${siteId}:${lv}` }, width: W, height: H,
      // Vue d'entrée : le bâtiment occupe l'écran (la rue reste visible devant la porte).
      defaultViewport: { x: r5((ox + iw / 2) / scale / W), y: r5((oy + id * frontV) / scale / H), zoom: r1(Math.min(3, Math.max(1, 0.8 * Math.min((W * scale) / iw, (H * scale) / (id + 4))))) },
      decor, surface: { scale: r5(scale), theme: 'interieur', ground },
    };
    const space = lv === 'rdc'
      ? { id: siteId, kind: 'site', name: title, levelId: 'monde', stratumIds: [], mapId: pid, parentSpaceId: parentSiteId }
      : { id: `${siteId}:${lv}`, kind: 'palier', name: `${title} · ${LEVEL_TITLE[lv]}`, levelId: 'monde', stratumIds: [], mapId: pid, siteId, parentSpaceId: siteId, floorOrder: lv === 'cave' ? -1 : 1, floorLabel: LEVEL_TITLE[lv] };
    return { map, features, geometries, anchors, space, addPoint, pre };
  };

  // ——— Rez-de-chaussée ———
  const doorU = tpl0.door ?? 0.5;
  const rdcStairs = [];
  if (ids.etage) rdcStairs.push(['etage', L.up, 'Escalier · vers l’étage', true, tpl0.items.some((x) => x[0] === 'stair')]);
  if (ids.cave) rdcStairs.push(['cave', L.down, `${type === 'temple' || type === 'chateau' ? 'Escalier' : 'Trappe'} · vers ${type === 'temple' ? 'la crypte' : type === 'chateau' ? 'les cachots' : 'la cave'}`, false, false]);
  const rdc = drawLevel({ lv: 'rdc', rooms: tpl0.rooms, walls: tpl0.walls, items: tpl0.items, door: doorU, stairs: rdcStairs });
  // Entrée (juste derrière la porte) et sortie sur la rue : le passage entre les deux mène à la cité.
  const entry = Nn(doorU, 0.9), exit = Nn(doorU, 1 + 1.8 / id);
  rdc.addPoint({ id: `${rdc.pre}entree`, title: 'Entrée', category: 'voie', importance: 'local', minZoom: 0, subtitle: title }, entry);
  rdc.features.push({ ...base, id: `${rdc.pre}porte`, title: 'Porte d’entrée', category: 'voie', importance: 'local', minZoom: 0, trace: 'etroit' });
  rdc.geometries.push({ id: `g-${rdc.pre}porte`, mapId: planId, featureId: `${rdc.pre}porte`, type: 'polyline', coordinates: [entry, exit] });
  rdc.anchors.unshift({ id: `${rdc.pre}sortie`, mapId: planId, at: exit, label: 'Sortie · rue' });

  const out = [rdc];
  let upRooms = null, caveRooms = null, up = null, down = null;
  // ——— Étage : un couloir qui passe par l'escalier, et des pièces de part et d'autre ———
  if (ids.etage) {
    const [su, sv] = L.up;
    const ch = 1.1 / id; // demi-largeur du couloir (2,2 m)
    const c0 = Math.max(0, sv - ch), c1 = Math.min(1, sv + ch);
    const rooms = [], walls = [], items = [];
    const k = Math.max(1, Math.round(iw / 4.8));
    const name = ETAGE_ROOMS[L.etage] ?? ETAGE_ROOMS.logis;
    const rows = [[0, c0, 'back'], [c1, 1, 'front']].filter(([a, b]) => (b - a) * id >= 2.6);
    // Étiquette du palier à côté de l'escalier (pas dessus : l'escalier se clique).
    rooms.push(['Palier', Math.max(0, su - 0.12), c0, Math.min(1, su + 0.12), Math.max(c0 + 0.02, sv - ch * 0.6)]);
    let n = 0;
    for (const [a, b, side] of rows) {
      const wallV = side === 'back' ? a + (b - a) : a;
      // Cloison du couloir, percée d'une porte au milieu de chaque pièce.
      const doors = Array.from({ length: k }, (_, i) => (i + 0.5) / k);
      let from = 0;
      for (const du of doors) { walls.push([from, wallV, du - 0.9 / iw, wallV]); from = du + 0.9 / iw; }
      walls.push([from, wallV, 1, wallV]);
      for (let i = 0; i < k; i++) {
        const u0 = i / k, u1 = (i + 1) / k;
        if (i > 0) walls.push([u0, a, u0, b]);
        rooms.push([name(n++), u0, a, u1, b]);
        const back = side === 'back' ? a + 0.04 : b - 0.04;
        const bedV0 = side === 'back' ? back : back - 1.9 / id, bedV1 = bedV0 + 1.9 / id;
        if (L.etage === 'bureaux') items.push(['table', u0 + 0.2 / k, (a + b) / 2 - 0.5 / id, u1 - 0.2 / k, (a + b) / 2 + 0.5 / id], ['shelf', u0 + 0.05 / k, side === 'back' ? a + 0.02 : b - 0.06, u1 - 0.05 / k, side === 'back' ? a + 0.06 : b - 0.02]);
        else {
          // Chaque chambre est meublée à sa façon : lit à gauche ou à droite, coffre au pied du lit ou contre le mur.
          const left = rand() < 0.5, margin = (0.08 + rand() * 0.08) / k;
          const bu0 = left ? u0 + margin : u1 - margin - 1 / iw;
          items.push(['bed', bu0, Math.max(a + 0.02, bedV0), bu0 + 1 / iw, Math.min(b - 0.02, bedV1)]);
          const cu0 = left ? u1 - margin - 0.8 / iw : u0 + margin;
          const cv0 = rand() < 0.5 ? Math.max(a + 0.02, bedV0) : Math.min(b - 0.02, bedV1) - 0.6 / id;
          items.push(['chest', cu0, cv0, cu0 + 0.8 / iw, cv0 + 0.6 / id]);
          if (rand() < 0.5) items.push(['table', (u0 + u1) / 2 - 0.4 / iw, (a + b) / 2 - 0.3 / id, (u0 + u1) / 2 + 0.4 / iw, (a + b) / 2 + 0.3 / id]);
        }
      }
    }
    upRooms = rooms;
    up = drawLevel({ lv: 'etage', rooms, walls, items, door: null, stairs: [['rdc', L.up, 'Escalier · vers le rez-de-chaussée', false, false]], frontV: 0.5 });
    // À l'étage, la descente est un escalier (pas une trappe) : on retouche le dessin.
    up.map.decor = up.map.decor.map((d) => (d.kind === 'hatch' ? { ...d, kind: 'stair' } : d));
    out.push(up);
  }
  // ——— Cave : cellier, crypte, cachots ou réserve ———
  if (ids.cave) {
    const [su, sv] = L.down;
    const kind = L.cave;
    const rooms = [[CAVE_NAME[kind] ?? 'Cave', 0, 0, 1, 1]], walls = [], items = [];
    if (kind === 'cachots') {
      // Cellules le long du mur du fond, fermées par des grilles ; un couloir de garde devant.
      const k = Math.max(2, Math.round(iw / 3));
      for (let i = 1; i < k; i++) walls.push([i / k, 0, i / k, 0.34]);
      items.push(['bars', 0, 0.33, 1, 0.36, 'Grilles'], ['table', 0.1, 0.62, 0.32, 0.72], ['rack', 0, 0.45, 0.04, 0.9, 'Râtelier']);
      rooms.push(...Array.from({ length: k }, (_, i) => [`Cellule ${i + 1}`, i / k, 0, (i + 1) / k, 0.33]));
      rooms[0] = ['Salle de garde', 0, 0.36, 1, 1];
    } else if (kind === 'crypte') {
      items.push(['tombs', 0.1, 0.25, 0.9, 0.9, 'Tombeaux'], ['altar', 0.4, 0.03, 0.6, 0.09, 'Ossuaire']);
    } else {
      items.push(['pillars', 0.12, 0.15, 0.88, 0.85]);
      items.push(kind === 'reserve' ? ['crates', 0.04, 0.04, 0.96, 0.16, 'Caisses'] : ['barrels', 0.04, 0.04, 0.96, 0.14, 'Tonneaux']);
      items.push(['crates', 0.02, 0.2, 0.1, 0.9, kind === 'reserve' ? 'Coffres' : 'Provisions']);
    }
    caveRooms = rooms;
    down = drawLevel({ lv: 'cave', rooms, walls, items, door: null, stairs: [['rdc', L.down, 'Escalier · vers le rez-de-chaussée', true, false]], frontV: 0.5 });
    out.push(down);
  }

  // ——— Occupants ———
  // 1. Les résidents : occupants dont le MJ a créé la fiche, à l'endroit exact où il l'a créée, à toute heure.
  // 2. Les PNJ du lore : chacun à sa place selon son rôle, au niveau qui lui convient (un voyageur dort à l'étage, un
  //    prisonnier croupit au cachot). La nuit, dans un bâtiment fermé, ceux du comptoir ou de l'enclume montent dormir
  //    s'il y a un étage.
  // 3. Des occupants anonymes selon le bâtiment et le moment de la journée : personnel (s'il manque au lore), clientèle,
  //    fidèles, soldats, famille ; voyageurs dans les chambres, prisonniers aux cachots. Un cellier, une crypte ou une
  //    réserve restent vides. Même bâtiment, même moment : mêmes occupants.
  const sched = SCHEDULE[type] ?? SCHEDULE.maison;
  const closed = (sched.closed ?? []).includes(period);
  const orng = rng(hashSeed(`occupants:${slot.id}:${period}`));
  const roomPoint = (r, jitter = 0) => Nn((r[1] + r[3]) / 2 + jitter * (r[3] - r[1]) * 0.2, (r[2] + r[4]) / 2);
  const inZone = ([u0, v0, u1, v1]) => Nn(u0 + orng() * (u1 - u0), v0 + orng() * (v1 - v0));
  const level = { rdc, etage: up, cave: down };
  const occupied = new Set();
  const used = new Map();
  const taken = new Set((residents ?? []).map((r) => norm(r.name)));
  for (const r of residents ?? []) {
    const lvl = level[r.level] ?? rdc;
    lvl.addPoint({ id: `${lvl.pre}pnj-${r.id}`, title: r.name, subtitle: r.role || undefined, summary: r.desc || undefined, entryId: r.id, category: 'institution', importance: 'regional', minZoom: 0 }, r.at);
  }
  const sleepRoom = () => (upRooms ?? []).filter((r) => r[0] !== 'Palier').find((r) => !occupied.has(`etage:${r[0]}`));
  for (const npc of bound?.npcs ?? []) {
    if (taken.has(norm(npc.name))) continue;
    const role = norm(`${npc.role ?? ''} ${npc.desc ?? ''}`);
    const feat = {
      id: `pnj-${npc.id}`, title: npc.name, category: 'institution', importance: 'regional', minZoom: 0,
      subtitle: npc.role || undefined, summary: npc.desc || undefined, entryId: npc.id, ...(isHiddenNpc(npc) ? { hiddenNpc: true } : {}),
    };
    const where = NPC_LEVEL.find(([re, lv]) => re.test(role) && (lv === 'etage' ? up : down));
    let spot = ROLE_SPOT.find(([re]) => re.test(role))?.[1] ?? 'main';
    // Nuit, bâtiment fermé : le personnel dort à l'étage.
    const sleeps = closed && up && !where && ['counter', 'anvil', 'study', 'kitchen', 'main', 'hearth'].includes(spot) ? sleepRoom() : null;
    if (sleeps) {
      occupied.add(`etage:${sleeps[0]}`);
      up.addPoint({ ...feat, id: `${up.pre}${feat.id}`, summary: ['Dort.', npc.desc].filter(Boolean).join(' ') }, roomPoint(sleeps, 0.3));
      continue;
    }
    if (where) {
      const [, lv, place] = where;
      const lvl = lv === 'etage' ? up : down, rooms = (lv === 'etage' ? upRooms : caveRooms) ?? [];
      const pool = place === 'cell' ? rooms.filter((r) => /^Cellule/.test(r[0])) : place === 'guard' ? rooms.filter((r) => /garde/.test(r[0])) : lv === 'etage' ? rooms.filter((r) => r[0] !== 'Palier') : rooms;
      const room = pool.find((r) => !occupied.has(`${lv}:${r[0]}`)) ?? pool[0] ?? rooms[0];
      if (room) {
        occupied.add(`${lv}:${room[0]}`);
        lvl.addPoint({ ...feat, id: `${lvl.pre}${feat.id}` }, roomPoint(room, occupied.size % 2 ? 0.3 : -0.3));
        continue;
      }
    }
    if (!tpl0.spots[spot]) spot = spot === 'anvil' ? 'hearth' : 'main';
    if (!tpl0.spots[spot]) spot = 'main';
    const n = used.get(spot) ?? 0; used.set(spot, n + 1);
    const [u, v] = tpl0.spots[spot];
    rdc.addPoint({ ...feat, id: `${rdc.pre}${feat.id}` }, Nn(Math.min(0.95, Math.max(0.05, u + (n % 2 ? -1 : 1) * Math.ceil(n / 2) * (1.2 / iw))), v));
  }
  const names = shuffle(rng(hashSeed(`noms:${slot.id}`)), NAMES).filter(([nm]) => !taken.has(norm(nm)));
  let gen = 0;
  // Saison : une réplique pour le visiteur qui entre (tirage à part : sans saison, rien ne change).
  const srng = season ? rng(hashSeed(`saison:${slot.id}:${season}:${period}`)) : null;
  const addAt = (lvl, at, roleKey, summary) => {
    const [name, fem] = names[gen % names.length];
    const role = (ROLE[roleKey] ?? [roleKey, roleKey])[fem];
    let text = summary ?? pickText(orng, roleKey);
    if (srng && !/^Dort/.test(text ?? '') && (greets(roleKey) || srng() < 0.33)) {
      const line = seasonLine(roleKey, season, climate, srng);
      if (line) text = `« ${line} » ${text ?? ''}`.trim();
    }
    lvl.addPoint({ id: `${lvl.pre}pnj-gen-${gen++}`, title: name, subtitle: role, summary: text, category: 'institution', importance: 'regional', minZoom: 0 }, at);
  };
  const addOccupant = (lvl, room, roleKey, summary, jitter = 0) => addAt(lvl, roomPoint(room, jitter), roleKey, summary);
  const between = ([a, b]) => a + Math.floor(orng() * (b - a + 1));

  // Rez-de-chaussée : personnel qui manque au lore, puis la clientèle du moment.
  if (!closed || sched.nightStaff) {
    const staff = closed ? sched.nightStaff : (period === 'nuit' ? (sched.staff ?? []).slice(0, 1) : sched.staff ?? []);
    for (const [roleKey, sp] of staff ?? []) {
      const key = tpl0.spots[sp] ? sp : 'main';
      if ((used.get(key) ?? 0) > 0 && key !== 'door') continue;
      used.set(key, (used.get(key) ?? 0) + 1);
      const [u, v] = tpl0.spots[key];
      addAt(rdc, Nn(Math.min(0.95, Math.max(0.05, u + ((used.get(key) - 1) % 2 ? -1 : 1) * Math.ceil((used.get(key) - 1) / 2) * (1.2 / iw))), v), roleKey);
    }
  }
  const crowd = sched.crowd;
  if (crowd && !closed) {
    const night = period === 'nuit' && sched.nightZone;
    const n = night ? between(sched.nightN ?? [0, 0]) : Math.round(between(crowd.n[period] ?? [0, 0]) * crowdFactor(season, type));
    for (let i = 0; i < n; i++) addAt(rdc, inZone(night ? sched.nightZone : crowd.zone), crowd.roles[Math.floor(orng() * crowd.roles.length)], night ? 'Dort.' : undefined);
  } else if (closed && sched.nightZone && sched.nightN) {
    for (let i = 0, n = between(sched.nightN); i < n; i++) addAt(rdc, inZone(sched.nightZone), crowd?.roles[0] ?? 'habitant', 'Dort.');
  }

  // Étage, selon l'heure : on dort la nuit et au petit matin, on sort le jour.
  const AT_HOME = { nuit: 0.75, matin: 0.55, soir: 0.4, jour: 0.2 }[period] + homeBonus(season);
  if (up && upRooms) {
    const rooms = upRooms.filter((r) => r[0] !== 'Palier' && !occupied.has(`etage:${r[0]}`));
    const asleep = period === 'nuit' ? 'Dort.' : undefined;
    if (L.etage === 'chambres') {
      for (const r of rooms) if (orng() < AT_HOME) { const roleKey = TRAVELLERS[Math.floor(orng() * TRAVELLERS.length)]; addOccupant(up, r, roleKey, asleep && `Dort. ${pickText(orng, roleKey)}`, 0.3); }
    } else if (L.etage === 'appartements') {
      if (type === 'chateau') {
        const palier = upRooms.find((r) => r[0] === 'Palier');
        if (palier) addOccupant(up, palier, 'garde', 'Garde l’accès aux appartements ; ne laisse passer personne sans ordre.');
        if (rooms[0] && period !== 'nuit') addOccupant(up, rooms[0], 'chambellan');
      } else if (rooms.length && (period === 'jour' || period === 'matin')) addOccupant(up, rooms[Math.floor(orng() * rooms.length)], 'domestique');
      else if (rooms.length && period === 'nuit') addOccupant(up, rooms[0], 'maitre_maison', 'Dort.');
    } else if (L.etage === 'bureaux') {
      if (period !== 'nuit' && rooms[0]) addOccupant(up, rooms[0], 'commis');
      if (period === 'jour' && rooms[1] && orng() < 0.6) addOccupant(up, rooms[1], 'scribe');
    } else if (L.etage === 'logis') {
      const family = period === 'nuit' ? between([1, 3]) : orng() < AT_HOME ? 1 : 0;
      for (let i = 0; i < Math.min(family, rooms.length); i++) addOccupant(up, rooms[i], i ? 'enfant' : 'habitant', asleep);
    }
  }
  if (down && caveRooms && L.cave === 'cachots') {
    const guard = caveRooms.find((r) => /garde/.test(r[0]));
    if (guard && !occupied.has(`cave:${guard[0]}`)) addOccupant(down, guard, 'geolier');
    // Les prisonniers ne changent pas avec l'heure : un tirage propre au bâtiment.
    const prng = rng(hashSeed(`prisonniers:${slot.id}`));
    for (const r of caveRooms.filter((x) => /^Cellule/.test(x[0]) && !occupied.has(`cave:${x[0]}`))) {
      if (prng() < 0.4) addOccupant(down, r, PRISONERS[Math.floor(prng() * PRISONERS.length)]);
    }
  }

  const connections = [];
  for (const [lv, title2] of [['etage', 'Escalier'], ['cave', 'Escalier de la cave']]) {
    if (!ids[lv]) continue;
    connections.push({ id: `cx-${ids[lv]}`, kind: 'escalier', fromAnchorId: stairAnchor('rdc', lv), toAnchorId: stairAnchor(lv, 'rdc'), direction: 'both', title: `${title2} · ${title}`, ...base });
  }
  const strip = ({ map, features, geometries, anchors, space }) => ({ map, features, geometries, anchors, space });
  return { ...strip(rdc), levels: out.slice(1).map(strip), connections, entryId: `${rdc.pre}entree` };
}
