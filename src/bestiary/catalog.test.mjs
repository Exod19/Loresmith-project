/** Tests du catalogue du bestiaire : types, familles, ordre de puissance, variantes voisines. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { entityFromUnderdark } from './underdark.js';
import { buildCatalog, siblingsOf, typeOf } from './catalog.js';

const master = JSON.parse(readFileSync(fileURLToPath(new URL('../data/underdark/bestiaire-683.json', import.meta.url)), 'utf8'));
const npcs = master.creatures.map((c, i) => ({ ...entityFromUnderdark(c), id: `n${i}`, entityType: 'monster', isMonster: true }));
const cat = buildCatalog(npcs);

test('chaque fiche est rangée une seule fois, dans un type et une famille', () => {
  const n = cat.reduce((s, t) => s + t.families.reduce((k, f) => k + f.members.length, 0), 0);
  assert.equal(n, npcs.length);
  assert.ok(cat.length >= 8 && cat.length <= 20, `${cat.length} types`);
});
test('la famille Gobelin réunit la souche et ses variantes, de la plus faible à la plus forte', () => {
  const hum = cat.find((t) => t.type === 'Humanoïdes');
  const gob = hum.families.find((f) => f.members.some((m) => m.underdarkId === 'underdark_227'));
  assert.ok(gob.members.length >= 18, `${gob.members.length}`);
  assert.ok(gob.members.some((m) => m.underdarkId === 'underdark_411'));
  const cr = (m) => { const r = String(m.cr); return r.includes('/') ? Number(r.split('/')[0]) / Number(r.split('/')[1]) : Number(r); };
  for (let i = 1; i < gob.members.length; i++) assert.ok(cr(gob.members[i]) >= cr(gob.members[i - 1]));
});
test('variantes voisines : plus faible et plus forte dans la même famille', () => {
  const chef = npcs.find((n) => n.underdarkId === 'underdark_411');
  const s = siblingsOf(chef, npcs);
  assert.ok(s.family && s.weaker);
  assert.ok(s.family.members.includes(s.weaker));
});
test('les fiches sans famille Underdark se regroupent par nom (juvénile / ancien)', () => {
  const ooze = cat.find((t) => t.type === 'Vases et limons');
  const cube = ooze.families.find((f) => /cube g/i.test(f.name));
  assert.ok(cube && cube.members.length >= 2, cube?.members.map((m) => m.name).join(', '));
});
test('types devinés pour les fiches SRD ou écrites à la main', () => {
  assert.equal(typeOf({ name: 'Bandit', kind: 'Humanoïde (toute race)', entityType: 'monster' }), 'Humanoïdes');
  assert.equal(typeOf({ name: 'Loup', type: 'Bête', entityType: 'monster' }), 'Bêtes');
});
