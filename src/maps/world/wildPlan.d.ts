/** Types du plan d'un lieu sauvage (wildPlan.js). */
import type { AtlasFeature, AtlasGeometry, AtlasMap } from '../atlas/types';
import type { WildRecord } from './generate';
export const WILD_W: number;
export const WILD_H: number;
export const WILD_SCALE: number;
export function generateWildPlan(w: WildRecord, planId: string, seed?: number): { map: AtlasMap; features: AtlasFeature[]; geometries: AtlasGeometry[] };
export function wildPlanId(wid: string, key: string): string;
