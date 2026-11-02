/** Lieux sauvages : tirage déterministe sur le vrai terrain, densité, teneurs, et lieux enregistrés qui ne bougent pas. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from './terrain.js';
import { cellSites, wildSitesIn, WILD_CELL, whereLabel } from './wilds.js';

const frame = T.worldFrame({ terrain: 2, scale: 'royaume', seed: 42 });
const cities = [{ name: 'Brumeval', km: [frame.x0 + 200, frame.y0 + 150], r: 1.5 }, { name: 'Arnfel', km: [frame.x0 + 320, frame.y0 + 260], r: 1 }];
const relief = T.reliefOf({ seed: 42 }, frame, cities.map((c) => ({ km: c.km, population: 1500 })));
const roads = [[cities[0].km, cities[1].km]];
const ctx = { seed: 42, relief, cities, roads };
const box = [frame.x0 + 100, frame.y0 + 80, frame.x0 + 300, frame.y0 + 230];

test('les lieux sauvages sont toujours les mêmes, et dépendent de la graine', () => {
  const a = wildSitesIn(ctx, box);
  assert.equal(JSON.stringify(a), JSON.stringify(wildSitesIn(ctx, box)));
  const b = wildSitesIn({ ...ctx, seed: 7 }, box);
  assert.notEqual(JSON.stringify(a.map((s) => s.key)), JSON.stringify(b.map((s) => s.key)));
});

test('densité normale : environ 0,65 lieu par case de 100 km², jamais en mer ni dans une cité', () => {
  const sites = wildSitesIn(ctx, box);
  const cells = ((box[2] - box[0]) / WILD_CELL + 1) * ((box[3] - box[1]) / WILD_CELL + 1);
  const per = sites.length / cells;
  assert.ok(per > 0.35 && per < 0.85, `lieux par case : ${per.toFixed(2)}`);
  for (const s of sites) {
    assert.ok(!T.terrainAt(relief, ...s.km).sea, `${s.title} en mer`);
    for (const c of cities) assert.ok(Math.hypot(c.km[0] - s.km[0], c.km[1] - s.km[1]) >= c.r * 1.6, `${s.title} dans ${c.name}`);
    assert.ok(s.text.length > 20 && s.title.startsWith(s.label));
    if (s.teneur === 'scene') assert.ok(s.scene);
    if (s.teneur === 'quete') assert.ok(s.hook);
  }
  const amb = sites.filter((s) => s.teneur === 'ambiance').length / sites.length;
  assert.ok(amb > 0.35 && amb < 0.75, `part d’ambiance : ${amb.toFixed(2)}`);
});

test('le type suit le terrain : montagne, forêt ou plaine', () => {
  const sites = wildSitesIn(ctx, [frame.x0, frame.y0, frame.x1, frame.y1]);
  const kinds = new Set(sites.map((s) => s.kind));
  assert.ok(kinds.size >= 8, `types variés : ${[...kinds].join(', ')}`);
  for (const s of sites.filter((x) => x.kind === 'nid-wyverne')) assert.ok(s.e > 1400, `${s.title} à ${s.e} m`);
  for (const s of sites.filter((x) => x.kind === 'oasis')) assert.equal(s.biome, 'desert');
});

test('un lieu enregistré est écarté du tirage, sans déplacer les autres lieux de sa case', () => {
  let cell = null;
  for (let i = 10; i < 60 && !cell; i++) for (let j = 10; j < 40 && !cell; j++) if (cellSites(ctx, i, j).length === 2) cell = [i, j];
  assert.ok(cell, 'une case à deux lieux');
  const [first, second] = cellSites(ctx, ...cell);
  const rest = cellSites(ctx, ...cell, new Set([first.key]));
  assert.equal(rest.length, 1);
  assert.equal(JSON.stringify(rest[0]), JSON.stringify(second));
  assert.match(whereLabel(second), /^à \d+ km (au|à l’) .+ de (Brumeval|Arnfel)$/);
});

test('vu depuis la route : plus loin en terrain dégagé, 1,5 km au plus en forêt, et un DD pour les lieux cachés', async () => {
  const { sightOf } = await import('./wilds.js');
  const fees = sightOf({ key: '1_2_0', kind: 'cercle-fees', biome: 'tempere', e: 200 }, 0.9);
  assert.equal(fees.dc, 15);
  assert.ok(fees.km <= 1.5);
  assert.match(fees.line, /\{c\}/);
  const tour = sightOf({ key: '1_2_0', kind: 'tour-guet', biome: 'tempere', e: 200 }, 0);
  assert.ok(tour.km > 4 && !tour.dc);
  assert.ok(sightOf({ key: 'x', kind: 'tour-guet', biome: 'tempere', e: 200 }, 0.8).km <= 1.5, 'la forêt cache même une tour');
});

test('les descriptions varient : un même type a de nombreux textes différents', () => {
  const sites = wildSitesIn(ctx, [frame.x0, frame.y0, frame.x1, frame.y1]);
  const byKind = new Map();
  for (const s of sites) byKind.set(s.kind, [...(byKind.get(s.kind) ?? []), s.text]);
  const [kind, texts] = [...byKind.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  assert.ok(new Set(texts).size >= Math.min(12, texts.length / 3), `${kind} : ${new Set(texts).size} textes pour ${texts.length} lieux`);
});
