/**
 * Mémoire du monde : ce qui s'est passé, daté (horloge du monde) et situé (lieu, PNJ touchés), avec l'implication des
 * joueurs et sa gravité. C'est la base des conséquences (lot C : le monde réagit au temps qui passe) et du « depuis
 * votre dernier passage » (lot E).
 *
 * Les événements viennent du MJ (à la main), du jeu (combat, effraction…), ou de ses notes de séance lues par l'IA :
 * l'IA propose, le MJ coche ce qui est vrai, rien ne s'inscrit sans lui.
 *
 * JavaScript pur, testé par worldEvents.test.mjs.
 */
import { DAY, clockLabel, elapsedLabel, stamp } from './clock.js';

/** Natures d'événement : libellé et pictogramme. */
export const EVENT_KINDS = {
  incendie: { label: 'Incendie', icon: '🔥' },
  destruction: { label: 'Destruction', icon: '🏚' },
  mort: { label: 'Mort', icon: '☠' },
  cadavre: { label: 'Cadavre laissé', icon: '⚰' },
  vol: { label: 'Vol', icon: '💰' },
  effraction: { label: 'Effraction', icon: '🚪' },
  agression: { label: 'Agression', icon: '⚔' },
  humiliation: { label: 'Humiliation', icon: '😠' },
  aide: { label: 'Aide, service rendu', icon: '🤝' },
  alliance: { label: 'Accord, alliance', icon: '📜' },
  abandon: { label: 'Lieu délaissé', icon: '🕸' },
  decouverte: { label: 'Découverte', icon: '🔎' },
  rumeur: { label: 'Rumeur', icon: '🗣' },
  autre: { label: 'Autre', icon: '•' },
};
/** Implication des joueurs. */
export const ROLES = { auteurs: 'Les héros en sont les auteurs', temoins: 'Les héros en ont été témoins', victimes: 'Les héros en ont été victimes', aucun: 'Sans les héros' };
export const GRAVITY = { 1: 'Mineur', 2: 'Notable', 3: 'Grave' };

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();

/** Nouvel événement, daté à l'horloge du monde (ou `hoursAgo` heures plus tôt). */
export function newEvent(clock, e, id) {
  const at = Math.max(0, stamp(clock) - Math.max(0, Number(e.hoursAgo) || 0) * 60);
  return {
    id: id ?? `ev-${Math.round(at)}-${Math.random().toString(36).slice(2, 7)}`,
    at, title: String(e.title ?? '').trim() || 'Événement',
    ...(e.text ? { text: String(e.text).trim() } : {}),
    kind: EVENT_KINDS[e.kind] ? e.kind : 'autre',
    ...(e.place ? { place: e.place } : {}),
    ...(e.npcs?.length ? { npcs: e.npcs.map((n) => String(n).trim()).filter(Boolean) } : {}),
    joueurs: ROLES[e.joueurs] ? e.joueurs : 'aucun',
    gravite: [1, 2, 3].includes(Number(e.gravite)) ? Number(e.gravite) : 2,
    source: e.source ?? 'mj',
  };
}

/** Date d'un événement : « Jour 3 · 22 h 10 » et, par rapport à maintenant, « il y a 2 jours ». */
export function eventWhen(ev, clock) {
  const day = Math.floor(ev.at / DAY) + 1, minute = ev.at - (day - 1) * DAY;
  return { label: clockLabel({ day, minute }), ago: `il y a ${elapsedLabel(ev.at, stamp(clock))}` };
}

/** Événements triés, le plus récent d'abord ; `planIds` : seulement ceux de ces plans (une cité et ses bâtiments). */
export function eventsOf(world, planIds) {
  const list = [...(world?.events ?? [])].sort((a, b) => b.at - a.at);
  return planIds ? list.filter((e) => e.place && planIds.some((p) => e.place.planId === p || e.place.planId?.startsWith(`${p}:`))) : list;
}

/* ——— Notes de séance → événements proposés (IA) ——— */

/**
 * Invite pour l'IA : lire les notes de séance du MJ et en tirer les événements qui changent le monde. `places` et
 * `npcs` : noms connus (pour qu'elle les reprenne tels quels) ; `now` : libellé de l'horloge.
 */
export function eventsPrompt(notes, { places = [], npcs = [], now = '' } = {}) {
  const system = [
    'Tu aides un maître du jeu de Donjons et Dragons à tenir la mémoire de son monde.',
    'À partir de ses notes de séance, liste les événements qui changent le monde ou que les gens retiendront :',
    'bâtiment incendié ou détruit, mort, cadavre abandonné, vol, effraction, agression, humiliation publique, aide rendue, accord conclu, découverte, rumeur lancée, lieu délaissé.',
    'Ignore le reste (combats sans suite, discussions, achats ordinaires). N’invente rien qui ne soit pas dans les notes.',
    `Natures permises : ${Object.keys(EVENT_KINDS).join(', ')}. Implication des héros : auteurs, temoins, victimes ou aucun. Gravité : 1 (mineur), 2 (notable), 3 (grave).`,
    'Pour le lieu et les PNJ, reprends exactement un nom de la liste fournie quand il correspond ; sinon, le nom des notes.',
    'Réponds en français, en JSON : {"events":[{"title":"…","text":"…","kind":"…","place":"…","npcs":["…"],"joueurs":"…","gravite":2,"hoursAgo":0}]}.',
    '« title » : une phrase courte au passé (« L’église de Brumeval a brûlé »). « hoursAgo » : il y a combien d’heures, par rapport à maintenant (0 si inconnu).',
  ].join('\n');
  const user = [
    now && `Maintenant : ${now}.`,
    places.length && `Lieux connus : ${places.slice(0, 120).join(' ; ')}.`,
    npcs.length && `PNJ connus : ${npcs.slice(0, 120).join(' ; ')}.`,
    `Notes de séance :\n${String(notes).slice(0, 8000)}`,
  ].filter(Boolean).join('\n\n');
  return { system, user };
}

/**
 * Réponse de l'IA → événements proposés (pas encore inscrits). `places` : [{ title, planId, featureId }] pour rattacher un
 * lieu nommé à la carte. Tolère un JSON entouré de texte ; ignore ce qui est mal formé.
 */
export function parseEvents(text, places = []) {
  const m = /\{[\s\S]*\}/.exec(String(text ?? ''));
  if (!m) return [];
  let data;
  try { data = JSON.parse(m[0]); } catch { return []; }
  const list = Array.isArray(data?.events) ? data.events : [];
  const byName = places.map((p) => ({ ...p, n: norm(p.title) })).filter((p) => p.n.length >= 3);
  return list.filter((e) => e && typeof e.title === 'string' && e.title.trim()).slice(0, 30).map((e) => {
    const pn = norm(e.place);
    const hit = pn ? byName.find((p) => p.n === pn) ?? byName.filter((p) => pn.includes(p.n) || p.n.includes(pn)).sort((a, b) => b.n.length - a.n.length)[0] : null;
    return {
      title: e.title.trim().slice(0, 160), text: typeof e.text === 'string' ? e.text.trim().slice(0, 600) : undefined,
      kind: EVENT_KINDS[e.kind] ? e.kind : 'autre',
      place: hit ? { planId: hit.planId, featureId: hit.featureId, title: hit.title } : e.place ? { title: String(e.place).slice(0, 80) } : undefined,
      npcs: Array.isArray(e.npcs) ? e.npcs.filter((n) => typeof n === 'string').slice(0, 8) : undefined,
      joueurs: ROLES[e.joueurs] ? e.joueurs : 'aucun',
      gravite: [1, 2, 3].includes(Number(e.gravite)) ? Number(e.gravite) : 2,
      hoursAgo: Math.max(0, Math.min(24 * 30, Number(e.hoursAgo) || 0)),
      source: 'notes',
    };
  });
}
