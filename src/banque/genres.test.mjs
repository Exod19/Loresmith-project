import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fitsGenres, genresOf } from './genres.js';

test('genres : commun partout, spécifique seulement chez lui, ancien univers en fantasy', () => {
  assert.deepEqual(genresOf({}), ['fantasy']);
  assert.deepEqual(genresOf({ genres: ['scifi'] }), ['scifi']);
  assert.ok(fitsGenres({ genres: ['*'] }, ['scifi']));
  assert.ok(fitsGenres({ genres: ['fantasy'] }, ['fantasy', 'steampunk']));
  assert.ok(!fitsGenres({ genres: ['fantasy'] }, ['scifi']));
  assert.ok(fitsGenres({}, ['fantasy']));
  assert.ok(!fitsGenres({}, ['moderne']));
});

test('catalogue : aucun personnage ni aucune créature n’est commun à tous les univers', () => {
  const imgs = JSON.parse(readFileSync(new URL('./catalogue.json', import.meta.url), 'utf8')).images;
  for (const e of imgs) {
    assert.ok(Array.isArray(e.genres) && e.genres.length, e.id);
    if (e.type === 'personnage' || e.type === 'creature') assert.ok(!e.genres.includes('*'), e.id);
  }
  // Un univers futuriste ne reçoit aucun personnage ni aucune créature de fantasy.
  assert.ok(!imgs.some((e) => (e.type === 'personnage' || e.type === 'creature') && fitsGenres(e, ['scifi'])));
});
