/** Types des genres (voir genres.js). */
export const GENRES: { id: string; label: string }[];
export const TOUS: '*';
export const GENRE_DEFAUT: 'fantasy';
export function genresOf(universe: { genres?: string[] } | null | undefined): string[];
export function fitsGenres(img: { genres?: string[] } | null | undefined, genres: string[]): boolean;
