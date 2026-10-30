/**
 * Banque Loresmith dans l'application : catalogue (src/banque/catalogue.json, produit par scripts/banque/build.py),
 * retouches du MJ (gardées dans ce navigateur), adresses des images et choix cohérents pour les PNJ.
 */
import { useSyncExternalStore } from 'react';
import catalogue from './catalogue.json';
import { bankUrl, mipFor, peoplesOf, pickPerson, withOverrides, type BankImage, type Peoples } from './banque';

export * from './banque';

const RAW = (catalogue as { images: BankImage[] }).images;
const KEY = 'loresmith:banque:retouches:v1';
type Overrides = Record<string, Partial<BankImage>>;

function readOverrides(): Overrides {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Overrides; } catch { return {}; }
}
let overrides = readOverrides();
let images = withOverrides(RAW, overrides);
const listeners = new Set<() => void>();

/** Catalogue courant (retouches comprises). */
export const bankImages = () => images;

/** Retoucher les étiquettes d'une image (ou l'exclure des choix automatiques). `null` : revenir au catalogue. */
export function setOverride(id: string, patch: Partial<BankImage> | null) {
  overrides = { ...overrides };
  if (patch) overrides[id] = { ...overrides[id], ...patch }; else delete overrides[id];
  try { localStorage.setItem(KEY, JSON.stringify(overrides)); } catch { /* stockage indisponible : la retouche vaut pour la session */ }
  images = withOverrides(RAW, overrides);
  listeners.forEach((f) => f());
}
export const overridesOf = () => overrides;

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
