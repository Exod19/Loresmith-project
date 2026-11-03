export function visitKeys(planId?: string): string[];
export function changesSince(world: unknown, key: string, from: number, to: number): { dm: string[]; players: string[] };
export type Retour = { key: string; from: number; to: number; ago: string; dm: string[]; players: string[] };
export function arrive(world: unknown, planId: string, leaving?: string, minGap?: number): { visits: Record<string, number>; retour?: Retour };
