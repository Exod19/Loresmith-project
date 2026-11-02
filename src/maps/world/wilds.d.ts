/** Types des lieux sauvages de la carte du monde (wilds.js). */
import type { FeatureCategory } from '../atlas/types';
import type { Relief } from './terrain';

export type Teneur = 'ambiance' | 'scene' | 'quete';
export type Danger = 'calme' | 'incertain' | 'dangereux' | 'perilleux';
/** Un lieu sauvage tiré au sort (brouillon) : sa case, sa place (km), son type, sa teneur et ses textes. */
export interface WildSite {
  key: string; km: [number, number]; kind: string; label: string; cat: FeatureCategory; title: string;
  teneur: Teneur; danger: Danger; text: string; scene?: string; hook?: string;
  biome: string; e: number; road: number;
  near?: { name: string; km: number; dir: string };
}
export interface WildContext { seed: number; relief: Relief; cities: { name: string; km: [number, number]; r: number }[]; roads?: [number, number][][] }

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
