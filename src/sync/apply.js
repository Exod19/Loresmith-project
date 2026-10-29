/**
 * Applique au grimoire local ce que la synchronisation a reçu (pur, sans navigateur).
 * `changes.upserts` : documents à poser ; `changes.deletes` : documents à retirer.
 */
import { DOC_TYPES } from '../shared/schema.js';
import { mapStrings } from '../store/imageRefs.js';

export function applyChanges(state, { upserts = [], deletes = [] }) {
  if (!upserts.length && !deletes.length) return state;
  const next = { ...state };
  const touched = new Set();
  const collection = (name) => {
    if (!touched.has(name)) {
      next[name] = { ...(next[name] || {}) };
      touched.add(name);
    }
    return next[name];
  };
  let userState = null;
  for (const u of upserts) {
    if (u.type === 'userState') userState = u.data;
    else if (DOC_TYPES[u.type]?.collection) collection(DOC_TYPES[u.type].collection)[u.id] = u.data;
  }
  for (const d of deletes) if (DOC_TYPES[d.type]?.collection) delete collection(DOC_TYPES[d.type].collection)[d.id];
  if (userState) {
    // Combat en cours et journal suivent le compte (Q1). L'univers actif seulement s'il existe ici.
    if (userState.combat) next.combat = userState.combat;
    if (Array.isArray(userState.log)) next.log = userState.log;
    if (userState.activeUniverseId && next.universes?.[userState.activeUniverseId]) next.activeUniverseId = userState.activeUniverseId;
  }
  if (!next.universes?.[next.activeUniverseId]) next.activeUniverseId = Object.keys(next.universes || {})[0] ?? null;
  return next;
}

/** Identifiants qu'on ne renomme jamais : l'application reconnaît ces éléments par leur identifiant fixe. */
export const FIXED_IDS = new Set(['atlas-profondeurs']);

/**
 * Renomme des éléments du grimoire (`map` : ancien identifiant → nouveau) et met à jour toutes leurs références :
 * univers d'un PNJ, cible d'une image, campagnes liées, univers actif… Sert quand un identifiant est déjà pris
 * sur le serveur par le document d'un autre compte.
 */
export function renameIds(state, map) {
  const pairs = new Map([...map].filter(([old]) => !FIXED_IDS.has(old)));
  if (!pairs.size) return state;
  const renamed = mapStrings(state, (s) => pairs.get(s) ?? s);
  const out = { ...renamed };
  for (const def of Object.values(DOC_TYPES)) {
    const c = def.collection;
    if (c && renamed[c]) out[c] = Object.fromEntries(Object.entries(renamed[c]).map(([k, v]) => [pairs.get(k) ?? k, v]));
  }
  return out;
}

/**
 * Nouveaux identifiants pour les éléments refusés (`idTaken` : identifiant pris par un autre compte).
 * Un univers renommé emporte tout son contenu, une campagne ses discussions : c'est le cas d'une même archive
 * importée par deux MJ, dont tous les identifiants se recouvrent.
 */
export function renameMapFor(state, idTaken, newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12)) {
  const map = new Map();
  const add = (id) => {
    if (!FIXED_IDS.has(id) && !map.has(id)) map.set(id, newId());
  };
  for (const { type, id } of idTaken) {
    add(id);
    for (const def of Object.values(DOC_TYPES)) {
      for (const [childId, v] of Object.entries(state?.[def.collection] || {})) {
        if ((type === 'universe' && v?.universeId === id) || (type === 'campaign' && v?.campaignId === id)) add(childId);
      }
    }
  }
  return map;
}
