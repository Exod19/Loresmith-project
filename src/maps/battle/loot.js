/**
 * Fouille d'un vaincu : ce qu'il porte vraiment, d'après ce qu'il est.
 *
 * Pas un trésor tiré au hasard : un pêcheur kuo-toa a deux ou trois poissons et un filet, pas des habits de noble ;
 * une bête n'a pas de bourse, mais une peau ou des crocs à prélever (jet de Survie) ; un garde a sa solde et son
 * insigne. Le butin vient, dans l'ordre :
 *  1. de l'équipement de la fiche (armure de la CA, armes des actions), souvent abîmé par le combat ;
 *  2. de ce qu'il fait (pêcheur, garde, prêtre, marchand…), repéré dans son nom ;
 *  3. de son espèce (fiches de l'Outreterre : ce qu'il porte d'ordinaire, ce qu'il mange) ;
 *  4. de sa nature (bête, mort-vivant, vase, élémentaire…) ;
 *  5. d'une bourse modeste, selon sa nature et sa puissance, et parfois d'un petit objet personnel (accroche d'histoire).
 * Tirage stable pour un même vaincu (graine), pour que la suggestion ne change pas d'un clic à l'autre.
 *
 * JavaScript pur, testé par loot.test.mjs.
 */

/** Graine stable d'un texte → générateur 0–1. */
function rngOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
const between = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, list) => list[Math.floor(r() * list.length)];
const norm = (s = '') => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Puissance (FP) depuis « 1/4 (50 PX) », « 3 », etc. */
export function crOf(cr = '0') {
  const m = String(cr).match(/(\d+)(?:\s*\/\s*(\d+))?/);
  if (!m) return 0;
  return m[2] ? Number(m[1]) / Number(m[2]) : Number(m[1]);
}

/** Nature de la créature, d'après la ligne de fiche (« Humanoïde (nain) de taille M… ») ou son nom. */
export function natureOf(meta = '', name = '') {
  const w = (list) => new RegExp(`\\b(${list})`);
  const table = [
    ['mort-vivant', w('mort-vivant|squelette|zombie|goule|spectre|liche|vampire|momie|revenant|skeleton|ghoul|wight')],
    ['artificiel', w('artificiel|construct|golem|automate|armure animee|gargouille')],
    ['vase', w('vase|ooze|gelee|pouding|cube gelatineux')],
    ['elementaire', w('elementaire|elemental|mephite')],
    ['plante', w('plante|myconide|sylvanien|tertre|shrieker')],
    ['dragon', w('dragon|wyverne|vouivre')],
    ['fielon', w('fielon|demon|diable|diablotin|quasit|fiend')],
    ['celeste', w('celeste|ange\\b|deva|pegase')],
    ['geant', w('geant|ogre|troll|ettin|giant')],
    ['bete', w('bete\\b|beast|loup|ours\\b|rats?\\b|chauve-souris|araignee|lezard geant|sanglier|cheval|serpent|aigle|crapaud|rothe|scarabee|mille-pattes|crabe')],
    ['humanoide', w('humanoide|humanoid|garde|bandit|soldat|pretre|mage|marchand|paysan|chevalier|noble|pirate|marin|chasseur|pecheur|kuo-toa|gobelin|orque|kobold|drow|duergar|gnome|nain|elfe|humain|hobgobelin|gnoll|homme-lezard|cultiste|acolyte|voleur|brigand')],
    ['monstruosite', w('monstruosite|monstrosity|aberration')],
  ];
  // La fiche d'abord (« Humanoïde (kuo-toa)… »), le nom ensuite.
  for (const text of [norm(meta), norm(name)]) {
    if (!text) continue;
    for (const [k, re] of table) if (re.test(text)) return k;
  }
  return 'monstruosite';
}

/** Ce qu'on fait dans la vie, repéré dans le nom : ce que l'on porte pour le faire. */
const TRADES = [
  [/pecheur|fisher|harponneur|garde de bassin/, (r, ctx) => [
    { label: `${between(r, 2, 3)} poissons ${ctx.deep ? 'aveugles des lacs souterrains' : 'encore frais'}`, kind: 'vivres' },
    { label: 'un filet de pêche noué à la main', kind: 'objet' },
    r() < 0.6 && { label: 'des hameçons en os dans une pochette', kind: 'objet' },
  ]],
  [/chasseur|trappeur|hunter|pisteur|eclaireur|rodeur/, (r) => [
    { label: pick(r, ['un lièvre ficelé', 'deux perdrix', 'un quartier de viande séchée']), kind: 'vivres' },
    { label: 'des collets et une pierre à aiguiser', kind: 'objet' },
  ]],
  [/garde(?! de bassin)|soldat|sentinelle|milicien|guard|soldier|veilleur|sergent/, (r) => [
    { label: 'un insigne de la garde (le rapporter peut attirer des questions)', kind: 'objet' },
    { label: pick(r, ['un sifflet de rappel', 'une ration de soldat', 'un trousseau de deux clés (caserne, poste de garde)']), kind: 'objet' },
  ]],
  [/capitaine|officier|chef|lieutenant|commandant/, (r) => [
    { label: pick(r, ['des ordres scellés', 'une liste de relève griffonnée', 'un plan sommaire des postes']), kind: 'indice' },
  ]],
  [/bandit|brigand|voleur|coupe-jarret|thug|malfrat|assassin|pirate|forban/, (r) => [
    { label: pick(r, ['des dés pipés', 'un jeu de cartes graisseux', 'un crochet de serrure tordu']), kind: 'objet' },
    r() < 0.45 && { label: pick(r, ['une bourse arrachée à une victime, brodée d’initiales', 'un avis de recherche… à son propre nom', 'une marque de repaire sur un bout de cuir']), kind: 'indice' },
  ]],
  [/pretre|pretresse|acolyte|clerc|moine|culte|cultiste|fanatique|fouetteur|priest/, (r, ctx) => [
    { label: ctx.deep && /kuo-toa|fouetteur/.test(ctx.n) ? 'un symbole de Blibdoolpoolp en coquillage' : 'un symbole sacré usé', kind: 'objet' },
    r() < 0.5 && { label: pick(r, ['un bâtonnet d’encens', 'un livret de prières annoté', 'une fiole d’eau bénite (ou qui se dit telle)']), kind: 'objet' },
  ]],
  [/mage|sorcier|magicien|enchanteur|necromancien|apprenti|wizard|warlock|sorcerer/, (r) => [
    { label: 'une bourse à composantes (soufre, plumes, poussière d’argent)', kind: 'objet' },
    r() < 0.55 && { label: pick(r, ['un carnet de notes chiffrées', 'une page arrachée d’un grimoire', 'une lettre d’un maître exigeant']), kind: 'indice' },
  ]],
  [/marchand|colporteur|merchant|negociant|aubergiste|tavernier/, (r) => [
    { label: 'un petit registre de dettes', kind: 'indice' },
    { label: pick(r, ['une balance de poche', 'un échantillon d’épices', 'des reconnaissances de dette']), kind: 'objet' },
  ]],
  [/paysan|fermier|villageois|commoner|roturier|berger|meunier/, (r) => [
    { label: pick(r, ['un quignon de pain', 'un oignon et un bout de fromage', 'une gourde de cidre']), kind: 'vivres' },
    r() < 0.4 && { label: pick(r, ['une serpe émoussée', 'un sifflet de berger', 'une amulette porte-bonheur en bois']), kind: 'objet' },
  ]],
  [/noble|seigneur|dame|baron|comte|aristocrate|courtisan/, (r) => [
    { label: 'une chevalière aux armes de sa maison', kind: 'objet' },
    { label: pick(r, ['un flacon de parfum', 'une lettre d’amour compromettante', 'une invitation à un bal']), kind: 'indice' },
  ]],
  [/marin|matelot|sailor|mousse|quartier-maitre/, (r) => [
    { label: pick(r, ['un bout de cordage et un épissoir', 'une pipe et du tabac humide', 'une boussole fêlée']), kind: 'objet' },
  ]],
  [/mineur|forgeron|miner|smith|artisan/, (r) => [
    { label: pick(r, ['un pic émoussé', 'une pierre à aiguiser', 'quelques pépites de minerai brut']), kind: 'objet' },
  ]],
  [/esclavagiste|geolier|negrier|slaver|jailer/, () => [
    { label: 'un trousseau de clés de fers et de cellules', kind: 'objet' },
  ]],
];

/** Espèces connues (hors fiches de l'Outreterre) : ce qu'elles portent d'ordinaire. */
const SPECIES = [
  [/gobelin|goblin/, (r) => [{ label: pick(r, ['des osselets', 'une dent dorée arrachée', 'un rat séché pour plus tard']), kind: 'objet' }]],
  [/kobold/, (r) => [{ label: pick(r, ['un piège à ressort de fortune', 'une écaille de dragon (fausse, sans doute)', 'un pot de graisse']), kind: 'objet' }]],
  [/orque|orc/, (r) => [{ label: pick(r, ['un collier de dents', 'une outre d’alcool fort', 'des peintures de guerre']), kind: 'objet' }]],
  [/gnoll/, () => [{ label: 'des os rongés et un collier de trophées', kind: 'objet' }]],
  [/drow/, (r) => [{ label: pick(r, ['une fiole de poison drow (une dose, DD 13)', 'une broche en forme d’araignée', 'des champignons séchés']), kind: 'objet' }]],
  [/duergar/, (r) => [{ label: pick(r, ['un lingot de fer marqué d’une rune de clan', 'une pierre à aiguiser', 'une gourde de bière amère']), kind: 'objet' }]],
  [/svirfneblin|gnome des profondeurs/, (r) => [{ label: pick(r, ['un éclat de cristal-lueur', 'une loupe de joaillier', 'une petite gemme brute (10 po)']), kind: 'objet' }]],
  [/homme-lezard|lizardfolk/, () => [{ label: 'un poisson cru et des dents de crocodile', kind: 'vivres' }]],
];

/** Dépouilles à prélever selon la nature (jet de Survie, souvent). */
const REMAINS = [
  [/araignee|spider/, ['une glande à venin (poison, 1 dose)', 'de la soie d’araignée']],
  [/loup|wolf|chien|warg|worg/, ['une peau de loup', 'des crocs']],
  [/\bours\b|bear/, ['une peau d’ours', 'des griffes', 'de la viande pour plusieurs jours']],
  [/sanglier|boar|rothe/, ['de la viande', 'des défenses', 'un cuir épais']],
  [/serpent|snake|lezard|lizard|basilic/, ['une peau écailleuse', 'une glande à venin, si venimeux']],
  [/chauve-souris|bat/, ['des ailes membraneuses (composante)']],
  [/\brats?\b/, ['rien qui vaille la peine (peut-être des puces)']],
  [/scarabee|beetle/, ['une carapace chitineuse', 'des glandes luminescentes, si c’est un scarabée de feu']],
  [/crabe|crab/, ['de la chair de crabe', 'une pince (outil, trophée)']],
  [/aigle|eagle|harpie|hibou|owl/, ['des plumes (empennage, composante)']],
  [/dragon|wyverne|vouivre/, ['des écailles (une armure, chez un bon artisan)', 'des crocs', 'du sang (alchimie)']],
  [/troll/, ['un morceau de troll qui continue de remuer (à brûler, ou à vendre à un alchimiste)']],
  [/grick|roper|enlaceur/, ['un bec ou des crochets cornés', 'des tendons durs']],
];

const NATURE = {
  bete: { coins: 0, remains: ['de la viande', 'une peau'], skill: 'Survie' },
  monstruosite: { coins: 0.15, remains: ['un trophée (griffe, corne, dent)'], skill: 'Survie' },
  dragon: { coins: 0, remains: ['des écailles', 'des crocs'], skill: 'Survie', note: 'Le vrai trésor d’un dragon est dans son antre, pas sur lui.' },
  'mort-vivant': { coins: 0.35, items: (r) => [{ label: pick(r, ['des haillons et une boucle de ceinture rouillée', 'une vieille pièce à l’effigie d’un roi oublié', 'un anneau terni au doigt d’os']), kind: 'objet' }] },
  artificiel: { coins: 0, items: (r) => [{ label: pick(r, ['des engrenages et ressorts récupérables', 'un noyau runique éteint (Arcanes DD 13 pour savoir d’où il vient)', 'des plaques de métal']), kind: 'objet' }] },
  vase: { coins: 0.5, items: (r) => [{ label: pick(r, ['des objets non digérés : une boucle, des clous, un bout d’épée', 'des pièces corrodées collées entre elles', 'un os poli et une dague à demi rongée']), kind: 'objet' }], note: 'Attendre qu’elle sèche, ou fouiller avec des gants : l’acide ronge encore.' },
  elementaire: { coins: 0, items: (r) => [{ label: pick(r, ['une poignée de poussière élémentaire (composante)', 'un éclat de pierre encore chaud', 'une perle d’eau qui ne s’évapore pas']), kind: 'objet' }] },
  plante: { coins: 0, items: (r) => [{ label: pick(r, ['des spores dans une bourse (Nature DD 12 : comestibles ou non ?)', 'des racines médicinales', 'une sève épaisse']), kind: 'objet' }], skill: 'Nature' },
  fielon: { coins: 0.2, items: (r) => [{ label: pick(r, ['une corne fumante', 'du soufre', 'un contrat griffonné en infernal']), kind: 'objet' }], note: 'Souvent, le corps se dissout et ne laisse presque rien.' },
  celeste: { coins: 0, items: () => [{ label: 'une plume lumineuse qui s’éteint en une heure', kind: 'objet' }] },
  geant: { coins: 0.8, items: (r) => [{ label: pick(r, ['un grand sac : un mouton mort, une marmite, des cailloux', 'une outre énorme de vin aigre', 'un collier de crânes']), kind: 'objet' }] },
  humanoide: { coins: 0.8 },
};

/** Armes reconnues dans les actions de la fiche. */
const WEAPONS = /(epee|dague|poignard|cimeterre|rapiere|hache|masse|marteau|gourdin|baton|lance|javeline|pique|hallebarde|fleau|trident|harpon|arc|arbalete|fronde|filet|pic de guerre|morgenstern|faux|serpe|coutelas|sabre|fouet|kukri)/;
const RANGED = { arc: 'flèches', arbalete: 'carreaux', fronde: 'billes de fronde', javeline: 'javelines' };

/** Équipement de la fiche : armure de la CA, armes des actions. */
export function gearOf({ ac = '', actions = [] } = {}, r = Math.random) {
  const out = [];
  const armor = String(ac).match(/\(([^)]+)\)/)?.[1];
  if (armor && !/naturelle|natural|defense sans armure|unarmored/i.test(norm(armor))) {
    for (const part of armor.split(/,| et /).map((s) => s.trim()).filter(Boolean)) {
      out.push({ label: `${part}${r() < 0.6 ? ' (abîmé par le combat)' : ''}`, kind: 'equipement' });
    }
  }
  const seen = new Set();
  for (const [name] of actions) {
    const n = norm(name);
    if (/multiattaque|morsure|griffe|coup|tentacule|dard|souffle|charge/.test(n) && !WEAPONS.test(n)) continue;
    const w = n.match(WEAPONS)?.[1];
    if (!w || seen.has(name)) continue;
    seen.add(name);
    const clean = String(name).replace(/\s*\(.*\)\s*/g, '').trim();
    out.push({ label: clean.charAt(0).toLowerCase() + clean.slice(1), kind: 'equipement' });
    const ammo = Object.entries(RANGED).find(([k]) => w === k)?.[1];
    if (ammo && w !== 'javeline') out.push({ label: `${between(r, 2, 9)} ${ammo}`, kind: 'equipement' });
  }
  return out;
}

/** Bourse selon la puissance (FP) : modeste, en cuivre et en argent ; l'or reste rare. */
export function purseOf(cr, r, deep = false) {
  const coin = deep ? ' (frappées dans les profondeurs)' : '';
  if (cr < 0.5) return between(r, 0, 2) ? `${between(r, 1, 8)} pc${coin}` : null;
  if (cr < 2) return `${between(r, 2, 12)} pa et ${between(r, 0, 10)} pc${coin}`;
  if (cr < 5) return `${between(r, 2, 10)} po et ${between(r, 3, 18)} pa${coin}`;
  if (cr < 11) return `${between(r, 10, 40)} po${coin}`;
  return `${between(r, 40, 150)} po et une gemme (${pick(r, [50, 100])} po)`;
}

const TRINKETS = [
  'un médaillon avec le portrait d’un enfant', 'une lettre jamais envoyée', 'une carte griffonnée avec une croix',
  'une mèche de cheveux nouée d’un ruban', 'un dé en os à six faces… toutes des 6', 'une clé qui n’ouvre rien d’ici',
  'un caillou peint, souvenir d’un pays lointain', 'une liste de noms, dont certains rayés', 'une dent de lait dans une boîte',
];

/**
 * Suggestions de fouille pour un vaincu.
 * `c` : { id, name, meta, ac, cr, actions, ref } — `ref` : fiche d'espèce (loot, ecology.diet) si connue ; `region` :
 * 'surface' | 'outreterre'.
 * Renvoie { items: [{ label, kind }], harvest?: { skill, dc, items }, note?, summary }.
 */
export function lootOf(c = {}, { region = 'surface', seed = '' } = {}) {
  const r = rngOf(`${seed}|${c.id ?? ''}|${c.name ?? ''}`);
  const n = norm(c.name);
  const nature = natureOf(c.meta, c.name);
  const def = NATURE[nature] ?? NATURE.monstruosite;
  const cr = crOf(c.cr);
  const deep = region === 'outreterre' || /kuo-toa|drow|duergar|svirfneblin|myconide/.test(n);
  const ctx = { deep, n };
  const items = [];
  const add = (list) => { for (const it of list) if (it && !items.some((x) => x.label === it.label)) items.push(it); };

  add(gearOf(c, r));
  for (const [re, fn] of TRADES) if (re.test(n)) add(fn(r, ctx));
  for (const [re, fn] of SPECIES) if (re.test(n)) add(fn(r, ctx));
  // Fiche d'espèce (Outreterre) : ce qu'elle porte d'ordinaire (un ou deux objets, pas tout), et de quoi elle se nourrit.
  if (c.ref?.loot?.length && nature !== 'bete') {
    const pool = [...c.ref.loot].sort(() => r() - 0.5).slice(0, between(r, 1, Math.min(2, c.ref.loot.length)));
    add(pool.map((label) => ({ label, kind: 'objet' })));
    const diet = c.ref.ecology?.diet;
    if (diet && nature === 'humanoide' && r() < 0.5 && !items.some((x) => x.kind === 'vivres')) {
      add([{ label: `un peu de nourriture : ${diet.split(',')[0].trim()}`, kind: 'vivres' }]);
    }
  }
  if (def.items) add(def.items(r));

  // Bourse : jamais sur une bête ; parfois sur un monstre (il a pu dévorer un voyageur).
  if (def.coins && r() < def.coins) {
    const p = purseOf(cr, r, deep);
    if (p) add([{ label: nature === 'humanoide' ? `une bourse : ${p}` : `quelques pièces ${nature === 'vase' ? 'dans sa masse' : 'éparses'} : ${p}`, kind: 'monnaie' }]);
  }
  // Objet personnel : seulement chez ceux qui en ont (les humanoïdes), une fois sur quatre.
  if (nature === 'humanoide' && r() < 0.25) add([{ label: pick(r, TRINKETS), kind: 'indice' }]);

  // Dépouilles à prélever (bêtes, monstres, dragons, plantes) : un jet, pas un butin automatique.
  let harvest;
  if (def.remains || def.skill) {
    const specific = REMAINS.find(([re]) => re.test(n))?.[1];
    const list = specific ?? (c.ref?.loot?.length && nature !== 'humanoide' ? c.ref.loot : def.remains);
    if (list?.length) harvest = { skill: def.skill ?? 'Survie', dc: Math.min(18, 10 + Math.round(cr / 2)), items: list };
  }
  if (!items.length && !harvest) items.push({ label: 'rien d’utile : ses poches sont vides', kind: 'objet' });

  const summary = [items.map((i) => i.label).join(', '), harvest && `à prélever (${harvest.skill} DD ${harvest.dc}) : ${harvest.items.join(', ')}`]
    .filter(Boolean).join(' ; ');
  return { items, harvest, note: def.note, summary };
}
