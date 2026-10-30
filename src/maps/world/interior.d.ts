/** Types du générateur d'intérieurs (src/maps/world/interior.js). */
import type { AtlasAnchor, AtlasFeature, AtlasGeometry, AtlasMap, AtlasSpace } from '../atlas/types';
import type { Binding, Slot } from './generate';

export function generateInterior(p: { slot: Slot; planId: string; siteId: string; parentSiteId: string; bound?: Binding }): {
  map: AtlasMap; features: AtlasFeature[]; geometries: AtlasGeometry[]; anchors: AtlasAnchor[]; space: AtlasSpace; entryId: string;
};
export function isHiddenNpc(npc: { role?: string; desc?: string }): boolean;
