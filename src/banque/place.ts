/**
 * Peuples d'un lieu de la carte du monde (cité, ou bâtiment d'une cité), d'après les fiches : celle de la cité, son
 * champ « peuple », et celle du bâtiment. Hors carte du monde (Atlas des profondeurs…), rien : la banque n'y choisit pas.
 */
import type { MapRecord } from '../maps/mapStore';
import type { World } from '../maps/world/index';
import type { LoreEntry } from '../maps/world/lore';
import { npcImage, peoplesOf, type Peoples } from './index';

const text = (v: unknown): string => (typeof v === 'string' ? v : Array.isArray(v) ? v.map(text).join(' ') : v && typeof v === 'object' ? Object.values(v as object).map(text).join(' ') : '');
const entryText = (e: LoreEntry | undefined) => (e ? text([e.title, e.subtitle, e.shortSummary, e.body, e.sections]).slice(0, 6000) : '');

export function placePeoples(rec: MapRecord, planId: string, library: LoreEntry[] = []): Peoples | null {
  const world = rec.world as World | undefined;
  if (!world) return null;
  const prefix = `map-${rec.id}-c-`;
  if (!planId.startsWith(prefix)) return peoplesOf({ region: 'surface' });
  const cityId = planId.slice(prefix.length).split(':')[0];
  const city = world.cities.find((c) => c.id === cityId);
  const slotId = /^(.*:b\d+):int(?::(?:e1|cave))?$/.exec(planId)?.[1];
  const binding = slotId ? Object.values(world.bindings ?? {}).find((b) => b.slotId === slotId && !b.excluded) : undefined;
  const cityEntry = library.find((e) => e.id === city?.entryId);
  const placeEntry = library.find((e) => e.id === binding?.entryId);
  return peoplesOf({ people: city?.people, text: `${entryText(cityEntry)}\n${entryText(placeEntry)}`, region: 'surface' });
}

/** Jeton (ou portrait) d'un PNJ de la carte du monde, choisi dans la banque et cohérent avec son lieu. */
export function npcBankImage(rec: MapRecord, planId: string, library: LoreEntry[] | undefined, npc: { id: string; subtitle?: string }, vue: 'jeton' | 'portrait' = 'jeton', px = 128) {
  const peoples = placePeoples(rec, planId, library);
  if (!peoples) return undefined;
  return npcImage({ id: npc.id, role: npc.subtitle, peoples, vue, px });
}
