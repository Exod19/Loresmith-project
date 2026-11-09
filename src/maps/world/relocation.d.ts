export type Relocation = { to: { id: string; title: string } | null; label: string; who: string; text: string; host: boolean };
export function relocationOf(b: { id: string; title: string; type?: string }, etat: string | undefined, residents?: string[],
  city?: { sameType?: { id: string; title: string }[]; market?: { id: string; title: string } }): Relocation | null;
export function returnOf(b: { id: string; title: string; type?: string }, residents?: string[]): string;
