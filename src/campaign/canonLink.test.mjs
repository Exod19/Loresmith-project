import { test } from 'node:test';
import assert from 'node:assert/strict';
import { similarity, findCandidates, matchEntities, buildMerge, resolveEdges, planChanges } from './canonLink.js';

const lib = [
  { id: 'e1', title: 'Orsk', archiveType: 'person', roughNotes: 'Garde.', secrets: '', tags: ['garde'], linkedCampaignIds: [], related: [] },
  { id: 'e2', title: 'Vallombre', archiveType: 'place', related: [] },
  { id: 'e3', title: 'Les Lanternes', archiveType: 'faction', related: [] },
];
const ctx = { campaignId: 'c1', sessionId: 'ses-2', sessionNumber: 2, reportId: 'r1', now: 7 };
let n = 0;
const newId = () => `n${++n}`;

test('similarité : exact, compact, titre ignoré, faute de frappe, rien', () => {
  assert.equal(similarity('Orsk', 'orsk'), 1);
  assert.equal(similarity('Val-Lombre', 'Vallombre'), 0.95);
  assert.equal(similarity('Capitaine Orsk', 'Orsk'), 0.85);
  assert.equal(similarity('Vallombr', 'Vallombre'), 0.75);
  assert.equal(similarity('Marek', 'Orsk'), 0);
});

test('candidats : un nom proche de type différent est écarté, sameAs de l’IA est retenu', () => {
  assert.equal(findCandidates({ name: 'Orsk', kind: 'place' }, lib)[0]?.id, 'e1'); // nom identique, tout type
  assert.equal(findCandidates({ name: 'Capitaine Orsk', kind: 'place' }, lib).length, 0); // flou + type incompatible
  assert.equal(findCandidates({ name: 'Le capitaine', kind: 'person', sameAs: 'orsk' }, lib)[0].score, 0.9);
});

test('décision par défaut : fusion seulement si quasi sûr', () => {
  const out = matchEntities(
    [{ name: 'Orsk', kind: 'person' }, { name: 'Capitaine Orsk', kind: 'person' }, { name: 'Marek', kind: 'person' }],
    lib,
  );
  assert.deepEqual(out.map((e) => e.decision), ['merge:e1', 'new', 'new']);
});

test('la fusion ajoute sans remplacer et reste idempotente', () => {
  const e = { summary: 'Humilié.', secret: 'Il trahit.', tags: ['capitaine'] };
  const patch = buildMerge(e, lib[0], ctx);
  assert.equal(patch.roughNotes, 'Garde.\n\n[Séance 2] Humilié.');
  assert.equal(patch.secrets, '[Séance 2] Il trahit.');
  assert.deepEqual(patch.tags, ['garde', 'capitaine']);
  assert.deepEqual(patch.linkedCampaignIds, ['c1']);
  const again = buildMerge(e, { ...lib[0], roughNotes: patch.roughNotes, secrets: patch.secrets }, ctx);
  assert.equal(again.roughNotes, undefined);
  assert.equal(again.secrets, undefined);
});

test('les relations visent un élément du compte rendu ou une fiche connue, jamais soi-même', () => {
  const items = [
    { targetId: 'n1', entity: { name: 'Elfes-Lanternes', relations: [{ target: 'Vallombre', label: 'habitent' }, { target: 'Elfes Lanternes', label: 'x' }, { target: 'Inconnu', label: 'y' }] } },
  ];
  assert.deepEqual(resolveEdges(items, lib), [{ from: 'n1', to: 'e2', label: 'habitent' }]);
});

test('planChanges : nouvelle fiche liée à une fiche existante, fusion, et lien inverse sur l’existante', () => {
  const entities = [
    { kind: 'faction', name: 'Elfes-Lanternes', summary: 'Peuple.', secret: '', tags: [], relations: [{ target: 'Vallombre', label: 'habitent' }], decision: 'new' },
    { kind: 'person', name: 'Orsk', summary: 'Humilié.', secret: '', tags: [], relations: [{ target: 'Vallombre', label: 'prisonnier à' }], decision: 'merge:e1', conflict: 'Il était mort.' },
    { kind: 'person', name: 'Ignoré', summary: '', relations: [], decision: 'skip' },
  ];
  const plan = planChanges({ entities, existing: lib, ctx, newId });
  assert.equal(plan.newEntries.length, 1);
  assert.deepEqual(plan.newEntries[0].related, [{ id: 'e2', name: 'Vallombre', kind: 'habitent' }]);
  assert.deepEqual(plan.mergedIds, ['e1']);
  assert.deepEqual(plan.conflicts, [{ name: 'Orsk', issue: 'Il était mort.' }]);
  // Vallombre reçoit les deux liens inverses, sans rien perdre ; Orsk reçoit sa fusion et son lien.
  assert.deepEqual(plan.patches.e2.related.map((r) => r.kind), ['← habitent', '← prisonnier à']);
  assert.equal(plan.patches.e1.roughNotes, 'Garde.\n\n[Séance 2] Humilié.');
  assert.deepEqual(plan.patches.e1.related, [{ id: 'e2', name: 'Vallombre', kind: 'prisonnier à' }]);
  assert.equal(plan.patches.e3, undefined);
});

test('une fusion vers une fiche disparue devient une création', () => {
  const plan = planChanges({ entities: [{ kind: 'person', name: 'X', summary: 's', relations: [], decision: 'merge:zzz' }], existing: lib, ctx, newId });
  assert.equal(plan.newEntries.length, 1);
  assert.deepEqual(plan.mergedIds, []);
});
