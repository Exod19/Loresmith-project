import type { BankImage } from './index';
export function farmyardSprites(ground: unknown, scale: number, images: BankImage[], ctx?: { climat?: string; saison?: string }, seed?: string):
  { key: string; img: BankImage; x: number; y: number; w: number; h: number; a: number }[];
