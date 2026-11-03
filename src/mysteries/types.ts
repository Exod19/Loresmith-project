/**
 * Le Fil des Mystères (kit v3) : un mystère au long cours relie un ou plusieurs verrous (énigmes du grimoire) aux
 * faits qu'il faut connaître pour les comprendre, aux indices qui enseignent ces faits, et aux endroits des scènes
 * de la campagne où ces indices se trouvent. Six notions distinctes, comme le demande le kit :
 *  - KnowledgeAtom : un fait ou une règle que le groupe peut apprendre ;
 *  - ClueDesign : une manière d'enseigner un ou plusieurs faits, sans donner la solution ;
 *  - ClueManifestation : l'occurrence concrète d'un indice dans le monde (cette page, ce mur) ;
 *  - SceneSlot : un endroit d'une scène où une manifestation peut se trouver ;
 *  - Gate (PuzzleInstance) : le verrou qui exige ces faits (une énigme du grimoire) ;
 *  - MysteryArc : l'ensemble.
 * Tout ceci est réservé au MJ ; les joueurs ne voient que ce qu'ils ont ramassé (carnet du groupe).
 */

export type Criticality = 'critical' | 'supporting' | 'enrichment' | 'optional';
export type Medium = 'journal' | 'fresque' | 'inscription' | 'dialogue' | 'objet' | 'schema' | 'experience' | 'environnement' | 'chant' | 'vision';
export type ArcStatus = 'draft' | 'verified' | 'scheduled' | 'running' | 'resolved' | 'abandoned';
/** Cycle de vie d'une manifestation. `withdrawn` : retirée avant d'être vue (reportée ailleurs). */
export type ManifestationState = 'slotted' | 'presented' | 'noticed' | 'inspected' | 'collected' | 'missed' | 'withdrawn' | 'destroyed';

export interface KnowledgeAtom {
  id: string;
  statement: string;
  criticality: Criticality;
  /** `local_observation` / `experiment` : on peut l'apprendre sur place, au verrou même. */
  discoverableBy: ('manifestation' | 'local_observation' | 'experiment' | 'dialogue')[];
  /** Compréhension déclarée par le MJ (jamais déduite des clics). */
  understood?: 'unknown' | 'suspected' | 'confirmed';
}

export interface ClueDesign {
  id: string;
  title: string;
  knowledgeAtomIds: string[];
  media: Medium;
  /** Ce que lisent ou voient les joueurs. */
  playerContent: string;
  /** Pourquoi cet indice existe (MJ seulement). */
  gmIntent?: string;
  /** Un seul exemplaire existe dans le monde (on ne le duplique pas : on en fait une copie distincte). */
  unique?: boolean;
  spoilerRisk?: 'low' | 'medium' | 'high';
}

export interface SceneSlot {
  id: string;
  /** Scène de la campagne. */
  sceneId: string;
  /** Où, dans la scène : « bibliothèque, rayon effondré », « journal de bord du capitaine »… */
  label: string;
  allowedMedia: Medium[];
  /** Scène facultative : un indice critique ne doit pas n'y figurer que là. */
  isOptional?: boolean;
  /** Emplacement de secours : réservé, jamais publié automatiquement. */
  isReserve?: boolean;
  capacity: number;
}

export interface ClueManifestation {
  id: string;
  clueDesignId: string;
  slotId: string;
  state: ManifestationState;
  /** D'où vient-il dans la fiction (justifie sa présence ici). */
  provenance?: string;
  /** Manifestation dont celle-ci prend le relais (report). */
  from?: string;
  /** Page du carnet du groupe, une fois ramassée. */
  clueId?: string;
  updatedAt?: number;
}

/** Verrou du mystère : une énigme du grimoire, rencontrée dans une scène, qui exige des faits. */
export interface Gate {
  id: string;
  title: string;
  puzzleId?: string;
  /** Scène où le groupe affronte le verrou pour la première fois (échéance des indices). */
  targetSceneId: string;
  /** Sur le chemin principal : il ne doit jamais bloquer la campagne. */
  criticalPath: boolean;
  requiredAtomIds: string[];
  /** Contournement à coût narratif, si le groupe n'a pas les faits. */
  bypass?: string;
  state?: 'locked' | 'solved' | 'bypassed' | 'destroyed';
}

export interface ArcEvent {
  id: string;
  /** Clé d'idempotence : la même action rejouée n'a pas d'effet de plus. */
  key: string;
  type: string;
  at: number;
  reason?: string;
  manifestationId?: string;
  detail?: string;
}

export interface MysteryArc {
  id: string;
  universeId?: string;
  campaignId?: string;
  title: string;
  /** La question du mystère, du point de vue du MJ. */
  synopsis?: string;
  status: ArcStatus;
  /** Ce que protège le verrou, qui l'a construit, pour qui. */
  intention?: string;
  pathKind?: 'critical_path' | 'optional_path' | 'world_secret';
  knowledgeAtoms: KnowledgeAtom[];
  clueDesigns: ClueDesign[];
  sceneSlots: SceneSlot[];
  manifestations: ClueManifestation[];
  gates: Gate[];
  events: ArcEvent[];
  createdAt?: number;
  updatedAt?: number;
}

/** Une scène de la campagne, telle que la voit le planificateur (ordre = chronologie prévue). */
export type SceneRef = { id: string; title?: string; played?: boolean };

export const MEDIA: { id: Medium; label: string }[] = [
  { id: 'journal', label: 'Journal, page, lettre' },
  { id: 'inscription', label: 'Inscription, gravure' },
  { id: 'fresque', label: 'Fresque, tableau' },
  { id: 'schema', label: 'Schéma, plan' },
  { id: 'objet', label: 'Objet' },
  { id: 'dialogue', label: 'Dialogue, témoignage' },
  { id: 'experience', label: 'Expérience, machine témoin' },
  { id: 'environnement', label: 'Observation du lieu' },
  { id: 'chant', label: 'Chant, récit oral' },
  { id: 'vision', label: 'Vision, rêve' },
];
export const MEDIUM_LABEL = Object.fromEntries(MEDIA.map((m) => [m.id, m.label])) as Record<Medium, string>;

export const CRITICALITY: { id: Criticality; label: string; help: string }[] = [
  { id: 'critical', label: 'Critique', help: 'Nécessaire pour comprendre une résolution incontournable.' },
  { id: 'supporting', label: 'Appui', help: 'Confirme une hypothèse, réduit l’ambiguïté.' },
  { id: 'enrichment', label: 'Enrichissement', help: 'Histoire, ambiance : sa perte ne bloque rien.' },
  { id: 'optional', label: 'Optionnel', help: 'Ouvre une solution ou une récompense de plus.' },
];

export const STATE_LABEL: Record<ManifestationState, string> = {
  slotted: 'prévu', presented: 'présenté', noticed: 'aperçu', inspected: 'examiné', collected: 'pris',
  missed: 'manqué', withdrawn: 'retiré (reporté)', destroyed: 'détruit',
};

export const READINESS_LABEL: Record<'READY' | 'AT_RISK' | 'BLOCKED' | 'UNKNOWN', string> = { READY: 'Prêt', AT_RISK: 'À risque', BLOCKED: 'Bloqué', UNKNOWN: 'Inconnu' };
