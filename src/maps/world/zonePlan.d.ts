import type { AtlasMap } from '../atlas/types';
export const ZONE_W: number;
export const ZONE_H: number;
export const ZONE_KM: number;
export const ZONE_SCALE: number;
export function zonePlanId(wid: string, key: string): string;
export function zoneKey(km: [number, number]): string;
export function zoneBox(km: [number, number]): [number, number, number, number];
export function zoneAt(km: [number, number], p: [number, number]): [number, number];
export function generateZonePlan(z: { key: string; km: [number, number]; title: string }, planId: string, env: {
  sample: (x: number, y: number) => { forest: number; e: number; biome: string; moist: number; water?: boolean };
  rivers?: [number, number][][]; roads?: [number, number][][]; lakes?: [number, number][][];
  sites?: { key: string; km: [number, number]; kind: string }[]; seed?: number;
}): AtlasMap;
