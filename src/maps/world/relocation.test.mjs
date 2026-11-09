// Après un incendie : la prêtresse célèbre en plein air sur la place, ou chez un autre temple de la cité.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relocationOf, returnOf } from './relocation.js';

const temple = { id: 'c:b2', title: 'Temple de l’Aube', type: 'temple' };

test('temple brûlé sans autre temple : offices en plein air sur la place du marché', () => {
  const r = relocationOf(temple, 'ruine', ['Mère Ysolde'], { sameType: [temple], market: { id: 'c:marche', title: 'Place du marché' } });
  assert.equal(r.to.id, 'c:marche');
  assert.match(r.text, /Mère Ysolde célèbre désormais les offices sur la place du marché/);
  assert.equal(r.label, 'Office en plein air');
});

test('un autre temple de la cité accueille les fidèles', () => {
  const r = relocationOf(temple, 'chantier', [], { sameType: [temple, { id: 'c:b7', title: 'Chapelle Saint-Odon' }], market: { id: 'c:marche', title: 'Place du marché' } });
  assert.equal(r.to.id, 'c:b7');
  assert.match(r.text, /Le prêtre et les fidèles ont trouvé refuge/);
  assert.match(r.text, /à la chapelle Saint-Odon voisine/i);
});

test('plusieurs habitants : le premier porte la phrase, les autres le suivent', () => {
  const r = relocationOf({ id: 't', title: 'Taverne', type: 'taverne' }, 'ruine', ['Ysolde', 'Clémence', 'Gaspard'], { market: { id: 'm', title: 'Place du marché' } });
  assert.match(r.text, /^Ysolde sert à boire sur la place du marché/);
  assert.match(r.text, /À ses côtés : Clémence, Gaspard\./);
});

test('personne n’est délogé d’un lieu reconstruit ou délaissé ; retour annoncé', () => {
  assert.equal(relocationOf(temple, 'reconstruit'), null);
  assert.equal(relocationOf(temple, 'delaisse'), null);
  assert.match(returnOf(temple, ['Mère Ysolde']), /Mère Ysolde a réintégré Temple de l’Aube/);
  assert.equal(relocationOf({ id: 'x', title: 'Maison', type: 'maison' }, 'ruine').to, null);
});
