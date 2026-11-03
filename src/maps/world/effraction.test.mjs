/** La nuit et l'effraction : serrures, dormeurs, réveil, garde, mémoire du monde. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { lockOf, nightOccupants, stealthDc, wakeOutcome, guardArrival, breakInEvent } from './effraction.js';

test('les portes sont verrouillées la nuit, plus solides dans les beaux quartiers ; une taverne veille', () => {
  assert.equal(lockOf({ type: 'maison', quartier: 'ville' }, 'jour').locked, false);
  const taudis = lockOf({ type: 'maison', quartier: 'faubourg' }, 'nuit');
  const manoir = lockOf({ type: 'manoir', quartier: 'haute' }, 'nuit');
  assert.ok(taudis.locked && manoir.locked);
  assert.ok(manoir.dc >= taudis.dc + 5, `${taudis.dc} < ${manoir.dc}`);
  assert.equal(manoir.forceDc, manoir.dc + 2);
  assert.equal(lockOf({ type: 'taverne' }, 'nuit').locked, false);
});

test('Discrétion : plus de dormeurs, un chien, une porte forcée ou un veilleur rendent la chose plus dure', () => {
  const one = stealthDc({ sleepers: [{ role: 'habitant' }] });
  const many = stealthDc({ sleepers: Array(6).fill({ role: 'soldat' }) });
  const dog = stealthDc({ sleepers: [{ role: 'habitant' }], dog: true }, true);
  const watch = stealthDc({ sleepers: [], watchers: [{ role: 'veilleur' }] });
  assert.equal(one.dc, 12);
  assert.equal(many.dc, 18);
  assert.equal(dog.dc, 20);
  assert.equal(watch.dc, 17);
});

test('qui se réveille réagit selon qui il est ; la garde vient selon le quartier', () => {
  const occ = { sleepers: [{ name: 'Garin', role: 'forgeron' }, { name: 'Lise', role: 'enfant' }], watchers: [], dog: false };
  const all = wakeOutcome(occ, -6, 'x');
  assert.equal(all.woken.length, 2);
  assert.ok(all.shout && all.fight);
  const soldier = wakeOutcome({ sleepers: [], watchers: [{ name: '', role: 'garde' }] }, -1, 'y');
  assert.ok(soldier.fight && /Alerte/.test(soldier.lines[0]));
  assert.equal(wakeOutcome({ sleepers: [] }, -3, 'z').woken.length, 0);
  // Toujours la même chose pour la même graine.
  assert.deepEqual(wakeOutcome(occ, -2, 's').lines, wakeOutcome(occ, -2, 's').lines);
  const castle = guardArrival('chateau', 'a'), farm = guardArrival('ferme', 'a');
  assert.ok(castle.rounds >= 1 && castle.rounds <= 4);
  assert.match(farm.who, /voisins/);
});

test('les occupants connus de l’intérieur passent avant l’estimation ; l’effraction s’inscrit dans la mémoire', () => {
  const known = nightOccupants({ id: 'b1', type: 'maison' }, [{ name: 'Mahaut', role: 'tavernière', asleep: true }, { name: 'Perrin', role: 'veilleur', asleep: false }]);
  assert.deepEqual(known.sleepers.map((p) => p.name), ['Mahaut']);
  assert.deepEqual(known.watchers.map((p) => p.name), ['Perrin']);
  const guess = nightOccupants({ id: 'b2', type: 'caserne' });
  assert.ok(guess.sleepers.length >= 4 && guess.watchers.length === 2);
  const quiet = breakInEvent({ place: { title: 'Forge' } });
  assert.equal(quiet.title, 'Effraction à la forge');
  assert.equal(quiet.gravite, 1);
  assert.match(quiet.text, /au matin/);
  const loud = breakInEvent({ place: { title: 'Forge' }, woken: [{ name: 'Garin', role: 'forgeron' }], shout: true, fight: true, guard: { who: 'une patrouille du guet', rounds: 7 } });
  assert.equal(loud.gravite, 3);
  assert.deepEqual(loud.npcs, ['Garin']);
  assert.match(loud.text, /est arrivée en 7 rounds/);
});

test('le bon article devant un rôle', () => {
  const w = wakeOutcome({ sleepers: [{ name: '', role: 'prêtre' }, { name: '', role: 'fermière' }] }, -6, 'g');
  assert.match(w.lines[0], /^Un prêtre/);
  assert.match(w.lines[1], /^Une fermière/);
});
