import type { Clock } from './clock';
export type EventKind = 'incendie' | 'destruction' | 'mort' | 'cadavre' | 'vol' | 'effraction' | 'agression' | 'humiliation' | 'aide' | 'alliance' | 'abandon' | 'decouverte' | 'rumeur' | 'autre';
export type EventRole = 'auteurs' | 'temoins' | 'victimes' | 'aucun';
export type EventPlace = { planId?: string; featureId?: string; title: string };
/** Événement de la mémoire du monde ; `at` : minutes depuis le Jour 1 à minuit. */
export interface WorldEvent {
  id: string; at: number; title: string; text?: string; kind: EventKind; place?: EventPlace; npcs?: string[];
  joueurs: EventRole; gravite: 1 | 2 | 3; source: 'mj' | 'notes' | 'jeu';
}
export type EventDraft = Partial<Omit<WorldEvent, 'id' | 'at'>> & { title: string; hoursAgo?: number };
export const EVENT_KINDS: Record<EventKind, { label: string; icon: string }>;
export const ROLES: Record<EventRole, string>;
export const GRAVITY: Record<1 | 2 | 3, string>;
export function newEvent(clock: Clock, e: EventDraft, id?: string): WorldEvent;
export function eventWhen(ev: WorldEvent, clock: Clock): { label: string; ago: string };
export function eventsOf(world: { events?: WorldEvent[] } | undefined, planIds?: string[]): WorldEvent[];
export function eventsPrompt(notes: string, ctx?: { places?: string[]; npcs?: string[]; now?: string }): { system: string; user: string };
export function parseEvents(text: string, places?: { title: string; planId: string; featureId?: string }[]): EventDraft[];
