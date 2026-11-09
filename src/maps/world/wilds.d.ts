/** Types des lieux sauvages de la carte du monde (wilds.js). */
import type { FeatureCategory } from '../atlas/types';
import type { Relief } from './terrain';

export type Teneur = 'ambiance' | 'scene' | 'quete';
export type Danger = 'calme' | 'incertain' | 'dangereux' | 'perilleux';
/** Un lieu sauvage tiré au sort (brouillon) : sa case, sa place (km), son type, sa teneur et ses textes. */
export interface WildSite {
  key: string; km: [number, number]; kind: string; label: string; cat: FeatureCategory; title: string;
  teneur: Teneur; danger: Danger; text: string; scene?: string; hook?: string;
  biome: string; e: number; road: number; forest: number;
  near?: { name: string; km: number; dir: string };
  /** Petit lieu (coin de forêt, ruisseau…) tiré au zoom rapproché. */
  nook?: boolean;
}
export type WildDensity = 'rare' | 'normale' | 'riche';
export const DENSITY_LABEL: Record<WildDensity, string>;
export interface WildContext { density?: WildDensity; seed: number; relief: Relief; cities: { name: string; km: [number, number]; r: number }[]; roads?: [number, number][][]; lakes?: [number, number][][] }

export const WILD_CELL: number;
export const TENEURS: Record<Teneur, string>;
export const DANGERS: Danger[];
export const DANGER_LABEL: Record<Danger, string>;
export const WILD_KINDS: { id: string; label: string; cat: FeatureCategory }[];
export function wildKey(i: number, j: number, k: number): string;
export function wildSitesIn(ctx: WildContext, box: [number, number, number, number], skip?: Set<string>): WildSite[];
export function cellSites(ctx: WildContext, i: number, j: number, skip?: Set<string>): WildSite[];
export function whereLabel(s: Pick<WildSite, 'near'>): string;
export function kindLabel(id: string): string;
/** Ce qu'on voit d'un lieu depuis la route : distance (km), DD de Perception passive s'il est caché, phrase ({c} : côté). */
export function sightOf(site: { key: string; kind: string; biome?: string; e?: number }, forest?: number): { km: number; dc?: number; line: string };
export const NOOK_CELL: number;
/** Petits lieux (ruisseaux, sentiers, vieux chênes…) des cases d'un km qui touchent la fenêtre (km). */
export function nookSitesIn(ctx: WildContext, box: [number, number, number, number], skip?: Set<string>): WildSite[];
/** N'importe quel point en pleine nature, pour y entrer : un sous-bois ou une étendue. */
export function spotSite(ctx: WildContext, km: [number, number], label?: string): WildSite | null;
