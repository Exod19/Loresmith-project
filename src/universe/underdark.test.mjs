import test from 'node:test';
import assert from 'node:assert/strict';
import { isUnderdarkUniverse, mentionsUnderdark, scopedEntries, underdarkSpecific } from './underdark.js';

test('une fiche de l’Underdark ne sort pas des univers Underdark', () => {
  const surface = { archives: undefined }, deep = { archives: 'underdark' };
  const porte = { id: 'a', archiveType: 'place', title: 'La Porte souterraine (Hosten Valak · Niveau 1)' };
  const imported = { id: 'b', archiveType: 'place', title: 'Le Marché', sourceId: 'arc-12' };
  const taverne = { id: 'c', archiveType: 'place', title: 'Taverne du Pont-Vieux', shortSummary: 'Une cave voûtée, un passage souterrain vers le fleuve.' };
  assert.ok(isUnderdarkUniverse(deep) && !isUnderdarkUniverse(surface));
  assert.ok(underdarkSpecific(porte) && underdarkSpecific(imported) && !underdarkSpecific(taverne));
  assert.deepEqual(scopedEntries(surface, [porte, imported, taverne]).map((e) => e.id), ['c']);
  assert.deepEqual(scopedEntries(deep, [porte, imported, taverne]).map((e) => e.id), ['a', 'b', 'c']);
  assert.ok(mentionsUnderdark('Descente vers la Strate I-3') && !mentionsUnderdark('Une cave sous la halle'));
});
