export type DieGroup = { groupId: string; value: number; sides?: number | string; qty?: number; rolls?: { value: number }[] };

/**
 * Résultat critique d'un jet d'un seul d20 : 20 naturel = succès critique, 1 naturel = échec critique.
 * Lecture seule des résultats : n'influence ni le lancer ni le total.
 * `sides` peut être un nombre (20) ou une chaîne (« d20 ») selon la version de dice-box.
 */
export function criticalOutcome(groups: DieGroup[]): 'success' | 'failure' | null {
  if (groups.length !== 1) return null;
  const [g] = groups;
  if (Number(String(g.sides).replace(/^d/, '')) !== 20 || g.qty !== 1) return null;
  if (g.value === 20) return 'success';
  if (g.value === 1) return 'failure';
  return null;
}
