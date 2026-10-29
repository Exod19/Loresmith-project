#!/usr/bin/env node
/**
 * Tests de bout en bout (lot 7), dans un vrai navigateur (Chromium, via Playwright).
 * Lance l'API (wrangler dev, base D1 temporaire) et le site (Vite), puis rejoue les parcours des lots :
 *   1. une ancienne sauvegarde (images en base64) est migrée sans perte ;
 *   2. un export .zip se réimporte dans un navigateur vierge, images comprises ;
 *   5. un compte synchronise deux navigateurs, et un conflit se règle dans l'interface ;
 *   6. une invitation est acceptée par un invité qui crée son compte sur place ;
 *   8. les avis et conditions sont exigés à la première connexion, et un compte se supprime depuis Réglages.
 * Usage : `npm run test:e2e` (Playwright et Chromium requis : `npm i -D playwright && npx playwright install chromium`).
 */
const { spawn, execFileSync } = require('node:child_process');
const { mkdtempSync, rmSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const { chromium } = require('playwright');

const ROOT = join(__dirname, '..');
const SITE = 'http://localhost:5173';
const API = 'http://localhost:8787';
const PASS = 'un-mot-de-passe-solide';
const children = [];

function start(cmd, args, cwd) {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, CI: '1' }, stdio: 'ignore', detached: true });
  children.push(child);
}
function stop() {
  for (const c of children) {
    try {
      process.kill(-c.pid);
    } catch {
      /* déjà arrêté */
    }
  }
}
async function waitFor(url, test = (r) => r.ok) {
  for (let i = 0; i < 90; i++) {
    try {
      if (test(await fetch(url))) return;
    } catch {
      /* pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${url} ne répond pas.`);
}

/* ——— Outils de navigateur ——— */

const errors = [];
async function browserPage(browser, name) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name} : ${e.message}`));
  page.on('dialog', (d) => d.accept());
  // Page vide de la même origine, pour préparer IndexedDB avant que l'application ne s'ouvre.
  await page.route(SITE + '/__seed', (r) => r.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }));
  return page;
}

/** Écrit une sauvegarde « d'avant le lot 1 » (IndexedDB v1, images en base64). */
async function seedLegacy(page, extra = {}) {
  await page.goto(SITE + '/__seed');
  await page.evaluate(async (extra) => {
    const draw = (color, w, h, type = 'image/png') => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      g.fillStyle = color;
      g.fillRect(0, 0, w, h);
      return c.toDataURL(type);
    };
    const token = draw('#3a3', 64, 64);
    const state = {
      activeUniverseId: 'u1',
      universes: { u1: { id: 'u1', name: 'Underdark', tone: 't', lore: 'l', createdAt: 1 } },
      characters: { c1: { id: 'c1', name: 'Aria', universeId: 'u1', level: 3 } },
      campaigns: { k1: { id: 'k1', title: 'La descente', universeId: 'u1', scenes: [] } },
      quests: {}, libraryEntries: {}, chatThreads: {}, log: [],
      npcs: { n1: { id: 'n1', name: 'Yemena', universeId: 'u1', entityType: 'npc', token } },
      assets: { a1: { id: 'a1', name: 'p', category: 'player', targetType: 'player', targetId: 'c1', dataUrl: draw('#a33', 300, 300), source: 'upload', universeId: 'u1', createdAt: 2 } },
      maps: { m1: { id: 'm1', universeId: 'u1', kind: 'custom', title: 'Carte', image: draw('#33a', 800, 500, 'image/jpeg'), width: 800, height: 500, createdAt: 1, updatedAt: 1 } },
      combat: { combatants: [], round: 1 },
      ...extra,
    };
    await new Promise((res, rej) => {
      const r = indexedDB.open('loresmith', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => {
        const t = r.result.transaction('kv', 'readwrite');
        t.objectStore('kv').put(state, 'store');
        t.oncomplete = () => {
          r.result.close();
          res();
        };
      };
      r.onerror = rej;
    });
  }, extra);
}

/** Lit le grimoire et les images enregistrés dans IndexedDB. */
const disk = (page) =>
  page.evaluate(async () => {
    const d = await new Promise((res) => {
      const r = indexedDB.open('loresmith');
      r.onsuccess = () => res(r.result);
    });
    const get = (store, key) => new Promise((res) => {
      const q = d.transaction(store).objectStore(store).get(key);
      q.onsuccess = () => res(q.result);
    });
    const keys = (store) => new Promise((res) => {
      const q = d.transaction(store).objectStore(store).getAllKeys();
      q.onsuccess = () => res(q.result);
    });
    const s = await get('kv', 'store');
    const json = JSON.stringify(s);
    const out = { state: s, base64: (json.match(/data:image/g) || []).length, refs: (json.match(/lsimg:/g) || []).length, images: d.objectStoreNames.contains('images') ? (await keys('images')).length : 0 };
    d.close();
    return out;
  });

const shownImages = (page) => page.evaluate(() => [...document.images].filter((i) => i.src.startsWith('blob:')).map((i) => i.complete && i.naturalWidth > 0));

async function openSettings(page) {
  await page.click('[aria-label="Réglages de l\'IA"]');
  await page.waitForSelector('text=Compte et synchronisation');
}
async function signUp(page, name, email) {
  await page.getByRole('button', { name: 'Créer un compte' }).click();
  await page.getByPlaceholder('Nom affiché').fill(name);
  await page.getByPlaceholder('Courriel').fill(email);
  await page.getByPlaceholder('Mot de passe (10 caractères minimum)').fill(PASS);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await acceptTerms(page);
}
/** Première connexion : la fenêtre des avis et conditions doit être acceptée. */
async function acceptTerms(page) {
  const gate = page.locator('.modal', { hasText: 'Avant de commencer' });
  await gate.waitFor({ timeout: 10000 });
  await gate.getByRole('checkbox').check();
  await gate.getByRole('button', { name: 'Accepter', exact: true }).click();
  await gate.waitFor({ state: 'detached' });
}
async function signIn(page, email) {
  await page.getByPlaceholder('Courriel').fill(email);
  await page.getByPlaceholder('Mot de passe (10 caractères minimum)').fill(PASS);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForSelector('text=Connecté :');
}
const badge = (page) => page.locator('button[title="Compte et synchronisation"]').innerText().catch(() => '');

function check(cond, message) {
  if (!cond) throw new Error(message);
}

/* ——— Parcours ——— */

const SCENARIOS = {
  async 'Lot 1 : une ancienne sauvegarde est migrée sans perte'(browser) {
    const page = await browserPage(browser, 'lot 1');
    await seedLegacy(page);
    await page.goto(SITE + '/?view=party');
    await page.waitForTimeout(3000);
    const d = await disk(page);
    check(d.base64 === 0, `il reste ${d.base64} image(s) en base64`);
    check(d.refs >= 3 && d.images === 3, `références ${d.refs}, images ${d.images}`);
    check(d.state.npcs.n1.name === 'Yemena' && d.state.characters.c1.name === 'Aria', 'données perdues');
    const shown = await shownImages(page);
    check(shown.length > 0 && shown.every(Boolean), 'portrait non affiché');
  },

  async 'Lot 2 : export .zip réimporté dans un navigateur vierge'(browser) {
    const a = await browserPage(browser, 'lot 2 A');
    await seedLegacy(a);
    await a.goto(SITE + '/?view=party');
    await a.waitForTimeout(3000);
    await a.click('[aria-label="Exporter une sauvegarde"]');
    const [download] = await Promise.all([a.waitForEvent('download'), a.getByRole('button', { name: '⤓ Exporter' }).click()]);
    const zip = await download.path();
    check(readFileSync(zip).subarray(0, 2).toString() === 'PK', 'le fichier n’est pas un .zip');
    const b = await browserPage(browser, 'lot 2 B');
    await b.goto(SITE + '/?view=party');
    await b.waitForTimeout(2500);
    await b.setInputFiles('input[accept*="zip"]', zip);
    await b.getByRole('button', { name: /Remplacer tout le grimoire/ }).click();
    await b.waitForTimeout(2000);
    await b.reload();
    await b.waitForTimeout(2500);
    const d = await disk(b);
    check(Object.values(d.state.universes).map((u) => u.name).join() === 'Underdark', 'univers non restauré');
    check(d.state.npcs.n1?.name === 'Yemena' && d.images === 3, `données ou images manquantes (images : ${d.images})`);
    const shown = await shownImages(b);
    check(shown.length > 0 && shown.every(Boolean), 'portrait non affiché après import');
  },

  async 'Lot 5 : synchronisation entre deux navigateurs et conflit réglé'(browser) {
    const email = `mj-${randomUUID().slice(0, 8)}@exemple.org`;
    const a = await browserPage(browser, 'lot 5 A');
    await seedLegacy(a);
    await a.goto(SITE + '/?view=bestiary');
    await a.waitForTimeout(2500);
    await openSettings(a);
    await signUp(a, 'MJ', email);
    await a.waitForSelector('text=Connecté :');
    await a.waitForTimeout(3000);
    check((await badge(a)) === 'Synchronisé', `badge A : ${await badge(a)}`);

    const b = await browserPage(browser, 'lot 5 B');
    await b.goto(SITE + '/?view=bestiary');
    await b.waitForTimeout(2500);
    await openSettings(b);
    await signIn(b, email);
    await b.waitForTimeout(3500);
    const got = await disk(b);
    check(got.state.npcs.n1?.name === 'Yemena' && got.state.campaigns.k1?.title === 'La descente', 'le second navigateur n’a pas tout reçu');

    const rename = (page, name) =>
      page.evaluate(async (name) => {
        const d = await new Promise((res) => {
          const r = indexedDB.open('loresmith');
          r.onsuccess = () => res(r.result);
        });
        const s = await new Promise((res) => {
          const q = d.transaction('kv').objectStore('kv').get('store');
          q.onsuccess = () => res(q.result);
        });
        s.npcs.n1.name = name;
        await new Promise((res) => {
          const t = d.transaction('kv', 'readwrite');
          t.objectStore('kv').put(s, 'store');
          t.oncomplete = res;
        });
        d.close();
      }, name);
    await rename(a, 'Yemena (A)');
    await rename(b, 'Yemena (B)');
    await a.reload();
    await a.waitForTimeout(3500);
    await b.reload();
    await b.waitForSelector('text=Versions différentes à départager', { timeout: 15000 });
    await b.getByRole('button', { name: 'Garder ma version' }).click();
    await b.waitForTimeout(1500);
    check((await badge(b)) === 'Synchronisé', `badge B après choix : ${await badge(b)}`);
    await openSettings(a);
    await a.getByRole('button', { name: 'Synchroniser maintenant' }).click();
    await a.waitForTimeout(3000);
    check((await disk(a)).state.npcs.n1.name === 'Yemena (B)', 'le choix de B n’est pas arrivé chez A');
  },

  async 'Lot 8 : avis à accepter, puis suppression du compte'(browser) {
    const email = `zoe-${randomUUID().slice(0, 8)}@exemple.org`;
    const page = await browserPage(browser, 'lot 8');
    await seedLegacy(page);
    await page.goto(SITE + '/?view=bestiary');
    await page.waitForTimeout(2500);
    await openSettings(page);
    await page.getByRole('button', { name: 'Créer un compte' }).click();
    await page.getByPlaceholder('Nom affiché').fill('Zoé');
    await page.getByPlaceholder('Courriel').fill(email);
    await page.getByPlaceholder('Mot de passe (10 caractères minimum)').fill(PASS);
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    const gate = page.locator('.modal', { hasText: 'Avant de commencer' });
    await gate.waitFor();
    check(await gate.getByRole('button', { name: 'Accepter', exact: true }).isDisabled(), 'on peut accepter sans cocher');
    await page.waitForTimeout(1500);
    check((await badge(page)) === 'Conditions à accepter', `badge avant acceptation : ${await badge(page)}`);
    await gate.getByRole('checkbox').check();
    await gate.getByRole('button', { name: 'Accepter', exact: true }).click();
    await page.waitForTimeout(3000);
    check((await badge(page)) === 'Synchronisé', `badge après acceptation : ${await badge(page)}`);
    await page.getByRole('button', { name: 'Supprimer mon compte…' }).click();
    await page.getByPlaceholder(`Retape ${email}`).fill(email);
    await page.getByRole('button', { name: 'Supprimer définitivement' }).click();
    await page.waitForTimeout(2000);
    const panel = await page.locator('text=Compte et synchronisation').locator('..').innerText().catch(() => '');
    check(!(await page.locator('text=Connecté :').isVisible()), `toujours connecté après suppression : ${panel.replace(/\n+/g, ' | ').slice(0, 300)}`);
    const d = await disk(page);
    // Les identifiants ont pu être renommés (déjà pris par un autre compte du test) : on cherche par le nom.
    check(Object.values(d.state.npcs).some((n) => n.name === 'Yemena'), 'le grimoire local a disparu');
    const res = await fetch(API + '/api/auth/sign-in/email', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: SITE }, body: JSON.stringify({ email, password: PASS }) });
    check(res.status !== 200, 'le compte supprimé permet encore de se connecter');
  },

  async 'Lot 6 : invitation acceptée par un invité qui crée son compte'(browser) {
    const tag = randomUUID().slice(0, 8);
    const a = await browserPage(browser, 'lot 6 A');
    await seedLegacy(a, { universes: { u6: { id: 'u6', name: 'Univers partagé', tone: 't', lore: 'l', createdAt: 1 } }, activeUniverseId: 'u6', npcs: { n6: { id: 'n6', name: 'Garde', universeId: 'u6' } }, characters: {}, campaigns: {}, assets: {}, maps: {} });
    await a.goto(SITE + '/');
    await a.waitForTimeout(2500);
    await openSettings(a);
    await signUp(a, 'Alice', `alice-${tag}@exemple.org`);
    await a.waitForSelector('text=Connecté :');
    await a.waitForTimeout(3000);
    await a.getByRole('button', { name: 'Partager « Univers partagé »' }).click();
    await a.getByPlaceholder('Courriel du MJ invité').fill(`bob-${tag}@exemple.org`);
    await a.getByRole('button', { name: 'Inviter', exact: true }).click();
    await a.waitForSelector('input[readonly]');
    const link = await a.locator('input[readonly]').inputValue();

    const b = await browserPage(browser, 'lot 6 B');
    await b.goto(link);
    await b.waitForSelector('text=t’invite dans l’univers');
    await signUp(b, 'Bob', `bob-${tag}@exemple.org`);
    await b.getByRole('button', { name: 'Accepter et rejoindre' }).click();
    await b.waitForTimeout(4500);
    const d = await disk(b);
    check(d.state.universes[d.state.activeUniverseId]?.name === 'Univers partagé', 'l’univers rejoint n’est pas ouvert');
    check(d.state.npcs.n6?.name === 'Garde', 'le contenu de l’univers n’est pas arrivé');
  },
};

(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'loresmith-e2e-'));
  let failed = 0;
  let browser;
  try {
    execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', dir], { cwd: join(ROOT, 'server'), env: { ...process.env, CI: '1' }, stdio: 'ignore' });
    const secret = randomUUID() + randomUUID();
    start('npx', ['wrangler', 'dev', '--port', '8787', '--persist-to', dir, '--var', `BETTER_AUTH_SECRET:${secret}`, '--var', 'LOG_LEVEL:error'], join(ROOT, 'server'));
    start('npx', ['vite', '--port', '5173', '--strictPort'], ROOT);
    await waitFor(API + '/api/health');
    await waitFor(SITE);
    browser = await chromium.launch();
    for (const [name, run] of Object.entries(SCENARIOS)) {
      try {
        await run(browser);
        console.log(`✓ ${name}`);
      } catch (e) {
        failed++;
        console.log(`✗ ${name}\n    ${e.message.split('\n')[0]}`);
      }
    }
    if (errors.length) {
      failed++;
      console.log(`✗ Erreurs JavaScript dans les pages :\n    ${errors.join('\n    ')}`);
    }
  } finally {
    await browser?.close();
    stop();
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(failed ? `\n${failed} échec(s).` : '\nTous les parcours passent.');
  process.exit(failed ? 1 : 0);
})();
