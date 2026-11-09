/**
 * Le monde réagit au temps qui passe : chaque événement de la mémoire du monde a des suites, selon sa nature, le lieu
 * et le temps écoulé. Les petites suites s'appliquent d'elles-mêmes (un cadavre dévoré, la poussière dans une maison
 * délaissée, la rumeur qui court) ; les grosses sont proposées au MJ, qui les accepte ou les refuse (un bâtiment
 * reconstruit, un PNJ qui garde rancune ou reconnaissance, une enquête de la milice).
 *
 * Toujours la même suite pour le même événement (tirages réglés par son identifiant) : avancer le temps en une fois ou en
 * plusieurs fois donne le même monde.
 *
 * JavaScript pur, testé par consequences.test.mjs.
 */
import { DAY, clockOf, stamp, tick } from './clock.js';

/** Graine stable d'un texte → nombre dans [0, 1). */
function rand01(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** Le lieu est-il en pleine nature (piste, forêt, montagne, lieu sauvage), plutôt qu'en ville ou sur une grande route ? */
const wildPlace = (ev) => {
  const t = String(ev.place?.featureId ?? '') + ' ' + String(ev.place?.title ?? '').toLowerCase();
  return /:(sentier|foret|monts|wild|lac)-|piste|forêt|foret|bois|mont|sentier|col\b|marais|grotte/.test(t) && !/:c-|cit[ée]|rue|place|march/.test(t);
};
/** Un bâtiment de cité (emplacement `…:b12`), qui peut brûler, rester en ruine, être rebâti. */
const isBuilding = (ev) => /:b\d+$/.test(String(ev.place?.featureId ?? ''));
const heroesDidIt = (ev) => ev.joueurs === 'auteurs';
const npcOf = (ev) => ev.npcs?.[0];

/**
 * Règles de suites, par nature d'événement. `after` : délai (minutes) après l'événement ; `when` : condition ;
 * `big` : à valider par le MJ ; `pick` : variantes tirées une fois pour toutes ; `state` : état du lieu ou du PNJ.
 */
const RULES = {
  incendie: [
    { id: 'ruine', after: 0, when: isBuilding, big: false, state: { lieu: 'ruine' }, text: (ev) => `${cap(the(ev.place.title))} n’est plus qu’une carcasse noircie ; l’odeur de cendre flotte dans tout le quartier.` },
    { id: 'deblaiement', after: 5 * DAY, when: isBuilding, big: false, state: { lieu: 'ruine' }, text: (ev) => `Les décombres ${ofPlace(ev.place.title)} sont déblayés ; on récupère les pierres et les poutres encore saines.` },
    { id: 'reconstruction', after: 30 * DAY, when: isBuilding, big: true, state: { lieu: 'chantier' }, text: (ev) => `Un chantier s’ouvre sur les ruines ${ofPlace(ev.place.title)} : échafaudages, maçons, charrettes de pierre.` },
    { id: 'reconstruit', after: 150 * DAY, when: isBuilding, big: true, state: { lieu: 'reconstruit' }, text: (ev) => `${newName(ev.place.title)} se dresse sur les ruines de l’ancien bâtiment.` },
  ],
  destruction: [
    { id: 'ruine', after: 0, when: isBuilding, big: false, state: { lieu: 'ruine' }, text: (ev) => `${cap(the(ev.place.title))} est en ruine.` },
    { id: 'reconstruction', after: 45 * DAY, when: isBuilding, big: true, state: { lieu: 'chantier' }, text: (ev) => `On rebâtit ${the(ev.place.title)}.` },
    { id: 'reconstruit', after: 180 * DAY, when: isBuilding, big: true, state: { lieu: 'reconstruit' }, text: (ev) => `${newName(ev.place.title)} a remplacé l’ancien bâtiment.` },
  ],
  // Écrits par le MJ : ils remplacent l'état laissé par un incendie ou une destruction plus ancienne (voir supersededAt).
  chantier: [
    { id: 'chantier', after: 0, when: isBuilding, big: false, state: { lieu: 'chantier' }, text: (ev) => `Un chantier s’est ouvert sur le site ${ofPlace(ev.place.title)} : échafaudages, maçons, charrettes de pierre.` },
  ],
  reconstruction: [
    { id: 'reconstruit', after: 0, when: isBuilding, big: false, state: { lieu: 'reconstruit' }, text: (ev) => `${cap(the(ev.place.title))} est debout de nouveau.` },
  ],
  cadavre: [
    {
      id: 'sort', after: DAY, big: false,
      pick: (ev, r) => (wildPlace(ev)
        ? (r < 0.6 ? 'devore' : r < 0.72 ? 'necro' : 'decouvert')
        : (r < 0.85 ? 'decouvert' : 'necro')),
      text: (ev, v) => ({
        devore: `Le corps laissé ${at(ev)} a été traîné et dévoré par les bêtes : il n’en reste que des os rongés et des lambeaux de tissu.`,
        necro: `Le corps laissé ${at(ev)} a disparu. Des traces de pas, un cercle tracé à la craie, une odeur de bougie noire : quelqu’un l’a emporté.`,
        decouvert: `Des passants ont trouvé le corps laissé ${at(ev)} et prévenu la milice.`,
      })[v],
    },
    { id: 'enquete', after: 2 * DAY, big: true, when: (ev) => heroesDidIt(ev), requires: { sort: 'decouvert' }, state: { enquete: true },
      text: (ev) => `La milice enquête sur le corps trouvé ${at(ev)} ; des témoins décrivent des voyageurs armés passés par là.` },
  ],
  mort: [
    { id: 'rumeur', after: DAY / 2, big: false, text: (ev) => `On ne parle que de la mort ${npcOf(ev) ? `de ${npcOf(ev)}` : 'survenue'}${ev.place ? ` ${at(ev)}` : ''}.` },
    { id: 'proches', after: 2 * DAY, big: true, when: (ev) => heroesDidIt(ev) && !!npcOf(ev), state: { attitude: 'rancune' },
      text: (ev) => `Les proches de ${npcOf(ev)} tiennent les héros pour responsables et réclament justice.` },
  ],
  vol: [
    { id: 'plainte', after: DAY / 2, big: false, when: (ev) => !!npcOf(ev), text: (ev) => `${npcOf(ev)} a porté plainte : on cherche le voleur.` },
    { id: 'rancune', after: DAY, big: true, when: (ev) => heroesDidIt(ev) && !!npcOf(ev), state: { attitude: 'rancune' }, text: (ev) => `${npcOf(ev)} soupçonne les héros et leur garde rancune.` },
  ],
  effraction: [
    { id: 'serrure', after: DAY / 2, big: false, text: (ev) => `${ev.place?.title ? cap(the(ev.place.title)) : 'La maison'} a changé de serrure ; les voisins ferment mieux leurs volets.` },
    { id: 'garde', after: DAY, big: true, when: heroesDidIt, state: { enquete: true }, text: (ev) => `La garde redouble de rondes ${at(ev)} la nuit et interroge les étrangers.` },
  ],
  agression: [
    { id: 'rancune', after: DAY / 4, big: true, when: (ev) => heroesDidIt(ev) && !!npcOf(ev), state: { attitude: 'peur' }, text: (ev) => `${npcOf(ev)} a peur des héros : il les évite, ou les dénonce s’il le peut.` },
  ],
  humiliation: [
    { id: 'rancune', after: DAY / 4, big: true, when: (ev) => !!npcOf(ev), state: { attitude: 'rancune' }, text: (ev) => `${npcOf(ev)} n’a pas digéré l’affront et garde rancune ${heroesDidIt(ev) ? 'aux héros' : 'à ceux qui l’ont humilié'}.` },
  ],
  aide: [
    { id: 'gratitude', after: DAY / 4, big: true, when: (ev) => heroesDidIt(ev) && !!npcOf(ev), state: { attitude: 'reconnaissance' }, text: (ev) => `${npcOf(ev)} est reconnaissant envers les héros et le dit à qui veut l’entendre.` },
  ],
  alliance: [
    { id: 'parole', after: DAY, big: false, when: (ev) => !!npcOf(ev), text: (ev) => `${npcOf(ev)} parle de l’accord passé avec les héros.` },
  ],
  abandon: [
    { id: 'poussiere', after: 7 * DAY, big: false, state: { lieu: 'delaisse' }, text: (ev) => `La poussière recouvre tout ${at(ev)} ; une odeur de renfermé, des toiles d’araignée aux poutres.` },
    {
      id: 'occupants', after: 30 * DAY, big: false, pick: (ev, r) => (r < 0.5 ? 'squat' : r < 0.8 ? 'betes' : 'rien'),
      text: (ev, v) => ({
        squat: `Des squatteurs se sont installés ${at(ev)} : une paillasse, un feu de fortune, des restes de repas.`,
        betes: `Des bêtes ont fait leur nid ${at(ev)} : rats, chats errants, peut-être pire à la cave.`,
        rien: `Le lieu reste vide ${at(ev)}, mais les gamins du quartier racontent qu’il est hanté.`,
      })[v],
    },
  ],
};

/** Toute affaire de gravité notable ou grave où les héros ont joué un rôle fait jaser au bout d'une journée. */
const RUMOR = { id: 'rumeur-ville', after: DAY, big: false, when: (ev) => ev.gravite >= 2 && ev.joueurs !== 'aucun' && ev.kind !== 'mort' && ev.kind !== 'rumeur',
  text: (ev) => `La rumeur court : « ${ev.title} »${ev.joueurs === 'auteurs' ? ', et l’on murmure le nom des héros' : ''}.` };

/* ——— Articles devant un nom de lieu : « le temple », « l’église de Brumeval », « la Chope dorée » ——— */
const MASC = /^(temple|moulin|manoir|entrep[oô]t|atelier|logis|grenier|ch[aâ]teau|donjon|march[ée]|port|pont|puits|four|fournil|corps|cellier|poste|quai|hangar|relais|hameau|bois|lac|mont|monts|col|sentier|chemin|gu[ée]|cimeti[eè]re|sanctuaire|bastion|fort|camp|campement|magasin|comptoir|bureau|palais|beffroi|clocher|hospice|h[oô]tel|tripot|bordel|lavoir|abattoir|chantier|domaine|enclos|verger|jardin|champ|pr[ée]|bosquet)$/i;
const FEM = /^(maison|prison|tour|cour|cit[ée]|halle|halles|fa[cç]on|garnison|maisonn[ée]e)$/i;
const VOWEL = /^[aeiouyàâéèêëîïôöùûh]/i;
/** Le lieu avec son article : « le temple », « l’église de Brumeval », « la Chope dorée ». */
export function the(title = '') {
  const t = String(title).trim();
  const m = /^(le|la|les|l[’'])\s*(.*)$/i.exec(t);
  if (m) return `${m[1].toLowerCase()}${/^l[’']/i.test(m[1]) ? '' : ' '}${m[2]}`;
  const first = t.split(/\s+/)[0] ?? '';
  // Un nom propre seul (« Brumeval ») n'a pas d'article.
  if (first && first[0] === first[0].toUpperCase() && !/\s/.test(t) && !MASC.test(first) && !FEM.test(first) && !/(e|ion|t[ée])$/i.test(first)) return t;
  const word = `${first.charAt(0).toLowerCase()}${first.slice(1)}`;
  const rest = t.slice(first.length);
  if (/^halles$/i.test(first)) return `les ${word}${rest}`;
  if (FEM.test(first) && /^h/i.test(first)) return `la ${word}${rest}`;
  if (VOWEL.test(word)) return `l’${word}${rest}`;
  const fem = FEM.test(first) || (!MASC.test(first) && /(e|ion|t[ée])$/i.test(first));
  return `${fem ? 'la' : 'le'} ${word}${rest}`;
}
/** « du temple », « de l’église », « de la taverne », « des halles ». */
export function ofPlace(title = '') {
  const t = the(title);
  return /^le /.test(t) ? `du ${t.slice(3)}` : /^les /.test(t) ? `des ${t.slice(4)}` : /^(la |l’)/.test(t) ? `de ${t}` : `de ${t}`;
}
/** « au temple », « à l’église », « à la taverne », « aux halles », « à Brumeval ». */
export const atPlace = (title) => { const t = the(title); return /^le /.test(t) ? `au ${t.slice(3)}` : /^les /.test(t) ? `aux ${t.slice(4)}` : `à ${t}`; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const at = (ev) => (ev.place?.title ? atPlace(ev.place.title) : 'là-bas');
/** « Église de Brumeval » → « Nouvelle église de Brumeval ». */
export function newName(title = '') {
  const t = String(title).trim();
  if (/^nouvel/i.test(t)) return t;
  const first = t.split(/\s+/)[0]?.toLowerCase() ?? '';
  const fem = /e$|ion$|té$/.test(first) && !/^(temple|moulin|manoir|entrepôt|atelier|logis|grenier)$/.test(first);
  return `${fem ? 'Nouvelle' : /^[aeiouéèêh]/i.test(first) ? 'Nouvel' : 'Nouveau'} ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
}

/**
 * Suites dues pour un événement à l'instant `now` (minutes) : celles qui n'existent pas encore. Chaque suite :
 * { id, at, text, big, state?, status: 'auto' (appliquée) | 'propose' (à valider) }.
 */
export function dueSuites(ev, now) {
  const have = new Map((ev.suites ?? []).map((s) => [s.id, s]));
  const out = [];
  for (const rule of [...(RULES[ev.kind] ?? []), RUMOR]) {
    if (have.has(rule.id)) continue;
    const when = ev.at + rule.after;
    if (when > now) continue;
    if (rule.when && !rule.when(ev)) continue;
    if (rule.requires) {
      const ok = Object.entries(rule.requires).every(([id, v]) => (have.get(id) ?? out.find((s) => s.id === id))?.variant === v);
      if (!ok) continue;
    }
    // Une grosse suite attend que la précédente du même lieu ait été acceptée (pas de reconstruction sans chantier).
    const prevBig = (RULES[ev.kind] ?? []).slice(0, (RULES[ev.kind] ?? []).indexOf(rule)).filter((r) => r.big);
    if (rule.big && prevBig.some((r) => (have.get(r.id) ?? out.find((s) => s.id === r.id))?.status !== 'accepte' && (!r.when || r.when(ev)))) continue;
    const variant = rule.pick ? rule.pick(ev, rand01(`${ev.id}:${rule.id}`)) : undefined;
    out.push({ id: rule.id, at: when, text: rule.text(ev, variant), big: !!rule.big, ...(variant ? { variant } : {}), ...(rule.state ? { state: rule.state } : {}), status: rule.big ? 'propose' : 'auto' });
  }
  return out;
}

/** Natures qui fixent l'état d'un bâtiment : la plus récente l'emporte sur les plus anciennes. */
const SHAPES_PLACE = new Set(['incendie', 'destruction', 'chantier', 'reconstruction', 'abandon']);
/**
 * Instant où un événement est remplacé par un plus récent sur le même lieu (un incendie, puis « on l'a reconstruit ») :
 * ses suites s'arrêtent là. Infinity : il ne l'est pas.
 */
export function supersededAt(world, ev) {
  if (!SHAPES_PLACE.has(ev.kind) || !ev.place?.featureId) return Infinity;
  const later = (world.events ?? []).filter((o) => o !== ev && o.id !== ev.id && SHAPES_PLACE.has(o.kind) && o.place?.featureId === ev.place.featureId && o.at > ev.at);
  return later.length ? Math.min(...later.map((o) => o.at)) : Infinity;
}

/** Le monde, avec les suites dues à l'instant présent ajoutées à ses événements. Renvoie { world, fresh } (nouvelles suites). */
export function evolve(world) {
  const now = stamp(clockOf(world));
  const fresh = [];
  const events = (world.events ?? []).map((ev) => {
    // Remplacé par un événement plus récent du même lieu : plus aucune suite au-delà (pas de chantier sur un temple
    // déjà reconstruit à la main).
    const until = supersededAt(world, ev);
    const add = dueSuites(ev, Math.min(now, until - 1));
    if (!add.length) return ev;
    fresh.push(...add.map((s) => ({ ...s, eventId: ev.id })));
    return { ...ev, suites: [...(ev.suites ?? []), ...add] };
  });
  return { world: fresh.length ? { ...world, events } : world, fresh };
}

/** Le temps passe (`minutes`) et le monde réagit : l'horloge avance, les suites dues s'ajoutent. */
export function passTime(world, minutes) {
  return evolve(tick(world, minutes)).world;
}

/** Décision du MJ sur une suite proposée : 'accepte' ou 'refuse'. Une suite acceptée peut en débloquer d'autres. */
export function decide(world, eventId, suiteId, status) {
  // L'instant de la décision compte pour le « depuis votre dernier passage » : un chantier accepté hier est une nouvelle.
  const decidedAt = stamp(clockOf(world));
  const events = (world.events ?? []).map((ev) => (ev.id !== eventId ? ev : { ...ev, suites: (ev.suites ?? []).map((s) => (s.id === suiteId ? { ...s, status, decidedAt } : s)) }));
  return evolve({ ...world, events }).world;
}

/** Suites en attente du MJ, de la plus ancienne à la plus récente. */
export function pending(world) {
  // Une suite d'un événement remplacé depuis (le temple a été reconstruit à la main) n'est plus à décider.
  return (world.events ?? []).flatMap((ev) => { const until = supersededAt(world, ev); return (ev.suites ?? []).filter((s) => s.status === 'propose' && s.at < until).map((s) => ({ ...s, eventId: ev.id, event: ev })); }).sort((a, b) => a.at - b.at);
}

/* ——— Ce qui en découle pour la carte et pour les PNJ ——— */

const applied = (s) => s.status === 'auto' || s.status === 'accepte';

/** État de chaque lieu touché : { [featureId]: { etat: 'ruine' | 'chantier' | 'reconstruit' | 'delaisse', depuis, title, eventId } }. */
export function placeStates(world) {
  const out = {};
  for (const ev of [...(world.events ?? [])].sort((a, b) => a.at - b.at)) {
    const fid = ev.place?.featureId;
    if (!fid) continue;
    const until = supersededAt(world, ev);
    for (const s of (ev.suites ?? []).filter((x) => applied(x) && x.state?.lieu && x.at < until).sort((a, b) => a.at - b.at)) {
      out[fid] = { etat: s.state.lieu, depuis: s.at, title: ev.place.title, eventId: ev.id };
    }
  }
  return out;
}

/** Ce dont un PNJ se souvient et ce qu'il ressent pour les héros : { attitude?, souvenirs: string[] } par nom (minuscules). */
export function npcMemories(world) {
  const out = {};
  const key = (n) => String(n).toLowerCase().trim();
  for (const ev of [...(world.events ?? [])].sort((a, b) => a.at - b.at)) {
    for (const n of ev.npcs ?? []) {
      const m = (out[key(n)] ??= { souvenirs: [] });
      m.souvenirs.push(ev.title + (ev.joueurs !== 'aucun' ? ` (${{ auteurs: 'à cause des héros', temoins: 'devant les héros', victimes: 'aux dépens des héros' }[ev.joueurs]})` : ''));
      for (const s of (ev.suites ?? []).filter((x) => applied(x) && x.state?.attitude && ev.npcs?.[0] === n)) m.attitude = s.state.attitude;
    }
  }
  return out;
}

/** Rumeurs qui courent dans une cité : suites « rumeur » appliquées d'événements de ses plans, les plus récentes d'abord. */
export function rumorsIn(world, cityPlanId) {
  return (world.events ?? [])
    .filter((ev) => ev.place?.planId && ev.place.planId.startsWith(cityPlanId))
    .flatMap((ev) => (ev.suites ?? []).filter((s) => applied(s) && /rumeur/.test(s.id)).map((s) => ({ at: s.at, text: s.text })))
    .sort((a, b) => b.at - a.at);
}

export const ATTITUDE_LABEL = { rancune: 'garde rancune aux héros', peur: 'a peur des héros', reconnaissance: 'est reconnaissant envers les héros' };
export const PLACE_STATE_LABEL = { ruine: 'en ruine', chantier: 'en reconstruction', reconstruit: 'reconstruit', delaisse: 'délaissé' };
