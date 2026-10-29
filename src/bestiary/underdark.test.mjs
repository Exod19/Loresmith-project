/** Tests du bestiaire Underdark : intégrité des 683 fiches, conversion, et import non destructif. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkUnderdarkMaster, entityFromUnderdark, planUnderdarkImport, gridCellsOf } from './underdark.js';

const master = JSON.parse(readFileSync(fileURLToPath(new URL('../data/underdark/bestiaire-683.json', import.meta.url)), 'utf8'));

test('683 fiches, IDs uniques underdark_001 à underdark_683, variantes reliées, tag, taille, PV', () => {
  assert.equal(master.creatures.length, 683);
  const r = checkUnderdarkMaster(master);
  assert.deepEqual(r.errors, []);
  assert.equal(master.creatures[0].id, 'underdark_001');
  assert.equal(master.creatures.at(-1).id, 'underdark_683');
});

test('conversion : statistiques jouables, champs d’origine conservés', () => {
  const v = master.creatures.find((c) => c.id === 'underdark_101');
  const e = entityFromUnderdark(v);
  assert.equal(e.underdarkId, 'underdark_101');
  assert.equal(e.hp, 195);
  assert.equal(e.ac, 16);
  assert.equal(e.size, 'M');
  assert.ok(e.actions.some((a) => a.name === 'Frappe prédatrice' && a.attackBonus === 9 && a.damageDice === '4d10' && a.damageBonus === 6));
  assert.ok(e.actions.some((a) => /Sagesse DD 15/.test(a.desc)));
  assert.deepEqual(e.underdark, v);
  assert.ok(e.tags.includes('Underdark'));
  assert.ok(e.speed.startsWith('9 m'));
});

test('toutes les fiches se convertissent sans erreur', () => {
  for (const c of master.creatures) {
    const e = entityFromUnderdark(c);
    assert.ok(e.name && e.hp > 0 && e.ac > 0, c.id);
  }
});

test('import : seulement les IDs absents, jamais d’écrasement, doublons de nom signalés', () => {
  const existing = [
    { id: 'a', name: 'Vampire', underdarkId: 'underdark_101', hp: 120, ac: 16 },
    { id: 'b', name: master.creatures[5].name },
  ];
  const plan = planUnderdarkImport(master, existing);
  assert.equal(plan.total, 683);
  assert.ok(!plan.add.some((c) => c.id === 'underdark_101'));
  assert.ok(plan.present.includes('underdark_101'));
  assert.ok(plan.review.some((r) => r.id === 'underdark_101' && r.fields.includes('hp')));
  assert.ok(plan.review.some((r) => r.id === master.creatures[5].id && /même nom/.test(r.reason)));
  assert.equal(plan.add.length, 681);
  // Rejouer l'import après coup n'ajoute rien de plus.
  const after = [...existing, ...plan.add.map((c) => entityFromUnderdark(c))];
  assert.equal(planUnderdarkImport(master, after).add.length, 0);
});

test('emprise de grille : Large 2 cases, Huge 3, Tiny 1 (case partagée)', () => {
  const by = (size) => master.creatures.find((c) => c.size === size);
  assert.equal(gridCellsOf(by('Large')), 2);
  assert.equal(gridCellsOf(by('Huge')), 3);
  assert.equal(gridCellsOf(by('Tiny')), 1);
});
