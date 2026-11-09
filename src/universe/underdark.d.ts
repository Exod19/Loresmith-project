/** Types du périmètre de l'Underdark (voir underdark.js). */
export function isUnderdarkUniverse(u: { archives?: string } | null | undefined): boolean;
export function underdarkSpecific(entry: Record<string, unknown> | null | undefined): boolean;
export function mentionsUnderdark(text: unknown): boolean;
export function scopedEntries<T>(universe: { archives?: string } | null | undefined, entries?: T[]): T[];
