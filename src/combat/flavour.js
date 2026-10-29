/**
 * Phrases de récit des attaques, montrées aux joueurs avec le verdict du jet pour toucher.
 * Rangées par famille d'arme (lame, masse, pointe, tir, crocs, magie) et par issue (touché, critique, raté, échec
 * critique). {A} : l'attaquant, {T} : la cible, {W} : l'arme ou l'attaque. Les dernières phrases tirées ne reviennent
 * pas tout de suite, pour éviter la répétition.
 */

const LINES = {
  lame: {
    hit: [
      '{W} de {A} trace une ligne rouge sur {T}.',
      '{A} feinte à gauche, frappe à droite : la lame mord {T}.',
      'Un éclair d’acier, et {T} recule en serrant sa blessure.',
      '{A} entaille {T} d’un revers sec, sans un mot.',
      'La lame de {A} trouve le défaut de la garde de {T}.',
      '{W} siffle et s’abat : {T} n’a pas pu l’éviter.',
      '{A} pivote, et {W} ouvre une plaie sur le flanc de {T}.',
      'Le fil de {W} accroche {T} au passage, le sang perle.',
      '{A} coupe court à la parade de {T} et la lame passe.',
      'Une estafilade nette : {T} apprend à respecter {A}.',
      '{A} frappe en diagonale, et {T} titube sous le coup.',
      'La lame de {A} chante une seule note, et {T} la sent passer.',
    ],
    crit: [
      '{A} danse entre deux battements de cœur : {W} s’enfonce jusqu’à la garde dans {T}.',
      'Un coup digne des ballades : {W} déchire {T} de part en part.',
      'Le temps ralentit, l’acier brille… et {T} encaisse le coup du siècle.',
      '{A} lit l’ouverture avant même qu’elle existe : frappe parfaite sur {T}.',
      '{W} décrit un arc parfait. {T} n’oubliera jamais cet instant.',
      'Un cri, un éclat, une gerbe écarlate : {A} vient de signer son chef-d’œuvre.',
      'Même les dieux de la guerre applaudissent : {A} taille {T} en pleine garde.',
    ],
    miss: [
      '{W} fend l’air à un doigt du nez de {T}.',
      '{T} esquive d’un pas chassé, la lame de {A} ne coupe que le vide.',
      'Clang ! {T} bloque {W} au dernier moment.',
      '{A} frappe trop tôt : {T} se dérobe sans effort.',
      'La lame de {A} glisse sur l’armure de {T} dans une pluie d’étincelles.',
      '{T} recule juste assez : {W} ne tranche qu’un pan de cape.',
      '{A} force le passage, mais {T} tient sa garde.',
      'Le coup de {A} est franc… et parfaitement paré.',
      '{T} se baisse : {W} siffle au-dessus de sa tête.',
      'Un choc sourd : {W} se plante dans le bouclier de {T}.',
    ],
    fumble: [
      '{A} glisse sur une flaque douteuse et frappe le sol avec panache.',
      '{W} échappe à {A}, rebondit deux fois et revient à ses pieds, penaud.',
      '{A} fait un moulinet spectaculaire… qui ne vise strictement rien.',
      'La lame de {A} se coince dans une poutre. Silence gêné.',
      '{A} trébuche sur sa propre cape au moment décisif.',
      '{A} tranche avec conviction une toile d’araignée. {T} hausse un sourcil.',
      'Un élan magnifique, une exécution désastreuse : {A} frappe l’ombre de {T}.',
    ],
  },
  masse: {
    hit: [
      '{W} s’écrase sur {T} avec un bruit mat.',
      '{A} cogne, et {T} sent ses os protester.',
      'Un coup lourd de {A} fait plier les genoux de {T}.',
      '{W} enfonce l’épaule de {T} d’un choc sourd.',
      '{A} frappe comme on enfonce un pieu : {T} vacille.',
      'Le métal de {T} se cabosse sous le coup de {A}.',
      '{A} balaie large et {W} percute {T} en plein torse.',
      'Un coup de {A}, un craquement, un grognement de {T}.',
      '{W} rebondit sur le casque de {T}, qui voit des étoiles.',
      '{A} écrase la garde de {T} et passe à travers.',
      '{T} encaisse le coup de {A} et en perd son souffle.',
    ],
    crit: [
      '{A} lève {W} bien haut… et l’abat comme le jugement des anciens : {T} est sonné net.',
      'Le sol tremble. {T} aussi. {A} vient de frapper pour de bon.',
      'Un craquement qui résonne jusqu’au fond de la salle : {A} n’a rien retenu.',
      '{W} s’abat avec la force d’un éboulement sur {T}.',
      '{A} cogne si fort que l’écho met trois secondes à s’éteindre.',
      'On racontera ce coup dans les tavernes : {T} décolle presque du sol.',
    ],
    miss: [
      '{W} fracasse les pavés à côté de {T}.',
      '{T} s’écarte, et le coup de {A} ne frappe que le vent.',
      '{A} cogne… le bouclier de {T}, qui ne bronche pas.',
      'Trop lent : {T} voit venir {W} et l’évite.',
      'Le coup de {A} passe en grondant au-dessus de {T}.',
      '{T} détourne {W} d’un geste sûr.',
      '{A} met tout son poids dans le coup, mais {T} n’est plus là.',
      '{W} heurte un pilier, faisant pleuvoir de la poussière.',
      '{T} roule sous le coup de {A} et se relève aussitôt.',
    ],
    fumble: [
      '{A} prend tant d’élan que {W} l’entraîne dans un tour complet sur soi-même.',
      '{W} se plante dans le sol et refuse obstinément d’en sortir.',
      '{A} frappe si fort à côté qu’il faut un instant pour retrouver l’équilibre.',
      'Un grand moulinet, un petit cri : {A} vient de se cogner les doigts.',
      '{W} rebondit sur un rocher et revient frôler le nez de {A}.',
      '{A} écrase avec ferveur un champignon parfaitement innocent.',
    ],
  },
  pointe: {
    hit: [
      'La pointe de {W} perce la défense de {T}.',
      '{A} se fend et pique {T} au défaut de l’armure.',
      '{W} plonge dans le flanc de {T}, puis ressort, rougie.',
      '{A} frappe d’estoc : {T} grimace sous la piqûre.',
      'Rapide comme une vipère, {W} atteint {T}.',
      '{A} trouve une ouverture minuscule et y glisse {W}.',
      '{T} sent le froid de la pointe de {A} lui mordre la chair.',
      'D’un coup précis, {A} transperce la garde de {T}.',
      '{W} atteint {T} sous l’épaule, là où ça fait mal.',
      '{A} pique, recule, pique encore : la seconde fois est la bonne.',
    ],
    crit: [
      '{A} vise un point exact, et {W} s’y loge parfaitement : {T} hurle.',
      'Un estoc chirurgical : {W} traverse {T} de part en part.',
      'Le monde se réduit à une pointe et une cible. {A} ne rate pas l’instant.',
      '{W} trouve le chemin du cœur de la défense de {T}, sans détour.',
      'Une botte secrète, un éclair, et {T} comprend trop tard.',
    ],
    miss: [
      'La pointe de {W} glisse sur l’armure de {T}.',
      '{T} écarte {W} du plat de la main, d’un geste agacé.',
      '{A} se fend… dans le vide : {T} a pivoté.',
      '{W} accroche le bord du bouclier de {T} et dévie.',
      '{T} bondit en arrière, hors de portée de {A}.',
      'Trop courte d’un pouce : la pointe de {A} n’atteint pas {T}.',
      '{A} pique, {T} pare, et le duel continue.',
      'La pointe de {W} se perd dans les plis de la cape de {T}.',
      '{T} lit la feinte de {A} et ne se laisse pas prendre.',
    ],
    fumble: [
      '{A} se fend si loin qu’un genou touche le sol. Élégant, mais inutile.',
      '{W} se fiche dans une fissure du mur, bien loin de {T}.',
      '{A} pique avec détermination… un tonneau vide.',
      '{A} perd l’équilibre au milieu de la fente et manque de s’embrocher soi-même.',
      'La pointe de {W} file entre les jambes de {T}, qui n’en revient pas.',
      '{A} vise l’œil, touche le ciel. Littéralement.',
    ],
  },
  tir: {
    hit: [
      'Le trait de {A} file droit et se plante dans {T}.',
      '{A} relâche la corde : {T} encaisse le projectile en plein vol.',
      'Un sifflement, un impact : {W} trouve sa cible.',
      '{A} vise, souffle, tire : {T} titube.',
      'Le projectile de {A} traverse la pénombre et frappe {T}.',
      '{T} tente de se couvrir, trop tard : {W} l’atteint.',
      '{A} ajuste le tir d’un rien, et ça suffit.',
      'Un tir tendu de {A} épingle {T} à l’épaule.',
      'Le trait de {A} trouve un interstice dans la défense de {T}.',
      '{W} claque, et {T} porte désormais une plume de plus.',
      '{A} tire entre deux ombres et touche {T} sans hésiter.',
    ],
    crit: [
      '{A} tire au moment exact où {T} se découvre : en plein dans le mille.',
      'Le trait de {A} traverse la salle comme une prière exaucée.',
      'Un tir impossible, que {A} fait paraître facile : {T} s’effondre presque.',
      '{A} retient son souffle, et le projectile part comme guidé par la chance elle-même.',
      'Les bardes devront mesurer ce tir : {T} ne l’a jamais vu venir.',
      '{W} fend l’air en chantant et frappe {T} là où ça compte.',
    ],
    miss: [
      'Le projectile de {A} se plante dans le mur, à un souffle de {T}.',
      '{T} plonge à couvert : le tir de {A} passe au-dessus.',
      'Le trait de {A} frôle l’oreille de {T}, qui en garde le sifflement.',
      '{A} tire un poil trop tôt : {T} s’est déjà déplacé.',
      'Le projectile de {A} ricoche sur une pierre et disparaît dans le noir.',
      '{T} lève son bouclier juste à temps : toc !',
      'Un tir honnête, mais {T} n’est plus vraiment là.',
      'Le trait de {A} se perd dans l’obscurité au-delà de {T}.',
      'La poussière brouille la visée de {A} : tir à côté.',
    ],
    fumble: [
      'La corde claque sur les doigts de {A}, et le projectile tombe à ses pieds.',
      '{A} tire avec assurance… sur une chauve-souris qui passait par là.',
      'Le projectile part de travers et se fiche dans le plafond. Bravo.',
      '{A} encoche à l’envers. Personne n’a rien vu. Presque personne.',
      'Le tir de {A} rebondit sur trois murs avant de s’arrêter, épuisé.',
      '{W} s’emmêle et part en tournoyant vers un horizon inconnu.',
      '{A} vise si longtemps que la cible a le temps de bâiller.',
    ],
  },
  crocs: {
    hit: [
      '{A} plante ses crocs dans {T} et secoue la tête.',
      'Les griffes de {A} lacèrent {T} en trois sillons rouges.',
      '{A} bondit et mord {T} au bras.',
      'Une gueule s’ouvre, se referme : {T} hurle.',
      '{A} lacère {T} d’un coup de patte rapide.',
      '{T} sent le souffle chaud de {A} juste avant la morsure.',
      '{A} se jette sur {T} toutes griffes dehors.',
      'Les mâchoires de {A} claquent et trouvent de la chair.',
      '{A} griffe, déchire, et recule en grondant.',
      '{T} repousse {A}, mais pas avant d’avoir été mordu.',
    ],
    crit: [
      '{A} referme ses mâchoires comme un piège d’acier sur {T}.',
      'Un rugissement, un bond, une morsure sauvage : {T} est saisi d’effroi.',
      '{A} déchire {T} avec la fureur de la faim la plus ancienne.',
      'Les griffes de {A} trouvent la gorge de {T}. Instinct pur.',
      '{A} frappe comme la nature elle-même : sans pitié et sans erreur.',
    ],
    miss: [
      'Les crocs de {A} claquent dans le vide, tout près de {T}.',
      '{T} esquive le bond de {A}, qui atterrit en dérapant.',
      'Les griffes de {A} raclent l’armure de {T} sans l’entamer.',
      '{T} repousse la gueule de {A} d’un coup de coude.',
      '{A} mord… la cape de {T}, qui s’en dégage.',
      'Le bond de {A} est trop long : {T} n’est plus là.',
      '{A} griffe l’air en grognant de frustration.',
      '{T} fait un pas de côté, et {A} passe en trombe.',
    ],
    fumble: [
      '{A} bondit avec fougue et s’étale de tout son long.',
      '{A} mord son propre élan et se retrouve à grogner contre le sol.',
      '{A} se prend les griffes dans un débris et fait une drôle de pirouette.',
      'La morsure de {A} se referme sur un caillou. Craquement inquiétant… pour ses dents.',
      '{A} se jette sur l’ombre de {T}, très convaincu, très seul.',
    ],
  },
  magie: {
    hit: [
      'L’énergie de {W} jaillit des mains de {A} et frappe {T} de plein fouet.',
      'Un éclat de pouvoir brut traverse la salle et percute {T}.',
      '{A} murmure les mots anciens : {T} se tord sous l’effet de {W}.',
      '{W} enveloppe {T} d’une lueur douloureuse.',
      'Les runes s’allument, et {T} encaisse la magie de {A}.',
      '{A} tend la main : {W} s’abat sur {T} dans un grondement.',
      'Une onde arcanique fait vibrer l’air et heurte {T}.',
      '{T} tente de résister, mais la volonté de {A} est la plus forte.',
      'Les ombres se tordent autour de {T} : {W} a porté.',
      '{A} trace un signe dans l’air et {T} en subit les conséquences.',
    ],
    crit: [
      'La magie de {A} rugit comme un orage enfermé trop longtemps : {T} est balayé.',
      '{W} s’embrase d’une puissance que même {A} ne soupçonnait pas.',
      'Les étoiles semblent s’aligner : le sort de {A} frappe {T} au cœur.',
      'Un éclair aveuglant, puis le silence : {T} vient de comprendre ce qu’est la vraie magie.',
      '{A} parle, et la réalité obéit avec un enthousiasme effrayant.',
    ],
    miss: [
      'Le sort de {A} s’écrase sur le mur derrière {T}.',
      '{T} se jette de côté : {W} ne roussit qu’un peu de poussière.',
      'L’énergie de {A} se disperse en étincelles avant d’atteindre {T}.',
      '{T} serre les dents et résiste à la magie de {A}.',
      '{W} file à côté de {T} et illumine brièvement la pièce.',
      'Les mots de {A} butent sur une syllabe : le sort part de travers.',
      'La magie de {A} effleure {T} sans trouver de prise.',
      '{T} lève une main, et le sort de {A} glisse sur sa volonté.',
    ],
    fumble: [
      'Le sort de {A} pétille, crachote… et produit un joli petit nuage violet.',
      '{A} se trompe de geste : une gerbe de confettis arcaniques retombe doucement.',
      'Le sort de {A} part dans la mauvaise direction et allume une torche éteinte. Utile, au moins.',
      '{A} incante avec ferveur, et ses sourcils fument légèrement.',
      'La magie de {A} hoquette, puis s’excuse presque d’exister.',
      '{W} se retourne contre son lanceur dans un pschitt ridicule : {A} sent le roussi.',
    ],
  },
};

/** Famille d'une attaque, d'après son nom, son type de dégâts et sa portée. */
export function attackFamily(attack, damageType = '', ranged = false) {
  const text = `${attack?.name || ''} ${attack?.type || ''} ${damageType}`.toLowerCase();
  if (/sort|cantrip|trait mystique|rayon|souffle|flamme|feu|froid|foudre|tonnerre|radiant|nécro|necro|psych|force|acide|onde|éclair|eclair|magi/.test(text)) return 'magie';
  if (/morsure|griffe|crocs|serre|dard|queue|corne|tentacule|bite|claw/.test(text)) return 'crocs';
  if (ranged || /arc|arbal|fronde|javelot|dague lancée|fléchette|flechette|sarbacane|tir/.test(text)) return 'tir';
  if (/contondant|bludgeon|masse|marteau|gourdin|massue|bâton|baton|fléau|fleau|poing|morgenstern|maillet/.test(text)) return 'masse';
  if (/perforant|pierc|lance|rapière|rapiere|pique|trident|dague|fourche|stylet/.test(text)) return 'pointe';
  return 'lame';
}

const recent = [];

/** Phrase de récit au hasard pour une attaque, jamais une des dernières tirées. */
export function attackLine(family, outcome, { A = '', T = '', W = '' } = {}) {
  const pool = LINES[family]?.[outcome] || LINES.lame[outcome] || [];
  if (!pool.length) return '';
  const fresh = pool.filter((l) => !recent.includes(l));
  const line = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))];
  recent.push(line);
  if (recent.length > 40) recent.shift();
  const weapon = W ? W.charAt(0).toLowerCase() + W.slice(1) : 'l’attaque';
  return line
    .replaceAll('{A}', A)
    .replaceAll('{T}', T)
    .replace(/^\{W\}/, weapon.charAt(0).toUpperCase() + weapon.slice(1))
    .replaceAll('{W}', weapon);
}
