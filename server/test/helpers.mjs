/**
 * Outillage commun des tests du serveur : base D1 locale migrée (commande de production), comptes connectés,
 * et appareils simulés qui synchronisent un grimoire local avec le moteur du site.
 */
import { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import app from '../src/index.js';
import { runSync, resolveConflict } from '../../src/sync/engine.js';
import { applyChanges, renameIds, renameMapFor } from '../../src/sync/apply.js';
import { TERMS_VERSION } from '../../src/shared/terms.js';

const ROOT = new URL('..', import.meta.url).pathname;
const BASE = 'http://localhost:8787';
let dir;
let proxy;
/** Environnement du Worker (bindings locaux), disponible une fois `setupServer()` exécuté. */
export let env;

/** À appeler en tête de fichier de test : base neuve avant, nettoyage après. */
export function setupServer() {
before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'loresmith-test-'));
  execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', dir], { cwd: ROOT, env: { ...process.env, CI: '1' }, stdio: 'pipe' });
  proxy = await getPlatformProxy({ configPath: join(ROOT, 'wrangler.toml'), persist: { path: join(dir, 'v3') } });
  env = { ...proxy.env, BETTER_AUTH_SECRET: crypto.randomUUID() + crypto.randomUUID(), BETTER_AUTH_URL: BASE, FRONT_ORIGIN: 'http://localhost:5173', LOG_LEVEL: 'silent' };
});

after(async () => {
  await proxy?.dispose();
  if (dir) rmSync(dir, { recursive: true, force: true });
});
}

/** Compte connecté : `call(méthode, chemin, json | { raw, type })`. */
export async function account(name) {
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
  // Comme dans l'interface : les conditions d'utilisation sont acceptées à la première connexion.
  assert.equal((await call('POST', '/api/me/terms', { version: TERMS_VERSION })).status, 200);
  return { call, id: r.body.user.id };
}

const fail = (r) => Object.assign(new Error(r.body?.error || `HTTP ${r.status}`), { status: r.status, body: r.body });

/** Appareil : un grimoire local, son état de synchronisation, ses images, et une connexion qu'on peut couper. */
export function device(user, state) {
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
    // Comme useSync : identifiants pris par un autre compte, renommés ici avant la synchronisation suivante.
    if (res.idTaken?.length) d.state = renameIds(d.state, renameMapFor(d.state, res.idTaken));
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

export const empty = () => ({ activeUniverseId: null, universes: {}, characters: {}, campaigns: {}, npcs: {}, quests: {}, assets: {}, libraryEntries: {}, maps: {}, chatThreads: {}, combat: { combatants: [], round: 1 }, log: [] });

/** Image dont l'identifiant est l'empreinte SHA-256 du contenu, comme dans le navigateur. */
export async function image(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return { id: Array.from(digest.subarray(0, 16), (b) => b.toString(16).padStart(2, '0')).join(''), bytes, type: 'image/webp' };
}
