/**
 * Journaux (lot 7) : une ligne JSON par requête, avec le modèle de route, jamais le jeton, le courriel ni le contenu.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { account, env, setupServer } from './helpers.mjs';

setupServer();

test('une ligne par requête, sans donnée personnelle ni secret', async () => {
  const alice = await account('alice');
  await alice.call('POST', '/api/universes', { id: 'u1', data: { name: 'Univers très secret' } });
  const inv = await alice.call('POST', '/api/universes/u1/invitations', { email: 'bob@exemple.org', role: 'reader' });
  const token = new URL(inv.body.link).searchParams.get('invitation');

  const lines = [];
  const original = console.log;
  console.log = (l) => lines.push(l);
  try {
    const verbose = { ...env, LOG_LEVEL: 'info' };
    await worker.fetch(new Request(`http://localhost:8787/api/invitations/${token}`), verbose);
    await worker.fetch(new Request('http://localhost:8787/api/me'), verbose);
  } finally {
    console.log = original;
  }
  const events = lines.map((l) => JSON.parse(l));
  assert.deepEqual(events.map((e) => [e.event, e.route, e.status]), [['requête', '/api/invitations/:token', 200], ['requête', '/api/*', 401]]);
  const all = lines.join('\n');
  for (const secret of [token, 'bob@exemple.org', 'alice@exemple.org', 'Univers très secret']) assert.equal(all.includes(secret), false, secret);
});
