/** Ce qu'on voit en entrant : l'évident dans le champ de vision, rien derrière un mur, rien de caché. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWorld, citySlots, cityPlanId, interiorPlanId } from './generate.js';
import { visibleFrom, blocked } from './sight.js';

const CITY = { id: 'brumeval', name: 'Brumeval', population: 1500, river: true, at: [0.5, 0.5] };

test('un mur coupe la vue, une ouverture la laisse passer', () => {
  const walls = [{ pts: [0, 5, 4, 5], hw: 0.1 }, { pts: [6, 5, 10, 5], hw: 0.1 }];
  assert.equal(blocked(walls, 2, 0, 2, 10), true);
  assert.equal(blocked(walls, 5, 0, 5, 10), false, 'par la porte');
});

test('en entrant dans une taverne, on voit les clients de la salle, pas ceux de la cuisine ni les PNJ cachés', () => {
  const slots = citySlots(CITY, cityPlanId('rec', CITY.id));
  const tav = slots.find((s) => s.type === 'taverne');
  const binding = { entryId: 'chope', cityId: CITY.id, slotId: tav.id, type: 'taverne', title: 'La Chope', hint: 'taverne|', npcs: [
    { id: 'ombre', name: 'L’Ombre', role: 'espion', desc: 'Embusqué dans la salle commune.' },
  ] };
  const d = generateWorld({ seed: 2, name: 'Monde', cities: [CITY], bindings: { chope: binding }, interiors: [tav.id], time: 'soir' }, 'rec');
  const pid = interiorPlanId(tav.id);
  const map = d.maps.find((m) => m.id === pid);
  const entree = d.geometries.find((g) => g.featureId === `${pid}:entree`).coordinates;
  const seen = new Set(visibleFrom(map, entree, d.features, d.geometries));
  const npcs = d.features.filter((f) => f.id.startsWith(`${pid}:pnj-`));
  assert.ok(npcs.some((f) => seen.has(f.id)), 'des occupants sont visibles');
  assert.ok(!seen.has(`${pid}:pnj-ombre`), 'l’espion caché reste caché');
  // Rien de ce qu'on voit n'est derrière un mur.
  const W = map.width, H = map.height;
  for (const id of seen) {
    const g = d.geometries.find((x) => x.featureId === id && x.type === 'point');
    if (g) assert.ok(!blocked(map.surface.ground.walls, entree[0] * W, entree[1] * H, g.coordinates[0] * W, g.coordinates[1] * H), id);
  }
  // L'étage n'est pas sur ce plan.
  assert.ok(![...seen].some((id) => id.startsWith(`${pid}:e1:`)));
});
