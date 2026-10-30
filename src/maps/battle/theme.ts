/** Thème d'un plateau de combat : caverne (par défaut), plan de surface (selon le climat de la cité) ou intérieur. */
export type BoardTheme = 'surface' | 'surface-froid' | 'surface-chaud' | 'interieur';

/** Thème du plateau d'après le combat local (plan de surface, intérieur, climat de la cité). */
export const boardTheme = (surface: boolean | 'interieur' | 'froid' | 'chaud' | undefined): BoardTheme | undefined =>
  surface === 'interieur' ? 'interieur' : surface === 'froid' ? 'surface-froid' : surface === 'chaud' ? 'surface-chaud' : surface ? 'surface' : undefined;
