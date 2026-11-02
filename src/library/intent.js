/**
 * Passage de relais vers la Bibliothèque : une autre page (la carte, par exemple) y dépose la fiche à ouvrir,
 * la Bibliothèque la reprend une seule fois à son ouverture. Même principe que `maps/intent.ts`.
 */
let pending = null;

export const setLibraryIntent = (entryId) => {
  pending = entryId || null;
};

/** Lit et efface l'intention en attente. */
export const takeLibraryIntent = () => {
  const id = pending;
  pending = null;
  return id;
};
