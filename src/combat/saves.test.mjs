import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const load = async (file) => {
  const r = await build({ entryPoints: [new URL(file, import.meta.url).pathname], bundle: true, format: 'esm', write: false, platform: 'node' });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
};
const { classSaves, heroSaves, heroSavesText } = await load('./saves.ts');
const { saveBonus } = await load('../maps/battle/aoe.ts');

test('maîtrises de sauvegarde par classe (français et anglais)', () => {
  assert.deepEqual(classSaves('Roublard'), ['dex', 'int']);
  assert.deepEqual(classSaves('Sorcier'), ['sag', 'cha']);
  assert.deepEqual(classSaves('Ensorceleur'), ['con', 'cha']);
  assert.deepEqual(classSaves('Wizard'), ['int', 'sag']);
  assert.deepEqual(classSaves('Barde'), ['dex', 'cha']);
  assert.deepEqual(classSaves('Barbare'), ['for', 'con']);
});

test('bonus de sauvegarde du héros lu par la zone d’effet', () => {
  const h = { cls: 'Guerrier', level: 5, str: 16, dex: 12, con: 14 };
  assert.equal(heroSavesText(h), 'For +6, Con +5');
  assert.deepEqual(saveBonus('for', { saves: heroSavesText(h), score: 16 }), { bonus: 6, proficient: true });
  assert.deepEqual(saveBonus('dex', { saves: heroSavesText(h), score: 12 }), { bonus: 1, proficient: false });
  // Maîtrises corrigées à la main sur la fiche.
  assert.equal(heroSaves({ ...h, saveProfs: ['dex'] }).find((s) => s.id === 'dex').bonus, 4);
});
