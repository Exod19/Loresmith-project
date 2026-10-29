import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, assertCan, can } from './policy.js';

const U = 'u1';
const K = 'k1';
const actor = (id, universes = {}, campaigns = {}) => ({ id, universes, campaigns });

const owner = actor('owner', { [U]: 'owner' });
const editor = actor('editor', { [U]: 'editor' });
const contributor = actor('contrib', { [U]: 'contributor' });
const reader = actor('reader', { [U]: 'reader' });
const gm = actor('gm', { [U]: 'contributor' }, { [K]: 'gm' });
const cogm = actor('cogm', { [U]: 'reader' }, { [K]: 'cogm' });
const stranger = actor('stranger', { autre: 'owner' }, { autreCampagne: 'gm' });
const ROLES = { owner, editor, contributor, reader, gm, cogm, stranger };

/** Table attendue : pour chaque rôle, les actions permises (toutes les autres sont refusées). */
function check(resource, allowed) {
  for (const [name, a] of Object.entries(ROLES)) {
    for (const action of ACTIONS) {
      const expected = (allowed[name] || []).includes(action);
      assert.equal(can(a, action, resource), expected, `${name} · ${action} · ${resource.type}`);
    }
  }
}

const READ = ['read', 'readSecrets'];

test('univers', () => {
  check({ type: 'universe', id: U }, {
    owner: [...READ, 'create', 'update', 'delete', 'share'],
    editor: [...READ, 'create', 'update'],
    contributor: [...READ, 'create'],
    reader: [...READ, 'create'],
    gm: [...READ, 'create'],
    cogm: [...READ, 'create'],
    stranger: ['create'],
  });
});

test('élément de l’univers créé par quelqu’un d’autre (PNJ, fiche, carte…)', () => {
  for (const type of ['npc', 'library', 'map', 'asset', 'character', 'quest', 'chat']) {
    check({ type, id: 'x', universeId: U, createdBy: 'owner' }, {
      owner: [...READ, 'create', 'update', 'delete'],
      editor: [...READ, 'create', 'update', 'delete'],
      contributor: [...READ, 'create'],
      reader: READ,
      gm: [...READ, 'create'],
      cogm: READ,
      stranger: [],
    });
  }
});

test('un contributeur modifie et supprime seulement ce qu’il a créé', () => {
  const mine = { type: 'npc', id: 'n', universeId: U, createdBy: 'contrib' };
  assert.equal(can(contributor, 'update', mine), true);
  assert.equal(can(contributor, 'delete', mine), true);
  assert.equal(can(contributor, 'update', { ...mine, createdBy: undefined }), false, 'auteur inconnu : refusé');
  assert.equal(can(reader, 'update', { ...mine, createdBy: 'reader' }), false, 'un lecteur ne modifie jamais');
});

test('campagne', () => {
  check({ type: 'campaign', id: K, universeId: U }, {
    owner: [...READ, 'create', 'delete'],
    editor: [...READ, 'create'],
    contributor: [...READ, 'create'],
    reader: READ,
    gm: [...READ, 'create', 'update', 'delete', 'share'],
    cogm: [...READ, 'update'],
    stranger: [],
  });
});

test('secrets de campagne : lisibles par les MJ membres, jamais par un non-membre', () => {
  const camp = { type: 'campaign', id: K, universeId: U };
  for (const a of [owner, editor, contributor, reader, gm, cogm]) assert.equal(can(a, 'readSecrets', camp), true, a.id);
  assert.equal(can(stranger, 'readSecrets', camp), false);
  assert.equal(can(null, 'readSecrets', camp), false);
});

test('discussion rattachée à une campagne : droits de la campagne', () => {
  check({ type: 'chat', id: 't', universeId: U, campaignId: K }, {
    owner: READ,
    editor: READ,
    contributor: READ,
    reader: READ,
    gm: [...READ, 'create', 'update', 'delete'],
    cogm: [...READ, 'create', 'update', 'delete'],
    stranger: [],
  });
});

test('état du compte : son titulaire seulement', () => {
  check({ type: 'userState', id: 'reader', ownerId: 'reader' }, {
    reader: [...READ, 'create', 'update', 'delete'],
  });
});

test('refus par défaut : non connecté, action ou type inconnus, rôle inventé', () => {
  const npc = { type: 'npc', id: 'n', universeId: U };
  assert.equal(can(null, 'read', npc), false);
  assert.equal(can({ universes: { [U]: 'owner' } }, 'read', npc), false, 'pas d’identifiant');
  assert.equal(can(owner, 'publish', npc), false);
  assert.equal(can(owner, 'read', { type: 'secretTable', universeId: U }), false);
  assert.equal(can(owner, 'read', null), false);
  assert.equal(can(actor('x', { [U]: 'admin' }), 'read', npc), false);
  assert.equal(can(owner, 'read', { type: 'npc', id: 'n' }), false, 'élément sans univers');
});

test('assertCan : 401 sans compte, 403 sans droit', () => {
  const npc = { type: 'npc', id: 'n', universeId: U };
  assert.throws(() => assertCan(null, 'read', npc), (e) => e.status === 401);
  assert.throws(() => assertCan(reader, 'delete', npc), (e) => e.status === 403);
  assert.doesNotThrow(() => assertCan(owner, 'delete', npc));
});
