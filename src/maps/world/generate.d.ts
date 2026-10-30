/** Types du générateur de la carte du monde (src/maps/world/generate.js, JavaScript pur). */
import type { AtlasAnchor, AtlasData, AtlasFeature, AtlasGeometry, AtlasMap, FeatureCategory, Importance, MapSurface } from '../atlas/types';

export const CITY_W: number;
export const CITY_H: number;
export const WORLD_W: number;
export const WORLD_H: number;
export const WORLD_SCALE: number;

export type SlotType = 'chateau' | 'temple' | 'guilde' | 'caserne' | 'auberge' | 'taverne' | 'ecurie' | 'forge' | 'entrepot' | 'echoppe' | 'atelier' | 'manoir' | 'ferme' | 'maison';
export type District = 'chateau' | 'haute' | 'marche' | 'ville' | 'faubourg' | 'ferme';

export const SLOT_TYPES: Record<SlotType, { label: string; category: FeatureCategory; rank: Importance }>;

/** Paramètres d'une cité, lus sur sa fiche ou saisis par le MJ. `at` : position sur le plan monde (0–1). */
export interface CitySpec {
  id: string; name: string; seed?: number; population?: number; people?: string;
  walls?: boolean; castle?: boolean; highTown?: boolean; faubourgs?: boolean; farms?: boolean; river?: boolean; village?: boolean;
  /** Fiche de lieu d'où vient la cité. */
  entryId?: string;
  at?: [number, number];
}

/** Un lieu du lore posé sur un emplacement d'une cité. */
export interface Binding {
  entryId: string; cityId: string; slotId: string; type: SlotType; district?: District | null;
  title: string; summary?: string; npcs?: { id: string; name: string; role?: string; desc?: string }[];
  /** Type et quartier demandés par la fiche lors de l'assignation (une fiche modifiée peut déplacer un lieu non découvert). */
  hint: string;
  /** Contradiction signalée au MJ : la fiche demande un autre quartier, mais le lieu est déjà découvert. */
  conflict?: string;
  /** Fiche supprimée : le lieu reste en place (signalé, jamais supprimé). */
  orphan?: boolean;
  /** Le MJ a retiré ce lieu de la carte : il n'est plus posé, et la fiche n'est plus reprise. */
  excluded?: boolean;
}

/** `interiors` : bâtiments où l'on est entré (identifiants d'emplacement) ; chacun a son plan intérieur. */
/** Moment de la journée : qui est là dans les bâtiments, et la lumière des plans. */
export type Period = 'matin' | 'jour' | 'soir' | 'nuit';
/** Occupant dont le MJ a créé la fiche : il reste à cet endroit (niveau, coordonnées 0–1), à toute heure. */
export interface Resident { id: string; name: string; role?: string; desc?: string; level: 'rdc' | 'etage' | 'cave'; at: [number, number] }
export interface WorldSpec { seed: number; name: string; cities: CitySpec[]; bindings: Record<string, Binding>; interiors?: string[]; time?: Period; residents?: Record<string, Resident[]> }

/** Emplacement : position (0–1 et mètres), empreinte (mètres), orientation et façade (où donne la porte). */
export interface Slot { id: string; type: SlotType; label?: string; district: District; at: [number, number]; x: number; y: number; w: number; d: number; ang: number; face: number }

/** Sol d'un plan de surface : voir MapSurface (atlas/types.ts). */
export type Surface = MapSurface;
export type Ground = MapSurface['ground'];

export interface CityResult {
  spec: Required<Pick<CitySpec, 'id' | 'name' | 'seed' | 'population' | 'people' | 'walls' | 'castle' | 'highTown' | 'faubourgs' | 'farms' | 'river' | 'village'>> & CitySpec;
  map: AtlasMap; features: AtlasFeature[]; geometries: AtlasGeometry[]; anchors: AtlasAnchor[]; slots: Slot[];
  gates: { i: number; a: number; dir: string; name: string; anchorId: string }[];
  stats: { radius: number; buildings: number; intra: number; fields: number; trees: number; streets: number };
}

export function hashSeed(text: string): number;
export function rng(seed: number): () => number;
export function citySpecDefaults(spec: CitySpec): CityResult['spec'];
export function generateCity(spec: CitySpec, planId: string, bindings?: Record<string, Binding>): CityResult;
export function worldPlanId(mapRecordId: string): string;
export function cityPlanId(mapRecordId: string, cityId: string): string;
export function placeCity(world: Pick<WorldSpec, 'seed' | 'cities'>, cityId: string): [number, number];
export function generateWorld(world: WorldSpec, mapRecordId: string): AtlasData & { villages?: CitySpec[] };
export function citySlots(spec: CitySpec, planId: string): Slot[];
export function interiorPlanId(slotId: string): string;
export function rasterGround(surface: Surface, W: number, H: number, win: { x0: number; y0: number; w: number; h: number }, cols: number, rows: number, seed?: number): string;
