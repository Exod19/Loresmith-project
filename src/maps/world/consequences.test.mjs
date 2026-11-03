/** Le monde réagit au temps qui passe : petites suites seules, grosses suites proposées au MJ. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { passTime, pending, decide, placeStates, npcMemories, rumorsIn, newName, dueSuites } from './consequences.js';
import { newEvent } from './worldEvents.js';

const DAY = 1440;
const start = { clock: { day: 1, minute: 600, seasonDay: 0 } };
const withEvents = (...evs) => ({ ...start, events: evs });

test('une église incendiée : ruine tout de suite, puis chantier et reconstruction proposés au MJ', () => {
  const ev = newEvent(start.clock, { title: 'L’église de Brumeval a brûlé', kind: 'incendie', joueurs: 'auteurs', gravite: 3, place: { planId: 'c', featureId: 'c:b12', title: 'Église de Brumeval' } }, 'e1');
  let w = passTime(withEvents(ev), 1);
  assert.equal(placeStates(w)['c:b12'].etat, 'ruine');
  w = passTime(w, 40 * DAY);
  const p = pending(w);
  assert.deepEqual(p.map((s) => s.id), ['reconstruction']);
  assert.equal(placeStates(w)['c:b12'].etat, 'ruine', 'rien ne change avant la décision du MJ');
  w = decide(w, 'e1', 'reconstruction', 'accepte');
  assert.equal(placeStates(w)['c:b12'].etat, 'chantier');
  w = passTime(w, 120 * DAY);
  w = decide(w, 'e1', 'reconstruit', 'accepte');
  assert.equal(placeStates(w)['c:b12'].etat, 'reconstruit');
  assert.match(w.events[0].suites.find((s) => s.id === 'reconstruit').text, /Nouvelle église de Brumeval/);
  // Rumeur en ville, d'elle-même.
  assert.ok(rumorsIn(w, 'c').some((r) => /héros/.test(r.text)));
});

test('un cadavre laissé sur une piste forestière : son sort est tiré une fois pour toutes', () => {
  const ev = newEvent(start.clock, { title: 'Un brigand mort laissé sur la piste', kind: 'cadavre', joueurs: 'auteurs', place: { planId: 'w', featureId: 'w:sentier-foret-1', title: 'Piste forestière vers la forêt de Vaux' } }, 'c1');
  const a = passTime(withEvents(ev), 2 * DAY);
  const b = passTime(passTime(passTime(withEvents(ev), DAY / 2), DAY), DAY / 2);
  const sortA = a.events[0].suites.find((s) => s.id === 'sort'), sortB = b.events[0].suites.find((s) => s.id === 'sort');
  assert.equal(sortA.variant, sortB.variant, 'même sort, en une ou plusieurs fois');
  assert.equal(sortA.status, 'auto');
  assert.ok(['devore', 'necro', 'decouvert'].includes(sortA.variant));
  // Les règles de nature : en ville, presque toujours découvert ; sur une piste, souvent dévoré.
  let devore = 0;
  for (let i = 0; i < 200; i++) {
    const e = { ...ev, id: `x${i}` };
    if (dueSuites(e, e.at + DAY).find((s) => s.id === 'sort').variant === 'devore') devore++;
  }
  assert.ok(devore > 80 && devore < 160, `dévorés : ${devore}/200`);
});

test('un PNJ humilié garde rancune une fois la suite acceptée ; il s’en souvient', () => {
  const ev = newEvent(start.clock, { title: 'Le forgeron humilié en place publique', kind: 'humiliation', joueurs: 'auteurs', npcs: ['Garin'], gravite: 2 }, 'h1');
  let w = passTime(withEvents(ev), DAY);
  assert.equal(npcMemories(w).garin.attitude, undefined);
  assert.match(npcMemories(w).garin.souvenirs[0], /à cause des héros/);
  w = decide(w, 'h1', 'rancune', 'accepte');
  assert.equal(npcMemories(w).garin.attitude, 'rancune');
  // Refusée : rien ne change.
  const r = decide(passTime(withEvents({ ...ev, id: 'h2' }), DAY), 'h2', 'rancune', 'refuse');
  assert.equal(npcMemories(r).garin.attitude, undefined);
});

test('une maison délaissée prend la poussière, puis d’autres occupants', () => {
  const ev = newEvent(start.clock, { title: 'La maison des héros, laissée vide', kind: 'abandon', place: { planId: 'c', featureId: 'c:b3', title: 'Maison des héros' } }, 'a1');
  const w = passTime(withEvents(ev), 40 * DAY);
  assert.deepEqual(w.events[0].suites.map((s) => s.id), ['poussiere', 'occupants']);
  assert.equal(placeStates(w)['c:b3'].etat, 'delaisse');
  assert.equal(pending(w).length, 0, 'petites suites : aucune décision demandée');
});

test('noms des bâtiments rebâtis', () => {
  assert.equal(newName('Église de Brumeval'), 'Nouvelle église de Brumeval');
  assert.equal(newName('Moulin du gué'), 'Nouveau moulin du gué');
  assert.equal(newName('Entrepôt'), 'Nouvel entrepôt');
});

test('articles devant les noms de lieux', async () => {
  const { the, ofPlace } = await import('./consequences.js');
  assert.equal(the('Temple'), 'le temple');
  assert.equal(the('Église de Brumeval'), 'l’église de Brumeval');
  assert.equal(the('La Chope dorée'), 'la Chope dorée');
  assert.equal(the('Maison du tisserand'), 'la maison du tisserand');
  assert.equal(the('Brumeval'), 'Brumeval');
  assert.equal(ofPlace('Temple'), 'du temple');
  assert.equal(ofPlace('Halles'), 'des halles');
});
