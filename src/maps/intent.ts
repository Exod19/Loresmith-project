/**
 * Passage de relais vers la page Cartes : la Table de jeu y dépose la carte à ouvrir (et si c'est en combat),
 * la page Cartes la reprend une seule fois à son ouverture.
 */
/** `from` : la page d'où l'on vient, pour y revenir d'un clic. */
export type MapIntent = { mapId: string; battle?: boolean; from?: 'table' };

let pending: MapIntent | null = null;

export const setMapIntent = (intent: MapIntent) => { pending = intent; };

/** Lit l'intention en attente, sans l'effacer (un initialiseur d'état peut être appelé deux fois). */
export const peekMapIntent = (): MapIntent | null => pending;

/** Efface l'intention une fois la page Cartes affichée. */
export const clearMapIntent = () => { pending = null; };
