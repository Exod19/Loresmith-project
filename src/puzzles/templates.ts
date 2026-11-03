/**
 * Points de départ de l'atelier : pour chaque mécanisme, une configuration jouable et sa loi, que le MJ adapte.
 * Les textes de la scène restent à écrire (ou à proposer par l'IA) : rien n'est « prêt » sans relecture.
 */
import { claimText } from './solver';
import type { Dyn, Mechanic, Puzzle } from './types';

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Configuration publique et secrète par défaut, et la loi que suit le mécanisme. */
export const DEFAULTS: Record<Mechanic, { publicConfig: Dyn; serverConfig: Dyn; law: string; family: string; text: string }> = {
  braziers: { publicConfig: { leverIds: ['A', 'B', 'C'], brazierIds: ['I', 'II', 'III'], maxInspections: 1 }, serverConfig: { brazierToLever: ['C', 'A', 'B'] }, family: 'experimentation',
    law: 'Chaque levier allume un seul brasier ; la pierre garde la chaleur d’un feu éteint.', text: 'Trois leviers, trois brasiers derrière une grille qu’on n’ouvre qu’une fois : concevoir une expérience qui répond en une seule observation.' },
  'heavy-stone': { publicConfig: { stoneIds: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], maxWeighings: 2, uniqueHeavy: true }, serverConfig: { heavyStoneId: 'G' }, family: 'strategie_information',
    law: 'Un seul objet est plus lourd ; la balance n’indique que gauche, droite ou équilibre.', text: 'Trouver l’objet différent en un nombre limité de pesées : chaque pesée a trois issues.' },
  jugs: { publicConfig: { capacities: [3, 5], target: 4, initial: [0, 0] }, serverConfig: {}, family: 'volumes',
    law: 'On remplit ou vide entièrement ; on transvase jusqu’à ce que l’un soit plein ou l’autre vide.', text: 'Mesurer une quantité exacte avec deux récipients sans graduation.' },
  statues: { publicConfig: { coffrets: ['A', 'B', 'C', 'D'], truthCount: 1 }, serverConfig: { correctChest: 'B' }, family: 'logique',
    law: 'Exactement une inscription dit vrai.', text: 'Des gardiens affirment, un seul dit vrai : la cohérence désigne le bon coffret.' },
  mirrors: { publicConfig: { grid: 5, sourceRow: 1, targetRow: 0, mirrors: [[1, 1], [1, 3], [3, 3], [3, 0]], initial: ['/', '/', '/', '/'] }, serverConfig: {}, family: 'spatial',
    law: 'Un miroir renvoie la lumière à angle droit ; la pierre l’arrête.', text: 'Orienter des miroirs pour conduire un rayon jusqu’au réceptacle.' },
  'prime-tiles': { publicConfig: { grid: [[2, 4, 6, 9], [3, 5, 8, 10], [12, 7, 11, 13], [14, 15, 16, 17]], start: [0, 0], end: [3, 3], move: 'orthogonal' }, serverConfig: {}, family: 'mathematiques',
    law: 'Seules les dalles portant un nombre premier tiennent ; on avance d’une dalle, jamais en diagonale.', text: 'Traverser une passerelle dont la sûreté suit une règle numérique.' },
  chronology: { publicConfig: { events: ['Fondation', 'Couronne', 'Pacte', 'Rupture', 'Exil'], initialOrder: ['Rupture', 'Fondation', 'Exil', 'Pacte', 'Couronne'] },
    serverConfig: { orderedEvents: ['Fondation', 'Couronne', 'Pacte', 'Rupture', 'Exil'], relations: [['Fondation', 'Couronne'], ['Couronne', 'Pacte'], ['Pacte', 'Rupture'], ['Rupture', 'Exil']] }, family: 'enquete',
    law: 'Chaque témoignage fixe un « avant / après » ; ensemble, ils ne laissent qu’un ordre.', text: 'Recouper des documents dispersés pour remettre des événements dans l’ordre.' },
  glyphs: { publicConfig: { firstGlyphs: ['◈', '✦', '☷'], secondGlyphs: ['∴', '≋', '⌁'] }, serverConfig: { correct: ['✦', '≋'] }, family: 'langage',
    law: 'Chaque glyphe a un sens constant ; les exemples gravés en donnent la grammaire.', text: 'Déduire une écriture à partir d’exemples traduits, puis composer un mot.' },
  cycles: { publicConfig: { periods: [4, 6], currentTick: 7, maxTick: 36 }, serverConfig: { nextAlignment: 12 }, family: 'cycles',
    law: 'Chaque mécanisme revient à son origine à chaque fin de cycle.', text: 'Prévoir quand plusieurs cycles se rejoindront.' },
  'equal-balance': { publicConfig: { weights: [1, 2, 3, 4, 6, 8], targetPerSide: 12 }, serverConfig: {}, family: 'combinatoire',
    law: 'Les plateaux ne s’équilibrent que si leurs masses sont égales ; tout doit être déposé.', text: 'Répartir des offrandes en deux parts égales.' },
  gears: { publicConfig: { baseGearIds: ['A', 'B', 'C', 'D'], optionalGearIds: ['X', 'Y'], targetRelativeDirection: 'same' }, serverConfig: {}, family: 'causalite',
    law: 'Deux roues engrenées tournent en sens contraire.', text: 'Ajouter ou retirer des roues pour que la dernière tourne dans le bon sens.' },
  'light-network': { publicConfig: { count: 4, initial: [true, false, false, true], target: [true, true, true, true], neighbors: 'cycle_plus_self' }, serverConfig: {}, family: 'systemes',
    law: 'Presser un cristal bascule ce cristal et ses deux voisins.', text: 'Allumer tout un réseau dont chaque geste touche plusieurs éléments.' },
};

/** Statues : inscriptions de départ (une seule vraie, la clé en B), que le MJ réécrit. */
export const DEFAULT_CLAIMS = [{ statue: 'A', is: false, chest: 'A' }, { statue: 'B', is: true, chest: 'C' }, { statue: 'C', is: false, chest: 'B' }, { statue: 'D', is: true, chest: 'A' }];
/** Ce qu'un mécanisme apporte en changeant : ses lois et, pour les statues, ses inscriptions. */
export function mechanicStart(m: Mechanic) {
  return {
    laws: [DEFAULTS[m].law],
    claims: m === 'statues' ? DEFAULT_CLAIMS.map((c) => ({ ...c })) : undefined,
    readables: m === 'statues' ? DEFAULT_CLAIMS.map((c) => ({ source: `Statue ${c.statue}`, text: claimText(c) })) : undefined,
  };
}

/** Familles d'expérience (étape 2 de l'atelier) et les mécanismes qui les servent. */
export const EXPERIENCES: { id: string; label: string; mechanics: Mechanic[] }[] = [
  { id: 'logique', label: 'Logique et déduction', mechanics: ['statues', 'chronology'] },
  { id: 'experimentation', label: 'Expérience et observation', mechanics: ['braziers', 'gears'] },
  { id: 'mathematiques', label: 'Nombres et cycles', mechanics: ['prime-tiles', 'cycles', 'equal-balance'] },
  { id: 'spatial', label: 'Espace et anticipation', mechanics: ['mirrors', 'light-network'] },
  { id: 'information', label: 'Stratégie d’information', mechanics: ['heavy-stone', 'jugs'] },
  { id: 'langage', label: 'Langage et symboles', mechanics: ['glyphs'] },
];

export function blankPuzzle(mechanic: Mechanic, universeId: string): Puzzle {
  const d = DEFAULTS[mechanic];
  const now = Date.now();
  return {
    id: `enigme-${uid()}`, universeId, schemaVersion: '2.0.0', title: 'Nouvelle énigme', mechanic, family: d.family, difficulty: 'intermediaire', estimatedMinutes: 12,
    status: 'brouillon', tags: ['LoreSmith'],
    player: { location: '', sceneDescription: '', objective: '', observations: [{ id: `obs-${uid()}`, text: '', available: 'initiale' }], interactions: [], readables: mechanicStart(mechanic).readables ?? [], accessibility: 'Tout retour sonore a un équivalent visuel et textuel. Pas de minuterie obligatoire.' },
    gm: { deductionPath: [], solutionRationale: '', acceptedAlternativeApproaches: [], nonSpoilerHints: [{ tier: 1, text: '', kind: 'orientation' }, { tier: 2, text: '', kind: 'nouvelle_observation' }, { tier: 3, text: '', kind: 'rappel_de_regle' }],
      skillChecks: [], failureForward: { onWrongAnswer: '', threshold: 0, cost: '' }, alternateBypass: 'Le MJ accepte une approche de jeu de rôle cohérente, avec un coût proportionné.' },
    engine: { kind: mechanic, publicConfig: JSON.parse(JSON.stringify(d.publicConfig)), serverConfig: JSON.parse(JSON.stringify(d.serverConfig)) },
    design: { laws: [d.law], claims: mechanicStart(mechanic).claims },
    createdAt: now, updatedAt: now,
  };
}
