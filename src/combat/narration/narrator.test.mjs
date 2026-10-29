/**
 * Tests des Chroniques du Combat (`npm test`). Chargés depuis le disque : rien ne dépend du réseau (hors ligne).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildLibrary, selectNarration, eligible, classify, renderNarration, displayName, weaponKindOf, damageTypeOf, anatomyOf, creatureOf,
  emptyHistory, remember, recentIds, streakFacts, invalidReason,
} from './narrator.js';

const dir = fileURLToPath(new URL('../../data/combatNarration/', import.meta.url));
const manifest = JSON.parse(readFileSync(`${dir}manifest.json`, 'utf8'));
const raw = Object.fromEntries(readdirSync(`${dir}data`).filter((f) => f.endsWith('.json')).map((f) => [f.replace('.json', ''), JSON.parse(readFileSync(`${dir}data/${f}`, 'utf8'))]));
const lib = buildLibrary(raw, manifest);

/** Hasard reproductible. */
function seeded(seed = 1) {
  let a = seed;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const base = { weapon: 'sword', creature: null, anatomy: 'flesh', damageType: null, damage: 6, round: 2 };

test('les onze collections du manifeste sont présentes et complètes', () => {
  assert.equal(Object.keys(manifest.collections).length, 11);
  for (const [name, count] of Object.entries(manifest.collections)) {
    assert.ok(raw[name], `collection ${name} absente`);
    assert.equal(lib.counts[name], count, `collection ${name} : ${lib.counts[name]} entrées valides sur ${count}`);
  }
  assert.equal(lib.entries.length, manifest.totalEntries);
  assert.deepEqual(lib.invalid, []);
});

test('aucun identifiant ni texte exact dupliqué entre fichiers', () => {
  const all = Object.values(raw).flatMap((f) => f.entries);
  assert.equal(new Set(all.map((e) => e.id)).size, all.length);
  assert.equal(new Set(all.map((e) => e.text)).size, all.length);
});

test('aucune variable inconnue, et les entrées invalides sont signalées sans planter', () => {
  for (const e of lib.entries) assert.deepEqual((e.text.match(/\{(\w+)\}/g) || []).filter((p) => p !== '{attacker}' && p !== '{target}'), []);
  const bad = buildLibrary({ x: { entries: [{ id: 'A', result: 'hit', text: 'Bonjour {who}', tags: { weapons: ['any'], creatures: ['any'], anatomies: ['any'] } }, null, { id: 'B' }] } });
  assert.equal(bad.entries.length, 0);
  assert.equal(bad.invalid.length, 3);
  assert.match(invalidReason({ id: 'K', result: 'killing_blow', text: '{target}', tags: { weapons: ['any'], creatures: ['any'], anatomies: ['any'] } }), /isKillingBlow/);
  assert.doesNotThrow(() => buildLibrary({ vide: null, cassé: { entries: 'non' } }));
});

test('les types de dégâts anglais du texte sont francisés', () => {
  assert.ok(!lib.entries.some((e) => /sort de (fire|cold|lightning|necrotic|radiant|acid|psychic|sonic)\b/i.test(e.text)));
  assert.ok(lib.entries.some((e) => /sort de feu/.test(e.text)));
});

test('une phrase fatale n’apparaît jamais pour une cible survivante', () => {
  const rng = seeded(7);
  for (const result of ['hit', 'critical_hit', 'miss', 'critical_fail']) {
    for (let i = 0; i < 400; i++) {
      const n = selectNarration(lib, { ...base, result, crit: result === 'critical_hit', isKillingBlow: false }, { rng });
      assert.ok(!['killing_blow', 'legendary'].includes(n.result));
      const e = lib.entries.find((x) => x.id === n.id);
      if (e) assert.notEqual(e.conditions.isKillingBlow, true);
    }
  }
  // Le moteur ne classe « fatal » que si la cible tombe réellement.
  assert.equal(classify({ hit: true, crit: true, isKillingBlow: false }), 'critical_hit');
  assert.equal(classify({ hit: true, isKillingBlow: true }), 'killing_blow');
  assert.equal(classify({ hit: true, crit: true, isKillingBlow: true, targetIsBoss: true }), 'legendary');
  assert.equal(classify({ hit: true, crit: false, isKillingBlow: true, targetIsBoss: true }), 'killing_blow');
});

test('un sort ne sélectionne jamais une phrase d’arme physique, et inversement', () => {
  const rng = seeded(3);
  for (let i = 0; i < 500; i++) {
    const n = selectNarration(lib, { ...base, weapon: 'spell', damageType: 'fire', result: ['hit', 'miss', 'critical_hit'][i % 3] }, { rng });
    const e = lib.entries.find((x) => x.id === n.id);
    if (e) {
      assert.ok(e.tags.weapons.includes('spell') || (e.tags.weapons.includes('any') && (!e.implied.length || e.implied.includes('spell'))), n.id);
      assert.ok(!/\b(hache|épée|dague|marteau|flèche|arbalète)\s+de\s+\{attacker\}/i.test(e.text), n.id);
    }
  }
  for (let i = 0; i < 500; i++) {
    const n = selectNarration(lib, { ...base, weapon: 'axe', result: 'hit' }, { rng });
    const e = lib.entries.find((x) => x.id === n.id);
    if (e) assert.ok(!e.tags.weapons.includes('spell'), n.id);
  }
});

test('l’arme nommée dans le texte correspond à l’arme utilisée', () => {
  const rng = seeded(11);
  for (let i = 0; i < 800; i++) {
    const n = selectNarration(lib, { ...base, weapon: 'bow', creature: 'skeleton', anatomy: 'skeletal', result: i % 2 ? 'hit' : 'critical_hit', crit: !(i % 2) }, { rng });
    assert.ok(!/\b(la hache|l’épée|la dague|le marteau|la masse|la lance)\s+de\s+/i.test(n.text), `${n.id} : ${n.text}`);
  }
});

test('une créature « ooze » ne reçoit ni os ni sang', () => {
  const rng = seeded(5);
  for (const result of ['hit', 'critical_hit', 'killing_blow', 'miss', 'critical_fail']) {
    for (let i = 0; i < 400; i++) {
      const n = selectNarration(lib, { ...base, creature: 'ooze', anatomy: 'amorphous', result, crit: result === 'critical_hit', isKillingBlow: result === 'killing_blow', weapon: ['sword', 'mace', 'bow', 'spell'][i % 4], damageType: i % 4 === 3 ? 'acid' : null }, { rng });
      assert.ok(!/\b(sang|sanglant|saign|os|côtes?|crâne|squelette)\b/i.test(n.text), `${n.id} : ${n.text}`);
    }
  }
});

test('les conditions inconnues ou non vérifiées rendent l’entrée inéligible', () => {
  const e = { ...lib.entries.find((x) => x.collection === 'hit'), conditions: { phaseDeLune: 'pleine' } };
  assert.equal(eligible(e, { ...base, result: 'hit' }, 'hit'), false);
  const rain = lib.entries.find((x) => x.conditions.weather === 'rain');
  assert.equal(eligible(rain, { ...base, result: rain.result }, rain.result), false, 'météo inconnue = faux');
  assert.equal(eligible(rain, { ...base, result: rain.result, weather: 'rain' }, rain.result), true);
  const boss = lib.entries.find((x) => x.collection === 'context' && x.conditions.targetIsBoss);
  assert.equal(eligible(boss, { ...base, result: boss.result }, boss.result), false);
});

test('aucun dégât : pas de phrase d’impact, un repli neutre', () => {
  const n = selectNarration(lib, { ...base, result: 'hit', damage: 0 }, { rng: seeded(2) });
  assert.equal(n.fallback, true);
  assert.match(n.text, /sans effet|rien sentir/);
});

test('anti-répétition : aucune répétition tant qu’il reste des candidats, puis réintroduction progressive', () => {
  let h = emptyHistory();
  const rng = seeded(9);
  const seen = [];
  for (let i = 0; i < 20; i++) {
    const ctx = { ...base, result: 'hit', weapon: 'axe' };
    const n = selectNarration(lib, ctx, { rng, recent: recentIds(h, 'c1') });
    assert.ok(!seen.slice(-40).includes(n.id), `répétition de ${n.id}`);
    seen.push(n.id);
    h = remember(h, 'c1', n, { result: 'hit', attackerId: 'a', targetId: 't', round: 1 });
  }
  assert.ok(h.campaign.length <= 40 && h.combats.c1.ids.length <= 20);
  // Bassin minuscule : il faut réintroduire, sans exception.
  const tiny = { ...lib, entries: lib.entries.filter((x) => x.collection === 'legendary').slice(0, 2) };
  const ids = tiny.entries.map((x) => x.id);
  const n = selectNarration(tiny, { ...base, result: 'legendary', crit: true, isKillingBlow: true, targetIsBoss: true }, { rng, recent: ids });
  assert.equal(n.id, ids[0], 'le plus ancien revient d’abord');
  // Séries de coups.
  const f = streakFacts(h, 'c1', 'a', 't', 2);
  assert.equal(f.consecutiveHits, 20);
});

test('les noms : créature générique avec article, héros inchangé, texte brut', () => {
  assert.equal(displayName('Gobelin 2', 'goblin', 'Gobelin'), 'le gobelin 2');
  assert.equal(displayName('Orc', 'orc', 'Orc'), 'l’orc');
  assert.equal(displayName('Araignée géante', 'giant-spider', 'Araignée géante'), 'l’araignée géante');
  assert.equal(displayName('Vase grise', 'gray-ooze', 'Vase grise'), 'la vase grise');
  assert.equal(displayName('Thorin', undefined, undefined), 'Thorin');
  assert.equal(renderNarration('{attacker} frappe {target}.', { attacker: 'le gobelin', target: '<b>Thorin</b>' }), 'Le gobelin frappe <b>Thorin</b>.');
  assert.equal(renderNarration('{target}', { attacker: 'x', target: '{attacker}' }), 'Attacker');
  assert.equal(renderNarration('La défense de {target} cède ; il porte à {target} un coup.', { attacker: 'x', target: 'le gobelin' }), 'La défense du gobelin cède ; il porte au gobelin un coup.');
  assert.equal(renderNarration('{target} recule.', { attacker: 'x', target: 'le gobelin' }), 'Le gobelin recule.');
});

test('correspondances : armes, dégâts, créatures, anatomies', () => {
  assert.equal(weaponKindOf({ name: 'Hache à deux mains' }), 'axe');
  assert.equal(weaponKindOf({ name: 'Arc long' }), 'bow');
  assert.equal(weaponKindOf({ name: 'Arbalète légère' }), 'crossbow');
  assert.equal(weaponKindOf({ name: 'Cimeterre' }), 'sword');
  assert.equal(weaponKindOf({ name: 'Trait mystique' }), 'spell');
  assert.equal(weaponKindOf({ name: 'Morsure' }), null);
  assert.equal(damageTypeOf('de feu'), 'fire');
  assert.equal(damageTypeOf('thunder'), 'sonic');
  assert.equal(creatureOf('gelatinous-cube'), 'ooze');
  assert.equal(anatomyOf('skeleton'), 'skeletal');
  assert.equal(anatomyOf(undefined, 'Vase de taille G'), 'amorphous');
});

test('10 000 sélections sans exception, avec bonne répartition et repli', () => {
  const rng = seeded(42);
  const weapons = ['axe', 'sword', 'dagger', 'mace', 'hammer', 'spear', 'bow', 'crossbow', 'staff', 'unarmed', 'spell', null];
  const creatures = [[null, 'flesh'], ['skeleton', 'skeletal'], ['ooze', 'amorphous'], ['ghost', 'incorporeal'], ['goblin', 'flesh'], ['golem', 'stone'], ['giant_spider', 'arthropod']];
  const results = ['miss', 'hit', 'critical_fail', 'critical_hit', 'killing_blow', 'legendary'];
  const byId = new Map();
  let fallbacks = 0;
  let h = emptyHistory();
  for (let i = 0; i < 10000; i++) {
    const pickOf = (list) => list[Math.floor(rng() * list.length)];
    const result = pickOf(results);
    const [creature, anatomy] = pickOf(creatures);
    const weapon = pickOf(weapons);
    const ctx = { ...base, result, weapon, creature, anatomy, damageType: weapon === 'spell' ? ['fire', 'cold', 'acid', 'sonic'][i % 4] : null, crit: result === 'critical_hit' || result === 'legendary', isKillingBlow: result === 'killing_blow' || result === 'legendary', targetIsBoss: result === 'legendary', round: 1 + (i % 6) };
    const n = selectNarration(lib, ctx, { rng, recent: recentIds(h, 'big') });
    assert.ok(n && typeof n.text === 'string' && n.text.length > 10);
    assert.equal(n.result, result);
    if (n.fallback) fallbacks++;
    byId.set(n.id, (byId.get(n.id) || 0) + 1);
    h = remember(h, 'big', n, { result, attackerId: 'a', targetId: 't', round: ctx.round });
  }
  assert.ok(byId.size > 500, `variété : ${byId.size} narrations différentes`);
  // Les 12 légendaires se partagent tous les coups légendaires ; ailleurs, aucune phrase ne domine.
  const legend = [...byId.keys()].filter((id) => id.startsWith('LS-LEGENDARY'));
  assert.equal(legend.length, 12, 'toutes les narrations légendaires servent');
  const max = Math.max(...[...byId.entries()].filter(([id]) => !id.startsWith('fallback') && !id.startsWith('LS-LEGENDARY')).map(([, v]) => v));
  assert.ok(max < 120, `aucune narration ne domine (max ${max})`);
  assert.ok(fallbacks < 3500, `replis : ${fallbacks}`);
});
