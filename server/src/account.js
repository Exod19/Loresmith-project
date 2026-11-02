/**
 * Compte (lot 8) : profil, acceptation des avis et conditions, export des renseignements du compte,
 * suppression du compte. Tant que la version en vigueur des conditions n'est pas acceptée, seules ces routes
 * répondent : synchronisation, univers et partage renvoient 403 (`code: 'terms_required'`).
 */
import { TERMS_VERSION } from '../../src/shared/terms.js';
import { HttpError } from './documents.js';
import { blobStore } from './store.js';

const OPEN = new Set(['/api/me', '/api/me/terms', '/api/me/export']);

/** À monter après le chargement de la session : bloque tout le reste tant que les conditions ne sont pas acceptées. */
export function termsGuard() {
  return async (c, next) => {
    if (!OPEN.has(c.req.path) && !c.get('termsAccepted')) {
      return c.json({ error: 'Accepte d’abord les avis et conditions d’utilisation.', code: 'terms_required', version: TERMS_VERSION }, 403);
    }
    await next();
  };
}

export async function termsAccepted(db, userId) {
  return !!(await db.prepare('select 1 from terms_acceptances where user_id = ? and version = ?').bind(userId, TERMS_VERSION).first());
}

export function mountAccount(app) {
  app.get('/api/me', (c) => {
    const { id, email, name } = c.get('user');
    const actor = c.get('actor');
    return c.json({ user: { id, email, name }, admin: !!actor.admin, universes: actor.universes, campaigns: actor.campaigns, termsAccepted: c.get('termsAccepted'), termsVersion: TERMS_VERSION });
  });

  app.post('/api/me/terms', async (c) => {
    const { version } = await c.req.json().catch(() => ({}));
    if (version !== TERMS_VERSION) throw new HttpError(409, 'Les conditions ont changé : relis la version en vigueur.', { version: TERMS_VERSION });
    await c.env.DB.prepare('insert or ignore into terms_acceptances (user_id, version, accepted_at) values (?, ?, ?)').bind(c.get('user').id, version, Date.now()).run();
    return c.json({ termsAccepted: true, version });
  });

  /** Renseignements du compte, en JSON (droit d'accès et de portabilité). Le grimoire, lui, s'exporte en .zip. */
  app.get('/api/me/export', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const all = async (sql, ...binds) => (await db.prepare(sql).bind(...binds).all()).results;
    const profile = await db.prepare('select id, name, email, "emailVerified", "createdAt", "updatedAt" from "user" where id = ?').bind(user.id).first();
    return c.json({
      exportedAt: new Date().toISOString(),
      profile,
      sessions: await all('select "createdAt", "expiresAt", "ipAddress", "userAgent" from session where "userId" = ?', user.id),
      universes: await all("select m.universe_id as id, m.role, json_extract(d.data, '$.name') as name, m.created_at as since from universe_members m left join documents d on d.type = 'universe' and d.id = m.universe_id where m.user_id = ?", user.id),
      campaigns: await all("select m.campaign_id as id, m.role, json_extract(d.data, '$.title') as title from campaign_members m left join documents d on d.type = 'campaign' and d.id = m.campaign_id where m.user_id = ?", user.id),
      invitationsSent: await all('select email, role, created_at, expires_at, accepted_at, revoked_at from invitations where invited_by = ?', user.id),
      invitationsReceived: await all('select universe_id, role, created_at, accepted_at from invitations where email = ?', user.email.toLowerCase()),
      termsAcceptances: await all('select version, accepted_at from terms_acceptances where user_id = ?', user.id),
    });
  });

  /**
   * Suppression du compte : le courriel doit être retapé. Un univers qu'on possède et qui a d'autres membres doit d'abord
   * être libéré (membres retirés) : on ne supprime pas l'univers des autres sans qu'ils le sachent.
   * Sont effacés : le compte et ses sessions, ses appartenances, ses invitations, ses univers (contenu, historique,
   * images) et l'état de son compte. Ce qu'il a écrit dans l'univers d'un autre reste à cet univers.
   */
  app.delete('/api/me', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const { confirm } = await c.req.json().catch(() => ({}));
    if (String(confirm || '').trim().toLowerCase() !== user.email.toLowerCase()) throw new HttpError(400, 'Retape ton courriel pour confirmer la suppression.');
    const owned = (await db.prepare("select universe_id from universe_members where user_id = ? and role = 'owner'").bind(user.id).all()).results.map((r) => r.universe_id);
    if (owned.length) {
      const marks = owned.map(() => '?').join(',');
      const shared = (await db.prepare(`select distinct m.universe_id as id, json_extract(d.data, '$.name') as name from universe_members m left join documents d on d.type = 'universe' and d.id = m.universe_id where m.universe_id in (${marks}) and m.user_id <> ?`).bind(...owned, user.id).all()).results;
      if (shared.length) throw new HttpError(409, 'Retire d’abord les autres membres de tes univers partagés : ' + shared.map((s) => `« ${s.name || s.id} »`).join(', ') + '.', { shared });
    }
    const steps = [];
    if (owned.length) {
      const marks = owned.map(() => '?').join(',');
      const store = blobStore(c.env);
      const keys = (await db.prepare(`select r2_key from images where universe_id in (${marks})`).bind(...owned).all()).results.map((r) => r.r2_key);
      await store.delete(keys);
      steps.push(
        db.prepare(`delete from document_versions where (type, id) in (select type, id from documents where universe_id in (${marks}))`).bind(...owned),
        db.prepare(`delete from campaign_members where campaign_id in (select id from documents where type = 'campaign' and universe_id in (${marks}))`).bind(...owned),
        db.prepare(`delete from documents where universe_id in (${marks})`).bind(...owned),
        db.prepare(`delete from images where universe_id in (${marks})`).bind(...owned),
        db.prepare(`delete from invitations where universe_id in (${marks})`).bind(...owned),
        db.prepare(`delete from universe_members where universe_id in (${marks})`).bind(...owned),
      );
    }
    steps.push(
      db.prepare("delete from document_versions where type = 'userState' and id = ?").bind(user.id),
      db.prepare("delete from documents where type = 'userState' and id = ?").bind(user.id),
      db.prepare('delete from invitations where invited_by = ? or email = ?').bind(user.id, user.email.toLowerCase()),
      db.prepare('delete from campaign_members where user_id = ?').bind(user.id),
      db.prepare('delete from universe_members where user_id = ?').bind(user.id),
      db.prepare('delete from terms_acceptances where user_id = ?').bind(user.id),
      db.prepare('delete from session where "userId" = ?').bind(user.id),
      db.prepare('delete from account where "userId" = ?').bind(user.id),
      db.prepare('delete from "user" where id = ?').bind(user.id),
    );
    await db.batch(steps);
    return c.json({ deleted: true, universes: owned.length });
  });
}
