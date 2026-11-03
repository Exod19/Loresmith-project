/** Horloge du monde : la date avance avec les actions du jeu ; moment de la journée et saison en découlent. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { clockOf, tick, periodOf, untilPeriod, clockLabel, elapsedLabel, stamp, DURATIONS } from './clock.js';
import { newEvent, eventWhen, eventsOf, parseEvents, eventsPrompt } from './worldEvents.js';

test('une horloge neuve reprend le moment choisi', () => {
  assert.equal(periodOf(clockOf({ time: 'nuit' }).minute), 'nuit');
  assert.equal(clockOf({}).day, 1);
});

test('voyage, repos et rounds font avancer la date et le moment de la journée', () => {
  let w = { time: 'jour' };
  w = tick(w, 5 * 60); // 5 h de marche depuis 13 h
  assert.equal(clockLabel(w.clock), 'Jour 1 · 18 h 00');
  assert.equal(w.time, 'soir');
  w = tick(w, DURATIONS.reposLong); // jusqu'à 2 h du matin
  assert.equal(w.clock.day, 2);
  assert.equal(w.time, 'nuit');
  w = tick(w, untilPeriod(w, 'matin'));
  assert.equal(clockLabel(w.clock), 'Jour 2 · 6 h 00');
  const before = stamp(w.clock);
  for (let i = 0; i < 10; i++) w = tick(w, DURATIONS.round);
  assert.equal(stamp(w.clock) - before, 1, 'dix rounds = une minute');
});

test('la saison change d’elle-même tous les 91 jours, si le MJ en a choisi une', () => {
  let w = { time: 'jour', season: 'ete' };
  w = tick(w, 61 * 24 * 60); // seasonDay 30 + 61 = 91
  assert.equal(w.season, 'automne');
  w = tick(w, 2 * 91 * 24 * 60);
  assert.equal(w.season, 'printemps');
  assert.equal(tick({ time: 'jour' }, 200 * 24 * 60).season, undefined, 'sans saison choisie, rien n’est imposé');
});

test('temps écoulé en mots', () => {
  assert.equal(elapsedLabel(0, 45), '45 min');
  assert.equal(elapsedLabel(0, 5 * 60), '5 h');
  assert.equal(elapsedLabel(0, 3 * 1440), '3 jours');
  assert.equal(elapsedLabel(0, 180 * 1440), '6 mois');
});

test('événements : datés, situés, triés ; notes de séance lues sans rien inventer', () => {
  const clock = { day: 4, minute: 22 * 60 };
  const a = newEvent(clock, { title: 'L’église a brûlé', kind: 'incendie', joueurs: 'auteurs', gravite: 3, hoursAgo: 2 }, 'a');
  const b = newEvent(clock, { title: 'Un cadavre sur la piste', kind: 'cadavre', place: { planId: 'monde', title: 'Piste' } }, 'b');
  assert.equal(eventWhen(a, clock).label, 'Jour 4 · 20 h 00');
  assert.equal(eventWhen(a, clock).ago, 'il y a 2 h');
  assert.deepEqual(eventsOf({ events: [a, b] }).map((e) => e.id), ['b', 'a']);
  assert.deepEqual(eventsOf({ events: [a, b] }, ['monde']).map((e) => e.id), ['b']);
  const { system, user } = eventsPrompt('Les héros ont mis le feu à l’église.', { places: ['Église de Brumeval'], now: 'Jour 4' });
  assert.match(system, /JSON/);
  assert.match(user, /Église de Brumeval/);
  const got = parseEvents('Voici : {"events":[{"title":"L’église a brûlé","kind":"incendie","place":"eglise de brumeval","joueurs":"auteurs","gravite":3},{"title":""},{"kind":"vol"}]}',
    [{ title: 'Église de Brumeval', planId: 'p', featureId: 'f' }]);
  assert.equal(got.length, 1);
  assert.deepEqual(got[0].place, { planId: 'p', featureId: 'f', title: 'Église de Brumeval' });
  assert.equal(parseEvents('pas de json').length, 0);
});
