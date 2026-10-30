/**
 * Banque Loresmith dans l'application : catalogue (src/banque/catalogue.json, produit par scripts/banque/build.py),
 * retouches du MJ (gardées dans ce navigateur), adresses des images et choix cohérents pour les PNJ.
 */
import { useSyncExternalStore } from 'react';
import catalogue from './catalogue.json';
import { bankUrl, mipFor, peoplesOf, pickPerson, withOverrides, type BankImage, type Peoples } from './banque';

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
let pending: Record<string, Partial<BankImage> | null> = readJson(PENDING_KEY, {});
let overrides: Overrides = {};
let images: BankImage[] = RAW;
const listeners = new Set<() => void>();

function recompute() {
  overrides = { ...shared };
  for (const [id, p] of Object.entries(pending)) {
    if (p === null) delete overrides[id]; else overrides[id] = { ...overrides[id], ...p };
  }
  images = withOverrides(RAW, overrides);
  listeners.forEach((f) => f());
}
recompute();

/** Catalogue courant (retouches comprises). */
export const bankImages = () => images;
export const overridesOf = () => overrides;
/** Retouches pas encore partagées (compte non connecté, serveur injoignable). */
export const pendingCount = () => Object.keys(pending).length;

/** Envoie les retouches en attente puis relit les retouches partagées (sans compte : rien ne change, tout reste ici). */
let running: Promise<'partage' | 'local'> | null = null;
export function syncBank(): Promise<'partage' | 'local'> {
  // Une seule synchronisation à la fois ; celle qui suit attend la précédente.
  running = (running ?? Promise.resolve('local' as const)).then(syncOnce, syncOnce);
  return running;
}
async function syncOnce(): Promise<'partage' | 'local'> {
  try {
    const { bankRetouches, putBankRetouche } = await import('../sync/client');
    for (const [id, p] of Object.entries(pending)) {
      await putBankRetouche(id, p);
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

/** Retoucher les étiquettes d'une image (pour toute l'application) ; `null` : revenir au catalogue. */
export function setOverride(id: string, patch: Partial<BankImage> | null): Promise<'partage' | 'local'> {
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
  const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
  return bankUrl(img, mipFor(img, px, dpr), BASE);
}
export const bankById = (id: string | undefined | null) => (id ? images.find((i) => i.id === id) ?? null : null);

/** Une adresse d'image vient-elle de la banque ? (jetons : on les dessine entiers et orientés, sans médaillon). */
export const isBankSrc = (src: string | undefined) => !!src && src.includes('/banque/personnages/') && src.endsWith('.webp');

/**
 * Image d'un PNJ (portrait ou jeton), cohérente avec le lieu : `role` (sous-titre du PNJ), `place` (fiche de la cité ou
 * du lieu, et son peuple), `region`. Renvoie l'adresse, ou undefined plutôt qu'un intrus.
 */
export function npcImage({ id, role, placeText, people, region = 'surface', vue = 'jeton', px = 128, peoples }: {
  id: string; role?: string; placeText?: string; people?: string; region?: string; vue?: 'portrait' | 'jeton'; px?: number; peoples?: Peoples;
}): string | undefined {
  const pe = peoples ?? peoplesOf({ text: placeText, people, region });
  const genre = /\b(elle|femme|fille|dame|soeur|mere|tavern(i|e)ere|servante|pretresse|marchande)\b/.test((role ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')) ? 'f' as const : undefined;
  const img = pickPerson(images, { vue, role, peoples: pe, seed: id, genre });
  return img ? bankSrc(img, px) : undefined;
}
