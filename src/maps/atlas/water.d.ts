/** Types des eaux des plans de navigation (water.js). */
export interface WaterShape { pts: number[]; hw?: number; closed?: boolean }
export interface WaterScene { rivers: { d: string; hw: number }[]; lakes: { d: string }[]; bounds: [number, number, number, number] | null }
export interface Step { width: number; opacity: number }
export function pathOf(flat: number[] | null | undefined, closed?: boolean): string;
export function waterScene(ground: { water?: WaterShape[] } | null | undefined): WaterScene;
export function depthSteps(hw: number, steps?: number): Step[];
export function shoreSteps(band: number, steps?: number): Step[];
export function waterMaterials(opts?: { climate?: string; kind?: string }): { shallow: string[]; deep: string[] };
export function bankColor(opts?: { climate?: string; snow?: number; sea?: boolean }): string;
