/** Banque Loresmith : cohérence des choix (peuples, climats, saisons), versions d'image et angles. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { peoplesOf, pickPerson, pickElement, pickTexture, mipFor, roleKeys, faceAngle, roofAngle, withOverrides, bankUrl, peupleKey } from './banque.js';

const P = (id, peuple, roles, vue = 'portrait', extra = {}) => ({ id, type: 'personnage', vue, peuple, roles, mips: [256, 512, 1024], ...extra });
const people = [
  P('tav-nain', 'nain', ['tavernier', 'aubergiste'], 'jeton'),
  P('tav-halfelin', 'halfelin', ['tavernier', 'aubergiste'], 'jeton'),
  P('noble-tief', 'tieffelin', ['noble', 'tavernier'], 'jeton'),
  P('garde-humain', 'humain', ['garde'], 'jeton'),
  P('duergar', 'duergar', ['tavernier'], 'jeton'),
  P('drow', 'drow', ['marchand'], 'jeton'),
  P('marchande', 'humain', ['marchand'], 'portrait'),
];

test('Outreterre : aucun humain, seulement les peuples des profondeurs', () => {
  const pe = peoplesOf({ region: 'outreterre', text: 'Une cité humaine perdue' });
  assert.ok(!pe.main.includes('humain'));
  for (let i = 0; i < 40; i++) {
    const got = pickPerson(people, { vue: 'jeton', role: 'tavernier', peoples: pe, seed: `p${i}` });
    assert.ok(!got || ['duergar', 'drow', 'svirfnebelin'].includes(got.peuple), got?.id);
  }
});

test('Cité de surface ou cité Mori : pas de tavernier duergar', () => {
  const surface = peoplesOf({ text: 'Port marchand où se croisent humains et nains.' });
  const mori = peoplesOf({ region: 'outreterre', text: 'Cité des Moriquendi, elfes noirs des profondeurs.' });
  for (let i = 0; i < 40; i++) {
    assert.notEqual(pickPerson(people, { vue: 'jeton', role: 'tavernier', peoples: surface, seed: `s${i}` })?.peuple, 'duergar');
    assert.notEqual(pickPerson(people, { vue: 'jeton', role: 'tavernier', peoples: mori, seed: `m${i}` })?.peuple, 'duergar');
  }
  assert.ok(mori.main.includes('moriquendi') && mori.main.includes('drow'));
});

test('Cité humaine où l’on chasse les créatures : pas de tieffelin', () => {
  const pe = peoplesOf({ people: 'humains', text: 'Les inquisiteurs y traquent sans relâche les créatures et les démons.' });
  assert.ok(pe.hostile);
  assert.ok(pe.banned.includes('tieffelin'));
  for (let i = 0; i < 40; i++) assert.notEqual(pickPerson(people, { vue: 'jeton', role: 'tavernier', peoples: pe, seed: `h${i}` })?.peuple, 'tieffelin');
});

test('Peuple banni par la fiche, peuple principal favori, rôle respecté', () => {
  const pe = peoplesOf({ people: 'nains', text: 'Aucun halfelin n’y est le bienvenu.' });
  assert.deepEqual(pe.main, ['nain']);
  assert.ok(pe.banned.includes('halfelin'));
  const got = pickPerson(people, { vue: 'jeton', role: 'Tavernière', peoples: pe, seed: 'x' });
  assert.equal(got.id, 'tav-nain');
  assert.equal(pickPerson(people, { vue: 'portrait', role: 'garde', peoples: pe, seed: 'x' }), null, 'pas de garde en portrait : rien plutôt qu’une marchande');
  assert.ok(roleKeys('prêtresse').includes('pretre'));
  assert.equal(peupleKey('Demi-elfes'), 'demi-elfe');
  assert.deepEqual(peoplesOf({ text: 'Des demi-elfes vivent ici.' }).main, ['demi-elfe']);
});

test('Même graine, même visage', () => {
  const pe = peoplesOf({ text: 'humains, nains et halfelins' });
  const a = pickPerson(people, { vue: 'jeton', role: 'tavernier', peoples: pe, seed: 'pnj-42' });
  assert.equal(pickPerson(people, { vue: 'jeton', role: 'tavernier', peoples: pe, seed: 'pnj-42' }), a);
});

const E = (id, cat, extra = {}) => ({ id, type: 'element', cat, region: ['surface'], climats: [], saisons: [], milieux: [], mips: [256, 512, 1024], ...extra });
const elements = [
  E('chene', 'arbre', { climats: ['tempere'], taille: [12, 12] }),
  E('givre', 'arbre', { climats: ['tempere', 'froid'], saisons: ['hiver'], taille: [9, 9] }),
  E('palmier', 'arbre', { climats: ['chaud', 'aride'], taille: [8, 8] }),
  E('champi', 'souterrain', { region: ['outreterre'] }),
  E('longere', 'toit', { forme: 'rect', taille: [13, 5], climats: ['tempere'] }),
  E('tuiles', 'toit', { forme: 'carre', taille: [10, 10], climats: ['tempere', 'chaud'] }),
];

test('Éléments selon le climat, la saison et la région', () => {
  for (let i = 0; i < 30; i++) {
    assert.equal(pickElement(elements, { cat: 'arbre', climat: 'chaud', seed: `a${i}` }).id, 'palmier');
    assert.notEqual(pickElement(elements, { cat: 'arbre', climat: 'tempere', saison: 'ete', seed: `b${i}` }).id, 'givre');
  }
  const hiver = Array.from({ length: 40 }, (_, i) => pickElement(elements, { cat: 'arbre', climat: 'tempere', saison: 'hiver', seed: `c${i}` }).id);
  assert.ok(hiver.filter((x) => x === 'givre').length > 25, 'en hiver, l’arbre givré passe devant');
  assert.equal(pickElement(elements, { cat: 'souterrain', seed: 'x' }), null, 'pas de champignon des profondeurs à la surface');
  const long = Array.from({ length: 30 }, (_, i) => pickElement(elements, { cat: 'toit', climat: 'tempere', ratio: 2.6, seed: `r${i}` }).id);
  assert.ok(long.filter((x) => x === 'longere').length > 20, 'une emprise allongée prend un toit allongé');
  assert.equal(pickTexture([{ id: 'n', type: 'texture', cat: 'neige', saisons: ['hiver'], climats: [] }], { cats: ['neige'], saison: 'ete' }), null);
});

test('Versions d’image : la plus petite assez nette, jamais d’agrandissement', () => {
  const img = { mips: [256, 512, 1024] };
  assert.equal(mipFor(img, 40), 256);
  assert.equal(mipFor(img, 300), 512);
  assert.equal(mipFor(img, 300, 2), 1024);
  assert.equal(mipFor(img, 5000), 1024);
  assert.equal(mipFor({ mips: [256, 512] }, 900), 512);
  assert.equal(bankUrl({ id: 'chene', type: 'element' }, 512, '/app/'), '/app/banque/elements/chene-512.webp');
});

test('Angles : un personnage fait face, un toit suit son emprise', () => {
  assert.ok(Math.abs(faceAngle(0, 1)) < 1e-9, 'regarder vers le bas : image telle quelle');
  assert.ok(Math.abs(faceAngle(0, -1) - Math.PI) < 1e-9 || Math.abs(faceAngle(0, -1) + Math.PI) < 1e-9);
  const a = roofAngle({ taille: [13, 5] }, 4, 12, 0, 'k');
  assert.ok(Math.abs(Math.cos(a)) < 1e-9, 'image allongée, emprise en hauteur : quart de tour');
  assert.equal(withOverrides([{ id: 'x', peuple: 'humain' }], { x: { peuple: 'nain' } })[0].peuple, 'nain');
});

test('Catalogue réel : chaque image a ses versions et des étiquettes utilisables', () => {
  const cat = JSON.parse(readFileSync(new URL('./catalogue.json', import.meta.url), 'utf8')).images;
  assert.ok(cat.length >= 160);
  for (const img of cat) {
    assert.ok(img.mips.length >= 1 && img.mips[0] === 256, img.id);
    if (img.type === 'element') assert.ok(Array.isArray(img.taille) && img.taille[0] > 0, img.id);
    if (img.type === 'personnage') assert.ok(img.peuple, img.id);
  }
  // Pas d'humain en Outreterre, même avec tout le catalogue.
  const pe = peoplesOf({ region: 'outreterre' });
  for (let i = 0; i < 20; i++) assert.notEqual(pickPerson(cat, { vue: 'jeton', role: 'tavernier', peoples: pe, seed: `u${i}` })?.peuple, 'humain');
});
