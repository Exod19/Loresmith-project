/** Types du terrain naturel des plans de cité (naturalTerrain.js). */
export type Rgb = [number, number, number];
export interface Palette { grassA: Rgb; grassB: Rgb; bare: Rgb; dirt: Rgb; paving: Rgb }
export interface Road { points: number[][]; width: number }
export interface Plaza { points: number[][] }
export type Segment = [number, number, number, number, number];
export interface Terrain {
  sample(x: number, y: number, detail?: number, near?: Segment[], plazas?: Plaza[], micro?: number): Rgb;
  segmentsNear(x0: number, y0: number, x1: number, y1: number): Segment[];
  segments: Segment[];
}
export function hash(x: number, y: number, s: number): number;
export function noise(x: number, y: number, s: number): number;
export function roadDistance(x: number, y: number, segs: Segment[]): number;
export function polygonDistance(x: number, y: number, pts: number[][]): number;
export function paletteOf(opts?: { climate?: string; season?: string; snow?: number }): Palette;
export function createTerrain(opts: { seed: number; roads?: Road[]; plazas?: Plaza[]; palette?: Palette }): Terrain;
export function paintTile(terrain: Terrain, plazas: Plaza[], x0: number, y0: number, size: number, px: number): Uint8ClampedArray;
