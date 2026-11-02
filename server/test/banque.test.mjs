/** Banque Loresmith : retouches partagées par tous les comptes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { account, env, setupServer } from './helpers.mjs';

setupServer();

test('Seul l’administrateur retouche la banque ; tous voient ses retouches', async () => {
  env.ADMIN_EMAILS = 'ana@exemple.org, autre@exemple.org';
  const ana = await account('ana');
  const bob = await account('bob');
  assert.equal((await ana.call('GET', '/api/me')).body.admin, true);
  assert.equal((await bob.call('GET', '/api/me')).body.admin, false);
  assert.equal((await bob.call('PUT', '/api/banque/retouches/apple-merchant', { patch: { peuple: 'drow' } })).status, 403, 'un MJ ordinaire ne change pas l’application');
  assert.deepEqual((await bob.call('GET', '/api/banque/retouches')).body.retouches, {});
  const r = await ana.call('PUT', '/api/banque/retouches/apple-merchant', { patch: { peuple: 'nain', roles: ['marchand'], pirate: 'non' } });
  assert.equal(r.status, 200);
  const seen = (await bob.call('GET', '/api/banque/retouches')).body.retouches['apple-merchant'];
  assert.equal(seen.peuple, 'nain');
  assert.deepEqual(seen.roles, ['marchand']);
  assert.equal(seen.pirate, undefined, 'champ inconnu ignoré');
  assert.equal((await ana.call('PUT', '/api/banque/retouches/apple-merchant', { patch: { exclu: true } })).body.retouches['apple-merchant'].peuple, 'nain', 'les retouches se fusionnent');
  await ana.call('PUT', '/api/banque/retouches/apple-merchant', { patch: null });
  assert.equal((await ana.call('GET', '/api/banque/retouches')).body.retouches['apple-merchant'], undefined);
  assert.equal((await ana.call('PUT', '/api/banque/retouches/..%2Fx', { patch: {} })).status, 400);
});
