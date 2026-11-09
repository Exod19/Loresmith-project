export type LootItem = { label: string; kind: 'equipement' | 'objet' | 'vivres' | 'monnaie' | 'indice' };
export type Loot = { items: LootItem[]; harvest?: { skill: string; dc: number; items: string[] }; note?: string; summary: string };
export type LootSubject = {
  id?: string; name?: string; meta?: string; ac?: string; cr?: string; actions?: [string, string][];
  ref?: { loot?: string[]; ecology?: { diet?: string } } | null;
};
export function crOf(cr?: string): number;
export function natureOf(meta?: string, name?: string): string;
export function gearOf(c: { ac?: string; actions?: [string, string][] }, r?: () => number): LootItem[];
export function purseOf(cr: number, r: () => number, deep?: boolean): string | null;
export function lootOf(c: LootSubject, opts?: { region?: 'surface' | 'outreterre'; seed?: string }): Loot;
