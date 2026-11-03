/** Voies de la carte du monde : routes royales, chemins, sentiers, pistes et sentiers de montagne vers les grands lieux. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWorld } from './generate.js';
import { roadKind, trailKind, trailTitle, VOIES } from './voies.js';

test('nature des routes et des sentiers', () => {
  assert.equal(roadKind(3000, 4000), 'royale');
  assert.equal(roadKind(9000, 1200), 'royale');
  assert.equal(roadKind(6000, 900), 'chemin');
  assert.equal(roadKind(1500, 800), 'chemin');
  assert.equal(trailKind({ forest: 0.8 }), 'piste');
  assert.equal(trailKind({ forest: 0.2, high: 0.4 }), 'col');
  assert.equal(trailKind({ forest: 0.2 }), 'sentier');
  assert.equal(trailTitle('piste', 'Forêt de Vaux'), 'Piste forestière vers la forêt de Vaux');
  assert.match(VOIES.royale.text, /patrouill/);
});

test('un monde à l’échelle a ses routes classées et des sentiers vers ses grands lieux', () => {
  const world = { seed: 42, name: 'R', terrain: 2, scale: 'royaume', bindings: {}, cities: [
    { id: 'a', name: 'Brumeval', population: 1500, km: [0, 0] }, { id: 'b', name: 'Givre', population: 800, km: [-120, -110] },
    { id: 'c', name: 'Port', population: 3000, km: [150, 60] }, { id: 'd', name: 'Hautmur', population: 6000, km: [60, -80] }] };
  const d = generateWorld(world, 'r');
  const voies = d.features.filter((f) => f.voie);
  const kinds = new Set(voies.map((f) => f.voie));
  assert.ok(kinds.has('royale'), 'une route royale entre les grandes cités');
  assert.ok(kinds.has('chemin'), 'des chemins vers les plus modestes');
  const trails = voies.filter((f) => ['sentier', 'piste', 'col'].includes(f.voie));
  assert.ok(trails.length >= 3, `des sentiers (${trails.length})`);
  for (const f of voies) {
    assert.ok(f.summary && f.subtitle, f.title);
    const g = d.geometries.find((x) => x.featureId === f.id);
    assert.ok(g && g.type === 'polyline' && g.coordinates.length >= 2, f.title);
  }
  // Un sentier mène à un grand lieu qui existe sur la carte.
  for (const t of trails) assert.ok(d.features.some((f) => t.id.endsWith(f.id.split(':').pop())), t.id);
  // Toujours le même monde pour les mêmes paramètres.
  const again = generateWorld(world, 'r');
  assert.deepEqual(again.features.filter((f) => f.voie).map((f) => f.id), voies.map((f) => f.id));
});
