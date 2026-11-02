import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previousDigest } from './digest.js';

const sessions = [
  { id: 'ses-1', sessionNumber: 1, title: 'Départ', summary: 'Prévu 1', detailed: true },
  { id: 'ses-2', sessionNumber: 2, title: 'Forêt', summary: 'Prévu 2', detailed: false },
  { id: 'ses-3', sessionNumber: 3, title: 'Ville', summary: 'Prévu 3', detailed: true },
];

test('sans compte rendu, le digest reprend le prévu des séances écrites', () => {
  assert.equal(previousDigest({ sessions }, 3), 'S1 Départ : Prévu 1');
});

test('le vécu remplace le prévu, même pour une séance non détaillée', () => {
  const campaign = {
    sessions,
    sessionReports: [{ sessionId: 'ses-2', summary: 'Ils ont fui.', consequences: ['Pont brûlé'], futureSeeds: ['Qui ?'] }],
  };
  const lines = previousDigest(campaign, 3).split('\n');
  assert.equal(lines[0], 'S1 Départ : Prévu 1');
  assert.equal(lines[1], 'S2 Forêt (JOUÉE) : Ils ont fui. Conséquences : Pont brûlé. Pistes ouvertes : Qui ?.');
});

test('les séances à partir de la cible ne sont jamais incluses', () => {
  assert.equal(previousDigest({ sessions }, 1), '');
});
