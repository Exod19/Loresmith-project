/** Types des lieux sauvages de l'Underdark (deepWilds.js). */
import type { FeatureCategory } from './types';
export interface DeepSite {
  key: string; planId: string; at: [number, number]; kind: string; label: string; cat: FeatureCategory; title: string;
  teneur: 'ambiance' | 'scene' | 'quete'; danger: string; text: string; scene?: string; hook?: string; trailId: string;
}
export function deepSitesOn(plan: { planId: string; trails: { id: string; trace?: string; pts: [number, number][] }[]; caves?: [number, number][][]; points?: [number, number][]; density?: 'rare' | 'normale' | 'riche' }, skip?: Set<string>): DeepSite[];
export function deepSightOf(site: { key: string; kind: string }): { reach: number; dc?: number; line: string };
export const DEEP_KINDS: { id: string; label: string; cat: FeatureCategory }[];
