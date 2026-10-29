#!/usr/bin/env node
/**
 * Convertit une sauvegarde (backups/d1-….json.gz, téléchargée de R2) en SQL de restauration.
 *   npm run backup:sql -- d1-2026-11-01.json.gz > restauration.sql
 * Le SQL s'applique sur une base neuve et migrée : voir « Restaurer une sauvegarde » dans server/README.md.
 */
import { readFileSync } from 'node:fs';
import { backupToSql, readBackup } from '../src/backup.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage : npm run backup:sql -- <sauvegarde.json.gz> > restauration.sql');
  process.exit(1);
}
process.stdout.write(backupToSql(await readBackup(new Uint8Array(readFileSync(file)))));
