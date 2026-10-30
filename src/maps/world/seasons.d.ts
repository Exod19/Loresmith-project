import type { Season } from './generate';
type Climate = 'froid' | 'tempere' | 'chaud';
export const SEASONS: Record<Season, string>;
export const SNOW_LINE: Record<Season, number>;
export function snowOf(season: Season | undefined, climate: Climate): { snow?: number; frozen?: 'tout' | 'rivieres' };
export function crowdFactor(season: Season | undefined, type: string): number;
export function homeBonus(season: Season | undefined): number;
export function seasonLine(roleKey: string, season: Season | undefined, climate: Climate | undefined, rand: () => number): string | undefined;
export function greets(roleKey: string): boolean;
