import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPixel, tileCells, isFordTile } from './tiles.js';

test('pixels : eau claire, eau profonde, herbe, gouffre, roche, galets d’un gué', () => {
  assert.equal(classifyPixel(70, 150, 160), 'eau_peu_profonde');
  assert.equal(classifyPixel(11, 47, 49), 'eau_profonde');
  assert.equal(classifyPixel(90, 120, 50), 'herbe');
  assert.equal(classifyPixel(10, 10, 12), 'gouffre');
  assert.equal(classifyPixel(140, 138, 132), 'granite');
  assert.equal(classifyPixel(150, 140, 120, true), 'gue');
});

test('une rivière verticale au milieu de la tuile devient une bande d’eau au milieu du plateau', () => {
  const w = 30, h = 30, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = (y * w + x) * 4, river = x >= 12 && x < 18;
    data.set(river ? [60, 140, 155, 255] : [90, 125, 50, 255], k);
  }
  const cells = tileCells(data, w, h, 10, 6);
  assert.equal(cells.length, 60);
  // Plateau 10 × 6 : l'image carrée est rognée en haut et en bas ; la rivière (40 % à 60 % de la largeur) tombe en colonnes 4 et 5.
  for (let y = 0; y < 6; y++) {
    assert.equal(cells[y * 10 + 4], 'eau_peu_profonde');
    assert.equal(cells[y * 10 + 5], 'eau_peu_profonde');
    assert.equal(cells[y * 10 + 0], 'herbe');
    assert.equal(cells[y * 10 + 9], 'herbe');
  }
});

test('tuile de gué reconnue par son nom', () => {
  assert.ok(isFordTile({ id: 'gue-de-galets-sur-riviere-peu-profonde' }));
  assert.ok(!isFordTile({ id: 'riviere-centrale-entre-herbe-et-terre' }));
});

test('une ombre isolée au milieu d’un ravin reste du gouffre', () => {
  const w = 24, h = 24, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = (y * w + x) * 4, ravine = y >= 9 && y < 15, shadow = y === 12 && x === 12;
    data.set(shadow ? [60, 58, 55, 255] : ravine ? [8, 8, 8, 255] : [140, 138, 132, 255], k);
  }
  const cells = tileCells(data, w, h, 8, 8);
  assert.equal(cells[4 * 8 + 4], 'gouffre');
  assert.equal(cells[0], 'granite');
});
