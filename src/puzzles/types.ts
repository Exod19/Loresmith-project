/**
 * Énigmes déductives (kit « Atelier des Épreuves » v2) : le modèle d'une énigme, son état pendant la partie, et la vue
 * filtrée envoyée à l'écran joueur. La solution (`engine.serverConfig`, `gm`) ne quitte jamais la console MJ.
 */

export type Mechanic =
  | 'braziers' | 'heavy-stone' | 'jugs' | 'statues' | 'mirrors' | 'prime-tiles'
  | 'chronology' | 'glyphs' | 'cycles' | 'equal-balance' | 'gears' | 'light-network';

/** `initiale` : visible en entrant ; sinon, découverte en examinant la scène. */
export type Observation = { id: string; text: string; available: string };
/** Texte lisible sur place (plaque, inscription). Avec `clueId`, il a été déplacé ailleurs : le groupe doit le trouver. */
export type Readable = { source: string; text: string; clueId?: string };

export interface Puzzle {
  id: string;
  universeId?: string;
  schemaVersion?: string;
  title: string;
  family?: string;
  mechanic: Mechanic;
  difficulty?: string;
  estimatedMinutes?: number;
  tags?: string[];
  /** Brouillon tant que le MJ ne l'a pas vérifiée (doctrine : rien de « prêt à jouer » sans contrôle). */
  status?: 'brouillon' | 'prete';
  /** Modèle du catalogue d'où elle vient. */
  origin?: string;
  player: {
    location?: string;
    sceneDescription?: string;
    objective?: string;
    observations: Observation[];
    interactions?: string[];
    readables?: Readable[];
    accessibility?: string;
  };
  /** Réservé au MJ : démonstration, indices, conséquences. */
  gm: {
    deductionPath?: string[];
    solutionRationale?: string;
    acceptedAlternativeApproaches?: string[];
    nonSpoilerHints: { tier?: number; text: string; kind?: string }[];
    skillChecks?: { skill: string; dc?: string | number; result: string }[];
    failureForward: { onWrongAnswer: string; threshold: number; cost?: string };
    alternateBypass?: string;
    readyBeforeSession?: string[];
  };
  engine: { kind?: Mechanic; publicConfig: any; serverConfig: any };
  createdAt?: number;
  updatedAt?: number;
}

/** Objet ramassé par le groupe au fil de l'aventure (symbole, page, journal…) : il le garde et peut s'y référer. */
export interface Clue {
  id: string;
  universeId?: string;
  title: string;
  kind: ClueKind;
  /** Ce que lisent ou voient les joueurs. */
  text: string;
  /** Image (URL `blob:` en mémoire, `lsimg:` sur le disque). */
  image?: string;
  /** Le groupe l'a en sa possession : visible dans son carnet. */
  held: boolean;
  /** Réservé au MJ : où le trouver, à quoi il sert. */
  gmNote?: string;
  /** Énigme à laquelle il se rapporte. */
  puzzleId?: string;
  createdAt?: number;
  updatedAt?: number;
}
export type ClueKind = 'symbole' | 'page' | 'journal' | 'croquis' | 'objet';
export const CLUE_KINDS: { id: ClueKind; label: string; glyph: string }[] = [
  { id: 'page', label: 'Bout de papier', glyph: '📜' },
  { id: 'journal', label: 'Journal, lettre', glyph: '📖' },
  { id: 'symbole', label: 'Symbole, glyphe', glyph: '᛭' },
  { id: 'croquis', label: 'Croquis, plan', glyph: '🗺' },
  { id: 'objet', label: 'Objet', glyph: '🗝' },
];

export type Feedback = { kind: 'success' | 'failure'; message: string } | null;
export type Effect = { kind: string; text: string; handled: boolean };

export interface PuzzleState {
  puzzleId: string;
  revision: number;
  status: 'active' | 'solved' | 'paused';
  draft: any;
  attempts: number;
  hintLevel: number;
  sceneInspected: boolean;
  feedback: Feedback;
  history: { revision: number; type: string }[];
  effects: Effect[];
}

/** Ce que l'écran joueur reçoit : liste blanche, sans solution ni démonstration. */
export interface PublicPuzzle {
  id: string;
  title: string;
  mechanic: Mechanic;
  player: Omit<Puzzle['player'], 'readables'> & { readables: { source: string; text: string }[]; canInspectScene: boolean };
  publicConfig: any;
  state: { revision: number; status: PuzzleState['status']; draft: any; attempts: number; feedback: Feedback; hints: string[]; effects: { kind: string; text: string }[] };
  /** Carnet du groupe : ce qu'il a ramassé. */
  carnet: { id: string; title: string; kind: ClueKind; text: string; image?: string }[];
}

/** Action d'un joueur ou du MJ sur le mécanisme. */
export type PuzzleAction = { type: string; [k: string]: unknown };
