/**
 * Synchronisation de bout en bout (sans navigateur) : plusieurs appareils et comptes simulés,
 * chacun avec son grimoire local, synchronisés par le moteur du site contre le vrai Worker et une base D1 locale.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import app from '../src/index.js';
import { runSync, resolveConflict } from '../../src/sync/engine.js';
import { applyChanges } from '../../src/sync/apply.js';

const ROOT = new URL('..', import.meta.url).pathname;
const BASE = 'http://localhost:8787';
let dir;
let proxy;
let env;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'loresmith-sync-'));
  execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', dir], { cwd: ROOT, env: { ...process.env, CI: '1' }, stdio: 'pipe' });
  proxy = await getPlatformProxy({ configPath: join(ROOT, 'wrangler.toml'), persist: { path: join(dir, 'v3') } });
  env = { ...proxy.env, BETTER_AUTH_SECRET: crypto.randomUUID() + crypto.randomUUID(), BETTER_AUTH_URL: BASE, FRONT_ORIGIN: 'http://localhost:5173' };
});

after(async () => {
  await proxy?.dispose();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

/** Compte connecté : `call(méthode, chemin, json | { raw, type })`. */
async function account(name) {
  let cookie = '';
  const call = async (method, path, body) => {
    const headers = { Origin: 'http://localhost:5173' };
    let payload;
    if (body?.raw) {
      headers['Content-Type'] = body.type;
      payload = body.raw;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    if (cookie) headers.Cookie = cookie;
    const res = await app.fetch(new Request(BASE + path, { method, headers, body: payload }), env);
    const set = res.headers.getSetCookie?.() ?? [];
    if (set.length) cookie = set.map((s) => s.split(';')[0]).join('; ');
    const type = res.headers.get('Content-Type') || '';
    return { status: res.status, body: type.includes('json') ? await res.json() : new Uint8Array(await res.arrayBuffer()) };
  };
  const r = await call('POST', '/api/auth/sign-up/email', { email: `${name}@exemple.org`, password: 'un-mot-de-passe-solide', name });
  assert.equal(r.status, 200);
  return { call, id: r.body.user.id };
}

const fail = (r) => Object.assign(new Error(r.body?.error || `HTTP ${r.status}`), { status: r.status, body: r.body });

/** Appareil : un grimoire local, son état de synchronisation, ses images, et une connexion qu'on peut couper. */
function device(user, state) {
  const d = { state, meta: null, images: new Map(), online: true };
  const net = () => {
    if (!d.online) throw new TypeError('Failed to fetch');
  };
  d.api = {
    pull: async (since) => {
      net();
      const r = await user.call('GET', `/api/sync?since=${since}`);
      if (r.status !== 200) throw fail(r);
      return r.body;
    },
    put: async (doc) => {
      net();
      const r = await user.call('PUT', `/api/docs/${doc.type}/${doc.id}`, doc);
      if (r.status >= 300) throw fail(r);
      return r.body;
    },
    remove: async (type, id, version) => {
      net();
      const r = await user.call('DELETE', `/api/docs/${type}/${id}?version=${version}`);
      if (r.status >= 300) throw fail(r);
      return r.body;
    },
    uploadImage: async (universeId, id) => {
      net();
      const img = d.images.get(id);
      if (!img) throw Object.assign(new Error('absente'), { status: 404 });
      const r = await user.call('PUT', `/api/images/${universeId}/${id}`, { raw: img.bytes, type: img.type });
      if (r.status >= 300) throw fail(r);
    },
  };
  d.sync = async (opts = {}) => {
    const res = await runSync({ persisted: d.state, meta: d.meta, userId: user.id, api: d.api, ...opts });
    d.meta = res.meta;
    d.state = applyChanges(d.state, res.changes);
    return res;
  };
  d.resolve = async (conflict, choice) => {
    const res = await resolveConflict({ conflict, choice, meta: d.meta, api: d.api });
    d.meta = res.meta;
    d.state = applyChanges(d.state, res.changes);
    return res;
  };
  d.edit = (fn) => {
    d.state = structuredClone(d.state);
    fn(d.state);
  };
  return d;
}

const empty = () => ({ activeUniverseId: null, universes: {}, characters: {}, campaigns: {}, npcs: {}, quests: {}, assets: {}, libraryEntries: {}, maps: {}, chatThreads: {}, combat: { combatants: [], round: 1 }, log: [] });

/** Image dont l'identifiant est l'empreinte SHA-256 du contenu, comme dans le navigateur. */
async function image(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return { id: Array.from(digest.subarray(0, 16), (b) => b.toString(16).padStart(2, '0')).join(''), bytes, type: 'image/webp' };
}

test('synchronisation entre appareils et comptes, conflits, hors ligne, suppressions', async () => {
  const alice = await account('alice');
  const bob = await account('bob');
  const carol = await account('carol');
  const portrait = await image('portrait-de-yemena');

  // Appareil 1 d'Alice : un grimoire existant, avec une image.
  const a1 = device(alice, {
    ...empty(),
    activeUniverseId: 'u1',
    universes: { u1: { id: 'u1', name: 'Underdark' } },
    npcs: { n1: { id: 'n1', universeId: 'u1', name: 'Yemena', token: `lsimg:${portrait.id}` }, n2: { id: 'n2', universeId: 'u1', name: 'Garde' } },
    campaigns: { k1: { id: 'k1', universeId: 'u1', title: 'La descente', scenes: [] } },
    chatThreads: { t1: { id: 't1', universeId: 'u1', campaignId: 'k1', messages: [] } },
    combat: { combatants: [{ id: 'x', name: 'Orc' }], round: 2 },
  });
  a1.images.set(portrait.id, portrait);
  const first = await a1.sync();
  assert.deepEqual([first.offline, first.conflicts.length, first.stats.pushed], [false, 0, 6], 'univers, campagne, 2 PNJ, discussion, état du compte');
  const img = await alice.call('GET', `/api/images/u1/${portrait.id}`);
  assert.deepEqual([img.status, new TextDecoder().decode(img.body)], [200, 'portrait-de-yemena'], 'l’image est partie avec le PNJ');
  assert.equal((await a1.sync()).stats.pushed, 0, 'rien de neuf : rien n’est renvoyé');

  // Appareil 2 d'Alice, vierge : il reçoit tout, combat en cours compris (Q1).
  const a2 = device(alice, empty());
  const got = await a2.sync();
  assert.equal(got.conflicts.length, 0);
  for (const c of ['universes', 'npcs', 'campaigns', 'chatThreads']) assert.deepEqual(a2.state[c], a1.state[c], c);
  assert.deepEqual([a2.state.combat.round, a2.state.activeUniverseId], [2, 'u1']);

  // Bob, éditeur de l'univers, reçoit l'univers mais pas l'état du compte d'Alice.
  await env.DB.prepare('insert into universe_members (universe_id, user_id, role, created_at) values (?, ?, ?, ?)').bind('u1', bob.id, 'editor', Date.now()).run();
  const b = device(bob, empty());
  await b.sync();
  assert.equal(b.state.npcs.n1.name, 'Yemena');
  assert.deepEqual(b.state.combat, { combatants: [], round: 1 }, 'le combat d’Alice reste à Alice');
  assert.equal(b.state.campaigns.k1.title, 'La descente', 'tout membre lit les campagnes de l’univers');

  // Conflit : les deux modifient le même PNJ. Le second à synchroniser doit choisir ; rien n'est écrasé en silence.
  a1.edit((s) => (s.npcs.n1.name = 'Yemena (Alice)'));
  b.edit((s) => (s.npcs.n1.name = 'Yemena (Bob)'));
  assert.equal((await a1.sync()).stats.pushed, 1);
  const clash = await b.sync();
  assert.equal(clash.conflicts.length, 1);
  assert.deepEqual([clash.conflicts[0].local.name, clash.conflicts[0].remote.data.name], ['Yemena (Bob)', 'Yemena (Alice)']);
  assert.equal(b.state.npcs.n1.name, 'Yemena (Bob)', 'en attendant le choix, la version locale reste');
  await b.resolve(clash.conflicts[0], 'mine');
  await a1.sync();
  assert.equal(a1.state.npcs.n1.name, 'Yemena (Bob)', 'le choix de Bob arrive chez Alice');

  // Conflit réglé dans l'autre sens : Alice prend la version du serveur.
  b.edit((s) => (s.npcs.n1.name = 'Yemena v3 (Bob)'));
  a1.edit((s) => (s.npcs.n1.name = 'Yemena v3 (Alice)'));
  await b.sync();
  const clash2 = await a1.sync();
  assert.equal(clash2.conflicts.length, 1);
  await a1.resolve(clash2.conflicts[0], 'theirs');
  assert.equal(a1.state.npcs.n1.name, 'Yemena v3 (Bob)');
  assert.equal((await a1.sync()).stats.pushed, 0, 'conflit réglé : plus rien à envoyer');

  // Hors ligne : la modification reste locale, puis part au retour du réseau.
  a2.online = false;
  await a2.sync();
  a2.edit((s) => (s.campaigns.k1.title = 'La descente (hors ligne)'));
  const off = await a2.sync();
  assert.equal(off.offline, true);
  assert.equal(a2.state.campaigns.k1.title, 'La descente (hors ligne)');
  a2.online = true;
  assert.equal((await a2.sync()).stats.pushed, 1);
  await b.sync();
  assert.equal(b.state.campaigns.k1.title, 'La descente (hors ligne)');

  // Suppression : marquée sur le serveur, appliquée sur les autres appareils.
  a1.edit((s) => delete s.npcs.n2);
  assert.equal((await a1.sync()).stats.deleted, 1);
  await b.sync();
  assert.equal(b.state.npcs.n2, undefined);
  const kept = await env.DB.prepare("select deleted_at from documents where type = 'npc' and id = 'n2'").first();
  assert.ok(kept.deleted_at, 'rien n’est effacé : le document est marqué supprimé');

  // Beaucoup de suppressions d'un coup : elles attendent une confirmation.
  b.edit((s) => {
    for (let i = 0; i < 6; i++) s.npcs[`x${i}`] = { id: `x${i}`, universeId: 'u1', name: `Figurant ${i}` };
  });
  await b.sync();
  b.edit((s) => {
    for (let i = 0; i < 6; i++) delete s.npcs[`x${i}`];
  });
  const many = await b.sync();
  assert.equal(many.pendingDeletes.length, 6);
  assert.equal(many.stats.deleted, 0);
  assert.equal((await b.sync({ confirmDeletes: true })).stats.deleted, 6);

  // Carol, lectrice : sa modification locale est refusée par le serveur, et elle peut reprendre la version du serveur.
  await env.DB.prepare('insert into universe_members (universe_id, user_id, role, created_at) values (?, ?, ?, ?)').bind('u1', carol.id, 'reader', Date.now()).run();
  const c = device(carol, empty());
  await c.sync();
  c.edit((s) => (s.npcs.n1.name = 'Piratée'));
  const refused = await c.sync();
  assert.deepEqual([refused.conflicts.length, refused.conflicts[0].refused], [1, 403]);
  assert.equal((await alice.call('GET', '/api/sync?since=0')).body.docs.find((d) => d.id === 'n1').data.name, 'Yemena v3 (Bob)');
});
