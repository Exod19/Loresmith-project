/** Banque Loresmith : cohérence des choix (peuples, climats, saisons), versions d'image et angles. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { peoplesOf, pickPerson, pickElement, pickTexture, mipFor, roleKeys, faceAngle, roofAngle, withOverrides, bankUrl, peupleKey, npcTraits, nameGenre, tokenScale } from './banque.js';

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

test('Toit en L, en T ou en U : le bon toit, dans la bonne orientation', async () => {
  const { maskFromParts, turnedMask, fitRoof } = await import('./banque.js');
  const cat = JSON.parse(readFileSync(new URL('./catalogue.json', import.meta.url), 'utf8')).images;
  // Un L : corps en bas sur toute la largeur, aile à gauche vers le haut.
  const L = maskFromParts([[0, 0.5, 1, 1], [0, 0, 0.45, 1]]);
  const got = fitRoof(cat, { mask: L, w: 14, h: 14, climat: 'tempere', seed: 'x' });
  assert.equal(got?.img.forme, 'L');
  assert.ok(turnedMask(got.img.masque, got.rot, got.flip).split('').filter((c, i) => c === L[i]).length >= 56);
  // Une emprise pleine prend un toit plein, jamais un dôme qui laisserait voir les coins.
  for (let i = 0; i < 20; i++) assert.ok(['rect', 'carre'].includes(fitRoof(cat, { mask: maskFromParts([[0, 0, 1, 1]]), w: 10, h: 7, climat: 'tempere', seed: `r${i}` }).img.forme));
  const U = maskFromParts([[0, 0, 1, 0.4], [0, 0, 0.3, 1], [0.7, 0, 1, 1]]);
  assert.equal(fitRoof(cat, { mask: U, w: 20, h: 16, climat: 'tempere', seed: 'u' })?.img.forme, 'U');
  assert.equal(turnedMask('1000000000000000000000000000000000000000000000000000000000000000', 1, false)[7], '1', 'un quart de tour horaire envoie le coin haut-gauche en haut-droite');
});

test('Jetons : un jeton pris à la verticale passe avant un jeton incliné du même rôle', () => {
  const list = [
    P('garde-incline', 'humain', ['garde'], 'jeton', { angle: 'incline' }),
    P('garde-zenith', 'humain', ['garde'], 'jeton', { angle: 'zenith' }),
    P('tav-incline', 'humain', ['tavernier'], 'jeton', { angle: 'incline' }),
  ];
  const pe = peoplesOf({ people: 'humains' });
  for (let i = 0; i < 30; i++) assert.equal(pickPerson(list, { vue: 'jeton', role: 'garde', peoples: pe, seed: `z${i}` })?.id, 'garde-zenith');
  // Le rôle reste prioritaire : un tavernier incliné plutôt qu'un garde vu de haut.
  assert.equal(pickPerson(list, { vue: 'jeton', role: 'tavernier', peoples: pe, seed: 'z' })?.id, 'tav-incline');
});

test('Genre et peuple d’un PNJ : fiche, rôle, prénom', () => {
  for (const n of ['Mahaut', 'Isaure', 'Ombeline', 'Aveline', 'Ermengarde', 'Bérénice', 'Guenièvre', 'Ysolde']) assert.equal(nameGenre(n), 'f', n);
  for (const n of ['Perrin', 'Baudouin', 'Anselme', 'Lothaire', 'Godefroy', 'Hugues', 'Aldric']) assert.equal(nameGenre(n), 'm', n);
  assert.deepEqual(npcTraits({ name: 'Camille', role: 'tavernière' }), { genre: 'f' });
  assert.deepEqual(npcTraits({ name: 'Lou', gender: 'male', race: 'Nain des collines' }), { genre: 'm', peuple: 'nain' });
  assert.equal(npcTraits({ name: 'Brin', desc: 'Une halfeline rieuse.' }).peuple, 'halfelin');
  assert.equal(npcTraits({ name: 'Sylas', desc: 'Un demi-elfe taciturne.' }).peuple, 'demi-elfe');
  assert.equal(npcTraits({ name: 'Paul', desc: 'Un homme bourru.' }).peuple, undefined, '« homme » ne dit pas le peuple');
});

test('Genre strict et poses en contexte', () => {
  const list = [
    P('f-debout', 'humain', ['villageois'], 'jeton', { genre: 'f' }),
    P('m-debout', 'humain', ['villageois'], 'jeton', { genre: 'm' }),
    P('m-couche', 'humain', ['villageois'], 'jeton', { genre: 'm', pose: 'couche' }),
  ];
  const pe = peoplesOf({ people: 'humains' });
  for (let i = 0; i < 30; i++) {
    assert.equal(pickPerson(list, { vue: 'jeton', genre: 'f', peoples: pe, seed: `g${i}` })?.id, 'f-debout');
    assert.equal(pickPerson(list, { vue: 'jeton', genre: 'm', peoples: pe, seed: `g${i}` })?.id, 'm-debout', 'jamais couché par terre sans raison');
    assert.equal(pickPerson(list, { vue: 'jeton', genre: 'm', pose: 'couche', peoples: pe, seed: `g${i}` })?.id, 'm-couche');
  }
});

test('Échelle des jetons : un halfelin, un nain, un enfant sont plus petits qu’un humain', () => {
  const h = tokenScale({ type: 'personnage', peuple: 'humain' });
  assert.equal(h, 1);
  assert.ok(tokenScale({ type: 'personnage', peuple: 'halfelin' }) < tokenScale({ type: 'personnage', peuple: 'nain' }));
  assert.ok(tokenScale({ type: 'personnage', peuple: 'nain' }) < h);
  assert.ok(tokenScale({ type: 'personnage', peuple: 'humain', roles: ['enfant'] }) < h);
  assert.ok(tokenScale({ type: 'personnage', peuple: 'humain', angle: 'zenith' }) < h);
});

test('surface et Outreterre ne se mêlent jamais : personnages et créatures d’un seul monde, tirage limité au sien', () => {
  const imgs = JSON.parse(readFileSync(new URL('./catalogue.json', import.meta.url), 'utf8')).images;
  for (const e of imgs.filter((i) => i.type === 'personnage' || i.type === 'creature')) assert.equal(e.region.length, 1, e.id);
  const peoples = { main: ['moriquendi', 'drow', 'duergar', 'svirfnebelin', 'humain', 'nain'], others: [], banned: [] };
  for (const region of ['surface', 'outreterre']) {
    for (let i = 0; i < 60; i++) {
      for (const vue of ['jeton', 'portrait']) {
        const got = pickPerson(imgs, { vue, peoples, seed: `s${i}`, region });
        if (got) assert.deepEqual(got.region, [region], got.id);
      }
    }
  }
  // Un jeton et son portrait jumeau : même monde, même type.
  const byId = Object.fromEntries(imgs.map((i) => [i.id, i]));
  for (const e of imgs.filter((i) => i.paire && byId[i.paire])) {
    assert.equal(byId[e.paire].type, e.type, e.id);
    assert.deepEqual(byId[e.paire].region, e.region, e.id);
  }
});
