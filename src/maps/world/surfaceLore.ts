/**
 * Descriptions des lieux de la carte du monde (surface) : forêts, monts, lacs, rivières, mers, routes, cités, hameaux.
 * Elles remplacent, à la surface, les descriptions de l'Underdark (atlas/lore.ts), qui parlent de salles et de boyaux.
 * Le texte choisi dépend du lieu (toujours le même pour un même lieu).
 */
import type { AtlasFeature } from '../atlas/types';

const D: Record<string, string[]> = {
  foret: [
    'Une forêt profonde, où les sentiers se perdent entre les fûts moussus. On y entend plus d’oiseaux que de voix humaines.',
    'Des bois anciens, sombres même à midi ; les bûcherons n’y vont jamais seuls ni à la nuit tombée.',
    'Une forêt aux sous-bois clairs, traversée de ruisseaux, où cerfs et sangliers abondent.',
  ],
  monts: [
    'Une chaîne de montagnes aux crêtes déchiquetées. Les cols n’y sont praticables qu’à la belle saison.',
    'Des sommets enneigés dominent la région ; on dit que des choses anciennes dorment sous la roche.',
    'Des montagnes rudes, aux pentes d’éboulis, où seuls les chevriers et les chasseurs s’aventurent.',
  ],
  lac: [
    'Un lac aux eaux calmes, bordé de roseaux, où les pêcheurs posent leurs nasses à l’aube.',
    'Un lac profond et froid ; par temps clair, le ciel s’y reflète comme dans un miroir.',
  ],
  riviere: [
    'Une rivière au cours paisible, franchie par des gués et quelques ponts de pierre.',
    'Une rivière vive, grossie au printemps par la fonte des neiges ; ses gués sont traîtres après la pluie.',
  ],
  mer: [
    'La mer s’étend à perte de vue, grise ou bleue selon le ciel ; les navires y longent la côte.',
    'Une mer aux humeurs changeantes, que les marins respectent et que les pêcheurs connaissent par cœur.',
  ],
  route: [
    'Une route de terre battue, creusée d’ornières, qui relie les cités entre forêts et champs.',
    'Une grand-route bordée de bornes et de calvaires, fréquentée par les marchands et les patrouilles.',
    'Une route qui serpente par les vallées, avec ses relais, ses auberges et ses carrefours.',
  ],
  maritime: ['Une route de mer suivie par les navires marchands, d’escale en escale.'],
  hameau: [
    'Un hameau de quelques fermes autour d’un puits et d’une chapelle ; tout le monde s’y connaît.',
    'Quelques maisons basses, un four commun, des champs : un hameau tranquille au bord de la route.',
  ],
  cite: [
    'Une cité animée, ses marchés, ses tavernes et ses rumeurs ; on y trouve de tout, pour qui sait payer.',
    'Une ville fortifiée, entourée de champs et de faubourgs, où convergent les routes de la région.',
  ],
  escale: ['Une escale où les navires font halte pour la nuit et refont leurs provisions d’eau douce.'],
};

const pick = (list: string[], id: string) => {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
};

/** Description d'un lieu de la surface : son résumé s'il en a un, sinon un texte selon sa nature. */
export function describeSurface(f: AtlasFeature): string {
  if (f.summary) return f.summary;
  const k = /:foret-/.test(f.id) ? 'foret' : /:monts-/.test(f.id) ? 'monts' : /:lac(-|$)/.test(f.id) ? 'lac' : /:riviere-/.test(f.id) ? 'riviere'
    : /:mer-/.test(f.id) ? 'mer' : /:escale-/.test(f.id) ? 'escale' : /:hameau/.test(f.id) ? 'hameau'
    : f.trace === 'maritime' ? 'maritime' : f.trace ? 'route' : f.category === 'cite' ? 'cite' : '';
  return k ? pick(D[k], f.id) : '';
}

/** Libellés des catégories à la surface (ceux de l'Atlas parlent de galeries et d'eaux souterraines). */
export const SURFACE_CATEGORY: Partial<Record<AtlasFeature['category'], string>> = {
  eau: 'Eaux', voie: 'Route / chemin', grotte: 'Grotte', cite: 'Cité / hameau', vivant: 'Nature', garde: 'Poste / camp',
};
