import type { WorldEvent } from './worldEvents';
export type PlaceState = 'ruine' | 'chantier' | 'reconstruit' | 'delaisse';
export type Attitude = 'rancune' | 'peur' | 'reconnaissance';
/** Suite d'un événement : appliquée d'elle-même (`auto`), proposée au MJ (`propose`), acceptée ou refusée. */
export interface Suite {
  id: string; at: number; text: string; big: boolean; variant?: string;
  state?: { lieu?: PlaceState; attitude?: Attitude; enquete?: boolean };
  status: 'auto' | 'propose' | 'accepte' | 'refuse';
}
type W = { clock?: import('./clock').Clock; events?: WorldEvent[] };
export function dueSuites(ev: WorldEvent, now: number): Suite[];
export function evolve<T extends W>(world: T): { world: T; fresh: (Suite & { eventId: string })[] };
export function passTime<T extends W>(world: T, minutes: number): T;
export function decide<T extends W>(world: T, eventId: string, suiteId: string, status: 'accepte' | 'refuse'): T;
export function pending(world: W): (Suite & { eventId: string; event: WorldEvent })[];
export function placeStates(world: W): Record<string, { etat: PlaceState; depuis: number; title: string; eventId: string }>;
export function npcMemories(world: W): Record<string, { attitude?: Attitude; souvenirs: string[] }>;
export function rumorsIn(world: W, cityPlanId: string): { at: number; text: string }[];
export function newName(title: string): string;
export const ATTITUDE_LABEL: Record<Attitude, string>;
export const PLACE_STATE_LABEL: Record<PlaceState, string>;
export function the(title: string): string;
export function ofPlace(title: string): string;
