/**
 * Fouille d'une pièce : son DD selon qui est là et quand, et ce qu'on y trouve (souvent rien qui vaille).
 *
 * Le DD est celui d'une fouille discrète (Intelligence (Investigation), ou Dextérité (Escamotage) pour ne pas être vu) :
 * - difficile le jour dans une pièce pleine de monde, presque impossible sous les yeux d'un garde ;
 * - plus facile la nuit, quand tout le monde dort, ou dans une pièce vide.
 * Une réussite ne garantit pas une trouvaille : la plupart du temps, ce sont des vêtements, un chiffon, des breloques.
 *
 * JavaScript pur, testé par fouille.test.mjs.
 */

/** Prudence de base selon le bâtiment (un château est mieux tenu qu'une maison). */
const BASE = {
  maison: 11, ferme: 10, echoppe: 12, atelier: 12, forge: 12, entrepot: 12, ecurie: 10, taverne: 12, auberge: 12,
  guilde: 14, temple: 14, manoir: 15, caserne: 16, chateau: 18,
};
const GUARD = /\b(garde|gardes|soldat|soldate|sergent|sergente|geolier|geoliere|sentinelle|chambellan|capitaine)\b/;
const STAFF = /(tavern|auberg|forgeron|marchand|boutiqu|commis|pretre|pretresse|scribe|intendant|cuisini|serveu|servante|domestique|maitre|maitresse|artisan|apprenti|fermier|fermiere|palefrenier)/;
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Libellé de difficulté d'un DD. */
export function dcLabel(dc) {
  return dc <= 10 ? 'Facile' : dc <= 15 ? 'Moyenne' : dc <= 20 ? 'Difficile' : dc <= 25 ? 'Très difficile' : 'Presque impossible';
}

/**
 * DD de fouille d'une pièce. `type` : type du bâtiment ; `period` : 'matin' | 'jour' | 'soir' | 'nuit' ;
 * `occupants` : [{ role, asleep }] présents dans la pièce. Renvoie { dc, label, why: string[] }.
 */
export function searchDC({ type = 'maison', period = 'jour', occupants = [] } = {}) {
  let dc = BASE[type] ?? 12;
  const why = [];
  const awake = occupants.filter((o) => !o.asleep);
  const guards = awake.filter((o) => GUARD.test(norm(o.role)));
  const staff = awake.filter((o) => !GUARD.test(norm(o.role)) && STAFF.test(norm(o.role)));
  if (guards.length) { dc += 10; why.push(guards.length > 1 ? `${guards.length} gardes surveillent la pièce` : 'un garde surveille la pièce'); }
  if (staff.length) { dc += 3; why.push('le personnel garde un œil sur les lieux'); }
  if (awake.length) {
    const crowd = Math.min(8, 2 * awake.length);
    dc += crowd;
    why.push(awake.length === 1 ? 'une personne éveillée' : `${awake.length} personnes éveillées`);
  } else if (occupants.length) {
    dc -= 2; why.push('tout le monde dort');
  } else {
    dc -= 3; why.push('personne dans la pièce');
  }
  if (period === 'nuit') { dc -= 2; why.push('il fait nuit'); } else if (period === 'jour' && awake.length) why.push('en plein jour');
  dc = Math.max(8, Math.min(30, dc));
  return { dc, label: dcLabel(dc), why };
}

/* ——— Trouvailles ——— */

const JUNK = [
  'un chiffon sale', 'une chaussette trouée', 'un bouton de corne', 'un bout de ficelle', 'des miettes et un trognon de pomme',
  'une chemise reprisée', 'un clou tordu', 'un peigne en os édenté', 'une breloque de cuivre sans valeur', 'un mouchoir brodé d’initiales inconnues',
  'un bout de chandelle', 'une cuillère en bois fendue', 'une pierre polie, sans valeur', 'un dé à coudre cabossé', 'des cheveux dans un ruban',
];
const ROOMS = [
  [/cuisine|four|fournil/, {
    junk: ['un torchon taché de graisse', 'une croûte de pain rassis', 'des épluchures', 'un pot de saindoux à moitié vide', 'un sachet de sel humide'],
    minor: ['un couteau de cuisine bien aiguisé', 'une gourde de vin aigre', 'des rations pour deux jours', 'un pot d’épices rares (5 pa)'],
    notable: ['une bourse cachée au fond d’une jarre (2d6 pa)', 'une fiole d’un liquide amer, cachée derrière les épices (poison léger ?)'],
  }],
  [/chambre|dortoir|logis|appartement/, {
    junk: ['des vêtements de rechange usés', 'une couverture mitée', 'un pot de chambre', 'une lettre d’amour sans signature', 'un bonnet de nuit'],
    minor: ['quelques pièces sous le matelas (1d6 pa)', 'une bague en étain', 'une paire de bottes en bon état', 'un savon parfumé'],
    notable: ['une dague cachée dans la paillasse', 'un carnet de comptes chiffré', 'une clé glissée dans un ourlet'],
  }],
  [/salle|comptoir|commune|refectoire/, {
    junk: ['une chope vide', 'une carte à jouer cornée', 'une pipe éteinte', 'des noyaux de prune', 'un tabouret bancal'],
    minor: ['1d4 pc tombées sous un banc', 'des dés (pipés ?)', 'une note griffonnée : une rumeur du quartier', 'une bouteille d’eau-de-vie entamée'],
    notable: ['une bourse oubliée (1d10 pa)', 'un message plié, glissé sous une table, destiné à quelqu’un d’autre'],
  }],
  [/cellier|cave|reserve|entrepot|grange/, {
    junk: ['des toiles d’araignée', 'un sac de navets ramollis', 'un bouchon de liège', 'un rat crevé', 'un tonnelet de vin tourné'],
    minor: ['une clé rouillée', 'une corde de 15 m', 'un tonnelet de bonne bière', 'une lanterne sans huile'],
    notable: ['un coffret dissimulé derrière les tonneaux (verrouillé)', 'une trappe mal refermée dans le sol'],
  }],
  [/atelier|forge|echoppe|boutique|etal/, {
    junk: ['des chutes de cuir', 'une lime usée', 'des copeaux', 'un anneau de fer', 'une aiguille cassée'],
    minor: ['un jeu d’outils incomplet', 'une boucle de ceinture ouvragée (2 pa)', 'des clous neufs', 'une pierre à aiguiser'],
    notable: ['une commande spéciale non réclamée (lame ou bijou)', 'le carnet de commandes : des noms intéressants'],
  }],
  [/chapelle|nef|autel|sanctuaire|crypte/, {
    junk: ['un bout de cierge', 'un chapelet cassé', 'une fleur séchée', 'un missel détrempé'],
    minor: ['les offrandes du jour (1d6 pc)', 'un flacon d’eau bénite', 'un parchemin de prière'],
    notable: ['une relique dans un reliquaire caché', 'une lettre de confession oubliée'],
  }],
  [/bureau|archives|cabinet|etude|tresor/, {
    junk: ['une plume usée', 'un encrier sec', 'des brouillons raturés', 'un registre sans intérêt'],
    minor: ['de la cire à cacheter', 'un plan sommaire du bâtiment', 'quelques feuillets de parchemin vierge'],
    notable: ['un sceau officiel', 'une reconnaissance de dette signée', 'une lettre compromettante'],
  }],
  [/garde|cellule|cachot|armurerie|caserne/, {
    junk: ['une gamelle ébréchée', 'une couverture rêche', 'un dé en os', 'une botte trouée'],
    minor: ['un trousseau incomplet (une clé)', 'une ration de soldat', 'une arbalète de poing sans carreaux'],
    notable: ['le tableau des tours de garde', 'une lime cachée dans une miche de pain'],
  }],
];

/** Table de trouvailles d'une pièce (selon son nom). */
export function searchTable(roomName = '') {
  const n = norm(roomName);
  const hit = ROOMS.find(([re]) => re.test(n))?.[1] ?? { junk: [], minor: ['1d4 pc dans un recoin', 'un petit couteau', 'une bougie neuve'], notable: ['une cachette sous une latte : 2d6 pa'] };
  return { junk: [...hit.junk, ...JUNK], minor: hit.minor, notable: hit.notable };
}

/**
 * Résultat d'une fouille. `margin` : jet − DD (négatif : échec). `rnd` : générateur 0–1.
 * Échec : rien, ou on se fait remarquer de peu. Réussite : souvent rien qui vaille (vêtements, chiffons, breloques),
 * parfois quelque chose d'utile, rarement une vraie trouvaille (plus souvent si le jet dépasse largement le DD).
 */
export function rollFind(roomName, margin, rnd = Math.random) {
  const t = searchTable(roomName);
  const pick = (l) => l[Math.floor(rnd() * l.length)];
  if (margin < 0) {
    return margin <= -5
      ? { kind: 'repere', text: 'Rien trouvé, et quelqu’un a remarqué le manège.' }
      : { kind: 'rien', text: 'Rien d’intéressant.' };
  }
  const r = rnd() - Math.min(0.2, margin * 0.02);
  if (r < 0.06) return { kind: 'notable', text: pick(t.notable) };
  if (r < 0.26) return { kind: 'utile', text: pick(t.minor) };
  if (r < 0.8) return { kind: 'sans-valeur', text: pick(t.junk) };
  return { kind: 'rien', text: 'Rien, à part de la poussière.' };
}
