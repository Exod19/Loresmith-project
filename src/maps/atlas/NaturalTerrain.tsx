/**
 * Couche « terrain naturel » des plans de cité : herbe, terre nue, chemins de terre fondus en une seule surface, pavés
 * des places (voir world/naturalTerrain.js). Dessinée sous les champs, rivières, bâtiments et libellés, dans la même
 * transformation de caméra que le plan. Jamais sur la carte du monde, les intérieurs ni l'Atlas des profondeurs.
 *
 * Tuiles : un niveau de détail par puissance de deux (pixels par mètre), 256 px par tuile, calculées une à une hors du
 * fil du rendu (une par tâche) et gardées en cache (96 au plus). Les tuiles plus grossières déjà prêtes restent dessous
 * pendant qu'arrivent les fines : pas de trou en zoomant.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AtlasMap } from './types';
import { createTerrain, paintTile, paletteOf } from '../world/naturalTerrain';

type View = { x: number; y: number; w: number; h: number };
type Tile = { key: string; lvl: number; tx: number; ty: number; url: string };

const TILE_PX = 256;
const LEVELS = [0.25, 0.5, 1, 2, 4, 8]; // pixels par mètre
const MAX_TILES = 96;

const seedOf = (s: string) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 100000; };

/** Polygones d'un tracé SVG « M x y L x y … Z » (places, cours). */
function polygonsOf(d: string): number[][][] {
  return d.split(/M/i).map((part) => {
    const n = part.replace(/[ZLz]/g, ' ').trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
    const pts: number[][] = [];
    for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]]);
    return pts;
  }).filter((p) => p.length >= 3);
}

export function naturalTerrainOn(map: AtlasMap) {
  return map.surface?.theme === 'cite';
}

export default function NaturalTerrain({ map, pxPerUnit, view }: { map: AtlasMap; pxPerUnit: number; view: View }) {
  const s = map.surface!;
  const scale = s.scale;
  // La scène en mètres : routes (rues, chemins, pontons) et places. Recréée quand le plan change.
  const scene = useMemo(() => {
    const g = s.ground;
    const roads = (g.roads ?? []).map((r) => {
      const points: number[][] = [];
      for (let i = 0; i + 1 < r.pts.length; i += 2) points.push([r.pts[i] * scale, r.pts[i + 1] * scale]);
      return { points, width: Math.max(1.2, r.hw * 2 * scale) };
    }).filter((r) => r.points.length >= 2);
    const plazas = (map.decor ?? []).filter((x) => x.kind === 'square' || x.kind === 'court')
      .flatMap((x) => polygonsOf(x.d)).map((pts) => ({ points: pts.map(([x, y]) => [x * scale, y * scale]) }));
    const palette = paletteOf({ climate: s.climate, season: s.season, snow: s.snow });
    return { terrain: createTerrain({ seed: seedOf(map.id), roads, plazas, palette }), plazas, key: `${map.id}:${s.climate}:${s.season}:${s.snow ?? 0}:${roads.length}` };
  }, [map.id, map.decor, s, scale]);

  const cache = useRef(new Map<string, Tile>());
  const queue = useRef<{ key: string; lvl: number; tx: number; ty: number }[]>([]);
  const [, setVersion] = useState(0);
  // Nouvelle scène : on vide le cache (les adresses des images sont libérées).
  useEffect(() => () => { for (const t of cache.current.values()) URL.revokeObjectURL(t.url); cache.current.clear(); queue.current = []; }, [scene]);

  // Niveau de détail : le plus proche de la densité réelle (pixels écran × densité de l'écran, par mètre).
  const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
  const ppm = (pxPerUnit / scale) * dpr;
  const lvl = LEVELS.reduce((b, l) => (Math.abs(Math.log2(l) - Math.log2(ppm)) < Math.abs(Math.log2(b) - Math.log2(ppm)) ? l : b), LEVELS[0]);
  const tileM = TILE_PX / lvl;
  const vx0 = view.x * scale, vy0 = view.y * scale, vx1 = (view.x + view.w) * scale, vy1 = (view.y + view.h) * scale;
  const tx0 = Math.floor(vx0 / tileM), tx1 = Math.floor(vx1 / tileM), ty0 = Math.floor(vy0 / tileM), ty1 = Math.floor(vy1 / tileM);
  const wanted: { key: string; lvl: number; tx: number; ty: number }[] = [];
  if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) <= 80) {
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) wanted.push({ key: `${lvl}:${tx}:${ty}`, lvl, tx, ty });
  }
  const wantedKey = wanted.map((w) => w.key).join('|');

  useEffect(() => {
    // Les tuiles manquantes, du centre vers les bords ; les demandes obsolètes sont abandonnées.
    const cx = (tx0 + tx1) / 2, cy = (ty0 + ty1) / 2;
    queue.current = wanted.filter((w) => !cache.current.has(w.key)).sort((a, b) => Math.hypot(a.tx - cx, a.ty - cy) - Math.hypot(b.tx - cx, b.ty - cy));
    let stop = false;
    const step = () => {
      if (stop) return;
      const next = queue.current.shift();
      if (!next) return;
      const size = TILE_PX / next.lvl;
      const bytes = paintTile(scene.terrain, scene.plazas, next.tx * size, next.ty * size, size, TILE_PX);
      const c = document.createElement('canvas');
      c.width = c.height = TILE_PX;
      c.getContext('2d')?.putImageData(new ImageData(bytes, TILE_PX, TILE_PX), 0, 0);
      c.toBlob((blob) => {
        if (stop || !blob) return;
        cache.current.set(next.key, { ...next, url: URL.createObjectURL(blob) });
        // Cache borné : on retire les plus anciennes (jamais celles qu'on regarde).
        const keep = new Set(wanted.map((w) => w.key));
        for (const [k, t] of cache.current) {
          if (cache.current.size <= MAX_TILES) break;
          if (!keep.has(k)) { URL.revokeObjectURL(t.url); cache.current.delete(k); }
        }
        setVersion((v) => v + 1);
        setTimeout(step, 0);
      }, 'image/webp', 0.9);
    };
    const t = setTimeout(step, 0);
    return () => { stop = true; clearTimeout(t); };
  }, [wantedKey, scene]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dessous : les tuiles plus grossières déjà prêtes qui recouvrent la vue ; dessus : celles du niveau courant.
  const shown = [...cache.current.values()].filter((t) => {
    const size = TILE_PX / t.lvl;
    return t.lvl <= lvl && t.tx * size < vx1 && (t.tx + 1) * size > vx0 && t.ty * size < vy1 && (t.ty + 1) * size > vy0;
  }).sort((a, b) => a.lvl - b.lvl);
  return (
    <g className="am-natural" aria-hidden>
      {shown.map((t) => {
        const sizeU = TILE_PX / t.lvl / scale;
        // Un soupçon de recouvrement évite le filet de jointure entre tuiles voisines.
        return <image key={t.key} href={t.url} x={t.tx * sizeU} y={t.ty * sizeU} width={sizeU * 1.004} height={sizeU * 1.004} preserveAspectRatio="none" />;
      })}
    </g>
  );
}
