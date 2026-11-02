import { test } from 'node:test';
import assert from 'node:assert/strict';
import { universeContents, canDeleteUniverse, removeUniverse } from './deleteUniverse.js';

const base = () => ({
  universes: { a: { id: 'a' }, b: { id: 'b' } },
  activeUniverseId: 'a',
  npcs: { n1: { universeId: 'a' }, n2: { universeId: 'b' } },
  campaigns: { c1: { universeId: 'a' } },
  libraryEntries: {},
  log: [{ universeId: 'a' }, { universeId: 'b' }],
});

test('on compte le contenu de l’univers visé seulement', () => {
  assert.deepEqual(universeContents(base(), 'a'), { npcs: 1, campaigns: 1, log: 1 });
  assert.deepEqual(universeContents(base(), 'b'), { npcs: 1, log: 1 });
});

test('la suppression emporte le contenu et laisse les autres univers intacts', () => {
  const s = removeUniverse(base(), 'a');
  assert.deepEqual(Object.keys(s.universes), ['b']);
  assert.deepEqual(Object.keys(s.npcs), ['n2']);
  assert.deepEqual(s.campaigns, {});
  assert.equal(s.log.length, 1);
  assert.equal(s.activeUniverseId, 'b');
});

test('supprimer un univers non actif garde l’univers actif', () => {
  const s = removeUniverse(base(), 'b');
  assert.equal(s.activeUniverseId, 'a');
});

test('le dernier univers ou un id inconnu ne sont jamais supprimés', () => {
  const one = { ...base(), universes: { a: { id: 'a' } } };
  assert.equal(canDeleteUniverse(one, 'a'), false);
  assert.equal(removeUniverse(one, 'a'), one);
  const s = base();
  assert.equal(removeUniverse(s, 'zzz'), s);
});

test('l’état d’origine n’est pas modifié', () => {
  const s = base();
  removeUniverse(s, 'a');
  assert.equal(Object.keys(s.universes).length, 2);
  assert.equal(Object.keys(s.npcs).length, 2);
});
