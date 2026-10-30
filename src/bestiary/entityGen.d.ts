/** Types des utilitaires de PNJ & Créatures (entityGen.js), pour les modules TypeScript. */
import type { Stat } from '../maps/atlas/statblocks';
export function findSrd(name: string): Stat | null;
export function proficiencyForCr(cr: unknown): number;
export function xpForCr(cr: unknown): number | null;
/** Complète une fiche de PNJ ou de créature avec les valeurs par défaut (voir entityGen.js). */
export function normalizeEntity(d: Record<string, unknown>, mode: 'npc' | 'monster'): Record<string, unknown> & { name: string };
