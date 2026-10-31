/** Terrain naturel des cités (d'après le prototype loresmith-terrain) : déterminisme, union des routes, index, tuiles. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerrain, paintTile, paletteOf, polygonDistance, roadDistance } from './naturalTerrain.js';

const roads = [{ points: [[0, 0], [100, 0]], width: 8 }, { points: [[50, -50], [50, 50]], width: 8 }];
const plazas = [{ points: [[200, 200], [230, 200], [230, 230], [200, 230]] }];

test('Même scène, même point : même couleur (coordonnées négatives et lointaines comprises)', () => {
  const a = createTerrain({ seed: 42, roads, plazas }), b = createTerrain({ seed: 42, roads, plazas });
  for (const p of [[-50, -50], [0, 0], [50, 0], [192, 192], [10000, -10000], [215, 215]]) {
    assert.deepEqual(a.sample(...p), b.sample(...p));
    assert.ok(a.sample(...p).every((v) => v >= 0 && v <= 255));
  }
});

test('Routes : distance signée, union sans double couche, index fidèle', () => {
  const t = createTerrain({ seed: 1, roads });
  assert.equal(roadDistance(50, 0, t.segments), -4);
  assert.equal(roadDistance(0, 30, t.segments), 26);
  assert.deepEqual(createTerrain({ seed: 1, roads: [...roads, ...roads] }).sample(50, 0), t.sample(50, 0));
  // L'index ne perd aucun segment utile : même couleur avec ou sans lui.
  for (const p of [[50, 2], [10, -3], [52, 40], [99, 1]]) assert.deepEqual(t.sample(...p, 1, t.segmentsNear(p[0] - 8, p[1] - 8, p[0] + 8, p[1] + 8)), t.sample(...p));
  assert.ok(polygonDistance(215, 215, plazas[0].points) < 0);
  assert.throws(() => createTerrain({ roads }));
});

test('Chemin, place et herbe se distinguent ; la neige blanchit', () => {
  const t = createTerrain({ seed: 7, roads, plazas });
  const lum = (c) => c[0] + c[1] + c[2];
  assert.ok(lum(t.sample(25, 0)) > lum(t.sample(25, 40)), 'la terre du chemin est plus claire que l’herbe');
  const n = createTerrain({ seed: 7, roads, palette: paletteOf({ snow: 0.5 }) });
  assert.ok(lum(n.sample(25, 40)) > 500);
});

test('Tuile : octets RGBA pleins, sans couture (le bord d’une tuile prolonge sa voisine)', () => {
  const t = createTerrain({ seed: 3, roads });
  const a = paintTile(t, [], 0, 0, 64, 32), b = paintTile(t, [], 64, 0, 64, 32);
  assert.equal(a.length, 32 * 32 * 4);
  assert.ok(a.every((v, i) => i % 4 !== 3 || v === 255));
  // Dernière colonne de a et première de b : voisines dans le monde, donc proches en couleur.
  let diff = 0;
  for (let j = 0; j < 32; j++) for (let c = 0; c < 3; c++) diff += Math.abs(a[(j * 32 + 31) * 4 + c] - b[(j * 32) * 4 + c]);
  assert.ok(diff / (32 * 3) < 25, `écart moyen ${diff / 96}`);
});
