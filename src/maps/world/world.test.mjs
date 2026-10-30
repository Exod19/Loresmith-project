/** Carte du monde : génération déterministe des cités et du monde, sol de combat, ancrage du lore. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCity, generateWorld, placeCity, rasterGround, citySlots, cityPlanId, worldPlanId } from './generate.js';
import { citySpecFromEntry, classifyPlace, isSettlement, parsePopulation, syncBindings, npcsOf } from './lore.js';

const CITY = { id: 'brumeval', name: 'Brumeval', population: 1500, river: true };

test('une cité est toujours la même pour les mêmes paramètres', () => {
  const a = generateCity(CITY, 'p');
  const b = generateCity(CITY, 'p');
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const c = generateCity({ ...CITY, seed: 7 }, 'p');
  assert.notEqual(JSON.stringify(a.map.surface.ground.b), JSON.stringify(c.map.surface.ground.b));
});

test('une cité de 1 500 habitants a une muraille, un château, une haute-ville, des faubourgs et des fermes', () => {
  const c = generateCity(CITY, 'p');
  assert.ok(c.stats.buildings > 200, `bâtiments : ${c.stats.buildings}`);
  assert.ok(c.map.decor.some((d) => d.kind === 'wall'), 'muraille');
  const types = new Set(c.slots.map((s) => s.type));
  for (const t of ['chateau', 'temple', 'taverne', 'auberge', 'forge', 'echoppe', 'maison', 'ferme']) assert.ok(types.has(t), `type ${t}`);
  const districts = new Set(c.slots.map((s) => s.district));
  for (const d of ['chateau', 'haute', 'ville', 'faubourg', 'ferme']) assert.ok(districts.has(d), `quartier ${d}`);
  assert.equal(new Set(c.slots.map((s) => s.id)).size, c.slots.length, 'emplacements uniques');
  // Tout est dans le plan.
  for (const g of c.geometries) {
    const pts = g.type === 'point' ? [g.coordinates] : g.coordinates;
    for (const [x, y] of pts) assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1, `${g.id} hors du plan`);
  }
});

test('un petit village n’a ni muraille ni château', () => {
  const c = generateCity({ id: 'v', name: 'Valmère', population: 300 }, 'p');
  assert.ok(!c.map.decor.some((d) => d.kind === 'wall'));
  assert.ok(!c.slots.some((s) => s.type === 'chateau'));
});

test('ajouter une cité ne change ni la position ni le plan des autres', () => {
  const world = { seed: 42, name: 'Monde', cities: [], bindings: {} };
  world.cities.push({ ...CITY, at: placeCity(world, CITY.id) });
  const before = generateWorld(world, 'rec');
  world.cities.push({ id: 'rocfort', name: 'Rocfort', population: 4000, at: placeCity(world, 'rocfort') });
  const after = generateWorld(world, 'rec');
  const pid = cityPlanId('rec', CITY.id);
  const plan = (d) => JSON.stringify(d.maps.find((m) => m.id === pid));
  assert.equal(plan(before), plan(after));
  assert.ok(after.features.some((f) => f.id.includes(':route-')), 'une route relie les deux cités');
});

test('le monde relie chaque porte de cité au plan monde', () => {
  const world = { seed: 1, name: 'Monde', cities: [{ ...CITY, at: [0.4, 0.5] }, { id: 'r', name: 'Rocfort', population: 3000, at: [0.7, 0.4] }], bindings: {} };
  const d = generateWorld(world, 'rec');
  assert.equal(d.maps[0].id, worldPlanId('rec'));
  const ids = new Set(d.anchors.map((a) => a.id));
  assert.ok(d.connections.length >= 4);
  for (const c of d.connections) assert.ok(ids.has(c.fromAnchorId) && ids.has(c.toAnchorId), c.id);
  const fids = new Set(d.features.map((f) => f.id));
  for (const g of d.geometries) assert.ok(fids.has(g.featureId), g.id);
  assert.equal(new Set(d.features.map((f) => f.id)).size, d.features.length, 'lieux uniques');
});

test('la carte de combat reprend les vrais bâtiments, toujours de la même façon', () => {
  const c = generateCity(CITY, 'p');
  const m = c.map;
  const market = c.geometries.find((g) => g.featureId === 'p:marche').coordinates;
  const win = { x0: market[0] - 0.03, y0: market[1] - 0.025, w: 0.06, h: 0.05 };
  const g1 = rasterGround(m.surface, m.width, m.height, win, 24, 16, 3);
  const g2 = rasterGround(m.surface, m.width, m.height, win, 24, 16, 3);
  assert.equal(g1, g2);
  assert.equal(g1.length, 24 * 16);
  assert.ok(g1.includes('#') && g1.includes('.'), g1);
});

test('une fiche de cité donne ses paramètres', () => {
  const e = { id: 'e1', archiveType: 'place', title: 'Brumeval', subtitle: 'Cité fortifiée des humains', population: 'environ 1 500 habitants',
    body: 'Derrière ses murailles, la haute-ville des nobles et bourgeois domine les faubourgs et leurs échoppes. Le château royal veille. Au-delà, les fermes.' };
  assert.equal(parsePopulation(e), 1500);
  assert.ok(isSettlement(e));
  const s = citySpecFromEntry(e);
  assert.deepEqual([s.walls, s.castle, s.highTown, s.faubourgs, s.farms, s.population, s.people], [true, true, true, true, true, 1500, 'humains']);
});

test('une auberge du lore prend la place d’un bâtiment non découvert, avec sa tenancière', () => {
  const world = { seed: 3, name: 'Monde', cities: [{ ...CITY, at: [0.5, 0.5], entryId: 'city' }], bindings: {} };
  const places = [
    { id: 'city', archiveType: 'place', title: 'Brumeval', subtitle: 'Cité', population: 1500 },
    { id: 'chope', archiveType: 'place', title: 'La Chope Cassée', shortSummary: 'Taverne bruyante de Brumeval, près de la porte.', createdAt: 2 },
    { id: 'foret', archiveType: 'place', title: 'Forêt des Murmures', body: 'Une vieille maison abandonnée.', createdAt: 3 },
  ];
  assert.deepEqual(classifyPlace(places[1]), { type: 'taverne', district: null });
  assert.equal(classifyPlace(places[2]), null);
  const people = [{ id: 'margot', name: 'Margot Lafleur', role: 'tenancière', description: 'Elle tient la Chope Cassée d’une main de fer.' }];
  assert.deepEqual(npcsOf(places[1], people).map((n) => n.name), ['Margot Lafleur']);
  const r = syncBindings({ world, mapRecordId: 'rec', places, people });
  assert.ok(r.changed);
  const b = r.bindings.chope;
  const slots = citySlots(world.cities[0], cityPlanId('rec', CITY.id));
  assert.equal(slots.find((s) => s.id === b.slotId).type, 'taverne');
  assert.deepEqual(b.npcs.map((n) => n.role), ['tenancière']);
  assert.ok(!r.bindings.foret, 'un site naturel n’est pas posé en ville');
  // La carte montre l'auberge sous son nom, avec la tenancière.
  const d = generateWorld({ ...world, bindings: r.bindings }, 'rec');
  const f = d.features.find((x) => x.id === b.slotId);
  assert.equal(f.title, 'La Chope Cassée');
  assert.match(f.summary, /Margot Lafleur \(tenancière\)/);
  // Rien n'a changé : aucune réécriture.
  assert.equal(syncBindings({ world: { ...world, bindings: r.bindings }, mapRecordId: 'rec', places, people }).changed, false);
});

test('un lieu non découvert suit sa fiche ; un lieu découvert reste en place et la contradiction est signalée', () => {
  const world = { seed: 3, name: 'Monde', cities: [{ ...CITY, at: [0.5, 0.5] }], bindings: {} };
  const place = { id: 'forge', archiveType: 'place', title: 'Forge de Brom', currentLocation: 'Brumeval, dans un faubourg' };
  const r1 = syncBindings({ world, mapRecordId: 'rec', places: [place] });
  assert.equal(r1.bindings.forge.district, 'faubourg');
  const moved = { ...place, currentLocation: 'Brumeval, en haute-ville' };
  const r2 = syncBindings({ world: { ...world, bindings: r1.bindings }, mapRecordId: 'rec', places: [moved] });
  assert.notEqual(r2.bindings.forge.slotId, r1.bindings.forge.slotId, 'non découvert : il suit la fiche');
  const revealed = new Set([r2.bindings.forge.slotId]);
  const back = { ...place, currentLocation: 'Brumeval, dans un faubourg' };
  const r3 = syncBindings({ world: { ...world, bindings: r2.bindings }, mapRecordId: 'rec', places: [back], revealed });
  assert.equal(r3.bindings.forge.slotId, r2.bindings.forge.slotId, 'découvert : il reste où il est');
  assert.match(r3.bindings.forge.conflict, /déjà découvert/);
  // Fiche supprimée : le lieu reste, signalé.
  const r4 = syncBindings({ world: { ...world, bindings: r3.bindings }, mapRecordId: 'rec', places: [], revealed });
  assert.equal(r4.bindings.forge.orphan, true);
});

test('un bâtiment a toujours le même intérieur, avec ses PNJ à leur place', async () => {
  const { interiorPlanId } = await import('./generate.js');
  const city = { ...CITY, at: [0.5, 0.5] };
  const slots = citySlots(city, cityPlanId('rec', CITY.id));
  const tav = slots.find((s) => s.type === 'taverne');
  const binding = { entryId: 'chope', cityId: CITY.id, slotId: tav.id, type: 'taverne', title: 'La Chope Cassée', hint: 'taverne|',
    npcs: [{ id: 'margot', name: 'Margot', role: 'tenancière' }, { id: 'brute', name: 'Brute', role: 'videur' }] };
  const world = { seed: 2, name: 'Monde', cities: [city], bindings: { chope: binding }, interiors: [tav.id] };
  const a = generateWorld(world, 'rec'), b = generateWorld(world, 'rec');
  const pid = interiorPlanId(tav.id);
  const plan = (d) => d.maps.find((m) => m.id === pid);
  assert.ok(plan(a), 'le plan intérieur existe');
  assert.equal(JSON.stringify(plan(a)), JSON.stringify(plan(b)));
  assert.equal(plan(a).title, 'La Chope Cassée · intérieur');
  const at = (id) => a.geometries.find((g) => g.featureId === id).coordinates;
  const counter = a.features.find((f) => f.id.startsWith(`${pid}:objet`) && f.title === 'Comptoir');
  const margot = at(`${pid}:pnj-margot`), brute = at(`${pid}:pnj-brute`), door = at(`${pid}:entree`);
  const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  assert.ok(d(margot, at(counter.id)) < d(brute, at(counter.id)), 'la tenancière est au comptoir');
  assert.ok(d(brute, door) < d(margot, door), 'le videur est à la porte');
  // La porte relie l'intérieur à la rue.
  assert.ok(a.connections.some((c) => c.fromAnchorId === `${tav.id}:porte` && c.toAnchorId === `${pid}:sortie`));
  // Plateau de combat : murs fermés, porte ouverte.
  const m = plan(a), cols = 24, rows = 16, w = (cols * 1.524) / (m.surface.scale * m.width);
  const win = { x0: 0.5 - w / 2, y0: 0.47 - (w * (m.width / m.height) * (rows / cols)) / 2, w, h: w * (m.width / m.height) * (rows / cols) };
  const grid = rasterGround(m.surface, m.width, m.height, win, cols, rows, 1);
  const lines = Array.from({ length: rows }, (_, r) => grid.slice(r * cols, r * cols + cols)).filter((l) => l.includes('#'));
  const front = lines[lines.length - 1];
  assert.match(front, /#+\.+#+/, `façade avec une porte : ${front}`);
});

test('une auberge a un étage et une cave, reliés par des escaliers au même endroit', async () => {
  const { interiorPlanId } = await import('./generate.js');
  const city = { ...CITY, at: [0.5, 0.5] };
  const slots = citySlots(city, cityPlanId('rec', CITY.id));
  const inn = slots.find((s) => s.type === 'auberge');
  const hut = slots.filter((s) => s.type === 'maison').sort((a, b) => a.w * a.d - b.w * b.d)[0];
  const world = { seed: 2, name: 'Monde', cities: [city], bindings: {}, interiors: [inn.id, hut.id] };
  const d = generateWorld(world, 'rec');
  const rdc = interiorPlanId(inn.id);
  const plans = d.maps.filter((m) => m.id.startsWith(rdc)).map((m) => m.id);
  assert.deepEqual(plans.sort(), [rdc, `${rdc}:cave`, `${rdc}:e1`].sort());
  const anchor = (id) => d.anchors.find((a) => a.id === id);
  for (const lv of ['e1', 'cave']) {
    const c = d.connections.find((x) => x.toAnchorId === `${rdc}:${lv}:esc-rdc`);
    assert.ok(c, `escalier vers ${lv}`);
    assert.equal(c.kind, 'escalier');
    assert.deepEqual(anchor(c.fromAnchorId).at, anchor(c.toAnchorId).at, 'même endroit sur les deux niveaux');
  }
  assert.ok(d.features.some((f) => f.id.startsWith(`${rdc}:e1:piece-`) && /Chambre/.test(f.title)), 'des chambres à l’étage');
  assert.ok(d.features.some((f) => f.id === `${rdc}:cave:piece-0` && f.title === 'Cellier'));
  // Une petite maison n'a qu'un niveau.
  assert.equal(d.maps.filter((m) => m.id.startsWith(interiorPlanId(hut.id))).length, 1);
});

test('chaque niveau est peuplé selon la logique : voyageurs à l’étage, cellier vide, PNJ cachés signalés', async () => {
  const { interiorPlanId } = await import('./generate.js');
  const city = { ...CITY, at: [0.5, 0.5] };
  const slots = citySlots(city, cityPlanId('rec', CITY.id));
  const inn = slots.find((s) => s.type === 'auberge');
  const binding = { entryId: 'gite', cityId: CITY.id, slotId: inn.id, type: 'auberge', title: 'Le Gîte', hint: 'auberge|', npcs: [
    { id: 'rose', name: 'Rose', role: 'aubergiste' },
    { id: 'eli', name: 'Éli', role: 'voyageur', desc: 'Dort à l’étage depuis trois nuits.' },
    { id: 'ombre', name: 'L’Ombre', role: 'espion', desc: 'Embusqué dans la salle commune.' },
  ] };
  const d = generateWorld({ seed: 2, name: 'Monde', cities: [city], bindings: { gite: binding }, interiors: [inn.id] }, 'rec');
  const rdc = interiorPlanId(inn.id);
  const f = (id) => d.features.find((x) => x.id === id);
  assert.ok(f(`${rdc}:pnj-rose`), 'l’aubergiste au rez-de-chaussée');
  assert.ok(f(`${rdc}:e1:pnj-eli`), 'le voyageur à l’étage');
  assert.equal(f(`${rdc}:pnj-ombre`).hiddenNpc, true, 'l’espion embusqué est caché');
  assert.ok(!f(`${rdc}:pnj-rose`).hiddenNpc);
  assert.ok(!d.features.some((x) => x.id.startsWith(`${rdc}:cave:pnj-`)), 'le cellier est vide');
  const a = JSON.stringify(d.features.filter((x) => x.id.includes(':pnj-gen-')));
  const b = JSON.stringify(generateWorld({ seed: 2, name: 'Monde', cities: [city], bindings: { gite: binding }, interiors: [inn.id] }, 'rec').features.filter((x) => x.id.includes(':pnj-gen-')));
  assert.equal(a, b, 'les occupants anonymes sont toujours les mêmes');
});

test('les occupants suivent le moment de la journée, et un résident reste à sa place', async () => {
  const { interiorPlanId } = await import('./generate.js');
  const city = { ...CITY, at: [0.5, 0.5] };
  const slots = citySlots(city, cityPlanId('rec', CITY.id));
  const tav = slots.find((s) => s.type === 'taverne'), shop = slots.find((s) => s.type === 'echoppe');
  const crowd = (time, slotId, extra = {}) => generateWorld({ seed: 2, name: 'Monde', cities: [city], bindings: {}, interiors: [slotId], time, ...extra }, 'rec')
    .features.filter((f) => f.id.startsWith(`${interiorPlanId(slotId)}:pnj-`));
  assert.ok(crowd('soir', tav.id).length > crowd('matin', tav.id).length, 'la taverne est pleine le soir');
  assert.ok(crowd('soir', tav.id).some((f) => /tavernier|tavernière/.test(f.subtitle)), 'un tavernier tient le comptoir');
  assert.equal(JSON.stringify(crowd('soir', tav.id)), JSON.stringify(crowd('soir', tav.id)), 'même moment, mêmes occupants');
  assert.equal(crowd('nuit', shop.id).filter((f) => f.id.startsWith(`${interiorPlanId(shop.id)}:pnj-`) && !f.id.includes(':e1:')).length, 0, 'échoppe fermée la nuit');
  const at = [0.4, 0.5];
  const residents = { [tav.id]: [{ id: 'gus', name: 'Gustave', role: 'buveur', level: 'rdc', at }] };
  for (const time of ['matin', 'nuit']) {
    const f = crowd(time, tav.id, { residents }).find((x) => x.id === `${interiorPlanId(tav.id)}:pnj-gus`);
    assert.ok(f, `résident présent (${time})`);
  }
  const d = generateWorld({ seed: 2, name: 'Monde', cities: [city], bindings: {}, interiors: [tav.id], time: 'nuit', residents }, 'rec');
  assert.deepEqual(d.geometries.find((g) => g.featureId === `${interiorPlanId(tav.id)}:pnj-gus`).coordinates, at);
  assert.equal(d.maps.find((m) => m.id === interiorPlanId(tav.id)).surface.light, 'nuit');
});

test('un hameau sur la route s’explore comme une cité : chapelle, taverne, fermes, pas de muraille', async () => {
  const { interiorPlanId } = await import('./generate.js');
  const world = { seed: 5, name: 'Monde', bindings: {}, cities: [{ ...CITY, at: [0.15, 0.2] }, { id: 'rocfort', name: 'Rocfort', population: 3000, at: [0.85, 0.8] }] };
  const d = generateWorld(world, 'rec');
  assert.ok(d.villages.length >= 1, 'au moins un hameau');
  const v = d.villages[0];
  const pid = cityPlanId('rec', v.id);
  const plan = d.maps.find((m) => m.id === pid);
  assert.ok(plan, 'le hameau a son plan');
  assert.ok(!plan.decor.some((x) => x.kind === 'wall'), 'pas de muraille');
  assert.ok(d.features.some((f) => f.opens?.id === plan.scope.id), 'le point du hameau ouvre son plan');
  const slots = citySlots(v, pid);
  const types = new Set(slots.map((s) => s.type));
  for (const t of ['temple', 'taverne', 'ferme', 'maison']) assert.ok(types.has(t), `type ${t}`);
  for (const t of ['guilde', 'caserne', 'entrepot', 'chateau']) assert.ok(!types.has(t), `pas de ${t}`);
  assert.equal(slots.find((s) => s.type === 'temple').label, 'Chapelle');
  // Ses bâtiments s'ouvrent comme ceux d'une cité.
  const tav = slots.find((s) => s.type === 'taverne');
  const d2 = generateWorld({ ...world, interiors: [tav.id] }, 'rec');
  assert.ok(d2.maps.some((m) => m.id === interiorPlanId(tav.id)));
  // Le lore peut y poser un lieu : la fiche nomme le hameau.
  const { syncBindings } = await import('./lore.js');
  const r = syncBindings({ world: { ...world, cities: [...world.cities, ...d.villages] }, mapRecordId: 'rec',
    places: [{ id: 'moulin', archiveType: 'place', title: 'Le Moulin du Vieux Gaston', shortSummary: `Atelier de meunier, à ${v.name}.`, currentLocation: v.name }] });
  assert.equal(r.bindings.moulin?.cityId, v.id);
});

test('un nom choisi par le MJ remplace le nom tiré au sort, partout', async () => {
  const { interiorPlanId } = await import('./generate.js');
  const city = { ...CITY, at: [0.5, 0.5] };
  const pid = cityPlanId('rec', CITY.id);
  const slots = citySlots(city, pid);
  const tav = slots.find((s) => s.type === 'taverne');
  const d = generateWorld({ seed: 1, name: 'M', cities: [city], bindings: {}, interiors: [tav.id], names: { [tav.id]: 'Le Sanglier Borgne', [`${pid}:marche`]: 'Place aux Herbes' } }, 'rec');
  assert.equal(d.features.find((f) => f.id === tav.id).title, 'Le Sanglier Borgne');
  assert.equal(d.features.find((f) => f.id === `${pid}:marche`).title, 'Place aux Herbes');
  assert.equal(d.maps.find((m) => m.id === interiorPlanId(tav.id)).title, 'Le Sanglier Borgne · intérieur');
});

test('mode Exploration : brouillons, bâtiment défini à la main, personnage du MJ caché dans le monde', async () => {
  const { syncBindings } = await import('./lore.js');
  const city = { ...CITY, at: [0.5, 0.5] };
  const pid = cityPlanId('rec', CITY.id);
  const house = citySlots(city, pid).find((s) => s.type === 'maison');
  const binding = { entryId: 'sang', cityId: CITY.id, slotId: house.id, type: 'taverne', title: 'Le Sanglier Borgne', hint: 'taverne|', npcs: [], pinned: true };
  const world = { seed: 1, name: 'M', cities: [city], bindings: { sang: binding }, canon: [], avatar: { name: 'Le Chroniqueur', role: 'conteur', mode: 'reverie', hidden: { planId: pid, at: [0.5, 0.52] } } };
  const d = generateWorld(world, 'rec');
  const f = (id) => d.features.find((x) => x.id === id);
  assert.equal(f(house.id).title, 'Le Sanglier Borgne');
  assert.ok(!f(house.id).draft, 'le bâtiment défini est canon');
  assert.ok(d.features.some((x) => /:b\d+$/.test(x.id) && x.draft), 'les autres bâtiments sont des brouillons');
  assert.equal(f(`${pid}:pnj-mj`).title, 'Le Chroniqueur', 'le personnage du MJ est caché dans la cité');
  // La fiche (sans mot de métier dans son titre) ne déloge jamais le lieu posé à la main.
  const r = syncBindings({ world, mapRecordId: 'rec', places: [{ id: 'sang', archiveType: 'place', title: 'Le Sanglier Borgne', shortSummary: 'Une taverne enfumée.', currentLocation: 'Brumeval' }] });
  assert.equal(r.bindings.sang.slotId, house.id);
  assert.ok(!r.bindings.sang.conflict);
});

test('climat : la latitude décide du biome, et l’hémisphère sud l’inverse', async () => {
  const { temperatureAt, biomeOf, climateOf, nearestEdge } = await import('./climate.js');
  assert.equal(biomeOf(temperatureAt({}, 0.02)), 'neige');
  assert.equal(biomeOf(temperatureAt({}, 0.98), 0.3), 'desert');
  assert.equal(biomeOf(temperatureAt({}, 0.98), 1), 'steppe');
  assert.equal(biomeOf(temperatureAt({ hemisphere: 'sud' }, 0.02), 0.3), 'desert');
  assert.equal(biomeOf(temperatureAt({ hemisphere: 'sud' }, 0.98)), 'neige');
  assert.equal(climateOf(temperatureAt({ range: 'tempere' }, 0.02)), 'tempere');
  assert.equal(nearestEdge([0.5, 0.9]), 'S');
  assert.equal(nearestEdge([0.05, 0.5]), 'O');
  const base = { seed: 7, name: 'M', bindings: {}, cities: [{ id: 'n', name: 'Givre', population: 900, at: [0.5, 0.1] }, { id: 's', name: 'Soleil', population: 900, at: [0.5, 0.9] }] };
  const climOf = (d, id) => d.maps.find((m) => m.id === cityPlanId('r', id)).surface.climate;
  const north = generateWorld(base, 'r');
  assert.equal(climOf(north, 'n'), 'froid');
  assert.equal(climOf(north, 's'), 'chaud');
  const south = generateWorld({ ...base, climate: { hemisphere: 'sud' } }, 'r');
  assert.equal(climOf(south, 'n'), 'chaud');
  assert.equal(climOf(south, 's'), 'froid');
  const kinds = new Set(north.maps[0].decor.map((x) => x.kind));
  assert.ok(kinds.has('biome-neige') && kinds.has('biome-desert'));
  // Sans port, pas de mer.
  assert.ok(!kinds.has('sea'));
  // Le climat ne change pas le plan des cités (les lieux posés restent en place).
  assert.deepEqual(north.features.filter((f) => f.id.startsWith(cityPlanId('r', 'n'))).map((f) => f.id), south.features.filter((f) => f.id.startsWith(cityPlanId('r', 'n'))).map((f) => f.id));
});

test('une cité portuaire a sa mer, ses quais et ses pontons ; le monde a sa côte de ce côté', () => {
  const spec = { id: 'port', name: 'Port-Lune', population: 3000, port: true, seaDir: 'S' };
  const c = generateCity(spec, 'p');
  const kinds = c.map.decor.map((x) => x.kind);
  assert.ok(kinds.includes('sea') && kinds.includes('beach') && kinds.includes('pier'));
  assert.ok(c.features.some((f) => f.title === 'Les Quais') && c.features.some((f) => f.title === 'Rue du Port'));
  assert.ok(c.slots.some((s) => s.type === 'entrepot'));
  // Aucun bâtiment dans l'eau : la mer est au sud (y vers le bas), au-delà de la ville.
  const sea = c.map.surface.ground.water.find((w) => w.closed);
  assert.ok(sea);
  // Aucune porte vers la mer.
  assert.ok(c.gates.every((g) => Math.sin(g.a) < 0.96));
  // Sur la carte de combat, un ponton se traverse à pied ('=') au-dessus de l'eau.
  const g = c.map.surface.ground;
  const pier = g.roads[g.roads.length - 1];
  const [x, y] = [pier.pts[2] / c.map.width, pier.pts[3] / c.map.height];
  const grid = rasterGround(c.map.surface, c.map.width, c.map.height, { x0: x - 0.02, y0: y - 0.02, w: 0.04, h: 0.04 }, 9, 9);
  assert.ok(grid.includes('~'));
  // Une cité qui n'est pas un port reste identique.
  assert.equal(JSON.stringify(generateCity({ ...spec, port: false }, 'p')), JSON.stringify(generateCity({ id: 'port', name: 'Port-Lune', population: 3000 }, 'p')));
  const w = generateWorld({ seed: 3, name: 'M', bindings: {}, cities: [{ ...spec, at: [0.5, 0.86] }, { id: 'b', name: 'Terre', population: 1000, at: [0.5, 0.3] }] }, 'r');
  assert.ok(w.maps[0].decor.some((x) => x.kind === 'sea'));
  assert.ok(w.features.some((f) => f.id === 'map-r:mer-0'));
  assert.ok(w.maps[0].surface.ground.water.some((x) => x.closed && x.pts.length > 50));
  // La fiche d'une ville portuaire en fait un port.
  assert.equal(citySpecFromEntry({ id: 'x', title: 'Havre-Gris', shortSummary: 'Une ville portuaire aux quais animés.' }).port, true);
  assert.equal(citySpecFromEntry({ id: 'y', title: 'Brumeval', shortSummary: 'Une ville à côté de la forêt.' }).port, undefined);
});

test('saisons : neige selon le climat, glace, affluence et répliques de saison', async () => {
  const { snowOf, seasonLine } = await import('./seasons.js');
  const { generateInterior } = await import('./interior.js');
  assert.deepEqual(snowOf('hiver', 'chaud'), {});
  assert.equal(snowOf('hiver', 'froid').frozen, 'tout');
  assert.equal(snowOf('hiver', 'tempere').frozen, 'rivieres');
  assert.match(seasonLine('tavernier', 'hiver', 'tempere', () => 0), /froid dehors/);
  assert.match(seasonLine('tavernier', 'ete', 'tempere', () => 0), /pinte/);
  assert.match(seasonLine('tavernier', 'hiver', 'chaud', () => 0), /pluie/);
  const base = { seed: 7, name: 'M', bindings: {}, cities: [{ id: 'n', name: 'Givre', population: 900, at: [0.5, 0.1], river: true }] };
  const plan = (d) => d.maps.find((m) => m.id === cityPlanId('r', 'n'));
  const hiver = generateWorld({ ...base, season: 'hiver' }, 'r');
  assert.equal(plan(hiver).surface.season, 'hiver');
  assert.ok(plan(hiver).surface.snow >= 0.3);
  // Plus de neige sur le monde l'hiver qu'en été.
  const snowLen = (d) => d.maps[0].decor.find((x) => x.kind === 'biome-neige')?.d.length ?? 0;
  assert.ok(snowLen(hiver) > snowLen(generateWorld({ ...base, season: 'ete' }, 'r')));
  // Au combat : des congères et la rivière gelée (terrain difficile, plus d'eau).
  const s = plan(hiver).surface;
  const grid = rasterGround(s, plan(hiver).width, plan(hiver).height, { x0: 0, y0: 0, w: 1, h: 1 }, 80, 60);
  assert.ok(grid.includes(':') && !grid.includes('~'));
  const sansSaison = rasterGround(plan(generateWorld(base, 'r')).surface, 1240, 860, { x0: 0, y0: 0, w: 1, h: 1 }, 80, 60);
  assert.ok(sansSaison.includes('~'));
  // Taverne : la réplique d'hiver du tavernier, et plus de monde l'hiver que sans saison (en moyenne).
  const slots = citySlots({ id: 'n', name: 'Givre', population: 900 }, 'p');
  const tav = slots.filter((x) => x.type === 'taverne');
  let n0 = 0, n1 = 0, said = false;
  for (const slot of tav) for (const period of ['jour', 'soir']) {
    const a = generateInterior({ slot, planId: 'i', siteId: 's', parentSiteId: 'p', period });
    const b = generateInterior({ slot, planId: 'i', siteId: 's', parentSiteId: 'p', period, season: 'hiver', climate: 'tempere' });
    n0 += a.features.filter((f) => /pnj-gen/.test(f.id)).length; n1 += b.features.filter((f) => /pnj-gen/.test(f.id)).length;
    said ||= b.features.some((f) => /tavern/i.test(f.subtitle ?? '') && /^« /.test(f.summary ?? ''));
  }
  assert.ok(n1 > n0);
  assert.ok(said);
  // Sans saison, rien ne change.
  const slot = tav[0];
  assert.equal(JSON.stringify(generateInterior({ slot, planId: 'i', siteId: 's', parentSiteId: 'p' })), JSON.stringify(generateInterior({ slot, planId: 'i', siteId: 's', parentSiteId: 'p', season: undefined })));
});
