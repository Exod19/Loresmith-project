/** Fouille d'une pièce : DD selon la foule, les gardes et l'heure ; trouvailles souvent sans valeur. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { searchDC, rollFind } from './fouille.js';
import { generateWorld, citySlots, cityPlanId, interiorPlanId } from './generate.js';

test('le DD monte avec la foule et les gardes, baisse la nuit quand tout le monde dort', () => {
  const vide = searchDC({ type: 'echoppe', period: 'nuit', occupants: [] }).dc;
  const dort = searchDC({ type: 'echoppe', period: 'nuit', occupants: [{ role: 'habitant', asleep: true }] }).dc;
  const plein = searchDC({ type: 'echoppe', period: 'jour', occupants: [{ role: 'cliente' }, { role: 'client' }, { role: 'marchand' }] }).dc;
  const garde = searchDC({ type: 'chateau', period: 'jour', occupants: [{ role: 'garde' }, { role: 'garde' }, { role: 'chambellan' }] });
  assert.ok(vide < plein && dort < plein, `${vide} ${dort} ${plein}`);
  assert.ok(garde.dc >= 26, `${garde.dc}`);
  assert.equal(garde.label, 'Presque impossible');
});

test('une fouille réussie rapporte surtout des broutilles ; un échec, rien', () => {
  let seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const kinds = {};
  for (let i = 0; i < 400; i++) { const r = rollFind('Chambre 1', 2, rnd); kinds[r.kind] = (kinds[r.kind] ?? 0) + 1; }
  assert.ok(kinds['sans-valeur'] > kinds.utile && kinds.utile > kinds.notable, JSON.stringify(kinds));
  assert.ok(kinds.rien > 0);
  assert.equal(rollFind('Cuisine', -2, rnd).kind, 'rien');
  assert.equal(rollFind('Cuisine', -8, rnd).kind, 'repere');
});

test('chaque pièce d’un intérieur généré a son DD de fouille', () => {
  const CITY = { id: 'brumeval', name: 'Brumeval', population: 1500, river: true, at: [0.5, 0.5] };
  const slots = citySlots(CITY, cityPlanId('rec', CITY.id));
  const tav = slots.find((s) => s.type === 'taverne');
  const jour = generateWorld({ seed: 2, name: 'Monde', cities: [CITY], bindings: {}, interiors: [tav.id], time: 'soir' }, 'rec');
  const nuit = generateWorld({ seed: 2, name: 'Monde', cities: [CITY], bindings: {}, interiors: [tav.id], time: 'nuit' }, 'rec');
  const pid = interiorPlanId(tav.id);
  const rooms = jour.features.filter((f) => f.id.startsWith(`${pid}:piece-`));
  assert.ok(rooms.length > 1);
  for (const r of rooms) assert.ok(r.fouille?.dc >= 8, r.title);
  const salle = (d) => d.features.find((f) => f.id.startsWith(`${pid}:piece-`) && /Salle/.test(f.title)).fouille.dc;
  assert.ok(salle(nuit) < salle(jour), `nuit ${salle(nuit)} < soir ${salle(jour)}`);
});
