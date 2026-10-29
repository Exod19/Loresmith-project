import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  IMAGE_MAX,
  blobToDataUrl,
  collectStrings,
  dataUrlToBlob,
  extractImages,
  fitWithin,
  hasDataImages,
  imageIdOf,
  inlineRefs,
  isDataImage,
  isRef,
  mapStrings,
  resolveRefs,
  toRefs,
} from './imageRefs.js';

// Petites images base64 (PNG 1×1, et deux contenus distincts).
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const WEBP = 'data:image/webp;base64,' + Buffer.from('jeton-webp').toString('base64');
const JPEG = 'data:image/jpeg;base64,' + Buffer.from('carte-jpeg').toString('base64');

/** Grimoire d'avant le lot 1, avec chaque sorte de champ image relevée par l'audit. */
const legacy = () => ({
  activeUniverseId: 'u1',
  universes: { u1: { id: 'u1', name: 'Underdark' } },
  assets: {
    a1: { id: 'a1', targetType: 'npc', targetId: 'n1', dataUrl: PNG, source: 'upload' },
    a2: { id: 'a2', targetType: 'library', targetId: 'l1', dataUrl: '/images/archives/x.webp', source: 'archives' },
    a3: { id: 'a3', targetType: 'player', targetId: 'c1', dataUrl: 'https://exemple.org/portrait.png', source: 'upload' },
  },
  npcs: { n1: { id: 'n1', name: 'Yemena', token: WEBP } },
  maps: {
    m1: {
      id: 'm1',
      image: JPEG,
      battle: { tokens: [{ id: 't1', image: WEBP }, { id: 't2', image: '🐉' }] },
      overlay: { revealed: [], markers: [], party: { apart: [{ id: 'h1', image: WEBP }] } },
    },
  },
  combat: { round: 2, combatants: [{ id: 'c1', image: WEBP, name: 'Yemena' }] },
  libraryEntries: { l1: { id: 'l1', imageSrcs: ['/images/archives/x.webp'], body: 'data: un texte qui n’est pas une image' } },
  log: [],
});

/** Magasin d'images en mémoire, à la place d'IndexedDB. */
function memoryStore() {
  const blobs = new Map();
  let puts = 0;
  return {
    blobs,
    get puts() { return puts; },
    put: async (id, blob) => { puts++; blobs.set(id, blob); },
    get: async (id) => blobs.get(id) ?? null,
  };
}

test('la migration sort toutes les images base64 et ne touche ni aux chemins ni aux URL', async () => {
  const store = memoryStore();
  const { state, ids } = await extractImages(legacy(), store.put);
  assert.equal(hasDataImages(state), false);
  assert.equal(ids.length, 3, 'trois images distinctes (le jeton est partagé)');
  assert.equal(store.puts, 3, 'une même image n’est écrite qu’une fois');
  assert.ok(isRef(state.assets.a1.dataUrl));
  assert.ok(isRef(state.npcs.n1.token));
  assert.ok(isRef(state.maps.m1.image));
  assert.ok(isRef(state.maps.m1.battle.tokens[0].image));
  assert.ok(isRef(state.maps.m1.overlay.party.apart[0].image));
  assert.ok(isRef(state.combat.combatants[0].image));
  assert.equal(state.npcs.n1.token, state.combat.combatants[0].image, 'même image, même référence');
  assert.equal(state.assets.a2.dataUrl, '/images/archives/x.webp');
  assert.equal(state.assets.a3.dataUrl, 'https://exemple.org/portrait.png');
  assert.equal(state.maps.m1.battle.tokens[1].image, '🐉');
  assert.equal(state.libraryEntries.l1.body, 'data: un texte qui n’est pas une image');
});

test('la migration est sans perte : le retour au base64 redonne exactement le grimoire d’origine', async () => {
  const store = memoryStore();
  const { state } = await extractImages(legacy(), store.put);
  assert.deepEqual(await inlineRefs(state, store.get), legacy());
});

test('la migration est idempotente', async () => {
  const store = memoryStore();
  const once = (await extractImages(legacy(), store.put)).state;
  const before = store.puts;
  const twice = (await extractImages(once, store.put)).state;
  assert.equal(twice, once, 'rien à faire : même objet');
  assert.equal(store.puts, before);
});

test('une image qui ne peut pas être écrite reste en base64', async () => {
  const failing = async () => { throw new Error('quota'); };
  const { state, ids } = await extractImages(legacy(), failing);
  assert.equal(ids.length, 0);
  assert.deepEqual(state, legacy());
});

test('le cache évite de reconvertir une image déjà écrite', async () => {
  const store = memoryStore();
  const cache = new Map();
  await extractImages(legacy(), store.put, cache);
  await extractImages(legacy(), store.put, cache);
  assert.equal(store.puts, 3);
});

test('références et URL affichables : aller-retour', async () => {
  const store = memoryStore();
  const { state } = await extractImages(legacy(), store.put);
  const urls = new Map([...store.blobs.keys()].map((id, i) => [id, `blob:http://localhost/${i}`]));
  const ids = new Map([...urls].map(([id, url]) => [url, id]));
  const live = resolveRefs(state, (id) => urls.get(id));
  assert.equal(collectStrings(live, isRef).length, 0);
  assert.ok(live.npcs.n1.token.startsWith('blob:'));
  assert.deepEqual(toRefs(live, (url) => ids.get(url)), state);
  // Une URL blob inconnue (créée hors du magasin) n'est pas transformée.
  assert.equal(toRefs({ x: 'blob:http://localhost/autre' }, () => undefined).x, 'blob:http://localhost/autre');
});

test('une référence sans image connue reste telle quelle', () => {
  assert.equal(resolveRefs({ x: 'lsimg:absente' }, () => undefined).x, 'lsimg:absente');
});

test('mapStrings garde la structure de ce qui ne change pas', () => {
  const s = legacy();
  const out = mapStrings(s, (v) => (v === WEBP ? 'x' : v));
  assert.notEqual(out, s);
  assert.equal(out.universes, s.universes);
  assert.equal(out.assets, s.assets);
  assert.equal(mapStrings(s, (v) => v), s);
});

test('data URL ↔ Blob, base64 et texte', async () => {
  const blob = dataUrlToBlob(PNG);
  assert.equal(blob.type, 'image/png');
  assert.equal(await blobToDataUrl(blob), PNG);
  const svg = dataUrlToBlob('data:image/svg+xml,%3Csvg%2F%3E');
  assert.equal(svg.type, 'image/svg+xml');
  assert.equal(await svg.text(), '<svg/>');
  assert.ok(isDataImage(PNG) && !isDataImage('/images/x.png') && !isDataImage('data:text/plain,x'));
});

test('l’identifiant dépend du contenu seulement', async () => {
  const a = await imageIdOf(dataUrlToBlob(WEBP));
  assert.equal(a, await imageIdOf(dataUrlToBlob(WEBP)));
  assert.notEqual(a, await imageIdOf(dataUrlToBlob(JPEG)));
  assert.match(a, /^[0-9a-f]{32}$/);
});

test('compression : tailles maximales par usage, sans agrandir', () => {
  assert.deepEqual(IMAGE_MAX, { portrait: 512, illustration: 1024, carte: 1600 });
  assert.deepEqual(fitWithin(2048, 1024, IMAGE_MAX.portrait), { width: 512, height: 256 });
  assert.deepEqual(fitWithin(1200, 4000, IMAGE_MAX.carte), { width: 480, height: 1600 });
  assert.deepEqual(fitWithin(300, 200, IMAGE_MAX.carte), { width: 300, height: 200 });
  assert.deepEqual(fitWithin(0, 0, 512), { width: 1, height: 1 });
});
