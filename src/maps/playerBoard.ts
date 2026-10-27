/**
 * Instantanés envoyés à l'écran joueur. Ce module est le seul à décider de ce que voient les joueurs :
 * il part de la vue joueurs (sans notes, repères secrets ni jetons cachés) et ne garde que le plan montré.
 */
import type { AtlasData } from './atlas/types';
import { mapDataFor, restrictToPlan, DEFAULT_BATTLE, type MapRecord } from './mapStore';
import type { PlayerBoard, PlayerToken } from '../present/stage';

/** Carte telle que les joueurs la voient, sur le plan choisi. */
export function mapBoard(rec: MapRecord, atlas: AtlasData, planId: string): PlayerBoard {
  return { mode: 'map', title: rec.title, planId, data: restrictToPlan(mapDataFor(rec, atlas, false), planId) };
}

/** Combat tel que les joueurs le voient : jetons visibles seulement, sans points de vie ni CA. */
export function battleBoard(rec: MapRecord): PlayerBoard {
  const b = rec.battle ?? DEFAULT_BATTLE;
  const tokens: PlayerToken[] = b.tokens
    .filter((t) => t.visible)
    .map(({ id, name, kind, x, y, size }) => ({ id, name, kind, x, y, size }));
  return {
    mode: 'battle', title: rec.title, backdrop: rec.image, cols: b.cols, rows: b.rows,
    feetPerCell: b.feetPerCell, round: b.round, tokens, terrain: b.terrain?.grid,
  };
}
