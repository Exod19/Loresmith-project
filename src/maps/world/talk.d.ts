import type { Season } from './generate';
export type Proposal = { type: 'lieu' | 'pnj' | 'rumeur' | 'fait'; title: string; text: string };
export type TalkLine = { from: 'avatar' | 'npc'; text: string };
export type TalkCtx = { season?: Season; climate?: 'froid' | 'tempere' | 'chaud'; time?: string };
export const PROPOSAL_TYPES: Record<Proposal['type'], string>;
export function npcSystemPrompt(p: {
  npc: { name: string; role?: string; summary?: string }; fiche?: string; place?: { title: string; type?: string; summary?: string };
  city?: { name: string; population?: number }; ctx?: TalkCtx; avatar?: { name?: string; role?: string; desc?: string }; mode?: 'reverie' | 'chronique'; lore?: string;
}): string;
export function npcUserPrompt(history: TalkLine[], said: string, avatarName?: string, npcName?: string): string;
export function parseNpcReply(text: string): { say: string; proposals: Proposal[] };
export function chronicleOf(p: {
  avatar?: { name?: string }; npc: { name: string; role?: string }; place?: { title: string }; city?: { name: string };
  ctx?: TalkCtx; history: TalkLine[]; accepted?: Proposal[];
}): { title: string; summary: string };
