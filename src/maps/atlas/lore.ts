/**
 * Lore de l'Atlas : descriptions des lieux, passages et obstacles, et conseils au MJ (D&D 5e).
 *
 * Les descriptions sont rédigées par type d'élément (titre, nature du tracé, qualificatif d'une salle…) avec des
 * variantes choisies de façon stable selon l'identifiant, pour que deux « Campement abandonné » ne se ressemblent pas.
 * Les conseils au MJ proposent jets de compétence et de sauvegarde (DD), conséquences, et passages secrets
 * découvrables à proximité. Une description modifiée dans l'Atelier l'emporte toujours.
 */
import type { AtlasConnection, AtlasFeature } from './types';

export type Check = { kind: 'test' | 'save' | 'info'; label: string; dc?: number; ok?: string; ko?: string };
export type DmGuide = { scene?: string; checks: Check[]; tips: string[] };

const T = (label: string, dc: number, ok: string, ko?: string): Check => ({ kind: 'test', label, dc, ok, ko });
const S = (ability: string, dc: number, ko: string, ok?: string): Check => ({ kind: 'save', label: `Jet de sauvegarde de ${ability}`, dc, ko, ok });
const I = (label: string, ok: string): Check => ({ kind: 'info', label, ok });

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const pick = <X,>(arr: X[], seed: string) => arr[hash(seed) % arr.length];

type Entry = { d: string[]; dm?: Check[]; tips?: string[]; scene?: string };

/* ——— Kits de règles réutilisables ——— */
const K = {
  slippery: (dc = 12) => S('Dextérité', dc, 'chute à terre et glisse de 1d4 × 1,5 m ; 1d6 dégâts contondants s’il y a un rebord.', 'garde l’équilibre.'),
  rockfall: (dc = 13, dmg = '2d6') => S('Dextérité', dc, `${dmg} dégâts contondants et enseveli partiellement (entravé, Force DD 12 pour se dégager).`, 'moitié des dégâts.'),
  gas: (dc = 13) => S('Constitution', dc, 'empoisonné pendant 1 heure ; sur un échec de 5 ou plus, un niveau d’épuisement.'),
  squeeze: (dc = 12) => T('Force (Athlétisme) ou Dextérité (Acrobaties)', dc, 'franchit l’étroiture (vitesse divisée par deux).', 'reste coincé un round ; une créature en armure lourde ne passe pas.'),
  climb: (dc = 13, m = 6) => T('Force (Athlétisme)', dc, 'grimpe sans encombre.', `chute : 1d6 dégâts contondants par tranche de 3 m (environ ${m} m ici).`),
  swim: (dc = 12) => T('Force (Athlétisme)', dc, 'nage ou traverse à gué.', 'emporté de 3 m par le courant et 1d4 dégâts contondants contre la roche.'),
  hidden: (dc = 15, what = 'le passage') => T('Intelligence (Investigation)', dc, `découvre ${what}.`),
  notice: (dc = 13, what = 'le détail') => T('Sagesse (Perception)', dc, `remarque ${what}.`),
  forage: (dc = 12, what = 'de quoi se nourrir pour une journée') => T('Sagesse (Survie)', dc, `récolte ${what}.`),
  history: (dc = 13, what = 'l’origine du lieu') => T('Intelligence (Histoire)', dc, `identifie ${what}.`),
  religion: (dc = 13, what = 'le culte concerné') => T('Intelligence (Religion)', dc, `reconnaît ${what}.`),
  nature: (dc = 12, what = 'l’espèce et son danger') => T('Intelligence (Nature)', dc, `identifie ${what}.`),
  stealth: (dc = 13) => T('Dextérité (Discrétion), test de groupe', dc, 'passe sans être repéré.', 'les occupants sont alertés.'),
  dark: I('Obscurité totale', 'Sans source de lumière ni vision dans le noir, les créatures sont aveuglées ; tests de Perception visuelle impossibles.'),
  difficult: I('Terrain difficile', 'Chaque mètre parcouru en coûte deux.'),
  encounter: (txt: string) => I('Rencontre possible', txt),
};

/* ——— Lieux par nom (points) ——— */
const L: Record<string, Entry> = {
  // Bouts de chemins : culs-de-sac voulus et issues des voies de fuite.
  'Cul-de-sac': { d: ['Le boyau se termine contre une paroi lisse : aucune issue, sinon revenir sur ses pas.', 'Fin du diverticule : une poche étroite où l’air ne circule plus.'], dm: [K.notice(12, 'qu’il n’y a aucune issue (inutile de fouiller)'), I('Refuge', 'Un endroit défendable pour un repos court : une seule entrée à surveiller.')] },
  'Impasse piégée': { d: ['Le diverticule se termine sur un amas de pierres trop bien rangé : quelqu’un a piégé l’impasse.', 'Une impasse où pendent de vieux fils de détente ; un ossement brisé barre le sol.'], dm: [T('Sagesse (Perception)', 14, 'repère le fil de détente ou la dalle mobile.', 'déclenche le piège : sauvegarde de Dextérité DD 13 ou 2d10 dégâts contondants (chute de pierres).'), T('Dextérité (outils de voleur)', 13, 'désamorce le piège.')] },
  'Attrape-nigaud': { d: ['Des marques de passage et des flèches gravées promettent une issue… qui n’existe pas : c’est un leurre pour égarer les poursuivants.', 'Un faux passage soigneusement balisé qui ne mène qu’à une paroi : un piège à imprudents.'], dm: [T('Intelligence (Investigation)', 13, 'comprend que les marques sont un leurre.', 'le groupe perd 1d4 × 10 minutes et fait un jet de rencontre aléatoire.'), I('Embuscade', 'Ceux qui ont posé le leurre guettent parfois l’entrée de l’impasse.')] },
  'Poche close': { d: ['Le boyau débouche sur une petite poche close où l’eau goutte dans le silence.', 'Une bulle de roche au bout du diverticule ; des cristaux pâles tapissent la voûte basse.'], dm: [K.notice(13, 'un objet abandonné par un précédent voyageur'), I('Air', 'L’air y est pauvre : au-delà d’une heure, sauvegarde de Constitution DD 10 ou un niveau d’épuisement.')] },
  'Éboulement terminal': { d: ['Un éboulement ancien obstrue le boyau : il continuait autrefois.', 'La voûte s’est effondrée ici ; des courants d’air passent encore entre les blocs.'], dm: [T('Force (Athlétisme)', 18, 'dégage un passage en 1d4 heures de travail (le boyau rejoint alors la salle la plus proche).', 'les blocs bougent : sauvegarde de Dextérité DD 12 ou 2d6 dégâts contondants.')] },
  'Point de rappel': { d: ['La voie de fuite s’arrête au bord du vide : un anneau scellé et une corde cachée permettent de descendre au palier inférieur.', 'Un piton discret au bord de la paroi ; on s’y encorde pour disparaître dans le gouffre.'], dm: [T('Force (Athlétisme)', 12, 'descend en rappel jusqu’au palier inférieur en 1 minute.', 'glisse : 2d6 dégâts contondants et arrive au palier inférieur à terre.')] },
  'Conduit de fuite': { d: ['La voie se termine par une trappe dans un conduit d’aération qui débouche dans un autre quartier.', 'Une grille descellée ouvre sur un conduit étroit : la sortie des guildes.'], dm: [T('Dextérité (Acrobaties)', 12, 'se glisse dans le conduit et ressort dans un autre quartier du palier.', 'reste coincé un round, bruyamment.')] },
  'Corniche du gouffre': { d: ['La voie débouche sur une corniche étroite qui longe la paroi au-dessus du gouffre, jusqu’à un autre quartier.', 'Un ressaut de pierre à flanc de gouffre, connu des seuls assassins.'], dm: [S('Dextérité', 12, 'glisse : se rattrape au bord (agrippé) ; un second échec signifie la chute.', 'avance sans encombre.')] },
  // Eaux
  'Source tiède': { d: ['Une eau tiède sourd d’une fissure et forme une petite vasque fumante ; l’air y est doux et humide, un luxe dans la roche froide.', 'Filet d’eau tiède légèrement minéral, au goût de fer : les voyageurs y remplissent leurs outres et s’y réchauffent les mains.'], dm: [K.nature(10, 'que l’eau est potable'), I('Repos', 'Un repos court ici rend 1 dé de vie supplémentaire grâce à la chaleur.')] },
  'Résurgence': { d: ['Une rivière souterraine jaillit d’une paroi après avoir traversé la roche ; le grondement couvre les conversations.', 'L’eau ressort ici, glacée et claire, d’un réseau inexploré situé derrière la paroi.'], dm: [K.stealth(10), I('Bruit', 'Le grondement impose un désavantage aux tests de Perception auditive à moins de 10 m.')] },
  'Vasque claire': { d: ['Un bassin d’une transparence parfaite, si limpide qu’on en mesure mal la profondeur.', 'Une vasque d’eau immobile où se reflètent les cristaux du plafond.'], dm: [K.notice(14, 'un objet perdu au fond, à 3 m de profondeur'), K.swim(10)] },
  'Suintement': { d: ['La paroi ruisselle d’un suintement continu qui a poli la roche et nourrit un tapis de mousse.', 'L’eau perle sur la pierre en voile mince ; le sol au pied de la paroi est glissant.'], dm: [K.slippery(10)] },
  'Puits d’eau': { d: ['Un puits naturel, élargi à la main, donne sur une nappe à quelques mètres ; une margelle grossière l’entoure.', 'Puits d’eau douce entretenu par les passants : une corde usée pend encore à un piton.'], dm: [K.climb(10, 6), I('Eau', 'Eau potable en quantité suffisante pour un groupe.')] },
  'Gour profond': { d: ['Une succession de bassins en terrasses calcaires, dont le plus bas est d’une profondeur inquiétante.', 'Les gours, retenus par de fines murettes de calcite, forment des marches d’eau qu’il faut enjamber avec soin.'], dm: [K.slippery(12), T('Dextérité (Acrobaties)', 11, 'traverse sans briser les murettes.', 'brise une murette : le bassin se vide bruyamment.')] },
  'Mare d’infiltration': { d: ['Une flaque large et trouble, alimentée par les infiltrations du plafond ; l’eau a un goût de terre.', 'Mare stagnante où flottent des spores ; quelques insectes aveugles y patrouillent.'], dm: [K.nature(12, 'que l’eau doit être bouillie'), S('Constitution', 11, 'si bue sans précaution : empoisonné 1 heure.')] },
  'Flaque': { d: ['Une flaque d’eau de ruissellement, garde la trace des derniers pas.', 'Petite flaque où l’eau goutte au rythme lent du plafond.'], dm: [K.notice(12, 'des traces de pas récentes dans la boue')] },
  'Goutte-à-goutte': { d: ['Un goutte-à-goutte régulier creuse une cupule parfaite dans la roche ; le bruit porte loin dans le silence.', 'Une goutte tombe toutes les trois secondes depuis une stalactite : un repère sonore pour qui connaît le réseau.'] },
  'Cupule d’eau': { d: ['Une petite cupule de pierre remplie d’eau claire, de quoi boire une gorgée.', 'Une coupe naturelle creusée par les gouttes, toujours pleine.'] },
  'Cascade intérieure': { d: ['Une cascade tombe du plafond dans un bassin bouillonnant ; la bruine baigne toute la salle.', 'L’eau chute de plusieurs mètres dans un vacarme constant ; derrière le rideau, une niche sèche.'], dm: [K.hidden(14, 'une niche sèche derrière la cascade'), K.climb(15, 9)] },
  'Grande résurgence': { d: ['Une rivière entière surgit d’une gueule de pierre : l’endroit est un carrefour d’eau et de passages.', 'Résurgence puissante et glacée ; le courant emporte tout ce qui tombe dedans.'], dm: [K.swim(15), I('Danger', 'Une créature emportée réapparaît 30 m en aval, après 1d4 rounds sous l’eau.')] },
  'Lac sans fond': { d: ['Un lac noir dont personne n’a jamais touché le fond ; des bulles remontent parfois sans raison.', 'Lac immobile, si profond que la lumière s’y perd ; les échos y semblent venir d’en dessous.'], dm: [K.encounter('Sur un 1 sur 1d6 par heure passée sur la rive, quelque chose remonte observer les visiteurs.'), K.swim(13)] },
  'Rivière souterraine': { d: ['Une rivière souterraine creuse son lit dans la roche ; ses berges sont étroites et glissantes.', 'Le cours d’eau serpente entre les salles, froid et rapide.'], dm: [K.swim(13), K.slippery(11)] },
  'Lac souterrain': { d: ['Un lac calme, aux eaux sombres, borde la grande galerie ; ses rives servent de halte.', 'Vaste lac souterrain aux reflets laiteux ; des pêcheurs y posent parfois leurs nasses.'], dm: [K.forage(12, 'des poissons aveugles pour deux jours'), K.swim(12)] },
  // Vivant
  'Champignonnière': { d: ['Un champ de champignons entretenu, aux chapeaux pâles alignés sur des lits de compost.', 'Une champignonnière sauvage, dense et odorante, où les spores flottent dans l’air.'], dm: [K.nature(12, 'les espèces comestibles'), K.forage(10, 'de quoi nourrir le groupe pour deux jours'), S('Constitution', 11, 'en mangeant au hasard : empoisonné 1 heure.')] },
  'Lichen luisant': { d: ['Un tapis de lichen bioluminescent tapisse la paroi d’une lueur verdâtre suffisante pour lire.', 'Le lichen luit faiblement et s’éteint quand on l’effleure, trahissant tout passage.'], dm: [I('Lumière', 'Lumière faible dans un rayon de 6 m.'), K.notice(11, 'que le lichen a été frôlé récemment')] },
  'Nid de rothés': { d: ['Un nid de rothés : litière piétinée, odeur forte, ossements rongés.', 'Les rothés y dorment en troupeau serré ; les mâles gardent l’entrée.'], dm: [K.encounter('1d4 + 2 rothés. Hostiles si on approche à moins de 6 m.'), T('Sagesse (Dressage)', 13, 'calme le troupeau.')] },
  'Mousse phosphorescente': { d: ['Une mousse épaisse qui brille d’un bleu froid ; marcher dessus laisse des empreintes lumineuses.', 'Une mousse phosphorescente garnit les creux de la roche, utile pour baliser un chemin.'], dm: [K.notice(10, 'les empreintes lumineuses laissées par d’autres')] },
  'Toiles anciennes': { d: ['Des toiles épaisses, grises de poussière, tendues d’une paroi à l’autre ; certaines sont encore collantes.', 'De vieilles toiles d’araignée géante ; les cocons desséchés qui y pendent ont été vidés.'], dm: [S('Dextérité', 12, 'entravé par la toile (Force DD 12 pour se libérer).'), K.nature(13, 'que l’araignée n’est plus là… ou pas')] },
  'Terrier de vers': { d: ['Des galeries rondes et lisses percent la paroi : l’œuvre de vers fouisseurs.', 'Un réseau de terriers ; le sol vibre parfois sous les pieds.'], dm: [K.nature(13, 'les traces d’un ver fouisseur'), K.encounter('Un ver surgit sur un 1 sur 1d8 si le groupe fait du bruit.')] },
  'Colonie de chiroptères': { d: ['Des milliers de chauves-souris pendent au plafond ; le guano recouvre le sol.', 'Une colonie de chiroptères ; le moindre éclat de lumière déclenche un envol assourdissant.'], dm: [K.stealth(12), S('Constitution', 10, 'si l’on traverse le guano sans protection : maladie (fièvre des cavernes).')] },
  'Forêt de champignons géants': { d: ['Des champignons hauts comme des arbres forment une forêt pâle ; leurs lamelles laissent pleuvoir des spores.', 'Une forêt fongique dense, aux troncs spongieux ; l’air y est lourd et sucré.'], dm: [K.forage(10), S('Constitution', 12, 'spores somnifères : endormi 1 minute.'), K.difficult] },
  'Ossements': { d: ['Des ossements épars, rongés et dispersés par des charognards.', 'Un squelette recroquevillé contre la paroi, encore vêtu de lambeaux.'], dm: [T('Sagesse (Médecine)', 12, 'détermine la cause de la mort.'), K.notice(14, 'une bourse oubliée (2d10 po)')] },
  'Crâne de rothé': { d: ['Un crâne de rothé aux cornes brisées, posé comme une borne.', 'Un crâne de rothé, peint d’un signe ancien.'] },
  'Racine pendante': { d: ['Une racine venue d’on ne sait où pend du plafond, preuve qu’une surface vivante n’est pas si loin.', 'Racine noueuse qui traverse la voûte ; elle supporterait un poids léger.'] },
  'Mue de reptile': { d: ['Une mue de reptile, longue de plusieurs mètres.', 'Une peau de serpent abandonnée, encore souple : la bête est passée récemment.'], dm: [K.nature(12, 'la taille de la créature (grande)')] },
  'Guano': { d: ['Un amas de guano, précieux pour qui fabrique de la poudre ou du salpêtre.', 'Couche de guano épaisse et glissante.'], dm: [K.slippery(10)] },
  // Ressources
  'Filon de fer': { d: ['Un filon de fer affleure en veines rouillées ; des traces de pic montrent qu’on l’a déjà exploité.', 'Le fer colore la roche de stries brunes.'], dm: [T('Outils de mineur ou Force (Athlétisme)', 12, 'extrait 1d4 kg de minerai par heure.')] },
  'Affleurement de salpêtre': { d: ['Des cristaux blancs de salpêtre poudrent la paroi.', 'Un affleurement de salpêtre, recherché par les alchimistes.'], dm: [T('Intelligence (Arcanes) ou outils d’alchimiste', 12, 'récolte de quoi fabriquer 1 fiole de feu grégeois.')] },
  'Filon d’argent pâle': { d: ['Une veine d’argent pâle luit faiblement à la lumière ; une rareté qui attire convoitises et pièges.', 'Un mince filon argenté, tracé à la craie par un prospecteur.'], dm: [T('Outils de mineur', 14, 'extrait 1d6 × 10 po d’argent.'), K.notice(13, 'une marque de propriété gravée (il appartient à quelqu’un)')] },
  'Dépôt de soufre': { d: ['Un dépôt jaune de soufre ; l’air pique la gorge.', 'Croûtes de soufre autour d’une fissure tiède.'], dm: [K.gas(10)] },
  'Argile fine': { d: ['Une poche d’argile grise et fine, idéale pour sceller ou mouler.', 'Argile collante qui épaissit les semelles à chaque pas.'], dm: [K.difficult] },
  'Carrière ancienne': { d: ['Une carrière abandonnée : blocs taillés, rampes et marques d’outils sur toute la paroi.', 'Les anciens y ont débité la pierre en gradins ; des blocs inachevés gisent encore.'], dm: [K.history(13, 'la technique de taille (naine ancienne)'), K.climb(11, 6)] },
  'Grand gisement de fer': { d: ['Un vaste gisement de fer, assez riche pour justifier une mine — et les conflits qui vont avec.', 'Toute une paroi rouillée : la plus grande réserve de minerai de la strate.'], dm: [I('Enjeu', 'Bon prétexte de quête : plusieurs factions revendiquent le gisement.')] },
  'Veine de cristal': { d: ['Une veine de cristaux qui chantent doucement quand on les frôle.', 'Des cristaux translucides poussent en grappes ; ils captent et renvoient la lumière.'], dm: [T('Intelligence (Arcanes)', 14, 'reconnaît des cristaux propices aux focaliseurs (valeur 50 po).')] },
  'Cristal isolé': { d: ['Un cristal solitaire, gros comme le poing, planté dans la roche.', 'Une pointe de cristal qui capte la moindre lueur.'] },
  'Pépite': { d: ['Une pépite brillante coincée dans une fissure.', 'Un éclat d’or natif, oublié par les prospecteurs.'], dm: [K.notice(14, 'la pépite (1d4 × 5 po)')] },
  'Géode ouverte': { d: ['Une géode brisée révèle un cœur d’améthyste.', 'Une géode ouverte en deux, ses cristaux intacts.'] },
  // Ruines et traces de passage
  'Campement abandonné': { d: ['Un vieux campement abandonné : tentes effondrées, foyer froid, sacs éventrés. Ceux qui l’occupaient sont partis en hâte.', 'Restes d’un bivouac : couvertures moisies, marmite renversée et une carte déchirée clouée au poteau.', 'Un camp déserté depuis des mois ; quelqu’un a gravé un avertissement sur la pierre du foyer.'], dm: [K.hidden(12, 'des provisions encore bonnes et 1d6 × 5 po'), T('Sagesse (Survie)', 13, 'déduit la date et la cause du départ (attaque, éboulement ou fuite).'), K.notice(15, 'des traces de lutte')] },
  'Muret écroulé': { d: ['Un muret de pierres sèches, autrefois une protection, aujourd’hui écroulé.', 'Les restes d’un mur de défense, percé en son centre.'], dm: [I('Abri', 'Offre un abri partiel (+2 CA).')] },
  'Ancien poste': { d: ['Un ancien poste de garde : meurtrières, banc de pierre, crochets rouillés.', 'Petit poste abandonné, encore orné de l’insigne effacé d’une garnison.'], dm: [K.history(12, 'la garnison qui tenait ce poste'), K.hidden(14, 'une cache sous le banc (armes rouillées, 1 potion de soins)')] },
  'Escalier taillé': { d: ['Un escalier taillé dans la roche, aux marches usées par des siècles de passages.', 'Marches irrégulières creusées à la main ; certaines sont fendues.'], dm: [K.slippery(10)] },
  'Arche brisée': { d: ['Une arche de pierre dont la clé de voûte est tombée.', 'Les restes d’un portail monumental : l’arche s’est rompue en son milieu.'], dm: [K.history(13, 'les symboles gravés sur les piédroits')] },
  'Foyer éteint': { d: ['Les cendres d’un feu récent, encore tièdes au cœur.', 'Un cercle de pierres noircies : quelqu’un a campé ici.'], dm: [T('Sagesse (Survie)', 12, 'estime que le feu date de moins d’un jour.')] },
  'Corde pourrie': { d: ['Une corde pend d’un piton ; les fibres s’effilochent.', 'Vieille corde fixée à la paroi, tentante mais pourrie.'], dm: [K.notice(11, 'que la corde ne tiendra pas'), I('Piège involontaire', 'Qui s’y suspend chute (1d6 contondants par 3 m).')] },
  'Cristal-lueur brisé': { d: ['Un cristal-lueur de voyageur, brisé sur une saillie ; ses éclats ne luisent presque plus.', 'Les débris d’un cristal de marche, abandonné dans la fuite ; une lueur mourante palpite encore.'] },
  'Piton planté': { d: ['Un piton d’escalade planté dans la roche, encore solide.', 'Une rangée de pitons balise une voie d’escalade.'], dm: [I('Aide', 'Avantage au prochain test d’Athlétisme pour grimper ici.')] },
  'Tas de scories': { d: ['Des scories d’une ancienne fonderie, vitreuses et coupantes.', 'Déchets de forge amoncelés.'] },
  'Outil rouillé': { d: ['Un pic de mineur rongé par la rouille.', 'Un outil oublié, preuve d’un ancien chantier.'] },
  'Cairn': { d: ['Un cairn de pierres empilées marque un embranchement.', 'Petit tas de pierres dressé par des voyageurs pour indiquer la bonne voie.'], dm: [T('Sagesse (Survie)', 10, 'comprend la direction indiquée.')] },
  'Inscription gravée': { d: ['Une inscription gravée dans la roche, à demi effacée.', 'Des runes taillées au burin : un nom, une date, un avertissement.'], dm: [K.history(12, 'la langue et le sens de l’inscription')] },
  'Marque de passage': { d: ['Une flèche tracée à la craie indique un passage.', 'Marque de guide griffée sur la paroi.'] },
  'Empreintes': { d: ['Des empreintes dans la poussière, nombreuses et récentes.', 'Des traces de pas mêlées à des marques de griffes.'], dm: [T('Sagesse (Survie)', 12, 'identifie le nombre et la nature des créatures passées.')] },
  'Galets polis': { d: ['Des galets polis par une eau disparue.', 'Un lit de galets lisses, vestige d’une ancienne rivière.'] },
  'Fente d’aération': { d: ['Une fente souffle un air frais : il y a une autre salle derrière.', 'Un courant d’air sort d’une fissure étroite.'], dm: [K.hidden(13, 'une salle de l’autre côté de la fente')] },
  'Coquilles fossiles': { d: ['Des coquilles fossilisées incrustées dans la pierre, souvenirs d’une mer engloutie.', 'Un banc de fossiles marins.'] },
  'Fissure fraîche': { d: ['Une fissure récente zèbre la paroi : la roche travaille.', 'Fissure aux arêtes vives, signe d’un mouvement récent.'], dm: [K.notice(12, 'que la zone est instable')] },
  'Pierre branlante': { d: ['Un bloc en équilibre précaire au-dessus du passage.', 'Une pierre branlante prête à tomber au moindre choc.'], dm: [K.rockfall(12, '2d6')] },
  'Comptoir abandonné': { d: ['Un ancien comptoir marchand : entrepôts vides, balances rouillées, registres moisis.', 'Le poste de commerce a été pillé ; seuls restent les comptoirs de pierre.'], dm: [K.hidden(14, 'un registre indiquant une cache de marchandises'), K.history(12, 'les guildes qui commerçaient ici')] },
  'Fortin en ruine': { d: ['Un fortin en ruine verrouille encore la galerie ; une tour tient debout.', 'Murs crénelés effondrés et porte arrachée : on s’est battu ici.'], dm: [I('Position défensive', 'Abri important (+5 CA) derrière les créneaux.'), K.encounter('Des pillards ou des créatures en ont fait leur repaire (1 chance sur 3).')] },
  'Pont naturel': { d: ['Une arche naturelle enjambe un vide ; on la traverse en file.', 'Pont de roche étroit au-dessus d’un gouffre.'], dm: [K.slippery(10), I('Chute', 'Une chute dans le vide : 6d6 dégâts contondants.')] },
  // Sacré
  'Niche votive': { d: ['Une niche creusée dans la paroi abrite des offrandes : perles, éclats de cristal, ossements.', 'Petite niche votive, encore fleurie de champignons séchés.'], dm: [K.religion(12, 'la divinité honorée')] },
  'Pierre levée': { d: ['Une pierre levée plantée au centre de la salle, gravée de spirales.', 'Un menhir sombre et poli par les mains des pèlerins.'], dm: [K.religion(14, 'un ancien lieu de culte de la Toile')] },
  'Bas-relief effacé': { d: ['Un bas-relief à demi effacé représente une procession.', 'Les silhouettes sculptées ont été martelées volontairement.'], dm: [K.history(14, 'qui a voulu effacer ce récit et pourquoi')] },
  'Cercle de pierres levées': { d: ['Un cercle de pierres levées entoure une dalle centrale noircie.', 'Le cercle bourdonne d’une magie ancienne ; l’air y est plus froid.'], dm: [T('Intelligence (Arcanes)', 15, 'détecte une aura de divination.'), K.religion(13)] },
  'Autel oublié': { d: ['Un autel oublié, couvert de cire ancienne et de taches sombres.', 'Autel taillé dans la roche ; des offrandes récentes prouvent qu’on y vient encore.'], dm: [K.religion(13), K.hidden(15, 'un compartiment secret sous l’autel')] },
  // Dangers
  'Éboulis instable': { d: ['Un champ de blocs instables : chaque pas peut déclencher une avalanche de pierres.', 'Éboulis récent qui bloque à moitié le passage.'], dm: [K.rockfall(13), K.difficult] },
  'Poche de gaz': { d: ['Une poche de gaz invisible stagne au fond de la salle ; la lueur des cristaux y pâlit.', 'L’air y sent l’œuf pourri ; même le lichen lumineux y est mort.'], dm: [K.gas(13), I('Explosion', 'Une flamme nue enflamme la poche : 3d6 dégâts de feu (sauvegarde de Dextérité DD 13, moitié).')] },
  'Corniche glissante': { d: ['Une corniche étroite et humide longe le vide ; le calcaire y est poli comme du verre.', 'Corridor glissant en surplomb : un pas de travers et c’est la chute.'], dm: [K.slippery(13), I('Chute', '2d6 dégâts contondants en contrebas.')] },
  'Plafond fissuré': { d: ['Le plafond est fendu de part en part ; de petits gravats tombent régulièrement.', 'Un plafond lézardé qui ne demande qu’une vibration pour céder.'], dm: [K.notice(12, 'les signes d’effondrement imminent'), K.rockfall(12)] },
  'Trou souffleur': { d: ['Un trou dans le sol expulse un souffle d’air chaud par intermittence.', 'Le trou souffle et aspire comme une respiration.'], dm: [K.hidden(12, 'qu’il donne sur une salle inférieure')] },
  'Gouffre': { d: ['Un gouffre ouvert dans le sol ; on n’en entend pas le fond.', 'Puits vertical de plusieurs dizaines de mètres.'], dm: [K.climb(15, 30)] },
  'Faille fumante': { d: ['Une faille exhale des vapeurs chaudes et soufrées.', 'Vapeurs et chaleur montent d’une fissure béante.'], dm: [K.gas(12), I('Chaleur', 'Sauvegarde de Constitution DD 10 par heure passée près de la faille, sinon un niveau d’épuisement.')] },
  'Champ d’éboulis': { d: ['Un vaste champ d’éboulis, chaos de blocs effondrés.', 'Toute la salle s’est effondrée en un champ de pierres.'], dm: [K.difficult, K.rockfall(12)] },
  'Plafond effondré': { d: ['Le plafond s’est effondré, ouvrant une cheminée vers une salle supérieure.', 'Une montagne de gravats sous un trou béant.'], dm: [K.climb(14, 9)] },
  // Garde
  'Poste de guet': { d: ['Un poste de guet surplombe le carrefour : on y voit venir de loin.', 'Plateforme de guet dissimulée derrière un rideau de stalactites.'], dm: [I('Position', 'Avantage aux tests de Perception depuis le poste.')] },
  'Cache de vivres': { d: ['Une cache de vivres scellée sous une dalle.', 'Réserve de nourriture séchée, dissimulée par des marchands prévoyants.'], dm: [K.hidden(13, 'la cache (rations pour 1d6 jours)')] },
  'Abri sous roche': { d: ['Un abri sous roche sec et discret, idéal pour un repos long.', 'Un surplomb protège des chutes de pierres ; on y a déjà dormi.'], dm: [I('Repos', 'Un repos long ici n’attire pas de rencontre aléatoire.')] },
  'Barricade': { d: ['Une barricade de planches et de pierres ferme le passage.', 'Une barricade hâtive, renforcée de pieux.'], dm: [T('Force (Athlétisme)', 15, 'dégage la barricade (10 minutes, bruyant).')] },
  // Grottes
  'Cheminée': { d: ['Une cheminée verticale s’élève vers une salle supérieure.', 'Un conduit étroit monte dans l’obscurité ; on y sent un courant d’air.'], dm: [K.climb(13, 9)] },
  'Siphon': { d: ['Un siphon noyé : pour passer, il faut plonger et nager sous la roche.', 'L’eau remplit entièrement le conduit sur plusieurs mètres.'], dm: [T('Force (Athlétisme)', 13, 'franchit le siphon en apnée.', 'remonte à court d’air : 1 niveau d’épuisement.'), I('Apnée', 'Une créature retient son souffle 1 + modificateur de Constitution minutes.')] },
  'Salle annexe': { d: ['Une petite salle annexe, à l’écart du passage.', 'Recoin calme, à l’abri des courants d’air.'] },
  'Lucarne': { d: ['Une lucarne naturelle donne sur la salle voisine.', 'Une ouverture à hauteur d’homme permet d’espionner la salle d’à côté.'], dm: [K.stealth(12)] },
  // Obstacles des espaces de transit
  'Étroiture': { d: ['Une étroiture où il faut avancer de profil, la poitrine contre la pierre.', 'Le passage se resserre à moins de quarante centimètres.'], dm: [K.squeeze(12)] },
  'Ressaut': { d: ['Un ressaut de plusieurs mètres à escalader.', 'Une marche rocheuse haute de quatre mètres, aux prises rares.'], dm: [K.climb(13, 4)] },
  'Laminoir': { d: ['Un laminoir : plafond si bas qu’on progresse en rampant sur des dizaines de mètres.', 'Passage écrasé entre deux strates de roche, à plat ventre.'], dm: [K.squeeze(13), S('Constitution', 11, 'un niveau d’épuisement après la traversée.')] },
  'Puits à corde': { d: ['Un puits vertical qu’on ne descend qu’à la corde.', 'Un puits de douze mètres ; un ancrage ancien permet d’y fixer une corde.'], dm: [K.climb(12, 12)] },
  'Trémie instable': { d: ['Une trémie : un empilement de blocs instables à traverser.', 'Le passage se faufile entre des rochers qui bougent sous le poids.'], dm: [K.rockfall(14)] },
  'Air vicié': { d: ['L’air y est rare et vicié ; les flammes faiblissent.', 'Un recoin où l’on respire mal, chargé de gaz lourd.'], dm: [K.gas(13)] },
  'Désescalade': { d: ['Une paroi à désescalader, sans prise évidente.', 'On descend face à la roche, à tâtons.'], dm: [K.climb(15, 6)] },
  'Vasque profonde': { d: ['Une vasque profonde barre le passage ; il faut nager.', 'Un bassin froid, sans fond visible, à traverser à la nage.'], dm: [K.swim(12)] },
  'Boue collante': { d: ['Une boue épaisse qui aspire les bottes.', 'Le sol est un bourbier d’argile.'], dm: [K.difficult, T('Force', 11, 'se dégage.', 'reste entravé un round.')] },
  'Chatière': { d: ['Une chatière : un trou à peine assez large pour une personne.', 'Un passage si étroit qu’il faut retirer son paquetage.'], dm: [K.squeeze(14)] },
  // Repères majeurs
  'Halte des Lueurs': { d: ['Une halte de caravanes sous une voûte constellée de cristaux pâles ; on y échange nouvelles et marchandises.', 'La seule lueur à des lieues : un relais de voyageurs blotti sous des grappes de cristaux.'], dm: [T('Charisme (Persuasion)', 12, 'obtient une rumeur utile.'), I('Repos', 'Un repos long en sécurité, contre 5 pa par personne.')] },
  'Grande Voûte': { d: ['Une salle immense dont la voûte se perd dans l’obscurité ; les échos y durent des secondes.', 'La plus vaste cavité connue de la strate.'] },
  'Lac Sombre': { d: ['Un lac aux eaux noires ; on dit que quelque chose y vit.', 'Lac immobile, entouré de champignons blancs.'], dm: [K.encounter('Une créature aquatique sur un 1 sur 1d6.')] },
  'Forêt minérale': { d: ['Une forêt de stalagmites si dense qu’on s’y perd.', 'Des milliers de colonnes forment un labyrinthe minéral.'], dm: [T('Sagesse (Survie)', 14, 'trouve son chemin.', 'le groupe se perd 1d4 heures.')] },
  'Gouffre de la Fosse': { d: ['Un gouffre immense, réputé sans fond.', 'La Fosse : un abîme où disparaissent les condamnés.'], dm: [K.climb(18, 60)] },
  'Ancien Comptoir': { d: ['Les ruines d’un grand comptoir marchand d’autrefois.', 'Un ancien relais commercial à l’abandon.'], dm: [K.history(13)] },
  'Lac Profond': { d: ['Un lac profond, froid, aux reflets bleutés.', 'Le plus grand lac de la strate basse.'] },
  'Faille Ardente': { d: ['Une faille rougeoyante d’où monte une chaleur suffocante.', 'La roche y est brûlante ; la lave affleure par endroits.'], dm: [I('Chaleur extrême', 'Sauvegarde de Constitution DD 5 (+1 par heure) sinon un niveau d’épuisement.'), S('Dextérité', 14, '4d6 dégâts de feu en cas de jaillissement de lave.')] },
  // Site d'essai et relevé de la strate I-3
  'Site d’essai': { d: ['Une petite cité taillée en trois paliers dans la roche : galeries de guet en haut, halles au centre, citernes en bas.'] },
  'Fissures instables': { d: ['Une zone de fissures actives où le sol se dérobe.'], dm: [K.rockfall(13)] },
  'Zone instable': { d: ['Le sol craque et se fend : ici, la strate travaille encore.'], dm: [K.rockfall(13)] },
  'Grotte d’essai': { d: ['Une grotte sèche à l’écart, abri apprécié des voyageurs.'] },
  'Sanctuaire d’essai': { d: ['Un petit sanctuaire creusé dans la paroi, aux offrandes fraîches.'], dm: [K.religion(12)] },
  'Colonie fongique observée': { d: ['Une colonie de champignons rares, étudiée par les savants des Archives.'], dm: [K.nature(14, 'une espèce aux spores médicinales')] },
  'Salle du débouché': { d: ['La salle où débouche la galerie venant de l’entre-strate ; on y reprend son souffle.'] },
  'Alcôve de garde': { d: ['Une alcôve où un garde surveille le couloir ; un cristal voilé y luit à peine.'], dm: [K.stealth(14)] },
  'Galerie des guetteurs': { d: ['Galerie percée de meurtrières, d’où les guetteurs surveillent les accès.'] },
  'Archives locales': { d: ['Les registres et cartes du site, gardés dans une salle sèche.'], dm: [T('Intelligence (Investigation)', 12, 'trouve une carte des passages du secteur.')] },
  'Ateliers': { d: ['Ateliers d’artisans : forge, tour de potier, établis.'] },
  'Bassin central': { d: ['Le bassin qui alimente le site en eau.'] },
  'Citernes voûtées': { d: ['Citernes sous voûtes, réserve d’eau du site.'] },
  'Réserve effondrée': { d: ['Une réserve dont le plafond a cédé ; des caisses gisent sous les gravats.'], dm: [K.hidden(13, 'des caisses intactes')] },
  // Ville (site d'essai)
  'Corps de garde': { d: ['Le poste de la garde locale.'] }, 'Maison commune': { d: ['La salle où se réunissent les habitants.'] }, 'Greffe': { d: ['Le greffe tient registres et contrats.'] },
  'Forge': { d: ['Une forge dont la chaleur se sent de loin.'] }, 'Entrepôt': { d: ['Entrepôt de marchandises.'] }, 'Étals': { d: ['Étals de marché.'] }, 'Tannerie': { d: ['Une tannerie à l’odeur âcre.'] },
  'Fontaine': { d: ['Fontaine publique.'] }, 'Puits': { d: ['Puits commun.'] }, 'Autel domestique': { d: ['Petit autel de quartier.'] }, 'Jardin de champignons': { d: ['Jardin de champignons entretenu.'] },
  'Charrette renversée': { d: ['Une charrette renversée encombre la rue.'] }, 'Échafaudage': { d: ['Un échafaudage le long d’une façade.'] }, 'Lanterne de rue': { d: ['Une lanterne publique.'] },
  'Borne': { d: ['Une borne de pierre.'] }, 'Enseigne': { d: ['Une enseigne peinte.'] }, 'Statue usée': { d: ['Une statue usée par le temps.'] }, 'Escalier extérieur': { d: ['Un escalier extérieur.'] },
  'Abreuvoir': { d: ['Un abreuvoir pour les bêtes.'] }, 'Rigole': { d: ['Une rigole d’évacuation.'] }, 'Enclos à rothés': { d: ['Un enclos à rothés.'] },
  // Hosten Valak : cachettes des assassins
  'Cache d’armes': { d: ['Une cache d’armes dissimulée dans un renfoncement : dagues, arbalètes de poing, carreaux enduits.', 'Derrière une pierre descellée, un râtelier de lames prêtes à servir.'], dm: [K.hidden(15, 'la cache (1d4 dagues, 1 arbalète de poing, 10 carreaux)')] },
  'Planque': { d: ['Une planque meublée d’une paillasse et de quelques provisions : on peut s’y faire oublier quelques jours.', 'Pièce minuscule derrière une porte banale ; la serrure est neuve.'], dm: [K.hidden(14, 'la porte dérobée'), T('Outils de voleur', 15, 'crochète la serrure.')] },
  'Niche dérobée': { d: ['Une niche cachée derrière une tenture, juste assez grande pour une personne.', 'Un creux dans la paroi, masqué par un faux moellon.'], dm: [K.hidden(14, 'la niche')] },
  'Trappe': { d: ['Une trappe dans le sol, bien huilée, s’ouvre sur un conduit vers le palier inférieur.', 'Une dalle basculante, piégée pour qui ne connaît pas le signe.'], dm: [K.hidden(15, 'la trappe'), S('Dextérité', 14, 'chute dans le conduit : 2d6 dégâts contondants.')] },
  'Alcôve secrète': { d: ['Une alcôve secrète où l’on peut écouter les conversations de la salle voisine.', 'Un recoin derrière un panneau pivotant.'], dm: [K.hidden(15, 'le panneau pivotant')] },
  'Poste d’observation': { d: ['Un poste d’observation caché d’où l’on surveille tout le palier.', 'Une fente de guet ménagée dans la sculpture.'], dm: [I('Position', 'Avantage aux tests de Perception ; vue sur toute la place.')] },
  'Faux mur': { d: ['Un faux mur, en bois peint comme de la pierre.', 'Un pan de mur qui sonne creux.'], dm: [K.hidden(16, 'le faux mur'), T('Sagesse (Perception)', 14, 'remarque l’air qui passe sous le mur.')] },
  'Cache de poisons': { d: ['Une cache de fioles soigneusement étiquetées en code.', 'Des poisons rangés dans une boîte doublée de plomb.'], dm: [K.hidden(15, 'la cache (1d4 doses de poison)'), T('Intelligence (outils d’empoisonneur)', 13, 'identifie les poisons.')] },
  'Boîte aux lettres morte': { d: ['Une fente discrète où les agents se laissent des messages.', 'Une pierre creuse servant de boîte aux lettres pour les guildes.'], dm: [K.hidden(16, 'un message chiffré'), T('Intelligence (Investigation)', 15, 'déchiffre le message.')] },
  'Repaire de guet': { d: ['Un abri de guetteurs, quelques couvertures et un sifflet d’alerte.'], dm: [K.stealth(14)] },
};

/* ——— Lieux de Hosten Valak (d'après les cartes officielles) ——— */
const HV: Record<string, string> = {
  'La Porte souterraine': 'Ancienne entrée creusée dans la roche, à l’ouest du Seuil ; accès discret vers la cité.',
  'Les Tours jumelles': 'Deux tours de guet qui encadrent la grande porte et surveillent le gouffre.',
  'Porte de Hosten Valak': 'Porte monumentale de la cité, coiffée d’une couronne de flèches sculptées ; un escalier en descend vers la Traversée du Vide.',
  'Retranchement militaire': 'Position fortifiée sur la corniche est : barricades, postes de tir, réserve d’armes.',
  'Le Grand Gouffre': 'Abîme central du Seuil, sans fond visible ; la cité est bâtie sur ses parois.',
  'La Traversée du Vide': 'Chaussée étroite et vertigineuse qui descend de la Porte vers le Portail d’arrivée, au-dessus du gouffre.',
  'Le Passage du Canyon': 'Sentier taillé dans une faille, reliant la corniche est au Retranchement militaire.',
  'Le Pont suspendu': 'Pont de cordes et de planches reliant les corniches ouest au-dessus du vide.',
  'Le Pont de la Brume noire': 'Pont bas, souvent noyé dans une brume sombre montant du gouffre.',
  'Portail d’arrivée': 'Portail magique encadré de deux obélisques : point d’arrivée des voyageurs.',
  'Le Pont des Veines de pierre': 'Arche naturelle veinée de minerai, reliant le portail à la corniche est.',
  'Quartier résidentiel noble': 'Demeures cossues au nord de la Grande Place, au sommet de grands escaliers.',
  'Enclos des bêtes': 'Écuries et enclos des montures et bêtes de somme des visiteurs.',
  'Canalisations d’air': 'Bouches et conduits d’aération qui ventilent la cité ; grilles visibles dans la roche.',
  'Canalisations d’eau': 'Conduits et arrivées d’eau qui alimentent fontaines et quartiers.',
  'Faubourgs résidentiels': 'Habitations modestes et serrées au nord-est.',
  'Temple': 'Temple d’accueil dédié à la déesse, à l’ouest de la place.',
  'La Grande Place': 'Vaste place pavée en losange, ornée d’une fontaine de cristal en son centre.',
  'Parvis des Marchands': 'Parvis commerçant où s’installent étals et marchands ambulants.',
  'Bazar': 'Bazar dense et animé, sous tentes et auvents, à l’est de la place.',
  'Voûtes historiques': 'Salles voûtées abritant archives et sculptures anciennes de la cité.',
  'Hall militaire': 'Bâtiment de la garde de l’Accueil ; contrôle des arrivants.',
  'Les Échoppes de pierre': 'Boutiques taillées dans la roche, au sud-ouest.',
  'Pont suspendu': 'Pont suspendu au sud-ouest, au-dessus d’une fosse.',
  'Quartier des Nobles': 'Hôtels particuliers des grandes familles de la cité.',
  'Quartier des Magistrats': 'Résidences et cabinets des juges et magistrats.',
  'Quartier des Ambassades': 'Représentations des cités et puissances étrangères.',
  'Quartier des Archivistes': 'Quartier des scribes et gardiens des registres.',
  'Salle des Délibérations': 'Salle où se réunit le conseil de la cité, au nord de la place circulaire.',
  'Galerie des Ancêtres': 'Galerie couverte bordant la place circulaire, ornée de portraits et statues d’ancêtres.',
  'Quartier des Académies': 'Écoles et académies savantes.',
  'Quartier des Étudiants': 'Logements et lieux de vie des étudiants.',
  'Quartier des Serviteurs des Temples': 'Habitations des prêtres subalternes et serviteurs du culte.',
  'Temple de la Fusion': 'Grand temple à flèches sous le regard de la déesse, devant un bassin de lumière ; cœur religieux de la cité.',
  'Académie': 'Académie établie sur la terrasse ouest.',
  'Quartiers du Haut Clergé': 'Résidences des hauts prêtres, sur la terrasse est.',
  'Hall des Marchands': 'Palais marchand au sommet de la grande allée ; siège des guildes de commerce.',
  'Marché du Bas-Monde': 'Marché des produits de l’Outreterre profonde, à l’ouest.',
  'Marché des Artisans': 'Étals d’artisans le long de la grande allée.',
  'Marché des Ombres': 'Marché noir discret, à l’est : poisons, secrets, contrats.',
  'Marché des Tisserands': 'Étoffes, toiles d’araignée tissées et teintures.',
  'Marché des Voyageurs': 'Provisions et équipement pour les caravanes et voyageurs.',
  'Chambre des Cartographes': 'Atelier des cartographes : cartes et itinéraires de l’Outreterre.',
  'Terrasse des Marchands': 'Terrasse surplombant l’eau, au sud-est ; lieu de négoce et de rencontre.',
  'Hall des Stratèges': 'Salle de planification militaire des capitaines.',
  'Temple de la Gueule sacrée': 'Temple logé dans la gueule de la déesse, sous ses crocs de pierre.',
  'Mess des Officiers': 'Réfectoire et salle commune des officiers.',
  'Caserne des Veilleurs nocturnes': 'Caserne de la garde de nuit.',
  'Salle du Conseil des Capitaines': 'Salle où siègent les capitaines de la cité.',
  'Dortoir des Ombres': 'Dortoir des assassins et agents de l’ombre.',
  'Grande Forge des Armes': 'Forge principale où sont fabriquées les lames.',
  'Fosses d’entraînement': 'Arènes et fosses d’entraînement au combat, au centre de la place.',
  'Armurerie du Bastion': 'Réserve d’armes et d’armures de la garnison.',
  'Atelier des Lames empoisonnées': 'Atelier où les lames sont enduites de poison.',
  'Forges de réparation': 'Forges d’entretien et de réparation des armes.',
  'Laboratoire de venins': 'Laboratoire de préparation des venins et poisons.',
  'Chenils de guerre': 'Chenils des bêtes de guerre.',
  'Culture de lichens': 'Cultures de lichens au pied d’une cascade, parmi des champignons géants.',
  'Culture de spores': 'Cultures de spores au nord-est.',
  'Culture de spores (est)': 'Second champ de cultures de spores, à l’est.',
  'Sangliers cavernicoles': 'Enclos des sangliers cavernicoles.',
  'Ferme de racines cavernicoles': 'Ferme où l’on cultive des racines souterraines.',
  'Réservoir de nourriture': 'Réserves de vivres, au pied des silos.',
  'Grenier principal': 'Grand grenier et silos de la cité.',
  'Enclos de reproduction': 'Grand enclos d’élevage du bétail souterrain.',
  'Ferme de champignons': 'Champignonnières en rangs.',
  'Enclos des scarabées': 'Élevage de scarabées géants.',
  'Cervidés cavernicoles aveugles': 'Enclos des cervidés aveugles des cavernes.',
  'Knollmark': 'Hameau rattaché au Grenier, au sud-est.',
  'Pompes principales (ouest)': 'Tour de pompes ouest : elle élève l’eau du lac vers les paliers.',
  'Pompes principales (est)': 'Tour de pompes est.',
  'Tour de pompage': 'Tour de pompage centrale, au-dessus des égouts.',
  'Égouts principaux': 'Déversoir des égouts de la cité dans le lac.',
  'Bassins de filtration': 'Bassins en gradins où l’eau est filtrée.',
  'Canaux secondaires': 'Canalisations secondaires le long de la rive est.',
  'Le Grand Lac': 'Lac souterrain au pied de la cité, alimenté par cascades et égouts.',
  'Réservoir intermédiaire': 'Réservoir de stockage entre filtration et pompes.',
  'Salle de filtration': 'Salle des machines de filtration, à l’ouest.',
  'Aqueduc principal': 'Grande conduite qui ceinture le lac.',
  'Bassin de régulation': 'Bassin qui régule le niveau des eaux, au sud-est.',
  'Canaux d’évacuation': 'Canaux d’évacuation vers les profondeurs.',
  'Corniche des Tours': 'Corniche reliant la Porte souterraine aux Tours jumelles.',
  'Corniche du Retranchement': 'Corniche reliant la grande porte au Retranchement militaire.',
  'Allée des Nobles': 'Allée reliant la place circulaire au quartier des Nobles.',
  'Allée des Académies': 'Allée reliant la place circulaire au quartier des Académies.',
  'Allée des Archivistes': 'Allée reliant la place circulaire au quartier des Archivistes.',
  'Allée des Serviteurs': 'Allée reliant la place circulaire au quartier des Serviteurs des Temples.',
  'Grande allée du marché': 'Grande allée pavée qui traverse le marché, du Hall des Marchands jusqu’au sud.',
  'Ruisseau des cascades': 'Ruisseau issu des cascades, qui traverse le marché.',
  'Étang du Grenier': 'Étang alimenté par la rivière, au nord du Grenier.',
  'Bassin aux cascades': 'Bassin au pied de la cascade du Grenier.',
};
/** Conseils MJ propres à certains lieux de Hosten Valak (la cité des assassins). */
const HV_DM: Record<string, Check[]> = {
  'Marché des Ombres': [T('Charisme (Persuasion) ou Tromperie', 15, 'obtient un contact de guilde ou un contrat.'), K.stealth(14)],
  'Laboratoire de venins': [S('Constitution', 13, 'vapeurs : empoisonné 1 heure.'), T('Intelligence (outils d’empoisonneur)', 14, 'récupère 1 dose de poison.')],
  'Atelier des Lames empoisonnées': [S('Constitution', 13, 'éraflure d’une lame : 2d6 dégâts de poison.')],
  'Dortoir des Ombres': [K.stealth(16), I('Rencontre', '2d4 assassins au repos ; l’alarme est donnée sur un échec.')],
  'La Traversée du Vide': [K.slippery(12), I('Chute', 'Une chute dans le gouffre est mortelle sans magie.')],
  'Le Pont suspendu': [S('Dextérité', 11, 'une planche cède : agrippé au câble (Athlétisme DD 12 pour remonter).')],
  'Le Pont de la Brume noire': [I('Brume', 'Zone fortement obscurcie ; désavantage aux tests de Perception visuelle.'), K.slippery(12)],
  'Portail d’arrivée': [T('Intelligence (Arcanes)', 14, 'comprend le fonctionnement du portail.')],
  'Hall militaire': [T('Charisme (Persuasion)', 12, 'passe le contrôle sans fouille.', 'fouille complète et 5 po de « droit d’entrée ».')],
  'Fosses d’entraînement': [T('Force (Athlétisme)', 13, 'gagne le respect des recrues lors d’un duel amical.')],
  'Égouts principaux': [S('Constitution', 12, 'fièvre des égouts (maladie).')],
  'Chambre des Cartographes': [T('Intelligence (Investigation)', 13, 'achète ou consulte une carte révélant un accès dérobé.')],
  'Temple de la Fusion': [K.religion(13, 'le culte de la fusion des deux sœurs')],
};

/* ——— Tracés ——— */
const TRACE: Record<string, Entry> = {
  tunnel: { d: ['Grande voie taillée et entretenue, assez large pour une caravane de rothés. De loin en loin, un cristal pâle serti dans la paroi marque la route.', 'Route majeure de la strate : les ornières des chariots sont creusées dans la pierre, et des bornes marquent les embranchements.'], dm: [K.encounter('Sur 1d20, 17+ par heure : une caravane, une patrouille ou des pillards.'), I('Voyage', 'Rythme normal ; pas de terrain difficile.')] },
  galerie: { d: ['Galerie large où l’on marche à plusieurs de front ; le sol est relativement plat.', 'Une galerie naturelle élargie par les passages, aux parois polies par les passages.'], dm: [K.encounter('Sur 1d20, 18+ par heure de marche.')] },
  boyau: { d: ['Boyau bas où l’on progresse courbé, les épaules frôlant la roche.', 'Conduit étroit et sinueux, au plafond bas et irrégulier.'], dm: [K.difficult, I('Taille', 'Les créatures de taille Grande doivent se serrer.')] },
  etroit: { d: ['Passage étroit où l’on avance de profil, une épaule après l’autre.', 'Fissure élargie, juste assez large pour une personne sans son sac.'], dm: [K.squeeze(12)] },
  crevasse: { d: ['Crevasse aux parois coupantes ; on la franchit en opposition, les pieds sur une paroi, le dos contre l’autre.', 'Une faille irrégulière et profonde, qu’il faut longer sur une vire étroite.'], dm: [K.climb(13, 6), S('Dextérité', 12, '1d6 dégâts tranchants sur les arêtes.')] },
  ruisseau: { d: ['Un cours d’eau froid creuse son lit ; ses berges sont glissantes.', 'L’eau court sur des galets ; on la suit pour retrouver la sortie.'], dm: [K.swim(11), K.slippery(10)] },
  secret: { d: ['Un passage dérobé, connu de rares initiés ; son entrée est masquée par un éboulis ou une dalle pivotante.', 'Un conduit secret, sans trace de pas, qui relie deux salles en évitant les voies fréquentées.'], dm: [K.hidden(15, 'l’entrée du passage')] },
};
const TRACE_SPECIAL: Record<string, Entry> = {
  'Voie de fuite': { d: ['Itinéraire de repli connu des guildes : corniches, conduits et trappes qui mènent à la paroi ou au gouffre.', 'Chemin de fuite balisé par des marques discrètes, invisible pour qui ne sait pas les lire.'], dm: [T('Intelligence (Investigation)', 14, 'repère les marques de la voie de fuite.'), T('Dextérité (Acrobaties)', 13, 'suit la voie à pleine vitesse pendant une poursuite.')] },
  'Diverticule': { d: ['Un cul-de-sac étroit qui s’enfonce dans la roche : il ne mène nulle part, et c’est voulu (voir le repère au bout).', 'Petite galerie sans issue, refuge idéal pour une embuscade ; son extrémité est signalée sur la carte.'], dm: [I('Embuscade', 'Avantage à la Discrétion pour qui s’y cache.')] },
};

/* ——— Salles (étiquettes de zone) ——— */
const HALL_Q: [RegExp, string, Check?][] = [
  [/échos/i, 'Les voix y reviennent démultipliées : impossible d’y chuchoter sans être entendu à l’autre bout.', I('Acoustique', 'Désavantage aux tests de Discrétion liés au bruit.')],
  [/orgues/i, 'De grandes colonnes cannelées vibrent sous le vent comme les tuyaux d’un orgue.'],
  [/brumes/i, 'Une brume tiède flotte au ras du sol et masque les pieds.', I('Brume', 'Zone légèrement obscurcie.')],
  [/colonnes|piliers/i, 'Une forêt de colonnes soutient la voûte ; on y joue à cache-cache avec la lumière.'],
  [/basse/i, 'Le plafond est si bas qu’on avance courbé sur une bonne partie de la salle.'],
  [/ressac/i, 'Un lac intérieur y produit un étrange ressac contre les rochers.'],
  [/fendue|brisée|effondrée/i, 'Une grande fracture coupe la salle en deux ; des blocs effondrés encombrent le sol.', K.rockfall(12)],
  [/cristaux/i, 'Des cristaux poussent partout et renvoient la moindre lueur en mille éclats.'],
  [/stalactites/i, 'Des milliers de stalactites hérissent la voûte, certaines fendues et menaçantes.', S('Dextérité', 12, 'une stalactite se détache : 2d6 dégâts perforants.')],
  [/aveugle/i, 'La salle semble sans issue ; il faut chercher pour trouver la sortie.', K.hidden(13, 'la sortie cachée')],
  [/ocre|rouge/i, 'Les parois sont colorées d’ocre et d’oxydes rouges.'],
  [/vent froid/i, 'Un courant d’air glacé traverse la salle en permanence.', S('Constitution', 10, 'après un repos long ici : un niveau d’épuisement (froid).')],
  [/noyée|humide|mille gouttes/i, 'L’eau ruisselle partout et noie le fond de la salle.', K.swim(10)],
  [/grise|blanche|bleue/i, 'Une roche d’une teinte singulière donne son nom à la salle.'],
  [/lichens/i, 'Un tapis de lichen luminescent éclaire faiblement la salle.'],
  [/sèche/i, 'Une salle sèche, à l’abri de l’humidité : excellente pour bivouaquer.'],
  [/longue/i, 'Une salle allongée, presque une galerie, qui s’étire dans l’obscurité.'],
  [/jumelle/i, 'Deux salles presque identiques, séparées par une arche naturelle.'],
  [/racines/i, 'Des racines venues de la surface traversent la voûte.'],
  [/chiroptères/i, 'Une colonie de chauves-souris occupe la voûte.', K.stealth(12)],
  [/tiède/i, 'Une chaleur douce y règne, venue d’une source profonde.'],
  [/silence|calme|close/i, 'Un silence absolu, presque oppressant ; le moindre bruit y résonne.'],
  [/cendres/i, 'Une couche de cendre recouvre le sol, vestige d’un ancien incendie.'],
  [/morte/i, 'Rien n’y pousse et rien n’y vit ; l’air y est lourd.', S('Constitution', 11, 'air pauvre : empoisonné tant qu’on reste.')],
  [/étroite|torse|coude|oblique|penchée/i, 'Une salle tordue et étroite, où l’on progresse en file.'],
  [/haute|dôme|nef|voûte/i, 'La voûte s’élève très haut, hors de portée de toute lueur.'],
  [/sel/i, 'Des cristaux de sel tapissent le sol et crissent sous les pas.'],
  [/soupirs/i, 'Le vent y produit des soupirs inquiétants.'],
  [/aux os\b/i, 'Le sol est jonché d’ossements anciens.', K.notice(13, 'un objet de valeur parmi les os')],
  [/fourchue|carrefour/i, 'Plusieurs galeries convergent ici : un carrefour à surveiller.', K.encounter('Sur 1d20, 16+ : un groupe de passage.')],
  [/gué|sources|puisatier/i, 'Un cours d’eau la traverse ; on passe à gué.'],
  [/draperies/i, 'Des draperies de calcite pendent comme des rideaux pétrifiés.'],
  [/ferreuse|fondeur/i, 'Les parois rouillées trahissent la présence de fer.'],
  [/gours/i, 'Des gours en terrasses retiennent une eau claire.'],
  [/guetteur|veilleurs/i, 'Un ancien poste de guet surplombe la salle.'],
  [/pendus/i, 'De vieilles cordes pendent encore du plafond ; on raconte qu’on y exécutait les traîtres.'],
  [/sonore/i, 'La moindre goutte y résonne comme une cloche.'],
  [/ombres/i, 'Les reliefs projettent des ombres qui semblent bouger.'],
  [/vers/i, 'Des galeries de vers fouisseurs percent les parois.'],
  [/ermite/i, 'Un ermite y a vécu : on trouve ses gravures et sa couche.'],
  [/dalle/i, 'Une immense dalle plate occupe le centre de la salle.'],
];
const SECTOR_Q: [RegExp, string][] = [
  [/orgues/i, 'un secteur de grandes salles à colonnes où le vent chante'], [/labyrinthe|dédale/i, 'un dédale de petites salles et de boyaux où l’on se perd facilement'],
  [/voûtes/i, 'un secteur de salles immenses aux voûtes perdues dans l’ombre'], [/cuves/i, 'des cuvettes successives où l’eau stagne'],
  [/fracture|effondrement/i, 'une région marquée par un grand effondrement, chaos de blocs et de failles'], [/basses salles/i, 'des salles basses, humides et étouffantes'],
  [/gours/i, 'un pays de gours et de bassins en terrasses'], [/draperies/i, 'des salles ornées de draperies de calcite'],
  [/forêt/i, 'une forêt de stalagmites où les pistes se confondent'], [/marches/i, 'une succession de ressauts sombres qui descendent comme des marches'],
  [/boyaux/i, 'un réseau de boyaux étroits au nord'], [/combe froide/i, 'une combe où l’air froid s’accumule'],
  [/mille piliers/i, 'une immense salle soutenue par des centaines de piliers'], [/cendre/i, 'une vallée couverte de cendres anciennes'],
  [/fosses/i, 'deux grandes fosses jumelles et leurs abords'], [/sel/i, 'une étendue blanche de cristaux de sel'],
  [/terrasses/i, 'des terrasses naturelles étagées'], [/pays creux/i, 'une région de cavités creuses et sonores'],
  [/veines rouges/i, 'des parois veinées de minerai rouge'], [/rive morte/i, 'la rive d’un lac sans vie'],
  [/échelles/i, 'des ressauts équipés d’échelles anciennes'], [/seuil/i, 'l’entrée d’un réseau plus profond'],
];

/* ——— API ——— */
const isGeneric = (s?: string) => !s || /démonstration|fictif|fictive|canonique|topographie relevée|décor posé|traitement graphique|fiche encyclopédique|Repère de démonstration|Tracé proposé|à valider|Lieu inscrit sur la carte|Emplacement illustratif|Un repère peut afficher|Observation fine|Point secondaire|Région dangereuse/i.test(s);

/** Description d'un élément de l'Atlas (une description modifiée dans l'Atelier ou un texte canonique l'emportent). */
export function describe(f: AtlasFeature): string {
  if (f.summary && !isGeneric(f.summary)) return f.summary;
  if (HV[f.title]) return HV[f.title];
  if (f.area) {
    if (f.subtitle === 'Secteur') { const q = SECTOR_Q.find(([r]) => r.test(f.title)); return `Grand secteur de la strate : ${q ? q[1] : 'une région de salles et de galeries'}. Les voyageurs s’y repèrent à ses salles principales.`; }
    if (f.title.startsWith('Visage de la déesse')) return f.summary ?? '';
    const q = HALL_Q.find(([r]) => r.test(f.title));
    return q ? q[1] : 'Une salle de la strate, reliée aux autres par des boyaux.';
  }
  if (f.trace) { const e = TRACE_SPECIAL[f.title] ?? TRACE[f.trace]; if (e) return pick(e.d, f.id); }
  const e = L[f.title];
  if (e) return pick(e.d, f.id);
  if (/^(Galerie|Grande galerie|Galerie principale|Galerie du |Galerie profonde|Rue |Allée )/.test(f.title)) return pick(TRACE.galerie.d, f.id);
  if (/Couloir|Boyau/.test(f.title)) return pick(TRACE.boyau.d, f.id);
  return f.summary && !isGeneric(f.summary) ? f.summary : '';
}

/** Conseils au MJ pour un élément. */

/* ——— Conséquences d'échec : chaque test indique ce qui se passe quand il rate ——— */
const FAIL: [RegExp, string][] = [
  [/Perception/, 'ne remarque rien. Si une menace est présente, le groupe est surpris au premier round.'],
  [/Investigation/, 'ne trouve rien. Une nouvelle fouille prend 10 minutes et impose un jet de rencontre aléatoire.'],
  [/Survie/, 'ne trouve rien d’utile ; sur un échec de 5 ou plus, le groupe s’égare (+1d4 heures de trajet) ou consomme une espèce toxique (sauvegarde de Constitution DD 11 ou empoisonné 1 heure).'],
  [/Histoire|Religion|Arcanes|Nature/, 'n’en tire rien ; sur un échec de 5 ou plus, le MJ donne une conclusion erronée et plausible.'],
  [/Perspicacité/, 'croit son interlocuteur sincère, quoi qu’il en soit.'],
  [/Intimidation/, 'l’interlocuteur se braque : il devient hostile ou appelle à l’aide.'],
  [/Tromperie/, 'démasqué : l’interlocuteur se méfie durablement et peut donner l’alerte.'],
  [/Persuasion|Charisme/, 'refus poli. Une nouvelle tentative exige un service rendu ou le double du prix.'],
  [/Discrétion/, 'repéré : les occupants sont alertés et réagissent selon leur nature.'],
  [/outils de voleur|crochet/i, 'échec ; sur un échec de 5 ou plus, l’outil se brise ou le mécanisme se bloque bruyamment.'],
  [/Acrobaties/, 'perd l’équilibre : tombe à terre et subit 1d4 dégâts contondants.'],
  [/Athlétisme/, 'échoue : glisse ou lâche prise. Chute de 1d6 dégâts contondants par tranche de 3 m, ou recule et doit recommencer.'],
  [/Médecine/, 'les soins n’aident pas ; sur un échec de 5 ou plus, le patient perd 1d4 points de vie.'],
  [/Dressage/, 'l’animal s’effraie : il fuit, mord (1d4) ou alerte les alentours.'],
];
/** Complète les jets : un test sans conséquence d'échec en reçoit une, une sauvegarde sans réussite aussi. */
export function withOutcomes(checks: Check[]): Check[] {
  return checks.map((c) => {
    if (c.kind === 'test' && !c.ko) return { ...c, ko: FAIL.find(([r]) => r.test(c.label))?.[1] ?? 'échoue ; une nouvelle tentative coûte 10 minutes et un jet de rencontre aléatoire.' };
    if (c.kind === 'save' && !c.ok) return { ...c, ok: /dégâts/.test(c.ko ?? '') ? 'moitié des dégâts, sans autre effet.' : 'aucun effet.' };
    return c;
  });
}

export function dmFeature(f: AtlasFeature): DmGuide {
  const checks: Check[] = []; const tips: string[] = [];
  if (f.dm?.length) return { checks: withOutcomes(f.dm), tips };
  if (HV_DM[f.title]) checks.push(...HV_DM[f.title]);
  if (f.area) {
    const q = HALL_Q.find(([r]) => r.test(f.title)); if (q?.[2]) checks.push(q[2]);
    checks.push(K.notice(12, 'les issues de la salle et les traces de passage récentes'));
    tips.push('Rencontre aléatoire : 1d20 ≥ 18 par heure passée dans la salle.');
  } else if (f.trace) {
    const e = TRACE_SPECIAL[f.title] ?? TRACE[f.trace]; if (e?.dm) checks.push(...e.dm);
  } else {
    const e = L[f.title]; if (e?.dm) checks.push(...e.dm);
    if (!checks.length) {
      const byCat: Partial<Record<AtlasFeature['category'], Check[]>> = {
        cite: [T('Charisme (Persuasion)', 12, 'obtient informations ou hébergement.')], sanctuaire: [K.religion(12)], institution: [T('Charisme (Persuasion)', 13, 'obtient une audience.')],
        ressource: [T('Charisme (Persuasion)', 12, 'obtient un prix réduit de 10 %.')], garde: [K.stealth(13)], vivant: [K.nature(12)], eau: [K.swim(10)], danger: [S('Dextérité', 12, '2d6 dégâts.')], voie: [K.slippery(10)],
      };
      checks.push(...(byCat[f.category] ?? []));
    }
  }
  return { checks: withOutcomes(checks), tips };
}

/** Description d'un passage entre deux cartes. */
export function describeConnection(c: AtlasConnection): string {
  if (c.note && !isGeneric(c.note)) return c.note;
  const base: Record<string, string> = {
    escalier: 'Un escalier taillé relie les deux niveaux ; ses marches usées racontent des siècles de passage.',
    puits: 'Un puits vertical, où l’on descend à la corde le long d’une paroi humide.',
    ascenseur: 'Un monte-charge actionné par un treuil grinçant ; la plateforme oscille au bout de ses câbles.',
    naturel: 'Un passage naturel irrégulier, fait d’étroitures, de ressauts et de salles basses.',
    tunnel: 'Un conduit creusé de main d’homme, étroit et sombre.',
    galerie: 'Une galerie de raccordement entre les deux espaces.',
  };
  const diff = ['', 'Le passage est aisé.', 'Le passage est éprouvant.', 'Le passage est difficile : il demande du matériel et de l’expérience.', 'Le passage est extrême : peu en reviennent indemnes.'];
  const hz = c.hazards?.length ? ` On y affronte : ${c.hazards.map((h) => h.toLowerCase()).join(', ')}.` : '';
  return `${base[c.kind] ?? 'Un passage relie les deux espaces.'}${c.direction === 'forward' ? ' On ne peut l’emprunter que dans un sens : la remontée est impossible.' : ''} ${diff[c.difficulty ?? 0] ?? ''}${hz}`.trim();
}

/** Conseils au MJ pour un passage, déduits de ses obstacles. */
export function dmConnection(c: AtlasConnection): DmGuide {
  const d = c.difficulty ?? 2, dc = 8 + d * 2;
  const checks: Check[] = []; const seen = new Set<string>();
  const add = (k: string, ch: Check) => { if (!seen.has(k)) { seen.add(k); checks.push(ch); } };
  for (const h of c.hazards ?? []) {
    const s = h.toLowerCase(); const m = s.match(/(\d+)\s*m/); const depth = m ? +m[1] : 6;
    if (/rappel|corde|puits|chute contrôlée/.test(s)) add('climb', K.climb(dc, depth));
    if (/éboulis|pierres roulantes|roche friable|trémie/.test(s)) add('rock', K.rockfall(dc));
    if (/aucune remontée/.test(s)) add('noway', I('Sens unique', 'Remonter exige une corde ancrée et un test de Force (Athlétisme) DD 20.'));
    if (/marches brisées/.test(s)) add('steps', K.slippery(10));
    if (/piégées/.test(s)) add('trap', T('Sagesse (Perception)', 14, 'repère le piège.', 'sauvegarde de Dextérité DD 13 ou 2d10 dégâts perforants.'));
    if (/obscurité|sans lumière/.test(s)) add('dark', K.dark);
    if (/étroiture|chatière|reptation|laminoir/.test(s)) add('squeeze', K.squeeze(dc));
    if (/laminoir|reptation/.test(s)) add('exh', S('Constitution', dc - 1, 'un niveau d’épuisement après la traversée.'));
    if (/échelle/.test(s)) add('ladder', T('Force (Athlétisme)', 8, 'monte à l’échelle.'));
    if (/gard|guetteur|contrôle/.test(s)) add('guard', T('Dextérité (Discrétion) contre Perception passive 14, ou Charisme (Tromperie) DD 14', 14, 'passe inaperçu ou convainc les gardes.', 'alerte : 1d4 + 1 gardes interviennent.'));
    if (/silence/.test(s)) add('silence', K.stealth(13));
    if (/grilles/.test(s)) add('grid', T('Force (Athlétisme) ou outils de voleur', 14, 'force ou crochète la grille.'));
    if (/treuil bruyant/.test(s)) add('winch', I('Bruit', 'Le treuil s’entend dans tout le palier ; les gardes arrivent en 1d4 rounds.'));
    if (/porte à secret|trappe sous/.test(s)) add('secret', K.hidden(15, 'l’accès dérobé'));
    if (/escalade|prises|opposition|désescalade/.test(s)) add('climb2', K.climb(dc + 2, depth));
    if (/poix/.test(s)) add('pitch', I('Prises enduites', 'Désavantage aux tests d’escalade, sauf si on nettoie les prises (10 minutes).'));
    if (/cascade|glissante|ressaut|suintantes/.test(s)) add('slip', K.slippery(dc));
    if (/toboggan|saut/.test(s)) add('slide', S('Dextérité', dc, '2d6 dégâts contondants à l’arrivée.'));
    if (/arrivée dans l’eau|nage|courant|vasque/.test(s)) add('swim', K.swim(dc));
    if (/froide|glacée/.test(s)) add('cold', S('Constitution', 10, 'eau glacée : un niveau d’épuisement si l’on y reste plus de 10 minutes.'));
    if (/eaux usées/.test(s)) add('sewer', S('Constitution', 12, 'fièvre des égouts (maladie).'));
    if (/siphon|apnée/.test(s)) add('siphon', T('Force (Athlétisme)', dc, 'franchit le siphon en apnée.', 'suffocation : 1 niveau d’épuisement et retour au point de départ.'));
    if (/air|vapeurs|gaz/.test(s)) add('gas', K.gas(dc));
    if (/chaleur|faille chaude/.test(s)) add('heat', I('Chaleur extrême', 'Sauvegarde de Constitution DD 5 (+1 par heure), sinon un niveau d’épuisement ; désavantage en armure lourde.'));
    if (/coupant/.test(s)) add('cut', S('Dextérité', 12, '1d4 dégâts tranchants.'));
    if (/boue/.test(s)) add('mud', K.difficult);
    if (/crocs/.test(s)) add('fangs', S('Dextérité', 13, '2d6 dégâts perforants (pièges des crocs).'));
  }
  if (!checks.length && d >= 2) checks.push(T('Force (Athlétisme) ou Dextérité (Acrobaties)', dc, 'franchit le passage.', 'perd 1d4 × 10 minutes et subit 1d6 dégâts contondants.'));
  const tips = [`Durée de traversée : ${['', '10 minutes', '30 minutes', '1 à 2 heures', 'une demi-journée'][d] ?? '30 minutes'}.`];
  if (c.direction === 'forward') tips.push('Impossible de revenir par ici : prévoyez une autre issue.');
  return { checks: withOutcomes(checks), tips };
}
