/**
 * Synchronisation (lot 5) : routes génériques par document et images partagées.
 *
 * - `GET /api/sync?since=<ms>` : tous les documents lisibles modifiés depuis `since`, suppressions comprises.
 *   Le curseur à renvoyer la fois suivante est `serverTime` (horloge du serveur, pas du navigateur).
 * - `PUT /api/docs/:type/:id` : crée (version 0) ou met à jour (version lue) un document. 409 si elle a changé.
 * - `DELETE /api/docs/:type/:id?version=N` : marque le document supprimé (rien n'est effacé).
 * - `PUT|GET /api/images/:universeId/:id` : images dans R2, identifiées par l'empreinte de leur contenu.
 *
 * La portée d'un document existant (univers, campagne, titulaire) est celle enregistrée sur le serveur :
 * un client ne peut pas déplacer un document vers un univers où il n'a pas de droits.
 */
import { can } from '../../src/shared/policy.js';
import { DOC_TYPES } from '../../src/shared/schema.js';
import { HttpError, ID_PATTERN, createDoc, getDocAny, updateDoc } from './documents.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const resourceOf = (doc) => ({ type: doc.type, id: doc.id, universeId: doc.universeId, campaignId: doc.campaignId, createdBy: doc.createdBy, ownerId: doc.ownerId });
const wire = (doc) => ({ type: doc.type, id: doc.id, universeId: doc.universeId, campaignId: doc.campaignId, version: doc.version, updatedAt: doc.updatedAt, deleted: doc.deleted, data: doc.deleted ? null : doc.data });

function guard(actor, action, resource, hidden = false) {
  if (!can(actor, action, resource)) throw new HttpError(hidden ? 404 : 403, hidden ? 'Introuvable.' : 'Action refusée.');
}

async function json(c) {
  try {
    return await c.req.json();
  } catch {
    throw new HttpError(400, 'Corps de requête JSON attendu.');
  }
}

function checkType(type) {
  if (!DOC_TYPES[type]) throw new HttpError(400, 'Type de document inconnu.');
}

/** Portée d'un nouveau document, vérifiée : l'univers (et la campagne) doivent exister. */
async function scopeForCreate(db, actor, type, id, body) {
  if (type === 'userState') {
    if (id !== actor.id) throw new HttpError(403, 'Action refusée.');
    return { universeId: null, campaignId: null, ownerId: actor.id };
  }
  if (type === 'universe') return { universeId: id, campaignId: null, ownerId: null };
  const universeId = body.universeId;
  if (!universeId || !(await getDocAny(db, 'universe', universeId))) throw new HttpError(400, 'Univers inconnu.');
  let campaignId = type === 'campaign' ? id : body.campaignId || null;
  if (campaignId && type !== 'campaign') {
    const camp = await getDocAny(db, 'campaign', campaignId);
    if (!camp || camp.universeId !== universeId) throw new HttpError(400, 'Campagne inconnue.');
  }
  return { universeId, campaignId, ownerId: null };
}

export function mountSync(app) {
  app.get('/api/sync', async (c) => {
    const actor = c.get('actor');
    const since = Number(c.req.query('since')) || 0;
    const serverTime = Date.now();
    const universes = Object.keys(actor.universes);
    const campaigns = Object.keys(actor.campaigns);
    const clauses = ['(type = ? and owner_id = ?)'];
    const binds = ['userState', actor.id];
    if (universes.length) {
      clauses.push(`universe_id in (${universes.map(() => '?').join(',')})`);
      binds.push(...universes);
    }
    if (campaigns.length) {
      clauses.push(`campaign_id in (${campaigns.map(() => '?').join(',')})`);
      binds.push(...campaigns);
    }
    // `>=` : une écriture faite dans la même milliseconde que le curseur précédent n'est pas perdue (le client ignore les doublons).
    const { results } = await c.env.DB.prepare(`select * from documents where updated_at >= ? and (${clauses.join(' or ')}) order by updated_at`).bind(since, ...binds).all();
    const docs = results
      .map((r) => ({ type: r.type, id: r.id, universeId: r.universe_id, campaignId: r.campaign_id, ownerId: r.owner_id, createdBy: r.created_by, version: r.version, updatedAt: r.updated_at, deleted: r.deleted_at !== null, data: JSON.parse(r.data) }))
      .filter((d) => can(actor, 'read', resourceOf(d)))
      .map(wire);
    return c.json({ serverTime, docs, universes: actor.universes, campaigns: actor.campaigns });
  });

  app.put('/api/docs/:type/:id', async (c) => {
    const actor = c.get('actor');
    const { type, id } = c.req.param();
    checkType(type);
    if (!ID_PATTERN.test(id)) throw new HttpError(400, 'Identifiant invalide.');
    const body = await json(c);
    const db = c.env.DB;
    const current = await getDocAny(db, type, id);
    if (!current) {
      if (body.version) throw new HttpError(409, 'Ce document n’existe plus sur le serveur.', { current: null });
      const scope = await scopeForCreate(db, actor, type, id, body);
      guard(actor, 'create', { type, id, ...scope });
      const members = [];
      if (type === 'universe') members.push(db.prepare('insert into universe_members (universe_id, user_id, role, created_at) values (?, ?, ?, ?)').bind(id, actor.id, 'owner', Date.now()));
      if (type === 'campaign') members.push(db.prepare('insert into campaign_members (campaign_id, user_id, role, created_at) values (?, ?, ?, ?)').bind(id, actor.id, 'gm', Date.now()));
      const doc = await createDoc(db, { type, id, ...scope, userId: actor.id, data: body.data }, members);
      if (type === 'universe') actor.universes[id] = 'owner';
      if (type === 'campaign') actor.campaigns[id] = 'gm';
      return c.json(wire(doc), 201);
    }
    guard(actor, 'read', resourceOf(current), true);
    guard(actor, 'update', resourceOf(current));
    return c.json(wire(await updateDoc(db, current, { version: body.version, data: body.data, userId: actor.id })));
  });

  app.delete('/api/docs/:type/:id', async (c) => {
    const actor = c.get('actor');
    const { type, id } = c.req.param();
    checkType(type);
    const current = await getDocAny(c.env.DB, type, id);
    if (!current) throw new HttpError(404, 'Introuvable.');
    guard(actor, 'read', resourceOf(current), true);
    guard(actor, 'delete', resourceOf(current));
    if (current.deleted) return c.json(wire(current));
    return c.json(wire(await updateDoc(c.env.DB, current, { version: Number(c.req.query('version')), userId: actor.id, deleted: true })));
  });

  app.put('/api/images/:universeId/:id', async (c) => {
    const actor = c.get('actor');
    const { universeId, id } = c.req.param();
    if (!/^[0-9a-f]{32}$/.test(id) || !ID_PATTERN.test(universeId)) throw new HttpError(400, 'Identifiant invalide.');
    guard(actor, 'read', { type: 'universe', id: universeId }, true);
    guard(actor, 'create', { type: 'asset', universeId });
    const bytes = await c.req.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) throw new HttpError(413, 'Image vide ou trop lourde.');
    // L'identifiant est l'empreinte du contenu : une image ne peut pas se faire passer pour une autre.
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const expected = Array.from(digest.subarray(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
    if (expected !== id) throw new HttpError(400, 'Le contenu ne correspond pas à l’identifiant.');
    const type = (c.req.header('Content-Type') || 'application/octet-stream').split(';')[0];
    if (!type.startsWith('image/')) throw new HttpError(415, 'Seules les images sont acceptées.');
    const key = `${universeId}/${id}`;
    await c.env.IMAGES.put(key, bytes, { httpMetadata: { contentType: type } });
    await c.env.DB.prepare('insert or ignore into images (universe_id, id, r2_key, type, size, created_by, created_at) values (?, ?, ?, ?, ?, ?, ?)')
      .bind(universeId, id, key, type, bytes.byteLength, actor.id, Date.now()).run();
    return c.json({ id, universeId }, 201);
  });

  app.get('/api/images/:universeId/:id', async (c) => {
    const actor = c.get('actor');
    const { universeId, id } = c.req.param();
    guard(actor, 'read', { type: 'asset', universeId }, true);
    const found = await c.env.DB.prepare('select r2_key, type from images where universe_id = ? and id = ?').bind(universeId, id).first();
    const obj = found && (await c.env.IMAGES.get(found.r2_key));
    if (!obj) throw new HttpError(404, 'Introuvable.');
    return new Response(obj.body, { headers: { 'Content-Type': found.type, 'Cache-Control': 'private, max-age=31536000, immutable' } });
  });
}
