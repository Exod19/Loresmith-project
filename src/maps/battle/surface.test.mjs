// Terrain et déplacements des cartes de combat : les cas de référence (rivière en coin, eau profonde, pont, mur,
// diagonale entre deux obstacles, grande créature, correction du MJ, nage et vol, socle).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'surface-'));
const out = join(dir, 'bundle.mjs');
await build({
  stdin: { contents: "export * from './surface'; export * from './movement';", resolveDir: here, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'neutral', outfile: out, logLevel: 'silent',
});
const S = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

const W = 10, H = 8;
const walker = (extra = {}) => ({ size: 1, speed: 6, ...extra });
const rules = (input) => S.compileSurface({ cols: W, rows: H, ...input });

test('1. une rivière qui touche seulement le coin d’une case ne la change pas en eau', () => {
  // Tracé horizontal large de 0,6 case, sur la ligne y = 3 : il effleure le bas des cases de la rangée 2, sans leur centre.
  const r = rules({ zones: [{ id: 'riv', terrain: 'eau_profonde', shape: 'line', width: 0.6, points: [[0, 3], [5, 3], [10, 3]] }] });
  const c = r.cells[2 * W + 4];
  assert.equal(c.t, 'sol');
  assert.equal(S.categoryOf(c), 'normal');
  // La case ne présente qu'un seul terrain principal ; la rangée sous la ligne non plus (centre à 0,5 de la ligne).
  assert.equal(r.cells[3 * W + 4].t, 'sol');
});

test('2. une case d’eau profonde annonce la nage avant d’y entrer', () => {
  const r = rules({ zones: [{ id: 'lac', terrain: 'eau_profonde', shape: 'area', points: [[5, 0], [10, 0], [10, 8], [5, 8]] }] });
  const plan = S.planMove(r, walker(), { x: 3, y: 3 }, { x: 6, y: 3 });
  assert.equal(plan.dest, 'Eau profonde — nage');
  assert.ok(plan.notes.includes('nage'));
  // Chaque case d'eau profonde (selon la classification, la courbe débordant un peu des points) compte double.
  const expected = [4, 5, 6].reduce((t, x) => t + (r.cells[3 * W + x].t === 'eau_profonde' ? 2 : 1), 0);
  assert.equal(plan.cost, expected);
  assert.ok(expected > 3);
});

test('3. un pont au-dessus d’une rivière : le trajet emprunte le tablier', () => {
  const r = rules({
    zones: [{ id: 'riv', terrain: 'eau_profonde', shape: 'line', width: 3, points: [[5, -1], [5, 4], [5, 9]] }],
    objects: [{ id: 'p', kind: 'pont', x: 5, y: 4.5, len: 6, wid: 1 }],
  });
  assert.equal(r.cells[4 * W + 5].t, 'eau_profonde');
  assert.ok(r.cells[4 * W + 5].deck);
  const plan = S.planMove(r, walker(), { x: 1, y: 4 }, { x: 8, y: 4 }, 20);
  assert.equal(plan.cost, 7);
  assert.ok(plan.steps.some((s) => s.layer === 'pont'), 'le trajet passe sur le pont');
  assert.ok(!plan.notes.includes('nage'));
  // Depuis l'eau, on ne se hisse pas sur le tablier : on passe dessous, à la nage.
  const under = S.planMove(r, walker(), { x: 5, y: 3 }, { x: 5, y: 4 }, 20);
  assert.equal(under.layer, 'sol');
  assert.equal(under.dest, 'Eau profonde — nage');
});

test('4. un mur étroit entre deux cases praticables bloque le passage', () => {
  const r = rules({ walls: [{ id: 'm', kind: 'mur', points: [[4, 0], [4, 8]] }] });
  const plan = S.planMove(r, walker(), { x: 3, y: 3 }, { x: 4, y: 3 }, 50);
  assert.equal(plan.possible, false);
  // Un mur partiel se contourne : le coût dépasse une case.
  const r2 = rules({ walls: [{ id: 'm', kind: 'mur', points: [[4, 1], [4, 6]] }] });
  const around = S.planMove(r2, walker(), { x: 3, y: 3 }, { x: 4, y: 3 }, 50);
  assert.ok(around.possible && around.cost > 1);
});

test('5. pas de diagonale entre deux obstacles qui se touchent par le coin', () => {
  const r = rules({ objects: [{ id: 'a', kind: 'rocher', x: 3.5, y: 2.5 }, { id: 'b', kind: 'rocher', x: 2.5, y: 3.5 }] });
  assert.equal(S.categoryOf(r.cells[2 * W + 3]), 'bloquee');
  const plan = S.planMove(r, walker(), { x: 2, y: 2 }, { x: 3, y: 3 }, 20);
  assert.ok(plan.cost > 1, `coût ${plan.cost}`);
  // Un seul obstacle au coin : la diagonale reste permise (règle de base).
  const r1 = rules({ objects: [{ id: 'a', kind: 'rocher', x: 3.5, y: 2.5 }] });
  assert.equal(S.planMove(r1, walker(), { x: 2, y: 2 }, { x: 3, y: 3 }).cost, 1);
  // Un mur qui passe par le coin interdit aussi la diagonale.
  const rw = rules({ walls: [{ id: 'm', kind: 'mur', points: [[3, 0], [3, 6]] }] });
  assert.ok(S.planMove(rw, walker(), { x: 2, y: 2 }, { x: 3, y: 3 }, 20).cost > 1);
});

test('6. une grande créature sur plusieurs terrains : toute l’empreinte compte, un seul résultat', () => {
  const r = rules({
    zones: [{ id: 'b', terrain: 'boue', shape: 'area', points: [[5, 0], [10, 0], [10, 8], [5, 8]] }],
    objects: [{ id: 'roc', kind: 'rocher', x: 8.5, y: 5.5 }],
  });
  const big = walker({ size: 2 });
  // Un pas qui met une moitié dans la boue compte double.
  const plan = S.planMove(r, big, { x: 3, y: 2 }, { x: 4, y: 2 });
  assert.equal(plan.cost, 2);
  // Une empreinte qui couvrirait le rocher est refusée, avec la raison.
  const blocked = S.planMove(r, big, { x: 3, y: 2 }, { x: 7, y: 4 }, 30);
  assert.equal(blocked.possible, false);
  assert.match(blocked.reason, /Empreinte trop large/);
});

test('7. une correction du MJ prime sur le calcul automatique', () => {
  const zones = [{ id: 'lac', terrain: 'eau_profonde', shape: 'area', points: [[0, 0], [10, 0], [10, 8], [0, 8]] }];
  const fixed = rules({ zones, fixes: { [3 * W + 3]: { t: 'sol' }, [3 * W + 4]: { rule: 'bloquee' } } });
  assert.equal(fixed.cells[3 * W + 3].t, 'sol');
  assert.equal(fixed.cells[3 * W + 3].src, 'mj');
  assert.equal(S.categoryOf(fixed.cells[3 * W + 4]), 'bloquee');
  // Sauvegarde et rechargement : les corrections sont des données simples, qui survivent au JSON.
  const again = rules({ zones: JSON.parse(JSON.stringify(zones)), fixes: JSON.parse(JSON.stringify({ [3 * W + 3]: { t: 'sol' } })) });
  assert.equal(again.cells[3 * W + 3].t, 'sol');
});

test('8. nage et vol suivent les capacités, sans modifier le terrain', () => {
  const r = rules({ zones: [
    { id: 'lac', terrain: 'eau_profonde', shape: 'area', points: [[4, 0], [6, 0], [6, 8], [4, 8]] },
    { id: 'gouf', terrain: 'gouffre', shape: 'area', points: [[7, 0], [8, 0], [8, 8], [7, 8]] },
  ] });
  const before = JSON.stringify(r.cells);
  assert.equal(S.planMove(r, walker(), { x: 3, y: 3 }, { x: 5, y: 3 }).cost, 4);
  assert.equal(S.planMove(r, walker({ swim: true }), { x: 3, y: 3 }, { x: 5, y: 3 }).cost, 2);
  assert.equal(S.planMove(r, walker(), { x: 6, y: 3 }, { x: 7, y: 3 }, 30).possible, false);
  assert.equal(S.planMove(r, walker({ fly: true }), { x: 6, y: 3 }, { x: 7, y: 3 }).cost, 1);
  assert.equal(JSON.stringify(r.cells), before);
  const m = S.moverOf({ size: 1 }, '6 m, vol 18 m');
  assert.equal(m.fly, true);
  assert.equal(m.speed, 12);
});

test('9. le socle suit le terrain sous le jeton, sans effet sur les règles', () => {
  const input = { zones: [{ id: 'h', terrain: 'herbe', shape: 'area', points: [[0, 0], [5, 0], [5, 8], [0, 8]] }], ground: 'sable' };
  const r = rules(input);
  assert.equal(S.socleOf(r, { x: 1, y: 1, size: 1 }), 'herbe');
  assert.equal(S.socleOf(r, { x: 7, y: 1, size: 1 }), 'sable');
  // 2 × 2 à cheval, 2 cases de chaque : égalité départagée par l'ordre des terrains (herbe avant sable).
  assert.equal(S.socleOf(r, { x: 4, y: 1, size: 2 }), 'herbe');
  assert.equal(S.socleOf(r, { x: 1, y: 1, size: 1, socle: { mode: 'aucun' } }), null);
  assert.equal(S.socleOf(r, { x: 1, y: 1, size: 1, socle: { mode: 'manuel', t: 'neige' } }), 'neige');
  const after = rules(input);
  assert.equal(JSON.stringify(after.cells), JSON.stringify(r.cells));
});
