import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyBrief,
  canForge,
  answeredCount,
  skippedCount,
  toneFromBrief,
  composeLore,
  buildUniverse,
  parseExtraQuestions,
} from './forgeBrief.js';

test('le nom est obligatoire, le reste est optionnel', () => {
  assert.equal(canForge(emptyBrief()), false);
  assert.equal(canForge({ ...emptyBrief(), name: '   ' }), false);
  assert.equal(canForge({ ...emptyBrief(), name: 'Aerth' }), true);
});

test('le ton garde la première phrase du style', () => {
  const b = { ...emptyBrief(), style: 'Fantasy sombre. Les dieux dorment.' };
  assert.equal(toneFromBrief(b), 'Fantasy sombre.');
  assert.equal(toneFromBrief(emptyBrief()), '');
});

test('le canon reprend style, ampleur, spécificités et réponses', () => {
  const b = {
    ...emptyBrief(),
    name: 'Aerth',
    style: 'Steampunk des îles.',
    size: 'region',
    complexity: 'dense',
    specifics: 'Pas de nuit.',
    answers: { conflit: 'Deux guildes.', secret: '   ' },
  };
  const lore = composeLore(b);
  assert.match(lore, /Steampunk des îles\./);
  assert.match(lore, /une région/);
  assert.match(lore, /dense/);
  assert.match(lore, /Pas de nuit\./);
  assert.match(lore, /Deux guildes\./);
  assert.equal(answeredCount(b), 1);
});

test('buildUniverse produit un univers valide même avec un brief presque vide', () => {
  const u = buildUniverse({ ...emptyBrief(), name: ' Aerth ' }, { id: 'x', createdAt: 1 });
  assert.equal(u.name, 'Aerth');
  assert.equal(u.id, 'x');
  assert.equal(u.tone, '');
  assert.equal(u.lore, '');
  assert.ok(u.forgeBrief);
});

test('un lore édité à la main remplace le lore composé', () => {
  const u = buildUniverse({ ...emptyBrief(), name: 'A', style: 'S.' }, { id: 'x', createdAt: 1, lore: 'Mon texte' });
  assert.equal(u.lore, 'Mon texte');
});

test('parseExtraQuestions tolère un JSON douteux', () => {
  assert.deepEqual(parseExtraQuestions(null), []);
  assert.deepEqual(parseExtraQuestions({ questions: 'non' }), []);
  const qs = parseExtraQuestions({ questions: [{ question: 'Q1', why: 'w' }, { question: '' }, {}] });
  assert.equal(qs.length, 1);
  assert.equal(qs[0].id, 'ia-1');
});

test('une question passée est comptée, sauf si elle a finalement une réponse', () => {
  const b = { ...emptyBrief(), skipped: { conflit: true, pouvoir: true }, answers: { pouvoir: 'Un conseil.' } };
  assert.equal(skippedCount(b), 1);
  assert.doesNotMatch(composeLore(b), /conflit central/);
});
