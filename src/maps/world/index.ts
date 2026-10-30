/**
 * Carte du monde : raccord entre le générateur (generate.js, lore.js) et l'application.
 * Une carte « monde » ne stocke que ses paramètres (graine, cités, lieux posés) ; son dessin est recalculé à la demande,
 * identique d'une fois à l'autre, puis traité comme l'Atlas des profondeurs par le reste de l'application.
 */
import { useEffect, useRef } from 'react';
import { cityPlanId, generateWorld, hashSeed, interiorPlanId, placeCity, worldPlanId, type CitySpec, type WorldSpec } from './generate';
import { citySpecFromEntry, isSettlement, syncBindings, type LoreEntry } from './lore';
import type { AtlasData } from '../atlas/types';
import type { MapRecord } from '../mapStore';

export { cityPlanId, interiorPlanId, worldPlanId };
export type World = NonNullable<MapRecord['world']>;

/** L'Atlas et la carte du monde partagent la même mécanique (lieux à révéler, chemins, brouillard, combat). */
export const isAtlasLike = (rec: Pick<MapRecord, 'kind'> | null | undefined) => !!rec && rec.kind !== 'custom';

const EMPTY_WORLD: World = { seed: 1, name: 'Le Monde', cities: [], bindings: {} };
const cache = new Map<string, AtlasData>();
/** Jeu de données d'une carte du monde (mis en cache : il ne change que si ses paramètres changent). */
export function worldAtlas(rec: MapRecord): AtlasData {
  const world = rec.world ?? EMPTY_WORLD;
  // La position du personnage du MJ ne change pas le dessin : elle n'entre pas dans la clé.
  const key = `${rec.id}|${JSON.stringify({ ...world, avatar: world.avatar && { ...world.avatar, at: undefined } })}`;
  let d = cache.get(key);
  if (!d) {
    d = generateWorld(world as WorldSpec, rec.id) as AtlasData;
    cache.set(key, d);
    if (cache.size > 6) cache.delete(cache.keys().next().value!);
  }
  return d;
}

/** Données source d'une carte : la carte du monde générée, ou l'Atlas des Archives (`feedAtlas`). */
export function sourceAtlas(rec: MapRecord, feedAtlas?: AtlasData | null): AtlasData {
  return (rec.kind === 'monde' ? worldAtlas(rec) : feedAtlas) as AtlasData;
}

/** Nouvelle carte du monde pour un univers. */
export function newWorldRecord(universe: { id: string; name: string }, id: string): MapRecord {
  const now = Date.now();
  return {
    id, universeId: universe.id, kind: 'monde', title: `Monde · ${universe.name}`,
    description: 'Carte du monde générée : cités, routes, bâtiments, et les lieux du lore à mesure qu’ils sont créés.',
    world: { seed: hashSeed(`monde:${universe.id}:${id}`), name: universe.name, cities: [], bindings: {} },
    createdAt: now, updatedAt: now,
  };
}

/** Ajoute une cité au monde, à une place qui ne bouge plus ensuite. La première cité devient la cité par défaut du lore. */
export function withCity(world: World, spec: CitySpec): World {
  const cities = world.cities.filter((c) => c.id !== spec.id);
  const at = spec.at ?? placeCity({ seed: world.seed, cities }, spec.id);
  return { ...world, cities: [...cities, { ...spec, at }], defaultCityId: world.defaultCityId ?? spec.id };
}

/** Cité tirée d'une fiche de lieu (paramètres lus sur la fiche). */
export const cityFromEntry = (entry: LoreEntry): CitySpec => citySpecFromEntry(entry);

/** Fiches de lieu qui décrivent une cité, pas encore sur la carte. */
export function settlementEntries(world: World, library: LoreEntry[]): LoreEntry[] {
  const used = new Set(world.cities.map((c) => c.entryId ?? c.id));
  return library.filter((e) => e.archiveType === 'place' && !used.has(e.id) && isSettlement(e));
}

/**
 * Garde la carte du monde à jour avec le lore : chaque fiche de lieu rattachée à une cité y prend un bâtiment,
 * avec les PNJ qui s'y trouvent. N'écrit que si quelque chose a changé.
 */
export function useWorldSync(rec: MapRecord, library: LoreEntry[] | undefined, people: LoreEntry[] | undefined, onUpdate: (patch: Partial<MapRecord>) => void) {
  const update = useRef(onUpdate);
  update.current = onUpdate;
  const revealedKey = (rec.overlay?.revealed ?? []).join('|');
  useEffect(() => {
    if (rec.kind !== 'monde' || !rec.world || !library) return;
    const places = library.filter((e) => e.archiveType === 'place');
    // Les hameaux de la carte accueillent aussi les lieux du lore qui les nomment.
    const villages = (worldAtlas(rec) as AtlasData & { villages?: CitySpec[] }).villages ?? [];
    const { bindings, changed } = syncBindings({
      world: { ...rec.world, cities: [...rec.world.cities, ...villages] }, mapRecordId: rec.id, places, people: [...(people ?? []), ...library.filter((e) => e.archiveType === 'person')],
      revealed: new Set(rec.overlay?.revealed ?? []),
    });
    if (changed) update.current({ world: { ...rec.world, bindings }, updatedAt: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.kind, rec.id, rec.world, library, people, revealedKey]);
}
