/** Types des tuiles tactiques (voir tiles.js). */
import type { TerrainId } from '../maps/battle/surface';
export function classifyPixel(r: number, g: number, b: number, ford?: boolean): TerrainId;
export function tileCells(data: ArrayLike<number>, w: number, h: number, cols: number, rows: number, ford?: boolean): TerrainId[];
export function isFordTile(img: { id?: string; nom?: string } | null | undefined): boolean;
