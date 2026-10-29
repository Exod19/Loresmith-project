/**
 * Chroniques du Combat : choix d'une narration après la résolution d'une attaque.
 *
 * Les narrations décrivent ; elles ne décident jamais. Le moteur de règles a déjà tranché (touché, raté, critique,
 * dégâts, mort) quand ce module choisit une phrase, et rien de ce qu'il renvoie ne modifie le combat.
 *
 * Module pur (aucune dépendance au navigateur) : testé avec `node --test`. Le hasard est injectable (`rng`).
 */

export const RESULTS = ['miss', 'hit', 'critical_fail', 'critical_hit', 'killing_blow', 'legendary'];
export const WEAPONS = ['axe', 'sword', 'dagger', 'mace', 'hammer', 'spear', 'bow', 'crossbow', 'staff', 'unarmed', 'spell'];
export const ANATOMIES = ['flesh', 'skeletal', 'fungal', 'arthropod', 'stone', 'scaled', 'amorphous', 'incorporeal'];
export const DAMAGE_TYPES = ['fire', 'cold', 'lightning', 'necrotic', 'radiant', 'acid', 'force', 'psychic', 'poison', 'sonic'];
const TONES = ['epic', 'heroic', 'comedic', 'sarcastic', 'dark', 'absurd'];
const RARITIES = ['common', 'uncommon', 'rare', 'legendary'];
const LIGHT_TONES = new Set(['comedic', 'sarcastic', 'absurd']);
/** Conditions que le moteur sait évaluer. Toute autre condition rend l'entrée inéligible. */
const KNOWN_CONDITIONS = new Set([
  'isKillingBlow', 'isCriticalHit', 'targetIsBoss', 'lastEnemy', 'attackerHealthBand', 'maxCombatRound', 'minConsecutiveMisses',
  'minConsecutiveHits', 'environment', 'weather', 'lighting', 'allyDown', 'targetHitAttackerLastRound',
]);

const DEFAULT_POLICY = {
  antiRepeatRecentIds: 40,
  rarityWeights: { common: 100, uncommon: 35, rare: 8, legendary: 1 },
  toneWeights: { epic: 35, heroic: 15, comedic: 20, sarcastic: 10, dark: 12, absurd: 8 },
};

/* ——— Chargement : validation et nettoyage, sans jamais planter ——— */

/** Type de dégâts anglais écrit tel quel dans certaines phrases (« Le sort de fire ») → français. */
const SPELL_OF = { fire: 'de feu', cold: 'de froid', lightning: 'de foudre', necrotic: 'nécrotique', radiant: 'radiant', acid: 'd’acide', force: 'de force', psychic: 'psychique', poison: 'de poison', sonic: 'de tonnerre' };

/** Raison pour laquelle une entrée est invalide, ou null. */
export function invalidReason(e) {
  if (!e || typeof e !== 'object') return 'entrée vide';
  if (typeof e.id !== 'string' || !e.id) return 'id manquant';
  if (!RESULTS.includes(e.result)) return `résultat inconnu « ${e.result} »`;
  if (typeof e.text !== 'string' || !e.text.trim()) return 'texte manquant';
  const unknown = (e.text.match(/\{(\w+)\}/g) || []).filter((p) => p !== '{attacker}' && p !== '{target}');
  if (unknown.length) return `variable inconnue ${unknown[0]}`;
  if (/[{}]/.test(e.text.replace(/\{(attacker|target)\}/g, ''))) return 'accolade orpheline';
  if (!e.tags || typeof e.tags !== 'object') return 'étiquettes manquantes';
  for (const k of ['weapons', 'creatures', 'anatomies']) if (!Array.isArray(e.tags[k]) || !e.tags[k].length) return `étiquette ${k} manquante`;
  if (e.tags.damageTypes !== undefined && !Array.isArray(e.tags.damageTypes)) return 'damageTypes invalide';
  if (e.conditions !== undefined && (typeof e.conditions !== 'object' || Array.isArray(e.conditions))) return 'conditions invalides';
  if (e.tone !== undefined && !TONES.includes(e.tone)) return `tonalité inconnue « ${e.tone} »`;
  if (e.rarity !== undefined && !RARITIES.includes(e.rarity)) return `rareté inconnue « ${e.rarity} »`;
  if ((e.result === 'killing_blow' || e.result === 'legendary') && e.conditions?.isKillingBlow !== true) return 'coup fatal sans isKillingBlow';
  return null;
}

/** Arme que le texte nomme pour l'attaquant (« La hache de {attacker} »), même si l'étiquette dit « any ». */
const WEAPON_WORDS = [
  ['axe', 'hache'], ['sword', 'épée|cimeterre|rapière'], ['dagger', 'dague|poignard'], ['mace', 'masse d’armes|masse|morgenstern|fléau'],
  ['hammer', 'marteau'], ['spear', 'lance|javeline|pique'], ['bow', 'flèche|arc'], ['crossbow', 'arbalète|carreau'], ['staff', 'bâton'],
  ['unarmed', 'poings?'], ['blade', 'lame'],
];
function impliedWeapons(text) {
  const found = new Set();
  for (const [kind, words] of WEAPON_WORDS) {
    const near = new RegExp(`(?:\\b(?:la|le|l’|une|un|sa|son|ses)\\s*)(?:${words})s?\\s+(?:de|d’)\\s*\\{attacker\\}|\\{attacker\\}[^.;]{0,40}\\b(?:sa|son|ses)\\s+(?:${words})\\b`, 'i');
    if (near.test(text)) found.add(kind);
  }
  if (found.has('blade')) { found.delete('blade'); ['sword', 'dagger', 'axe'].forEach((w) => found.add(w)); }
  if (/\b(?:magie|sort|énergie de l’attaque magique|attaque magique)\b[^.]{0,30}\{attacker\}/i.test(text)) found.add('spell');
  if (/arme enchantée/i.test(text)) ['axe', 'sword', 'dagger', 'mace', 'hammer', 'spear', 'bow', 'crossbow', 'staff'].forEach((w) => found.add(w));
  return [...found];
}

/** Coup « à mains nues » qui suppose des mains ou des pieds humains. */
const BODY_WEAPON = /\b(poings?|mains? nues|coude|genou|pied|paume|phalanges)\b/i;

/** Ce que le texte suppose du corps de la cible : sang, os, chair. */
const BLOOD = /\b(sang|sanglant|sanglante|saign|hémorrag|plaie|écarlate)/i;
const BONE = /\b(os|côtes?|crâne|vertèbres?|fémur|squelette|ossements)\b/i;
const FLESH = /\b(chair|muscles?|peau|tendons?|entrailles)\b/i;
/** Ce que chaque anatomie interdit dans une phrase générique (« any »). */
const FORBIDDEN = {
  flesh: [],
  skeletal: [BLOOD, FLESH],
  fungal: [BLOOD, BONE],
  arthropod: [BONE],
  stone: [BLOOD, BONE, FLESH],
  scaled: [],
  amorphous: [BLOOD, BONE, FLESH],
  incorporeal: [BLOOD, BONE, FLESH],
};

/** Prépare la bibliothèque : entrées valides (nettoyées), entrées rejetées avec leur raison, compte par collection. */
export function buildLibrary(collections, manifest = {}) {
  const entries = [];
  const invalid = [];
  const counts = {};
  const seenIds = new Set(), seenTexts = new Set();
  for (const [name, file] of Object.entries(collections)) {
    const list = Array.isArray(file?.entries) ? file.entries : [];
    counts[name] = 0;
    for (const raw of list) {
      const why = invalidReason(raw);
      if (why) { invalid.push({ id: raw?.id ?? '?', collection: name, reason: why }); continue; }
      if (seenIds.has(raw.id)) { invalid.push({ id: raw.id, collection: name, reason: 'id dupliqué' }); continue; }
      const text = raw.text.replace(/\b(sort)\s+de\s+(fire|cold|lightning|necrotic|radiant|acid|force|psychic|poison|sonic)\b/gi, (_, s, t) => `${s} ${SPELL_OF[t.toLowerCase()]}`);
      if (seenTexts.has(text)) { invalid.push({ id: raw.id, collection: name, reason: 'texte dupliqué' }); continue; }
      seenIds.add(raw.id); seenTexts.add(text);
      counts[name]++;
      entries.push({
        ...raw, text, collection: raw.collection ?? name,
        tone: raw.tone ?? 'epic', rarity: raw.rarity ?? 'common', length: raw.length ?? 'short', conditions: raw.conditions ?? {},
        implied: impliedWeapons(text),
        body: { blood: BLOOD.test(text), bone: BONE.test(text), flesh: FLESH.test(text) },
      });
    }
  }
  const policy = { ...DEFAULT_POLICY, ...(manifest.selectionPolicy || {}) };
  return { entries, invalid, counts, policy, expected: manifest.collections || {} };
}

/* ——— Contexte du coup : identités canoniques ——— */

/** Famille d'arme d'une attaque, d'après son nom et sa description (null : attaque naturelle, morsure, griffe…). */
export function weaponKindOf(attack) {
  const t = `${attack?.name || ''} ${attack?.type || ''}`.toLowerCase();
  if (/sort|cantrip|trait mystique|rayon|onde|magique|incantation|boule de feu|projectile magique/.test(t)) return 'spell';
  if (/arbal[eè]te/.test(t)) return 'crossbow';
  if (/\barc\b|arc long|arc court/.test(t)) return 'bow';
  if (/hache/.test(t)) return 'axe';
  if (/dague|poignard/.test(t)) return 'dagger';
  if (/marteau/.test(t)) return 'hammer';
  if (/masse|morgenstern|fl[ée]au|massue|gourdin/.test(t)) return 'mace';
  if (/lance|javeline|pique|trident|coutille/.test(t)) return 'spear';
  if (/b[aâ]ton/.test(t)) return 'staff';
  if (/[ée]p[ée]e|cimeterre|rapi[eè]re|sabre|lame|attaque principale/.test(t)) return 'sword';
  if (/poing|mains nues|coup de pied|unarmed/.test(t)) return 'unarmed';
  return null;
}

/** Créature canonique (étiquette du pack) d'une fiche SRD du bestiaire. */
const CREATURE_OF = {
  skeleton: 'skeleton', zombie: 'zombie', goblin: 'goblin', 'goblin-boss': 'goblin', orc: 'orc', drow: 'drow', duergar: 'duergar',
  'giant-spider': 'giant_spider', 'gray-ooze': 'ooze', 'ochre-jelly': 'ooze', 'gelatinous-cube': 'ooze', shadow: 'ghost',
  wolf: 'beast', 'dire-wolf': 'beast', 'brown-bear': 'beast', 'giant-lizard': 'beast', worg: 'beast', 'bat-swarm': 'beast',
};
const ANATOMY_OF = {
  skeleton: 'skeletal', 'gray-ooze': 'amorphous', 'ochre-jelly': 'amorphous', 'gelatinous-cube': 'amorphous', shadow: 'incorporeal',
  'giant-spider': 'arthropod', 'giant-centipede': 'arthropod', 'violet-fungus': 'fungal', shrieker: 'fungal', 'giant-lizard': 'scaled',
};
export function creatureOf(statId) { return (statId && CREATURE_OF[statId]) || null; }
/** Anatomie de la cible : la fiche SRD, sinon le type (« Mort-vivant », « Vase »…), sinon la chair. */
export function anatomyOf(statId, meta = '') {
  if (statId && ANATOMY_OF[statId]) return ANATOMY_OF[statId];
  const m = String(meta).toLowerCase();
  if (/vase|gelée/.test(m)) return 'amorphous';
  if (/plante|champignon/.test(m)) return 'fungal';
  if (/artificiel|golem|construct/.test(m)) return 'stone';
  if (/dragon/.test(m)) return 'scaled';
  return 'flesh';
}
/** Type de dégâts du pack (5e « thunder » = « sonic »), depuis un type français ou anglais. */
export function damageTypeOf(type) {
  const t = String(type || '').toLowerCase();
  if (!t) return null;
  if (/feu|fire/.test(t)) return 'fire';
  if (/froid|cold/.test(t)) return 'cold';
  if (/foudre|lightning/.test(t)) return 'lightning';
  if (/nécro|necro/.test(t)) return 'necrotic';
  if (/radiant/.test(t)) return 'radiant';
  if (/acide|acid/.test(t)) return 'acid';
  if (/force/.test(t)) return 'force';
  if (/psych/.test(t)) return 'psychic';
  if (/poison/.test(t)) return 'poison';
  if (/tonnerre|thunder|sonic/.test(t)) return 'sonic';
  return null;
}

/**
 * Classe narrative d'une attaque résolue. Seul le moteur de règles fournit ces faits.
 * Un coup fatal exige une cible réellement tombée (et pas un héros à 0 PV, qui n'est qu'inconscient).
 */
export function classify(f) {
  if (f.fumble) return 'critical_fail';
  if (!f.hit) return 'miss';
  if (f.isKillingBlow && f.crit && f.targetIsBoss) return 'legendary';
  if (f.isKillingBlow) return 'killing_blow';
  if (f.crit) return 'critical_hit';
  return 'hit';
}

/* ——— Sélection ——— */

function conditionHolds(key, want, ctx) {
  if (!KNOWN_CONDITIONS.has(key)) return false;
  switch (key) {
    case 'isKillingBlow': return ctx.isKillingBlow === want;
    case 'isCriticalHit': return ctx.crit === want;
    case 'targetIsBoss': return ctx.targetIsBoss === want;
    case 'lastEnemy': return ctx.lastEnemy === want;
    case 'allyDown': return ctx.allyDown === want;
    case 'targetHitAttackerLastRound': return ctx.targetHitAttackerLastRound === want;
    case 'attackerHealthBand': return ctx.attackerHealthBand !== undefined && ctx.attackerHealthBand === want;
    case 'maxCombatRound': return typeof ctx.round === 'number' && ctx.round <= want;
    case 'minConsecutiveMisses': return typeof ctx.consecutiveMisses === 'number' && ctx.consecutiveMisses >= want;
    case 'minConsecutiveHits': return typeof ctx.consecutiveHits === 'number' && ctx.consecutiveHits >= want;
    case 'environment': return ctx.environment !== undefined && ctx.environment === want;
    case 'weather': return ctx.weather !== undefined && ctx.weather === want;
    case 'lighting': return ctx.lighting !== undefined && ctx.lighting === want;
    default: return false;
  }
}

/** L'entrée convient-elle à ce coup ? (filtrage strict, dans l'ordre du cahier des charges) */
export function eligible(e, ctx, result, opts = {}) {
  if (e.result !== result) return false;
  // Arme : correspondance exacte ou joker ; un sort n'emprunte jamais une phrase d'arme physique, et inversement.
  const isSpell = ctx.weapon === 'spell';
  const w = e.tags.weapons;
  if (w.includes('spell') !== isSpell && !w.includes('any')) return false;
  // Attaque naturelle (morsure, griffes) : les phrases « à mains nues » qui ne parlent ni de poing ni de mains conviennent.
  const natural = ctx.weapon === null && w.includes('unarmed') && !BODY_WEAPON.test(e.text);
  if (!w.includes('any') && !w.includes(ctx.weapon) && !natural) return false;
  if (w.includes('any') && e.implied.length && !e.implied.includes(ctx.weapon)) return false;
  // Créature et anatomie : exactes ou joker ; jamais d'os ni de sang là où il n'y en a pas.
  const c = e.tags.creatures;
  if (!c.includes('any') && !c.includes(ctx.creature)) return false;
  const a = e.tags.anatomies;
  if (!a.includes('any') && !a.includes(ctx.anatomy)) return false;
  if (a.includes('any')) {
    const banned = FORBIDDEN[ctx.anatomy] ?? FORBIDDEN.amorphous;
    if (banned.some((re) => (re === BLOOD && e.body.blood) || (re === BONE && e.body.bone) || (re === FLESH && e.body.flesh))) return false;
  }
  // Dégâts : seulement le type réellement infligé.
  if (Array.isArray(e.tags.damageTypes) && e.tags.damageTypes.length) {
    if (!ctx.damageType || !e.tags.damageTypes.includes(ctx.damageType)) return false;
  }
  // Environnement : seulement s'il est connu.
  const env = e.tags.environments;
  if (Array.isArray(env) && env.length && !env.includes('any') && !env.includes(ctx.environment)) return false;
  for (const [k, v] of Object.entries(e.conditions || {})) if (!conditionHolds(k, v, ctx)) return false;
  if (opts.humor === false && LIGHT_TONES.has(e.tone)) return false;
  if (opts.short && e.length !== 'short') return false;
  return true;
}

/** Ordre des classes à essayer : la classe exacte d'abord, puis des replis qui ne contredisent jamais les faits. */
const CHAIN = {
  legendary: ['legendary', 'killing_blow'],
  killing_blow: ['killing_blow'],
  critical_hit: ['critical_hit', 'hit'],
  hit: ['hit'],
  critical_fail: ['critical_fail', 'miss'],
  miss: ['miss'],
};

function weightOf(e, ctx, policy) {
  let w = (policy.rarityWeights[e.rarity] ?? 10) * ((policy.toneWeights[e.tone] ?? 10) / 20);
  const grave = ctx.isKillingBlow || ctx.crit || ctx.targetIsBoss || ctx.attackerHealthBand === 'critical';
  if (grave) w *= LIGHT_TONES.has(e.tone) ? 0.5 : e.tone === 'epic' || e.tone === 'heroic' || e.tone === 'dark' ? 1.6 : 1;
  if (Object.keys(e.conditions || {}).some((k) => k !== 'isKillingBlow')) w *= 3; // une phrase écrite pour ce contexte précis
  if (!e.tags.creatures.includes('any')) w *= 4; // une phrase écrite pour cette créature
  return Math.max(w, 0.01);
}

/** Repli neutre, toujours vrai mécaniquement (aucune blessure supposée sans dégâts, aucune mort sans mort). */
const FALLBACK = {
  miss: ['L’attaque de {attacker} manque {target}.', '{target} échappe à l’attaque de {attacker}.', 'Le coup de {attacker} ne trouve pas {target}.', '{target} se dérobe ; l’attaque de {attacker} passe à côté.'],
  critical_fail: ['L’attaque de {attacker} part complètement à côté de {target}.', '{attacker} rate {target} de loin.', 'Rien ne va pour {attacker} : l’attaque n’approche même pas {target}.'],
  hit: ['L’attaque de {attacker} atteint {target}.', '{attacker} touche {target}.', 'Le coup de {attacker} porte contre {target}.', '{target} encaisse l’attaque de {attacker}.'],
  hit_nodamage: ['L’attaque de {attacker} atteint {target}, sans effet apparent.', '{attacker} touche {target}, qui ne semble rien sentir.'],
  critical_hit: ['L’attaque de {attacker} frappe {target} avec une précision redoutable.', '{attacker} trouve l’ouverture parfaite et frappe {target} de plein fouet.', 'Un coup magistral : {attacker} atteint {target} là où ça compte.'],
  killing_blow: ['{target} s’effondre sous l’attaque de {attacker}.', 'Le coup de {attacker} abat {target}.', '{attacker} porte le coup final ; {target} ne se relève pas.'],
  legendary: ['D’un coup que l’on racontera longtemps, {attacker} abat {target}.'],
  // Sorts : la magie, jamais une arme.
  spell_miss: ['Le sort de {attacker} file à côté de {target} et se perd dans l’ombre.', '{target} échappe de justesse à la magie de {attacker}.', 'La magie de {attacker} se disperse sans atteindre {target}.'],
  spell_critical_fail: ['La magie de {attacker} se dérobe et s’éteint loin de {target}.', 'Le sort de {attacker} s’effiloche avant même d’approcher {target}.'],
  spell_hit: ['La magie de {attacker} atteint {target}.', 'Le sort de {attacker} frappe {target}.'],
  spell_critical_hit: ['La magie de {attacker} frappe {target} avec une intensité rare.', 'Le sort de {attacker} atteint {target} de plein fouet, plus fort qu’attendu.', 'Un éclat de puissance pure : le sort de {attacker} trouve {target}.'],
  spell_killing_blow: ['La magie de {attacker} terrasse {target}.', 'Le sort de {attacker} emporte {target}, qui s’effondre.', '{target} cède sous la magie de {attacker} et ne se relève pas.'],
  spell_legendary: ['Dans un dernier déferlement de magie, {attacker} terrasse {target}. On en parlera longtemps.'],
  // Attaques naturelles : morsure, griffes, crocs.
  natural_miss: ['{target} esquive l’assaut de {attacker}.', 'L’assaut de {attacker} ne rencontre que le vide là où se tenait {target}.', '{attacker} se jette sur {target}, qui s’écarte à temps.'],
  natural_critical_fail: ['{attacker} se jette sur {target} et manque son élan de loin.', 'L’assaut de {attacker} part dans le vide, loin de {target}.'],
  natural_hit: ['{attacker} atteint {target} d’un assaut sauvage.', 'L’assaut de {attacker} porte contre {target}.', 'L’assaut de {attacker} trouve {target} sans hésiter.'],
  natural_critical_hit: ['{attacker} fond sur {target} avec une sauvagerie terrible.', 'L’assaut de {attacker} atteint {target} avec une violence inouïe.'],
  natural_killing_blow: ['{attacker} abat {target} d’un dernier assaut.', 'Sous l’assaut de {attacker}, {target} s’effondre.'],
};

/**
 * Choisit une narration. Ne lève jamais d'exception : en dernier recours, un repli neutre.
 * `recent` : identifiants déjà narrés (les plus récents à la fin), exclus tant que d'autres candidats existent.
 */
export function selectNarration(lib, ctx, { recent = [], rng = Math.random, opts = {} } = {}) {
  const result = ctx.result;
  try {
    // Aucun dégât sur un coup au but : jamais de phrase d'impact, un repli neutre.
    if ((result === 'hit' || result === 'critical_hit') && ctx.damage === 0) return fallback('hit_nodamage', result, rng);
    const recentSet = new Set(recent);
    for (const cls of CHAIN[result] ?? []) {
      const pool = lib.entries.filter((e) => eligible(e, ctx, cls, opts));
      if (!pool.length) continue;
      let fresh = pool.filter((e) => !recentSet.has(e.id));
      // Bassin épuisé : on réintroduit d'abord les plus anciens.
      if (!fresh.length) {
        const order = new Map(recent.map((id, i) => [id, i]));
        const oldest = Math.min(...pool.map((e) => order.get(e.id) ?? Infinity));
        fresh = pool.filter((e) => (order.get(e.id) ?? Infinity) === oldest);
      }
      const weights = fresh.map((e) => weightOf(e, ctx, lib.policy));
      const total = weights.reduce((s, x) => s + x, 0);
      let r = rng() * total;
      let pick = fresh[fresh.length - 1];
      for (let i = 0; i < fresh.length; i++) { r -= weights[i]; if (r <= 0) { pick = fresh[i]; break; } }
      return { id: pick.id, text: pick.text, result, collection: pick.collection, tone: pick.tone, rarity: pick.rarity, fallback: false };
    }
    const kind = ctx.weapon === 'spell' ? 'spell_' : ctx.weapon === null ? 'natural_' : '';
    return fallback(FALLBACK[kind + result] ? kind + result : result, result, rng);
  } catch {
    return fallback(result in FALLBACK ? result : 'hit', result, rng);
  }
}

function fallback(key, result, rng) {
  const list = FALLBACK[key] || FALLBACK.hit;
  const text = list[Math.floor(rng() * list.length) % list.length];
  return { id: `fallback:${key}`, text, result, collection: 'fallback', tone: 'neutral', rarity: 'common', fallback: true };
}

/** Remplace {attacker} et {target} par des noms d'affichage. Texte brut : React l'échappe à l'affichage. */
export function renderNarration(text, names) {
  const clean = (s) => String(s ?? '').replace(/[{}]/g, '').trim() || '…';
  const out = String(text).replace(/\{attacker\}/g, clean(names.attacker)).replace(/\{target\}/g, clean(names.target))
    // Contractions avec l'article d'une créature générique : « de le gobelin » → « du gobelin », « à le » → « au ».
    .replace(/\b([dD])e le /g, '$1u ').replace(/\b([dD])e les /g, '$1es ').replace(/(^|[^\p{L}])([àÀ]) le /gu, (_, p, a) => `${p}${a === 'À' ? 'A' : 'a'}u `).replace(/(^|[^\p{L}])([àÀ]) les /gu, (_, p, a) => `${p}${a === 'À' ? 'A' : 'a'}ux `);
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** Féminins du bestiaire SRD de LoreSmith (pour « la vase », « l’araignée géante »). */
const FEMININE = new Set(['giant-spider', 'gray-ooze', 'ochre-jelly', 'shadow', 'bat-swarm', 'violet-fungus']);
/**
 * Nom d'affichage : un héros ou un PNJ garde son nom ; une créature générique (« Gobelin 2 ») devient « le gobelin 2 ».
 */
export function displayName(name, statId, statName) {
  const n = String(name || '').trim();
  if (!statId || !statName || !n.toLowerCase().startsWith(statName.toLowerCase())) return n;
  const base = statName.replace(/\s*\(.*\)\s*$/, '').toLowerCase();
  const rest = n.slice(statName.length);
  const article = /^[aeiouyhâàéèêîïôûœ]/i.test(base) ? 'l’' : FEMININE.has(statId) ? 'la ' : 'le ';
  return `${article}${base}${rest}`;
}

/* ——— Historique (anti-répétition) : identifiants seulement, jamais les phrases ——— */

export function emptyHistory() { return { campaign: [], combats: {} }; }

/** Identifiants récents pour ce combat et cette campagne (les plus anciens d'abord). */
export function recentIds(h, combatKey) {
  const combat = h.combats?.[combatKey]?.ids ?? [];
  return [...new Set([...(h.campaign ?? []), ...combat])];
}

/** Note la narration choisie et les séries de coups. Renvoie un nouvel historique (40 par campagne, 20 par combat). */
export function remember(h, combatKey, n, f) {
  const prev = h.combats?.[combatKey] ?? { ids: [], streaks: {}, hits: [] };
  const isHit = f.result !== 'miss' && f.result !== 'critical_fail';
  const s = prev.streaks?.[f.attackerId] ?? { hits: 0, misses: 0 };
  const streaks = { ...prev.streaks, [f.attackerId]: isHit ? { hits: s.hits + 1, misses: 0 } : { hits: 0, misses: s.misses + 1 } };
  const hits = isHit ? [...(prev.hits ?? []), { from: f.attackerId, to: f.targetId, round: f.round }].slice(-30) : prev.hits ?? [];
  const keep = (list, id, max) => (n.fallback ? list : [...list.filter((x) => x !== id), id].slice(-max));
  const combats = { ...h.combats, [combatKey]: { ids: keep(prev.ids ?? [], n.id, 20), streaks, hits, at: Date.now() } };
  // Garder au plus 10 combats.
  const keys = Object.keys(combats).sort((a, b) => (combats[b].at ?? 0) - (combats[a].at ?? 0)).slice(10);
  for (const k of keys) delete combats[k];
  return { campaign: keep(h.campaign ?? [], n.id, 40), combats };
}

/** Séries de l'attaquant AVANT ce coup, et « la cible l'a frappé au round précédent ». */
export function streakFacts(h, combatKey, attackerId, targetId, round) {
  const c = h.combats?.[combatKey];
  const s = c?.streaks?.[attackerId] ?? { hits: 0, misses: 0 };
  const lastHit = (c?.hits ?? []).some((x) => x.from === targetId && x.to === attackerId && (x.round === round - 1 || x.round === round));
  return { consecutiveHits: s.hits, consecutiveMisses: s.misses, targetHitAttackerLastRound: lastHit };
}

/** Importance d'un résultat, pour l'animation : discrète, marquée ou épique. */
export function importanceOf(result) {
  return result === 'legendary' || result === 'killing_blow' ? 'epic' : result === 'critical_hit' || result === 'critical_fail' ? 'major' : 'minor';
}
