/**
 * Contre-vérification des énigmes (atelier, étape 5) : pour chaque mécanisme, un solveur adapté (énumération,
 * parcours en largeur, contraintes) dit si l'énigme a une solution, combien, et en donne une preuve au MJ.
 * Il signale aussi ce qui la rend injouable ou devinable. Le moteur accepte toute solution légitime : le solveur
 * vérifie qu'il n'en refuse aucune et que la réponse attendue en fait partie.
 */
import { evaluatePuzzle, initialDraft, isPrime, traceMirrors } from './engine';
import type { Puzzle } from './types';

export type SolverReport = {
  /** Au moins une solution, et rien de bloquant. */
  ok: boolean;
  /** Nombre de solutions acceptées (si dénombrable). */
  solutions?: number;
  /** Démonstration ou chemin de résolution, pour le MJ seulement. */
  proof: string[];
  /** Bloquant : l'énigme ne peut pas être prête. */
  errors: string[];
  /** À examiner : devinable, triviale, ambiguë… */
  warnings: string[];
  /** Valeurs secrètes qui se déduisent de la configuration (à reporter dans la solution). */
  derived?: Record<string, unknown>;
};

/** Affirmation gravée sur une statue : « la clé est (ou n'est pas) dans le coffret X ». */
export type Claim = { statue: string; is: boolean; chest: string };

/** Lit une inscription du catalogue (« La clé n’est pas dans le coffret A ») ; null si la phrase n'est pas de cette forme. */
export function claimOf(statue: string, text: string): Claim | null {
  const t = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const m = /coffret\s+([a-z0-9]+)/.exec(t);
  if (!m) return null;
  const is = !/n['’]?\s*est\s+pas|ne\s+se\s+trouve\s+pas|n['’]?\s*y\s+est\s+pas/.test(t);
  return { statue, is, chest: m[1].toUpperCase() };
}
export const claimText = (c: Claim) => (c.is ? `La clé se trouve dans le coffret ${c.chest}.` : `La clé n’est pas dans le coffret ${c.chest}.`);

const report = (r: Partial<SolverReport> & { proof?: string[] }): SolverReport => {
  const errors = r.errors ?? [], warnings = r.warnings ?? [];
  return { ok: !errors.length && (r.solutions === undefined || r.solutions > 0), proof: r.proof ?? [], errors, warnings, solutions: r.solutions, derived: r.derived };
};

/** Parcours en largeur générique : du départ jusqu'à un état final, avec le chemin. */
function bfs<S>(start: S, key: (s: S) => string, moves: (s: S) => [string, S][], done: (s: S) => boolean, limit = 200000) {
  const seen = new Map<string, { prev: string | null; how: string }>([[key(start), { prev: null, how: '' }]]);
  const queue: S[] = [start];
  for (let i = 0; i < queue.length && seen.size < limit; i++) {
    const s = queue[i];
    if (done(s)) {
      const path: string[] = [];
      for (let k: string | null = key(s); k && seen.get(k)!.prev !== null; k = seen.get(k)!.prev) path.unshift(seen.get(k)!.how);
      return { path, explored: seen.size };
    }
    for (const [how, n] of moves(s)) { const k = key(n); if (!seen.has(k)) { seen.set(k, { prev: key(s), how }); queue.push(n); } }
  }
  return { path: null, explored: seen.size };
}

/** Toutes les combinaisons d'un tableau de choix (produit cartésien), avec un plafond. */
function* product<T>(choices: T[][], max = 200000): Generator<T[]> {
  const idx = choices.map(() => 0);
  for (let n = 0; n < max; n++) {
    yield idx.map((i, k) => choices[k][i]);
    let k = choices.length - 1;
    while (k >= 0 && ++idx[k] === choices[k].length) { idx[k] = 0; k--; }
    if (k < 0) return;
  }
}

export function solvePuzzle(p: Puzzle, design?: { claims?: Claim[] }): SolverReport {
  const c = p.engine.publicConfig ?? {}, s = p.engine.serverConfig ?? {};
  try {
    switch (p.mechanic) {
      case 'braziers': {
        const levers: string[] = c.leverIds ?? [], hearths: string[] = c.brazierIds ?? [], map: string[] = s.brazierToLever ?? [];
        const errors: string[] = [];
        if (levers.length !== hearths.length) errors.push('Il faut autant de leviers que de brasiers.');
        if (map.length !== hearths.length || new Set(map).size !== map.length || !map.every((l) => levers.includes(l))) errors.push('Chaque brasier doit être commandé par un levier différent.');
        // Une seule inspection ne distingue que trois états : brûle, chaud, froid.
        if (hearths.length > 3) errors.push('Avec une seule inspection, on ne distingue que trois états (flamme, chaud, froid) : trois brasiers au plus.');
        return report({ errors, solutions: errors.length ? 0 : 1, proof: errors.length ? [] : [
          'Laisser un levier levé, en lever un autre puis le baisser, ne pas toucher au dernier.',
          'À l’ouverture : le brasier qui brûle suit le premier, le brasier chaud le deuxième, le froid le troisième.',
          ...hearths.map((h, i) => `Brasier ${h} ← levier ${map[i]}`),
        ] });
      }
      case 'heavy-stone': {
        const n = (c.stoneIds ?? []).length, w = c.maxWeighings ?? 0;
        const errors = [];
        if (!c.stoneIds?.includes(s.heavyStoneId)) errors.push('Le galet lourd doit faire partie des galets.');
        if (n > 3 ** w) errors.push(`${n} galets en ${w} pesée${w > 1 ? 's' : ''} : impossible à coup sûr (au plus ${3 ** w}).`);
        const warnings = n <= 3 ** (w - 1) ? [`On y arrive même avec une pesée de moins : l’énigme est peut-être trop facile.`] : [];
        return report({ errors, warnings, solutions: errors.length ? 0 : 1, proof: errors.length ? [] : [
          'Chaque pesée a trois issues (gauche, droite, équilibre) : partager les galets en trois tas égaux.',
          `${n} galets → ${Math.ceil(n / 3)} par tas ; la pesée désigne le tas lourd, et ainsi de suite.`,
          `Galet lourd : ${s.heavyStoneId}`,
        ] });
      }
      case 'jugs': {
        const caps: number[] = c.capacities ?? [], target: number = c.target;
        if (caps.length !== 2 || caps.some((x) => !(x > 0)) || !(target > 0)) return report({ errors: ['Deux jarres de capacité positive et une quantité visée.'] });
        if (target > Math.max(...caps)) return report({ errors: ['La quantité visée dépasse la plus grande jarre.'] });
        const name = (i: number) => `jarre de ${caps[i]}`;
        const r = bfs<number[]>(c.initial ?? [0, 0], (a) => a.join(','), (a) => {
          const out: [string, number[]][] = [];
          for (const i of [0, 1]) {
            out.push([`remplir la ${name(i)}`, i ? [a[0], caps[1]] : [caps[0], a[1]]]);
            out.push([`vider la ${name(i)}`, i ? [a[0], 0] : [0, a[1]]]);
            const j = 1 - i, v = Math.min(a[i], caps[j] - a[j]);
            const n = [...a]; n[i] -= v; n[j] += v; out.push([`verser la ${name(i)} dans l’autre`, n]);
          }
          return out;
        }, (a) => a.includes(target));
        if (!r.path) return report({ solutions: 0, errors: [`Impossible d’obtenir ${target} : avec ${caps.join(' et ')}, on n’obtient que des multiples de leur PGCD.`] });
        return report({ solutions: 1, proof: [`Solution la plus courte (${r.path.length} gestes) :`, ...r.path], warnings: r.path.length <= 2 ? ['Résolue en deux gestes : trop évidente.'] : [] });
      }
      case 'statues': {
        const chests: string[] = c.coffrets ?? [], truth: number = c.truthCount ?? 1;
        const claims = design?.claims ?? (p.player.readables ?? []).map((r) => claimOf(r.source.replace(/^Statue\s*/i, ''), r.text)).filter(Boolean) as Claim[];
        if (!claims.length) return report({ warnings: ['Inscriptions non reconnues : vérifie la logique à la main.'], proof: [`Coffret attendu : ${s.correctChest}`] });
        const fits = chests.filter((k) => claims.filter((cl) => (k === cl.chest) === cl.is).length === truth);
        const errors = [];
        if (!fits.length) errors.push(`Aucun coffret ne rend vraies exactement ${truth} inscription${truth > 1 ? 's' : ''}.`);
        else if (fits.length > 1) errors.push(`Plusieurs coffrets conviennent (${fits.join(', ')}) : la réponse n’est pas unique, ou le moteur en refuserait une légitime.`);
        else if (fits[0] !== s.correctChest) errors.push(`La logique désigne le coffret ${fits[0]}, pas ${s.correctChest}.`);
        return report({ errors, solutions: fits.length, derived: fits.length === 1 ? { correctChest: fits[0] } : undefined, proof: chests.map((k) => {
          const n = claims.filter((cl) => (k === cl.chest) === cl.is).length;
          return `Si la clé est en ${k} : ${n} inscription${n > 1 ? 's' : ''} vraie${n > 1 ? 's' : ''}${n === truth ? ' ✔' : ''}`;
        }) });
      }
      case 'mirrors': {
        const m = (c.mirrors ?? []).length;
        if (!m) return report({ errors: ['Pose au moins un miroir.'] });
        if (m > 14) return report({ errors: ['Trop de miroirs pour une vérification complète (14 au plus).'] });
        const sols: string[][] = [];
        for (const o of product(Array.from({ length: m }, () => ['/', '\\']))) if (traceMirrors(c, o).hit) sols.push(o);
        const warnings = traceMirrors(c, c.initial ?? []).hit ? ['Le rayon atteint déjà le réceptacle au départ.'] : [];
        return report({ solutions: sols.length, warnings, errors: sols.length ? [] : ['Aucune orientation des miroirs ne mène le rayon au réceptacle.'],
          proof: sols.length ? [`${sols.length} orientation${sols.length > 1 ? 's' : ''} sur ${2 ** m} atteigne${sols.length > 1 ? 'nt' : ''} le réceptacle (toutes acceptées). Par exemple :`, sols[0].map((x, i) => `miroir ${i + 1} ${x}`).join(', ')] : [] });
      }
      case 'prime-tiles': {
        const g: number[][] = c.grid ?? [];
        if (!g.length) return report({ errors: ['La passerelle est vide.'] });
        const [sx, sy] = c.start ?? [0, 0], [ex, ey] = c.end ?? [0, 0];
        if (!isPrime(g[ey]?.[ex])) return report({ errors: ['La dernière dalle n’est pas sûre (pas un nombre premier).'] });
        const r = bfs<number[]>([sx, sy], (a) => a.join(','), ([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]]
          .map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => b >= 0 && b < g.length && a >= 0 && a < g[0].length && isPrime(g[b][a]))
          .map(([a, b]) => [`(${a + 1}, ${b + 1}) = ${g[b][a]}`, [a, b]] as [string, number[]]), ([x, y]) => x === ex && y === ey);
        const safe = g.flat().filter(isPrime).length;
        return report({ solutions: r.path ? 1 : 0, errors: r.path ? [] : ['Aucun chemin de dalles sûres ne relie le départ à l’arrivée.'],
          warnings: safe > g.flat().length * 0.7 ? ['Presque toutes les dalles sont sûres : on passe sans réfléchir.'] : [],
          proof: r.path ? ['La règle : seules les dalles portant un nombre premier tiennent.', `Chemin (${r.path.length} pas) : ${r.path.join(' → ')}`] : [] });
      }
      case 'chronology': {
        const ev: string[] = c.events ?? [], rel: [string, string][] = s.relations ?? c.relations ?? [];
        // Dénombre les ordres compatibles avec les relations « avant / après ».
        const orders: string[][] = [];
        const rec = (done: string[], left: string[]) => {
          if (orders.length > 50) return;
          if (!left.length) { orders.push(done); return; }
          for (const e of left) if (rel.every(([a, b]) => b !== e || done.includes(a))) rec([...done, e], left.filter((x) => x !== e));
        };
        rec([], ev);
        const errors = [];
        if (!orders.length) errors.push('Les relations se contredisent : aucun ordre possible.');
        else if (orders.length > 1) errors.push(`${orders.length >= 50 ? 'Plus de 50' : orders.length} ordres respectent les témoignages : ajoute une relation pour n’en garder qu’un.`);
        else if (JSON.stringify(orders[0]) !== JSON.stringify(s.orderedEvents)) errors.push('L’ordre attendu ne suit pas les témoignages.');
        return report({ errors, solutions: orders.length, derived: orders.length === 1 ? { orderedEvents: orders[0] } : undefined,
          proof: orders.length === 1 ? [...rel.map(([a, b]) => `${a} avant ${b}`), `Seul ordre possible : ${orders[0].join(' → ')}`] : [] });
      }
      case 'glyphs': {
        const ok = c.firstGlyphs?.includes(s.correct?.[0]) && c.secondGlyphs?.includes(s.correct?.[1]);
        return report({ errors: ok ? [] : ['La paire attendue doit faire partie des glyphes proposés.'], solutions: ok ? 1 : 0,
          warnings: ['La règle des glyphes (les exemples des inscriptions) se vérifie à la main : assure-toi qu’une seule paire la respecte.'],
          proof: ok ? [`Paire attendue : ${s.correct.join(' ')}`] : [] });
      }
      case 'cycles': {
        const per: number[] = c.periods ?? [], now: number = c.currentTick ?? 0;
        let t = now + 1;
        while (t <= (c.maxTick ?? 0) && !per.every((x) => t % x === 0)) t++;
        if (t > (c.maxTick ?? 0)) return report({ errors: ['Aucun alignement avant la dernière pulsation possible : augmente la limite.'] });
        return report({ solutions: 1, derived: { nextAlignment: t }, proof: [`Les cycles (${per.join(', ')}) se rejoignent à chaque multiple commun.`, `Premier alignement après ${now} : ${t}`] });
      }
      case 'equal-balance': {
        const w: number[] = c.weights ?? [], target: number = c.targetPerSide;
        if (w.reduce((a, b) => a + b, 0) !== 2 * target) return report({ errors: [`La somme des offrandes (${w.reduce((a, b) => a + b, 0)}) doit valoir deux fois ${target}.`] });
        if (w.length > 12) return report({ errors: ['Trop d’offrandes pour une vérification complète (12 au plus).'] });
        const sols: string[][] = [];
        for (const sides of product(w.map(() => ['left', 'right']))) {
          const sum = (side: string) => w.reduce((a, x, i) => a + (sides[i] === side ? x : 0), 0);
          if (sum('left') === target) sols.push(sides);
        }
        return report({ solutions: sols.length, errors: sols.length ? [] : ['Aucune répartition n’équilibre les plateaux.'],
          proof: sols.length ? [`${sols.length} répartition${sols.length > 1 ? 's' : ''} (miroirs compris), toutes acceptées. Par exemple : gauche ${w.filter((_, i) => sols[0][i] === 'left').join(' + ')}, droite ${w.filter((_, i) => sols[0][i] === 'right').join(' + ')}`] : [] });
      }
      case 'gears': {
        const opt: string[] = c.optionalGearIds ?? [];
        if (!opt.length) return report({ errors: ['Il faut au moins une roue à ajouter ou retirer.'] });
        return report({ solutions: 1, proof: ['Deux roues engrenées tournent en sens contraire : chaque roue intermédiaire inverse le sens.', 'Un nombre impair de roues ajoutées rétablit le sens voulu.'] });
      }
      case 'light-network': {
        const n: number = c.count;
        const r = bfs<boolean[]>(c.initial ?? [], (a) => a.map(Number).join(''), (a) => Array.from({ length: n }, (_, i) => {
          const b = [...a]; for (const o of [-1, 0, 1]) { const k = (i + o + n) % n; b[k] = !b[k]; }
          return [`presser le cristal ${i + 1}`, b] as [string, boolean[]];
        }), (a) => JSON.stringify(a) === JSON.stringify(c.target));
        return report({ solutions: r.path ? 1 : 0, errors: r.path ? [] : ['Le motif visé est inaccessible depuis l’état initial.'],
          warnings: r.path && r.path.length <= 1 ? ['Une seule pression suffit : trop évident.'] : [],
          proof: r.path ? [`Plus court (${r.path.length} pressions) : ${r.path.join(', ')}`] : [] });
      }
      default: return report({ errors: ['Mécanisme inconnu.'] });
    }
  } catch (e) {
    return report({ errors: [`Configuration illisible : ${(e as Error).message}`] });
  }
}

/** Le mécanisme est-il déjà résolu sans rien toucher ? (et donc aucun geste n'est requis) */
export function solvedAtStart(p: Puzzle) {
  try { return evaluatePuzzle(p, initialDraft(p)); } catch { return false; }
}
