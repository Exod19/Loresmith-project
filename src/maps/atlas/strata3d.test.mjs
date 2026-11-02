// Atlas en strates : profondeurs stables, arrêts seulement aux ouvertures, arrivée au plafond = descente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'strata3d-'));
const out = join(dir, 'bundle.mjs');
await build({ stdin: { contents: "export * from './strata3d';", resolveDir: here, loader: 'ts' }, bundle: true, format: 'esm', platform: 'neutral', outfile: out, logLevel: 'silent', define: { 'import.meta.env': '{"BASE_URL":"/"}' } });
const S = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });
const data = JSON.parse(readFileSync(join(here, '../../../public/feeds/underdark.json'), 'utf8')).atlas;
const PLAN = 'carte-n1-s3';
const geos = data.geometries.filter((g) => g.mapId === PLAN && g.type === 'polyline');

test('les strates descendent, et chaque grotte a un palier stable', () => {
  assert.ok(S.planTop(data, 'carte-n1-s1') > S.planTop(data, 'carte-n1-s3'));
  const c = data.cavities[PLAN][0];
  assert.deepEqual(S.caveDepth(c, -150), S.caveDepth(c, -150));
  const d = S.caveDepth(c, -150);
  assert.ok(d.palier >= 1 && d.palier <= 4 && d.ceiling > d.floor);
});

test('un passage ne s’arrête jamais dans une salle croisée sans ouverture', () => {
  let checked = 0;
  for (const g of geos) {
    const p = S.passage3d(data, PLAN, g);
    const closed = p.crossings.filter((c) => !c.open);
    if (!closed.length || !p.ends[0]) continue;
    const start = p.pts[0];
    const legs = S.legs3dOf(data, PLAN, g, start, g.trace);
    const closedIds = new Set(closed.map((c) => S.cavePlace(data, PLAN, c.cave).id));
    for (const l of legs) if (l.to) assert.ok(!closedIds.has(l.to.id) || p.crossings.some((c) => c.open && S.cavePlace(data, PLAN, c.cave).id === l.to.id), 'arrêt dans une salle sans ouverture');
    if (++checked > 40) break;
  }
  assert.ok(checked > 0);
});

test('arriver par le plafond annonce une descente (épreuve)', () => {
  const g = geos.find((q) => S.passage3d(data, PLAN, q).ends.some((e) => e && e.opening === 'plafond'));
  assert.ok(g, 'au moins un passage arrive au plafond');
  const p = S.passage3d(data, PLAN, g);
  const end = p.ends.find((e) => e?.opening === 'plafond');
  assert.ok(end.drop > 0);
  const from = end === p.ends[1] ? p.pts[0] : p.pts[p.pts.length - 1];
  const leg = S.legs3dOf(data, PLAN, g, from).find((l) => l.v3.opening === 'plafond');
  if (leg && leg.v3.drop >= 3) assert.ok(S.arrivalHazard(leg));
});
