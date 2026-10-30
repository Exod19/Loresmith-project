/** Banque Loresmith : retouches partagées par tous les comptes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { account, setupServer } from './helpers.mjs';

setupServer();

test('Une retouche faite par un MJ est vue par un autre, et peut être retirée', async () => {
  const ana = await account('ana');
  const bob = await account('bob');
  assert.deepEqual((await bob.call('GET', '/api/banque/retouches')).body.retouches, {});
  const r = await ana.call('PUT', '/api/banque/retouches/apple-merchant', { patch: { peuple: 'nain', roles: ['marchand'], pirate: 'non' } });
  assert.equal(r.status, 200);
  const seen = (await bob.call('GET', '/api/banque/retouches')).body.retouches['apple-merchant'];
  assert.equal(seen.peuple, 'nain');
  assert.deepEqual(seen.roles, ['marchand']);
  assert.equal(seen.pirate, undefined, 'champ inconnu ignoré');
  assert.equal((await bob.call('PUT', '/api/banque/retouches/apple-merchant', { patch: { exclu: true } })).body.retouches['apple-merchant'].peuple, 'nain', 'les retouches se fusionnent');
  await bob.call('PUT', '/api/banque/retouches/apple-merchant', { patch: null });
  assert.equal((await ana.call('GET', '/api/banque/retouches')).body.retouches['apple-merchant'], undefined);
  assert.equal((await ana.call('PUT', '/api/banque/retouches/..%2Fx', { patch: {} })).status, 400);
});
