/**
 * Données de l'Atlas.
 *
 * Les cinq strates du Grand niveau I (I-1 à I-5) sont des conventions de travail, identifiants neutres.
 * Tout ce qui porte `demo: true` est une MICRO-GÉOGRAPHIE DE DÉMONSTRATION fictive (canonStatus « creation »,
 * placement « illustrative ») : elle sert à éprouver la navigation et sera remplacée par la géographie validée.
 *
 * Les lieux attestés dont la position n'est pas documentée restent sans géométrie :
 * ils apparaissent dans l'index « connus, non localisés », jamais placés au hasard.
 */
import type { AtlasData, Cavity } from './types';
import { enrich } from './procedural';
import { hostenValak } from './hostenValak';

/** Repère commun des plans vectoriels (coordonnées saisies en unités de plan, stockées normalisées 0–1). */
export const PLAN_W = 1240, PLAN_H = 755;
const pt = (x: number, y: number): [number, number] => [+(x / PLAN_W).toFixed(4), +(y / PLAN_H).toFixed(4)];
const line = (...xy: number[]): [number, number][] => { const o: [number, number][] = []; for (let i = 0; i < xy.length; i += 2) o.push(pt(xy[i], xy[i + 1])); return o; };
const cav = (x: number, y: number, rx: number, ry: number, seed: number, tone = 0): Cavity =>
  ({ cx: x / PLAN_W, cy: y / PLAN_H, rx: rx / PLAN_W, ry: ry / PLAN_H, seed, tone });
const plan = (id: string, title: string, scope: AtlasData['maps'][number]['scope'], ambiance?: string, demo = true) =>
  ({ id, title, scope, width: PLAN_W, height: PLAN_H, defaultViewport: { x: .5, y: .5, zoom: 1 }, ambiance, demo });
const D = { canonStatus: 'creation' as const, placementStatus: 'illustrative' as const, demo: true };

const DEPTH = ['Strate haute', 'Strate supérieure', 'Strate médiane', 'Strate inférieure', 'Strate basse'];

const BASE: AtlasData = {
  version: 'atlas-3',
  levels: [
    { id: 'niveau-1', order: 1, title: 'Grand niveau I', survey: 'cartographie', description: 'Premier des trois grands niveaux. Cinq strates superposées, relevées comme conventions de travail ; noms officiels à préciser.', strataIds: [1, 2, 3, 4, 5].map((i) => `n1-strate-${i}`) },
    { id: 'niveau-2', order: 2, title: 'Grand niveau II', survey: 'fragmentaire', description: 'Territoire largement non cartographié : les relevés versés aux Archives sont fragmentaires.', strataIds: [] },
    { id: 'niveau-3', order: 3, title: 'Grand niveau III', survey: 'inconnu', description: 'Aucun plan fiable versé aux Archives. Géographie inconnue.', strataIds: [] },
  ],
  strata: [1, 2, 3, 4, 5].map((i) => ({
    id: `n1-strate-${i}`, levelId: 'niveau-1', title: `Strate I-${i}`, relativeDepthOrder: i, depthLabel: DEPTH[i - 1],
    description: i === 3 ? 'Strate de démonstration : un vaste réseau de cavités, avec au centre le site à trois paliers et le passage vers I-4.' : 'Strate de démonstration : un vaste réseau de cavités, de tunnels et de crevasses (topographie fictive).',
    mapId: `carte-n1-s${i}`,
  })),
  spaces: [
    { id: 'entre-i3-i4', kind: 'entre-strate', name: 'Entre-strate I-3 / I-4', levelId: 'niveau-1', stratumIds: ['n1-strate-3', 'n1-strate-4'], mapId: 'carte-entre-i3-i4', description: 'Galeries étroites et alcôve de garde : un espace de transit, pas une strate.', depth: 3.5, nesting: 1, between: ['n1-strate-3', 'n1-strate-4'], demo: true },
    { id: 'site-essai', kind: 'site', name: 'Site d’essai', levelId: 'niveau-1', stratumIds: ['n1-strate-3'], entryFloorId: 'site-essai-p2', description: 'Implantation fictive répartie sur trois paliers ; chaque palier a son plan et ses accès.', demo: true },
    ...[1, 2, 3].map((k) => ({
      id: `site-essai-p${k}`, kind: 'palier' as const, name: `Palier ${k}`, floorLabel: ['Galerie haute', 'Halles centrales', 'Citernes basses'][k - 1],
      parentSpaceId: 'site-essai', siteId: 'site-essai', levelId: 'niveau-1', stratumIds: ['n1-strate-3'], floorOrder: k, mapId: `carte-site-p${k}`, demo: true,
    })),
  ],
  maps: [
    ...[1, 2, 3, 4, 5].map((i) => plan(`carte-n1-s${i}`, `Plan · Strate I-${i}`, { kind: 'strate', id: `n1-strate-${i}` })),
    plan('carte-entre-i3-i4', 'Mini-plan · Entre-strate I-3 / I-4', { kind: 'espace', id: 'entre-i3-i4' }),
    ...[1, 2, 3].map((k) => plan(`carte-site-p${k}`, `Site d’essai · Palier ${k}`, { kind: 'site', id: 'site-essai', floorId: `site-essai-p${k}` })),
  ],
  cavities: {
    'carte-n1-s1': [cav(300, 280, 220, 130, 5), cav(640, 240, 240, 120, 7), cav(950, 300, 190, 150, 9), cav(500, 520, 260, 120, 11)],
    'carte-n1-s2': [cav(220, 400, 170, 140, 13), cav(480, 300, 200, 110, 15), cav(760, 360, 230, 150, 19), cav(1020, 440, 150, 120, 21), cav(560, 580, 200, 90, 23)],
    'carte-n1-s3': [cav(230, 246, 176, 109, 17), cav(472, 242, 210, 118, 27), cav(765, 212, 203, 139, 33), cav(1018, 308, 125, 111, 48), cav(308, 483, 205, 108, 54), cav(630, 468, 226, 135, 78), cav(925, 560, 191, 126, 81)],
    'carte-n1-s4': [cav(260, 330, 190, 120, 61), cav(560, 260, 230, 110, 64), cav(860, 330, 200, 140, 67), cav(420, 560, 240, 110, 70), cav(800, 580, 210, 100, 73)],
    'carte-n1-s5': [cav(350, 360, 260, 170, 31), cav(760, 320, 250, 150, 37), cav(600, 600, 300, 90, 41)],
    'carte-entre-i3-i4': [cav(433, 286, 138, 78, 21, 1), cav(625, 493, 174, 107, 37, 1)],
    'carte-site-p1': [cav(620, 400, 360, 230, 52)],
    'carte-site-p2': [cav(636, 440, 385, 268, 51)],
    'carte-site-p3': [cav(600, 430, 330, 220, 57, 1)],
  },
  features: [
    // Galeries principales (tracés horizontaux).
    { id: 'gal-s1', title: 'Galerie principale', category: 'voie', importance: 'landmark', minZoom: 0, ...D },
    { id: 'gal-s2', title: 'Galerie principale', category: 'voie', importance: 'landmark', minZoom: 0, ...D },
    { id: 'gal-s3', title: 'Grande galerie', category: 'voie', importance: 'landmark', minZoom: 0, ...D },
    { id: 'gal-s3b', title: 'Galerie du lac', category: 'voie', importance: 'regional', minZoom: 0, ...D },
    { id: 'gal-s4', title: 'Galerie principale', category: 'voie', importance: 'landmark', minZoom: 0, ...D },
    { id: 'gal-s4b', title: 'Galerie du débouché', category: 'voie', importance: 'regional', minZoom: 0, ...D },
    { id: 'gal-s5', title: 'Galerie profonde', category: 'voie', importance: 'landmark', minZoom: 0, ...D },
    { id: 'gal-entre', title: 'Couloir étroit', category: 'voie', importance: 'landmark', minZoom: 0, ...D },
    { id: 'gal-entre-b', title: 'Boyau de garde', category: 'voie', importance: 'regional', minZoom: 0, ...D },
    { id: 'gal-site-1', title: 'Rue haute', category: 'voie', importance: 'landmark', minZoom: 0, ...D },
    { id: 'gal-site-2', title: 'Rue des halles', category: 'voie', importance: 'landmark', minZoom: 0, ...D },
    { id: 'gal-site-3', title: 'Allée des citernes', category: 'voie', importance: 'landmark', minZoom: 0, ...D },
    // Strate I-3.
    { id: 'poi-site-essai', title: 'Site d’essai', subtitle: 'Entrer dans le site · trois paliers', category: 'cite', importance: 'landmark', minZoom: 0, summary: 'Implantation fictive répartie sur trois paliers. Chaque palier possède son propre plan et ses propres accès.', opens: { kind: 'site', id: 'site-essai' }, ...D },
    { id: 'poi-lac', title: 'Lac souterrain', category: 'eau', importance: 'regional', minZoom: 0, summary: 'Les surfaces d’eau font partie de la topographie relevée, pas d’un décor posé au hasard.', ...D },
    { id: 'zone-lac', title: 'Lac souterrain', category: 'eau', importance: 'regional', minZoom: 0, ...D },
    { id: 'zone-instable', title: 'Fissures instables', category: 'danger', importance: 'regional', minZoom: 0, ...D },
    { id: 'poi-instable', title: 'Zone instable', category: 'danger', importance: 'regional', minZoom: 1.3, summary: 'Région dangereuse : traitement graphique distinct, sans effet magique.', ...D },
    { id: 'poi-grotte', title: 'Grotte d’essai', category: 'grotte', importance: 'local', minZoom: 1.3, summary: 'Emplacement illustratif. Une grotte peut avoir une fiche encyclopédique, sans que la fiche soit nécessaire pour consulter le plan.', ...D },
    { id: 'poi-sanctuaire', title: 'Sanctuaire d’essai', category: 'sanctuaire', importance: 'local', minZoom: 1.3, summary: 'Un repère peut afficher une note concise, puis un lien vers la fiche seulement si elle existe.', ...D },
    { id: 'poi-colonie', title: 'Colonie fongique observée', category: 'vivant', importance: 'detail', minZoom: 2.6, summary: 'Observation fine, visible seulement à l’échelle de détail.', ...D },
    // Strate I-4.
    { id: 'poi-debouche', title: 'Salle du débouché', category: 'grotte', importance: 'regional', minZoom: 0, summary: 'Cavité où débouche la galerie venant de l’entre-strate I-3 / I-4.', ...D },
    // Entre-strate.
    { id: 'poi-garde', title: 'Alcôve de garde', category: 'garde', importance: 'regional', minZoom: 0, summary: 'Point secondaire : une garde, une réserve ou une cache peut être documentée sans inventer un secteur majeur.', ...D },
    // Site d'essai.
    { id: 'poi-guet', title: 'Galerie des guetteurs', category: 'institution', importance: 'regional', minZoom: 0, ...D },
    { id: 'poi-archives-locales', title: 'Archives locales', category: 'institution', importance: 'landmark', minZoom: 0, ...D },
    { id: 'poi-ateliers', title: 'Ateliers', category: 'ressource', importance: 'regional', minZoom: 0, ...D },
    { id: 'poi-bassin', title: 'Bassin central', category: 'eau', importance: 'landmark', minZoom: 0, ...D },
    { id: 'poi-citernes', title: 'Citernes voûtées', category: 'eau', importance: 'landmark', minZoom: 0, ...D },
    { id: 'poi-reserve', title: 'Réserve effondrée', category: 'ruine', importance: 'local', minZoom: 1.3, ...D },

    // Lieux attestés dans les Archives, position non documentée : index uniquement.
    { id: 'lieu-ozzoloh', title: 'Ozzoloh Ventreen', people: 'moriquendi', category: 'cite', importance: 'landmark', minZoom: 0, entryId: 'li-ozzoloh', canonStatus: 'confirme', placementStatus: 'unknown', summary: 'Cité de la Famille et siège des Archives. Niveau, strate et paliers non documentés.' },
    { id: 'lieu-bibliotheque', title: 'Bibliothèque centrale d’Ozzoloh Ventreen', category: 'institution', importance: 'regional', minZoom: 0, entryId: 'li-bibliotheque', canonStatus: 'confirme', placementStatus: 'unknown', summary: 'Située à Ozzoloh Ventreen ; emplacement dans la cité non documenté.' },
    { id: 'lieu-royolo', title: 'Avant-poste de Royolo', category: 'institution', importance: 'regional', minZoom: 0, entryId: 'li-royolo', canonStatus: 'confirme', placementStatus: 'unknown', summary: 'Avant-poste doté d’un portail ; position non documentée.' },
    { id: 'lieu-hosten-valak', title: 'Hosten Valak', people: 'moriquendi', category: 'cite', importance: 'landmark', minZoom: 0, entryId: 'li-hosten-valak', canonStatus: 'confirme', placementStatus: 'unknown', summary: 'Cité du sud, taillée en terrasses dans la paroi d’un gouffre, où un visage immense de la déesse est sculpté à même la pierre : chaque palier en porte une partie. Assiégée par les illithids selon la correspondance de Karnash Norrianiss. Située au sud ; grand niveau et strate non documentés.', opens: { kind: 'site', id: 'hosten-valak' } },
    { id: 'lieu-palissades', title: 'Les Palissades', category: 'cite', importance: 'regional', minZoom: 0, entryId: 'li-palissades', canonStatus: 'confirme', placementStatus: 'unknown', summary: 'Mentionnées autour d’Hosten Valak ; position non documentée.' },
  ],
  geometries: [
    { id: 'g-gal-s1', mapId: 'carte-n1-s1', featureId: 'gal-s1', type: 'polyline', coordinates: line(140, 300, 300, 290, 420, 260, 560, 255, 700, 250, 850, 280, 1000, 320, 1110, 330) },
    { id: 'g-gal-s2', mapId: 'carte-n1-s2', featureId: 'gal-s2', type: 'polyline', coordinates: line(120, 420, 300, 380, 480, 320, 620, 345, 760, 380, 930, 420, 1100, 450) },
    { id: 'g-gal-s3', mapId: 'carte-n1-s3', featureId: 'gal-s3', type: 'polyline', coordinates: line(148, 278, 260, 300, 335, 262, 450, 268, 565, 278, 690, 258, 809, 256, 950, 286, 1089, 314) },
    { id: 'g-gal-s3b', mapId: 'carte-n1-s3', featureId: 'gal-s3b', type: 'polyline', coordinates: line(368, 285, 340, 380, 385, 470, 510, 488, 633, 494, 760, 525, 892, 560) },
    { id: 'g-gal-s4', mapId: 'carte-n1-s4', featureId: 'gal-s4', type: 'polyline', coordinates: line(120, 360, 300, 340, 520, 300, 720, 320, 980, 360, 1120, 380) },
    { id: 'g-gal-s4b', mapId: 'carte-n1-s4', featureId: 'gal-s4b', type: 'polyline', coordinates: line(560, 300, 560, 420, 600, 540, 700, 585, 820, 590) },
    { id: 'g-gal-s5', mapId: 'carte-n1-s5', featureId: 'gal-s5', type: 'polyline', coordinates: line(120, 380, 260, 370, 400, 360, 580, 345, 760, 330, 950, 345, 1120, 360) },
    { id: 'g-gal-entre', mapId: 'carte-entre-i3-i4', featureId: 'gal-entre', type: 'polyline', coordinates: line(430, 280, 470, 360, 520, 405, 553, 426, 610, 455, 645, 505) },
    { id: 'g-gal-entre-b', mapId: 'carte-entre-i3-i4', featureId: 'gal-entre-b', type: 'polyline', coordinates: line(548, 427, 613, 390, 640, 385) },
    { id: 'g-gal-site-1', mapId: 'carte-site-p1', featureId: 'gal-site-1', type: 'polyline', coordinates: line(320, 400, 480, 370, 620, 400, 780, 380, 920, 410) },
    { id: 'g-gal-site-2', mapId: 'carte-site-p2', featureId: 'gal-site-2', type: 'polyline', coordinates: line(330, 437, 480, 412, 617, 442, 770, 420, 920, 415) },
    { id: 'g-gal-site-3', mapId: 'carte-site-p3', featureId: 'gal-site-3', type: 'polyline', coordinates: line(330, 440, 450, 400, 600, 430, 760, 470, 880, 440) },

    { id: 'g-site-essai', mapId: 'carte-n1-s3', featureId: 'poi-site-essai', type: 'point', coordinates: pt(268, 262) },
    { id: 'g-lac', mapId: 'carte-n1-s3', featureId: 'zone-lac', type: 'polygon', coordinates: line(680, 441, 720, 412, 770, 408, 825, 453, 815, 500, 769, 525, 712, 512) },
    { id: 'g-lac-pin', mapId: 'carte-n1-s3', featureId: 'poi-lac', type: 'point', coordinates: pt(777, 456) },
    { id: 'g-instable', mapId: 'carte-n1-s3', featureId: 'zone-instable', type: 'polygon', coordinates: line(918, 545, 984, 520, 1047, 579, 1027, 646, 975, 654, 912, 609) },
    { id: 'g-instable-pin', mapId: 'carte-n1-s3', featureId: 'poi-instable', type: 'point', coordinates: pt(960, 590) },
    { id: 'g-grotte', mapId: 'carte-n1-s3', featureId: 'poi-grotte', type: 'point', coordinates: pt(610, 290) },
    { id: 'g-sanctuaire', mapId: 'carte-n1-s3', featureId: 'poi-sanctuaire', type: 'point', coordinates: pt(905, 205) },
    { id: 'g-colonie', mapId: 'carte-n1-s3', featureId: 'poi-colonie', type: 'point', coordinates: pt(700, 225) },
    { id: 'g-debouche', mapId: 'carte-n1-s4', featureId: 'poi-debouche', type: 'point', coordinates: pt(700, 600) },
    { id: 'g-garde', mapId: 'carte-entre-i3-i4', featureId: 'poi-garde', type: 'point', coordinates: pt(640, 385) },
    { id: 'g-guet', mapId: 'carte-site-p1', featureId: 'poi-guet', type: 'point', coordinates: pt(430, 330) },
    { id: 'g-archives-locales', mapId: 'carte-site-p2', featureId: 'poi-archives-locales', type: 'point', coordinates: pt(420, 375) },
    { id: 'g-ateliers', mapId: 'carte-site-p2', featureId: 'poi-ateliers', type: 'point', coordinates: pt(763, 324) },
    { id: 'g-bassin', mapId: 'carte-site-p2', featureId: 'poi-bassin', type: 'point', coordinates: pt(615, 430) },
    { id: 'g-citernes', mapId: 'carte-site-p3', featureId: 'poi-citernes', type: 'point', coordinates: pt(600, 430) },
    { id: 'g-reserve', mapId: 'carte-site-p3', featureId: 'poi-reserve', type: 'point', coordinates: pt(790, 330) },
  ],
  anchors: [
    { id: 'a-i2-puits', mapId: 'carte-n1-s2', at: pt(1010, 430), label: 'Puits d’éboulement' },
    { id: 'a-i3-puits', mapId: 'carte-n1-s3', at: pt(1018, 335), label: 'Bas du puits d’éboulement' },
    { id: 'a-i3-passage', mapId: 'carte-n1-s3', at: pt(472, 469), label: 'Passage vers I-4' },
    { id: 'a-entre-haut', mapId: 'carte-entre-i3-i4', at: pt(425, 268), label: 'Entrée · I-3' },
    { id: 'a-entre-bas', mapId: 'carte-entre-i3-i4', at: pt(645, 512), label: 'Sortie · I-4' },
    { id: 'a-i4-arrivee', mapId: 'carte-n1-s4', at: pt(600, 540), label: 'Débouché de l’entre-strate' },
    { id: 'a-p1-bas', mapId: 'carte-site-p1', at: pt(777, 520), label: 'Descente au palier 2' },
    { id: 'a-p2-haut', mapId: 'carte-site-p2', at: pt(415, 553), label: 'Remonter au palier 1' },
    { id: 'a-p2-bas', mapId: 'carte-site-p2', at: pt(777, 538), label: 'Descente au palier 3' },
    { id: 'a-p3-haut', mapId: 'carte-site-p3', at: pt(420, 560), label: 'Remonter au palier 2' },
  ],
  connections: [
    { id: 'c-puits-i2-i3', kind: 'puits', fromAnchorId: 'a-i2-puits', toAnchorId: 'a-i3-puits', direction: 'forward', title: 'Puits d’éboulement', difficulty: 4, hazards: ['Descente en rappel', 'Éboulis mobiles', 'Aucune remontée'], note: 'On peut s’y laisser descendre vers I-3 ; la remontée est impossible.', ...D },
    { id: 'c-i3-entre', kind: 'escalier', fromAnchorId: 'a-i3-passage', toAnchorId: 'a-entre-haut', direction: 'both', title: 'Escalier de reconnaissance', difficulty: 2, hazards: ['Marches brisées', 'Passage sans lumière'], note: 'Le passage rejoint une courte entre-strate avant de déboucher sur la strate I-4.', ...D },
    { id: 'c-entre-i4', kind: 'galerie', fromAnchorId: 'a-entre-bas', toAnchorId: 'a-i4-arrivee', direction: 'both', title: 'Galerie de raccordement', difficulty: 3, hazards: ['Étroiture à franchir de profil', 'Trémie instable'], note: 'L’arrivée vise la sortie connue sur I-4, pas le centre du plan.', ...D },
    { id: 'c-site-12', kind: 'escalier', fromAnchorId: 'a-p1-bas', toAnchorId: 'a-p2-haut', direction: 'both', title: 'Grand escalier', ...D },
    { id: 'c-site-23', kind: 'ascenseur', fromAnchorId: 'a-p2-bas', toAnchorId: 'a-p3-haut', direction: 'both', title: 'Puits à treuil', ...D },
  ],
};

/** Données complètes : saisie manuelle + enrichissement procédural des plans de démonstration. */
const HV = hostenValak();
const WITH_HV: AtlasData = {
  ...BASE,
  spaces: [...BASE.spaces, ...HV.spaces], maps: [...BASE.maps, ...HV.maps], cavities: { ...BASE.cavities, ...HV.cavities },
  features: [...BASE.features, ...HV.features], geometries: [...BASE.geometries, ...HV.geometries],
  anchors: [...BASE.anchors, ...HV.anchors], connections: [...BASE.connections, ...HV.connections],
};
export const ATLAS: AtlasData = enrich(WITH_HV);
