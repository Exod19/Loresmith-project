/**
 * Banque Loresmith : choisir une image cohérente (personnage, élément, texture) et sa bonne résolution.
 *
 * Règles de cohérence :
 *  - Outreterre : seulement les peuples des profondeurs (drow, duergar, svirfnebelin…), jamais d'humain ;
 *    à la surface, jamais de peuple des profondeurs qui ne soit nommé par la fiche de la cité.
 *  - Les peuples d'une cité viennent de sa fiche (et de son champ « peuple ») : peuple principal surtout, quelques
 *    voisins ordinaires à la surface ; un peuple que la fiche bannit, ou qu'elle dit chassé, n'y tient pas boutique.
 *  - Cité où l'on chasse créatures, démons ou sang-mêlé : ni tieffelin, ni demi-orque, ni peuple des profondeurs.
 *  - Éléments et textures : selon le climat, la saison, le milieu et la région (surface, outreterre, mer).
 *
 * Tout est déterministe : une même graine donne toujours la même image (un PNJ garde son visage).
 * JavaScript pur : testé par banque.test.mjs.
 */

export const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ');

/** Peuples connus : clé → motif (singulier, pluriel, féminin). */
export const PEUPLES = {
  humain: /\bhumaine?s?\b|\bhommes?\b/,
  nain: /\bnaine?s?\b/,
  elfe: /\b(haut-)?elfes?\b|\belfique/,
  'demi-elfe': /\bdemi-elfes?\b/,
  halfelin: /\bhalfeline?s?\b|\bhobbits?\b|\bpetites? gens\b/,
  gnome: /\bgnomes?\b/,
  'demi-orque': /\bdemi-orque?s?\b/,
  orque: /\borque?s?\b/,
  tieffelin: /\btieffeline?s?\b|\btieflings?\b/,
  drow: /\bdrows?\b|\belfes? noire?s?\b/,
  duergar: /\bduergars?\b|\bnains? gris\b/,
  svirfnebelin: /\bsvirfnebelins?\b|\bgnomes? des profondeurs\b/,
  moriquendi: /\bmori(quendi)?\b/,
};
/** Peuples des profondeurs : chez eux en Outreterre, étrangers à la surface. */
export const PROFONDEURS = new Set(['drow', 'duergar', 'svirfnebelin', 'moriquendi']);
/** Peuples ordinaires de la surface : voisins plausibles dans une cité cosmopolite. */
export const SURFACE = ['humain', 'nain', 'elfe', 'demi-elfe', 'halfelin', 'gnome'];
/** Peuples qu'une cité qui chasse les créatures ne tolère pas. */
export const TRAQUES = new Set(['tieffelin', 'demi-orque', 'orque', 'drow', 'duergar', 'svirfnebelin', 'moriquendi']);

const HOSTILE = /(chass|traqu|pourchass|bucher|inquisit|purg|extermin|pend|brul)\w*[^.]{0,80}(creature|monstre|demon|infern|non-humain|sang-mele|engeance|tieffelin|tiefling|orque)|(creature|monstre|demon|infern|non-humain|sang-mele|engeance|tieffelin|tiefling|orque)s?[^.]{0,60}(chass|traqu|pourchass|brul|pendu|banni|proscrit)/;

/** Un peuple (ou ses variantes de libellé) ramené à sa clé. */
export function peupleKey(s) {
  const t = norm(s);
  for (const k of ['demi-elfe', 'demi-orque', 'svirfnebelin', 'duergar', 'drow', 'tieffelin', 'halfelin', 'gnome', 'nain', 'elfe', 'orque', 'humain', 'moriquendi']) if (PEUPLES[k].test(t)) return k;
  return t.trim() || null;
}

/**
 * Peuples d'un lieu, d'après sa fiche. `text` : fiche de la cité (titre, résumé, corps) ; `people` : champ « peuple » ;
 * `region` : 'surface' | 'outreterre' | 'mer'.
 * Renvoie { main, others, banned, hostile }.
 */
export function peoplesOf({ text = '', people = '', region = 'surface' } = {}) {
  const t = norm(text);
  const named = [];
  const lead = peupleKey(people);
  if (lead) named.push(lead);
  // « demi-elfe » contient « elfe » : les peuples simples se cherchent dans le texte privé des noms composés.
  const simple = t.replace(/demi-(elfe|orque)s?|elfes? noire?s?|nains? gris|gnomes? des profondeurs/g, ' ');
  const COMPOSES = new Set(['demi-elfe', 'demi-orque', 'drow', 'duergar', 'svirfnebelin']);
  for (const k of Object.keys(PEUPLES)) {
    if (PEUPLES[k].test(COMPOSES.has(k) ? t : simple) && !named.includes(k)) named.push(k);
  }
  const banned = new Set();
  for (const k of Object.keys(PEUPLES)) {
    const src = PEUPLES[k].source;
    const ban = new RegExp(`(aucune?|pas d[e ]|interdit\\w* aux|bann\\w*|chass\\w*|traqu\\w*|pourchass\\w*|haine des|hai\\w* les)[^.]{0,30}(${src})|(${src})[^.]{0,40}(sont |y sont |)(bannis|chasses|traques|pourchasses|interdits|indesirables|haïs|hais|pendus|brules)`);
    if (ban.test(t)) banned.add(k);
  }
  const hostile = HOSTILE.test(t);
  if (hostile) for (const k of TRAQUES) banned.add(k);
  let main = named.filter((k) => !banned.has(k));
  let others = [];
  if (region === 'outreterre') {
    main = main.filter((k) => PROFONDEURS.has(k));
    if (!main.length) main = ['drow', 'duergar', 'svirfnebelin'].filter((k) => !banned.has(k));
  } else {
    // Surface : un peuple des profondeurs n'y vit que si la fiche le nomme expressément.
    if (!main.length) main = ['humain'];
    others = SURFACE.filter((k) => !main.includes(k) && !banned.has(k));
  }
  return { main, others, banned: [...banned], hostile };
}

/** Hachage stable d'une chaîne (graine). */
export function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Tirage pondéré et stable. */
function weighted(cands, seed) {
  const total = cands.reduce((s, c) => s + c.w, 0);
  if (!total) return null;
  let x = ((hash(seed) % 100000) / 100000) * total;
  for (const c of cands) { x -= c.w; if (x < 0) return c.img; }
  return cands[cands.length - 1].img;
}

/** Rôles qui conviennent à n'importe quel figurant. */
const GENERIQUES = new Set(['villageois', 'voyageur', 'client', 'ancien']);

/** Rôle ramené à sa forme de base : « tavernière » → « tavernier », « prêtresse » → « pretre ». */
export function roleKeys(role) {
  const words = norm(role).split(/[^a-z-]+/).filter((w) => w.length > 2);
  const out = new Set();
  for (const w of words) {
    out.add(w);
    const base = w.replace(/s$/, '');
    out.add(base);
    // Une seule règle de féminin par mot (la première qui s'applique).
    const rule = [[/iere$/, 'ier'], [/euse$/, 'eur'], [/trice$/, 'teur'], [/esse$/, 'e'], [/ienne$/, 'ien'], [/ere$/, 'er'], [/([^e])e$/, '$1']].find(([re]) => re.test(base));
    if (rule) out.add(base.replace(rule[0], rule[1]));
  }
  const SYN = { aubergiste: 'tavernier', cabaretier: 'tavernier', patron: 'tavernier', serveur: 'serveur', servant: 'servante', guet: 'garde', sergent: 'garde', milicien: 'garde', soldat: 'garde', clerc: 'pretre', moine: 'pretre', acolyte: 'pretre', forgeron: 'forgeron', marchand: 'marchand', boutiquier: 'marchand', colporteur: 'marchand', mendiant: 'mendiant', paysan: 'fermier', fermier: 'fermier', erudit: 'erudit', sage: 'erudit', scribe: 'erudit', bibliothecaire: 'erudit', voleur: 'voleur', apprenti: 'apprenti', enfant: 'enfant', gamin: 'enfant', pelerin: 'pelerin', fidele: 'fidele', noble: 'noble', seigneur: 'noble', dame: 'noble', guerisseur: 'soigneur', herboriste: 'soigneur', medecin: 'soigneur', docker: 'porteur', porteur: 'porteur', client: 'client', voyageur: 'voyageur' };
  for (const w of [...out]) if (SYN[w]) out.add(SYN[w]);
  return [...out];
}

/**
 * Personnage cohérent : `vue` 'portrait' | 'jeton' ; `role` (texte libre) ; `peoples` (résultat de peoplesOf) ;
 * `genre` 'f' | 'm' facultatif ; `seed` (identifiant du PNJ). Renvoie l'image, ou null plutôt qu'un choix incohérent.
 */
/**
 * Personnage cohérent : `vue` ('portrait' | 'jeton'), `role`, `peoples` (peuples du lieu) ou `peuple` (imposé), `genre`
 * (strict : jamais une femme pour un homme), `pose` (seule une pose demandée est admise : un dormeur couché, jamais un
 * passant couché par terre), `exclude` (identifiants déjà pris dans la scène), `seed`.
 */
export function pickPerson(images, { vue = 'portrait', role = '', peoples = peoplesOf({}), genre, seed = '', peuple, pose, exclude } = {}) {
  const roles = roleKeys(role);
  const forced = peuple ? peupleKey(peuple) : null;
  const banned = new Set(peoples.banned ?? []);
  let cands = [];
  for (const img of images) {
    if (img.type !== 'personnage' || img.vue !== vue || img.exclu || !img.peuple) continue;
    if (exclude?.has(img.id)) continue; // déjà pris par quelqu'un d'autre dans la même scène
    const p = img.peuple;
    if (banned.has(p)) continue;
    let w;
    if (forced) w = p === forced ? 6 : 0;
    else w = peoples.main.includes(p) ? 6 : (peoples.others ?? []).includes(p) ? 1 : 0;
    if (!w) continue;
    // Rôle de l'image au féminin ou au pluriel (« taverniere ») : ramené à ses formes de base, comme celui demandé.
    const hit = roles.length && (img.roles ?? []).some((r) => roles.includes(r) || roleKeys(r).some((k) => roles.includes(k)));
    if (roles.length) w *= hit ? 8 : 1;
    if (genre && img.genre && img.genre !== genre) continue;
    if (img.pose && img.pose !== pose) continue; // assis, agenouillé, couché : seulement quand la scène le demande
    cands.push({ img, w, hit });
  }
  // Un rôle reconnu l'emporte : on ne garde que les images qui le portent quand il y en a.
  // Sinon, une figure ordinaire (villageois, voyageur, client) : jamais un marchand de pommes pour jouer un garde.
  // Une pose demandée (un dormeur couché) passe avant tout le reste, quand la banque en a une.
  if (pose && cands.some((c) => c.img.pose === pose)) cands = cands.filter((c) => c.img.pose === pose);
  const hits = cands.filter((c) => c.hit);
  const plain = roles.length ? cands.filter((c) => (c.img.roles ?? []).some((r) => GENERIQUES.has(r))) : cands;
  const pool = hits.length ? hits : plain;
  // Jetons : ceux pris vraiment à la verticale (`angle: zenith`) vont mieux sur un plan vu de haut. Pour un rôle
  // reconnu, ils passent seuls quand il y en a ; sinon, ils sont nettement favorisés.
  if (vue === 'jeton') {
    const top = pool.filter((c) => c.img.angle === 'zenith');
    if (hits.length && top.length) return weighted(top, `${seed}|${vue}`);
    for (const c of top) c.w *= 4;
  }
  return weighted(pool, `${seed}|${vue}`);
}

/** Climat de l'application ('froid' | 'tempere' | 'chaud') → climats acceptés dans la banque. */
const CLIMATS = { froid: ['froid'], tempere: ['tempere'], chaud: ['chaud', 'aride', 'tropical'] };

function fits(img, { climat, saison, region = 'surface' }) {
  if (img.exclu) return false;
  if (!(img.region ?? ['surface']).includes(region)) return false;
  if (climat && img.climats?.length && !img.climats.some((c) => (CLIMATS[climat] ?? [climat]).includes(c))) return false;
  if (saison && img.saisons?.length && !img.saisons.includes(saison)) return false;
  return true;
}

/**
 * Élément cohérent (arbre, rocher, toit, mobilier…) : `cat` (ou `cats`), `climat`, `saison`, `region`, `milieu`,
 * `usage`, `forme` (préférée), `formes` (seules admises) et `ratio` (toits : proportions de l'emprise) ; `seed`.
 */
export function pickElement(images, { cat, cats, climat, saison, region = 'surface', milieu, usage, forme, formes, ratio, seed = '' } = {}) {
  const want = cats ?? (cat ? [cat] : null);
  const cands = [];
  for (const img of images) {
    if (img.type !== 'element' || (want && !want.includes(img.cat))) continue;
    if (!fits(img, { climat, saison, region })) continue;
    // `formes` : seules ces formes conviennent (une emprise rectangulaire ne prend ni dôme, ni croix, ni toit en L).
    if (formes && !formes.includes(img.forme)) continue;
    let w = 1;
    if (milieu && img.milieux?.includes(milieu)) w *= 3;
    if (usage && img.usage?.includes(usage)) w *= 4;
    if (forme) w *= img.forme === forme ? 4 : 0.5;
    // La saison propre à l'image (arbre givré en hiver, érable roux en automne) passe devant l'image de toute saison.
    if (saison && img.saisons?.includes(saison)) w *= 3;
    if (ratio && img.taille) {
      const r = img.taille[0] / img.taille[1];
      const d = Math.abs(Math.log(Math.max(r, 1 / r)) - Math.log(Math.max(ratio, 1 / ratio)));
      w *= Math.exp(-d * 2.5);
    }
    cands.push({ img, w });
  }
  return weighted(cands, seed);
}

/** Texture cohérente : `cat` ou `cats` (premier trouvé dans l'ordre donné), climat, saison, région. */
export function pickTexture(images, { cat, cats, climat, saison, region = 'surface', seed = '' } = {}) {
  for (const c of cats ?? [cat]) {
    const cands = images.filter((img) => img.type === 'texture' && img.cat === c && fits(img, { climat, saison, region })).map((img) => ({ img, w: 1 }));
    const got = weighted(cands, seed);
    if (got) return got;
  }
  return null;
}

/** Version (mip) à charger pour une image dessinée sur `px` pixels écran : la plus petite assez nette, jamais agrandie. */
export function mipFor(img, px, dpr = 1) {
  const need = px * dpr;
  const mips = img.mips?.length ? img.mips : [256, 512, 1024];
  return mips.find((m) => m >= need) ?? mips[mips.length - 1];
}

/** Taille dessinée (px) d'un objet de `meters` mètres quand un pixel vaut `metersPerPx` mètres. */
export const drawPx = (meters, metersPerPx) => meters / metersPerPx;

/** Seuil sous lequel un objet ne se dessine plus (une chaise ne devient pas un point gros comme une montagne). */
export const MIN_PX = 5;

/** Chemin public d'une image de la banque, dans la version voulue. */
export function bankUrl(img, size, base = '/') {
  const folder = { texture: 'textures', element: 'elements', personnage: 'personnages', creature: 'creatures' }[img.type];
  return `${base}banque/${folder}/${img.id}-${size}.webp`;
}

/** Retouches du MJ (étiquettes corrigées, image exclue) appliquées au catalogue. */
export function withOverrides(images, overrides = {}) {
  return images.map((img) => (overrides[img.id] ? { ...img, ...overrides[img.id] } : img));
}

/**
 * Pose d'un toit sur l'emprise d'un bâtiment (w × d mètres, angle) : l'image est tournée pour que son grand côté suive
 * celui de l'emprise, d'un quart de tour de plus ou de moins au gré de la graine (les faîtages ne regardent pas tous
 * le même côté de la rue). Renvoie l'angle en radians à appliquer à l'image.
 */
export function roofAngle(img, w, d, ang, seed = '') {
  const r = img.taille ? img.taille[0] / img.taille[1] : img.ratio ?? 1;
  const longImg = r >= 1, longRect = w >= d;
  const flip = hash(seed) % 2 ? Math.PI : 0;
  return ang + (longImg === longRect ? 0 : Math.PI / 2) + flip;
}

/** Angle (radians) pour qu'un personnage vu du dessus — qui regarde vers le bas de l'image — fasse face à (dx, dy). */
export const faceAngle = (dx, dy) => (dx || dy ? Math.atan2(dy, dx) - Math.PI / 2 : 0);

/* ——— Toits sur des emprises composées (L, T, U, croix…) ——— */

/** Silhouette 8 × 8 d'une emprise faite de rectangles `parts` ([u0, v0, u1, v1] entre 0 et 1 dans son cadre). */
export function maskFromParts(parts, n = 8) {
  let out = '';
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, v = (j + 0.5) / n;
    out += parts.some(([u0, v0, u1, v1]) => u >= u0 && u <= u1 && v >= v0 && v <= v1) ? '1' : '0';
  }
  return out;
}

/** Silhouette d'une image tournée de `rot` quarts de tour (sens horaire à l'écran) après miroir horizontal (`flip`). */
export function turnedMask(mask, rot, flip, n = 8) {
  const th = (rot * Math.PI) / 2, c = Math.round(Math.cos(th)), s = Math.round(Math.sin(th));
  let out = '';
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i + 0.5) / n - 0.5, y = (j + 0.5) / n - 0.5;
    // Inverse du dessin (rotation après miroir) : rotation inverse, puis miroir.
    let sx = x * c + y * s;
    const sy = -x * s + y * c;
    if (flip) sx = -sx;
    const ci = Math.min(n - 1, Math.max(0, Math.floor((sx + 0.5) * n))), cj = Math.min(n - 1, Math.max(0, Math.floor((sy + 0.5) * n)));
    out += mask[cj * n + ci];
  }
  return out;
}

const iou = (a, b) => { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { const x = a[k] === '1', y = b[k] === '1'; if (x && y) i++; if (x || y) u++; } return u ? i / u : 0; };

/**
 * Toit qui épouse une emprise : `mask` (silhouette 8 × 8 de l'emprise), `w` × `h` (mètres, dans son cadre), climat,
 * usage. Chaque toit est essayé dans les quatre orientations, en miroir ou non ; on garde ceux qui recouvrent l'emprise
 * (`min` : part commune minimale) et dont les proportions vont. Renvoie { img, rot, flip, iw, ih } : l'image se dessine
 * en iw × ih (avant rotation), tournée de rot quarts de tour, en miroir si flip ; ou null.
 */
export function fitRoof(images, { mask, w, h, climat, usage, seed = '', min = 0.85 } = {}) {
  const cands = [];
  for (const img of images) {
    if (img.type !== 'element' || img.cat !== 'toit' || !img.masque || !fits(img, { climat })) continue;
    const t = Array.isArray(img.taille) ? img.taille : [img.ratio ?? 1, 1];
    const r0 = t[0] / t[1];
    let best = null;
    for (let rot = 0; rot < 4; rot++) for (const flip of [false, true]) {
      const m = iou(turnedMask(img.masque, rot, flip), mask);
      // Proportions : l'image tournée d'un quart de tour échange largeur et hauteur.
      const r = rot % 2 ? 1 / r0 : r0;
      const d = Math.abs(Math.log(r) - Math.log(w / h));
      const score = m ** 6 * Math.exp(-d * 1.2) * (usage && img.usage?.includes(usage) ? 1.6 : 1);
      if (m >= min && (!best || score > best.score)) best = { img, rot, flip, iw: rot % 2 ? h : w, ih: rot % 2 ? w : h, score };
    }
    if (best) cands.push(best);
  }
  if (!cands.length) return null;
  const top = Math.max(...cands.map((c) => c.score));
  const keep = cands.filter((c) => c.score >= top * 0.5);
  let x = ((hash(seed) % 100000) / 100000) * keep.reduce((s, c) => s + c.score, 0);
  for (const c of keep) { x -= c.score; if (x < 0) return c; }
  return keep[keep.length - 1];
}

/** Longueur réelle (m) d'une image de jeton dessinée à l'échelle 1 (0,94 case de 1,5 m). */
export const TOKEN_REF_M = 1.41;

/** Taille d'un peuple par rapport à un humain (stature). Drow, duergar et autres peuples absents : comme leurs cousins. */
const STATURE = { humain: 1, elfe: 1, 'demi-elfe': 1, tieffelin: 1, drow: 0.97, 'demi-orque': 1.08, nain: 0.78, duergar: 0.76, halfelin: 0.6, gnome: 0.58, svirfnebelin: 0.58 };

/**
 * Échelle d'un jeton de la banque, pour que tous les personnages soient dessinés à la même échelle : 1 pour un humain
 * adulte debout vu à 15° (l'image couvre sa hauteur). Chaque image remplit son cadre quelle que soit la taille réelle
 * du personnage ; on corrige donc d'après ses étiquettes :
 * - peuple (un halfelin fait 0,6 humain) et âge (un enfant, 0,68) ;
 * - pose : agenouillé ou assis, l'image couvre moins que sa hauteur debout ; couché, toute sa longueur ;
 * - vue à la verticale (`angle: zenith`) : l'image couvre les épaules et les bras, plus la hauteur.
 */
export function tokenScale(img) {
  if (!img || img.type !== 'personnage') return 1;
  // Longueur réelle couverte par l'image (mesurée, ou retouchée par l'administrateur) : la référence est 1,41 m.
  if (typeof img.longueur === 'number' && img.longueur > 0) return Math.round((img.longueur / TOKEN_REF_M) * 100) / 100;
  let s = STATURE[img.peuple] ?? 1;
  if ((img.roles ?? []).includes('enfant')) s *= 0.68;
  if (img.angle === 'zenith') s *= 0.68;
  else if (img.pose === 'agenouille' || img.pose === 'assis') s *= 0.72;
  return Math.round(s * 100) / 100;
}

/* ——— Genre et peuple d'un PNJ, pour lui donner une image qui lui ressemble ——— */

const FEM_WORDS = /\b(elle|femme|dame|reine|fille|mere|tante|soeur|epouse|veuve|matrone|demoiselle|nonne|abbesse|princesse|duchesse|comtesse|baronne|pretresse|sorciere)\b/;
const MASC_WORDS = /\b(il|homme|roi|seigneur|garcon|fils|pere|oncle|frere|epoux|veuf|moine|abbe|prince|duc|comte|baron|pretre|sorcier)\b/;
/** Métiers au féminin (tavernière, couturière, servante, marchande) : suffixes sans équivoque. */
const FEM_ROLE = /\b\w+(iere|euse|esse|trice|ienne|onne|ante|ande)\b/;
const MASC_ROLE = /\b\w+(ier|eur|ien|on|ant|and|in)\b/;
/** Prénoms dont la terminaison trompe : féminins sans « e » final, masculins en « e ». */
const FEM_NAMES = new Set(['mahaut', 'ysolde', 'isaure', 'aenor', 'agnes', 'ines', 'margot', 'ninon', 'manon', 'alix', 'beatrix', 'yseult']);
const MASC_NAMES = new Set(['anselme', 'lothaire', 'guillaume', 'philippe', 'etienne', 'pierre', 'georges', 'jacques', 'gilles', 'hugues', 'baptiste', 'jerome', 'auguste', 'theodore', 'barnabe', 'andre', 'rene', 'aime', 'thibaude', 'fulbert', 'ange', 'cyrille', 'achille', 'hercule', 'jule', 'serge', 'eustache', 'ambroise', 'theophile', 'alexandre', 'enguerrande', 'arthure', 'aristide', 'clotaire', 'childebert', 'onesime', 'ignace', 'boniface', 'apollinaire', 'hilaire', 'honore', 'antoine', 'maxime', 'luce', 'mathieu', 'emmanuel', 'joshua', 'luca', 'nicola', 'elie', 'noe', 'jose']);

/** Genre d'un prénom : 'f', 'm' ou undefined (prénom inconnu ou épicène). */
export function nameGenre(name = '') {
  const first = norm(String(name)).split(/[\s,'’-]+/)[0] ?? '';
  if (!first) return undefined;
  if (FEM_NAMES.has(first)) return 'f';
  if (MASC_NAMES.has(first)) return 'm';
  // En français, un prénom en « e » ou en « a » est presque toujours féminin (les exceptions sont listées plus haut).
  if (/[ea]$/.test(first)) return 'f';
  return /[a-z]$/.test(first) ? 'm' : undefined;
}

/**
 * Genre et peuple d'un PNJ, d'après sa fiche : champs explicites d'abord (`gender`, `race`), puis son rôle et sa
 * description, puis son prénom. Renvoie { genre?: 'f' | 'm', peuple?: string } ; rien d'inventé quand rien ne le dit.
 */
export function npcTraits({ name = '', role = '', desc = '', gender, race } = {}) {
  const g = String(gender ?? '').toLowerCase();
  let genre = /^(f|female|femme|feminin)/.test(g) ? 'f' : /^(m|male|homme|masculin)/.test(g) ? 'm' : undefined;
  const r = norm(role), d = norm(desc);
  if (!genre) genre = FEM_WORDS.test(r) || FEM_ROLE.test(r) ? 'f' : MASC_WORDS.test(r) ? 'm' : undefined;
  if (!genre) genre = nameGenre(name);
  if (!genre) genre = FEM_WORDS.test(d) && !MASC_WORDS.test(d) ? 'f' : MASC_WORDS.test(d) && !FEM_WORDS.test(d) ? 'm' : MASC_ROLE.test(r) ? 'm' : undefined;
  // Peuple : le champ de la fiche, sinon un peuple nommé dans le rôle ou la description (« une naine », « l'elfe »).
  let peuple = race ? peupleKey(race) : null;
  if (peuple && !PEUPLES[peuple]) peuple = null;
  if (!peuple) {
    const t = `${r} ${d}`.replace(/\bhommes?\b/g, '');
    for (const k of ['demi-elfe', 'demi-orque', 'svirfnebelin', 'duergar', 'drow', 'tieffelin', 'halfelin', 'gnome', 'nain', 'elfe', 'orque', 'humain']) {
      // « demi-elfe » contient « elfe » : les peuples simples se cherchent sans les noms composés.
      const plain = k.includes('-') ? t : t.replace(/\bdemi-\w+/g, '');
      if (PEUPLES[k].test(plain)) { peuple = k; break; }
    }
  }
  return { ...(genre ? { genre } : {}), ...(peuple ? { peuple } : {}) };
}

/**
 * Image qui remplace une image supprimée de la banque, là où elle était posée : la plus proche parmi celles qui
 * restent (même type et même vue ; puis catégorie, usage, peuple, genre — obligatoire pour un personnage —,
 * rôles, monde, milieux, taille). Toujours la même pour une même image. null : rien d'assez proche.
 */
export function replacementFor(images, img) {
  if (!img) return null;
  const size = (i) => (Array.isArray(i.taille) ? i.taille[0] * i.taille[1] : typeof i.taille === 'number' ? i.taille * i.taille : 0);
  const common = (a = [], b = []) => a.filter((x) => b.includes(x)).length;
  let best = null, bestScore = -Infinity;
  for (const c of images) {
    if (c.id === img.id || c.supprime || c.exclu || c.type !== img.type || c.vue !== img.vue) continue;
    if (img.type === 'personnage' && img.genre && c.genre && c.genre !== img.genre) continue;
    let s = 0;
    if (img.cat && c.cat === img.cat) s += 6;
    s += 2 * common(img.usage, c.usage);
    if (img.forme && c.forme === img.forme) s += 2;
    if (img.peuple && c.peuple === img.peuple) s += 5;
    if (img.genre && c.genre === img.genre) s += 2;
    s += common(img.roles, c.roles);
    s += 2 * common(img.region, c.region);
    s += common(img.milieux, c.milieux);
    if (img.pose && c.pose === img.pose) s += 1;
    const a = size(img), b = size(c);
    if (a && b) s -= 2 * Math.abs(Math.log(a / b));
    // Départage stable : la même image remplacée prend toujours le même remplaçant.
    s += (hash(`${img.id}:${c.id}`) % 100) / 1000;
    if (s > bestScore) { bestScore = s; best = c; }
  }
  return best;
}
