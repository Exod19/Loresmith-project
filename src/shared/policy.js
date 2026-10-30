/**
 * Permissions : fonction pure `can(actor, action, resource)`, utilisée par le serveur (lot 4).
 * Le navigateur peut s'en servir pour griser un bouton, jamais pour protéger une donnée.
 * Tout ce qui n'est pas explicitement permis est refusé.
 *
 * actor    : { id, universes: { [universeId]: rôle }, campaigns: { [campaignId]: rôle } } (null si non connecté)
 * action   : read | create | update | delete | share | readSecrets
 * resource : { type, id?, universeId?, campaignId?, createdBy?, ownerId? } (cf. `schema.js`)
 *
 * Règles (PLAN, section 3) :
 * - Univers : tout membre le lit ; propriétaire et éditeurs le modifient ; seul le propriétaire le supprime et le partage.
 *   Tout compte peut créer un univers (il en devient propriétaire).
 * - Éléments de l'univers (PNJ, fiches, cartes, images, héros, quêtes, discussions hors campagne) : tout membre les lit ;
 *   propriétaire, éditeurs et contributeurs en créent ; propriétaire et éditeurs modifient et suppriment tout,
 *   un contributeur seulement ce qu'il a créé. Les lecteurs ne font que lire.
 * - Campagne (et ses discussions) : tout membre de l'univers la lit, secrets compris, car tous les comptes sont des MJ ;
 *   propriétaire, éditeurs et contributeurs en créent ; seuls son MJ et ses co-MJ la modifient ;
 *   son MJ la partage (co-MJ) ; son MJ ou le propriétaire de l'univers la suppriment.
 * - État du compte (`userState`) : son titulaire seulement.
 */
import { CAMPAIGN_ROLES, DOC_TYPES, UNIVERSE_ROLES } from './schema.js';

export const ACTIONS = ['read', 'create', 'update', 'delete', 'share', 'readSecrets'];

/** Qui peut lire les champs secrets : `member` (tout membre, décision actuelle) ou `campaign` (MJ et co-MJ seulement). */
export const SECRETS_VISIBLE_TO = 'member';

const universeRole = (actor, universeId) => {
  const r = universeId ? actor?.universes?.[universeId] : undefined;
  return UNIVERSE_ROLES.includes(r) ? r : null;
};
const campaignRole = (actor, campaignId) => {
  const r = campaignId ? actor?.campaigns?.[campaignId] : undefined;
  return CAMPAIGN_ROLES.includes(r) ? r : null;
};
const isIn = (role, ...roles) => role !== null && roles.includes(role);

function canUniverse(actor, action, res) {
  if (action === 'create') return true;
  const u = universeRole(actor, res.id ?? res.universeId);
  if (action === 'read' || action === 'readSecrets') return u !== null;
  if (action === 'update') return isIn(u, 'owner', 'editor');
  if (action === 'delete' || action === 'share') return u === 'owner';
  return false;
}

function canUniverseItem(actor, action, res) {
  const u = universeRole(actor, res.universeId);
  if (action === 'read' || action === 'readSecrets') return u !== null;
  if (action === 'create') return isIn(u, 'owner', 'editor', 'contributor');
  if (action === 'update' || action === 'delete') {
    if (isIn(u, 'owner', 'editor')) return true;
    return u === 'contributor' && !!res.createdBy && res.createdBy === actor.id;
  }
  return false;
}

function canCampaign(actor, action, res) {
  const u = universeRole(actor, res.universeId);
  const c = campaignRole(actor, res.campaignId ?? res.id);
  if (action === 'read') return u !== null || c !== null;
  if (action === 'readSecrets') return SECRETS_VISIBLE_TO === 'member' ? u !== null || c !== null : c !== null;
  if (action === 'create') return isIn(u, 'owner', 'editor', 'contributor');
  if (action === 'update') return c !== null;
  if (action === 'share') return c === 'gm';
  if (action === 'delete') return c === 'gm' || u === 'owner';
  return false;
}

/** Discussion, ou autre élément rattaché à une campagne : mêmes droits que la campagne, sauf la création. */
function canCampaignItem(actor, action, res) {
  if (action === 'share') return false;
  if (action === 'create' || action === 'delete') return campaignRole(actor, res.campaignId) !== null;
  return canCampaign(actor, action, { ...res, id: res.campaignId });
}

export function can(actor, action, resource) {
  if (!actor?.id || !resource || !ACTIONS.includes(action)) return false;
  const def = DOC_TYPES[resource.type];
  if (!def) return false;
  if (def.scope === 'user') return action !== 'share' && resource.ownerId === actor.id;
  if (resource.type === 'universe') return canUniverse(actor, action, resource);
  if (resource.type === 'campaign') return canCampaign(actor, action, resource);
  if (resource.campaignId) return canCampaignItem(actor, action, resource);
  return canUniverseItem(actor, action, resource);
}

/** Comme `can`, mais lève une erreur (le serveur la traduit en 403). */
export function assertCan(actor, action, resource) {
  if (!can(actor, action, resource)) {
    const err = new Error(`Action refusée : ${action} sur ${resource?.type ?? '?'}`);
    err.status = actor?.id ? 403 : 401;
    throw err;
  }
}

/**
 * Banque Loresmith : retouches des étiquettes communes à toute l'application (pas rattachées à un univers).
 * Tout compte connecté les lit et les modifie : le site est réservé aux MJ admis (Cloudflare Access).
 */
export function canBanque(actor, action) {
  return !!actor?.id && (action === 'read' || action === 'update');
}
