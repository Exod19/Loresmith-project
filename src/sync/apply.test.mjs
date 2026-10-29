import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyChanges } from './apply.js';
import { hashOf } from './engine.js';

const base = () => ({ activeUniverseId: 'u1', universes: { u1: { id: 'u1' } }, npcs: { n1: { id: 'n1', name: 'A' } }, campaigns: {}, combat: { combatants: [], round: 1 }, log: [] });

test('pose et retire des documents, sans toucher au reste', () => {
  const s = base();
  const next = applyChanges(s, { upserts: [{ type: 'npc', id: 'n2', data: { id: 'n2', name: 'B' } }, { type: 'campaign', id: 'k1', data: { id: 'k1' } }], deletes: [{ type: 'npc', id: 'n1' }] });
  assert.deepEqual(Object.keys(next.npcs), ['n2']);
  assert.ok(next.campaigns.k1);
  assert.equal(next.universes, s.universes, 'collection non touchée : même objet');
  assert.deepEqual(s, base(), 'l’original n’est pas modifié');
  assert.equal(applyChanges(s, { upserts: [], deletes: [] }), s);
});

test('état du compte : combat et journal suivent, univers actif seulement s’il existe ici', () => {
  const s = base();
  const next = applyChanges(s, { upserts: [{ type: 'userState', id: 'moi', data: { activeUniverseId: 'absent', combat: { combatants: [{ id: 'x' }], round: 4 }, log: [{ id: 'g' }] } }] });
  assert.equal(next.combat.round, 4);
  assert.deepEqual(next.log, [{ id: 'g' }]);
  assert.equal(next.activeUniverseId, 'u1');
  const withU2 = applyChanges(s, { upserts: [{ type: 'universe', id: 'u2', data: { id: 'u2' } }, { type: 'userState', id: 'moi', data: { activeUniverseId: 'u2' } }] });
  assert.equal(withU2.activeUniverseId, 'u2');
});

test('empreinte : stable, et différente dès qu’un champ change', () => {
  assert.equal(hashOf({ a: 1, b: [1, 2] }), hashOf({ a: 1, b: [1, 2] }));
  assert.notEqual(hashOf({ a: 1 }), hashOf({ a: 2 }));
});

test('renommage : références suivies, identifiants fixes intacts', async () => {
  const { renameIds, renameMapFor } = await import('./apply.js');
  const s = { activeUniverseId: 'u1', universes: { u1: { id: 'u1' } }, npcs: { n1: { id: 'n1', universeId: 'u1' } }, campaigns: { k1: { id: 'k1', universeId: 'u1' } }, chatThreads: { t1: { id: 't1', universeId: 'u1', campaignId: 'k1' } }, maps: { 'atlas-profondeurs': { id: 'atlas-profondeurs', universeId: 'u1' } } };
  let n = 0;
  const map = renameMapFor(s, [{ type: 'universe', id: 'u1' }], () => `x${++n}`);
  assert.deepEqual([...map.keys()].sort(), ['k1', 'n1', 't1', 'u1']);
  const r = renameIds(s, map);
  const U = map.get('u1');
  assert.equal(r.activeUniverseId, U);
  assert.deepEqual(r.npcs[map.get('n1')], { id: map.get('n1'), universeId: U });
  assert.equal(r.chatThreads[map.get('t1')].campaignId, map.get('k1'));
  assert.deepEqual(r.maps['atlas-profondeurs'], { id: 'atlas-profondeurs', universeId: U });
});
