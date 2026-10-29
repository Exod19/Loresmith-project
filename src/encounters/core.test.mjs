/**
 * Tests des rencontres vivantes Underdark : ceux du kit V1 (moteur navigateur), plus les contextes de contrôle
 * demandés (Palissade, marché duergar, mine, caravane hors territoire, élevage, forêt fongique, ruine, zone isolée).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createEncounterCore } from './core.js';

const read = (name) => JSON.parse(readFileSync(fileURLToPath(new URL(`./data/${name}.v1.json`, import.meta.url)), 'utf8'));
const core = createEncounterCore({
  policy: read('association-policy'), taxonomy: read('location-taxonomy'), templates: read('encounter-templates'),
  creatureRefs: read('creature-refs'), canonLocations: read('canon-locations'), npcArchetypes: read('npc-archetypes'),
});
const { TEMPLATES, validateComposition, validateAllTemplates, buildInventory, generateEncounter, diceRoll, candidateEncounters } = core;
const master = JSON.parse(readFileSync(fileURLToPath(new URL('../data/underdark/bestiaire-683.json', import.meta.url)), 'utf8'));

const mori = { id: 'lieu-ozzoloh', name: 'Ozzoloh Ventreen', owner: 'moriquendi', tags: ['urban', 'market', 'moriquendi_territory'], zone: 'cite' };
const duergar = { id: 'cit-duergar', name: 'Cité duergar', owner: 'duergar', tags: ['urban', 'market', 'forge', 'route'], zone: 'cite' };

test('les 89 modèles ont des IDs uniques et des références valides', () => {
  assert.equal(TEMPLATES.length, 89);
  assert.deepEqual(validateAllTemplates().errors, []);
});
test('chaque créature citée par le kit existe dans le bestiaire de 683 fiches', () => {
  const ids = new Set(master.creatures.map((c) => c.id));
  for (const r of core.CREATURE_REFS) assert.ok(ids.has(r.id), r.id);
});
test('rencontre civile Moriquendi permise dans une cité Moriquendi', () => {
  const t = TEMPLATES.find((x) => x.name === 'Marchand Moriquendi et escorte de la Famille');
  assert.equal(validateComposition(t, mori).allowed, true);
});
test('colporteurs étrangers refusés en territoire Moriquendi', () => {
  const t = TEMPLATES.find((x) => x.name === 'Colporteurs gobelins');
  assert.ok(validateComposition(t, mori).reasons.includes('TERRITOIRE_MORI_VISITEURS_NON_AUTORISES'));
});
test('marchand Moriquendi + serviteurs kobolds : refusé sans exception nommée', () => {
  const t = TEMPLATES.find((x) => x.exceptionId === 'mori_merchant_kobold_retinue');
  assert.equal(validateComposition(t, mori).allowed, false);
});
test('… accepté seulement avec un chef nommé, un motif et la validation du MJ', () => {
  const t = TEMPLATES.find((x) => x.exceptionId === 'mori_merchant_kobold_retinue');
  const ok = { mori_merchant_kobold_retinue: { enabled: true, approvedBy: 'MJ', namedLeader: 'Un nom', rationale: 'Lien de service avéré' } };
  assert.equal(validateComposition(t, mori, { approvedExceptions: ok }).allowed, true);
  assert.equal(validateComposition(t, mori, { approvedExceptions: { mori_merchant_kobold_retinue: { ...ok.mori_merchant_kobold_retinue, enabled: false } } }).allowed, false);
});
test('un Moriquendi ne sert jamais un chef d’un autre peuple', () => {
  const t = { ...TEMPLATES[0], faction: 'independent', groupMembers: [{ species: 'kobold', relationToLeader: 'leader' }, { species: 'moriquendi', relationToLeader: 'servant' }] };
  assert.ok(validateComposition(t, duergar, { approvedExceptions: {} }).reasons.includes('MORI_SOUS_AUTORITE_EXTERNE_INTERDIT'));
});
test('des clans Moriquendi différents cohabitent (même nation)', () => {
  const t = { ...TEMPLATES[0], locationTags: ['urban'], groupMembers: [{ species: 'moriquendi', relationToLeader: 'leader', clan: 'Norrianiss' }, { species: 'moriquendi', relationToLeader: 'member', clan: 'Drehjur' }] };
  assert.equal(validateComposition(t, mori).allowed, true);
});
test('aucun clan « Ventreen » dans les données', () => {
  const text = JSON.stringify(TEMPLATES);
  assert.ok(!/clan[^"]{0,20}"?\s*:\s*"Ventreen/i.test(text));
});
test('un lieu de démonstration reste une démonstration ; un lieu canonique non localisé n’a pas de position', () => {
  const atlas = { version: 'fixture', features: [
    { id: 'demo-road', title: 'Marché de démo', category: 'ressource', canonStatus: 'creation', placementStatus: 'illustrative', demo: true },
    { id: 'lieu-ozzoloh', title: 'Ozzoloh Ventreen', category: 'cite', entryId: 'li-ozzoloh', canonStatus: 'confirme', placementStatus: 'unknown' }],
    maps: [{ id: 'carte-1', scope: { kind: 'strate', id: 'n1-strate-1' } }], geometries: [{ id: 'g', featureId: 'demo-road', mapId: 'carte-1', type: 'point', coordinates: [0.4, 0.5] }] };
  const inv = buildInventory(atlas, []);
  assert.equal(inv.locations.find((x) => x.id === 'demo-road').eligibilityStatus, 'DEMO_NOT_CANON');
  const o = inv.locations.find((x) => x.id === 'lieu-ozzoloh');
  assert.equal(o.placedOnAtlas, false);
  assert.equal(o.placementStatus, 'unknown');
});
test('graine reproductible ; la cargaison n’est jamais un butin automatique', () => {
  const a = generateEncounter(duergar, TEMPLATES, { seed: 'abc' }), b = generateEncounter(duergar, TEMPLATES, { seed: 'abc' });
  assert.equal(a.status, 'generated');
  assert.deepEqual(a, b);
  assert.equal(a.enforceNoAutoLoot, true);
  assert.ok(a.groupMembers.every((m) => m.automaticLootAward === false));
});
test('les dés respectent les bornes', () => {
  assert.equal(diceRoll('1d6+2', () => 0), 3);
  assert.equal(diceRoll('1d6+2', () => 0.999), 8);
});
test('taille et emprise explicites (pas devinées pour les PNJ sans fiche)', () => {
  const out = generateEncounter(duergar, TEMPLATES, { seed: 'grid-test' });
  assert.ok(out.groupMembers.every((x) => 'size' in x && 'gridFootprint' in x));
});
test('« Les Palissades » ne sont pas une sixième cité', () => {
  const out = buildInventory({ features: [{ id: 'lieu-palissades', title: 'Les Palissades', category: 'cite', canonStatus: 'confirme', placementStatus: 'unknown' }] }, []);
  assert.equal(out.locations.some((x) => x.id === 'lieu-palissades'), false);
});
test('une bête peu sentiente ne dirige pas un groupe marchand', () => {
  const low = core.CREATURE_REFS.find((x) => typeof x.sentience === 'number' && x.sentience < 3);
  const sample = { ...TEMPLATES[0], faction: 'fauna', kind: 'trade', groupMembers: [{ creatureId: low.id, species: 'fauna', relationToLeader: 'leader' }], locationTags: ['market'] };
  assert.ok(validateComposition(sample, duergar).reasons.includes('CREATURE_NON_SAPIENTE_NE_PAS_DIRIGER_COMMERCE_OU_DIPLOMATIE'));
});

/* ——— Les huit contextes de contrôle ——— */
const contexts = {
  palissade: { id: 'p', name: 'Palissade Moriquendi', owner: 'moriquendi', tags: ['urban', 'residential', 'moriquendi_territory'], zone: 'cite' },
  marcheDuergar: { id: 'm', name: 'Marché duergar', owner: 'duergar', tags: ['urban', 'market'], zone: 'cite' },
  mine: { id: 'mi', name: 'Mine du Filon Muet', owner: 'duergar', tags: ['mine', 'resource'], zone: 'sauvage' },
  caravane: { id: 'c', name: 'Grande route', owner: null, tags: ['route', 'transit'], zone: 'transit' },
  elevage: { id: 'e', name: 'Enclos de rothés', owner: null, tags: ['farm', 'ecology'], zone: 'sauvage' },
  foret: { id: 'f', name: 'Forêt fongique', owner: null, tags: ['ecology', 'cave'], zone: 'sauvage' },
  ruine: { id: 'r', name: 'Ancienne ruine', owner: null, tags: ['ruins', 'scavengers'], zone: 'sauvage' },
  isolee: { id: 'z', name: 'Zone dangereuse isolée', owner: null, tags: ['hazard', 'wilderness'], zone: 'sauvage' },
};
for (const [key, place] of Object.entries(contexts)) {
  test(`contexte « ${place.name} » : au moins une rencontre admissible, aucune ne viole les règles`, () => {
    const pool = candidateEncounters(place);
    assert.ok(pool.length > 0, `${key} : aucune rencontre`);
    for (const c of pool) assert.equal(validateComposition(c.template, place).allowed, true);
  });
}
test('Palissade : aucun visiteur étranger injecté par défaut', () => {
  for (const c of candidateEncounters(contexts.palissade)) {
    const t = c.template;
    const social = t.faction !== 'fauna' && (t.groupMembers || []).length > 0;
    if (social) assert.equal(t.faction, 'moriquendi', t.name);
  }
});
test('mine duergar : les équipes duergar dominent les tirages', () => {
  let duer = 0;
  for (let i = 0; i < 200; i++) { const g = generateEncounter(contexts.mine, TEMPLATES, { seed: `mine-${i}` }); if (g.status === 'generated' && TEMPLATES.find((t) => t.id === g.templateId).faction === 'duergar') duer++; }
  assert.ok(duer > 100, `duergar ${duer}/200`);
});
test('ruine : pas de marchand au hasard', () => {
  for (const c of candidateEncounters(contexts.ruine)) assert.notEqual(c.template.kind, 'trade', c.template.name);
});
