/**
 * Rencontres de la surface (carte du monde) : routes, campagnes, forêts, montagnes. Elles ne se mêlent jamais à celles
 * de l'Underdark (encounters.ts), et inversement. Même format, mêmes fiches de statistiques (statblocks.ts).
 * Zones : `sauvage` (loin des routes), `transit` (sur la route), `cite` (aux abords d'une cité ou d'un hameau).
 */
import type { Entry, Zone } from './encounters';

/**
 * Rencontres propres à un type de lieu sauvage (world/wilds.js) : ce qu'on y croise vraiment. Les lieux d'ambiance
 * paisibles (source, belvédère…) tirent dans la nature en général.
 */
export const SITE_ENCOUNTERS: Record<string, string[]> = {
  'grotte-geant': ['Ogre des collines'], taniere: ['Meute de loups', 'Ours brun'], 'camp-bandits': ['Brigands de grand chemin'],
  tumulus: ['Morts sans repos'], 'champ-bataille': ['Morts sans repos'], 'ferme-ruine': ['Morts sans repos', 'Bande de gobelins'],
  mine: ['Bande de gobelins', 'Araignées des bois'], cabane: ['Cultistes à l’œuvre', 'Chasseurs'], druides: ['Cultistes à l’œuvre', 'Meute de loups'],
  'tour-guet': ['Bande de gobelins', 'Raid orque'], nomades: ['Marchands en route'], trappeurs: ['Chasseurs', 'Meute de loups'],
  'ruines-ensablees': ['Gnolls affamés'], marais: ['Morts sans repos', 'Araignées des bois'], 'arbre-coeur': ['Araignées des bois', 'Ours brun'],
  clairiere: ['Ours brun', 'Chasseurs'], menhirs: ['Cultistes à l’œuvre'], ermitage: ['Pèlerins'], 'nid-wyverne': ['Ogre des collines', 'Meute de loups'],
};

export const SURFACE: Entry[] = [
  /* ——— Sur la route ——— */
  { kind: 'Convoi', title: 'Marchands en route', zones: ['transit', 'cite'], weight: 3, peaceful: true,
    text: 'Deux chariots bâchés grincent sur la route, tirés par des bœufs placides. Les marchands saluent, la main pas très loin de l’arbalète.',
    groups: [{ stat: 'commoner', dice: '1d4+1', role: 'marchands' }, { stat: 'guard', dice: '1d4', role: 'gardes engagés' }],
    wants: ['commercer (sel, toiles, outils, nouvelles)', 'faire route ensemble jusqu’au prochain hameau', 'savoir si la route est sûre plus loin'],
    hook: 'Un des chariots transporte une caisse qu’aucun marchand n’admet avoir chargée.' },
  { kind: 'Patrouille', title: 'Patrouille du seigneur', zones: ['transit', 'cite'], weight: 2,
    text: 'Des cavaliers aux couleurs du seigneur local barrent la route et demandent qui va là.',
    groups: [{ stat: 'guard', dice: '1d4+2' }, { stat: 'veteran', dice: '1', role: 'sergent' }],
    wants: ['contrôler les voyageurs', 'percevoir un droit de passage', 'recruter des volontaires contre une menace voisine'],
    hook: 'Ils cherchent un fugitif dont le portrait ressemble vaguement à l’un des héros.' },
  { kind: 'Voyageurs', title: 'Pèlerins', zones: ['transit', 'sauvage'], weight: 2, peaceful: true,
    text: 'Une file de pèlerins chante en marchant vers un sanctuaire lointain, bâton à la main et coquille au chapeau.',
    groups: [{ stat: 'commoner', dice: '2d4', role: 'pèlerins' }, { stat: 'priest', dice: '1', role: 'guide spirituel' }],
    wants: ['une escorte jusqu’au prochain gué', 'partager le pain et les prières', 'des nouvelles du sanctuaire'] },
  { kind: 'Créature', title: 'Brigands de grand chemin', zones: ['transit', 'sauvage'], weight: 3, talks: true,
    text: 'Un arbre abattu barre la route. Des silhouettes sortent des fourrés, arcs bandés : « La bourse ou la vie. »',
    groups: [{ stat: 'bandit', dice: '1d6+2' }, { stat: 'thug', dice: '1', role: 'chef de bande' }],
    wants: ['votre argent', 'vos chevaux', 'un otage à rançonner'],
    hook: 'Le chef porte la chevalière d’un noble disparu sur cette même route.' },
  { kind: 'Signe', title: 'Charrette renversée', zones: ['transit'], weight: 1,
    text: 'Une charrette gît dans le fossé, une roue arrachée. Pas de cheval, pas de conducteur ; des traces mènent vers les bois.' },
  /* ——— Sur la route royale : on y croise du monde, rarement du danger ——— */
  { kind: 'Convoi', title: 'Grande caravane', zones: ['transit'], voies: ['royale'], weight: 3, peaceful: true,
    text: 'Une file de dix chariots s’étire sur les pavés, escortée de mercenaires à cheval. Le maître de caravane compte ses bêtes en jurant.',
    groups: [{ stat: 'commoner', dice: '2d4+2', role: 'charretiers et marchands' }, { stat: 'guard', dice: '1d4+2', role: 'escorte' }, { stat: 'veteran', dice: '1', role: 'capitaine d’escorte' }],
    wants: ['recruter des gardes pour la suite du trajet', 'vendre ou troquer (étoffes, épices, vin)', 'savoir si le prochain pont tient encore'],
    hook: 'Un chariot fermé à clé ne s’ouvre que la nuit, et le capitaine paie double pour qu’on n’en parle pas.' },
  { kind: 'Voyageurs', title: 'Courrier royal', zones: ['transit'], voies: ['royale'], weight: 2, peaceful: true,
    text: 'Un cavalier en livrée passe au galop, une sacoche scellée en bandoulière. Il ralentit à peine pour demander la route du prochain relais.',
    groups: [{ stat: 'scout', dice: '1', role: 'courrier' }],
    wants: ['un cheval frais', 'arriver avant la nuit', 'qu’on ne touche pas à sa sacoche'],
    hook: 'Une heure plus tard, des cavaliers sans livrée demandent dans quelle direction il est parti.' },
  { kind: 'Voyageurs', title: 'Marcheurs et colporteurs', zones: ['transit'], voies: ['royale', 'chemin'], weight: 3, peaceful: true,
    text: 'Sur le bas-côté, un colporteur et sa mule, une famille qui change de ville, deux compagnons du devoir, sac au dos. On se salue, on échange les nouvelles.',
    groups: [{ stat: 'commoner', dice: '1d6+1', role: 'voyageurs' }],
    wants: ['vendre rubans, aiguilles et almanachs', 'faire un bout de route ensemble', 'des nouvelles de la cité voisine'] },
  { kind: 'Patrouille', title: 'Péage du pont', zones: ['transit'], voies: ['royale'], weight: 1,
    text: 'Une barrière, une guérite et deux gardes qui s’ennuient : on paie le passage du pont, deux pièces de cuivre par tête et une d’argent par cheval.',
    groups: [{ stat: 'guard', dice: '2', role: 'péagers' }],
    wants: ['percevoir le droit de passage', 'tuer le temps', 'un pot-de-vin pour fermer les yeux sur une marchandise'] },
  { kind: 'Signe', title: 'Relais de poste', zones: ['transit'], voies: ['royale'], weight: 1,
    text: 'Une borne milliaire, puis un relais de poste : écurie, auge, une salle où l’on sert une soupe chaude. Les rumeurs de la route s’y échangent.' },
  /* ——— Pistes forestières et sentiers perdus : peu de monde, et pas le meilleur ——— */
  { kind: 'Travailleurs', title: 'Bûcherons', zones: ['sauvage'], voies: ['piste', 'sentier'], weight: 2, peaceful: true,
    text: 'Des coups de hache résonnent sous les arbres. Une équipe de bûcherons ébranche un chêne abattu près d’un feu.',
    groups: [{ stat: 'commoner', dice: '1d4+2', role: 'bûcherons' }],
    wants: ['qu’on les aide à charger le tronc', 'avertir d’une bête qui rôde', 'troquer de la viande séchée contre de l’alcool'] },
  { kind: 'Créature', title: 'Braconniers', zones: ['sauvage'], voies: ['piste', 'sentier'], weight: 2, talks: true,
    text: 'Un cerf pend à une branche, encore chaud. Trois hommes en capuche surgissent, arc au poing : ils n’aiment pas les témoins.',
    groups: [{ stat: 'bandit', dice: '1d4+1', role: 'braconniers' }, { stat: 'scout', dice: '1', role: 'pisteur' }],
    wants: ['qu’on se taise', 'vendre du gibier sous le manteau', 'qu’on les aide à semer les gardes-chasse'] },
  { kind: 'Créature', title: 'Worgs en chasse', zones: ['sauvage'], voies: ['piste'], weight: 1, talks: true,
    text: 'Un grondement grave, puis un deuxième derrière vous : des worgs encerclent la piste, et l’un d’eux parle.',
    groups: [{ stat: 'worg', dice: '1d3+1' }, { stat: 'goblin', dice: '1d4', role: 'cavaliers gobelins' }],
    wants: ['de la viande', 'des prisonniers pour leur chef', 'qu’on quitte leur territoire'] },
  /* ——— Sentiers de montagne ——— */
  { kind: 'Voyageurs', title: 'Chevriers', zones: ['sauvage'], voies: ['col'], weight: 2, peaceful: true,
    text: 'Un troupeau de chèvres dévale l’éboulis, suivi d’un vieux chevrier et de son chien. Il connaît chaque passage du col.',
    groups: [{ stat: 'commoner', dice: '1d2', role: 'chevriers' }],
    wants: ['du sel et du tabac', 'qu’on l’aide à retrouver une bête perdue', 'avertir que le temps va tourner'] },
  { kind: 'Créature', title: 'Contrebandiers du col', zones: ['sauvage'], voies: ['col'], weight: 2, talks: true,
    text: 'Des mules lourdement chargées, sans grelots, et des hommes qui posent la main sur leur épée en vous voyant.',
    groups: [{ stat: 'bandit', dice: '1d6+1', role: 'contrebandiers' }, { stat: 'spy', dice: '1', role: 'passeur' }],
    wants: ['passer sans témoin', 'acheter votre silence', 'engager des bras pour la descente'] },
  { kind: 'Signe', title: 'Éboulement', zones: ['sauvage'], voies: ['col'], weight: 1,
    text: 'Le sentier disparaît sous un éboulis récent. Contourner prend une heure ; traverser demande un jet de Force (Athlétisme) DD 12.' },
  /* ——— Campagne et forêt ——— */
  { kind: 'Créature', title: 'Meute de loups', zones: ['sauvage'], weight: 3, faune: true,
    text: 'Des hurlements se répondent à la tombée du jour. Des yeux luisent entre les arbres et la meute se resserre.',
    groups: [{ stat: 'wolf', dice: '1d4+2' }, { stat: 'dire-wolf', dice: '1d2-1', role: 'chef de meute' }] },
  { kind: 'Créature', title: 'Ours brun', zones: ['sauvage'], weight: 2, faune: true,
    text: 'Un ours brun énorme fouille un tronc pourri à la recherche de miel. Il se dresse en reniflant.',
    groups: [{ stat: 'brown-bear', dice: '1' }] },
  { kind: 'Voyageurs', title: 'Chasseurs', zones: ['sauvage'], weight: 2, peaceful: true,
    text: 'Deux chasseurs ramènent un cerf sur une perche. Ils connaissent chaque sentier du pays.',
    groups: [{ stat: 'scout', dice: '2', role: 'chasseurs' }],
    wants: ['qu’on ne fasse pas fuir le gibier', 'vendre de la viande et des peaux', 'avertir d’une bête qui rôde'] },
  { kind: 'Créature', title: 'Bande de gobelins', zones: ['sauvage'], weight: 3, talks: true,
    text: 'Des ricanements aigus dans les fourrés : une bande de gobelins a monté une embuscade maladroite.',
    groups: [{ stat: 'goblin', dice: '2d4' }, { stat: 'goblin-boss', dice: '1' }],
    wants: ['piller', 'faire des prisonniers', 'fuir dès que ça tourne mal'] },
  { kind: 'Créature', title: 'Raid orque', zones: ['sauvage'], weight: 2, talks: true,
    text: 'Une colonne de fumée, des tambours au loin : une bande d’orques revient d’un raid, chargée de butin.',
    groups: [{ stat: 'orc', dice: '1d4+2' }, { stat: 'worg', dice: '1d2', role: 'montures' }],
    wants: ['du butin', 'un combat digne', 'traverser sans être suivis'] },
  { kind: 'Créature', title: 'Gnolls affamés', zones: ['sauvage'], weight: 1,
    text: 'Des rires hystériques dans la plaine : des gnolls suivent la piste d’une proie, et le vent a tourné.',
    groups: [{ stat: 'gnoll', dice: '1d4+2' }] },
  { kind: 'Créature', title: 'Ogre des collines', zones: ['sauvage'], weight: 1, talks: true,
    text: 'Un ogre traîne une vache morte par la queue et s’arrête, intéressé par la nouvelle viande.',
    groups: [{ stat: 'ogre', dice: '1' }], wants: ['manger', 'un trésor brillant', 'qu’on lui obéisse'] },
  { kind: 'Créature', title: 'Araignées des bois', zones: ['sauvage'], weight: 1, faune: true,
    text: 'Des toiles épaisses tendues entre les troncs ; un cocon remue encore.',
    groups: [{ stat: 'giant-spider', dice: '1d3' }] },
  /* ——— La nuit, les lieux maudits ——— */
  { kind: 'Créature', title: 'Morts sans repos', zones: ['sauvage'], weight: 1,
    text: 'Un cimetière oublié au bord du chemin ; la terre s’ouvre et des formes se redressent.',
    groups: [{ stat: 'zombie', dice: '1d4+1' }, { stat: 'skeleton', dice: '1d4' }] },
  { kind: 'Créature', title: 'Cultistes à l’œuvre', zones: ['sauvage', 'cite'], weight: 1, talks: true,
    text: 'Des chants étouffés dans une clairière : des cultistes encapuchonnés préparent un rituel autour d’un feu vert.',
    groups: [{ stat: 'cultist', dice: '1d4+2' }, { stat: 'cult-fanatic', dice: '1' }], wants: ['achever le rituel', 'ne laisser aucun témoin'] },
  { kind: 'Signe', title: 'Feu de camp tiède', zones: ['sauvage', 'transit'], weight: 2,
    text: 'Les braises d’un feu de camp sont encore tièdes, des empreintes de bottes tout autour. Quelqu’un est passé il y a peu.' },
  { kind: 'Signe', title: 'Pendu au carrefour', zones: ['transit'], weight: 1,
    text: 'Un corps se balance à la potence d’un carrefour, un écriteau au cou : « Voleur ». Les corbeaux ont commencé leur travail.' },
  /* ——— Aux abords des cités ——— */
  { kind: 'Voyageurs', title: 'Paysans au marché', zones: ['cite'], weight: 3, peaceful: true,
    text: 'Des paysans poussent des brouettes de légumes vers la ville et se plaignent des taxes.',
    groups: [{ stat: 'commoner', dice: '1d6+1' }], wants: ['vendre leur récolte', 'se plaindre du seigneur', 'des nouvelles de la ville'] },
  { kind: 'Créature', title: 'Coupe-bourses', zones: ['cite'], weight: 2, talks: true,
    text: 'Dans la foule des abords de la ville, un gamin bouscule un héros et disparaît un peu trop vite.',
    groups: [{ stat: 'spy', dice: '1', role: 'voleur' }, { stat: 'bandit', dice: '1d3', role: 'complices' }] },
];

/**
 * Rencontres selon la voie suivie (carte du monde) : la fréquence ne change pas, mais ce qu'on croise si. Sur la route
 * royale : caravanes, marcheurs, courriers, patrouilles ; brigands rares. Sur une piste forestière : brigands, loups,
 * bêtes et braconniers. `zones` : tables de base ; `mult` : poids multipliés (0 : jamais).
 */
export const VOIE_TABLES: Record<string, { zones: Zone[]; mult: Record<string, number> }> = {
  royale: { zones: ['transit'], mult: {
    'Marchands en route': 2, 'Patrouille du seigneur': 3, Pèlerins: 2, 'Brigands de grand chemin': 0.15, 'Charrette renversée': 0.5,
    'Pendu au carrefour': 0.3, 'Feu de camp tiède': 0.3,
  } },
  chemin: { zones: ['transit'], mult: { 'Brigands de grand chemin': 0.8 } },
  sentier: { zones: ['transit', 'sauvage'], mult: {
    'Marchands en route': 0.2, 'Patrouille du seigneur': 0.15, 'Charrette renversée': 0.3, 'Pendu au carrefour': 0.3, 'Raid orque': 0.5, 'Ogre des collines': 0.5,
  } },
  piste: { zones: ['sauvage'], mult: {
    'Brigands de grand chemin': 2.5, 'Meute de loups': 2.5, 'Araignées des bois': 2, 'Ours brun': 1.5, 'Bande de gobelins': 1.5, Chasseurs: 0.6,
    'Gnolls affamés': 0.5, 'Ogre des collines': 0.5,
  } },
  col: { zones: ['sauvage'], mult: {
    'Ogre des collines': 2.5, 'Raid orque': 1.5, 'Meute de loups': 1.5, 'Araignées des bois': 0, 'Gnolls affamés': 0.3, 'Bande de gobelins': 1,
    Chasseurs: 0.5, 'Morts sans repos': 0.5,
  } },
};

/** Table de rencontres de la surface pour une zone, et une voie s'il y en a une : poids ajustés, rencontres propres à la voie. */
export function surfacePool(zone: Zone, voie?: string): Entry[] {
  const t = voie ? VOIE_TABLES[voie] : undefined;
  if (!t) return SURFACE.filter((e) => !e.voies && e.zones.includes(zone));
  return SURFACE
    .filter((e) => (e.voies ? e.voies.includes(voie!) : e.zones.some((z) => t.zones.includes(z))))
    .map((e) => ({ ...e, weight: (e.weight ?? 1) * (t.mult[e.title] ?? 1) }))
    .filter((e) => e.weight > 0);
}
