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

/** Identifiant de la liaison d'un univers aux Archives de l'Underdark (champ `archives` de l'univers). */
export const UNDERDARK_LINK = 'underdark';

/** Clé du réglage « adresse du fichier des Archives » (laisse vide : fichier livré avec l'application). */
export const ARCHIVES_URL_KEY = 'loresmith:archives-url';

function feedUrl(): string {
  try {
    const custom = localStorage.getItem(ARCHIVES_URL_KEY)?.trim();
    if (custom) return custom;
  } catch {
    // Stockage indisponible : on garde le fichier livré.
  }
  return `${import.meta.env.BASE_URL}feeds/underdark.json`;
}

let cache: Promise<UnderdarkFeed> | null = null;

/** Charge le fichier une seule fois (cache mémoire). */
export function loadUnderdarkFeed(): Promise<UnderdarkFeed> {
  cache ??= fetch(feedUrl(), { cache: 'no-cache' }).then((r) => {
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
  return {
    feed, error,
    /** Relit le fichier, met l'écran à jour et renvoie la version reçue (`null` en cas d'erreur). */
    reload: () => reloadUnderdarkFeed().then((f) => { setFeed(f); return f; }).catch((e: Error) => { setError(e.message); return null; }),
  };
}

/** Type de bibliothèque de Loresmith pour chaque type de fiche des Archives. */
const LIBRARY_TYPE: Record<string, string> = {
  personnage: 'person', divinite: 'person', peuple: 'faction', faction: 'faction', lieu: 'place', habitat: 'place',
  evenement: 'event', cycle: 'event', objet: 'artifact', rituel: 'artifact', source: 'document',
  creature: 'vivant', flore: 'vivant', fungus: 'vivant',
};

/** Copie modifiable d'une fiche des Archives, pour la bibliothèque d'une campagne. */
export function toLibraryEntry(e: FeedEntry, id: string, related: { id: string; name: string; kind: string }[] = [], now = Date.now()) {
  return {
    id,
    sourceId: e.id,
    archiveType: LIBRARY_TYPE[e.type] ?? 'document',
    title: e.name,
    subtitle: e.scientificName ?? '',
    shortSummary: e.summary,
    /** Texte intégral, aplati : sert à la reformulation IA. La lecture utilise `sections`. */
    body: e.sections.map((s) => `${s.title}\n\n${s.body}`).join('\n\n'),
    sections: e.sections.map((s) => ({ id: s.id, title: s.title, body: s.body })),
    params: e.params.filter((p) => p.value),
    altNames: e.altNames.map((a) => a.value),
    canon: e.status,
    related,
    readAloud: '',
    origin: 'Archives de l’Underdark',
    historicalContext: '', currentLocation: '', owner: '', campaignUse: '', secrets: '',
    tags: [...(e.tags ?? []), FEED_TYPE_LABEL[e.type] ?? e.type].filter(Boolean),
    imagePrompt: '',
    roughNotes: '',
    linkedCampaignIds: [] as string[],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Fiches, liens et images de bibliothèque pour des fiches des Archives (toutes, ou `ids`).
 * Identifiants stables (arc-<id>, arc-img-…) : un second import ne crée rien en double.
 * L'image garde le chemin publié : elle n'est pas copiée dans le navigateur.
 */
export function archiveBundle(feed: UnderdarkFeed, universeId: string, ids?: string[]) {
  const names = new Map(feed.entries.map((e) => [e.id, e.name]));
  const chosen = ids ? feed.entries.filter((e) => ids.includes(e.id)) : feed.entries;
  const entries = chosen.map((e) => {
    const related = feed.relations
      .filter((r) => r.from === e.id || r.to === e.id)
      .map((r) => { const other = r.from === e.id ? r.to : r.from; return { id: `arc-${other}`, name: names.get(other) ?? other, kind: r.kind }; })
      .filter((r) => names.has(r.id.replace(/^arc-/, '')));
    return { ...toLibraryEntry(e, `arc-${e.id}`, related), universeId };
  });
  const assets = chosen.flatMap((e) => e.images.map((img) => ({
    id: `arc-img-${e.id}-${img.id}`, name: img.caption || img.alt || e.name, category: 'library', targetType: 'library',
    targetId: `arc-${e.id}`, dataUrl: img.src, source: 'archives', prompt: img.caption ?? '', createdAt: 0, universeId,
  })));
  return { entries, assets };
}
