/**
 * Un intérieur porte les traces de ce qui lui est arrivé (cf. placeStates, mémoire du monde) : en ruine après un
 * incendie, il ne reste qu'une partie du mobilier, noirci ; en chantier, presque rien (on a tout sorti) ; délaissé, tout
 * est là, sous la poussière ; reconstruit, il est neuf. Le même tri pour un même meuble (graine), en navigation et en combat.
 */
import type { BoardFurniture } from '../mapStore';

export type PlaceEtat = 'ruine' | 'chantier' | 'reconstruit' | 'delaisse';

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };

/** Part du mobilier qui reste, selon l'état. */
const KEEP: Record<PlaceEtat, number> = { ruine: 0.35, chantier: 0.15, delaisse: 1, reconstruit: 1 };

export function furnitureFor<T extends Pick<BoardFurniture, 'seed' | 'k'>>(list: T[] | undefined, etat?: string): T[] | undefined {
  if (!list || !etat || !(etat in KEEP)) return list;
  const keep = KEEP[etat as PlaceEtat];
  return keep >= 1 ? list : list.filter((f, i) => hash(`${f.seed}:${f.k}:${i}:${etat}`) < keep);
}

/** Ce que voient les héros en entrant, pour le MJ. */
export const PLACE_LOOK: Record<PlaceEtat, { icon: string; text: string }> = {
  ruine: { icon: '🔥', text: 'Carcasse noircie : poutres effondrées, cendres et gravats (terrain difficile par endroits), presque plus de mobilier.' },
  chantier: { icon: '🏗', text: 'Chantier : échafaudages, tas de pierres et de planches, ouvriers le jour ; le mobilier a été sorti.' },
  delaisse: { icon: '🕸', text: 'Délaissé : poussière épaisse, toiles d’araignée, odeur de renfermé ; des traces de passage récentes ?' },
  reconstruit: { icon: '✨', text: 'Reconstruit : bois neuf, peinture fraîche, quelques souvenirs de l’ancien bâtiment.' },
};
