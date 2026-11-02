/** Types des outils d'images (images.js). */
export function archiveSrc(src: string): string;
export function archiveSrc(src: string | null | undefined): string | null | undefined;
export function compressImage(src: string, opts?: { max?: number; quality?: number }): Promise<string>;
export function fileToCompressed(file: Blob, opts?: { max?: number; quality?: number }): Promise<string>;
export function makeToken(src: string, opts?: { size?: number; hostile?: boolean }): Promise<string>;
export function archiveImageIndex(feed: unknown): unknown;
export function matchArchiveImages(names: string[], index: unknown): string[];
export function matchPortrait(names: string[], index: unknown): string | undefined;
export const CLANS: Record<string, unknown>;
export function clanPaintBrief(feed: unknown, clanKey: string): string;
export function generatePortrait(ai: unknown, prompt: string, paint?: string): Promise<string>;
