/**
 * Sauvegarde de la base D1 dans le stockage de fichiers (KV, cf. store.js), et conversion d'une sauvegarde en SQL.
 *
 * - Une tâche planifiée (cron du Worker) copie chaque jour les tables utiles dans un fichier JSON compressé
 *   `backups/d1-<date>.json.gz` du stockage de fichiers. Les sessions et jetons de vérification, éphémères, n'y sont pas :
 *   après une restauration, chacun se reconnecte simplement.
 * - Les `BACKUP_KEEP` sauvegardes les plus récentes sont gardées (30 par défaut) ; les plus anciennes sont retirées.
 * - Restauration : `npm run backup:sql -- fichier.json.gz > restauration.sql`, puis
 *   `wrangler d1 execute DB --file restauration.sql` sur une base neuve, déjà migrée (cf. server/README.md).
 */

import { blobStore } from './store.js';

export const BACKUP_FORMAT = 'loresmith-d1-backup';
export const BACKUP_PREFIX = 'backups/';

/** Tables sauvegardées, dans l'ordre où les restaurer (un compte avant ce qui s'y rattache). */
export const TABLES = ['user', 'account', 'universe_members', 'campaign_members', 'documents', 'document_versions', 'images', 'invitations', 'terms_acceptances'];

/** Copie des tables. Retourne un objet sérialisable. */
export async function dumpDatabase(db, now = Date.now()) {
  const tables = {};
  for (const t of TABLES) tables[t] = (await db.prepare(`select * from "${t}"`).all()).results;
  const migrations = await db.prepare('select name from d1_migrations order by id').all().then((r) => r.results.map((m) => m.name), () => []);
  return { format: BACKUP_FORMAT, version: 1, createdAt: new Date(now).toISOString(), migrations, tables };
}

async function gzip(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

/** Lit une sauvegarde (JSON, compressé ou non). */
export async function readBackup(bytes) {
  const text = bytes[0] === 0x1f && bytes[1] === 0x8b ? await gunzip(bytes) : new TextDecoder().decode(bytes);
  const backup = JSON.parse(text);
  if (backup.format !== BACKUP_FORMAT) throw new Error('Ce fichier n’est pas une sauvegarde Loresmith.');
  return backup;
}

/** Sauvegarde du jour dans le stockage de fichiers, puis rotation. Retourne la clé écrite et le nombre de lignes par table. */
export async function backupNow(env, now = Date.now()) {
  const store = blobStore(env);
  const dump = await dumpDatabase(env.DB, now);
  const key = `${BACKUP_PREFIX}d1-${new Date(now).toISOString().replace(/[:.]/g, '-')}.json.gz`;
  await store.put(key, await gzip(JSON.stringify(dump)), { contentType: 'application/gzip' });
  const keep = Number(env.BACKUP_KEEP) || 30;
  const listed = await store.keys(BACKUP_PREFIX);
  // Les noms commencent par la date ISO : l'ordre alphabétique est l'ordre chronologique.
  const old = listed.sort().slice(0, Math.max(0, listed.length - keep));
  if (old.length) await store.delete(old);
  return { key, rows: Object.fromEntries(Object.entries(dump.tables).map(([t, r]) => [t, r.length])), removed: old.length };
}

const literal = (v) => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null';
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replace(/'/g, "''")}'`;
};

/** Instructions SQL qui recréent les lignes d'une sauvegarde dans une base neuve (déjà migrée, donc vide). */
export function backupToSql(backup) {
  const lines = [`-- Restauration de la sauvegarde Loresmith du ${backup.createdAt}`, `-- Migrations attendues : ${backup.migrations.join(', ') || 'inconnues'}`];
  for (const t of TABLES) {
    for (const row of backup.tables[t] || []) {
      const cols = Object.keys(row);
      lines.push(`insert into "${t}" (${cols.map((c) => `"${c}"`).join(', ')}) values (${cols.map((c) => literal(row[c])).join(', ')});`);
    }
  }
  return lines.join('\n') + '\n';
}
