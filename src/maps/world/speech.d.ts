export type Speech = { ok: boolean; how: 'parole' | 'telepathie' | null; why: string; languages: string };
export function canSpeak(stat: { languages?: string; abil?: number[]; meta?: string } | undefined | null): Speech;
export function creatureVoice(stat: { languages?: string; abil?: number[]; meta?: string } | undefined, speak?: Speech): string;
