// Fouille d'un vaincu : un butin logique selon ce qu'il est (pas des habits de noble sur un pêcheur kuo-toa).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lootOf, natureOf, gearOf, crOf } from './loot.js';

const labels = (l) => l.items.map((i) => i.label).join(' | ');

test('un pêcheur kuo-toa porte des poissons et un filet, pas de chevalière', () => {
  for (const seed of ['a', 'b', 'c', 'd']) {
    const l = lootOf({ id: 'k1', name: 'Kuo-toa pêcheur de grotte', ref: { loot: ['harpon osseux', 'filet noué', 'talisman aquatique'], ecology: { diet: 'poissons, algues' } } }, { region: 'outreterre', seed });
    assert.match(labels(l), /poissons/);
    assert.match(labels(l), /filet/);
    assert.doesNotMatch(labels(l), /chevali|parfum|insigne de la garde/);
  }
});

test('une bête n’a pas de bourse, mais des dépouilles à prélever sur un jet', () => {
  const l = lootOf({ id: 'w', name: 'Loup', meta: 'Bête de taille M, sans alignement', cr: '1/4 (50 PX)', actions: [['Morsure', '…']] });
  assert.equal(l.items.some((i) => i.kind === 'monnaie'), false);
  assert.equal(l.items.some((i) => i.kind === 'equipement'), false);
  assert.equal(l.harvest.skill, 'Survie');
  assert.match(l.harvest.items.join(' '), /peau de loup/);
});

test('l’équipement vient de la fiche : armure de la CA, armes et munitions', () => {
  const g = gearOf({ ac: '15 (chemise de mailles)', actions: [['Épée courte', ''], ['Arbalète de poing', ''], ['Multiattaque', '']] }, () => 0.9);
  const t = g.map((i) => i.label).join(' | ');
  assert.match(t, /chemise de mailles/);
  assert.match(t, /épée courte/);
  assert.match(t, /arbalète de poing/);
  assert.match(t, /carreaux/);
  assert.doesNotMatch(t, /multiattaque/i);
  assert.equal(gearOf({ ac: '13 (armure naturelle)' }).length, 0);
});

test('natures : la fiche prime, et pas de faux amis (pirate n’est pas un rat)', () => {
  assert.equal(natureOf('', 'Pirate'), 'humanoide');
  assert.equal(natureOf('Mort-vivant de taille M', 'Garde squelette'), 'mort-vivant');
  assert.equal(natureOf('Vase de taille G', 'Cube gélatineux'), 'vase');
  assert.equal(natureOf('', 'Ours brun'), 'bete');
  assert.equal(crOf('1/4 (50 PX)'), 0.25);
});

test('tirage stable pour un même vaincu ; un garde a son insigne', () => {
  const c = { id: 'g1', name: 'Garde de la ville', meta: 'Humanoïde (humain) de taille M', ac: '16 (chemise de mailles, bouclier)', cr: '1/8', actions: [['Lance', '']] };
  assert.deepEqual(lootOf(c, { seed: 's' }), lootOf(c, { seed: 's' }));
  assert.match(labels(lootOf(c, { seed: 's' })), /insigne/);
  assert.match(labels(lootOf(c, { seed: 's' })), /bouclier/);
});
