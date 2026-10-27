/**
 * Instantanés envoyés à l'écran joueur. Ce module est le seul à décider de ce que voient les joueurs :
 * il part de la vue joueurs (sans notes, repères secrets ni jetons cachés) et ne garde que le plan montré.
 */
import type { AtlasData } from './atlas/types';
import { mapDataFor, restrictToPlan, DEFAULT_BATTLE, type MapRecord } from './mapStore';
import { effectiveGrid } from './battle/terrain';
import type { PlayerBoard, PlayerElement, PlayerToken } from '../present/stage';

/** Carte telle que les joueurs la voient, sur le plan choisi, centrée sur `focus` si le MJ l'a demandé. */
export function mapBoard(rec: MapRecord, atlas: AtlasData, planId: string, focus?: { id: string; tick: number }): PlayerBoard {
  return { mode: 'map', title: rec.title, planId, data: restrictToPlan(mapDataFor(rec, atlas, false), planId), focus };
}

/** Combat tel que les joueurs le voient : jetons visibles seulement, sans points de vie ni CA. */
export function battleBoard(rec: MapRecord): PlayerBoard {
  const b = rec.battle ?? DEFAULT_BATTLE;
  const tokens: PlayerToken[] = b.tokens
    .filter((t) => t.visible)
    .map(({ id, name, kind, x, y, size, icon, image }) => ({ id, name, kind, x, y, size, icon, image }));
  const local = b.local;
  // Les joueurs ne voient que les éléments visibles : un passage secret n'existe pour eux qu'une fois découvert.
  const visible = (local?.elements ?? []).map((e, i) => ({ e, i })).filter(({ e }) => !e.secret || (local?.discovered ?? []).includes(e.id));
  const elements: PlayerElement[] = visible.map(({ e }) => ({
    id: e.id, kind: e.kind, title: e.title, category: e.category, cell: e.cell,
  }));
  const terrain = b.terrain
    ? effectiveGrid(b.terrain.grid, local?.elements ?? [], local?.discovered ?? [], (local?.elements ?? []).map((e) => e.id))
    : undefined;
  return {
    mode: 'battle', title: rec.title, backdrop: rec.image, cols: b.cols, rows: b.rows,
    feetPerCell: b.feetPerCell, round: b.round, tokens, terrain, elements,
  };
}
