/** Les environs, à pied : petits lieux au kilomètre (ruisseaux, sentiers, clairières…) et plan de zone de quelques km. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from './terrain.js';
import { nookSitesIn, spotSite, kindLabel } from './wilds.js';
import { generateZonePlan, zoneBox, zoneAt, zoneKey, ZONE_W } from './zonePlan.js';
import { generateWildPlan } from './wildPlan.js';

const frame = T.worldFrame({ terrain: 2, scale: 'royaume', seed: 42 });
const cities = [{ name: 'Brumeval', km: [frame.x0 + 200, frame.y0 + 150], r: 1.5 }];
const relief = T.reliefOf({ seed: 42 }, frame, cities.map((c) => ({ km: c.km, population: 1500 })));
const ctx = { seed: 42, relief, cities, roads: [] };
// Un coin boisé de la carte (le premier point en forêt trouvé en balayant).
let woods = null;
for (let y = frame.y0 + 40; !woods && y < frame.y1 - 40; y += 7) for (let x = frame.x0 + 40; x < frame.x1 - 40; x += 7) { const t = T.terrainAt(relief, x, y); if (!t.sea && t.forest > 0.7 && t.e < 900) { woods = [x, y]; break; } }

test('les petits lieux sont stables, nombreux en forêt, jamais en mer, et ont un type connu', () => {
  assert.ok(woods, 'une forêt sur la carte de test');
  const box = zoneBox(woods);
  const a = nookSitesIn(ctx, box);
  assert.equal(JSON.stringify(a), JSON.stringify(nookSitesIn(ctx, box)));
  assert.ok(a.length >= 4, `petits lieux dans 13 km² de forêt : ${a.length}`);
  for (const s of a) {
    assert.ok(!T.terrainAt(relief, ...s.km).sea);
    assert.ok(s.nook && s.key.startsWith('n'));
    assert.notEqual(kindLabel(s.kind), 'Lieu');
    assert.ok(['calme', 'incertain'].includes(s.danger));
  }
  // Variété : plusieurs types différents (ruisseau, sentier, clairière, vieux chêne…).
  assert.ok(new Set(a.map((s) => s.kind)).size >= 3);
});

test('n’importe quel point en pleine nature : un sous-bois en forêt, une clé stable', () => {
  const s = spotSite(ctx, woods, 'Cœur de la forêt');
  assert.equal(s.kind, 'sous-bois');
  assert.equal(s.title, 'Cœur de la forêt');
  assert.equal(spotSite(ctx, woods, 'x').key, s.key);
});

test('plan des environs : arbres partout en forêt, ruisseau et sentier pour les petits lieux, positions cohérentes', () => {
  const sites = nookSitesIn(ctx, zoneBox(woods));
  const brook = { key: 'test', km: [woods[0] + 0.3, woods[1]], kind: 'ruisseau' };
  const map = generateZonePlan({ key: zoneKey(woods), km: woods, title: 'Bois · environs' }, 'p', {
    seed: 42, sites: [...sites, brook],
    sample: (x, y) => { const t = T.terrainAt(relief, x, y); return { forest: t.forest, e: t.e, biome: t.biome, moist: t.moist, water: !!t.sea }; },
  });
  const t = map.surface.ground.t;
  assert.ok(t.length / 3 > 800, `arbres : ${t.length / 3}`);
  assert.ok(Math.max(...t.filter((_, i) => i % 3 === 0)) > ZONE_W * 0.9, 'les arbres couvrent toute la largeur');
  assert.ok(map.surface.ground.water.some((w) => !w.closed), 'un ruisseau');
  assert.ok(map.surface.ground.roads.length >= 1, 'des sentiers');
  assert.ok(map.decor.some((d) => d.kind === 'forest'), 'canopée visible de loin');
  assert.deepEqual(zoneAt(woods, woods), [0.5, 0.5]);
  assert.equal(JSON.stringify(map), JSON.stringify(generateZonePlan({ key: zoneKey(woods), km: woods, title: 'Bois · environs' }, 'p', {
    seed: 42, sites: [...sites, brook], sample: (x, y) => { const q = T.terrainAt(relief, x, y); return { forest: q.forest, e: q.e, biome: q.biome, moist: q.moist, water: !!q.sea }; },
  })));
});

test('chaque petit lieu a son plan visitable, avec son aménagement et ses points d’intérêt', () => {
  for (const kind of ['ruisseau', 'gue', 'sentier', 'vieux-chene', 'arbre-tombe', 'rochers', 'mare', 'fourre', 'cueillette', 'bosquet', 'eboulis', 'sous-bois', 'campagne']) {
    const plan = generateWildPlan({ key: `k-${kind}`, kind, cat: 'vivant', title: kind, forest: 0.8, biome: 'tempere', e: 300 }, `p-${kind}`, 1);
    assert.ok(plan.features.length >= 1, `${kind} : points d’intérêt`);
    assert.equal(plan.map.surface.nature, true);
  }
  const brook = generateWildPlan({ key: 'b', kind: 'ruisseau', cat: 'eau', title: 'R', forest: 0.8, biome: 'tempere', e: 300 }, 'pb', 1);
  assert.ok(brook.map.surface.ground.water.length >= 1, 'le ruisseau coule dans son plan');
});
