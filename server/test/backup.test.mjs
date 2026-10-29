/**
 * Sauvegarde et restauration (lot 7) : la tâche planifiée écrit la sauvegarde dans R2 ; elle est convertie en SQL
 * avec le script de restauration, appliquée sur une base neuve avec la commande de production
 * (`wrangler d1 execute --file`), et l'application fonctionne sur la base restaurée : connexion, données, historique.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import worker from '../src/index.js';
import { BACKUP_PREFIX, TABLES } from '../src/backup.js';
import { account, device, empty, env, image, setupServer } from './helpers.mjs';

setupServer();

const ROOT = new URL('..', import.meta.url).pathname;
const run = (args, opts = {}) => execFileSync('npx', ['wrangler', ...args], { cwd: ROOT, env: { ...process.env, CI: '1' }, stdio: 'pipe', ...opts });

async function cron() {
  const pending = [];
  await worker.scheduled({ cron: '17 7 * * *', scheduledTime: Date.now() }, env, { waitUntil: (p) => pending.push(p) });
  await Promise.all(pending);
}
const backups = async () => (await env.IMAGES.list({ prefix: BACKUP_PREFIX })).objects.map((o) => o.key).sort();

test('sauvegarde quotidienne, puis restauration complète sur une base neuve', async () => {
  // Des données réelles : deux comptes, un univers partagé, un document modifié deux fois, une image, une invitation.
  const alice = await account('alice');
  const portrait = await image('portrait');
  const a = device(alice, { ...empty(), activeUniverseId: 'u1', universes: { u1: { id: 'u1', name: 'Underdark' } }, npcs: { n1: { id: 'n1', universeId: 'u1', name: 'Yemena', token: `lsimg:${portrait.id}` } } });
  a.images.set(portrait.id, portrait);
  await a.sync();
  a.edit((s) => (s.npcs.n1.name = 'Yemena v2'));
  await a.sync();
  const inv = await alice.call('POST', '/api/universes/u1/invitations', { email: 'bob@exemple.org', role: 'editor' });
  const bob = await account('bob');
  await bob.call('POST', `/api/invitations/${new URL(inv.body.link).searchParams.get('invitation')}/accept`);

  // La tâche planifiée écrit une sauvegarde compressée dans R2.
  await cron();
  const [key] = await backups();
  assert.match(key, /^backups\/d1-\d{4}-\d{2}-\d{2}T.*\.json\.gz$/);
  const gz = new Uint8Array(await (await env.IMAGES.get(key)).arrayBuffer());
  const file = join(mkdtempSync(join(tmpdir(), 'loresmith-backup-')), 'sauvegarde.json.gz');
  writeFileSync(file, gz);

  // Le script de restauration en tire le SQL.
  const sql = execFileSync('node', ['scripts/backup-to-sql.mjs', file], { cwd: ROOT }).toString();
  assert.match(sql, /insert into "documents"/);
  assert.equal(/"session"|"verification"/.test(sql), false, 'sessions et jetons éphémères non sauvegardés');
  const sqlFile = file.replace('.json.gz', '.sql');
  writeFileSync(sqlFile, sql);

  // Base neuve : migrations, puis restauration avec la commande de production.
  const dir2 = mkdtempSync(join(tmpdir(), 'loresmith-restore-'));
  let proxy2;
  try {
    run(['d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', dir2]);
    run(['d1', 'execute', 'DB', '--local', '--persist-to', dir2, '--file', sqlFile]);
    proxy2 = await getPlatformProxy({ configPath: join(ROOT, 'wrangler.toml'), persist: { path: join(dir2, 'v3') } });
    const env2 = { ...env, DB: proxy2.env.DB };

    for (const t of TABLES) {
      const before = (await env.DB.prepare(`select count(*) as n from "${t}"`).first()).n;
      const after = (await env2.DB.prepare(`select count(*) as n from "${t}"`).first()).n;
      assert.equal(after, before, `table ${t}`);
    }

    // Sur la base restaurée : Alice se reconnecte avec son mot de passe et retrouve tout.
    const call = async (method, path, json, cookie = '') => {
      const res = await worker.fetch(new Request('http://localhost:8787' + path, { method, headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json', Cookie: cookie }, body: json ? JSON.stringify(json) : undefined }), env2);
      return { status: res.status, body: await res.json(), cookie: (res.headers.getSetCookie?.() ?? []).map((s) => s.split(';')[0]).join('; ') };
    };
    assert.equal((await call('GET', '/api/me')).status, 401, 'les sessions ne sont pas restaurées : on se reconnecte');
    const login = await call('POST', '/api/auth/sign-in/email', { email: 'alice@exemple.org', password: 'un-mot-de-passe-solide' });
    assert.equal(login.status, 200);
    const pulled = await call('GET', '/api/sync?since=0', null, login.cookie);
    assert.equal(pulled.body.docs.find((d) => d.id === 'n1').data.name, 'Yemena v2');
    assert.deepEqual(pulled.body.universes, { u1: 'owner' });
    const history = await env2.DB.prepare("select count(*) as n from document_versions where id = 'n1'").first();
    assert.equal(history.n, 2, 'l’historique des versions est restauré');
    const members = await call('GET', '/api/universes/u1/members', null, login.cookie);
    assert.deepEqual(members.body.members.map((m) => m.role), ['owner', 'editor']);
  } finally {
    await proxy2?.dispose();
    rmSync(dir2, { recursive: true, force: true });
  }
});

test('rotation : seules les BACKUP_KEEP sauvegardes les plus récentes sont gardées', async () => {
  for (let i = 1; i <= 5; i++) await env.IMAGES.put(`${BACKUP_PREFIX}d1-2000-01-0${i}T00-00-00-000Z.json.gz`, 'ancienne');
  const keep = env.BACKUP_KEEP;
  env.BACKUP_KEEP = '3';
  try {
    await cron();
  } finally {
    env.BACKUP_KEEP = keep;
  }
  const left = await backups();
  assert.equal(left.length, 3);
  assert.equal(left.some((k) => k.includes('2000-01-01')), false, 'les plus anciennes partent d’abord');
  assert.ok(left.some((k) => !k.includes('2000-')), 'la sauvegarde du jour est gardée');
});
