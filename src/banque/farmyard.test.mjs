/** Cours de ferme : bétail et objets posés autour des fermes d'un village, jamais sur un bâtiment ni sur une rue. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { farmyardSprites } from './farmyard.js';
import { generateCity } from '../maps/world/generate.js';

const cat = JSON.parse(readFileSync(new URL('./catalogue.json', import.meta.url), 'utf8')).images;
const VILLAGE = { id: 'v', name: 'Les Ormes', seed: 11, population: 160, village: true, walls: false, castle: false, highTown: false, faubourgs: false, farms: true, river: false, at: [0.5, 0.5] };

test('un village a des fermes, et leurs cours ont du bétail et des objets de ferme à leur taille réelle', () => {
  const { map } = generateCity(VILLAGE, 'p');
  const g = map.surface.ground, s = map.surface.scale;
  assert.ok(g.fm.length >= 6 && g.fm.length % 6 === 0, 'fermes listées');
  const sp = farmyardSprites(g, s, cat, { climat: 'tempere', saison: 'ete' }, map.id);
  const beasts = sp.filter((x) => x.img.type === 'creature'), props = sp.filter((x) => x.img.type === 'element');
  assert.ok(beasts.length >= g.fm.length / 6, 'au moins une bête par ferme en moyenne');
  assert.ok(props.length > 0 && props.every((x) => x.img.cat === 'ferme'));
  for (const x of sp) assert.ok(Math.max(x.w, x.h) * s < 6, `${x.img.nom} : taille réelle`);
  // Rien sur un bâtiment.
  for (const x of sp) for (let i = 0; i + 4 < g.b.length; i += 5) {
    const [cx, cy, w, d, a] = g.b.slice(i, i + 5), c = Math.cos(-a), sn = Math.sin(-a), dx = x.x - cx, dy = x.y - cy;
    assert.ok(!(Math.abs(dx * c - dy * sn) < w / 2 && Math.abs(dx * sn + dy * c) < d / 2), `${x.img.nom} sur un bâtiment`);
  }
  // Déterministe.
  assert.deepEqual(farmyardSprites(g, s, cat, { climat: 'tempere', saison: 'ete' }, map.id).map((x) => x.key), sp.map((x) => x.key));
  // En hiver, peu de bêtes dehors.
  const hiver = farmyardSprites(g, s, cat, { climat: 'tempere', saison: 'hiver' }, map.id).filter((x) => x.img.type === 'creature');
  assert.ok(hiver.length < beasts.length);
});
