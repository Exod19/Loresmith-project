/**
 * Schéma cible du grimoire partagé : fonctions pures, communes au navigateur et au serveur (lots 4 et 5).
 *
 * Le grimoire local reste un seul objet. Côté serveur, il est découpé en **documents** : un par univers,
 * campagne ou élément (PNJ, fiche, carte, image…), plus un document propre à chaque compte (`userState` :
 * univers actif, combat en cours, journal), qui suit le MJ d'un appareil à l'autre (décision Q1).
 * Chaque document porte sa portée (univers, campagne ou compte) : c'est elle que vérifient les permissions.
 *
 * Tables en D1 (server/migrations/0001_init.sql) :
 *   user, session, account, verification                     -- comptes, tables de Better Auth
 *   universe_members(universe_id, user_id, role)            -- owner | editor | contributor | reader
 *   campaign_members(campaign_id, user_id, role)            -- gm | cogm
 *   documents(type, id, universe_id, campaign_id, owner_id, created_by, version, updated_by, updated_at, deleted_at, data)
 *   document_versions(type, id, version, updated_by, updated_at, data)   -- historique, retour arrière (Q5)
 *   images(universe_id, id, r2_key, type, size, created_by, created_at)
 */

/** Rôles dans un univers, du plus large au plus restreint. */
export const UNIVERSE_ROLES = ['owner', 'editor', 'contributor', 'reader'];
/** Rôles dans une campagne : son MJ (créateur) et ses co-MJ. */
export const CAMPAIGN_ROLES = ['gm', 'cogm'];

/**
 * Types de documents. `collection` : clé du grimoire local. `scope` : à quoi le document est rattaché.
 * Une discussion IA liée à une campagne suit la campagne ; sinon, l'univers.
 */
export const DOC_TYPES = {
  universe: { collection: 'universes', scope: 'universe' },
  campaign: { collection: 'campaigns', scope: 'campaign' },
  character: { collection: 'characters', scope: 'universe' },
  npc: { collection: 'npcs', scope: 'universe' },
  quest: { collection: 'quests', scope: 'universe' },
  library: { collection: 'libraryEntries', scope: 'universe' },
  map: { collection: 'maps', scope: 'universe' },
  asset: { collection: 'assets', scope: 'universe' },
  chat: { collection: 'chatThreads', scope: 'universe-or-campaign' },
  userState: { collection: null, scope: 'user' },
};

const TYPE_OF_COLLECTION = Object.fromEntries(Object.entries(DOC_TYPES).filter(([, d]) => d.collection).map(([t, d]) => [d.collection, t]));

/**
 * Champs réservés au MJ, par type (relevés par l'audit, section 3). `a[].b` : champ `b` de chaque élément du tableau `a`.
 * Tous les comptes sont des MJ : ces champs sont lisibles par tout membre (décisions Q3 et « secrets de campagne »).
 * La liste sert à `redact`, pour le jour où un accès sans droit aux secrets existera (joueurs, lien public).
 */
export const SECRET_FIELDS = {
  campaign: [
    'dmOverview', 'finalTruth', 'failureState', 'campaignCanon', 'mindDump',
    'acts[].secrets', 'majorLocations[].secrets', 'recurringNpcs[].secret', 'factions[].hiddenTruth', 'mysteries[].truth',
    'librarySuggestions[].secrets',
    'scenes[].expanded.dmNotes', 'scenes[].expanded.hiddenTruth', 'scenes[].expanded.npcs[].secret',
    'scenes[].expanded.encounters', 'scenes[].expanded.branches', 'scenes[].expanded.skillChecks', 'scenes[].expanded.clues',
  ],
  library: ['secrets'],
  npc: ['secret'],
  map: ['points[].notes', 'overlay.markers[].notes', 'overlay.markers[].groups'],
  chat: ['messages'],
};

/** Portée d'un élément du grimoire local. */
function scopeOf(type, v) {
  if (type === 'universe') return { universeId: v.id, campaignId: null };
  if (type === 'campaign') return { universeId: v.universeId ?? null, campaignId: v.id };
  if (type === 'chat' && v.campaignId) return { universeId: v.universeId ?? null, campaignId: v.campaignId };
  return { universeId: v.universeId ?? null, campaignId: null };
}

/**
 * Découpe un grimoire en documents. `ownerId` : le compte à qui appartient le document `userState`.
 * Un élément sans univers (orphelin, cf. audit, risque 4) est signalé à part et n'est pas envoyé.
 */
export function documentsOf(state, ownerId) {
  const docs = [];
  const orphans = [];
  for (const [collection, type] of Object.entries(TYPE_OF_COLLECTION)) {
    for (const [id, data] of Object.entries(state?.[collection] || {})) {
      const scope = scopeOf(type, data);
      const universeKnown = type === 'universe' || (scope.universeId && state.universes?.[scope.universeId]);
      const campaignKnown = !scope.campaignId || type === 'campaign' || state.campaigns?.[scope.campaignId];
      if (!universeKnown || !campaignKnown) orphans.push({ type, id });
      else docs.push({ type, id, ...scope, data });
    }
  }
  docs.push({
    type: 'userState',
    id: ownerId,
    universeId: null,
    campaignId: null,
    ownerId,
    data: { activeUniverseId: state?.activeUniverseId ?? null, combat: state?.combat ?? { combatants: [], round: 1 }, log: state?.log ?? [] },
  });
  return { docs, orphans };
}

/** Reconstruit un grimoire local à partir de documents (l'inverse de `documentsOf`). */
export function grimoireOf(docs) {
  const state = { activeUniverseId: null, combat: { combatants: [], round: 1 }, log: [] };
  for (const collection of Object.keys(TYPE_OF_COLLECTION)) state[collection] = {};
  for (const d of docs) {
    if (d.type === 'userState') Object.assign(state, d.data);
    else if (DOC_TYPES[d.type]?.collection) state[DOC_TYPES[d.type].collection][d.id] = d.data;
  }
  return state;
}

/* ——— Retrait des champs secrets ——— */

function removePath(value, parts) {
  if (value === null || typeof value !== 'object') return value;
  const [head, ...rest] = parts;
  const many = head.endsWith('[]');
  const key = many ? head.slice(0, -2) : head;
  if (!(key in value)) return value;
  if (!rest.length) {
    if (many) return value;
    const { [key]: _removed, ...kept } = value;
    return kept;
  }
  const child = value[key];
  const next = many && Array.isArray(child) ? child.map((x) => removePath(x, rest)) : many ? child : removePath(child, rest);
  return { ...value, [key]: next };
}

/**
 * Copie d'un document sans ses champs secrets. Une carte perd aussi ses repères secrets
 * et les repères pas encore révélés. Le document d'origine n'est pas modifié.
 */
export function redact(type, data) {
  let out = data;
  for (const path of SECRET_FIELDS[type] || []) out = removePath(out, path.split('.'));
  if (type === 'map' && out) {
    if (Array.isArray(out.points)) out = { ...out, points: out.points.filter((p) => !p.secret) };
    if (Array.isArray(out.overlay?.markers)) out = { ...out, overlay: { ...out.overlay, markers: out.overlay.markers.filter((m) => m.revealed) } };
  }
  return out;
}
