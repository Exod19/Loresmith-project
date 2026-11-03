/**
 * Contrôle qualité d'une énigme (atelier, étape 7), d'après la grille du kit : vérifications automatiques
 * (bloquantes ou à examiner) et grille de 8 critères notés de 0 à 5 par le MJ. Le score aide la relecture ;
 * il ne remplace pas le regard du MJ, seul à pouvoir marquer l'énigme « relue ».
 */
import { solvedAtStart, solvePuzzle, type SolverReport } from './solver';
import type { Clue, Puzzle } from './types';

export const CRITERIA: { id: string; label: string; help: string; blocking?: boolean }[] = [
  { id: 'inferabilite', label: 'Inférabilité', help: 'Tout ce qu’il faut savoir est accessible et suffit.', blocking: true },
  { id: 'causalite', label: 'Cohérence causale', help: 'Chaque manipulation suit la même loi.', blocking: true },
  { id: 'reflexion', label: 'Richesse de réflexion', help: 'Concevoir une expérience, poser des contraintes, justifier.' },
  { id: 'indices', label: 'Qualité des indices', help: 'Ils orientent sans faire la réflexion à la place des joueurs.' },
  { id: 'echec', label: 'Échec utile', help: 'Une erreur a une conséquence claire, la partie continue.' },
  { id: 'accessibilite', label: 'Accessibilité', help: 'Clavier, toucher, texte en plus des couleurs et des sons, pas de minuterie.' },
  { id: 'narration', label: 'Intégration narrative', help: 'L’énigme a du sens dans le lieu et l’histoire.' },
  { id: 'securite', label: 'Secret protégé', help: 'La solution reste chez le MJ (garanti par LoreSmith).' },
];

export type Check = { level: 'bloquant' | 'attention' | 'ok'; text: string };

/** Valeurs de la solution qui ne doivent pas apparaître telles quelles dans un indice ou un texte de joueur. */
export function secretTokens(p: Puzzle): string[] {
  const s = p.engine.serverConfig ?? {}, out: string[] = [];
  const add = (v: unknown) => { if (typeof v === 'string' && v.trim().length >= 2) out.push(v.trim()); if (typeof v === 'number') out.push(String(v)); };
  for (const v of Object.values(s)) {
    if (Array.isArray(v) && v.every((x) => typeof x === 'string' || typeof x === 'number')) {
      // Une combinaison complète (« C-A-B », « Fondation, Couronne… ») trahit la réponse.
      if (v.length > 1) out.push(v.join(' '), v.join('-'), v.join(', '), v.join(''));
      v.forEach(add);
    } else add(v);
  }
  return [...new Set(out)].filter((t) => t.length >= 2);
}

/** Textes destinés aux joueurs (ou aux indices) qui contiennent une valeur de la solution. */
export function spoilers(p: Puzzle): { text: string; hint: boolean }[] {
  const tokens = secretTokens(p);
  if (!tokens.length) return [];
  const has = (t: string) => tokens.some((k) => new RegExp(`(^|[^\\p{L}\\p{N}])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'iu').test(t));
  const out: { text: string; hint: boolean }[] = [];
  p.gm.nonSpoilerHints.forEach((h, i) => { if (h.text && has(h.text)) out.push({ hint: true, text: `L’indice ${i + 1} contient une valeur de la solution : il donnerait la réponse.` }); });
  p.player.observations.forEach((o, i) => { if (o.text && has(o.text)) out.push({ hint: false, text: `L’observation ${i + 1} contient une valeur de la solution : vérifie qu’elle ne la donne pas.` }); });
  // Les fresques sont nommées dans les documents : seule la séquence complète trahit l'ordre.
  if (p.mechanic !== 'chronology' && p.mechanic !== 'statues') (p.player.readables ?? []).forEach((r) => { if (has(r.text)) out.push({ hint: false, text: `Le document « ${r.source} » contient une valeur de la solution : vérifie qu’il ne la donne pas.` }); });
  return out;
}

export function checksOf(p: Puzzle, clues: Clue[], solver: SolverReport = solvePuzzle(p, p.design)): Check[] {
  const out: Check[] = [];
  const bad = (text: string) => out.push({ level: 'bloquant', text });
  const warn = (text: string) => out.push({ level: 'attention', text });
  const ok = (text: string) => out.push({ level: 'ok', text });
  const pl = p.player, gm = p.gm;
  if (!p.title.trim() || p.title === 'Nouvelle énigme') warn('Donne un titre à l’énigme.');
  if (!pl.sceneDescription?.trim()) bad('La scène n’est pas décrite aux joueurs.');
  if (!pl.objective?.trim()) bad('Les joueurs ne savent pas ce qu’ils doivent obtenir (objectif).');
  const initial = pl.observations.filter((o) => o.text.trim() && o.available === 'initiale').length;
  const inspect = pl.observations.filter((o) => o.text.trim() && o.available !== 'initiale').length;
  if (initial < 2) warn('Prévois au moins deux observations visibles d’emblée.');
  if (inspect < 1) warn('Prévois au moins une observation à découvrir en examinant la scène.');
  if (solver.ok) ok(`Solveur : ${solver.solutions === undefined ? 'résoluble' : `${solver.solutions} solution${solver.solutions > 1 ? 's' : ''} acceptée${solver.solutions > 1 ? 's' : ''}`}.`);
  else solver.errors.forEach(bad);
  solver.warnings.forEach(warn);
  if (solvedAtStart(p)) bad('Le mécanisme est déjà résolu au départ.');
  if (!gm.deductionPath?.filter((x) => x.trim()).length && !gm.solutionRationale?.trim()) bad('La démonstration (de l’observation à la conclusion) n’est pas écrite.');
  const hints = gm.nonSpoilerHints.filter((h) => h.text.trim()).length;
  if (hints < 3) warn(`${hints}/3 indices gradués écrits.`);
  spoilers(p).forEach((x) => (x.hint ? bad(x.text) : warn(x.text)));
  if (!gm.failureForward.onWrongAnswer?.trim()) bad('Rien n’est prévu quand les joueurs se trompent (échec utile).');
  if (!gm.alternateBypass?.trim()) warn('Aucun détour prévu si le groupe bloque.');
  for (const r of pl.readables ?? []) {
    if (!r.clueId) continue;
    const c = clues.find((x) => x.id === r.clueId);
    if (!c) bad(`Le document « ${r.source} » a été retiré du carnet.`);
    else if (!c.held && !c.gmNote?.trim()) warn(`« ${r.source} » est à trouver ailleurs : note où il se trouve (carnet).`);
  }
  if (!out.some((c) => c.level !== 'ok')) ok('Aucun point bloquant.');
  return out;
}

/** Notes suggérées d'après les vérifications (le MJ les ajuste). */
export function suggestedScores(p: Puzzle, checks: Check[], solver: SolverReport): Record<string, number> {
  const bad = checks.filter((c) => c.level === 'bloquant').length;
  const hints = p.gm.nonSpoilerHints.filter((h) => h.text.trim()).length;
  return {
    inferabilite: solver.ok ? (p.player.observations.filter((o) => o.text.trim()).length >= 3 ? 4 : 3) : 1,
    causalite: solver.ok ? 5 : 2,
    reflexion: solver.ok && !solver.warnings.length ? 4 : 3,
    indices: spoilers(p).some((x) => x.hint) ? 1 : hints >= 3 ? 4 : hints ? 3 : 1,
    echec: p.gm.failureForward.onWrongAnswer?.trim() ? (p.gm.alternateBypass?.trim() ? 4 : 3) : 1,
    accessibilite: 4,
    narration: p.player.sceneDescription?.trim() && p.design?.stakes?.trim() ? 4 : p.player.sceneDescription?.trim() ? 3 : 1,
    securite: bad ? 4 : 5,
  };
}

export const scoreTotal = (scores: Record<string, number>) => CRITERIA.reduce((a, c) => a + (scores[c.id] ?? 0), 0);

/** Prête à jouer : solveur d'accord, rien de bloquant, critères bloquants ≥ 4, 32/40 au moins, et relue par le MJ. */
export function readiness(p: Puzzle, checks: Check[], solver: SolverReport) {
  const scores = { ...suggestedScores(p, checks, solver), ...(p.design?.scores ?? {}) };
  const total = scoreTotal(scores);
  const reasons: string[] = [];
  if (!solver.ok) reasons.push('le solveur ne trouve pas de solution valable');
  if (checks.some((c) => c.level === 'bloquant')) reasons.push('il reste des points bloquants');
  for (const c of CRITERIA) if (c.blocking && (scores[c.id] ?? 0) < 4) reasons.push(`« ${c.label} » sous 4`);
  if (total < 32) reasons.push(`score ${total}/40 (32 requis)`);
  if (!p.design?.reviewed) reasons.push('pas encore relue par le MJ');
  return { scores, total, ready: !reasons.length, reasons };
}
