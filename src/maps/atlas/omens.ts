/**
 * Annonces aux joueurs pendant une halte en chemin : le suspense (« C'est tranquille… trop tranquille… »), la fausse
 * alerte, puis la rencontre elle-même (avec son illustration). Les phrases varient d'une halte à l'autre.
 */
import type { Encounter, Entry } from './encounters';

export type HaltAlert = {
  key: string; phase: 'suspense' | 'calm' | 'encounter'; line: string; at: number;
  title?: string; text?: string; image?: string;
};

const SUSPENSE = [
  'C’est tranquille… trop tranquille…',
  'Chut ! J’ai entendu quelque chose…',
  'Un caillou roule, quelque part devant vous…',
  'La flamme des lanternes vacille sans un souffle d’air…',
  'Vous avez la désagréable impression d’être observés…',
  'Un silence épais tombe sur la galerie…',
  'Une odeur nouvelle flotte dans l’air…',
  'Au loin, un écho qui n’est pas celui de vos pas…',
  'Quelque chose a bougé, à la limite de la lumière…',
  'Les parois semblent retenir leur souffle…',
];

const CALM = [
  'Ah non, ce n’est rien.',
  'Fausse alerte. Le silence reprend ses droits.',
  'Juste une goutte d’eau dans le noir… On repart.',
  'Rien. Seulement l’écho de vos propres pas.',
  'Un rat file entre les pierres. Rien de plus.',
  'Les ombres se tiennent tranquilles… pour cette fois.',
  'Vos nerfs vous jouent des tours. La route est libre.',
];

const HEADLINE: Record<Entry['kind'], string[]> = {
  Créature: ['Quelque chose surgit de l’ombre !', 'Le noir s’anime !', 'Vous n’êtes pas seuls…'],
  Convoi: ['Une caravane approche sur le chemin…', 'Des lueurs et des bruits de pas : un convoi arrive.'],
  Travailleurs: ['Des silhouettes au travail, droit devant…', 'Des bruits d’outils résonnent dans la galerie…'],
  Voyageurs: ['Des voyageurs croisent votre route…', 'D’autres marcheurs sortent de l’obscurité…'],
  Patrouille: ['Des silhouettes armées barrent le passage !', 'Halte-là ! On vous a repérés…'],
  Signe: ['Quelque chose attire votre attention…', 'Vous remarquez un détail troublant…'],
};

const any = <X,>(list: X[]) => list[Math.floor(Math.random() * list.length)];

/** Ce que les joueurs peuvent lire d'une rencontre : les premières phrases, sans les DD ni les consignes au MJ. */
export function playerText(text: string) {
  const out: string[] = [];
  for (const s of text.split(/(?<=[.!?…])\s+/)) {
    if (/\bDD\b|\(|\d+d\d+|Sagesse|Intelligence|Dextérité|Force|Constitution|Charisme|échec/i.test(s)) break;
    out.push(s);
  }
  return out.join(' ');
}

export const suspenseAlert = (): HaltAlert => ({ key: `${Date.now()}`, phase: 'suspense', line: any(SUSPENSE), at: Date.now() });
export const calmAlert = (): HaltAlert => ({ key: `${Date.now()}`, phase: 'calm', line: any(CALM), at: Date.now() });

export function encounterAlert(e: Encounter, image?: string): HaltAlert | null {
  if (!e.happens || !e.entry) return null;
  return {
    key: `${Date.now()}`, phase: 'encounter', at: Date.now(), line: any(HEADLINE[e.entry.kind] ?? HEADLINE.Créature),
    title: e.entry.title, text: playerText(e.entry.text) || undefined, image,
  };
}

/** Durée d'affichage de la fausse alerte chez les joueurs. */
export const CALM_MS = 4500;
