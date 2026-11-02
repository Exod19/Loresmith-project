/** Types des références d'images stockées à part (imageRefs.js). */
export const REF_PREFIX: string;
export function isDataImage(v: unknown): v is string;
export function isRef(v: unknown): v is string;
export function refOf(id: string): string;
export function idOfRef(ref: string): string;
export function mapStrings<T>(value: T, fn: (s: string) => string): T;
export function collectStrings(value: unknown, test: (s: string) => boolean): string[];
export function hasDataImages(state: unknown): boolean;
export function dataUrlToBlob(dataUrl: string): Blob;
export function blobToDataUrl(blob: Blob): Promise<string>;
export function imageIdOf(blob: Blob): Promise<string>;
export function extractImages<T>(state: T, put: (id: string, blob: Blob) => Promise<unknown> | unknown, cache?: Map<string, string>): Promise<T>;
export function resolveRefs<T>(state: T, urlOf: (id: string) => string | undefined): T;
export function toRefs<T>(state: T, idOfUrl: (url: string) => string | undefined): T;
export function inlineRefs<T>(state: T, get: (id: string) => Promise<Blob | null | undefined>): Promise<T>;
export function fitWithin(width: number, height: number, max: number): { width: number; height: number };
export const IMAGE_MAX: { portrait: number; illustration: number; carte: number };
