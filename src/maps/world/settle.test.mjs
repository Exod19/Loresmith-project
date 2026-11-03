/** Occupants des intérieurs : chacun à une place plausible (pas sur un meuble, pas l'un sur l'autre, dormeurs au lit). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWorld, citySlots, cityPlanId, interiorPlanId } from './generate.js';

const CITY = { id: 'brumeval', name: 'Brumeval', population: 1500, river: true, at: [0.5, 0.5] };
const W = 1240, H = 1000;

function inRect(x, y, cx, cy, w, h, a) {
  const c = Math.cos(-a), s = Math.sin(-a), dx = x - cx, dy = y - cy;
  return Math.abs(dx * c - dy * s) <= w / 2 && Math.abs(dx * s + dy * c) <= h / 2;
}

test('aucun occupant sur une table, un comptoir ou un autre occupant ; ceux qui dorment sont dans un lit', () => {
  const slots = citySlots(CITY, cityPlanId('rec', CITY.id));
  const picks = ['taverne', 'auberge', 'caserne', 'maison', 'ferme', 'forge', 'temple'].map((t) => slots.find((s) => s.type === t)).filter(Boolean);
  let npcs = 0, sleepers = 0;
  for (const time of ['jour', 'soir', 'nuit']) {
    const d = generateWorld({ seed: 2, name: 'Monde', cities: [CITY], bindings: {}, interiors: picks.map((s) => s.id), time }, 'rec');
    for (const slot of picks) {
      for (const map of d.maps.filter((m) => m.id.startsWith(interiorPlanId(slot.id)))) {
        const g = map.surface.ground, scale = map.surface.scale;
        const pts = d.features.filter((f) => f.id.startsWith(`${map.id}:pnj-`) && !f.id.slice(map.id.length + 1).includes(':'))
          .map((f) => ({ f, at: d.geometries.find((x) => x.featureId === f.id).coordinates.map((v, i) => v * (i ? H : W)) }));
        npcs += pts.length;
        for (const { f, at: [x, y] } of pts) {
          if (f.pose === 'couche') {
            sleepers++;
            assert.ok((g.p ?? []).some(([k, cx, cy, w, h]) => k === 'lit' && inRect(x, y, cx, cy, w, h, 0)), `${f.title} dort dans un lit`);
            continue;
          }
          assert.ok(!/^Dort/.test(f.summary ?? ''), `${f.title} ne dort pas debout (${map.id}, ${time})`);
          for (const flat of [g.f, g.o]) for (let i = 0; i + 4 < (flat ?? []).length; i += 5) {
            assert.ok(!inRect(x, y, flat[i], flat[i + 1], flat[i + 2], flat[i + 3], flat[i + 4]), `${f.title} n'est pas sur un meuble (${map.id}, ${time})`);
          }
        }
        for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
          const dm = Math.hypot(pts[i].at[0] - pts[j].at[0], pts[i].at[1] - pts[j].at[1]) * scale;
          assert.ok(dm >= 0.9, `${pts[i].f.title} et ${pts[j].f.title} à ${dm.toFixed(2)} m (${map.id}, ${time})`);
        }
      }
    }
  }
  assert.ok(npcs > 10, `des occupants (${npcs})`);
  assert.ok(sleepers > 0, 'des dormeurs, la nuit');
});

test('les occupants anonymes ont un genre, cohérent avec leur prénom', () => {
  const slots = citySlots(CITY, cityPlanId('rec', CITY.id));
  const tav = slots.find((s) => s.type === 'taverne');
  const d = generateWorld({ seed: 2, name: 'Monde', cities: [CITY], bindings: {}, interiors: [tav.id], time: 'soir' }, 'rec');
  const gen = d.features.filter((f) => f.id.includes(':pnj-gen-'));
  assert.ok(gen.length > 0);
  for (const f of gen) assert.ok(f.genre === 'f' || f.genre === 'm', f.title);
  const mahaut = gen.find((f) => f.title === 'Mahaut');
  if (mahaut) assert.equal(mahaut.genre, 'f');
});
