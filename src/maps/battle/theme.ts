/** Thème d'un plateau de combat : caverne (par défaut), plan de surface (selon le climat de la cité) ou intérieur. */
type Surf = 'surface' | 'surface-froid' | 'surface-chaud' | 'surface-neige';
/** `-nature` : plan d'un lieu sauvage (herbe, terre et roche ; ni pavés ni toits). */
export type BoardTheme = Surf | `${Surf}-nature` | 'interieur';

/** Thème du plateau d'après le combat local (plan de surface, intérieur, climat de la cité). */
export const boardTheme = (surface: boolean | 'interieur' | 'froid' | 'chaud' | 'neige' | undefined, nature?: boolean): BoardTheme | undefined => {
  const t: Surf | 'interieur' | undefined = surface === 'interieur' ? 'interieur' : surface === 'froid' ? 'surface-froid' : surface === 'chaud' ? 'surface-chaud' : surface === 'neige' ? 'surface-neige' : surface ? 'surface' : undefined;
  return t && t !== 'interieur' && nature ? `${t}-nature` : t;
};
