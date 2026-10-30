/**
 * Sentiers de l'Atlas (galeries, boyaux, lézardes, crevasses, ruisseaux, passages dérobés) :
 * - le DC pour les repérer depuis la salle voisine (null : évident, on le voit sans chercher) ;
 * - la dangerosité perçue : ce qu'un aventurier averti jugerait du passage en le regardant, avec ses raisons.
 * Sert à la carte de navigation (quels sentiers les joueurs voient) et à la carte de combat.
 */
export type DangerLevel = 1 | 2 | 3 | 4 | 5;
export type Danger = { level: DangerLevel; label: string; text: string; why: string[] };
export type Detect = { dc: number; skill: string } | null;
export type TrailProfile = { detect: Detect; danger: Danger };

type TrailLike = { title: string; trace?: string; category?: string };

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const DANGER: Record<DangerLevel, { label: string; text: string }> = {
  1: { label: 'Sûr', text: 'Sol ferme, place pour avancer : rien n’y alerte un voyageur averti.' },
  2: { label: 'Praticable', text: 'Exigeant, mais sans danger apparent : on y passe avec un peu d’attention.' },
  3: { label: 'Incertain', text: 'Étroit, glissant ou mal éclairé : un faux pas est possible, mieux vaut ralentir ou s’encorder.' },
  4: { label: 'Périlleux', text: 'Le danger se voit : chute, roche coupante ou courant. Un test sera sans doute nécessaire.' },
  5: { label: 'Mortel', text: 'Tout y annonce qu’on peut y mourir : seuls les désespérés s’y engagent.' },
};

const BASE: Record<string, { detect: Detect; level: DangerLevel; why: string }> = {
  tunnel: { detect: null, level: 1, why: 'voie large et entretenue' },
  galerie: { detect: null, level: 1, why: 'galerie large au sol plat' },
  boyau: { detect: { dc: 10, skill: 'Perception' }, level: 2, why: 'boyau bas : on avance courbé' },
  etroit: { detect: { dc: 12, skill: 'Perception' }, level: 3, why: 'passage étroit : on avance de profil' },
  crevasse: { detect: { dc: 11, skill: 'Perception' }, level: 4, why: 'crevasse profonde aux arêtes coupantes' },
  ruisseau: { detect: { dc: 8, skill: 'Perception' }, level: 2, why: 'eau courante sur des berges glissantes' },
  secret: { detect: { dc: 15, skill: 'Investigation' }, level: 3, why: 'entrée dérobée, conduit inconnu' },
  maritime: { detect: null, level: 2, why: 'traversée en mer : grains, courants, pirates' },
};

/** Mots du nom qui changent la perception d'un passage. */
const WORSE: [RegExp, string][] = [
  [/instable|effondr|eboul/, 'roche instable'],
  [/fumant|gaz|vicie|soufre/, 'air vicié ou fumées'],
  [/glissant|boue|suintant/, 'sol glissant'],
  [/gouffre|abime|vide|corniche/, 'à-pic au bord du passage'],
  [/noye|siphon|crue/, 'risque de noyade'],
  [/piege|attrape/, 'traces d’un piège'],
];
const BETTER: [RegExp, string][] = [
  [/taille|balise|entretenu|pave|route|pont|escalier/, 'aménagé par des mains habiles'],
  [/praticable|facile|large/, 'praticable de l’avis des voyageurs'],
];
const HIDDEN: [RegExp, number][] = [[/cache|derobe|secret|faux|fausse|oublie/, 3], [/fente|chatiere|lezarde|etroiture|fissure/, 2]];

export function trailProfile(t: TrailLike, secretDc?: number): TrailProfile {
  const n = norm(t.title);
  const base = BASE[t.trace ?? ''] ?? { detect: { dc: 12, skill: 'Perception' }, level: 2 as DangerLevel, why: 'passage irrégulier' };
  const why = [base.why];
  let level: number = base.level;
  // Les crevasses sont toutes classées « danger » dans l'Atlas : leur niveau de base en tient déjà compte.
  if (t.category === 'danger' && t.trace !== 'crevasse') { level += 1; why.push('réputé dangereux'); }
  for (const [re, w] of WORSE) if (re.test(n)) { level += 1; why.push(w); }
  for (const [re, w] of BETTER) if (re.test(n)) { level -= 1; why.push(w); }
  const clamped = Math.max(1, Math.min(5, level)) as DangerLevel;

  let detect: Detect = base.detect ? { ...base.detect } : null;
  if (t.trace === 'secret' && secretDc) detect = { dc: secretDc, skill: 'Investigation' };
  else if (detect) for (const [re, plus] of HIDDEN) if (re.test(n)) { detect.dc += plus; break; }
  if (/grande|principale|route|voie/.test(n) && t.trace !== 'secret') detect = null;

  return { detect, danger: { level: clamped, ...DANGER[clamped], why } };
}

/** Libellé court du DC de détection : « évident » ou « Perception 12 ». */
export const detectLabel = (d: Detect) => (d ? `${d.skill} ${d.dc}` : 'évident');

/** Perception passive : 10 + Sagesse (+ maîtrise si fournie). */
export const passiveOf = (wis?: number, bonus = 0) => 10 + Math.floor(((wis ?? 10) - 10) / 2) + bonus;

/** Les joueurs le remarquent-ils sans chercher ? (seulement la Perception : l'Investigation demande une fouille). */
export const noticedPassively = (d: Detect, passive: number) => !d || (d.skill === 'Perception' && d.dc <= passive);
