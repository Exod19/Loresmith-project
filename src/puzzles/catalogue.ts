/**
 * Catalogue des 12 énigmes du kit v2 (propositions hors canon tant que le MJ ne les a pas validées). Chargé à la demande,
 * dans la console MJ seulement : il contient les solutions et n'est jamais importé par l'écran joueur.
 */
import type { Puzzle } from './types';

export async function loadCatalogue(): Promise<Puzzle[]> {
  const m = await import('./catalogue.json');
  return ((m.default ?? m) as unknown as { puzzles: Puzzle[] }).puzzles;
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Copie d'un modèle dans l'univers : identifiant neuf, en brouillon jusqu'à la vérification du MJ. */
export function fromModel(model: Puzzle, universeId: string): Puzzle {
  const copy: Puzzle = JSON.parse(JSON.stringify(model));
  const now = Date.now();
  return { ...copy, id: `enigme-${uid()}`, universeId, origin: model.id, status: 'brouillon', createdAt: now, updatedAt: now };
}
