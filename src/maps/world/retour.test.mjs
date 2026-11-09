/** Le retour des héros : ce qui a changé depuis leur dernier passage, pour le MJ et pour les joueurs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { visitKeys, arrive, changesSince } from './retour.js';
import { newEvent } from './worldEvents.js';
import { passTime, decide } from './consequences.js';

const city = 'map-r-c-brumeval';

test('lieux où l’on revient : la cité, et le bâtiment', () => {
  assert.deepEqual(visitKeys(city), [city]);
  assert.deepEqual(visitKeys(`${city}:b12:int:e1`), [city, `${city}:b12`]);
  assert.deepEqual(visitKeys('map-r-monde'), []);
});

test('revenir à Brumeval un mois plus tard : le MJ voit tout, les joueurs ce qui se voit et se raconte', () => {
  let w = { clock: { day: 1, minute: 600, seasonDay: 0 } };
  // Premier passage, puis départ.
  w = { ...w, ...arrive(w, city, undefined) };
  w = { ...w, ...arrive(w, 'map-r-monde', city) };
  // Pendant leur absence : l'incendie du temple qu'ils ont allumé en partant, et une humiliation.
  const fire = newEvent(w.clock, { title: 'Le temple a brûlé', kind: 'incendie', joueurs: 'auteurs', gravite: 3, place: { planId: city, featureId: `${city}:b7`, title: 'Temple' } }, 'f');
  const shame = newEvent(w.clock, { title: 'Garin humilié', kind: 'humiliation', joueurs: 'auteurs', npcs: ['Garin'], place: { planId: city, title: 'Place du marché' } }, 'h');
  w = passTime({ ...w, events: [fire, shame] }, 40 * 1440);
  w = decide(w, 'h', 'rancune', 'accepte');
  const back = arrive(w, `${city}:b3:int`, 'map-r-monde');
  assert.ok(back.retour, 'un récit du retour');
  assert.equal(back.retour.key, city);
  assert.match(back.retour.ago, /mois|jours/);
  assert.ok(back.retour.dm.some((l) => /carcasse noircie/.test(l)));
  assert.ok(back.retour.dm.some((l) => /Garin garde rancune/.test(l)));
  assert.ok(back.retour.players.some((l) => /carcasse noircie/.test(l)), 'la ruine se voit');
  assert.ok(!back.retour.players.some((l) => /garde rancune/.test(l)), 'les sentiments restent au MJ');
  // Les passages sont notés pour la cité et le bâtiment.
  assert.ok(back.visits[city] && back.visits[`${city}:b3`]);
});

test('pas de récit pour un aller-retour de quelques heures, ni pour un premier passage', () => {
  const w = { clock: { day: 1, minute: 600 } };
  assert.equal(arrive(w, city).retour, undefined);
  const again = { ...w, visits: { [city]: 560 } };
  assert.equal(arrive(again, city).retour, undefined);
  assert.deepEqual(changesSince({ events: [] }, city, 0, 10), { dm: [], players: [] });
});

test('un chantier accepté pendant l’absence des héros est une nouvelle à leur retour', () => {
  let w = { clock: { day: 1, minute: 600, seasonDay: 0 } };
  const fire = newEvent(w.clock, { title: 'Le temple a brûlé', kind: 'incendie', joueurs: 'temoins', gravite: 3, place: { planId: city, featureId: `${city}:b7`, title: 'Temple' } }, 'f');
  w = passTime({ ...w, events: [fire] }, 40 * 1440);
  w = { ...w, ...arrive(w, city) };
  w = { ...w, ...arrive(w, 'map-r-monde', city) };
  w = passTime(w, 2 * 1440);
  w = decide(w, 'f', 'reconstruction', 'accepte');
  w = passTime(w, 1440);
  const back = arrive(w, city, 'map-r-monde');
  assert.ok(back.retour?.players.some((l) => /chantier/.test(l)), JSON.stringify(back.retour));
});
