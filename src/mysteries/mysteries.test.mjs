// Fil des Mystères : couverture des verrous, propositions, report sans retcon, idempotence (kit v3, QA).
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const r = await build({ entryPoints: [new URL('./planner.ts', import.meta.url).pathname], bundle: true, format: 'esm', write: false, platform: 'node' });
const P = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));

// La Trappe aux souffles (exemple du kit), rattachée à quatre scènes.
const scenes = () => [{ id: 'atelier', title: 'L’atelier du réparateur' }, { id: 'quai', title: 'Le quai' }, { id: 'auberge', title: 'L’auberge' }, { id: 'trappe', title: 'La salle des conduits' }];
const arc = () => ({
  id: 'arc', title: 'La Trappe aux souffles', status: 'draft', events: [],
  knowledgeAtoms: [
    { id: 'chaleur', statement: 'Un conduit récemment chauffé reste tiède après la fermeture.', criticality: 'critical', discoverableBy: ['manifestation'] },
    { id: 'unique', statement: 'Chaque soupape agit sur un seul conduit.', criticality: 'critical', discoverableBy: ['local_observation'] },
  ],
  clueDesigns: [
    { id: 'journal', title: 'Journal du réparateur', knowledgeAtomIds: ['chaleur'], media: 'journal', playerContent: 'Après l’arrêt des chaudières, la chaleur se retire lentement.', unique: true },
    { id: 'machine', title: 'Machine témoin', knowledgeAtomIds: ['chaleur'], media: 'experience', playerContent: 'Le petit tube garde un moment la chaleur.' },
  ],
  sceneSlots: [
    { id: 's-etabli', sceneId: 'atelier', label: 'l’établi', allowedMedia: ['journal'], capacity: 1 },
    { id: 's-machine', sceneId: 'atelier', label: 'la machine', allowedMedia: ['experience'], capacity: 1 },
    { id: 's-capitaine', sceneId: 'quai', label: 'journal de bord du capitaine', allowedMedia: ['journal', 'dialogue'], capacity: 1 },
    { id: 's-aubergiste', sceneId: 'auberge', label: 'l’aubergiste', allowedMedia: ['dialogue'], capacity: 1, isOptional: true },
  ],
  manifestations: [],
  gates: [{ id: 'g', title: 'Les trois conduits', targetSceneId: 'trappe', criticalPath: true, requiredAtomIds: ['chaleur', 'unique'], bypass: 'Percer un conduit, au prix d’un grand bruit.' }],
});

test('couverture : bloqué sans source, à risque une fois prévu, prêt une fois appris', () => {
  let a = arc();
  assert.equal(P.coverageOf(a, a.gates[0], scenes()).status, 'BLOCKED');
  const [best] = P.proposalsFor(a, a.clueDesigns[0], scenes());
  assert.equal(best.slot.id, 's-etabli', 'l’établi : chemin prévu, support adapté, loin du verrou');
  assert.ok(best.reasons.length >= 2, 'proposition motivée');
  a = P.place(a, 'journal', 's-etabli', 'k1');
  a = P.place(a, 'journal', 's-etabli', 'k1');
  assert.equal(a.manifestations.length, 1, 'action rejouée : idempotente');
  assert.equal(P.coverageOf(a, a.gates[0], scenes()).status, 'AT_RISK');
  a = P.markState(a, a.manifestations[0].id, 'collected', 'k2');
  const cov = P.coverageOf(a, a.gates[0], scenes());
  assert.equal(cov.status, 'READY');
  assert.deepEqual(cov.atoms.map((x) => x.status), ['acquis', 'sur place']);
});

test('une scène jouée sans trouver l’indice rend le verrou bloqué, sans relocalisation silencieuse', () => {
  let a = P.place(arc(), 'journal', 's-etabli', 'k1');
  const sc = scenes(); sc[0].played = true;
  assert.equal(P.coverageOf(a, a.gates[0], sc).status, 'BLOCKED');
  assert.equal(a.manifestations[0].slotId, 's-etabli', 'rien n’a bougé tout seul');
  assert.ok(P.proposalsFor(a, a.clueDesigns[0], sc).every((p) => p.scene.id !== 'atelier'), 'jamais dans une scène déjà jouée');
});

test('report : un indice jamais vu est déplacé ; un indice déjà présenté reste et reçoit une seconde source', () => {
  let a = P.place(arc(), 'journal', 's-etabli', 'k1');
  const id = a.manifestations[0].id;
  a = P.markState(a, id, 'missed', 'k2');
  let pv = P.requestDefer(a, id, scenes(), 'atelier');
  assert.equal(pv.kind, 'preview');
  assert.equal(pv.strategy, 'NEW_DISTINCT_COPY', 'journal unique manqué : copie distincte, pas le même papier');
  assert.ok(pv.candidates.length >= 1 && pv.candidates.length <= 3);
  assert.equal(pv.candidates[0].slot.id, 's-capitaine');
  a = P.approveDefer(a, pv, pv.candidates[0], 'k3', 'Le capitaine a travaillé pour le réparateur.');
  a = P.approveDefer(a, pv, pv.candidates[0], 'k3', 'rejoué');
  assert.equal(a.manifestations.length, 2, 'report rejoué : une seule nouvelle manifestation');
  assert.equal(a.manifestations[0].state, 'missed', 'l’original n’est pas réécrit');
  assert.equal(a.manifestations[1].from, id);
  assert.equal(a.events.filter((e) => e.type === 'clue.defer.approved').length, 1, 'audit');

  let b = P.place(arc(), 'journal', 's-etabli', 'k1');
  const bid = b.manifestations[0].id;
  b = P.markState(b, bid, 'presented', 'k2');
  pv = P.requestDefer(b, bid, scenes(), 'atelier');
  assert.equal(pv.strategy, 'NEW_DISTINCT_COPY');
  b = P.approveDefer(b, pv, pv.candidates[0], 'k3', '');
  assert.equal(b.manifestations[0].state, 'presented', 'déjà présenté : jamais retiré rétroactivement');

  let c = P.place(arc(), 'machine', 's-machine', 'k1');
  pv = P.requestDefer(c, c.manifestations[0].id, scenes(), 'atelier');
  assert.equal(pv.strategy, 'MOVE_UNEXPOSED');
  c = P.approveDefer(c, pv, pv.candidates[0], 'k2', '');
  assert.equal(c.manifestations[0].state, 'withdrawn', 'jamais vu : retiré, remplacé par une nouvelle manifestation');
  assert.notEqual(c.manifestations[1].id, c.manifestations[0].id);
});

test('ce qui est pris reste au groupe ; sans emplacement possible, le MJ décide', () => {
  let a = P.place(arc(), 'journal', 's-etabli', 'k1');
  const id = a.manifestations[0].id;
  a = P.markState(a, id, 'collected', 'k2');
  a = P.markState(a, id, 'missed', 'k3');
  assert.equal(a.manifestations[0].state, 'collected');
  const sc = scenes().map((s) => (s.id === 'trappe' ? s : { ...s, played: true }));
  const b = P.place(arc(), 'machine', 's-machine', 'k1');
  const pv = P.requestDefer(b, b.manifestations[0].id, sc, 'auberge');
  assert.equal(pv.kind, 'review');
  assert.ok(pv.options.some((o) => /Percer un conduit/.test(o)), 'le contournement prévu est proposé');
});

test('validation : support incompatible, objet unique dupliqué, fait critique seulement dans une scène facultative', () => {
  const a = arc();
  a.manifestations = [
    { id: 'm1', clueDesignId: 'journal', slotId: 's-machine', state: 'slotted' },
    { id: 'm2', clueDesignId: 'journal', slotId: 's-capitaine', state: 'slotted' },
  ];
  const issues = P.validateArc(a, scenes()).filter((x) => x.level === 'bloquant').map((x) => x.text).join(' | ');
  assert.match(issues, /ne convient pas/);
  assert.match(issues, /unique mais placé deux fois/);
  const b = arc();
  b.clueDesigns.push({ id: 'rumeur', title: 'Rumeur', knowledgeAtomIds: ['chaleur'], media: 'dialogue', playerContent: '…' });
  b.manifestations = [{ id: 'm3', clueDesignId: 'rumeur', slotId: 's-aubergiste', state: 'slotted' }];
  assert.match(P.validateArc(b, scenes()).map((x) => x.text).join(), /seulement dans des scènes facultatives|ne se trouve que dans des scènes facultatives/);
});
