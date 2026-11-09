/**
 * Banque Loresmith dans l'application : catalogue (src/banque/catalogue.json, produit par scripts/banque/build.py),
 * retouches du MJ (gardées dans ce navigateur), adresses des images et choix cohérents pour les PNJ.
 */
import { useSyncExternalStore } from 'react';
import catalogue from './catalogue.json';
import { fitsGenres, GENRE_DEFAUT } from './genres';
import { bankUrl, hash, mipFor, norm, npcTraits, peoplesOf, pickPerson, replacementFor, tokenScale, withOverrides, type BankImage, type Peoples } from './banque';
import { mapStrings } from '../store/imageRefs';

export * from './banque';

const RAW = (catalogue as { images: BankImage[] }).images;
type Overrides = Record<string, Partial<BankImage>>;
/** Retouches partagées (serveur), gardées aussi ici pour travailler hors ligne. */
const SHARED_KEY = 'loresmith:banque:partage:v1';
/** Retouches pas encore envoyées (mode local, ou serveur injoignable) ; `null` : retouche à retirer. */
const PENDING_KEY = 'loresmith:banque:retouches:v1';

const readJson = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
const writeJson = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* stockage indisponible : valable pour la session */ } };

let shared: Overrides = readJson(SHARED_KEY, {});
/** Images que le MJ a ajoutées à son univers (ou à sa campagne en cours) : elles s'ajoutent au catalogue ici. */
let own: BankImage[] = [];
/** Compte administrateur de l'application (seul à retoucher les images communes) : su après la première synchronisation. */
let admin = false;
let pending: Record<string, Partial<BankImage> | null> = readJson(PENDING_KEY, {});
let overrides: Overrides = {};
let images: BankImage[] = RAW;
/** Toutes les images communes, tous genres confondus (page Banque, « tous les genres »). */
let allImages: BankImage[] = RAW;
/** Genres de l'univers ouvert : seules les images de ces genres (ou communes) sont proposées d'office. */
let genres: string[] = [GENRE_DEFAUT];
/** L'univers ouvert est-il un univers Underdark ? Sinon, aucune image de l'Outreterre n'est proposée d'office. */
let underdark = false;
const inScope = (i: BankImage) => fitsGenres(i, genres) && (underdark || (i.region ?? ['surface']).some((r) => r !== 'outreterre'));
const listeners = new Set<() => void>();

/** Images communes supprimées par l'administrateur : absentes partout, remplacées là où elles étaient posées. */
let deleted: BankImage[] = [];
/** Images du MJ retirées de son univers : leur adresse → celle de leur remplaçante. */
const ownRetired = new Map<string, string>();

function recompute() {
  overrides = { ...shared };
  for (const [id, p] of Object.entries(pending)) {
    if (p === null) delete overrides[id]; else overrides[id] = { ...overrides[id], ...p };
  }
  const all = withOverrides(RAW, overrides);
  deleted = all.filter((i) => i.supprime);
  allImages = [...all.filter((i) => !i.supprime), ...own];
  // Un univers futuriste ne voit pas de centaure : les images d'un autre genre restent au catalogue, hors des choix.
  images = [...all.filter((i) => !i.supprime && inScope(i)), ...own];
  retiredKey = `${deleted.map((i) => i.id).join(',')}|${[...ownRetired.keys()].length}`;
  listeners.forEach((f) => f());
}
let retiredKey = '';
recompute();

/** Catalogue courant (retouches comprises), limité aux genres de l'univers ouvert. */
export const bankImages = () => images;
export const bankAllImages = () => allImages;
/** Toutes les images, tous genres (page Banque). */
export function useBankAll(): BankImage[] {
  return useSyncExternalStore(subscribe, bankAllImages, bankAllImages);
}
/** Genres de l'univers ouvert (appelé par l'application quand l'univers change). */
export function setBankGenres(list: string[], isUnderdark = underdark) {
  const next = list.length ? list : [GENRE_DEFAUT];
  if (next.join(',') === genres.join(',') && isUnderdark === underdark) return;
  genres = next;
  underdark = isUnderdark;
  recompute();
}
/** L'univers ouvert est-il un univers Underdark (relié aux Archives de l'Underdark) ? */
export const bankUnderdark = () => underdark;
export const bankGenres = () => genres;
export const overridesOf = () => overrides;
/** Retouches pas encore partagées (compte non connecté, serveur injoignable). */
export const pendingCount = () => Object.keys(pending).length;
export const bankAdmin = () => admin;

/** Images propres à l'univers ouvert (Cartes) : remplacent celles de l'univers précédent. */
export function setUniverseBank(list: BankImage[]) {
  if (list.length === own.length && list.every((x, i) => x === own[i])) return;
  own = list;
  recompute();
}

/** Envoie les retouches en attente puis relit les retouches partagées (sans compte : rien ne change, tout reste ici). */
let running: Promise<'partage' | 'local'> | null = null;
export function syncBank(): Promise<'partage' | 'local'> {
  // Une seule synchronisation à la fois ; celle qui suit attend la précédente.
  running = (running ?? Promise.resolve('local' as const)).then(syncOnce, syncOnce);
  return running;
}
async function syncOnce(): Promise<'partage' | 'local'> {
  try {
    const { bankRetouches, currentAccount, putBankRetouche } = await import('../sync/client');
    const me = await currentAccount().catch(() => null) as { admin?: boolean } | null;
    admin = !!me && typeof me === 'object' && me.admin === true;
    for (const [id, p] of Object.entries(pending)) {
      // Un compte qui n'est pas administrateur ne change pas les images communes : sa retouche est abandonnée.
      if (admin) await putBankRetouche(id, p);
      const { [id]: _sent, ...rest } = pending; // eslint-disable-line @typescript-eslint/no-unused-vars
      pending = rest;
      writeJson(PENDING_KEY, pending);
    }
    const doc = await bankRetouches() as { retouches?: Overrides } | null;
    // Site sans API (mode local) : la réponse n'est pas du JSON ; on garde ce qu'on a.
    if (!doc || typeof doc !== 'object' || !doc.retouches || typeof doc.retouches !== 'object') throw new Error('Pas de serveur.');
    shared = doc.retouches;
    writeJson(SHARED_KEY, shared);
    recompute();
    return 'partage';
  } catch {
    recompute();
    return 'local';
  }
}

/** Retoucher les étiquettes d'une image commune (administrateur seulement) ; `null` : revenir au catalogue. */
export function setOverride(id: string, patch: Partial<BankImage> | null): Promise<'partage' | 'local'> {
  if (!admin) return Promise.resolve('local');
  pending = { ...pending, [id]: patch === null ? null : { ...(pending[id] ?? {}), ...patch } };
  writeJson(PENDING_KEY, pending);
  recompute();
  return syncBank();
}

// Au chargement : les retouches des autres MJ (sans compte ni serveur, rien ne se passe).
if (typeof window !== 'undefined') setTimeout(() => { void syncBank(); }, 1500);

const subscribe = (f: () => void) => { listeners.add(f); return () => listeners.delete(f); };
/** Le catalogue, qui se met à jour quand le MJ retouche une image. */
export function useBank(): BankImage[] {
  return useSyncExternalStore(subscribe, bankImages, bankImages);
}

const BASE = (import.meta.env?.BASE_URL as string | undefined) ?? '/';
/** Adresse de la version d'une image assez nette pour `px` pixels à l'écran (écrans haute densité compris). */
export function bankSrc(img: BankImage, px = 256): string {
  if (img.src) return img.src; // image ajoutée par le MJ : une seule version
  const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
  return bankUrl(img, mipFor(img, px, dpr), BASE);
}
export const bankById = (id: string | undefined | null) => (id ? images.find((i) => i.id === id) ?? null : null);

/** Une adresse d'image vient-elle de la banque ? (jetons : on les dessine entiers et orientés, sans médaillon). */
export const isBankSrc = (src: string | undefined) => {
  const img = bankImageOf(src);
  // Image du catalogue retirée depuis (jeton enregistré dans un ancien combat) : on la dessine comme un jeton.
  return img ? img.vue === 'jeton' : !!src && /\/banque\/(personnages|creatures)\//.test(src) && src.endsWith('.webp');
};

/**
 * Image d'un PNJ (portrait ou jeton), cohérente avec le lieu et avec lui-même :
 * - `role` (sous-titre), `name`, `desc`, `genre`, `peuple` : son genre (strict) et son peuple, d'après sa fiche ou son
 *   prénom (npcTraits) ;
 * - `placeText`, `people`, `region` ou `peoples` : les peuples du lieu, quand le sien n'est pas connu ;
 * - `pose` : 'couche' pour un dormeur dans son lit ; sinon, jamais de personnage assis, agenouillé ou couché.
 * Renvoie l'adresse, ou undefined plutôt qu'un intrus.
 */
export function npcImage(o: NpcQuery): string | undefined {
  const img = npcPick(o);
  return img ? bankSrc(img, o.px ?? 128) : undefined;
}

export type NpcQuery = {
  id: string; role?: string; name?: string; desc?: string; genre?: 'f' | 'm'; peuple?: string; pose?: string;
  placeText?: string; people?: string; region?: string; vue?: 'portrait' | 'jeton'; px?: number; peoples?: Peoples;
  /** Images déjà prises dans la même scène : évitées tant qu'il reste un autre choix cohérent. */
  exclude?: Set<string>;
};

/** Même choix que npcImage, mais renvoie l'image de la banque elle-même. */
export function npcPick({ id, role, name, desc, genre, peuple, pose, placeText, people, region = 'surface', vue = 'jeton', peoples, exclude }: NpcQuery): BankImage | null {
  const pe = peoples ?? peoplesOf({ text: placeText, people, region });
  const traits = npcTraits({ name, role, desc });
  const g = genre ?? traits.genre;
  const own = peuple ?? traits.peuple;
  // Son peuple d'abord (s'il n'est pas proscrit du lieu), puis ceux du lieu ; son rôle d'abord, puis n'importe quel rôle.
  // Dans une scène, une image déjà prise n'est reprise qu'en tout dernier recours.
  const tries: Parameters<typeof pickPerson>[1][] = [];
  if (own && !(pe.banned ?? []).includes(own)) tries.push({ peuple: own, role }, { peuple: own });
  tries.push({ role }, {});
  const pick = (v: 'jeton' | 'portrait') => {
    for (const ex of exclude?.size ? [exclude, undefined] : [undefined]) {
      for (const t of tries) {
        const got = pickPerson(images, { ...t, vue: v, peoples: pe, seed: id, genre: g, pose, exclude: ex, region });
        if (got) return got;
      }
    }
    return null;
  };
  // Le portrait et le jeton d'un même PNJ montrent la même personne : on tire le jeton, puis on prend son portrait jumeau.
  const token = pick('jeton');
  if (vue === 'jeton') return token;
  // La fiche montre la même personne que le jeton : son portrait jumeau, sinon le jeton lui-même (jamais un sosie).
  const twin = bankById(token?.paire);
  if (twin && !twin.exclu) return twin;
  return token ?? pick('portrait');
}

/** Image de la banque derrière une adresse (catalogue : `/banque/personnages/<id>-<taille>.webp` ; ajout du MJ : sa source). */
export function bankImageOf(src: string | undefined): BankImage | null {
  if (!src) return null;
  const m = /\/banque\/(?:personnages|creatures)\/(.+)-\d+\.webp$/.exec(src);
  return m ? bankById(m[1]) : own.find((i) => i.src === src) ?? null;
}

/**
 * Un jeton peut-il tourner sur lui-même ? Oui s'il est pris à la verticale ; un jeton incliné (visage visible) reste
 * droit, sinon sa perspective penche de travers sur un plan vu de haut.
 */
/** Échelle d'un jeton (1 : humain adulte debout) : tous les personnages sont dessinés à la même échelle. */
export const tokenScaleOf = (src: string | undefined) => { const img = bankImageOf(src); return img ? tokenScale(img) : 1; };

/** Pose dessinée sur l'image d'un jeton ('couche', 'assis', 'agenouille'), ou undefined : debout. */
export const poseOf = (src: string | undefined) => bankImageOf(src)?.pose;

export const turnsFreely = (src: string | undefined) => bankImageOf(src)?.angle !== 'incline';

/**
 * Image de face d'un jeton (fiche, carte d'information) : le portrait jumeau d'un jeton de la banque, sinon un
 * portrait de la banque qui lui ressemble (même peuple, même rôle, même genre, toujours le même pour ce jeton), ou
 * l'image elle-même si c'est déjà un portrait. undefined : ce n'est pas une image de la banque.
 */
export function faceOf(src: string | undefined, px = 512): string | undefined {
  const img = bankImageOf(src);
  if (!img) return undefined;
  if (img.vue === 'portrait') return src;
  const twin = bankById(img.paire);
  if (twin && twin.vue === 'portrait' && !twin.exclu) return bankSrc(twin, px);
  // Personnage sans portrait jumeau : pas de visage d'emprunt (ce serait quelqu'un d'autre) ; la fiche montre le jeton.
  return undefined;
}

/** Jeton vu de dessus d'une image de la banque : le jeton jumeau d'un portrait, ou l'image si c'est déjà un jeton. */
export function topOf(src: string | undefined, px = 128): string | undefined {
  const img = bankImageOf(src);
  if (!img) return src;
  if (img.vue === 'jeton') return src;
  const twin = bankById(img.paire);
  return twin && twin.vue === 'jeton' ? bankSrc(twin, px) : src;
}

/** Fiches SRD du plateau (identifiant anglais) → nom de la créature dans la banque. */
const SRD_FR: Record<string, string> = {
  'giant-spider': 'Araignée géante', 'bat-swarm': 'Nuée de chauves-souris', 'giant-centipede': 'Mille-pattes géant', grick: 'Grick',
  darkmantle: 'Mante obscure', 'gelatinous-cube': 'Cube gélatineux', otyugh: 'Otyugh', 'umber-hulk': 'Horreur fouisseuse', roper: 'Roper',
};

/**
 * Jeton de créature de la banque pour un monstre du plateau, d'après son nom (« Otyugh 2 », « Araignée géante
 * chasseuse ») ou sa fiche SRD : le nom de créature le plus long contenu dans le sien l'emporte. Toujours la même image
 * pour un même nom. `region` : le ou les mondes du plateau ('surface', 'outreterre') ; une créature d'un autre monde
 * n'est jamais prise, et sans monde connu, rien n'est choisi. undefined : aucune créature ne convient.
 */
export function creatureToken(name: string | undefined, statId: string | undefined, region: string | string[] | undefined, px = 128, vue: 'jeton' | 'portrait' = 'jeton'): string | undefined {
  const worlds = region ? (Array.isArray(region) ? region : [region]) : [];
  if (!worlds.length) return undefined;
  const base = norm(name ?? '').replace(/\s+\d+$/, '').trim();
  const words = ` ${base.replace(/[^a-z0-9]+/g, ' ')} `;
  const fromStat = statId ? norm(SRD_FR[statId] ?? '') : '';
  let best: BankImage[] = [], len = 0;
  for (const img of images) {
    if (img.type !== 'creature' || img.vue !== vue || img.exclu || !(img.region ?? ['surface']).some((w) => worlds.includes(w))) continue;
    const n = norm(img.nom).replace(/[^a-z0-9]+/g, ' ').trim();
    if (!n) continue;
    const hit = words.includes(` ${n} `) || (fromStat && n === fromStat.replace(/[^a-z0-9]+/g, ' ').trim());
    if (!hit) continue;
    if (n.length > len) { best = [img]; len = n.length; } else if (n.length === len) best.push(img);
  }
  if (!best.length) return undefined;
  // Un jeton qui a son portrait jumeau d'abord : la fiche montrera exactement la même créature.
  const twinned = vue === 'jeton' ? best.filter((i) => bankById(i.paire)) : [];
  const list = twinned.length ? twinned : best;
  return bankSrc(list[hash(base || statId || '') % list.length], px);
}

/* ——— Suppression et remplacement ——— */

/** Images communes supprimées (pour les rétablir). */
export const bankDeleted = () => deleted;
/** L'image qui prendra la place de celle-ci là où elle est posée. */
export const bankReplacement = (img: BankImage | null | undefined) => replacementFor(images, img);

/**
 * Retire une image du MJ de la banque de son univers : ses emplacements prendront l'image la plus proche.
 * (Le retrait de l'asset lui-même est fait par l'appelant.)
 */
export function retireOwn(img: BankImage) {
  if (!img.src) return;
  const repl = replacementFor(images.filter((i) => i.id !== img.id), img);
  if (repl) ownRetired.set(img.src, bankSrc(repl, 512));
  recompute();
}

const BANK_URL = /banque\/(?:textures|elements|personnages|creatures)\/([a-z0-9-]+)-(\d+)\.webp/g;

/** Une adresse (ou un texte) avec les images supprimées remplacées par leurs remplaçantes. */
export function rewriteBankString(s: string): string {
  if (ownRetired.has(s)) return ownRetired.get(s)!;
  if (!deleted.length || !s.includes('banque/')) return s;
  return s.replace(BANK_URL, (all, id: string, size: string) => {
    const gone = deleted.find((d) => d.id === id);
    const repl = gone && replacementFor(images, gone);
    if (!repl) return all;
    const mips = repl.mips?.length ? repl.mips : [256, 512, 1024];
    return bankUrl(repl, mips.find((m) => m >= Number(size)) ?? mips[mips.length - 1], '');
  });
}

/** Clé qui change quand une image est supprimée, rétablie ou retirée : relance la réécriture du grimoire. */
export function useBankRetired(): string {
  return useSyncExternalStore(subscribe, () => retiredKey, () => retiredKey);
}

/** Collections du grimoire où une image de la banque peut être posée (cartes, portraits, jetons, combat…). */
const HOLDERS = ['maps', 'assets', 'npcs', 'characters', 'libraryEntries', 'campaigns', 'combat'] as const;

/** Changements à apporter au grimoire pour remplacer les images supprimées ; null s'il n'y a rien à faire. */
export function bankRewriteState(state: Record<string, unknown>): Record<string, unknown> | null {
  if (!deleted.length && !ownRetired.size) return null;
  const patch: Record<string, unknown> = {};
  for (const k of HOLDERS) {
    if (!state[k]) continue;
    const next = mapStrings(state[k], rewriteBankString);
    if (next !== state[k]) patch[k] = next;
  }
  return Object.keys(patch).length ? patch : null;
}

/**
 * Facteur (≤ 1) qui empêche d'étirer une image au-delà de sa résolution d'origine : dessinée sur `px` pixels d'écran,
 * elle ne dépasse jamais sa plus grande version (au-delà, elle cesserait d'être nette). Image d'un MJ : pas de limite.
 */
export function noUpscale(img: { mips?: number[]; src?: string }, px: number): number {
  if (img.src || !img.mips?.length) return 1;
  const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
  const native = Math.max(...img.mips) / dpr;
  return px > native ? native / px : 1;
}
