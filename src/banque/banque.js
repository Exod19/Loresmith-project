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
export function pickPerson(images, { vue = 'portrait', role = '', peoples = peoplesOf({}), genre, seed = '', peuple } = {}) {
  const roles = roleKeys(role);
  const forced = peuple ? peupleKey(peuple) : null;
  const banned = new Set(peoples.banned ?? []);
  const cands = [];
  for (const img of images) {
    if (img.type !== 'personnage' || img.vue !== vue || img.exclu || !img.peuple) continue;
    const p = img.peuple;
    if (banned.has(p)) continue;
    let w;
    if (forced) w = p === forced ? 6 : 0;
    else w = peoples.main.includes(p) ? 6 : (peoples.others ?? []).includes(p) ? 1 : 0;
    if (!w) continue;
    const hit = roles.length && (img.roles ?? []).some((r) => roles.includes(r));
    if (roles.length) w *= hit ? 8 : 1;
    if (genre && img.genre && img.genre !== genre) w *= 0.25;
    if (img.pose) w *= 0.3; // assis, couché : seulement faute de mieux
    cands.push({ img, w, hit });
  }
  // Un rôle reconnu l'emporte : on ne garde que les images qui le portent quand il y en a.
  // Sinon, une figure ordinaire (villageois, voyageur, client) : jamais un marchand de pommes pour jouer un garde.
  const hits = cands.filter((c) => c.hit);
  const plain = roles.length ? cands.filter((c) => (c.img.roles ?? []).some((r) => GENERIQUES.has(r))) : cands;
  return weighted(hits.length ? hits : plain, `${seed}|${vue}`);
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
  const folder = { texture: 'textures', element: 'elements', personnage: 'personnages' }[img.type];
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
