/** Types de l'ancrage du lore sur la carte du monde (src/maps/world/lore.js). */
import type { Near } from './generate';
import type { Binding, CitySpec, District, Slot, SlotType, WorldSpec } from './generate';

/** Fiche (de la Bibliothèque ou PNJ) : seuls les champs lus ici sont typés. */
export type LoreEntry = { id: string; title?: string; name?: string; archiveType?: string; createdAt?: number; sourceId?: string; [k: string]: unknown };

export const DISTRICT_LABEL: Record<District, string>;
export function norm(s: unknown): string;
export function isSettlement(entry: LoreEntry): boolean;
export function parsePopulation(entry: LoreEntry): number | null;
export function citySpecFromEntry(entry: LoreEntry): CitySpec;
export function classifyPlace(entry: LoreEntry): { type: SlotType; district: District | null } | null;
export function coreName(title: string): string;
export function npcsOf(place: LoreEntry, people: LoreEntry[]): { id: string; name: string; role?: string }[];
export function pickSlot(slots: Slot[], cls: { type: SlotType; district: District | null }, entryId: string, taken: Set<string>): Slot | null;
export function cityOf(place: LoreEntry, cities: CitySpec[], defaultCityId?: string): CitySpec | null;
export function syncBindings(p: {
  world: WorldSpec & { defaultCityId?: string }; mapRecordId: string; places: LoreEntry[]; people?: LoreEntry[]; revealed?: Set<string>;
}): { bindings: Record<string, Binding>; changed: boolean };
export function nearFromText(t: string): Near[] | undefined;
