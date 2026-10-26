/**
 * Pont Archives de l'Underdark → Loresmith (sens unique).
 *
 * Le fichier public/feeds/underdark.json est produit par Fl-au-Bestiaire (scripts/feed/export-underdark.mjs)
 * et ne contient que le niveau public. Loresmith le lit, ne l'écrit jamais, et garde ses propres copies
 * (bibliothèque, cartes) : une synchronisation ne modifie que ce qui vient des Archives.
 */
import { useEffect, useState } from 'react';
import type { AtlasData } from '../maps/atlas/types';

export interface FeedSection { id: string; title: string; body: string }
export interface FeedImage { id: string; src: string; caption?: string; alt?: string; credit?: string }
export interface FeedEntry {
  id: string; type: string; name: string; scientificName?: string; summary: string; status: string;
  tags: string[]; params: { label: string; value: string }[]; altNames: { lang: string; value: string }[];
  sections: FeedSection[]; images: FeedImage[];
}
export interface FeedRelation { id: string; from: string; to: string; kind: string; note?: string; status: string }
export interface UnderdarkFeed {
  format: 'underdark-feed'; version: number; generatedAt: string; filter: string;
  counts: { entries: number; relations: number; atlasFeatures: number; images: number };
  entries: FeedEntry[]; relations: FeedRelation[]; atlas: AtlasData; images: string[];
}

/** Libellés des types de fiches, tels qu'affichés dans les Archives. */
export const FEED_TYPE_LABEL: Record<string, string> = {
  creature: 'Bestiaire', flore: 'Flore', fungus: 'Fungi', peuple: 'Peuples', faction: 'Factions',
  personnage: 'Personnages', divinite: 'Divinités', lieu: 'Lieux', habitat: 'Habitats', evenement: 'Événements',
  cycle: 'Cycles', composante: 'Composantes', concept: 'Concepts', rituel: 'Rituels', objet: 'Objets', source: 'Sources',
};

const URL_PATH = `${import.meta.env.BASE_URL}feeds/underdark.json`;
let cache: Promise<UnderdarkFeed> | null = null;

/** Charge le fichier une seule fois (cache mémoire). */
export function loadUnderdarkFeed(): Promise<UnderdarkFeed> {
  cache ??= fetch(URL_PATH, { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error(`Archives indisponibles (${r.status})`);
    return r.json() as Promise<UnderdarkFeed>;
  });
  return cache;
}

/** Relit le fichier depuis le serveur : c'est la synchronisation. */
export function reloadUnderdarkFeed(): Promise<UnderdarkFeed> {
  cache = null;
  return loadUnderdarkFeed();
}

/** Hook : renvoie le fichier une fois chargé, `null` pendant le chargement, ou une erreur. */
export function useUnderdarkFeed() {
  const [feed, setFeed] = useState<UnderdarkFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadUnderdarkFeed().then((f) => alive && setFeed(f)).catch((e: Error) => alive && setError(e.message));
    return () => { alive = false; };
  }, []);
  return { feed, error, reload: () => reloadUnderdarkFeed().then(setFeed).catch((e: Error) => setError(e.message)) };
}

/** Type de bibliothèque de Loresmith pour chaque type de fiche des Archives. */
const LIBRARY_TYPE: Record<string, string> = {
  personnage: 'person', divinite: 'person', peuple: 'faction', faction: 'faction', lieu: 'place', habitat: 'place',
  evenement: 'event', cycle: 'event', objet: 'artifact', rituel: 'artifact', source: 'document',
};

/** Copie modifiable d'une fiche des Archives, pour la bibliothèque d'une campagne. */
export function toLibraryEntry(e: FeedEntry, id: string, now = Date.now()) {
  return {
    id,
    archiveType: LIBRARY_TYPE[e.type] ?? 'document',
    title: e.name,
    subtitle: e.scientificName ?? '',
    shortSummary: e.summary,
    body: e.sections.map((s) => `${s.title}\n\n${s.body}`).join('\n\n'),
    origin: 'Archives de l’Underdark',
    historicalContext: '', currentLocation: '', owner: '', campaignUse: '', secrets: '',
    tags: [...(e.tags ?? []), FEED_TYPE_LABEL[e.type] ?? e.type].filter(Boolean),
    imagePrompt: '',
    roughNotes: `Copie des Archives (fiche ${e.id}), à réviser pour la campagne.`,
    linkedCampaignIds: [] as string[],
    createdAt: now,
    updatedAt: now,
  };
}
