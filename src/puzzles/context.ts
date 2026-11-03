/**
 * Énigmes et carnet d'indices de l'univers actif, mis à disposition des cartes (sans les faire transiter par chaque
 * composant intermédiaire). Fourni par App.jsx ; absent ailleurs (écran joueur), où rien n'en dépend.
 */
import { createContext, useContext } from 'react';
import type { Clue, Puzzle } from './types';

export type PuzzleLibrary = {
  universeId: string;
  puzzles: Puzzle[];
  clues: Clue[];
  savePuzzle: (p: Puzzle) => void;
  deletePuzzle: (id: string) => void;
  saveClue: (c: Clue) => void;
  deleteClue: (id: string) => void;
};

export const PuzzleContext = createContext<PuzzleLibrary | null>(null);
export const usePuzzles = () => useContext(PuzzleContext);
