/**
 * Applique au grimoire local ce que la synchronisation a reçu (pur, sans navigateur).
 * `changes.upserts` : documents à poser ; `changes.deletes` : documents à retirer.
 */
import { DOC_TYPES } from '../shared/schema.js';

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
