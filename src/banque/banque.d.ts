/** Types de la Banque Loresmith (voir banque.js). */
export type BankType = 'texture' | 'element' | 'personnage';
export interface BankImage {
  id: string; drive?: string; titre?: string; nom: string; type: BankType;
  vue: 'zenith' | 'tuile' | 'portrait' | 'jeton';
  ratio: number; couleur: string; mips: number[];
  cat?: string; forme?: string; materiau?: string; usage?: string[];
  /** Éléments : [largeur, hauteur] en mètres ; textures : côté d'une tuile en mètres (nombre). */
  taille?: number[] | number;
  milieux: string[]; climats: string[]; saisons: string[]; region: string[];
  peuple?: string; genre?: 'f' | 'm'; roles?: string[]; paire?: string | null; pose?: string;
  devine?: boolean; exclu?: boolean;
  /** Toits : silhouette 8 × 8 (lignes de 0 et de 1). */
  masque?: string;
  /** Image ajoutée par un MJ à son univers : son adresse (une seule version), son asset et sa campagne éventuelle. */
  src?: string; assetId?: string; campaignId?: string;
}
export interface Peoples { main: string[]; others: string[]; banned: string[]; hostile: boolean }
export const PEUPLES: Record<string, RegExp>;
export const PROFONDEURS: Set<string>;
export const SURFACE: string[];
export const TRAQUES: Set<string>;
export const MIN_PX: number;
export function norm(s: unknown): string;
export function peupleKey(s: unknown): string | null;
export function peoplesOf(o?: { text?: string; people?: string; region?: string }): Peoples;
export function hash(s: string): number;
export function roleKeys(role: string): string[];
export function pickPerson(images: BankImage[], o?: { vue?: 'portrait' | 'jeton'; role?: string; peoples?: Peoples; genre?: 'f' | 'm'; seed?: string; peuple?: string }): BankImage | null;
export function pickElement(images: BankImage[], o?: { cat?: string; cats?: string[]; climat?: string; saison?: string; region?: string; milieu?: string; usage?: string; forme?: string; formes?: string[]; ratio?: number; seed?: string }): BankImage | null;
export function pickTexture(images: BankImage[], o?: { cat?: string; cats?: string[]; climat?: string; saison?: string; region?: string; seed?: string }): BankImage | null;
export function mipFor(img: { mips?: number[] }, px: number, dpr?: number): number;
export function drawPx(meters: number, metersPerPx: number): number;
export function bankUrl(img: { id: string; type: BankType }, size: number, base?: string): string;
export function withOverrides(images: BankImage[], overrides?: Record<string, Partial<BankImage>>): BankImage[];
export function roofAngle(img: BankImage, w: number, d: number, ang: number, seed?: string): number;
export function faceAngle(dx: number, dy: number): number;
export function maskFromParts(parts: number[][], n?: number): string;
export function turnedMask(mask: string, rot: number, flip: boolean, n?: number): string;
export function fitRoof(images: BankImage[], o: { mask: string; w: number; h: number; climat?: string; usage?: string; seed?: string; min?: number }): { img: BankImage; rot: number; flip: boolean; iw: number; ih: number } | null;
