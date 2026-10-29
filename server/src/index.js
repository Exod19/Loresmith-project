/**
 * API de Loresmith (Worker Cloudflare). Routes de base du lot 4 : santé, comptes, profil, univers, campagnes ;
 * synchronisation et images au lot 5 (`sync.js`).
 * Toutes les décisions d'accès passent par `src/shared/policy.js` ; le navigateur n'est jamais cru sur parole.
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { can } from '../../src/shared/policy.js';
import { authFor } from './auth.js';
import { HttpError, createDoc, getDoc, listDocs, updateDoc } from './documents.js';
import { mountSync } from './sync.js';

const app = new Hono();

app.use('/api/*', async (c, next) => {
  const origin = c.env.FRONT_ORIGIN;
  return cors({ origin: origin ? [origin] : [], credentials: true, allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowHeaders: ['Content-Type'] })(c, next);
});

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message, ...err.extra }, err.status);
  console.error(err);
  return c.json({ error: 'Erreur interne.' }, 500);
});

app.get('/api/health', (c) => c.json({ ok: true, service: 'loresmith-api' }));

app.on(['GET', 'POST'], '/api/auth/*', (c) => authFor(c.env).handler(c.req.raw));

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

app.get('/api/me', (c) => {
  const { id, email, name } = c.get('user');
  const actor = c.get('actor');
  return c.json({ user: { id, email, name }, universes: actor.universes, campaigns: actor.campaigns });
});

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

app.notFound((c) => c.json({ error: 'Route inconnue.' }, 404));

export default app;
