// Combat sur le plateau : créatures sur le trajet, déplacement restant dans le tour (et Foncer), abri derrière murs et obstacles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'combatmove-'));
const out = join(dir, 'bundle.mjs');
await build({
  stdin: { contents: "export * from './surface'; export * from './movement'; export * from './placement'; export * from './aoe'; export { coverAgainst } from './tactics';", resolveDir: here, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'neutral', outfile: out, logLevel: 'silent', define: { 'import.meta.env': '{"BASE_URL":"/"}' },
});
const S = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

const W = 10, H = 8;
const tok = (id, kind, x, y, extra = {}) => ({ id, name: id, kind, x, y, size: 1, visible: true, ...extra });
const battle = (tokens, extra = {}) => ({ cols: W, rows: H, feetPerCell: 5, round: 1, tokens, ...extra });

test('on ne traverse pas une créature hostile ; un allié compte comme terrain difficile', () => {
  // Couloir d'une case de large (murs au-dessus et en dessous de la rangée 3).
  const walls = [{ id: 'a', kind: 'mur', points: [[0, 3], [10, 3]] }, { id: 'b', kind: 'mur', points: [[0, 4], [10, 4]] }];
  const r = S.compileSurface({ cols: W, rows: H, walls });
  const hero = tok('h', 'pc', 1, 3);
  const enemy = { ...S.moverOf(hero), occ: S.occupancy(W, hero, [hero, tok('o', 'monster', 4, 3)]) };
  assert.equal(S.planMove(r, enemy, { x: 1, y: 3 }, { x: 6, y: 3 }, 30).possible, false);
  const ally = { ...S.moverOf(hero), occ: S.occupancy(W, hero, [hero, tok('k', 'pc', 4, 3)]) };
  const plan = S.planMove(r, ally, { x: 1, y: 3 }, { x: 6, y: 3 }, 30);
  assert.equal(plan.cost, 6);
  assert.ok(plan.notes.includes('à travers un allié'));
});

test('le déplacement restant se compte par tour, Foncer le double', () => {
  let b = battle([tok('h', 'pc', 0, 0)], { turn: 'h' });
  assert.equal(S.moveLeft(b, 'h', 6), 6);
  b = { ...b, moved: S.withMove(b, 'h', { cost: 4 }) };
  assert.equal(S.moveLeft(b, 'h', 6), 2);
  b = { ...b, moved: S.withMove(b, 'h', { dash: true }) };
  assert.equal(S.moveLeft(b, 'h', 6), 8);
  // Tour suivant : tout repart de zéro.
  const next = { ...b, turn: 'o' };
  assert.equal(S.moveLeft(next, 'h', 6), 6);
  assert.equal(S.isDashing(next, 'h'), false);
});

test('abri : un mur coupe la vue, un muret ou un buisson donne un abri partiel', () => {
  const a = tok('a', 'pc', 1, 3), t = tok('t', 'monster', 6, 3);
  const open = S.coverAgainst(battle([a, t]), undefined, a, t);
  assert.equal(open.level, 0);
  const wall = battle([a, t], { walls: [{ id: 'm', kind: 'mur', points: [[4, 0], [4, 8]] }] });
  assert.equal(S.coverAgainst(wall, undefined, a, t).level, 3);
  const low = battle([a, t], { walls: [{ id: 'm', kind: 'muret', points: [[4, 0], [4, 8]] }] });
  assert.equal(S.coverAgainst(low, undefined, a, t).level, 1);
  const bush = battle([a, t], { objects: [{ id: 'b', kind: 'buisson', x: 5.5, y: 3.5 }] });
  const c = S.coverAgainst(bush, undefined, a, t);
  assert.equal(c.level, 1);
  assert.match(c.why, /buisson/);
});

test('porte fermée : comme un mur ; ouverte : on passe ; herse baissée : bloque le passage mais pas la vue', () => {
  const walls = (kind, open) => [{ id: 'm1', kind: 'mur', points: [[4, 0], [4, 3]] }, { id: 'd', kind, open, points: [[4, 3], [4, 4]] }, { id: 'm2', kind: 'mur', points: [[4, 4], [4, 8]] }];
  const go = (kind, open) => S.planMove(S.compileSurface({ cols: W, rows: H, walls: walls(kind, open) }), { size: 1, speed: 30 }, { x: 2, y: 3 }, { x: 6, y: 3 }, 30);
  assert.equal(go('porte', false).possible, false);
  assert.equal(go('porte', true).cost, 4);
  assert.equal(go('herse', false).possible, false);
  const a = tok('a', 'pc', 2, 3), t = tok('t', 'monster', 6, 3);
  assert.equal(S.coverAgainst(battle([a, t], { walls: walls('porte', false) }), undefined, a, t).level, 3);
  assert.ok(S.coverAgainst(battle([a, t], { walls: walls('herse', false) }), undefined, a, t).level < 3);
});

test('zones d’effet : formes 5e, arrêtées par un mur', () => {
  const open = S.compileSurface({ cols: W, rows: H });
  const sphere = { id: 's', shape: 'sphere', size: 10, x: 5, y: 4, dir: 0 };
  assert.equal(S.aoeCells(sphere, open).length, 12);
  const cone = { id: 'c', shape: 'cone', size: 15, x: 1, y: 4, dir: 0 };
  const cells = S.aoeCells(cone, open);
  assert.ok(cells.includes(4 * W + 3) && !cells.includes(0 * W + 2));
  const walled = S.compileSurface({ cols: W, rows: H, walls: [{ id: 'm', kind: 'mur', points: [[6, 0], [6, 8]] }] });
  const line = { id: 'l', shape: 'ligne', size: 40, x: 1, y: 4.5, dir: 0 };
  const hit = S.aoeCells(line, walled);
  assert.ok(hit.includes(4 * W + 5) && !hit.includes(4 * W + 7), 'la ligne s’arrête au mur');
});
