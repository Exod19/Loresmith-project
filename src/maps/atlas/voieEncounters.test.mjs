/** Rencontres selon la voie suivie : même fréquence, mais caravanes et patrouilles sur la route royale, brigands et loups en forêt. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'voies-'));
const out = join(dir, 'bundle.mjs');
await build({ stdin: { contents: "export * from './surfaceEncounters'; export * from './encounters';", resolveDir: here, loader: 'ts' }, bundle: true, format: 'esm', platform: 'neutral', outfile: out, logLevel: 'silent' });
const S = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

const share = (pool, pred) => pool.filter(pred).reduce((a, e) => a + e.weight, 0) / pool.reduce((a, e) => a + e.weight, 0);
const hostile = (e) => e.kind === 'Créature';

test('route royale : surtout du monde paisible, des patrouilles ; piste forestière : surtout des dangers', () => {
  const royale = S.surfacePool('transit', 'royale');
  const piste = S.surfacePool('transit', 'piste');
  const col = S.surfacePool('transit', 'col');
  assert.ok(royale.some((e) => e.title === 'Grande caravane') && royale.some((e) => e.kind === 'Patrouille'));
  assert.ok(!royale.some((e) => e.title === 'Meute de loups'), 'pas de loups sur la route royale');
  assert.ok(share(royale, hostile) < 0.1, `danger sur la route royale : ${share(royale, hostile)}`);
  assert.ok(share(piste, hostile) > 0.6, `danger sur une piste forestière : ${share(piste, hostile)}`);
  assert.ok(piste.some((e) => e.title === 'Brigands de grand chemin') && piste.some((e) => e.title === 'Meute de loups'));
  assert.ok(!piste.some((e) => e.title === 'Grande caravane' || e.kind === 'Patrouille'));
  assert.ok(col.some((e) => e.title === 'Contrebandiers du col') && !col.some((e) => e.title === 'Araignées des bois'));
  // Sans voie : la table de toujours, sans les rencontres propres aux voies.
  assert.ok(!S.surfacePool('transit').some((e) => e.voies));
});

test('la fréquence ne dépend pas de la voie', () => {
  const seuil = (voie) => /sur (\d+) ou plus/.exec(S.rollEncounter({ zone: 'transit', depth: 1, place: 'x', surface: true, voie }).check)[1];
  assert.equal(seuil('royale'), seuil('piste'));
  assert.equal(seuil('royale'), seuil(undefined));
});
