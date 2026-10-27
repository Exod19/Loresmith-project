/** Types des utilitaires de PNJ & Créatures (entityGen.js), pour les modules TypeScript. */
import type { Stat } from '../maps/atlas/statblocks';
export function findSrd(name: string): Stat | null;
export function proficiencyForCr(cr: unknown): number;
export function xpForCr(cr: unknown): number | null;
