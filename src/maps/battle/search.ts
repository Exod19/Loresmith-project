/**
 * Fouille : les éléments de terrain qui méritent un jet, et ce que le MJ doit savoir de chacun.
 * Seuls les éléments jouables sont retenus. L'eau, les impasses, les pièges et les portes relèvent du terrain.
 * Les textes sont des suggestions : le MJ peut les réécrire (ou les faire réécrire par l'IA) depuis la fiche.
 */
import type { SearchNote } from '../mapStore';

export type SearchEntry = SearchNote & {
  /** Passage que la fouille peut ouvrir : comment le franchir. */
  passage?: { skill?: string; dc?: number; text: string };
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ');

const E = (re: RegExp, e: SearchEntry): [RegExp, SearchEntry] => [re, e];

const CATALOGUE: [RegExp, SearchEntry][] = [
  E(/inscription gravee/, { skill: 'Investigation', dc: 12, find: 'Des runes à demi effacées, en commun des profondeurs : un nom de clan et une flèche gravée vers une galerie.', effect: 'Histoire DC 13 : le clan qui l’a laissée (duergar, svirfneblin…), et ce qu’il gardait ici.' }),
  E(/coquilles fossiles/, { skill: 'Nature', dc: 11, find: 'Des coquillages pétrifiés dans la roche : cette galerie était autrefois sous l’eau.', loot: 'Un beau fossile (5 po pour un collectionneur).', effect: 'Indice : la galerie descend vers une ancienne mer souterraine.' }),
  E(/crane de rothe/, { skill: 'Survie', dc: 10, find: 'Un crâne de rothé aux cornes intactes, rongé récemment.', loot: 'Une paire de cornes de rothé (2 po).', effect: 'Indice : un prédateur chasse dans le secteur (grick, araignée géante).' }),
  E(/cristal isole|veine de cristal/, { skill: 'Perception', dc: 12, find: 'Un cristal laiteux qui capte la lumière des torches.', loot: 'Un cristal (10 po), ou une composante pour un sort de lumière.', effect: 'Taillé, il luit faiblement pendant 1 heure.' }),
  E(/cristal-lueur brise|cristal lueur brise/, { skill: 'Arcanes', dc: 12, find: 'Les éclats d’un cristal-lueur, la lampe des gnomes des profondeurs.', loot: 'Des éclats (1 po) ; recollés, une lumière faible pendant 1 heure.', effect: 'Indice : des svirfneblins sont passés par ici, il y a peu.' }),
  E(/guano|colonie de chiropteres/, { skill: 'Survie', dc: 10, find: 'Une épaisse couche de guano : une colonie de chauves-souris vit au-dessus.', loot: 'Du guano, riche en salpêtre (poudre, engrais).', effect: 'Un bruit fort ici fait s’envoler un essaim de chauves-souris.' }),
  E(/piton plante/, { skill: 'Perception', dc: 10, find: 'Un piton d’escalade enfoncé dans la roche, encore solide : quelqu’un est descendu ici.', loot: 'Le piton, récupérable.', effect: 'Avantage aux tests d’Athlétisme pour grimper ou descendre à cet endroit.', passage: { skill: 'Athlétisme', dc: 10, text: 'Une descente le long de la paroi.' } }),
  E(/empreintes/, { skill: 'Survie', dc: 12, find: 'Des traces récentes dans la poussière : bottes ferrées, ou pieds griffus.', effect: 'Réussite de 5 ou plus : le nombre de créatures, leur direction, et moins d’une heure d’avance.' }),
  E(/racine pendante/, { skill: 'Perception', dc: 10, find: 'Une racine épaisse traverse le plafond : la surface n’est peut-être pas si loin.', effect: 'On peut grimper le long de la racine jusqu’à une fissure du plafond.', passage: { skill: 'Athlétisme', dc: 12, text: 'Grimper le long de la racine jusqu’à une fissure étroite.' } }),
  E(/foyer eteint/, { skill: 'Investigation', dc: 11, find: 'Les cendres d’un feu de camp.', loot: 'Des restes de ration, un silex.', effect: 'Survie DC 13 : éteint depuis moins de six heures, un groupe campe non loin.' }),
  E(/geode ouverte/, { skill: 'Perception', dc: 12, find: 'Une géode brisée, tapissée de cristaux violets.', loot: 'Des améthystes (2d6 × 5 po).' }),
  E(/corde pourrie/, { skill: 'Perception', dc: 10, find: 'Une vieille corde fixée à un anneau de fer, effilochée.', effect: 'S’y fier : 50 % de chances qu’elle rompe (chute de 3 m, 1d6 contondants).', passage: { skill: 'Athlétisme', dc: 12, text: 'Elle descend dans un puits : Athlétisme DC 12 pour descendre sans elle.' } }),
  E(/ossements/, { skill: 'Médecine', dc: 12, find: 'Des ossements humanoïdes : un voyageur mort il y a des années.', loot: '1d10 pa, une dague rouillée, parfois une lettre.', effect: 'Médecine DC 12 : mort d’une morsure, d’une chute ou de faim.' }),
  E(/mue de reptile/, { skill: 'Nature', dc: 12, find: 'Une mue énorme : un lézard géant vit dans le secteur.', loot: 'Une peau souple (3 po).', effect: 'Indice de rencontre : lézard géant.' }),
  E(/pepite/, { skill: 'Perception', dc: 13, find: 'Une pépite brillante, coincée dans une fissure.', loot: 'Une pépite d’or (1d4 × 10 po).', effect: 'L’extraire prend 10 minutes et fait du bruit.' }),
  E(/marque de passage/, { skill: 'Survie', dc: 12, find: 'Un symbole tracé à la craie : une marque de guide des profondeurs.', effect: 'Elle indique la galerie la plus sûre.', passage: { text: 'Suivre les marques : pas de test, la galerie est balisée.' } }),
  E(/tas de scories/, { skill: 'Investigation', dc: 12, find: 'Des scories de forge : une mine ou une forge duergar n’est pas loin.', loot: 'Du fer récupérable.' }),
  E(/cairn/, { skill: 'Investigation', dc: 12, find: 'Des pierres empilées par une main humanoïde.', loot: 'Dessous : une cache (1d6 rations, une fiole d’huile), ou une tombe.', effect: 'Défaire un cairn funéraire peut réveiller un esprit.' }),
  E(/outil rouille/, { skill: 'Perception', dc: 10, find: 'Un pic de mineur rouillé, abandonné.', loot: 'Un pic de mineur (2 po).' }),
  E(/galets polis/, { skill: 'Nature', dc: 11, find: 'Des galets polis par l’eau, loin de toute rivière.', effect: 'Indice : une crue traverse parfois cette galerie.' }),
  E(/escalier taille/, { skill: 'Perception', dc: 10, find: 'Des marches taillées dans la roche, usées par les pas.', passage: { text: 'Mène à un autre niveau, sans test.' } }),
  E(/ancien poste|poste de guet|poste d observation|repaire de guet/, { skill: 'Investigation', dc: 12, find: 'Un poste de guet abandonné, avec une vue dégagée sur la salle.', loot: 'Une arbalète légère, 1d10 carreaux, un cor d’alarme.', effect: 'D’ici, avantage aux tests de Perception sur toute la salle.' }),
  E(/nid de rothes|enclos a rothes/, { skill: 'Dressage', dc: 13, find: 'Un nid de rothés, des bêtes de somme sauvages.', effect: 'Dressage DC 13 : un rothé apprivoisé porte 100 kg.' }),
  E(/salpetre/, { skill: 'Nature', dc: 12, find: 'Un affleurement de salpêtre blanchâtre.', loot: 'Un sac de salpêtre (5 po).' }),
  E(/terrier de vers/, { skill: 'Survie', dc: 12, find: 'L’entrée d’un terrier de ver géant.', effect: 'Le sol est fragile autour : un ver peut surgir si l’on s’attarde.' }),
  E(/soufre/, { skill: 'Nature', dc: 11, find: 'Un dépôt de soufre jaune à l’odeur forte.', loot: 'Du soufre (composante alchimique, 2 po).', effect: 'Désavantage aux tests de Perception basés sur l’odorat ici.' }),
  E(/champignonniere|champignons geants|jardin de champignons/, { skill: 'Nature', dc: 12, find: 'Des champignons cultivés, en rangs serrés.', loot: '1d4 rations de champignons (Nature DC 13 pour écarter les vénéneux).', effect: 'Un champignon violet ou un hurleur peut s’y cacher.' }),
  E(/toiles anciennes/, { skill: 'Perception', dc: 12, find: 'Des toiles d’araignée géante, vieilles et poussiéreuses.', loot: 'Une victime emmaillotée : 2d10 pa et un objet.', effect: 'Toucher les fils alerte l’araignée si elle est encore là.' }),
  E(/cache de vivres/, { skill: 'Investigation', dc: 13, find: 'Une cache de vivres, sous des pierres plates.', loot: '1d6 rations, une outre, une torche.', effect: 'Son propriétaire reviendra.' }),
  E(/muret ecroule|barricade/, { skill: 'Investigation', dc: 11, find: 'Un muret effondré, à hauteur de taille.', effect: 'Couvert à moitié (+2 CA) derrière ; le franchir est un terrain difficile.' }),
  E(/abri sous roche/, { skill: 'Perception', dc: 11, find: 'Un abri sec, à l’écart de la galerie.', effect: 'Repos court en sécurité ; couvert aux trois quarts.' }),
  E(/campement abandonne/, { skill: 'Investigation', dc: 12, find: 'Un campement abandonné à la hâte.', loot: 'Une couverture, une marmite, 2d6 pc, un journal de voyage.', effect: 'Le journal contient une carte grossière des galeries voisines.' }),
  E(/arche brisee|statue usee|bas-relief efface|bas relief efface/, { skill: 'Histoire', dc: 13, find: 'Les restes sculptés d’une cité oubliée.', effect: 'Histoire DC 15 : la scène désigne une salle cachée derrière la paroi.' }),
  E(/pierre levee|cercle de pierres levees/, { skill: 'Religion', dc: 13, find: 'Une pierre dressée, gravée de symboles anciens.', effect: 'La toucher : un murmure (Sagesse DC 12 ou effrayé 1 minute). Les sorts de divination y ont l’avantage.' }),
  E(/filon d argent pale/, { skill: 'Perception', dc: 13, find: 'Un filon d’argent pâle dans la paroi.', loot: '2d6 × 5 po d’argent, en une heure d’extraction.' }),
  E(/filon de fer|gisement de fer|carriere ancienne/, { skill: 'Nature', dc: 10, find: 'Du minerai de fer affleurant.', loot: 'Du minerai, et parfois des outils de carrier oubliés.' }),
  E(/lichen luisant|mousse phosphorescente/, { skill: 'Nature', dc: 10, find: 'Une végétation qui émet une faible lueur.', loot: 'Récoltée : une lumière faible pendant 1 heure.' }),
  E(/niche votive/, { skill: 'Religion', dc: 12, find: 'Une niche votive et ses offrandes.', loot: '1d6 pa, une figurine sculptée.', effect: 'Voler les offrandes : désavantage au prochain jet de sauvegarde.' }),
  E(/autel oublie/, { skill: 'Religion', dc: 14, find: 'Un autel oublié, couvert de poussière.', loot: 'Un calice d’argent (25 po).', effect: 'Y prier : 1d4 PV temporaires, ou une vision du passé du lieu.' }),
  E(/alcove secrete|niche derobee/, { skill: 'Investigation', dc: 15, find: 'Une petite alcôve dissimulée derrière une pierre mobile.', loot: 'Une potion de soins et 2d10 po.' }),
  E(/faux mur/, { skill: 'Investigation', dc: 15, find: 'Un pan de mur qui sonne creux.', effect: 'Derrière : un passage étroit.', passage: { skill: 'Athlétisme', dc: 12, text: 'Pousser le pan de mur pour l’ouvrir.' } }),
  E(/cache d armes/, { skill: 'Investigation', dc: 14, find: 'Une cache d’armes sous une bâche.', loot: 'Deux épées courtes, une arbalète, 20 carreaux.' }),
  E(/planque/, { skill: 'Investigation', dc: 15, find: 'Une planque de contrebandier.', loot: 'Une bourse (3d10 po) et de faux papiers.' }),
  E(/boite aux lettres morte/, { skill: 'Investigation', dc: 14, find: 'Une fente dissimulée où des espions échangent des messages.', loot: 'Un message codé (Investigation DC 15 pour le déchiffrer).' }),
  E(/comptoir abandonne|fortin en ruine|charrette renversee/, { skill: 'Investigation', dc: 12, find: 'Les restes d’un comptoir ou d’un poste fortifié.', loot: 'Une balance, 3d6 pa, des armes rouillées, un registre.' }),
  E(/cheminee/, { skill: 'Perception', dc: 11, find: 'Une cheminée naturelle qui monte dans le noir.', passage: { skill: 'Athlétisme', dc: 13, text: 'Escalader la cheminée.' } }),
  E(/lucarne/, { skill: 'Perception', dc: 12, find: 'Une ouverture dans le plafond, d’où tombe un filet d’air.', passage: { skill: 'Athlétisme', dc: 12, text: 'Se hisser par l’ouverture.' } }),
  E(/forge|tannerie/, { skill: 'Investigation', dc: 11, find: 'Un atelier abandonné, ses outils en place.', loot: 'Des outils d’artisan (10 po).' }),
];

/** Fiche de fouille d'un élément, ou rien s'il ne mérite pas de jet. Une fiche réécrite par le MJ l'emporte. */
export function searchFor(title: string, override?: SearchNote): SearchEntry | null {
  const n = norm(title);
  const found = CATALOGUE.find(([re]) => re.test(n))?.[1] ?? null;
  if (!found) return override ? { ...override } : null;
  return override ? { ...found, ...override } : found;
}

/** Un élément mérite-t-il sa place sur le plateau (et dans la liste de fouille) ? */
export const isSearchable = (title: string) => !!searchFor(title);

/** Ce qu'implique de suivre un passage, selon son tracé. */
export function passageDifficulty(trace?: string): { skill?: string; dc?: number; text: string } | null {
  switch (trace) {
    case 'boyau': return { text: 'Boyau bas : on avance à quatre pattes (terrain difficile). Les créatures de taille G ne passent pas.' };
    case 'etroit': return { skill: 'Acrobaties', dc: 10, text: 'Passage étroit : Acrobaties DC 10 pour s’y glisser avec un sac ou une armure lourde.' };
    case 'crevasse': return { skill: 'Athlétisme', dc: 13, text: 'Crevasse : Athlétisme DC 13 pour descendre ou remonter (chute : 1d6 par 3 m).' };
    case 'ruisseau': return { skill: 'Athlétisme', dc: 10, text: 'Le ruisseau a du courant : Athlétisme DC 10 pour le remonter.' };
    case 'secret': return { skill: 'Investigation', dc: 13, text: 'Passage dissimulé : une fois trouvé, il faut l’ouvrir (Investigation DC 13).' };
    default: return null;
  }
}
