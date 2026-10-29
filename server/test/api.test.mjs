/**
 * Tests de l'API sur une vraie base D1 locale (Miniflare, via Wrangler) : la migration est appliquée
 * avec la commande de production (`wrangler d1 migrations apply --local`), dans un dossier temporaire.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import app from '../src/index.js';
import { TERMS_VERSION } from '../../src/shared/terms.js';

const ROOT = new URL('..', import.meta.url).pathname;
const BASE = 'http://localhost:8787';
let dir;
let proxy;
let env;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'loresmith-d1-'));
  execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', dir], { cwd: ROOT, env: { ...process.env, CI: '1' }, stdio: 'pipe' });
  proxy = await getPlatformProxy({ configPath: join(ROOT, 'wrangler.toml'), persist: { path: join(dir, 'v3') } });
  env = { ...proxy.env, BETTER_AUTH_SECRET: crypto.randomUUID() + crypto.randomUUID(), BETTER_AUTH_URL: BASE, FRONT_ORIGIN: 'http://localhost:5173', LOG_LEVEL: 'silent' };
});

after(async () => {
  await proxy?.dispose();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

/** Client de test : garde le cookie de session d'un compte. */
function client() {
  let cookie = '';
  return async (method, path, json) => {
    const headers = { Origin: 'http://localhost:5173' };
    if (json !== undefined) headers['Content-Type'] = 'application/json';
    if (cookie) headers.Cookie = cookie;
    const res = await app.fetch(new Request(BASE + path, { method, headers, body: json === undefined ? undefined : JSON.stringify(json) }), env);
    const set = res.headers.getSetCookie?.() ?? [];
    if (set.length) cookie = set.map((s) => s.split(';')[0]).join('; ');
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
}

async function signUp(name) {
  const call = client();
  const r = await call('POST', '/api/auth/sign-up/email', { email: `${name}@exemple.org`, password: 'un-mot-de-passe-solide', name });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await call('POST', '/api/me/terms', { version: TERMS_VERSION })).status, 200);
  return { call, id: r.body.user.id };
}

test('la migration crée toutes les tables', async () => {
  const { results } = await env.DB.prepare("select name from sqlite_master where type = 'table' order by name").all();
  const names = results.map((r) => r.name);
  for (const t of ['user', 'session', 'account', 'verification', 'universe_members', 'campaign_members', 'documents', 'document_versions', 'images']) assert.ok(names.includes(t), t);
});

test('santé : accessible sans compte', async () => {
  const r = await client()('GET', '/api/health');
  assert.deepEqual([r.status, r.body.ok], [200, true]);
});

test('sans session : toute autre route est refusée (401)', async () => {
  const anon = client();
  for (const [m, p, b] of [['GET', '/api/me'], ['GET', '/api/universes'], ['POST', '/api/universes', { data: { name: 'x' } }], ['GET', '/api/universes/u1'], ['PUT', '/api/campaigns/k1', { version: 1, data: {} }]]) {
    assert.equal((await anon(m, p, b)).status, 401, `${m} ${p}`);
  }
});

test('compte, univers, campagne, permissions et versions', async () => {
  const alice = await signUp('alice');
  const bob = await signUp('bob');

  const me = await alice.call('GET', '/api/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, 'alice@exemple.org');

  // Alice crée un univers : elle en est propriétaire.
  const u = await alice.call('POST', '/api/universes', { id: 'u1', data: { name: 'Underdark' } });
  assert.equal(u.status, 201);
  assert.deepEqual([u.body.role, u.body.version, u.body.data.name], ['owner', 1, 'Underdark']);
  assert.equal((await alice.call('POST', '/api/universes', { id: 'u1', data: { name: 'Doublon' } })).status, 409, 'identifiant déjà pris : rien n’est écrasé');
  assert.equal((await alice.call('POST', '/api/universes', { id: 'pas valide !', data: {} })).status, 400);

  // Bob n'est pas membre : il ne voit rien.
  assert.equal((await bob.call('GET', '/api/universes/u1')).status, 404);
  assert.deepEqual((await bob.call('GET', '/api/universes')).body.universes, []);
  assert.equal((await bob.call('PUT', '/api/universes/u1', { version: 1, data: { name: 'Piraté' } })).status, 404);

  // Bob devient lecteur (le partage par invitation viendra au lot 6).
  await env.DB.prepare('insert into universe_members (universe_id, user_id, role, created_at) values (?, ?, ?, ?)').bind('u1', bob.id, 'reader', Date.now()).run();
  const seen = await bob.call('GET', '/api/universes/u1');
  assert.deepEqual([seen.status, seen.body.role], [200, 'reader']);
  assert.equal((await bob.call('PUT', '/api/universes/u1', { version: 1, data: { name: 'Modifié' } })).status, 403);
  assert.equal((await bob.call('POST', '/api/universes/u1/campaigns', { data: { title: 'x' } })).status, 403, 'un lecteur ne crée pas de campagne');

  // Alice crée une campagne : elle en est la MJ.
  const k = await alice.call('POST', '/api/universes/u1/campaigns', { id: 'k1', data: { title: 'La descente', dmOverview: 'secret' } });
  assert.deepEqual([k.status, k.body.campaignRole, k.body.data.universeId], [201, 'gm', 'u1']);

  // Bob, membre de l'univers, lit la campagne et ses secrets (tous les comptes sont des MJ), sans pouvoir la modifier.
  const list = await bob.call('GET', '/api/universes/u1/campaigns');
  assert.deepEqual(list.body.campaigns.map((c) => c.data.dmOverview), ['secret']);
  assert.equal((await bob.call('PUT', '/api/campaigns/k1', { version: 1, data: { title: 'x' } })).status, 403);

  // Mise à jour versionnée, puis conflit avec une version périmée.
  const v2 = await alice.call('PUT', '/api/campaigns/k1', { version: 1, data: { title: 'La descente, révisée' } });
  assert.deepEqual([v2.status, v2.body.version], [200, 2]);
  const stale = await alice.call('PUT', '/api/campaigns/k1', { version: 1, data: { title: 'Écrasement' } });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.current.data.title, 'La descente, révisée', 'le conflit renvoie la version du serveur');
  assert.equal((await alice.call('PUT', '/api/campaigns/k1', { data: { title: 'sans version' } })).status, 400);

  // L'historique garde chaque version (Q5).
  const { results } = await env.DB.prepare('select version, data from document_versions where type = ? and id = ? order by version').bind('campaign', 'k1').all();
  assert.deepEqual(results.map((r) => [r.version, JSON.parse(r.data).title]), [[1, 'La descente'], [2, 'La descente, révisée']]);
});
