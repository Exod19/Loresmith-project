/**
 * Banque Loresmith dans l'application : catalogue (src/banque/catalogue.json, produit par scripts/banque/build.py),
 * retouches du MJ (gardées dans ce navigateur), adresses des images et choix cohérents pour les PNJ.
 */
import { useSyncExternalStore } from 'react';
import catalogue from './catalogue.json';
import { bankUrl, mipFor, npcTraits, peoplesOf, pickPerson, tokenScale, withOverrides, type BankImage, type Peoples } from './banque';

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
const listeners = new Set<() => void>();

function recompute() {
  overrides = { ...shared };
  for (const [id, p] of Object.entries(pending)) {
    if (p === null) delete overrides[id]; else overrides[id] = { ...overrides[id], ...p };
  }
  images = [...withOverrides(RAW, overrides), ...own];
  listeners.forEach((f) => f());
}
recompute();

/** Catalogue courant (retouches comprises). */
export const bankImages = () => images;
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
  return img ? img.vue === 'jeton' : !!src && src.includes('/banque/personnages/') && src.endsWith('.webp');
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
export function npcPick({ id, role, name, desc, genre, peuple, pose, placeText, people, region = 'surface', vue = 'jeton', px = 128, peoples, exclude }: NpcQuery): BankImage | null {
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
        const got = pickPerson(images, { ...t, vue: v, peoples: pe, seed: id, genre: g, pose, exclude: ex });
        if (got) return got;
      }
    }
    return null;
  };
  // Le portrait et le jeton d'un même PNJ montrent la même personne : on tire le jeton, puis on prend son portrait jumeau.
  const token = pick('jeton');
  if (vue === 'jeton') return token;
  const twin = bankById(token?.paire);
  if (twin && !twin.exclu) return twin;
  const face = token ? bankImageOf(faceOf(bankSrc(token, px), px)) : null;
  return face ?? pick('portrait');
}

/** Image de la banque derrière une adresse (catalogue : `/banque/personnages/<id>-<taille>.webp` ; ajout du MJ : sa source). */
export function bankImageOf(src: string | undefined): BankImage | null {
  if (!src) return null;
  const m = /\/banque\/personnages\/(.+)-\d+\.webp$/.exec(src);
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
  // Même genre obligatoire (une tavernière ne prend pas le visage d'un cuisinier) ; le peuple, puis le rôle, ensuite.
  const pool = img.genre ? images.filter((i) => !i.genre || i.genre === img.genre) : images;
  const like = pickPerson(pool, { vue: 'portrait', peuple: img.peuple, role: (img.roles ?? []).join(' '), genre: img.genre, seed: img.id, peoples: peoplesOf({}) })
    ?? pickPerson(pool, { vue: 'portrait', role: (img.roles ?? []).join(' '), genre: img.genre, seed: img.id, peoples: { main: [...new Set(pool.map((i) => i.peuple).filter(Boolean))] as string[], others: [], banned: [] } });
  return like ? bankSrc(like, px) : undefined;
}

/** Jeton vu de dessus d'une image de la banque : le jeton jumeau d'un portrait, ou l'image si c'est déjà un jeton. */
export function topOf(src: string | undefined, px = 128): string | undefined {
  const img = bankImageOf(src);
  if (!img) return src;
  if (img.vue === 'jeton') return src;
  const twin = bankById(img.paire);
  return twin && twin.vue === 'jeton' ? bankSrc(twin, px) : src;
}
