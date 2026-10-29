/**
 * API de Loresmith (Worker Cloudflare). Routes de base du lot 4 : santé, comptes, profil, univers, campagnes ;
 * synchronisation et images au lot 5 (`sync.js`) ; partage au lot 6 (`sharing.js`) ;
 * journalisation et sauvegarde quotidienne de la base au lot 7 (`log.js`, `backup.js`) ;
 * conditions d'utilisation, export et suppression du compte au lot 8 (`account.js`).
 * Toutes les décisions d'accès passent par `src/shared/policy.js` ; le navigateur n'est jamais cru sur parole.
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { can } from '../../src/shared/policy.js';
import { authFor, originsOf } from './auth.js';
import { HttpError, createDoc, getDoc, listDocs, updateDoc } from './documents.js';
import { mountSync } from './sync.js';
import { mountPublicInvitations, mountSharing } from './sharing.js';
import { log } from './log.js';
import { backupNow } from './backup.js';
import { mountAccount, termsAccepted, termsGuard } from './account.js';

const app = new Hono();

// Une ligne de journal par requête : route (modèle, sans identifiant ni jeton), statut, durée, compte.
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  log(c.env, c.res.status >= 500 ? 'error' : 'info', 'requête', { method: c.req.method, route: c.req.routePath, status: c.res.status, ms: Date.now() - start, user: c.get('user')?.id ?? null });
});

app.use('/api/*', async (c, next) => {
  return cors({ origin: originsOf(c.env), credentials: true, allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowHeaders: ['Content-Type'] })(c, next);
});

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message, ...err.extra }, err.status);
  log(c.env, 'error', 'erreur', { method: c.req.method, route: c.req.routePath, message: err?.message, stack: err?.stack?.split('\n').slice(0, 6).join(' | ') });
  return c.json({ error: 'Erreur interne.' }, 500);
});

app.get('/api/health', (c) => c.json({ ok: true, service: 'loresmith-api' }));

app.on(['GET', 'POST'], '/api/auth/*', (c) => authFor(c.env).handler(c.req.raw));

// Aperçu d'une invitation, lisible avant de se connecter (lot 6).
mountPublicInvitations(app);

/** Session obligatoire pour tout le reste : sans elle, 401. Les rôles du compte sont chargés une fois. */
app.use('/api/*', async (c, next) => {
  const session = await authFor(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return c.json({ error: 'Connexion requise.' }, 401);
  const db = c.env.DB;
  const [u, k] = await db.batch([
    db.prepare('select universe_id, role from universe_members where user_id = ?').bind(session.user.id),
    db.prepare('select campaign_id, role from campaign_members where user_id = ?').bind(session.user.id),
  ]);
  c.set('user', session.user);
  c.set('termsAccepted', await termsAccepted(db, session.user.id));
  c.set('actor', {
    id: session.user.id,
    universes: Object.fromEntries(u.results.map((r) => [r.universe_id, r.role])),
    campaigns: Object.fromEntries(k.results.map((r) => [r.campaign_id, r.role])),
  });
  await next();
});

/** Refuse si la politique ne permet pas l'action (403 ; 404 si l'élément ne doit même pas être visible). */
function guard(c, action, resource, hidden = false) {
  if (!can(c.get('actor'), action, resource)) throw new HttpError(hidden ? 404 : 403, hidden ? 'Introuvable.' : 'Action refusée.');
}

async function body(c) {
  try {
    return await c.req.json();
  } catch {
    throw new HttpError(400, 'Corps de requête JSON attendu.');
  }
}

const resourceOf = (doc) => ({ type: doc.type, id: doc.id, universeId: doc.universeId, campaignId: doc.campaignId, createdBy: doc.createdBy, ownerId: doc.ownerId });
const out = (doc, actor) => ({ id: doc.id, version: doc.version, updatedAt: doc.updatedAt, data: doc.data, role: actor.universes[doc.universeId] ?? null, campaignRole: doc.campaignId ? actor.campaigns[doc.campaignId] ?? null : null });

/* ——— Compte : conditions d'utilisation, export, suppression (lot 8) ——— */

app.use('/api/*', termsGuard());
mountAccount(app);

/* ——— Univers ——— */

app.get('/api/universes', async (c) => {
  const actor = c.get('actor');
  const ids = Object.keys(actor.universes);
  if (!ids.length) return c.json({ universes: [] });
  const docs = await listDocs(c.env.DB, 'universe', `id in (${ids.map(() => '?').join(',')})`, ids);
  return c.json({ universes: docs.map((d) => out(d, actor)) });
});

app.post('/api/universes', async (c) => {
  const actor = c.get('actor');
  guard(c, 'create', { type: 'universe' });
  const { id = crypto.randomUUID(), data } = await body(c);
  const db = c.env.DB;
  const doc = await createDoc(db, { type: 'universe', id, universeId: id, userId: actor.id, data: { ...data, id } }, [
    db.prepare('insert into universe_members (universe_id, user_id, role, created_at) values (?, ?, ?, ?)').bind(id, actor.id, 'owner', Date.now()),
  ]);
  actor.universes[id] = 'owner';
  return c.json(out(doc, actor), 201);
});

async function loadUniverse(c, action) {
  const doc = await getDoc(c.env.DB, 'universe', c.req.param('id'));
  if (!doc) throw new HttpError(404, 'Introuvable.');
  guard(c, 'read', resourceOf(doc), true);
  if (action !== 'read') guard(c, action, resourceOf(doc));
  return doc;
}

app.get('/api/universes/:id', async (c) => c.json(out(await loadUniverse(c, 'read'), c.get('actor'))));

app.put('/api/universes/:id', async (c) => {
  const doc = await loadUniverse(c, 'update');
  const { version, data } = await body(c);
  const next = await updateDoc(c.env.DB, doc, { version, data: { ...data, id: doc.id }, userId: c.get('actor').id });
  return c.json(out(next, c.get('actor')));
});

/* ——— Campagnes ——— */

app.get('/api/universes/:id/campaigns', async (c) => {
  const universe = await loadUniverse(c, 'read');
  const actor = c.get('actor');
  const docs = await listDocs(c.env.DB, 'campaign', 'universe_id = ?', [universe.id]);
  return c.json({ campaigns: docs.filter((d) => can(actor, 'read', resourceOf(d))).map((d) => out(d, actor)) });
});

app.post('/api/universes/:id/campaigns', async (c) => {
  const universe = await loadUniverse(c, 'read');
  const actor = c.get('actor');
  guard(c, 'create', { type: 'campaign', universeId: universe.id });
  const { id = crypto.randomUUID(), data } = await body(c);
  const db = c.env.DB;
  const doc = await createDoc(db, { type: 'campaign', id, universeId: universe.id, campaignId: id, userId: actor.id, data: { ...data, id, universeId: universe.id } }, [
    db.prepare('insert into campaign_members (campaign_id, user_id, role, created_at) values (?, ?, ?, ?)').bind(id, actor.id, 'gm', Date.now()),
  ]);
  actor.campaigns[id] = 'gm';
  return c.json(out(doc, actor), 201);
});

async function loadCampaign(c, action) {
  const doc = await getDoc(c.env.DB, 'campaign', c.req.param('id'));
  if (!doc) throw new HttpError(404, 'Introuvable.');
  guard(c, 'read', resourceOf(doc), true);
  if (action !== 'read') guard(c, action, resourceOf(doc));
  return doc;
}

app.get('/api/campaigns/:id', async (c) => c.json(out(await loadCampaign(c, 'read'), c.get('actor'))));

app.put('/api/campaigns/:id', async (c) => {
  const doc = await loadCampaign(c, 'update');
  const { version, data } = await body(c);
  const next = await updateDoc(c.env.DB, doc, { version, data: { ...data, id: doc.id, universeId: doc.universeId }, userId: c.get('actor').id });
  return c.json(out(next, c.get('actor')));
});

/* ——— Synchronisation et images (lot 5) ——— */

mountSync(app);

/* ——— Partage : invitations, membres, co-MJ (lot 6) ——— */

mountSharing(app);

app.notFound((c) => c.json({ error: 'Route inconnue.' }, 404));

/** Tâche planifiée (cron) : sauvegarde quotidienne de la base (stockage KV). */
async function scheduled(event, env, ctx) {
  ctx.waitUntil(
    backupNow(env).then(
      (r) => log(env, 'info', 'sauvegarde', r),
      (err) => log(env, 'error', 'sauvegarde échouée', { message: err?.message }),
    ),
  );
}

export default { fetch: (request, env, ctx) => app.fetch(request, env, ctx), scheduled };
