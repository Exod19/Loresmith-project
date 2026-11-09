/**
 * Le retour des héros : en revenant dans une cité (ou un bâtiment) après un temps, le MJ voit ce qui a changé depuis leur
 * dernier passage (événements, suites, PNJ qui s'en souviennent), et les joueurs découvrent ce qui se voit sur place
 * (ruines, chantiers, maisons délaissées) et ce qu'on leur raconte (rumeurs).
 *
 * Les passages sont notés par lieu (`world.visits`, instant de la dernière présence du groupe) : une cité, et chacun de
 * ses bâtiments visités.
 *
 * JavaScript pur, testé par retour.test.mjs.
 */
import { clockOf, elapsedLabel, stamp } from './clock.js';
import { ATTITUDE_LABEL } from './consequences.js';

/** Lieux « où l'on revient » d'un plan : la cité (`…-c-<id>`) et, dans un bâtiment, le bâtiment (`…:b12`). */
export function visitKeys(planId = '') {
  const keys = [];
  const city = /^(.*-c-[^:]+)/.exec(planId)?.[1];
  if (city) keys.push(city);
  const slot = /^(.*:b\d+)(?::int|$)/.exec(planId)?.[1];
  if (slot && slot !== city) keys.push(slot);
  return keys;
}

const applied = (s) => s.status === 'auto' || s.status === 'accepte';
const inPlace = (ev, key) => !!ev.place && ((ev.place.planId ?? '').startsWith(key) || (ev.place.featureId ?? '').startsWith(key));

/**
 * Ce qui a changé dans un lieu entre `from` et `to` (minutes) : { dm: string[], players: string[] }.
 * - MJ : les nouveaux événements, leurs suites appliquées, les PNJ qui en gardent un sentiment ;
 * - joueurs : ce qui se voit (état des bâtiments) et ce qu'on raconte (rumeurs), jamais les sentiments cachés.
 */
export function changesSince(world, key, from, to) {
  const dm = [], players = [];
  // Ce qui s'est passé au moment même du départ compte aussi (un incendie allumé en partant).
  const inWindow = (t) => t >= from && t <= to;
  for (const ev of [...(world?.events ?? [])].sort((a, b) => a.at - b.at)) {
    if (!inPlace(ev, key)) continue;
    if (inWindow(ev.at)) dm.push(`${ev.title}.`);
    // Une suite validée par le MJ compte à l'instant de sa décision (si elle est plus tardive que son échéance).
    const when = (x) => Math.max(x.at, x.decidedAt ?? x.at);
    for (const s of (ev.suites ?? []).filter((x) => applied(x) && inWindow(when(x))).sort((a, b) => when(a) - when(b))) {
      dm.push(s.text);
      // Ce qui se voit sur place (un bâtiment en ruine, un chantier) et ce qu'on raconte (les rumeurs).
      if (s.state?.lieu || /rumeur/.test(s.id)) players.push(s.text);
      if (s.state?.attitude && ev.npcs?.[0]) dm.push(`→ ${ev.npcs[0]} ${ATTITUDE_LABEL[s.state.attitude]}.`);
    }
  }
  return { dm, players };
}

/**
 * Le groupe arrive sur le plan `planId` : notes de passage mises à jour (`visits`) et, s'il revient après au moins
 * `minGap` minutes et que quelque chose a changé, le récit du retour. Renvoie { visits, retour? }.
 * `leaving` : plan quitté (sa note de passage est mise à l'heure aussi).
 */
export function arrive(world, planId, leaving, minGap = 6 * 60) {
  const now = stamp(clockOf(world));
  const visits = { ...(world?.visits ?? {}) };
  for (const k of visitKeys(leaving)) visits[k] = now;
  let retour;
  for (const k of visitKeys(planId)) {
    const last = world?.visits?.[k];
    if (last != null && now - last >= minGap && !retour) {
      const c = changesSince(world, k, last, now);
      if (c.dm.length) retour = { key: k, from: last, to: now, ago: elapsedLabel(last, now), dm: c.dm, players: c.players };
    }
    visits[k] = now;
  }
  return { visits, ...(retour ? { retour } : {}) };
}

