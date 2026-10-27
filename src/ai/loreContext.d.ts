/** Types des utilitaires de contexte de lore (loreContext.js), pour les modules TypeScript. */
export function norm(s: unknown): string;
export function words(s: unknown): string[];
export const LORE_RULES: string;
export function atlasPlaces(feed: unknown, limit?: number): { id: string; title: string; category: string; plan: string; summary: string }[];
export function feedFor(universe: unknown): Promise<unknown>;
export function buildLoreContext(opts: Record<string, unknown>): string;
