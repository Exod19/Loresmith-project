/**
 * Compte (lot 8) : conditions d'utilisation exigées à la première connexion, export des renseignements,
 * suppression du compte (et ses garde-fous).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { TERMS_VERSION } from '../../src/shared/terms.js';
import { blobStore } from '../src/store.js';
import { account, device, empty, env, image, setupServer } from './helpers.mjs';

setupServer();

/** Compte tout neuf, sans avoir accepté les conditions. */
async function fresh(name) {
  let cookie = '';
  const call = async (method, path, json) => {
    const res = await worker.fetch(new Request('http://localhost:8787' + path, { method, headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json', Cookie: cookie }, body: json === undefined ? undefined : JSON.stringify(json) }), env);
    const set = res.headers.getSetCookie?.() ?? [];
    if (set.length) cookie = set.map((s) => s.split(';')[0]).join('; ');
    return { status: res.status, body: await res.json() };
  };
  const r = await call('POST', '/api/auth/sign-up/email', { email: `${name}@exemple.org`, password: 'un-mot-de-passe-solide', name });
  return { call, id: r.body.user.id };
}

test('conditions d’utilisation : exigées avant tout, version par version', async () => {
  const zoe = await fresh('zoe');
  const me = await zoe.call('GET', '/api/me');
  assert.deepEqual([me.status, me.body.termsAccepted, me.body.termsVersion], [200, false, TERMS_VERSION]);
  for (const [m, p] of [['GET', '/api/sync?since=0'], ['GET', '/api/universes'], ['POST', '/api/universes']]) {
    const r = await zoe.call(m, p, m === 'POST' ? { data: { name: 'x' } } : undefined);
    assert.deepEqual([r.status, r.body.code], [403, 'terms_required'], `${m} ${p}`);
  }
  assert.equal((await zoe.call('GET', '/api/me/export')).status, 200, 'l’export reste permis');
  assert.equal((await zoe.call('POST', '/api/me/terms', { version: '1999-01-01' })).status, 409, 'une ancienne version ne suffit pas');
  assert.equal((await zoe.call('POST', '/api/me/terms', { version: TERMS_VERSION })).status, 200);
  assert.equal((await zoe.call('GET', '/api/me')).body.termsAccepted, true);
  assert.equal((await zoe.call('GET', '/api/sync?since=0')).status, 200);
});

test('export des renseignements du compte', async () => {
  const alice = await account('alice');
  await alice.call('POST', '/api/universes', { id: 'ux', data: { name: 'Exporté' } });
  await alice.call('POST', '/api/universes/ux/invitations', { email: 'quelquun@exemple.org', role: 'reader' });
  const r = await alice.call('GET', '/api/me/export');
  assert.equal(r.body.profile.email, 'alice@exemple.org');
  assert.deepEqual(r.body.universes.map((u) => [u.name, u.role]), [['Exporté', 'owner']]);
  assert.equal(r.body.invitationsSent[0].email, 'quelquun@exemple.org');
  assert.equal(r.body.termsAcceptances[0].version, TERMS_VERSION);
  assert.ok(r.body.sessions.length >= 1);
  assert.equal(JSON.stringify(r.body).includes('password'), false, 'jamais le mot de passe, même haché');
});

test('suppression du compte : confirmation, univers partagés protégés, puis effacement', async () => {
  const bea = await account('bea');
  const carl = await account('carl');
  const pic = await image('portrait-de-bea');
  const d = device(bea, { ...empty(), activeUniverseId: 'ub', universes: { ub: { id: 'ub', name: 'Univers de Béa' } }, npcs: { nb: { id: 'nb', universeId: 'ub', name: 'PNJ', token: `lsimg:${pic.id}` } } });
  d.images.set(pic.id, pic);
  await d.sync();
  await carl.call('POST', '/api/universes', { id: 'uc', data: { name: 'Univers de Carl' } });
  await env.DB.prepare("insert into universe_members (universe_id, user_id, role, created_at) values ('uc', ?, 'editor', 0), ('ub', ?, 'reader', 0)").bind(bea.id, carl.id).run();
  await bea.call('PUT', '/api/docs/npc/nc', { version: 0, universeId: 'uc', data: { id: 'nc', universeId: 'uc', name: 'Écrit par Béa chez Carl' } });

  assert.equal((await bea.call('DELETE', '/api/me', { confirm: 'mauvais@exemple.org' })).status, 400, 'courriel à retaper');
  const blocked = await bea.call('DELETE', '/api/me', { confirm: 'bea@exemple.org' });
  assert.deepEqual([blocked.status, blocked.body.shared.map((s) => s.name)], [409, ['Univers de Béa']], 'Carl est membre de l’univers de Béa');

  await bea.call('DELETE', `/api/universes/ub/members/${carl.id}`);
  const done = await bea.call('DELETE', '/api/me', { confirm: 'Bea@Exemple.org' });
  assert.deepEqual([done.status, done.body.universes], [200, 1]);

  const count = async (sql, ...b) => (await env.DB.prepare(sql).bind(...b).first()).n;
  assert.equal(await count('select count(*) as n from "user" where id = ?', bea.id), 0);
  assert.equal(await count('select count(*) as n from account where "userId" = ?', bea.id), 0);
  assert.equal(await count('select count(*) as n from universe_members where user_id = ?', bea.id), 0);
  assert.equal(await count("select count(*) as n from documents where universe_id = 'ub' or (type = 'userState' and id = ?)", bea.id), 0, 'son univers et l’état de son compte sont effacés');
  assert.equal(await count("select count(*) as n from document_versions where id in ('ub', 'nb')"), 0, 'historique compris');
  assert.equal(await blobStore(env).get(`ub/${pic.id}`), null, 'ses images aussi');
  assert.equal(await count("select count(*) as n from documents where id = 'nc'"), 1, 'ce qu’elle a écrit dans l’univers de Carl reste à Carl');
  assert.equal((await bea.call('GET', '/api/me')).status, 401, 'sa session ne fonctionne plus');
  const login = await worker.fetch(new Request('http://localhost:8787/api/auth/sign-in/email', { method: 'POST', headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'bea@exemple.org', password: 'un-mot-de-passe-solide' }) }), env);
  assert.notEqual(login.status, 200, 'impossible de se reconnecter');
});
