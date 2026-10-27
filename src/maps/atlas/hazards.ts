/**
 * Épreuve de passage : ce qu'un sentier incertain, périlleux ou mortel demande à celui qui l'emprunte,
 * et ce qui lui arrive s'il échoue. Les sentiers sûrs ou praticables se suivent sans jet.
 */
import type { TrailProfile } from './trails';

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export type Hazard = {
  /** Compétence (ou jet de sauvegarde) et caractéristique qui s'y ajoute. */
  check: string;
  ability: Ability;
  save: boolean;
  dc: number;
  /** Ce qui arrive en cas d'échec, les dégâts à lancer, et la suite pour le groupe. */
  fail: string;
  damage?: string;
  setback?: string;
  /** Ce qui se passe en cas de réussite. */
  success: string;
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

type Base = Omit<Hazard, 'dc'> & { dc: number };

/** Dangers signalés par le nom du sentier : ils l'emportent sur le type de tracé. */
const BY_NAME: [RegExp, Base][] = [
  [/instable|effondr|eboul/, { check: 'Sauvegarde de Dextérité', ability: 'dex', save: true, dc: 13, fail: 'Des blocs se détachent au passage et s’abattent sur lui.', damage: '2d6', setback: 'Le passage est à moitié obstrué : 10 minutes pour dégager.', success: 'Il esquive les pierres qui roulent et passe.' }],
  [/fumant|gaz|vicie|soufre/, { check: 'Sauvegarde de Constitution', ability: 'con', save: true, dc: 12, fail: 'Il respire les vapeurs : empoisonné pendant 1 heure (désavantage aux attaques et aux tests).', success: 'Il retient son souffle et traverse sans dommage.' }],
  [/glissant|boue|suintant/, { check: 'Dextérité (Acrobaties)', ability: 'dex', save: false, dc: 12, fail: 'Il glisse et tombe lourdement.', damage: '1d4', setback: 'Une fiole ou une torche se brise dans la chute (au choix du MJ).', success: 'Il garde l’équilibre sur la pierre glissante.' }],
  [/gouffre|abime|corniche|vide/, { check: 'Dextérité (Acrobaties)', ability: 'dex', save: false, dc: 14, fail: 'Le bord cède sous son pied : il bascule dans le vide et se rattrape plus bas.', damage: '3d6', setback: 'Il faut une corde et 10 minutes pour le remonter (Athlétisme DC 12).', success: 'Il longe le bord, le dos à la paroi, sans un faux pas.' }],
  [/noye|siphon|crue/, { check: 'Force (Athlétisme)', ability: 'str', save: false, dc: 13, fail: 'L’eau monte et l’emporte : il boit la tasse et lutte pour respirer.', damage: '1d6', setback: 'Il perd un objet dans le courant, et une ration est gâtée.', success: 'Il nage contre le courant et atteint l’autre rive.' }],
];

/** Selon le type de tracé. */
const BY_TRACE: Record<string, Base> = {
  etroit: { check: 'Dextérité (Acrobaties)', ability: 'dex', save: false, dc: 12, fail: 'Il se coince dans l’étroiture, la roche lui écorche les épaules.', damage: '1d4', setback: '10 minutes pour le dégager, et un jet de rencontre (le bruit porte).', success: 'Il se glisse de profil, sac à la main, et passe.' },
  crevasse: { check: 'Force (Athlétisme)', ability: 'str', save: false, dc: 13, fail: 'Il dérape sur les arêtes et glisse dans la crevasse.', damage: '2d6', setback: 'Il faut l’aider à remonter (Athlétisme DC 12) ; 10 minutes perdues.', success: 'Il progresse en opposition, pieds et dos contre les parois, jusqu’au bout.' },
  ruisseau: { check: 'Force (Athlétisme)', ability: 'str', save: false, dc: 11, fail: 'Le courant le fauche et l’entraîne sur quelques mètres.', damage: '1d6', setback: 'Un objet est emporté par l’eau (au choix du MJ).', success: 'Il avance dans l’eau froide, pas après pas, sans perdre pied.' },
  secret: { check: 'Intelligence (Investigation)', ability: 'int', save: false, dc: 13, fail: 'Le mécanisme résiste et grince : le bruit résonne dans les galeries.', setback: 'Jet de rencontre immédiat ; on peut réessayer en 10 minutes.', success: 'Il trouve le loquet : le passage s’ouvre sans bruit.' },
  boyau: { check: 'Force (Athlétisme)', ability: 'str', save: false, dc: 11, fail: 'Il se cogne et s’épuise à ramper dans le boyau.', damage: '1d4', setback: 'Le groupe arrive fatigué : pas de repos court possible avant une heure.', success: 'Il rampe à bon rythme jusqu’à la sortie.' },
};

/** L'épreuve d'un sentier, ou rien s'il se suit sans jet (sûr ou praticable). */
export function trailHazard(t: { title: string; trace?: string }, profile: TrailProfile): Hazard | null {
  const level = profile.danger.level;
  if (level <= 2) return null;
  const n = norm(t.title);
  const base = BY_NAME.find(([re]) => re.test(n))?.[1] ?? BY_TRACE[t.trace ?? ''] ?? BY_TRACE.boyau;
  return { ...base, dc: base.dc + (level - 3) };
}

/** Modificateur d'une valeur de caractéristique (10 par défaut). */
export const abilityMod = (score?: number) => Math.floor(((score ?? 10) - 10) / 2);
