/**
 * Partage (lot 6) : invitations par courriel, membres d'un univers et co-MJ d'une campagne.
 *
 * - Une invitation vaut 7 jours. Le lien porte un jeton aléatoire ; le serveur n'en garde que l'empreinte.
 * - Elle s'accepte avec un compte dont le courriel est celui invité (un lien transféré ne sert à personne d'autre).
 * - Les rôles sont relus à chaque requête : un rôle retiré ou changé prend effet immédiatement.
 */
import { can } from '../../src/shared/policy.js';
import { HttpError, getDoc } from './documents.js';
import { sendMail } from './mail.js';

export const INVITATION_DAYS = 7;
const INVITABLE = ['editor', 'contributor', 'reader'];
const ROLE_LABEL = { owner: 'propriétaire', editor: 'éditeur', contributor: 'contributeur', reader: 'lecteur' };

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function sha256(text) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}
const normEmail = (e) => String(e || '').trim().toLowerCase();

async function body(c) {
  try {
    return await c.req.json();
  } catch {
    throw new HttpError(400, 'Corps de requête JSON attendu.');
  }
}

/** Univers visible par le compte, et vérification de l'action demandée. */
async function universeFor(c, action) {
  const actor = c.get('actor');
  const doc = await getDoc(c.env.DB, 'universe', c.req.param('id'));
  if (!doc || !can(actor, 'read', { type: 'universe', id: doc.id })) throw new HttpError(404, 'Introuvable.');
  if (action !== 'read' && !can(actor, action, { type: 'universe', id: doc.id })) throw new HttpError(403, 'Action refusée.');
  return doc;
}

async function invitationByToken(db, token) {
  if (!token || token.length < 20) throw new HttpError(404, 'Invitation introuvable.');
  const inv = await db.prepare('select * from invitations where token_hash = ?').bind(await sha256(token)).first();
  if (!inv) throw new HttpError(404, 'Invitation introuvable.');
  return inv;
}

function invitationState(inv) {
  if (inv.revoked_at) return 'revoked';
  if (inv.accepted_at) return 'accepted';
  if (inv.expires_at < Date.now()) return 'expired';
  return 'pending';
}

/** Route publique : ce qu'on montre avant de se connecter (univers, rôle, qui invite). */
export function mountPublicInvitations(app) {
  app.get('/api/invitations/:token', async (c) => {
    const db = c.env.DB;
    const inv = await invitationByToken(db, c.req.param('token'));
    const universe = await getDoc(db, 'universe', inv.universe_id);
    const from = await db.prepare('select name from "user" where id = ?').bind(inv.invited_by).first();
    return c.json({ universe: universe?.data?.name ?? 'Univers', role: inv.role, email: inv.email, from: from?.name ?? '', state: universe ? invitationState(inv) : 'revoked', expiresAt: inv.expires_at });
  });
}

export function mountSharing(app) {
  /* ——— Membres d'un univers ——— */

  app.get('/api/universes/:id/members', async (c) => {
    const universe = await universeFor(c, 'read');
    const db = c.env.DB;
    const { results: members } = await db
      .prepare('select m.user_id as id, m.role, u.name, u.email from universe_members m join "user" u on u.id = m.user_id where m.universe_id = ? order by m.created_at')
      .bind(universe.id)
      .all();
    // Les invitations en attente ne sont montrées qu'à qui peut partager.
    let invitations = [];
    if (can(c.get('actor'), 'share', { type: 'universe', id: universe.id })) {
      const { results } = await db.prepare('select id, email, role, created_at, expires_at from invitations where universe_id = ? and accepted_at is null and revoked_at is null and expires_at > ? order by created_at desc').bind(universe.id, Date.now()).all();
      invitations = results.map((r) => ({ id: r.id, email: r.email, role: r.role, createdAt: r.created_at, expiresAt: r.expires_at }));
    }
    return c.json({ members, invitations });
  });

  app.post('/api/universes/:id/invitations', async (c) => {
    const universe = await universeFor(c, 'share');
    const { email, role } = await body(c);
    const to = normEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new HttpError(400, 'Courriel invalide.');
    if (!INVITABLE.includes(role)) throw new HttpError(400, 'Rôle invalide.');
    const db = c.env.DB;
    const already = await db.prepare('select 1 from universe_members m join "user" u on u.id = m.user_id where m.universe_id = ? and lower(u.email) = ?').bind(universe.id, to).first();
    if (already) throw new HttpError(409, 'Cette personne est déjà membre de l’univers.');
    const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const now = Date.now();
    const id = crypto.randomUUID();
    const expiresAt = now + INVITATION_DAYS * 86400000;
    await db.prepare('insert into invitations (id, token_hash, universe_id, email, role, invited_by, created_at, expires_at) values (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, await sha256(token), universe.id, to, role, c.get('actor').id, now, expiresAt).run();
    const link = `${(c.env.APP_URL || c.env.FRONT_ORIGIN || '').replace(/\/$/, '')}/?invitation=${token}`;
    const from = c.get('user').name || c.get('user').email;
    const emailSent = await sendMail(c.env, {
      to,
      subject: `${from} t’invite dans l’univers « ${universe.data.name} » sur Loresmith`,
      text: `${from} t’invite à rejoindre l’univers « ${universe.data.name} » sur Loresmith, comme ${ROLE_LABEL[role]}.\n\nPour accepter (lien valable ${INVITATION_DAYS} jours) :\n${link}\n\nSi tu n’as pas encore de compte, tu pourras en créer un avec cette adresse.`,
    });
    return c.json({ id, email: to, role, expiresAt, link, emailSent }, 201);
  });

  app.delete('/api/universes/:id/invitations/:invitationId', async (c) => {
    const universe = await universeFor(c, 'share');
    const res = await c.env.DB.prepare('update invitations set revoked_at = ? where id = ? and universe_id = ? and accepted_at is null and revoked_at is null').bind(Date.now(), c.req.param('invitationId'), universe.id).run();
    if (!res.meta.changes) throw new HttpError(404, 'Invitation introuvable.');
    return c.json({ ok: true });
  });

  app.post('/api/invitations/:token/accept', async (c) => {
    const db = c.env.DB;
    const inv = await invitationByToken(db, c.req.param('token'));
    const state = invitationState(inv);
    if (state === 'expired') throw new HttpError(410, 'Cette invitation a expiré. Demande-en une nouvelle.');
    if (state !== 'pending') throw new HttpError(410, state === 'accepted' ? 'Cette invitation a déjà été utilisée.' : 'Cette invitation a été annulée.');
    const user = c.get('user');
    if (normEmail(user.email) !== inv.email) throw new HttpError(403, `Cette invitation est destinée à ${inv.email}. Connecte-toi avec ce courriel.`);
    if (!(await getDoc(db, 'universe', inv.universe_id))) throw new HttpError(410, 'Cet univers n’existe plus.');
    const now = Date.now();
    const current = c.get('actor').universes[inv.universe_id];
    // Déjà membre : une invitation ne fait que monter un rôle, jamais le baisser (ni toucher au propriétaire).
    const RANK = { reader: 0, contributor: 1, editor: 2, owner: 3 };
    const steps = [db.prepare('update invitations set accepted_at = ?, accepted_by = ? where id = ?').bind(now, user.id, inv.id)];
    if (!current) steps.push(db.prepare('insert into universe_members (universe_id, user_id, role, created_at) values (?, ?, ?, ?)').bind(inv.universe_id, user.id, inv.role, now));
    else if (RANK[inv.role] > RANK[current]) steps.push(db.prepare('update universe_members set role = ? where universe_id = ? and user_id = ?').bind(inv.role, inv.universe_id, user.id));
    await db.batch(steps);
    const role = (await db.prepare('select role from universe_members where universe_id = ? and user_id = ?').bind(inv.universe_id, user.id).first()).role;
    return c.json({ universeId: inv.universe_id, role });
  });

  app.put('/api/universes/:id/members/:userId', async (c) => {
    const universe = await universeFor(c, 'share');
    const { role } = await body(c);
    if (!INVITABLE.includes(role)) throw new HttpError(400, 'Rôle invalide.');
    const res = await c.env.DB.prepare("update universe_members set role = ? where universe_id = ? and user_id = ? and role <> 'owner'").bind(role, universe.id, c.req.param('userId')).run();
    if (!res.meta.changes) throw new HttpError(404, 'Membre introuvable (le rôle du propriétaire ne change pas).');
    return c.json({ ok: true, role });
  });

  /** Le propriétaire retire un membre ; un membre peut aussi quitter l'univers. Le propriétaire, lui, reste. */
  app.delete('/api/universes/:id/members/:userId', async (c) => {
    const userId = c.req.param('userId');
    const self = userId === c.get('actor').id;
    const universe = await universeFor(c, self ? 'read' : 'share');
    const db = c.env.DB;
    const res = await db.prepare("delete from universe_members where universe_id = ? and user_id = ? and role <> 'owner'").bind(universe.id, userId).run();
    if (!res.meta.changes) throw new HttpError(404, 'Membre introuvable (le propriétaire ne peut pas être retiré).');
    // Ses rôles de co-MJ dans les campagnes de cet univers tombent avec lui ; le rôle de MJ d'une campagne reste attaché à sa création.
    await db.prepare("delete from campaign_members where user_id = ? and role = 'cogm' and campaign_id in (select id from documents where type = 'campaign' and universe_id = ?)").bind(userId, universe.id).run();
    return c.json({ ok: true });
  });

  /* ——— Co-MJ d'une campagne ——— */

  async function campaignFor(c, action) {
    const actor = c.get('actor');
    const doc = await getDoc(c.env.DB, 'campaign', c.req.param('id'));
    const res = doc && { type: 'campaign', id: doc.id, universeId: doc.universeId, campaignId: doc.id };
    if (!doc || !can(actor, 'read', res)) throw new HttpError(404, 'Introuvable.');
    if (action !== 'read' && !can(actor, action, res)) throw new HttpError(403, 'Action refusée.');
    return doc;
  }

  app.get('/api/campaigns/:id/members', async (c) => {
    const camp = await campaignFor(c, 'read');
    const { results } = await c.env.DB.prepare('select m.user_id as id, m.role, u.name, u.email from campaign_members m join "user" u on u.id = m.user_id where m.campaign_id = ?').bind(camp.id).all();
    return c.json({ members: results });
  });

  app.put('/api/campaigns/:id/members/:userId', async (c) => {
    const camp = await campaignFor(c, 'share');
    const userId = c.req.param('userId');
    const db = c.env.DB;
    const member = await db.prepare('select 1 from universe_members where universe_id = ? and user_id = ?').bind(camp.universeId, userId).first();
    if (!member) throw new HttpError(400, 'Un co-MJ doit d’abord être membre de l’univers.');
    await db.prepare("insert into campaign_members (campaign_id, user_id, role, created_at) values (?, ?, 'cogm', ?) on conflict (campaign_id, user_id) do nothing").bind(camp.id, userId, Date.now()).run();
    return c.json({ ok: true });
  });

  app.delete('/api/campaigns/:id/members/:userId', async (c) => {
    const camp = await campaignFor(c, 'share');
    const res = await c.env.DB.prepare("delete from campaign_members where campaign_id = ? and user_id = ? and role = 'cogm'").bind(camp.id, c.req.param('userId')).run();
    if (!res.meta.changes) throw new HttpError(404, 'Co-MJ introuvable.');
    return c.json({ ok: true });
  });
}
