/**
 * Réécriture d'un univers de surface où de l'Underdark s'est glissé : chaque fiche et chaque scène qui nomme un lieu de
 * l'Underdark est réécrite par l'IA pour cet univers (mêmes rôles dramatiques, lieux de surface), d'un seul coup.
 * L'original est gardé (`avantReecriture`) : « Rétablir l'original » le remet tel quel.
 */
import { askAI, parseJson } from '../ai/client';
import { mentionsUnderdark, underdarkSpecific } from './underdark';

type Universe = { name?: string; tone?: string; lore?: string; genres?: string[] };
export type Entry = { id: string; title?: string; subtitle?: string; shortSummary?: string; body?: string; sourceId?: string; archiveType?: string; avantReecriture?: Record<string, unknown> };
export type Scene = { id: string; title?: string; location?: string; summary?: string; expanded?: unknown };
export type Campaign = { id: string; title?: string; scenes?: Scene[]; avantReecriture?: Record<string, Scene> };

const clip = (s: unknown, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

function system(u: Universe) {
  return [
    `Tu réécris du contenu de jeu de rôle pour l'univers « ${u.name ?? 'sans nom'} » (ton : ${u.tone || 'libre'} ; genres : ${(u.genres ?? ['fantasy']).join(', ')}).`,
    "Ce contenu nomme par erreur l'Underdark (Outreterre, Hosten Valak, Atlas des profondeurs, strates, Moriquendi, drows et créatures des profondeurs) : cet univers se joue à la surface et n'a aucun lien avec l'Underdark.",
    "Remplace chaque lieu, peuple ou élément de l'Underdark par un équivalent plausible de cet univers de surface (une porte de ville, des caves, des catacombes, une guilde…), en gardant la fonction dramatique, les PNJ, les enjeux, les indices et la longueur.",
    "Ne mentionne jamais l'Underdark ni aucun de ses noms. Réponds en français, en JSON, avec exactement les mêmes clés que l'entrée.",
    u.lore ? `Canon de l'univers (à respecter) : ${clip(u.lore, 2500)}` : '',
  ].filter(Boolean).join('\n');
}

/** Réécrit une fiche de lieu (ou autre) ; renvoie le patch à appliquer, original compris. */
export async function rewriteEntry(u: Universe, e: Entry) {
  const src = { title: e.title ?? '', subtitle: e.subtitle ?? '', shortSummary: e.shortSummary ?? '', body: clip(e.body, 6000) };
  const out = parseJson<Partial<typeof src>>(await askAI(system(u), JSON.stringify(src), { json: true, maxTokens: 3000 }));
  if (!out?.title) throw new Error(`Réponse illisible pour « ${e.title} ».`);
  const patch: Partial<Entry> = { title: String(out.title), subtitle: String(out.subtitle ?? ''), shortSummary: String(out.shortSummary ?? ''), body: String(out.body ?? '') };
  if (underdarkSpecific({ ...patch } as Record<string, unknown>)) throw new Error(`L'IA a gardé l'Underdark dans « ${e.title} ».`);
  return { ...patch, sourceId: undefined, avantReecriture: e.avantReecriture ?? { title: e.title, subtitle: e.subtitle, shortSummary: e.shortSummary, body: e.body, sourceId: e.sourceId } };
}

/** Une scène nomme-t-elle l'Underdark ? (titre, lieu, résumé ou contenu développé) */
export const sceneHasUnderdark = (s: Scene) => mentionsUnderdark(`${s.title} ${s.location} ${s.summary} ${JSON.stringify(s.expanded ?? '')}`);

/** Réécrit les scènes d'une campagne qui nomment l'Underdark ; renvoie le patch de la campagne (originaux gardés). */
export async function rewriteCampaign(u: Universe, c: Campaign) {
  const scenes = [...(c.scenes ?? [])];
  const backup: Record<string, Scene> = { ...(c.avantReecriture ?? {}) };
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (!sceneHasUnderdark(s)) continue;
    const src = { title: s.title ?? '', location: s.location ?? '', summary: s.summary ?? '', expanded: s.expanded ?? null };
    const out = parseJson<Partial<typeof src>>(await askAI(system(u), JSON.stringify(src), { json: true, maxTokens: 6000 }));
    if (!out?.title) throw new Error(`Réponse illisible pour la scène « ${s.title} ».`);
    const next: Scene = { ...s, title: String(out.title), location: String(out.location ?? ''), summary: String(out.summary ?? ''), expanded: out.expanded ?? s.expanded };
    if (sceneHasUnderdark(next)) throw new Error(`L'IA a gardé l'Underdark dans la scène « ${s.title} ».`);
    backup[s.id] = backup[s.id] ?? s;
    scenes[i] = next;
  }
  return { scenes, avantReecriture: backup };
}

/** Remet les originaux d'une campagne réécrite. */
export function restoreCampaign(c: Campaign) {
  const b = c.avantReecriture ?? {};
  return { scenes: (c.scenes ?? []).map((s) => b[s.id] ?? s), avantReecriture: undefined };
}

/** Remet l'original d'une fiche réécrite. */
export const restoreEntry = (e: Entry) => ({ ...(e.avantReecriture ?? {}), avantReecriture: undefined });
