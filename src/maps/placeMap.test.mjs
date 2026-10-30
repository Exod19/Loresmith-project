import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeMapId, wantsPlaceMap, emptyPlaceMap, positionFor, addPlaces } from './placeMap.js';

const place = (n) => ({ id: `p${n}`, title: `Lieu ${n}`, shortSummary: `Résumé ${n}` });

test('une carte par univers, sauf pour l’Underdark', () => {
  assert.equal(placeMapId('u1'), 'places-u1');
  assert.equal(wantsPlaceMap({ id: 'u' }), true);
  assert.equal(wantsPlaceMap({ id: 'u', archives: 'underdark' }), false);
  assert.equal(wantsPlaceMap(null), false);
});

test('la carte vierge est une carte custom sans image', () => {
  const m = emptyPlaceMap('u1', 5);
  assert.equal(m.kind, 'custom');
  assert.equal(m.image, undefined);
  assert.deepEqual(m.overlay, { revealed: [], markers: [] });
});

test('le premier lieu est au centre', () => {
  assert.deepEqual(positionFor([]), { x: 0.5, y: 0.5 });
});

test('un lieu relié se pose près de son voisin', () => {
  const { map } = addPlaces(emptyPlaceMap('u', 1), [place(1)], { now: 1 });
  const r = addPlaces(map, [place(2)], { edges: [{ from: 'p2', to: 'p1' }], now: 2 });
  const [a, b] = r.map.overlay.markers;
  assert.ok(Math.hypot(a.x - b.x, (a.y - b.y) * (755 / 1240)) < 0.25);
});

test('vingt lieux ne se chevauchent pas et restent dans la carte', () => {
  let map = emptyPlaceMap('u', 1);
  for (let i = 1; i <= 20; i++) map = addPlaces(map, [place(i)], { now: i }).map;
  const ms = map.overlay.markers;
  assert.equal(ms.length, 20);
  for (const m of ms) assert.ok(m.x >= 0.05 && m.x <= 0.95 && m.y >= 0.05 && m.y <= 0.95);
  for (let i = 0; i < ms.length; i++)
    for (let j = i + 1; j < ms.length; j++) assert.ok(Math.hypot(ms[i].x - ms[j].x, (ms[i].y - ms[j].y) * (755 / 1240)) >= 0.085);
});

test('jamais de doublon, repères découverts, planId de la carte', () => {
  const m0 = emptyPlaceMap('u', 1);
  const r1 = addPlaces(m0, [place(1)], { now: 2 });
  assert.equal(r1.added, 1);
  const mk = r1.map.overlay.markers[0];
  assert.deepEqual([mk.revealed, mk.entryId, mk.planId, mk.kind], [true, 'p1', 'map-places-u', 'repere']);
  const r2 = addPlaces(r1.map, [place(1)], { now: 3 });
  assert.equal(r2.added, 0);
  assert.equal(r2.map, r1.map);
  assert.equal(m0.overlay.markers.length, 0); // l'original n'est pas modifié
});

test('un lieu retiré à la main n’est pas remis par une séance suivante', () => {
  const map = { ...emptyPlaceMap('u', 1), placeDismissed: ['p1'] };
  const r = addPlaces(map, [place(1), place(2)], { now: 2 });
  assert.deepEqual(r.map.overlay.markers.map((m) => m.entryId), ['p2']);
});
