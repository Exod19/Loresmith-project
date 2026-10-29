import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strFromU8, unzipSync } from 'fflate';
import { analyzeImport, applyImport, archiveName, buildArchive, imageIdsOf, readArchive, remapIds, selectScope } from './archive.js';

const IMG = { type: 'image/webp', bytes: new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]) };
const IMG2 = { type: 'image/png', bytes: new Uint8Array([137, 80, 78, 71, 9, 9]) };

/** Deux univers, une campagne dans le premier, des images en références. */
const grimoire = () => ({
  activeUniverseId: 'u1',
  universes: { u1: { id: 'u1', name: 'Underdark' }, u2: { id: 'u2', name: 'Voisin' } },
  characters: { c1: { id: 'c1', name: 'Aria', universeId: 'u1' }, c2: { id: 'c2', name: 'Autre', universeId: 'u2' } },
  campaigns: { k1: { id: 'k1', title: 'La descente', universeId: 'u1', scenes: [{ id: 's1', title: 'Porte' }], foundations: { partyIds: ['c1'] } } },
  npcs: {
    n1: { id: 'n1', name: 'Yemena', universeId: 'u1', linkedSceneIds: ['s1'], token: 'lsimg:aaa' },
    n2: { id: 'n2', name: 'Sans lien', universeId: 'u1' },
    n3: { id: 'n3', name: 'Ailleurs', universeId: 'u2' },
  },
  quests: {},
  assets: {
    a1: { id: 'a1', targetType: 'npc', targetId: 'n1', universeId: 'u1', dataUrl: 'lsimg:bbb' },
    a2: { id: 'a2', targetType: 'player', targetId: 'c2', universeId: 'u2', dataUrl: 'lsimg:ccc' },
  },
  libraryEntries: { l1: { id: 'l1', title: 'Menzo', universeId: 'u1', linkedCampaignIds: ['k1'], secrets: 'vérité' } },
  maps: { 'atlas-profondeurs': { id: 'atlas-profondeurs', universeId: 'u1', kind: 'atlas' } },
  chatThreads: { t1: { id: 't1', universeId: 'u1', campaignId: 'k1' } },
  combat: { combatants: [], round: 1 },
  log: [{ id: 'g1', universeId: 'u1' }, { id: 'g2', universeId: 'u2' }],
});

const images = () => new Map([['aaa', IMG], ['bbb', IMG2]]);

test('aller-retour : grimoire → archive → grimoire, données et images identiques', () => {
  const data = selectScope(grimoire(), { kind: 'all' });
  const zip = buildArchive({ data, scope: { kind: 'all' }, images: images() });
  const back = readArchive(zip);
  assert.deepEqual(back.data, data);
  assert.equal(back.manifest.scope.kind, 'all');
  assert.deepEqual([...back.images.keys()].sort(), ['aaa', 'bbb']);
  assert.deepEqual(back.images.get('aaa').bytes, IMG.bytes);
  assert.equal(back.images.get('bbb').type, 'image/png');
  assert.ok(Object.keys(unzipSync(zip)).includes('images/aaa.webp'));
});

test('export d’un univers : rien de ses voisins', () => {
  const data = selectScope(grimoire(), { kind: 'universe', id: 'u1' });
  assert.deepEqual(Object.keys(data.universes), ['u1']);
  assert.deepEqual(Object.keys(data.characters), ['c1']);
  assert.deepEqual(Object.keys(data.npcs).sort(), ['n1', 'n2']);
  assert.deepEqual(Object.keys(data.assets), ['a1']);
  assert.deepEqual(data.log.map((l) => l.id), ['g1']);
  assert.equal(JSON.stringify(data).includes('u2'), false);
  assert.deepEqual(imageIdsOf(data).sort(), ['aaa', 'bbb']);
});

test('export d’une campagne : la campagne et ce qui lui est lié', () => {
  const data = selectScope(grimoire(), { kind: 'campaign', id: 'k1' });
  assert.deepEqual(Object.keys(data.campaigns), ['k1']);
  assert.deepEqual(Object.keys(data.npcs), ['n1'], 'le PNJ lié à une scène, pas les autres');
  assert.deepEqual(Object.keys(data.libraryEntries), ['l1']);
  assert.deepEqual(Object.keys(data.chatThreads), ['t1']);
  assert.deepEqual(Object.keys(data.assets), ['a1']);
  assert.equal(data.universes, undefined);
});

test('aucune clé d’IA ni donnée inconnue dans une archive', () => {
  const s = { ...grimoire(), ai: { apiKey: 'sk-secret', elevenKey: 'el-secret' }, apiKey: 'sk-secret' };
  for (const scope of [{ kind: 'all' }, { kind: 'universe', id: 'u1' }, { kind: 'campaign', id: 'k1' }]) {
    const zip = buildArchive({ data: selectScope(s, scope), scope, images: images() });
    const text = Object.values(unzipSync(zip)).map((f) => strFromU8(f)).join('\n');
    assert.equal(text.includes('sk-secret') || text.includes('el-secret'), false, scope.kind);
    assert.equal(text.includes('apiKey'), false, scope.kind);
  }
});

test('ancienne sauvegarde .json : lue comme une sauvegarde complète', () => {
  const legacy = { ...grimoire(), npcs: { n1: { id: 'n1', token: 'data:image/png;base64,AAAA' } } };
  const back = readArchive(new TextEncoder().encode(JSON.stringify(legacy)));
  assert.equal(back.manifest.legacy, true);
  assert.equal(back.manifest.scope.kind, 'all');
  assert.deepEqual(back.data, legacy);
  assert.throws(() => readArchive(new TextEncoder().encode('{"x":1}')), /structure inconnue/);
  assert.throws(() => readArchive(new TextEncoder().encode('pas du json')), /illisible/);
});

test('bilan d’import : nouveau, identique, différent', () => {
  const current = grimoire();
  const incoming = selectScope(grimoire(), { kind: 'universe', id: 'u1' });
  incoming.npcs.n1 = { ...incoming.npcs.n1, name: 'Yemena modifiée' };
  incoming.npcs.n9 = { id: 'n9', name: 'Nouveau', universeId: 'u1' };
  const r = analyzeImport(current, incoming);
  assert.equal(r.added, 1);
  assert.equal(r.different, 1);
  assert.equal(r.identical, Object.values(incoming).reduce((n, c) => n + (Array.isArray(c) ? 0 : Object.keys(c).length), 0) - 2);
  assert.deepEqual(r.byCollection.npcs, { added: 1, identical: 1, different: 1 });
});

test('fusion : un élément déjà présent n’est jamais écrasé, et c’est signalé', () => {
  const current = grimoire();
  const incoming = selectScope(grimoire(), { kind: 'universe', id: 'u1' });
  incoming.npcs.n1 = { ...incoming.npcs.n1, name: 'Yemena modifiée' };
  incoming.npcs.n9 = { id: 'n9', name: 'Nouveau', universeId: 'u1' };
  const { state, kept } = applyImport(current, incoming, { mode: 'merge', scope: { kind: 'universe', id: 'u1' } });
  assert.equal(state.npcs.n1.name, 'Yemena', 'version locale conservée');
  assert.equal(state.npcs.n9.name, 'Nouveau', 'le nouveau est ajouté');
  assert.deepEqual(kept, [{ collection: 'npcs', id: 'n1' }]);
  assert.deepEqual(current, grimoire(), 'le grimoire d’origine n’est pas modifié');
});

test('copie : nouveaux identifiants, références suivies, rien d’écrasé', () => {
  const current = grimoire();
  const incoming = selectScope(grimoire(), { kind: 'universe', id: 'u1' });
  let n = 0;
  const { state, kept } = applyImport(current, incoming, { mode: 'copy', scope: { kind: 'universe', id: 'u1' }, newId: () => `new${++n}` });
  // L'Atlas (identifiant fixe) ne peut pas être dupliqué : celui déjà présent est gardé, et c'est signalé.
  assert.deepEqual(kept, [{ collection: 'maps', id: 'atlas-profondeurs' }]);
  assert.equal(Object.keys(state.universes).length, 3);
  const copy = Object.values(state.universes).find((u) => u.id.startsWith('new'));
  const npc = Object.values(state.npcs).find((x) => x.universeId === copy.id && x.name === 'Yemena');
  const asset = Object.values(state.assets).find((a) => a.universeId === copy.id);
  assert.equal(asset.targetId, npc.id, 'l’image suit son PNJ copié');
  assert.equal(npc.token, 'lsimg:aaa', 'les références d’image ne changent pas');
  const camp = Object.values(state.campaigns).find((c) => c.universeId === copy.id);
  assert.deepEqual(camp.foundations.partyIds, [Object.values(state.characters).find((c) => c.universeId === copy.id).id]);
  assert.equal(state.npcs.n1.name, 'Yemena', 'l’original est intact');
  assert.ok(state.maps['atlas-profondeurs'], 'l’Atlas garde son identifiant fixe');
});

test('remplacer un univers : seul cet univers change, ses voisins sont intacts', () => {
  const current = grimoire();
  const incoming = selectScope(grimoire(), { kind: 'universe', id: 'u1' });
  delete incoming.npcs.n2;
  incoming.npcs.n1 = { ...incoming.npcs.n1, name: 'Yemena (archive)' };
  const { state } = applyImport(current, incoming, { mode: 'replace', scope: { kind: 'universe', id: 'u1' } });
  assert.equal(state.npcs.n1.name, 'Yemena (archive)');
  assert.equal(state.npcs.n2, undefined);
  assert.deepEqual(state.npcs.n3, current.npcs.n3);
  assert.deepEqual(state.universes.u2, current.universes.u2);
  assert.deepEqual(state.log.map((l) => l.id).sort(), ['g1', 'g2']);
});

test('remplacer tout : le grimoire devient celui de l’archive', () => {
  const incoming = selectScope({ ...grimoire(), universes: { u3: { id: 'u3', name: 'Neuf' } }, activeUniverseId: 'u3' }, { kind: 'all' });
  const { state } = applyImport(grimoire(), incoming, { mode: 'replace', scope: { kind: 'all' } });
  assert.deepEqual(Object.keys(state.universes), ['u3']);
  assert.equal(state.activeUniverseId, 'u3');
});

test('campagne importée dans un autre navigateur : rattachée à l’univers actif', () => {
  const data = selectScope(grimoire(), { kind: 'campaign', id: 'k1' });
  const vierge = { universes: { z1: { id: 'z1', name: 'Mon univers' } }, activeUniverseId: 'z1' };
  const { state } = applyImport(vierge, data, { mode: 'merge', scope: { kind: 'campaign', id: 'k1', universeId: 'u1' }, targetUniverseId: 'z1' });
  assert.equal(state.campaigns.k1.universeId, 'z1');
  assert.equal(state.npcs.n1.universeId, 'z1');
  assert.equal(state.assets.a1.universeId, 'z1');
  assert.equal(state.activeUniverseId, 'z1');
});

test('remapIds ne touche pas aux identifiants fixes', () => {
  const { map } = remapIds({ maps: { 'atlas-profondeurs': { id: 'atlas-profondeurs' } }, npcs: { n1: { id: 'n1' } } }, () => 'x');
  assert.equal(map.has('atlas-profondeurs'), false);
  assert.equal(map.get('n1'), 'x');
});

test('nom de fichier lisible', () => {
  assert.equal(archiveName('La Descente à Menzoberranzan', new Date('2026-10-29T12:00:00Z')), 'loresmith-la-descente-a-menzoberranzan-2026-10-29.zip');
  assert.equal(archiveName('', new Date('2026-10-29T12:00:00Z')), 'loresmith-grimoire-2026-10-29.zip');
});
