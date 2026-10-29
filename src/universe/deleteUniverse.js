/**
 * Suppression d'un univers : fonctions pures, testables.
 * Un univers « possède » tout ce qui porte son `universeId`. Supprimer l'univers sans ce contenu
 * laisserait des données orphelines et invisibles dans le grimoire.
 */

/** Collections du grimoire dont les éléments portent un `universeId`. */
const DICTS = ['characters', 'campaigns', 'npcs', 'quests', 'libraryEntries', 'chatThreads', 'maps', 'assets'];

const ownedBy = (id) => (x) => x && x.universeId === id;

/** Nombre d'éléments que la suppression emporterait, par collection non vide. */
export function universeContents(state, id) {
  const out = {};
  for (const key of DICTS) {
    const n = Object.values(state?.[key] || {}).filter(ownedBy(id)).length;
    if (n) out[key] = n;
  }
  const logs = (state?.log || []).filter(ownedBy(id)).length;
  if (logs) out.log = logs;
  return out;
}

/** On ne supprime jamais le dernier univers : l'application a besoin d'un univers actif. */
export function canDeleteUniverse(state, id) {
  return !!state?.universes?.[id] && Object.keys(state.universes).length > 1;
}

/** Retire l'univers et tout son contenu. Renvoie le même état si la suppression n'est pas permise. */
export function removeUniverse(state, id) {
  if (!canDeleteUniverse(state, id)) return state;
  const next = { ...state };
  for (const key of DICTS) {
    if (!state[key]) continue;
    next[key] = Object.fromEntries(Object.entries(state[key]).filter(([, v]) => !ownedBy(id)(v)));
  }
  if (state.log) next.log = state.log.filter((l) => !ownedBy(id)(l));
  const universes = { ...state.universes };
  delete universes[id];
  next.universes = universes;
  if (state.activeUniverseId === id) next.activeUniverseId = Object.keys(universes)[0];
  return next;
}
