/**
 * Peuples d'un lieu de la carte du monde (cité, ou bâtiment d'une cité), d'après les fiches : celle de la cité, son
 * champ « peuple », et celle du bâtiment. Hors carte du monde (Atlas des profondeurs…), rien : la banque n'y choisit pas.
 */
import type { MapRecord } from '../maps/mapStore';
import type { World } from '../maps/world/index';
import type { LoreEntry } from '../maps/world/lore';
import { bankImageOf, bankImages, bankSrc, npcImage, npcPick, peoplesOf, topOf, type BankImage, type Peoples } from './index';
import { npcTraits } from './banque';

const text = (v: unknown): string => (typeof v === 'string' ? v : Array.isArray(v) ? v.map(text).join(' ') : v && typeof v === 'object' ? Object.values(v as object).map(text).join(' ') : '');
const entryText = (e: LoreEntry | undefined) => (e ? text([e.title, e.subtitle, e.shortSummary, e.body, e.sections]).slice(0, 6000) : '');

export function placePeoples(rec: MapRecord, planId: string, library: LoreEntry[] = []): Peoples | null {
  const world = rec.world as World | undefined;
  if (!world) return null;
  const prefix = `map-${rec.id}-c-`;
  if (!planId.startsWith(prefix)) return peoplesOf({ region: 'surface' });
  const cityId = planId.slice(prefix.length).split(':')[0];
  const city = world.cities.find((c) => c.id === cityId);
  const slotId = /^(.*:b\d+):int(?::(?:e1|cave))?$/.exec(planId)?.[1];
  const binding = slotId ? Object.values(world.bindings ?? {}).find((b) => b.slotId === slotId && !b.excluded) : undefined;
  const cityEntry = library.find((e) => e.id === city?.entryId);
  const placeEntry = library.find((e) => e.id === binding?.entryId);
  return peoplesOf({ people: city?.people, text: `${entryText(cityEntry)}\n${entryText(placeEntry)}`, region: 'surface' });
}

/** Jeton (ou portrait) d'un PNJ de la carte du monde, choisi dans la banque et cohérent avec son lieu. */
export function npcBankImage(rec: MapRecord, planId: string, library: LoreEntry[] | undefined, npc: NpcLike, vue: 'jeton' | 'portrait' = 'jeton', px = 128) {
  const peoples = placePeoples(rec, planId, library);
  if (!peoples) return undefined;
  // Sa fiche, s'il en a une : son genre et son peuple y sont écrits (champs, ou texte).
  const entry = npc.entryId ? (library ?? []).find((e) => e.id === npc.entryId) as (LoreEntry & Record<string, unknown>) | undefined : undefined;
  const t = entry ? npcTraits({ name: npc.title, role: npc.subtitle, desc: entryText(entry), gender: entry.gender as string | undefined, race: (entry.race ?? entry.species ?? entry.people) as string | undefined }) : {};
  return npcImage({
    id: npc.id, role: npc.subtitle, name: npc.title, desc: npc.summary, genre: npc.genre ?? t.genre, peuple: npc.peuple ?? t.peuple,
    pose: npc.pose, peoples, vue, px,
  });
}

/** Ce qu'il faut d'un PNJ posé sur un plan pour lui choisir une image (un lieu `pnj-…` de l'Atlas). */
export type NpcLike = { id: string; title?: string; subtitle?: string; summary?: string; entryId?: string; genre?: 'f' | 'm'; peuple?: string; pose?: string };

/** Ce que la banque choisirait pour ce PNJ (mêmes critères que npcBankImage), en évitant `exclude`. */
function npcBankPick(rec: MapRecord, planId: string, library: LoreEntry[] | undefined, npc: NpcLike, exclude?: Set<string>) {
  const peoples = placePeoples(rec, planId, library);
  if (!peoples) return null;
  const entry = npc.entryId ? (library ?? []).find((e) => e.id === npc.entryId) as (LoreEntry & Record<string, unknown>) | undefined : undefined;
  const t = entry ? npcTraits({ name: npc.title, role: npc.subtitle, desc: entryText(entry), gender: entry.gender as string | undefined, race: (entry.race ?? entry.species ?? entry.people) as string | undefined }) : {};
  return npcPick({ id: npc.id, role: npc.subtitle, name: npc.title, desc: npc.summary, genre: npc.genre ?? t.genre, peuple: npc.peuple ?? t.peuple, pose: npc.pose, peoples, vue: 'jeton', exclude });
}

type Bestiary = { id: string; token?: string }[];
const sceneMemo = new Map<string, Map<string, { src?: string; img?: BankImage }>>();

/**
 * Jetons de tous les PNJ d'une scène (un plan), répartis pour qu'aucune image ne serve deux fois tant que la banque
 * offre un autre choix cohérent (genre, peuple, rôle, pose). Ordre stable : les PNJ du lore d'abord, puis les autres,
 * chacun par identifiant ; un PNJ qui a son propre jeton (bestiaire, image de fiche) le garde et le réserve.
 */
export function sceneTokens(rec: MapRecord, planId: string, library: LoreEntry[] | undefined, bestiary: Bestiary, features: (NpcLike & { image?: string })[]) {
  const npcs = features.filter((f) => f.id.startsWith(`${planId}:pnj-`) && !f.id.slice(planId.length + 1).includes(':'));
  const images = bankImages();
  const key = `${planId}|${npcs.map((f) => `${f.id}/${f.pose ?? ''}/${f.image ?? ''}`).join(',')}`;
  const hit = sceneMemo.get(key);
  if (hit && memoImages === images && memoLibrary === library && memoBestiary === bestiary) return hit;
  if (memoImages !== images || memoLibrary !== library || memoBestiary !== bestiary) { sceneMemo.clear(); memoImages = images; memoLibrary = library; memoBestiary = bestiary; }
  const out = new Map<string, { src?: string; img?: BankImage }>();
  const used = new Set<string>();
  const order = [...npcs].sort((a, b) => Number(a.id.includes(':pnj-gen-')) - Number(b.id.includes(':pnj-gen-')) || a.id.localeCompare(b.id));
  // Les jetons imposés d'abord : ils sont réservés.
  for (const f of order) {
    const own = bestiary.find((r) => r.id === f.entryId)?.token ?? topOf(f.image);
    if (own) { out.set(f.id, { src: own }); const b = bankImageOf(own); if (b) used.add(b.id); }
  }
  for (const f of order) {
    if (out.has(f.id)) continue;
    const img = npcBankPick(rec, planId, library, f, used);
    if (img) used.add(img.id);
    out.set(f.id, { img: img ?? undefined });
  }
  sceneMemo.set(key, out);
  if (sceneMemo.size > 40) sceneMemo.delete(sceneMemo.keys().next().value!);
  return out;
}
let memoImages: unknown = null, memoLibrary: unknown = null, memoBestiary: unknown = null;

/**
 * Jeton vu de dessus d'un PNJ posé sur un plan (`<plan>:pnj-…`), le même que sur la carte de combat : son jeton propre
 * (fiche du bestiaire), l'image de sa fiche ramenée à son jeton jumeau, ou un jeton de la banque cohérent avec le lieu.
 * `features` : les lieux de la scène, pour qu'aucun jeton ne serve deux fois (sceneTokens).
 */
export function npcToken(rec: MapRecord, planId: string, library: LoreEntry[] | undefined, bestiary: Bestiary, f: NpcLike & { image?: string }, px = 256, features?: (NpcLike & { image?: string })[]) {
  if (!f.id.startsWith(`${planId}:pnj-`)) return undefined;
  if (features) {
    const got = sceneTokens(rec, planId, library, bestiary, features).get(f.id);
    if (got) return got.src ?? (got.img ? bankSrc(got.img, px) : undefined);
  }
  const ref = bestiary.find((r) => r.id === f.entryId);
  return ref?.token ?? topOf(f.image, px) ?? npcBankImage(rec, planId, library, f, 'jeton', px);
}
