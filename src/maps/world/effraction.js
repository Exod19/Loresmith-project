/**
 * La nuit et l'effraction : la porte d'un bâtiment est verrouillée la nuit (sauf une taverne ou une auberge, qui
 * veillent), son DD de crochetage dépend du bâtiment et du quartier. Entrer sans réveiller les dormeurs demande un jet de
 * Discrétion dont le DD dépend de leur nombre, d'un chien, d'un veilleur éveillé, et du bruit fait en forçant la porte.
 * Si quelqu'un se réveille, sa réaction dépend de qui il est ; s'il crie, la garde arrive en quelques rounds selon le
 * quartier. Le tout s'inscrit dans la mémoire du monde.
 *
 * JavaScript pur, testé par effraction.test.mjs.
 */

/** Graine stable d'un texte → générateur 0–1. */
function rngOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
const between = (r, a, b) => a + Math.floor(r() * (b - a + 1));

/** Serrure selon le bâtiment : DD de crochetage (Dextérité, outils de voleur) et la porte qu'on a devant soi. */
const LOCKS = {
  maison: [12, 'une porte de bois au loquet et à la serrure simple'], ferme: [10, 'une porte de ferme barrée de l’intérieur'],
  echoppe: [13, 'une porte d’échoppe à la serrure solide, volets cadenassés'], atelier: [13, 'une porte d’atelier à la serrure solide'],
  forge: [13, 'une lourde porte de forge, barre de fer'], entrepot: [14, 'un portail d’entrepôt cadenassé'], ecurie: [10, 'une porte d’écurie au simple loquet'],
  taverne: [12, 'la porte de la taverne'], auberge: [12, 'la porte de l’auberge'], guilde: [15, 'une porte de chêne ferrée, serrure de maître'],
  temple: [13, 'les portes du temple, fermées par un verrou'], manoir: [15, 'une porte de chêne ferrée, serrure ouvragée'],
  caserne: [16, 'la porte de la caserne, verrouillée et gardée'], chateau: [18, 'une poterne bardée de fer, serrure de maître'],
};
const QUARTER = { chateau: 2, haute: 2, marche: 0, ville: 0, faubourg: -1, ferme: -2 };
/** Lieux qui veillent la nuit : on y entre sans crocheter. */
const OPEN_AT_NIGHT = new Set(['taverne', 'auberge']);

/**
 * La porte d'un bâtiment à ce moment : { locked, dc, forceDc, door, why }. Verrouillée la nuit ; le jour et le soir, les
 * portes sont ouvertes (une maison accueille, une échoppe vend).
 */
export function lockOf({ type = 'maison', quartier = 'ville' } = {}, period = 'nuit') {
  const [base, door] = LOCKS[type] ?? LOCKS.maison;
  const dc = Math.max(8, base + (QUARTER[quartier] ?? 0));
  if (period !== 'nuit') return { locked: false, dc, forceDc: dc + 2, door, why: 'De jour comme le soir, la porte est ouverte : on entre comme tout le monde.' };
  if (OPEN_AT_NIGHT.has(type)) return { locked: false, dc, forceDc: dc + 2, door, why: 'Même la nuit, l’établissement veille : la porte n’est pas verrouillée.' };
  return { locked: true, dc, forceDc: dc + 2, door, why: QUARTER[quartier] > 0 ? 'Quartier aisé : serrures plus solides.' : QUARTER[quartier] < 0 ? 'Quartier modeste : serrures plus simples.' : '' };
}

/** Dormeurs et veilleurs probables d'un bâtiment, la nuit, quand son intérieur n'a pas encore été visité. */
const NIGHT = {
  maison: { sleepers: [1, 4], roles: ['habitant', 'habitante', 'enfant'], dog: 0.3 },
  ferme: { sleepers: [2, 5], roles: ['fermier', 'fermière', 'enfant'], dog: 0.6 },
  manoir: { sleepers: [3, 6], roles: ['maître de maison', 'domestique', 'domestique'], dog: 0.4 },
  echoppe: { sleepers: [1, 2], roles: ['marchand', 'marchande'], dog: 0.2 },
  atelier: { sleepers: [1, 2], roles: ['artisan', 'apprenti'], dog: 0.2 },
  forge: { sleepers: [1, 2], roles: ['forgeron', 'apprenti'], dog: 0.3 },
  taverne: { sleepers: [2, 5], roles: ['tavernier', 'serveur', 'voyageur'], dog: 0.3 },
  auberge: { sleepers: [3, 7], roles: ['aubergiste', 'voyageur', 'voyageuse'], dog: 0.3 },
  temple: { sleepers: [1, 2], roles: ['prêtre', 'acolyte'], dog: 0 },
  guilde: { sleepers: [0, 1], roles: ['commis'], watch: [1, 1], watchRole: 'garde', dog: 0.2 },
  entrepot: { sleepers: [0, 0], roles: [], watch: [1, 1], watchRole: 'veilleur', dog: 0.5 },
  ecurie: { sleepers: [0, 1], roles: ['palefrenier'], dog: 0.3 },
  caserne: { sleepers: [4, 8], roles: ['soldat'], watch: [2, 2], watchRole: 'garde', dog: 0 },
  chateau: { sleepers: [6, 12], roles: ['serviteur', 'courtisan', 'garde'], watch: [3, 5], watchRole: 'garde', dog: 0.3 },
};

/**
 * Qui est là la nuit : `known` (occupants de l'intérieur déjà généré : { name, role, asleep }) ; sinon une estimation
 * stable tirée du bâtiment. Renvoie { sleepers: [{ name, role }], watchers: [{ name, role }], dog }.
 */
export function nightOccupants({ id = '', type = 'maison' } = {}, known) {
  const n = NIGHT[type] ?? NIGHT.maison;
  const r = rngOf(`nuit:${id}`);
  const dog = r() < (n.dog ?? 0);
  if (known?.length) {
    return { sleepers: known.filter((o) => o.asleep).map(({ name, role }) => ({ name, role })), watchers: known.filter((o) => !o.asleep).map(({ name, role }) => ({ name, role })), dog };
  }
  const sleepers = Array.from({ length: between(r, ...n.sleepers) }, (_, i) => ({ name: '', role: n.roles[i % Math.max(1, n.roles.length)] ?? 'habitant' }));
  const watchers = Array.from({ length: n.watch ? between(r, ...n.watch) : 0 }, () => ({ name: '', role: n.watchRole ?? 'garde' }));
  return { sleepers, watchers, dog };
}

/**
 * DD de Discrétion pour entrer et fouiller sans réveiller personne : 10, + 2 par dormeur (+ 8 au plus), + 3 pour un
 * chien, + 5 si la porte a été forcée (bruit) ; un veilleur éveillé : 15 + 2 par veilleur, quoi qu'il arrive.
 */
export function stealthDc({ sleepers = [], watchers = [], dog = false } = {}, forced = false) {
  const why = [];
  let dc;
  if (watchers.length) { dc = 15 + 2 * watchers.length; why.push(watchers.length > 1 ? `${watchers.length} veilleurs éveillés` : 'un veilleur éveillé'); }
  else { dc = 10 + Math.min(8, 2 * sleepers.length); why.push(sleepers.length ? `${sleepers.length} dormeur${sleepers.length > 1 ? 's' : ''}` : 'personne ne dort ici'); }
  if (dog) { dc += 3; why.push('un chien dort près de l’âtre'); }
  if (forced) { dc += 5; why.push('la porte a été forcée avec fracas'); }
  return { dc: Math.min(30, dc), why };
}

/** Réaction de qui se réveille, selon qui il est. `shout` : il crie (la garde peut venir) ; `fight` : il attaque. */
const REACTIONS = [
  [/garde|soldat|sergent|veilleur|capitaine/, { text: 'dégaine et crie « Alerte ! » en se jetant sur les intrus', shout: true, fight: true }],
  [/enfant|gamin|fillette/, { text: 'se met à pleurer et appelle ses parents : toute la maison se réveille', shout: true, wakesAll: true }],
  [/tavern|auberg|forgeron|fermi|palefrenier|apprenti/, { text: 'saisit ce qui lui tombe sous la main (gourdin, marteau, fourche) et crie « Au voleur ! »', shout: true, fight: true }],
  [/marchand|ma[iî]tre|noble|courtisan|intendant|domestique|commis|serviteur/, { text: 'crie « Au voleur ! » à pleins poumons et appelle la garde par la fenêtre', shout: true }],
  [/pr[eê]tre|acolyte/, { text: 'se lève, une lanterne à la main, et demande qui va là d’une voix forte', shout: true }],
];
const HIDE = { text: 'se recroqueville sous sa couverture et fait semblant de dormir, terrifié', shout: false };

/**
 * Qui se réveille et comment il réagit, après un jet de Discrétion raté de `margin` (négatif). Un échec léger réveille
 * une personne ; un échec de 5 ou plus, tout le monde. Tirage stable par `seed`.
 */
export function wakeOutcome(occ, margin, seed = '') {
  const r = rngOf(`reveil:${seed}`);
  const people = [...(occ.watchers ?? []), ...(occ.sleepers ?? [])];
  if (!people.length) return { woken: [], shout: false, fight: false, lines: ['Personne n’est là pour entendre quoi que ce soit.'] };
  const all = margin <= -5;
  const woken = all ? people : [occ.watchers?.length ? occ.watchers[0] : people[Math.floor(r() * people.length)]];
  const lines = [];
  let shout = false, fight = false;
  for (const p of woken) {
    const role = String(p.role ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    let re = REACTIONS.find(([rx]) => rx.test(role))?.[1];
    if (!re) re = r() < 0.3 ? HIDE : { text: 'se redresse en criant « Qui est là ? Au voleur ! »', shout: true };
    lines.push(`${p.name || `${/(euse|iere|esse|ante|ande|ienne|trice|onne)$/.test(role) ? 'Une' : 'Un'} ${p.role}`} ${re.text}.`);
    shout ||= !!re.shout; fight ||= !!re.fight;
    if (re.wakesAll && !all) {
      for (const q of people) if (q !== p && !woken.includes(q)) woken.push(q);
    }
  }
  if (occ.dog && !all) lines.push('Le chien aboie sans s’arrêter.');
  return { woken, shout: shout || !!occ.dog, fight, lines };
}

/** Arrivée de la garde selon le quartier : délai en rounds (dés et valeur tirée) ; hors des murs, ce sont les voisins. */
export function guardArrival(quartier = 'ville', seed = '') {
  const r = rngOf(`garde:${seed}`);
  const d = (n, f) => Array.from({ length: n }, () => 1 + Math.floor(r() * f)).reduce((a, b) => a + b, 0);
  if (quartier === 'chateau') return { who: 'la garde du château', dice: '1d4', rounds: d(1, 4) };
  if (quartier === 'haute') return { who: 'une patrouille du guet', dice: '1d6+1', rounds: d(1, 6) + 1 };
  if (quartier === 'faubourg') return { who: 'une patrouille du guet', dice: '3d6', rounds: d(3, 6) };
  if (quartier === 'ferme') return { who: 'les voisins, fourches et lanternes', dice: '2d10', rounds: d(2, 10), plural: true };
  return { who: 'une patrouille du guet', dice: '2d6', rounds: d(2, 6) };
}

/** Événement de la mémoire du monde pour une effraction (à passer à newEvent). */
export function breakInEvent({ place, woken = [], shout = false, fight = false, guard = null }) {
  const named = woken.map((p) => p.name).filter(Boolean);
  const seen = woken.length > 0;
  return {
    title: `Effraction ${place?.title ? `chez ${place.title}` : 'nocturne'}${seen ? (shout ? ', les occupants ont donné l’alerte' : ', un occupant s’est réveillé') : ''}`,
    text: [
      seen ? `Réveillés : ${woken.map((p) => p.name || p.role).join(', ')}.` : 'Personne ne s’est réveillé ; on découvrira l’effraction au matin.',
      fight ? 'Il y a eu lutte.' : '',
      guard ? `${guard.who.replace(/^./, (c) => c.toUpperCase())} ${guard.plural ? 'sont arrivés' : 'est arrivée'} en ${guard.rounds} rounds.` : '',
    ].filter(Boolean).join(' '),
    kind: 'effraction', place, npcs: named, joueurs: 'auteurs', gravite: guard || fight ? 3 : seen ? 2 : 1, source: 'jeu',
  };
}
