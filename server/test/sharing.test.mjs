/**
 * Partage (lot 6) : invitations (expiration, annulation, mauvais destinataire), invité sans compte,
 * changement et retrait de rôle immédiats, co-MJ d'une campagne.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { account, device, empty, env, setupServer } from './helpers.mjs';

setupServer();

const tokenOf = (link) => new URL(link).searchParams.get('invitation');

/** Visiteur sans compte (pas de cookie). */
async function anonymous() {
  const { default: app } = await import('../src/index.js');
  return async (method, path) => {
    const res = await app.fetch(new Request('http://localhost:8787' + path, { method, headers: { Origin: 'http://localhost:5173' } }), env);
    return { status: res.status, body: await res.json() };
  };
}

test('invitations, rôles et co-MJ', async () => {
  const alice = await account('alice');
  const a = device(alice, { ...empty(), activeUniverseId: 'u1', universes: { u1: { id: 'u1', name: 'Underdark' } }, npcs: { n1: { id: 'n1', universeId: 'u1', name: 'Yemena' } }, campaigns: { k1: { id: 'k1', universeId: 'u1', title: 'La descente' } } });
  await a.sync();

  // Alice invite bob@ comme éditeur. Sans clé Resend, aucun courriel ne part : le lien lui est rendu.
  const inv = await alice.call('POST', '/api/universes/u1/invitations', { email: 'Bob@Exemple.org', role: 'editor' });
  assert.deepEqual([inv.status, inv.body.email, inv.body.emailSent], [201, 'bob@exemple.org', false]);
  assert.match(inv.body.link, /^http:\/\/localhost:5173\/\?invitation=[\w-]{40,}$/);
  const token = tokenOf(inv.body.link);
  const stored = await env.DB.prepare('select token_hash from invitations where id = ?').bind(inv.body.id).first();
  assert.notEqual(stored.token_hash, token, 'seule l’empreinte du jeton est gardée');

  // Aperçu public, avant toute connexion.
  const anon = await anonymous();
  const preview = await anon('GET', `/api/invitations/${token}`);
  assert.deepEqual([preview.status, preview.body.universe, preview.body.role, preview.body.state, preview.body.from], [200, 'Underdark', 'editor', 'pending', 'alice']);
  assert.equal((await anon('POST', `/api/invitations/${token}/accept`)).status, 401, 'accepter demande un compte');
  assert.equal((await anon('GET', '/api/invitations/jeton-inventé-qui-n-existe-pas')).status, 404);

  // Bob n'avait pas de compte : il en crée un (son appareil se synchronise une première fois, vide), puis accepte.
  const bob = await account('bob');
  const b = device(bob, empty());
  await b.sync();
  const ok = await bob.call('POST', `/api/invitations/${token}/accept`);
  assert.deepEqual([ok.status, ok.body.role], [200, 'editor']);
  assert.equal((await bob.call('POST', `/api/invitations/${token}/accept`)).status, 410, 'une invitation ne sert qu’une fois');
  const joined = await b.sync();
  assert.deepEqual(joined.joined, ['u1']);
  assert.deepEqual([b.state.universes.u1?.name, b.state.npcs.n1?.name, b.state.campaigns.k1?.title], ['Underdark', 'Yemena', 'La descente'], 'tout le contenu existant arrive');

  // Bob voit les membres, mais pas les invitations en attente, et ne peut pas inviter.
  const members = await bob.call('GET', '/api/universes/u1/members');
  assert.deepEqual(members.body.members.map((m) => [m.name, m.role]), [['alice', 'owner'], ['bob', 'editor']]);
  assert.deepEqual(members.body.invitations, []);
  assert.equal((await bob.call('POST', '/api/universes/u1/invitations', { email: 'x@exemple.org', role: 'reader' })).status, 403);
  assert.equal((await alice.call('POST', '/api/universes/u1/invitations', { email: 'bob@exemple.org', role: 'reader' })).status, 409, 'déjà membre');
  assert.equal((await alice.call('POST', '/api/universes/u1/invitations', { email: 'x@exemple.org', role: 'owner' })).status, 400, 'on n’invite pas un second propriétaire');

  // Invitation expirée.
  const late = await alice.call('POST', '/api/universes/u1/invitations', { email: 'carol@exemple.org', role: 'reader' });
  await env.DB.prepare('update invitations set expires_at = ? where id = ?').bind(Date.now() - 1, late.body.id).run();
  const carol = await account('carol');
  const expired = await carol.call('POST', `/api/invitations/${tokenOf(late.body.link)}/accept`);
  assert.deepEqual([expired.status, /expiré/.test(expired.body.error)], [410, true]);
  assert.equal((await anon('GET', `/api/invitations/${tokenOf(late.body.link)}`)).body.state, 'expired');

  // Invitation annulée, puis invitation acceptée par le mauvais compte.
  const revoked = await alice.call('POST', '/api/universes/u1/invitations', { email: 'carol@exemple.org', role: 'reader' });
  assert.equal((await alice.call('GET', '/api/universes/u1/members')).body.invitations.length, 1);
  assert.equal((await alice.call('DELETE', `/api/universes/u1/invitations/${revoked.body.id}`)).status, 200);
  assert.equal((await carol.call('POST', `/api/invitations/${tokenOf(revoked.body.link)}/accept`)).status, 410);
  const forDave = await alice.call('POST', '/api/universes/u1/invitations', { email: 'dave@exemple.org', role: 'reader' });
  const wrong = await carol.call('POST', `/api/invitations/${tokenOf(forDave.body.link)}/accept`);
  assert.deepEqual([wrong.status, /dave@exemple.org/.test(wrong.body.error)], [403, true]);

  // Co-MJ : Alice (MJ de la campagne) en nomme un parmi les membres de l'univers.
  assert.equal((await bob.call('PUT', '/api/docs/campaign/k1', { version: 1, data: { id: 'k1', universeId: 'u1', title: 'x' } })).status, 403, 'éditeur sans être co-MJ');
  assert.equal((await alice.call('PUT', `/api/campaigns/k1/members/${carol.id}`)).status, 400, 'pas membre de l’univers');
  assert.equal((await bob.call('PUT', `/api/campaigns/k1/members/${bob.id}`)).status, 403, 'seul le MJ nomme ses co-MJ');
  assert.equal((await alice.call('PUT', `/api/campaigns/k1/members/${bob.id}`)).status, 200);
  const v2 = await bob.call('PUT', '/api/docs/campaign/k1', { version: 1, data: { id: 'k1', universeId: 'u1', title: 'La descente (co-MJ)' } });
  assert.equal(v2.status, 200);
  assert.deepEqual((await alice.call('GET', '/api/campaigns/k1/members')).body.members.map((m) => m.role).sort(), ['cogm', 'gm']);
  assert.equal((await alice.call('DELETE', `/api/campaigns/k1/members/${bob.id}`)).status, 200);
  assert.equal((await bob.call('PUT', '/api/docs/campaign/k1', { version: 2, data: { id: 'k1', universeId: 'u1', title: 'y' } })).status, 403, 'co-MJ retiré : refus immédiat');

  // Rôle changé : effet immédiat, côté serveur.
  assert.equal((await bob.call('PUT', '/api/docs/npc/n1', { version: 1, data: { id: 'n1', universeId: 'u1', name: 'Yemena (Bob)' } })).status, 200);
  assert.equal((await bob.call('PUT', `/api/universes/u1/members/${alice.id}`, { role: 'reader' })).status, 403);
  assert.equal((await alice.call('PUT', `/api/universes/u1/members/${alice.id}`, { role: 'reader' })).status, 404, 'le propriétaire reste propriétaire');
  assert.equal((await alice.call('PUT', `/api/universes/u1/members/${bob.id}`, { role: 'reader' })).status, 200);
  assert.equal((await bob.call('PUT', '/api/docs/npc/n1', { version: 2, data: { id: 'n1', universeId: 'u1', name: 'Encore' } })).status, 403, 'lecteur : refus dès la requête suivante');

  // Rôle retiré : plus rien de l'univers n'est accessible, et la copie locale de Bob reste chez lui sans être renvoyée.
  await alice.call('PUT', `/api/campaigns/k1/members/${bob.id}`);
  assert.equal((await alice.call('DELETE', `/api/universes/u1/members/${bob.id}`)).status, 200);
  assert.equal((await bob.call('GET', '/api/universes/u1')).status, 404);
  assert.equal((await env.DB.prepare('select count(*) as n from campaign_members where user_id = ?').bind(bob.id).first()).n, 0, 'ses rôles de co-MJ tombent avec lui');
  b.edit((s) => (s.npcs.n1.name = 'Modifié après le retrait'));
  const lost = await b.sync();
  assert.deepEqual([lost.lostAccess, lost.conflicts.length], [['u1'], 0]);
  const n1 = await env.DB.prepare("select data from documents where type = 'npc' and id = 'n1'").first();
  assert.equal(JSON.parse(n1.data).name, 'Yemena (Bob)', 'rien de l’univers n’est renvoyé après le retrait');
  assert.equal(b.state.npcs.n1.name, 'Modifié après le retrait', 'la copie locale n’est pas effacée');
  assert.equal((await alice.call('DELETE', `/api/universes/u1/members/${alice.id}`)).status, 404, 'le propriétaire ne peut pas être retiré');
});
