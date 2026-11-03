// Énigmes : chaque modèle du catalogue se résout par des actions de joueur, la vue joueur ne contient aucun secret,
// et une énigme résolue ouvre la porte qu'elle verrouille.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const load = async (file) => {
  const r = await build({ entryPoints: [new URL(file, import.meta.url).pathname], bundle: true, format: 'esm', write: false, platform: 'node', loader: { '.json': 'json' } });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
};
const E = await load('./engine.ts');
const R = await load('./run.ts');
const { puzzles } = JSON.parse(readFileSync(new URL('./catalogue.json', import.meta.url), 'utf8'));
const byMech = Object.fromEntries(puzzles.map((p) => [p.mechanic, p]));

/** Joue une suite d'actions de joueur, puis soumet. */
function play(p, actions) {
  let s = E.createState(p);
  for (const a of actions) s = E.dispatchPuzzle(p, s, a, 'player');
  return E.dispatchPuzzle(p, s, { type: 'submit' }, 'player');
}

// Un chemin de résolution par mécanisme, trouvé en raisonnant (comme les joueurs), pas en lisant la solution.
const SOLUTIONS = {
  braziers: (p) => {
    // A reste levé, B levé puis baissé, C jamais touché : flamme = A, chaud = B, froid = C.
    let s = E.createState(p);
    for (const a of [{ type: 'braziers.toggle', id: 'A' }, { type: 'braziers.toggle', id: 'B' }, { type: 'braziers.toggle', id: 'B' }, { type: 'braziers.inspect' }]) s = E.dispatchPuzzle(p, s, a);
    const lever = { flamme: 'A', chaud: 'B', froid: 'C' };
    for (const [b, o] of Object.entries(s.draft.observations)) s = E.dispatchPuzzle(p, s, { type: 'braziers.guess', brazier: b, lever: lever[o] });
    return E.dispatchPuzzle(p, s, { type: 'submit' });
  },
  'heavy-stone': (p) => {
    let s = E.createState(p);
    const weigh = (l, r) => { for (const id of l) s = E.dispatchPuzzle(p, s, { type: 'heavy.move', id, side: 'left' }); for (const id of r) s = E.dispatchPuzzle(p, s, { type: 'heavy.move', id, side: 'right' }); s = E.dispatchPuzzle(p, s, { type: 'heavy.weigh' }); return s.draft.weighings.at(-1).result; };
    const g = [['A', 'B', 'C'], ['D', 'E', 'F'], ['G', 'H', 'I']];
    const r1 = weigh(g[0], g[1]);
    const grp = r1 === 'left' ? g[0] : r1 === 'right' ? g[1] : g[2];
    const r2 = weigh([grp[0]], [grp[1]]);
    s = E.dispatchPuzzle(p, s, { type: 'heavy.guess', id: r2 === 'left' ? grp[0] : r2 === 'right' ? grp[1] : grp[2] });
    return E.dispatchPuzzle(p, s, { type: 'submit' });
  },
  // 5 → 3 : reste 2 ; vider 3 ; 2 → 3 ; remplir 5 ; 5 → 3 (1 manque) : reste 4.
  jugs: (p) => play(p, [{ type: 'jugs.fill', i: 1 }, { type: 'jugs.pour', i: 1, j: 0 }, { type: 'jugs.empty', i: 0 }, { type: 'jugs.pour', i: 1, j: 0 }, { type: 'jugs.fill', i: 1 }, { type: 'jugs.pour', i: 1, j: 0 }]),
  // Une seule phrase vraie : seul le coffret B rend vraie exactement une inscription.
  statues: (p) => play(p, [{ type: 'statues.choose', value: 'B' }]),
  // Les quatre orientations possibles des miroirs (16 combinaisons) : on en cherche une qui mène le rayon au but.
  mirrors: (p) => {
    for (let k = 0; k < 16; k++) {
      const acts = [0, 1, 2, 3].filter((i) => (k >> i) & 1).map((index) => ({ type: 'mirrors.rotate', index }));
      const s = play(p, acts);
      if (s.status === 'solved') return s;
    }
    return E.createState(p);
  },
  'prime-tiles': (p) => {
    // Recherche d'un chemin sur les dalles « sûres », comme le ferait le groupe en comprenant la règle.
    const c = p.engine.publicConfig, prime = (n) => n > 1 && [...Array(n).keys()].slice(2).every((d) => n % d);
    const seen = new Set(), q = [[c.start]];
    while (q.length) {
      const path = q.shift(), [x, y] = path.at(-1);
      if (x === c.end[0] && y === c.end[1]) return play(p, path.slice(1).map(([a, b]) => ({ type: 'prime.step', x: a, y: b })));
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (ny < 0 || ny >= c.grid.length || nx < 0 || nx >= c.grid[0].length || seen.has(`${nx},${ny}`) || !prime(c.grid[ny][nx])) continue;
        seen.add(`${nx},${ny}`); q.push([...path, [nx, ny]]);
      }
    }
    return E.createState(p);
  },
  chronology: (p) => play(p, [{ type: 'chronology.reorder', order: ['Fondation', 'Couronne', 'Pacte', 'Rupture', 'Exil'] }]),
  glyphs: (p) => play(p, [{ type: 'glyphs.choose', slot: 0, glyph: '✦' }, { type: 'glyphs.choose', slot: 1, glyph: '≋' }]),
  cycles: (p) => play(p, [{ type: 'cycles.set', tick: 12 }]),
  // 1+3+8 = 12 et 2+4+6 = 12.
  'equal-balance': (p) => play(p, [0, 2, 5].map((index) => ({ type: 'equal.move', index, side: 'left' })).concat([1, 3, 4].map((index) => ({ type: 'equal.move', index, side: 'right' })))),
  gears: (p) => play(p, [{ type: 'gears.toggle', id: 'X' }]),
  // Chaque pression bascule une pierre et ses deux voisines : presser 0, 1 et 3 allume tout.
  'light-network': (p) => {
    for (let k = 0; k < 16; k++) {
      const s = play(p, [0, 1, 2, 3].filter((i) => (k >> i) & 1).map((index) => ({ type: 'lights.press', index })));
      if (s.status === 'solved') return s;
    }
    return E.createState(p);
  },
};

test('les 12 modèles du catalogue se résolvent par des gestes de joueur', () => {
  assert.equal(puzzles.length, 12);
  for (const p of puzzles) {
    assert.ok(SOLUTIONS[p.mechanic], `pas de chemin de test pour ${p.mechanic}`);
    assert.equal(SOLUTIONS[p.mechanic](p).status, 'solved', `${p.title} n'est pas résolue`);
  }
});

test('une mauvaise réponse ne révèle rien et peut déclencher la conséquence prévue', () => {
  const p = byMech.statues;
  const s = play(p, [{ type: 'statues.choose', value: 'A' }]);
  assert.equal(s.status, 'active');
  assert.equal(s.feedback.kind, 'failure');
  assert.equal(s.effects[0].kind, 'gm-resolution');
  const pub = E.publicProjection(p, s, []);
  assert.equal(pub.state.effects.length, 0, 'la conséquence MJ ne part pas chez les joueurs');
});

test('la vue joueur ne contient ni solution, ni démonstration, ni document à trouver ailleurs', () => {
  for (const p of puzzles) {
    const withClue = { ...p, player: { ...p.player, readables: (p.player.readables ?? []).map((r, i) => (i === 0 ? { ...r, clueId: 'indice-1' } : r)) } };
    const pub = E.publicProjection(withClue, E.createState(p), [{ id: 'indice-1', title: 'Page', kind: 'page', text: 'secret', held: false, gmNote: 'note MJ' }]);
    const json = JSON.stringify(pub);
    assert.ok(!('gm' in pub) && !json.includes('serverConfig') && !json.includes('deductionPath') && !json.includes('note MJ'));
    for (const v of Object.values(p.engine.serverConfig ?? {})) if (typeof v === 'string' && v.length > 2) assert.ok(!json.includes(v), `${p.id} : ${v} fuit`);
    assert.equal(pub.player.readables.length, (p.player.readables ?? []).length - 1, 'un document déplacé dans le carnet quitte la scène');
    assert.equal(pub.carnet.length, 0, 'un indice que le groupe n’a pas ne figure pas dans son carnet');
    assert.ok(pub.player.observations.every((o) => o.available === 'initiale'), 'les observations à découvrir attendent l’examen');
  }
});

test('le MJ seul peut forcer, et une énigme résolue ouvre la porte qu’elle verrouille', () => {
  const p = { ...byMech.jugs, id: 'e1' };
  const battle = { cols: 10, rows: 10, feetPerCell: 5, round: 1, tokens: [], walls: [{ id: 'w1', kind: 'porte', points: [[2, 2], [3, 2]], lock: { puzzleId: 'e1' } }] };
  assert.throws(() => E.dispatchPuzzle(p, E.createState(p), { type: 'gm.forceSuccess' }, 'player'));
  const b = { ...battle, puzzle: R.startRun(battle, { kind: 'wall', id: 'w1' }, p) };
  const r = R.act(b, p, { type: 'gm.forceSuccess' }, 'gm');
  const next = { ...b, ...r.patch };
  assert.equal(next.puzzle.state.status, 'solved');
  assert.deepEqual(next.walls[0].lock, { puzzleId: 'e1', solved: true });
  assert.equal(next.walls[0].open, true);
  assert.equal(R.act(next, p, { type: 'jugs.fill', i: 0 }, 'player').error, 'L’épreuve est résolue');
});

test('le solveur vérifie les 12 modèles et repère les énigmes injouables', async () => {
  const S = await load('./solver.ts');
  const C = await load('./catalogue.ts');
  const T = await load('./templates.ts');
  for (const m of puzzles) {
    const p = C.fromModel(m, 'u1');
    const r = S.solvePuzzle(p);
    assert.ok(r.ok, `${p.title} : ${r.errors.join(' ; ')}`);
    assert.ok(!JSON.stringify(E.publicProjection(p, E.createState(p), [])).includes('relations'), 'relations des fresques côté MJ');
  }
  for (const mech of Object.keys(T.DEFAULTS)) assert.ok(S.solvePuzzle(T.blankPuzzle(mech, 'u1')).ok, `modèle vierge ${mech} injouable`);
  const jugs = T.blankPuzzle('jugs', 'u1');
  jugs.engine.publicConfig = { capacities: [4, 6], target: 3, initial: [0, 0] };
  assert.equal(S.solvePuzzle(jugs).ok, false, '3 avec 4 et 6 : impossible (PGCD 2)');
  const st = T.blankPuzzle('statues', 'u1');
  const claims = [{ statue: 'A', is: false, chest: 'A' }, { statue: 'B', is: true, chest: 'B' }, { statue: 'C', is: false, chest: 'B' }, { statue: 'D', is: true, chest: 'A' }];
  assert.match(S.solvePuzzle(st, { claims }).errors.join(), /Plusieurs|Aucun|désigne/);
  assert.deepEqual(S.claimOf('A', 'La clé n’est pas dans le coffret A.'), { statue: 'A', is: false, chest: 'A' });
});

test('contrôle qualité : un indice qui donne la réponse bloque, une énigme relue et complète est prête', async () => {
  const Q = await load('./quality.ts');
  const S = await load('./solver.ts');
  const C = await load('./catalogue.ts');
  const p = C.fromModel(byMech.chronology, 'u1');
  p.gm.nonSpoilerHints[0].text = 'Fondation, Couronne, Pacte, Rupture, Exil';
  assert.ok(Q.checksOf(p, []).some((c) => c.level === 'bloquant' && /indice 1/.test(c.text)), 'la séquence complète dans un indice est bloquante');
  const ok = C.fromModel(byMech.jugs, 'u1');
  const solver = S.solvePuzzle(ok);
  let r = Q.readiness(ok, Q.checksOf(ok, [], solver), solver);
  assert.equal(r.ready, false);
  assert.ok(r.reasons.some((x) => /relue/.test(x)), 'une énigme non relue par le MJ n’est jamais prête');
  ok.design = { reviewed: true };
  r = Q.readiness(ok, Q.checksOf(ok, [], solver), solver);
  assert.ok(r.total >= 32 && r.ready, r.reasons.join(' ; '));
});
