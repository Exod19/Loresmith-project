/** Types du générateur d'intérieurs (src/maps/world/interior.js). */
import type { AtlasAnchor, AtlasConnection, AtlasFeature, AtlasGeometry, AtlasMap, AtlasSpace } from '../atlas/types';
import type { Binding, Period, Resident, Season, Slot } from './generate';

export function generateInterior(p: { slot: Slot; planId: string; siteId: string; parentSiteId: string; bound?: Binding; period?: Period; residents?: Resident[]; season?: Season; climate?: 'froid' | 'tempere' | 'chaud' }): {
  map: AtlasMap; features: AtlasFeature[]; geometries: AtlasGeometry[]; anchors: AtlasAnchor[]; space: AtlasSpace; entryId: string;
  levels: { map: AtlasMap; features: AtlasFeature[]; geometries: AtlasGeometry[]; anchors: AtlasAnchor[]; space: AtlasSpace }[]; connections: AtlasConnection[];
};
export function isHiddenNpc(npc: { role?: string; desc?: string }): boolean;
