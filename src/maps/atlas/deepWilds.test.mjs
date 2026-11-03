/** Lieux sauvages de l'Underdark : le long des galeries, hors des cavernes et des lieux existants, toujours les mêmes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { deepSitesOn, deepSightOf } from './deepWilds.js';

const trails = Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, trace: i % 5 === 0 ? 'ruisseau' : 'boyau', pts: [[0.05 + i * 0.03, 0.1], [0.06 + i * 0.03, 0.5], [0.05 + i * 0.03, 0.9]] }));
const cave = [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]];
const plan = { planId: 'p', trails, caves: [cave], points: [[0.2, 0.3]] };

test('toujours les mêmes, à l’écart du tracé, jamais dans une caverne ni contre un lieu existant', () => {
  const a = deepSitesOn(plan);
  assert.equal(JSON.stringify(a), JSON.stringify(deepSitesOn(plan)));
  assert.ok(a.length >= 5, `${a.length} lieux`);
  for (const s of a) {
    assert.ok(!(s.at[0] > 0.4 && s.at[0] < 0.6 && s.at[1] > 0.4 && s.at[1] < 0.6), `${s.title} dans la caverne`);
    assert.ok(Math.hypot(s.at[0] - 0.2, s.at[1] - 0.3) >= 0.006);
    assert.ok(s.text.length > 20);
  }
  const lac = a.filter((s) => s.kind === 'lac-noir');
  assert.ok(lac.every((s) => s.trailId), 'chaque lieu sait sa galerie');
});

test('pas de lieu dans une galerie secrète ni une crevasse ; un lieu enregistré sort du tirage', () => {
  assert.equal(deepSitesOn({ planId: 'p', trails: trails.map((t) => ({ ...t, trace: 'secret' })) }).length, 0);
  const [first] = deepSitesOn(plan);
  assert.ok(!deepSitesOn(plan, new Set([first.key])).some((s) => s.key === first.key));
});

test('vu depuis la galerie : portée de torche, DD pour un lieu caché', () => {
  const svirf = deepSightOf({ key: 'x', kind: 'sanctuaire-svirf' });
  assert.equal(svirf.dc, 15);
  assert.match(svirf.line, /\{c\}/);
  assert.ok(deepSightOf({ key: 'x', kind: 'champignonniere' }).reach > svirf.reach);
});

test('densité réglable dans les galeries : rares < normaux < nombreux', () => {
  const n = (density) => deepSitesOn({ ...plan, density }).length;
  assert.ok(n('rare') < n('normale') && n('normale') < n('riche'), `${n('rare')} < ${n('normale')} < ${n('riche')}`);
  assert.equal(n('normale'), n(undefined));
});
