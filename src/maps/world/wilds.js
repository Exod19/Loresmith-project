/**
 * Lieux sauvages de la carte du monde (mondes à l'échelle) : une grotte de géant à flanc de montagne, un cercle de fées
 * en forêt, un tumulus dans la plaine, ou simplement un lieu enchanteur sans rien de spécial.
 *
 * - Le monde est découpé en cases de 10 km. Chaque case tire, toujours de la même façon (graine du monde), 0 à 2 lieux,
 *   placés sur le vrai terrain : leur type dépend du biome, de l'altitude, de la pente, de la forêt, de l'humidité et
 *   de la distance aux routes et aux cités.
 * - Teneur : un lieu d'ambiance (rien de spécial, un texte à lire), une scène (rencontre, PNJ, énigme) ou l'accroche
 *   d'une quête secondaire. Plus on s'éloigne des routes, plus le danger monte.
 * - Rien n'est stocké tant que le lieu reste un brouillon : on ne calcule que les cases affichées. Gardé, défini ou
 *   découvert, il devient un enregistrement du monde (`world.wilds`) et ne bouge plus.
 *
 * JavaScript pur : testé par wilds.test.mjs.
 */
import { hashSeed, rng } from './generate.js';
import { atDir, dirName, slopeAt, terrainAt } from './terrain.js';

/** Côté d'une case (km). */
export const WILD_CELL = 10;
/** Teneurs : ambiance (rien de spécial), scène, accroche de quête secondaire. */
export const TENEURS = { ambiance: 'Lieu d’ambiance', scene: 'Scène', quete: 'Accroche de quête' };
/** Danger, du plus sûr au plus terrible. */
export const DANGERS = ['calme', 'incertain', 'dangereux', 'perilleux'];
export const DANGER_LABEL = { calme: 'Calme', incertain: 'Incertain', dangereux: 'Dangereux', perilleux: 'Périlleux' };

/** Contexte d'un point : où il se trouve vraiment. */
const montagne = (c) => c.e > 900 || c.slope > 0.09;
const foret = (c) => c.forest > 0.5;
const plaine = (c) => c.forest < 0.3 && c.e < 700 && c.slope < 0.07 && ['tempere', 'steppe'].includes(c.biome);
const froid = (c) => c.biome === 'neige' || c.biome === 'taiga';
const humide = (c) => c.moist > 0.66 && c.e < 400;

/**
 * Types de lieux : où ils se trouvent (`w` : poids selon le contexte), leur catégorie sur la carte, des noms, et trois
 * réserves de textes (ambiance, scène, accroche). `danger` : le lieu ajoute un cran de danger.
 */
const KINDS = [
  // ——— Montagne ———
  { id: 'grotte-geant', label: 'Grotte du géant', cat: 'grotte', danger: 1, w: (c) => (montagne(c) && c.slope > 0.03 ? 3.5 : 0),
    names: ['du Géant borgne', 'd’Ulfgar', 'du Géant endormi', 'des Os rongés', 'de Grumm'],
    amb: ['Une bouche de pierre, haute comme trois hommes, s’ouvre dans la paroi. Des marches taillées à coups de massue y mènent ; l’odeur de fumée froide en sort encore.', 'Des ossements de bœuf blanchis s’entassent devant une caverne immense. Le géant qui vivait là est parti depuis longtemps ; le vent chante dans sa marmite renversée.'],
    scene: ['Un géant des collines ronfle à l’entrée, une chèvre entière à la broche. Il est d’humeur à marchander… ou à manger.', 'Deux jeunes géants se disputent un tonneau de bière volé. Le moindre bruit les fera se retourner vers les intrus.'],
    quete: ['Le géant retient prisonnière la fille d’un berger de la vallée ; il réclame en échange « une cloche qui chante ».', 'Gravée dans la roche, une carte montre l’entrée d’une salle plus profonde, que le géant lui-même n’ose pas ouvrir.'] },
  { id: 'nid-wyverne', label: 'Nid de wyverne', cat: 'danger', danger: 2, w: (c) => (c.e > 1400 ? 2 : 0),
    names: ['du Pic tranchant', 'des Serres', 'du Vent noir', 'de la Corne'],
    amb: ['Une corniche couverte de fientes et d’écailles mues domine le vide. Le nid est vide, abandonné depuis une saison.', 'Des carcasses de chamois sèchent au soleil sur un éperon rocheux ; au-dessus, l’air vibre de la chaleur de la pierre.'],
    scene: ['Une wyverne couve trois œufs gros comme des tonneaux. Son compagnon tourne dans le ciel, au-dessus des voyageurs.', 'Un chasseur blessé s’est réfugié sous un surplomb : la wyverne guette, perchée juste au-dessus.'],
    quete: ['Un alchimiste de la cité paierait une fortune pour un œuf intact… et la wyverne ne pardonne pas.', 'Au fond du nid brille une broche aux armes d’une maison noble disparue il y a vingt ans.'] },
  { id: 'mine', label: 'Mine abandonnée', cat: 'ruine', w: (c) => (c.e > 600 && c.slope > 0.025 ? 2 : 0),
    names: ['du Filon d’argent', 'des Nains perdus', 'de la Veine noire', 'du Puits sombre'],
    amb: ['Un wagonnet rouillé repose sur des rails tordus devant une galerie étayée de poutres vermoulues. Plus rien ne bouge là-dedans.', 'Les déblais d’une mine forment une colline grise sans un brin d’herbe. Une pioche est restée plantée dans le sol.'],
    scene: ['Des kobolds ont fait de la mine leur repaire ; leurs pièges grincent dès l’entrée.', 'Un vieux mineur revient chaque jour ici, persuadé que ses camarades l’attendent encore au fond.'],
    quete: ['Le filon n’était pas épuisé : les mineurs ont fui quelque chose qu’ils ont réveillé dans la roche.', 'Un acte de propriété de la mine circule en ville ; celui qui la rouvrira sera riche, s’il en revient.'] },
  { id: 'ermitage', label: 'Ermitage', cat: 'sanctuaire', w: (c) => (c.e > 700 ? 1.5 : 0),
    names: ['de Frère Aubin', 'de la Sainte des neiges', 'du Silence', 'de la Lanterne'],
    amb: ['Une cabane de pierres sèches s’accroche à la pente, une clochette suspendue à l’auvent. On y voit la vallée entière.', 'Un petit autel taillé dans le roc porte des offrandes de fleurs séchées. L’ermite est mort ; ses mots sont gravés sur le seuil.'],
    scene: ['Un ermite au regard perçant offre le gîte en échange d’une histoire vraie… et sait reconnaître les mensonges.', 'L’ermite soigne un loup blessé et demande aux voyageurs de chasser pour eux deux.'],
    quete: ['L’ermite a vu, il y a trente ans, ce qui est arrivé au prince disparu. Il ne parlera qu’au porteur de son anneau.', 'Chaque nuit, l’ermite rallume une lanterne pour « qu’ils ne trouvent pas le passage ». Qui sont « ils » ?'] },
  { id: 'belvedere', label: 'Belvédère', cat: 'vivant', w: (c) => (c.slope > 0.035 && c.e > 400 ? 2 : 0),
    names: ['des Aigles', 'du Bout du monde', 'des Trois Vallées', 'de l’Aube'],
    amb: ['Un promontoire nu offre une vue à couper le souffle : les forêts, les rivières, et la fumée des villes au loin.', 'Le vent siffle sur une crête où des pierres plates semblent disposées pour s’asseoir. Le soleil couchant y embrase tout.'],
    scene: ['Un cartographe a installé son matériel au sommet ; il échangerait ses relevés contre une escorte.', 'Un aigle géant se pose non loin et observe les voyageurs, curieux.'],
    quete: ['D’ici, on aperçoit une tour que ne montre aucune carte, là où il ne devrait y avoir que des marais.', 'Un feu s’allume chaque nuit sur la montagne d’en face, toujours à la même heure.'] },
  { id: 'cascade', label: 'Cascade', cat: 'eau', w: (c) => (c.slope > 0.035 && c.moist > 0.42 ? 2.5 : 0),
    names: ['des Voiles', 'de la Dame blanche', 'aux Arcs-en-ciel', 'du Tonnerre'],
    amb: ['Une chute d’eau tombe en voile dans un bassin d’un vert profond. Un arc-en-ciel s’y tient en permanence.', 'L’eau dévale en escalier entre des rochers moussus ; le grondement couvre toutes les voix.'],
    scene: ['Derrière le rideau d’eau, une grotte sèche abrite le campement d’une bande de contrebandiers.', 'Une nymphe se baigne dans le bassin et ne supporte pas qu’on la regarde.'],
    quete: ['Les pièces jetées dans le bassin depuis des siècles forment un trésor… gardé par ce qui vit au fond.', 'L’eau de la cascade guérit la fièvre des marais, dit-on ; la cité en manque cruellement.'] },
  // ——— Forêt ———
  { id: 'cercle-fees', label: 'Cercle de fées', cat: 'sanctuaire', w: (c) => (foret(c) ? (c.biome === 'tempere' ? 2.5 : 1) : 0),
    names: ['des Lucioles', 'de la Reine pâle', 'aux Sept Champignons', 'du Chant perdu'],
    amb: ['Un anneau parfait de champignons blancs entoure une herbe plus verte qu’ailleurs. Le silence y est total, même les oiseaux se taisent.', 'Des lucioles dansent au-dessus d’un cercle de mousse, en plein jour. Une musique lointaine semble venir de partout.'],
    scene: ['Des fées invitent les voyageurs à danser « juste une chanson ». Qui accepte perd une journée entière… ou un souvenir.', 'Un enfant assis au milieu du cercle refuse d’en sortir : « Ils m’ont promis de revenir. »'],
    quete: ['La Reine des fées réclame qu’on lui rapporte la voix volée d’une de ses dames, prisonnière d’une sorcière.', 'Un village voisin a perdu ses enfants une nuit de pleine lune ; le cercle est la porte.'] },
  { id: 'arbre-coeur', label: 'Arbre-cœur', cat: 'vivant', w: (c) => (foret(c) ? 2 : 0),
    names: ['du Vieux Chêne', 'des Murmures', 'aux Rubans', 'des Anciens'],
    amb: ['Un chêne colossal, si vieux que dix hommes ne l’entoureraient pas. Des rubans délavés pendent à ses branches basses.', 'Le tronc d’un arbre immense est creux ; à l’intérieur, la lumière tombe en colonnes dorées.'],
    scene: ['Un sylvanien endormi a pris racine ici ; il se réveille si l’on coupe une branche.', 'Des druides tiennent conseil sous l’arbre et n’aiment pas les étrangers armés.'],
    quete: ['L’arbre se meurt : une pourriture noire monte de ses racines, venue d’une source empoisonnée en amont.', 'Gravés dans l’écorce, des noms de voyageurs disparus ; le dernier est celui d’un des héros.'] },
  { id: 'druides', label: 'Sanctuaire druidique', cat: 'sanctuaire', w: (c) => (foret(c) ? 1.5 : 0),
    names: ['du Gui d’or', 'de la Biche blanche', 'des Saisons', 'du Solstice'],
    amb: ['Des pierres couvertes de lierre forment un autel au milieu d’une clairière ronde. Des offrandes de baies y sont fraîches.', 'Un bosquet de bouleaux blancs, disposés en spirale, entoure une vasque de pierre pleine d’eau de pluie.'],
    scene: ['Une druidesse soigne les bêtes de la forêt et demande aux voyageurs de laisser leurs armes hors du cercle.', 'Un rituel du solstice se prépare ; les druides cherchent des témoins « au cœur pur ».'],
    quete: ['Des bûcherons de la cité abattent la forêt sacrée ; les druides préparent une vengeance terrible.', 'La biche blanche gardienne a été blessée par un chasseur noble : il faut la retrouver avant la nuit.'] },
  { id: 'camp-bandits', label: 'Camp de bandits', cat: 'garde', danger: 1, w: (c) => (foret(c) || c.slope > 0.04 ? (c.road < 15 ? 2.5 : 0.6) : 0),
    names: ['du Renard', 'de la Main rouge', 'des Pendus', 'du Borgne'],
    amb: ['Un camp abandonné à la hâte : des cendres encore tièdes, des sacs éventrés, une botte oubliée.', 'Un abri de branches surplombe la route ; quelqu’un y guettait les passants, il y a peu.'],
    scene: ['Une bande de brigands partage son butin autour du feu ; une sentinelle somnole à l’écart.', 'Les bandits tiennent un marchand en otage et attendent la rançon de la cité.'],
    quete: ['Le chef des bandits est un ancien chevalier déchu qui connaît un secret sur le seigneur local.', 'Les bandits ont volé un coffret scellé qu’ils n’arrivent pas à ouvrir… et qui murmure la nuit.'] },
  { id: 'cabane', label: 'Cabane isolée', cat: 'institution', w: (c) => (foret(c) ? 1.5 : humide(c) ? 1 : 0),
    names: ['de la Mère Grise', 'du Bûcheron', 'aux Corbeaux', 'des Herbes'],
    amb: ['Une cabane de rondins, la cheminée froide. Sur la table, un couvert est resté mis.', 'Des herbes sèchent sous l’auvent d’une cabane moussue ; un chat noir garde le seuil.'],
    scene: ['Une vieille herboriste vend potions et conseils ; elle sait déjà le nom des voyageurs.', 'Un bûcheron terrifié barricade sa porte : « Ça revient chaque nuit. »'],
    quete: ['La sorcière de la cabane propose un marché : un remède pour la cité, contre « ce que vous ne savez pas avoir ».', 'Dans la cave, un journal raconte la traque d’une bête que personne n’a jamais vue.'] },
  { id: 'clairiere', label: 'Clairière', cat: 'vivant', w: (c) => (foret(c) ? 3 : 0),
    names: ['aux Biches', 'des Fougères', 'du Rayon d’or', 'aux Chardons'],
    amb: ['Une clairière baignée de lumière, où l’herbe ondule sous la brise. Des biches s’y reposent sans crainte.', 'Les fougères y montent jusqu’à la taille ; un ruisseau clair la traverse en chantant.'],
    scene: ['Un chevalier errant y a dressé sa tente et défie quiconque traverse « son » pré.', 'Un ours et ses petits se gavent de mûres au bord de la clairière.'],
    quete: ['Une jeune noble s’y donne rendez-vous en secret ; son père offre une prime à qui découvrira avec qui.', 'Une pierre levée à demi enfouie porte une inscription naine : la moitié d’une carte.'] },
  { id: 'taniere', label: 'Tanière', cat: 'danger', danger: 1, w: (c) => (foret(c) ? 1.5 : froid(c) ? 0.8 : 0),
    names: ['du Loup gris', 'de la Bête', 'de l’Ours-hibou', 'des Crocs'],
    amb: ['Des griffures profondes marquent l’écorce des arbres autour d’un terrier béant. L’odeur de fauve est encore forte.', 'Un amas d’os et de plumes devant une crevasse : quelque chose mange bien ici.'],
    scene: ['Une meute de loups encercle les voyageurs, menée par une louve énorme aux yeux trop intelligents.', 'Un ours-hibou défend son petit, blessé par une flèche.'],
    quete: ['La bête qui terrorise les fermes alentour a une tanière ici… et ce n’est pas une bête ordinaire.', 'Un collier d’argent gravé brille parmi les os : celui d’un chien de chasse du seigneur.'] },
  // ——— Plaine ———
  { id: 'tumulus', label: 'Tumulus', cat: 'ruine', w: (c) => (plaine(c) ? 2 : 0),
    names: ['du Roi oublié', 'des Sept Guerriers', 'de la Reine-Corbeau', 'des Anciens'],
    amb: ['Un tertre herbeux, trop régulier pour être naturel, domine la plaine. Les bergers évitent d’y mener leurs bêtes.', 'Une colline ronde couronnée d’une pierre dressée ; la nuit, l’herbe y reste givrée même en été.'],
    scene: ['Des pilleurs de tombes ont ouvert le tumulus ; l’un d’eux en ressort en hurlant.', 'Un esprit gardien apparaît au crépuscule et demande aux voyageurs leur lignée.'],
    quete: ['L’épée du roi enterré est la seule arme capable de blesser le fléau qui menace la région.', 'Le seigneur local veut faire raser le tumulus pour y bâtir ; les morts ne sont pas d’accord.'] },
  { id: 'menhirs', label: 'Cercle de menhirs', cat: 'sanctuaire', w: (c) => (plaine(c) ? 1 : c.e > 300 && c.forest < 0.4 ? 0.5 : 0),
    names: ['des Douze Sœurs', 'de la Lune pâle', 'du Solstice', 'des Géants pétrifiés'],
    amb: ['Douze pierres dressées forment un cercle parfait. Au centre, l’herbe ne pousse pas.', 'Des menhirs couverts de lichen se dressent face au soleil levant ; des spirales y sont gravées.'],
    scene: ['À la pleine lune, les pierres bourdonnent et un passage s’ouvre entre deux d’entre elles.', 'Un groupe de pèlerins y prie et invite les voyageurs à se joindre au rite.'],
    quete: ['Une pierre manque au cercle depuis qu’un noble l’a emportée pour son jardin. Depuis, les récoltes pourrissent.', 'Les spirales gravées sont une carte des étoiles… et la date indiquée approche.'] },
  { id: 'ferme-ruine', label: 'Ferme abandonnée', cat: 'ruine', w: (c) => (plaine(c) && c.city < 50 ? 2 : 0),
    names: ['des Morel', 'du Puits', 'aux Volets bleus', 'des Corbeaux'],
    amb: ['Les murs d’une ferme brûlée se dressent au milieu des champs retournés à la friche. Un pommier y fleurit encore.', 'Une grange effondrée, une charrette sans roue : la famille est partie sans rien emporter.'],
    scene: ['Des orphelins se cachent dans la grange et volent pour survivre ; ils ont peur des adultes.', 'Un épouvantail se retourne quand les voyageurs passent.'],
    quete: ['La famille n’est pas partie : elle est encore dans le puits, et elle appelle à l’aide la nuit.', 'Un percepteur cherche cette ferme : le fermier a fui avec l’impôt de tout le village.'] },
  { id: 'champ-bataille', label: 'Vieux champ de bataille', cat: 'ruine', danger: 1, w: (c) => (plaine(c) ? 1 : 0),
    names: ['des Trois Rois', 'de la Rivière rouge', 'des Bannières', 'du Dernier Serment'],
    amb: ['Des lances rouillées émergent encore de l’herbe haute. Le vent fait claquer un lambeau de bannière.', 'Une plaine semée de petits cairns : chacun marque un soldat tombé ici, il y a un siècle.'],
    scene: ['Les fantômes de deux armées rejouent leur dernière charge à la tombée du jour.', 'Des ferrailleurs fouillent le sol et n’aiment pas la concurrence.'],
    quete: ['Le capitaine qui a trahi son armée ce jour-là est enterré ici ; son âme ne trouvera pas le repos sans aveu.', 'Un cor de guerre perdu dans la bataille rappellerait les morts au combat.'] },
  { id: 'tour-guet', label: 'Tour de guet en ruine', cat: 'garde', w: (c) => (c.road < 25 && c.forest < 0.6 ? 1.5 : 0),
    names: ['du Corbeau', 'de la Frontière', 'du Veilleur', 'aux Signaux'],
    amb: ['Une tour à demi écroulée surveille encore la route. Son escalier en colimaçon mène à une plateforme ouverte au vent.', 'Les pierres noircies d’un ancien feu de signal couronnent une tour lézardée.'],
    scene: ['Un vieux soldat y monte encore la garde, persuadé que la guerre n’est pas finie.', 'Des harpies ont fait leur nid au sommet et chantent pour attirer les voyageurs.'],
    quete: ['Quelqu’un a rallumé le feu de signal ; or ce signal annonçait, autrefois, l’invasion.', 'Dans les fondations, une porte de fer scellée porte le sceau de l’ancien royaume.'] },
  { id: 'source', label: 'Source', cat: 'eau', w: (c) => (c.moist > 0.55 && c.e < 900 && !froid(c) ? 2 : 0),
    names: ['de la Vierge', 'aux Vœux', 'Claire', 'du Héron'],
    amb: ['Une source jaillit entre deux rochers sous un saule. L’eau est si pure qu’on en voit le fond comme à travers du verre.', 'Un bassin naturel, entouré de joncs ; des pièces anciennes brillent au fond.'],
    scene: ['Une naïade propose d’exaucer un vœu… à sa façon.', 'Des paysans y puisent une eau « bénite » et voient d’un mauvais œil les étrangers.'],
    quete: ['La source se tarit et la région avec elle ; quelque chose obstrue le cours souterrain.', 'L’eau de la source révèle, une nuit par an, le reflet de ce que l’on a perdu.'] },
  { id: 'nomades', label: 'Campement nomade', cat: 'institution', w: (c) => (c.biome === 'steppe' || c.biome === 'desert' ? 2 : 0),
    names: ['du Vent du sud', 'des Cavaliers', 'aux Tentes rouges', 'de la Caravane'],
    amb: ['Des traces de tentes et de feux en cercle : une caravane a fait halte ici il y a quelques jours.', 'Un cairn orné de crins de cheval marque une halte sacrée des nomades.'],
    scene: ['Une tribu de nomades accueille les voyageurs au feu… à condition qu’ils racontent une histoire.', 'Des marchands nomades proposent des épices, des chevaux, et une carte étrange.'],
    quete: ['Le cheval sacré de la tribu a été volé par des cavaliers venus de la cité.', 'La vieille conteuse des nomades connaît le chemin d’une oasis disparue des cartes.'] },
  // ——— Désert ———
  { id: 'oasis', label: 'Oasis', cat: 'eau', w: (c) => (c.biome === 'desert' ? 2 : 0),
    names: ['des Palmes', 'du Mirage', 'de la Dernière Halte', 'aux Ibis'],
    amb: ['Quelques palmiers autour d’une mare d’eau claire, au milieu des dunes. L’ombre y est un trésor.', 'Une source cachée sous un rocher fait verdir un vallon minuscule, miraculeux.'],
    scene: ['Un djinn mineur garde l’oasis et réclame un tribut aux voyageurs assoiffés.', 'Deux caravanes rivales se disputent le droit de puiser.'],
    quete: ['L’oasis est un mirage entretenu par une créature qui attire les voyageurs.', 'Sous la mare, une dalle gravée cache l’entrée d’un tombeau ancien.'] },
  { id: 'ruines-ensablees', label: 'Ruines ensablées', cat: 'ruine', w: (c) => (c.biome === 'desert' || c.biome === 'steppe' ? 2 : 0),
    names: ['de la Cité perdue', 'du Roi-Soleil', 'des Colonnes', 'aux Scorpions'],
    amb: ['Des colonnes brisées émergent des dunes, vestiges d’une cité que le sable a avalée.', 'Le vent a dégagé une statue colossale dont seul le visage dépasse du sable.'],
    scene: ['Des scorpions géants nichent dans les salles enfouies.', 'Un érudit fouille les ruines avec ses porteurs et cherche des bras.'],
    quete: ['Une tempête de sable a mis au jour une porte scellée ; elle ne restera découverte que quelques jours.', 'Les hiéroglyphes parlent d’un sceptre capable de commander au sable.'] },
  // ——— Froid ———
  { id: 'cairn', label: 'Cairn des voyageurs', cat: 'indetermine', w: (c) => (froid(c) || c.e > 1200 ? 1.5 : 0),
    names: ['du Givre', 'des Égarés', 'du Col', 'des Neiges'],
    amb: ['Un grand cairn marque le chemin dans la blancheur ; chaque voyageur y ajoute une pierre.', 'Un empilement de pierres porte des runes usées : un vœu de bon retour.'],
    scene: ['Un voyageur gelé est assis contre le cairn, une lettre dans la main.', 'Un loup blanc attend près du cairn, comme un guide.'],
    quete: ['Sous le cairn, une boîte de fer contient la dernière lettre d’une expédition disparue.', 'Les runes du cairn indiquent un refuge que personne n’a retrouvé depuis cent hivers.'] },
  { id: 'trappeurs', label: 'Camp de trappeurs', cat: 'institution', w: (c) => (froid(c) ? 1.5 : 0),
    names: ['du Grand Nord', 'des Fourrures', 'de la Hache', 'au Lard'],
    amb: ['Des peaux tendues sur des cadres de bois sèchent devant une cabane de rondins, fumée au toit.', 'Un camp de trappeurs déserté : des pièges vides, des raquettes accrochées au mur.'],
    scene: ['Des trappeurs bourrus partagent leur soupe et leurs rumeurs sur une bête qui chasse les chasseurs.', 'Un trappeur blessé supplie qu’on l’aide à rapporter ses fourrures avant les loups.'],
    quete: ['Les trappeurs ont capturé une créature qui parle, et ne savent pas quoi en faire.', 'Une piste de pas géants traverse le camp et repart vers les glaciers.'] },
  // ——— Marais ———
  { id: 'marais', label: 'Marais', cat: 'eau', danger: 1, w: (c) => (humide(c) ? 2.5 : 0),
    names: ['des Feux follets', 'du Pendu', 'aux Hérons', 'des Brumes'],
    amb: ['Des eaux noires, des roseaux et des souches mortes ; la brume y traîne même à midi.', 'Des feux follets dansent au-dessus de la tourbière à la tombée du jour.'],
    scene: ['Un passeur propose de guider les voyageurs à travers le marais, contre un prix qui monte à chaque pas.', 'Des hommes-lézards observent depuis les roseaux.'],
    quete: ['Une sorcière des marais retient l’âme d’un noyé ; sa veuve offre tout ce qu’elle a.', 'Un village englouti affleure à la saison sèche, avec son clocher et ses secrets.'] },
];
const KIND = Object.fromEntries(KINDS.map((k) => [k.id, k]));
/** Compléments de nom communs à tous les lieux. */
const NAMES = ['des Brumes', 'du Corbeau', 'de l’Aube', 'des Murmures', 'du Vieux Roi', 'des Échos', 'du Silence', 'des Cendres', 'de la Veuve', 'aux Ronces', 'du Héron', 'des Saules', 'du Sanglier', 'de l’Ermite', 'des Larmes', 'de la Lune', 'des Chardons', 'du Givre'];

const segDist = (x, y, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], q = dx * dx + dy * dy;
  const t = q ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / q)) : 0;
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
};
const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];

/** Identifiant stable d'un lieu : sa case et son rang dans la case. */
export const wildKey = (i, j, k) => `${i}_${j}_${k}`;

/**
 * Contexte : `seed` (graine du monde), `relief` (terrain.js), `cities` [{ name, km, r }] (r : rayon en km) et
 * `roads` (polylignes en km). Renvoie les lieux des cases qui touchent la fenêtre `[x0, y0, x1, y1]` (km), sauf ceux
 * dont la clé est dans `skip` (déjà enregistrés : gardés, définis ou écartés).
 */
export function wildSitesIn(ctx, box, skip = new Set()) {
  const [x0, y0, x1, y1] = box;
  const out = [];
  const i0 = Math.floor(x0 / WILD_CELL), i1 = Math.floor(x1 / WILD_CELL), j0 = Math.floor(y0 / WILD_CELL), j1 = Math.floor(y1 / WILD_CELL);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) out.push(...cellSites(ctx, i, j, skip));
  return out;
}

/** Les lieux d'une case (0, 1 ou 2), toujours les mêmes. */
export function cellSites(ctx, i, j, skip = new Set()) {
  const r = rng(hashSeed(`${ctx.seed}:wild:${i}:${j}`));
  const u = r();
  const n = u < 0.45 ? 0 : u < 0.9 ? 1 : 2; // ≈ 0,65 lieu par case de 100 km² : densité « normale »
  const [bx0, by0, bx1, by1] = ctx.relief.bounds;
  const out = [];
  for (let k = 0; k < n; k++) {
    const key = wildKey(i, j, k);
    // On tire toujours les mêmes nombres, même pour un lieu ignoré : les autres lieux de la case ne bougent pas.
    const tries = Array.from({ length: 4 }, () => [(i + 0.08 + r() * 0.84) * WILD_CELL, (j + 0.08 + r() * 0.84) * WILD_CELL]);
    const roll = [r(), r(), r(), r(), r(), r(), r()];
    if (skip.has(key)) continue;
    let spot = null;
    for (const [x, y] of tries) {
      if (x < bx0 || x > bx1 || y < by0 || y > by1) continue;
      // Pas dans une cité ni sur son terroir proche.
      if (ctx.cities.some((c) => Math.hypot(c.km[0] - x, c.km[1] - y) < c.r * 1.6 + 1)) continue;
      const t = terrainAt(ctx.relief, x, y);
      if (t.sea) continue;
      spot = { x, y, t };
      break;
    }
    if (!spot) continue;
    const { x, y, t } = spot;
    const road = Math.min(99, ...(ctx.roads ?? []).flatMap((p) => p.slice(1).map((q, m) => segDist(x, y, p[m], q))));
    const near = ctx.cities.map((c) => ({ c, d: Math.hypot(c.km[0] - x, c.km[1] - y) })).sort((a, b) => a.d - b.d)[0];
    const c = { biome: t.biome, forest: t.forest, e: t.e, moist: t.moist, slope: slopeAt(ctx.relief, x, y, 0.4), road, city: near ? near.d : 99 };
    const weights = KINDS.map((kd) => kd.w(c));
    const total = weights.reduce((s, w) => s + w, 0);
    if (!total) continue;
    let w = roll[0] * total, kind = KINDS[0];
    for (let m = 0; m < KINDS.length; m++) { w -= weights[m]; if (w <= 0) { kind = KINDS[m]; break; } }
    const teneur = roll[1] < 0.55 ? 'ambiance' : roll[1] < 0.85 ? 'scene' : 'quete';
    const far = Math.min(road, c.city);
    let lvl = teneur === 'ambiance' ? 0 : far < 5 ? 0 : far < 18 ? 1 : far < 40 ? 2 : 3;
    if (kind.danger && teneur !== 'ambiance') lvl += kind.danger;
    const name = roll[2] < 0.65 && kind.names?.length ? pick(() => roll[3], kind.names) : pick(() => roll[3], NAMES);
    out.push({
      key, km: [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000], kind: kind.id, label: kind.label, cat: kind.cat,
      title: `${kind.label} ${name}`, teneur, danger: DANGERS[Math.min(3, lvl)],
      text: pick(() => roll[4], kind.amb),
      scene: teneur === 'scene' ? pick(() => roll[5], kind.scene) : undefined,
      hook: teneur === 'quete' ? pick(() => roll[6], kind.quete) : undefined,
      biome: t.biome, e: Math.round(t.e),
      near: near ? { name: near.c.name, km: Math.round(near.d), dir: dirName(near.c.km, [x, y]) } : undefined,
      road: Math.round(road * 10) / 10,
    });
  }
  return out;
}

/** « à 23 km au nord-est de Brumeval » */
export const whereLabel = (s) => (s.near ? `à ${s.near.km} km ${atDir(s.near.dir)} de ${s.near.name}` : '');
/** Libellé d'un type de lieu (pour une fiche définie à la main). */
export const kindLabel = (id) => KIND[id]?.label ?? 'Lieu';
/** Types connus, pour le formulaire « Définir ». */
export const WILD_KINDS = KINDS.map((k) => ({ id: k.id, label: k.label, cat: k.cat }));
