export type RollMode = 'normal' | 'advantage' | 'disadvantage';

/** Un d20 seul (« 1d20 », « d20 », « 1d20+4 », « 1d20 - 2 »). */
const D20_RE = /^\s*1?d20\s*(?:([+-])\s*(\d+))?\s*$/i;

/** Le modificateur d'un d20 seul, ou null si la formule n'est pas un d20 seul. */
export function parseD20(notation: string): { modifier: number } | null {
  const m = D20_RE.exec(notation);
  if (!m) return null;
  const amount = m[2] ? Number(m[2]) : 0;
  return { modifier: m[1] === '-' ? -amount : amount };
}

/** Notation réellement lancée : deux d20 pour avantage/désavantage, sinon la formule telle quelle. */
export function rollNotation(notation: string, mode: RollMode): string {
  return mode !== 'normal' && parseD20(notation) ? '2d20' : notation;
}

export interface D20Resolution {
  /** Total après modificateur. */
  total: number;
  /** Dé retenu (le plus haut en avantage, le plus bas en désavantage). */
  kept: number;
  /** Dé écarté, s'il y en a un. */
  dropped: number | null;
}

/** Résout un jet de d20 à partir des dés bruts. */
export function resolveD20(rolls: number[], mode: RollMode, modifier: number): D20Resolution {
  if (mode === 'normal' || rolls.length < 2) {
    const kept = rolls[0];
    return { total: kept + modifier, kept, dropped: null };
  }
  const [a, b] = rolls;
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  const kept = mode === 'advantage' ? high : low;
  const dropped = mode === 'advantage' ? low : high;
  return { total: kept + modifier, kept, dropped };
}

/** Critique selon le dé naturel retenu : 20 = succès, 1 = échec. */
export function criticalFromNatural(natural: number): 'success' | 'failure' | null {
  if (natural === 20) return 'success';
  if (natural === 1) return 'failure';
  return null;
}
