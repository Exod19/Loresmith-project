import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normKey, parseReport, markDuplicates, buildEntry, buildReport, reportPrompt } from './sessionReport.js';

test('normKey ignore casse, accents et ponctuation', () => {
  assert.equal(normKey('  Élara, la Rouge! '), 'elara la rouge');
});

test('parseReport tolère les réponses douteuses et retire les doublons', () => {
  assert.deepEqual(parseReport(null), { summary: '', consequences: [], entities: [] });
  const r = parseReport({
    summary: ' Ok ',
    consequences: ['a', '', 'b'],
    entities: [
      { kind: 'place', name: 'Port-Sombre', summary: 'Un port.' },
      { kind: 'place', name: 'port sombre' },
      { kind: 'inconnu', name: 'Marek' },
      { name: '' },
    ],
  });
  assert.equal(r.summary, 'Ok');
  assert.deepEqual(r.consequences, ['a', 'b']);
  assert.equal(r.entities.length, 2);
  assert.equal(r.entities[1].kind, 'person');
});

test('markDuplicates repère une fiche déjà connue par son nom', () => {
  const out = markDuplicates(
    [{ kind: 'person', name: 'Élara' }, { kind: 'place', name: 'Ailleurs' }],
    [{ id: 'e1', title: 'elara' }],
  );
  assert.equal(out[0].duplicateOf, 'e1');
  assert.equal(out[1].duplicateOf, undefined);
});

test('la fiche créée garde la provenance campagne et séance', () => {
  const e = buildEntry({ kind: 'faction', name: 'Les Lanternes', summary: 'Secte.', secret: 'Dirigée par le roi.', tags: ['secte'] }, {
    campaignId: 'c1', sessionId: 'ses-2', reportId: 'r1', id: 'x', now: 5,
  });
  assert.equal(e.archiveType, 'faction');
  assert.deepEqual(e.linkedCampaignIds, ['c1']);
  assert.deepEqual(e.source, { kind: 'session-report', campaignId: 'c1', sessionId: 'ses-2', reportId: 'r1' });
  assert.equal(e.secrets, 'Dirigée par le roi.');
});

test('le compte rendu garde la séance et les fiches créées', () => {
  const r = buildReport({ id: 'r1', now: 1, session: { id: 'ses-2', sessionNumber: 2, title: 'La forêt' }, notes: ' n ', summary: 's', entryIds: ['x'] });
  assert.equal(r.sessionNumber, 2);
  assert.equal(r.notes, 'n');
  assert.deepEqual(r.entryIds, ['x']);
  assert.equal(buildReport({ id: 'r', now: 1 }).sessionId, null);
});

test('le prompt contient les notes et les éléments déjà connus', () => {
  const { prompt } = reportPrompt({ universe: { name: 'U' }, campaign: { title: 'C' }, notes: 'Ils ont tué le garde.', knownTitles: ['Elara'] });
  assert.match(prompt, /tué le garde/);
  assert.match(prompt, /Elara/);
});
