import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentsOf, grimoireOf, redact } from './schema.js';

const grimoire = () => ({
  activeUniverseId: 'u1',
  universes: { u1: { id: 'u1', name: 'Underdark' } },
  characters: { c1: { id: 'c1', universeId: 'u1', name: 'Aria' } },
  campaigns: {
    k1: {
      id: 'k1', universeId: 'u1', title: 'La descente', premise: 'publique', dmOverview: 'secret', finalTruth: 'secret',
      acts: [{ id: 'act-1', title: 'Acte', secrets: ['s'] }],
      factions: [{ name: 'Clan', hiddenTruth: 'secret', goal: 'public' }],
      scenes: [{ id: 's1', title: 'Porte', expanded: { readAloud: 'à lire', dmNotes: 'secret', hiddenTruth: 'secret', npcs: [{ name: 'Y', secret: 'x', role: 'garde' }], clues: ['c'] } }],
    },
  },
  npcs: { n1: { id: 'n1', universeId: 'u1', name: 'Yemena', secret: 'traîtresse', motivation: 'or' } },
  quests: {},
  assets: { a1: { id: 'a1', universeId: 'u1', targetId: 'n1', dataUrl: 'lsimg:abc' } },
  libraryEntries: { l1: { id: 'l1', universeId: 'u1', title: 'Menzo', body: 'public', secrets: 'secret' } },
  maps: {
    m1: {
      id: 'm1', universeId: 'u1', title: 'Cité',
      points: [{ id: 'p1', title: 'Porte', notes: 'secret', secret: false }, { id: 'p2', title: 'Passage', secret: true }],
      overlay: { revealed: [], markers: [{ id: 'r1', revealed: true, notes: 'secret', groups: [{ stat: 'orc', n: 2 }], summary: 'vu' }, { id: 'r2', revealed: false }] },
    },
  },
  chatThreads: { t1: { id: 't1', universeId: 'u1', campaignId: 'k1', messages: [{ role: 'user', content: 'x' }] }, t2: { id: 't2', universeId: 'u1', campaignId: '', messages: [] } },
  combat: { combatants: [{ id: 'x' }], round: 3 },
  log: [{ id: 'g1', universeId: 'u1' }],
});

test('découpage en documents, avec leur portée', () => {
  const { docs, orphans } = documentsOf(grimoire(), 'moi');
  assert.equal(orphans.length, 0);
  const of = (type, id) => docs.find((d) => d.type === type && d.id === id);
  assert.deepEqual(of('universe', 'u1').universeId, 'u1');
  assert.deepEqual([of('campaign', 'k1').universeId, of('campaign', 'k1').campaignId], ['u1', 'k1']);
  assert.deepEqual([of('chat', 't1').campaignId, of('chat', 't2').campaignId], ['k1', null], 'une discussion suit sa campagne s’il y en a une');
  assert.equal(of('npc', 'n1').campaignId, null, 'un PNJ appartient à l’univers (Q4)');
  const user = of('userState', 'moi');
  assert.equal(user.ownerId, 'moi');
  assert.deepEqual(user.data, { activeUniverseId: 'u1', combat: { combatants: [{ id: 'x' }], round: 3 }, log: [{ id: 'g1', universeId: 'u1' }] }, 'combat et journal suivent le compte (Q1)');
});

test('aller-retour : grimoire → documents → grimoire', () => {
  const { docs } = documentsOf(grimoire(), 'moi');
  assert.deepEqual(grimoireOf(docs), grimoire());
});

test('les orphelins sont mis à part, pas envoyés', () => {
  const s = grimoire();
  s.npcs.n9 = { id: 'n9', universeId: 'disparu', name: 'Perdu' };
  s.chatThreads.t9 = { id: 't9', universeId: 'u1', campaignId: 'supprimée' };
  const { docs, orphans } = documentsOf(s, 'moi');
  assert.deepEqual(orphans, [{ type: 'npc', id: 'n9' }, { type: 'chat', id: 't9' }]);
  assert.equal(docs.some((d) => d.id === 'n9' || d.id === 't9'), false);
});

test('redact : retire chaque champ secret, sans toucher au reste ni à l’original', () => {
  const s = grimoire();
  const camp = redact('campaign', s.campaigns.k1);
  assert.equal(camp.dmOverview, undefined);
  assert.equal(camp.finalTruth, undefined);
  assert.equal(camp.premise, 'publique');
  assert.equal(camp.acts[0].secrets, undefined);
  assert.equal(camp.acts[0].title, 'Acte');
  assert.deepEqual(camp.factions[0], { name: 'Clan', goal: 'public' });
  assert.deepEqual(camp.scenes[0].expanded, { readAloud: 'à lire', npcs: [{ name: 'Y', role: 'garde' }] });
  assert.equal(s.campaigns.k1.dmOverview, 'secret', 'original intact');

  assert.deepEqual(redact('library', s.libraryEntries.l1), { id: 'l1', universeId: 'u1', title: 'Menzo', body: 'public' });
  assert.equal(redact('npc', s.npcs.n1).secret, undefined);
  assert.equal(redact('npc', s.npcs.n1).motivation, 'or');
  assert.deepEqual(redact('chat', s.chatThreads.t1).messages, undefined);

  const map = redact('map', s.maps.m1);
  assert.deepEqual(map.points, [{ id: 'p1', title: 'Porte', secret: false }], 'repère secret retiré, notes retirées');
  assert.deepEqual(map.overlay.markers, [{ id: 'r1', revealed: true, summary: 'vu' }], 'repère non révélé retiré');
  assert.deepEqual(redact('universe', s.universes.u1), s.universes.u1, 'type sans secret : inchangé');
});
