/** Eaux des plans : formes indépendantes des matières, paliers de profondeur, berges et matières par climat. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { bankColor, depthSteps, pathOf, shoreSteps, waterMaterials, waterScene } from './water.js';

test('Formes : rivières (traits) et lacs ou mer (polygones), boîte englobante', () => {
  const sc = waterScene({ water: [{ pts: [0, 0, 10, 0, 20, 5], hw: 2 }, { pts: [30, 30, 40, 30, 40, 40], hw: 0, closed: true }, { pts: [1, 1], hw: 3 }] });
  assert.equal(sc.rivers.length, 1);
  assert.equal(sc.lakes.length, 1);
  assert.equal(sc.rivers[0].d, 'M0 0L10 0L20 5');
  assert.ok(sc.lakes[0].d.endsWith('Z'));
  assert.deepEqual(sc.bounds, [-2, -2, 40, 40]);
  assert.equal(waterScene({}).bounds, null);
  assert.equal(pathOf([0, 0]), '');
});

test('Profondeur : paliers de plus en plus étroits, du bord vers le milieu ; rivage peu profond', () => {
  const st = depthSteps(5);
  assert.equal(st.length, 12);
  for (let i = 1; i < st.length; i++) assert.ok(st[i].width < st[i - 1].width);
  assert.ok(st[0].width < 10, 'le bord de la rivière reste peu profond');
  // Au milieu, les paliers cumulés donnent presque toute la profondeur ; au bord, peu.
  const cum = st.reduce((a, x) => 1 - (1 - a) * (1 - x.opacity), 0);
  assert.ok(cum > 0.85 && st[0].opacity < 0.25, 'dégradé progressif : chaque palier ajoute peu');
  const sh = shoreSteps(10, 4);
  assert.ok(sh[0].width === 20 && sh[3].width < sh[0].width);
});

test('Matières et berges selon le climat', () => {
  assert.deepEqual(waterMaterials({ climate: 'tempere' }).shallow[0], 'boueuse');
  assert.deepEqual(waterMaterials({ climate: 'chaud' }).shallow[0], 'claire');
  assert.equal(waterMaterials({ kind: 'mer' }).shallow[0], 'claire');
  assert.notEqual(bankColor({ climate: 'chaud' }), bankColor({ climate: 'froid' }));
  assert.equal(bankColor({ snow: 0.5 }), '#d9e0e4');
});
