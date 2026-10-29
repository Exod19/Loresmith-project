/** Types des Chroniques du Combat (le module est en JavaScript pur pour être testé par `node --test`). */
export type NarrationResult = 'miss' | 'hit' | 'critical_fail' | 'critical_hit' | 'killing_blow' | 'legendary';
export type NarrationEntry = {
  id: string; collection: string; result: NarrationResult; tone: string; rarity: string; length: string; text: string;
  tags: { weapons: string[]; creatures: string[]; anatomies: string[]; environments?: string[]; damageTypes?: string[] };
  conditions: Record<string, unknown>; implied: string[]; body: { blood: boolean; bone: boolean; flesh: boolean };
};
export type NarrationLibrary = {
  entries: NarrationEntry[]; invalid: { id: string; collection: string; reason: string }[]; counts: Record<string, number>;
  policy: { antiRepeatRecentIds: number; rarityWeights: Record<string, number>; toneWeights: Record<string, number> };
  expected: Record<string, number>;
};
export type NarrationContext = {
  result: NarrationResult; weapon: string | null; creature: string | null; anatomy: string; damageType: string | null; damage?: number;
  crit?: boolean; isKillingBlow?: boolean; targetIsBoss?: boolean; lastEnemy?: boolean; allyDown?: boolean; targetHitAttackerLastRound?: boolean;
  attackerHealthBand?: string; round?: number; consecutiveHits?: number; consecutiveMisses?: number;
  environment?: string; weather?: string; lighting?: string;
};
export type Narration = { id: string; text: string; result: NarrationResult; collection: string; tone: string; rarity: string; fallback: boolean };
export type NarrationHistory = { campaign: string[]; combats: Record<string, { ids: string[]; streaks: Record<string, { hits: number; misses: number }>; hits: { from: string; to: string; round: number }[]; at?: number }> };
export type NarrationOptions = { humor?: boolean; short?: boolean };

export const RESULTS: NarrationResult[];
export function invalidReason(e: unknown): string | null;
export function buildLibrary(collections: Record<string, unknown>, manifest?: object): NarrationLibrary;
export function weaponKindOf(attack: { name?: string; type?: string } | null | undefined): string | null;
export function creatureOf(statId?: string): string | null;
export function anatomyOf(statId?: string, meta?: string): string;
export function damageTypeOf(type?: string): string | null;
export function classify(f: { hit: boolean | null; crit?: boolean; fumble?: boolean; isKillingBlow?: boolean; targetIsBoss?: boolean }): NarrationResult;
export function eligible(e: NarrationEntry, ctx: NarrationContext, result: NarrationResult, opts?: NarrationOptions): boolean;
export function selectNarration(lib: NarrationLibrary, ctx: NarrationContext, o?: { recent?: string[]; rng?: () => number; opts?: NarrationOptions }): Narration;
export function renderNarration(text: string, names: { attacker: string; target: string }): string;
export function displayName(name: string, statId?: string, statName?: string): string;
export function emptyHistory(): NarrationHistory;
export function recentIds(h: NarrationHistory, combatKey: string): string[];
export function remember(h: NarrationHistory, combatKey: string, n: Narration, f: { result: NarrationResult; attackerId: string; targetId: string; round: number }): NarrationHistory;
export function streakFacts(h: NarrationHistory, combatKey: string, attackerId: string, targetId: string, round: number): { consecutiveHits: number; consecutiveMisses: number; targetHitAttackerLastRound: boolean };
export function importanceOf(result: NarrationResult): 'minor' | 'major' | 'epic';
