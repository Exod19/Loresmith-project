/**
 * Cavernes de l'Atlas en strates, habillées avec la Banque Loresmith (dossiers « Outreterre » du Drive) :
 *  - sols et parois en texture de roche, ancrées au plan (elles ne glissent pas quand on zoome) ;
 *  - une texture grossière, visible de loin, et une fine qui apparaît en zoomant ;
 *  - du décor posé dans chaque caverne (stalagmites, champignons, cristaux, éboulis, flaques, ossements), toujours le
 *    même pour une caverne donnée.
 *
 * Une strate couvre plusieurs dizaines de kilomètres : à taille réelle, une stalagmite n'y ferait pas un pixel. Le
 * décor est donc symbolique, à l'échelle de la caverne, et ne se dessine qu'une fois assez grand à l'écran.
 * L'Atlas d'origine n'en reçoit pas : seul l'Atlas en strates est habillé.
 */
import { useMemo } from 'react';
import type { Cavity } from '../maps/atlas/types';
import { bankSrc, hash, useBank, type BankImage } from './index';

type View = { x: number; y: number; w: number; h: number };
type Tex = { id: string; src: string; tile: number; px: number };

const BASE_TILE = 1 / 26; // texture grossière : un 26e de la largeur du plan
const FINE_TILE = 1 / 420; // texture fine : un 420e
/** Décor des cavernes : catégories de la banque et poids du tirage. */
const DECOR: [string, number][] = [['stalagmite', 5], ['souterrain', 5], ['rocher', 4], ['champignon', 3], ['cristal', 2], ['sol', 2], ['flaque', 2], ['ossements', 1]];
const MIN_SPRITE_PX = 16;

const deep = (i: BankImage) => !i.exclu && (i.region ?? ['surface']).includes('outreterre');
const rnd = (seed: string) => { let z = hash(seed) || 1; return () => ((z = (Math.imul(z, 1664525) + 1013904223) >>> 0) / 4294967296); };

/** Textures du sol, de la paroi et du grain fin, choisies pour un plan (toujours les mêmes pour ce plan). */
export function useCaveTextures(mapId: string, W: number, pxPerUnit: number, on: boolean) {
  const images = useBank();
  const zoomStep = Math.round(Math.log2(Math.max(1e-3, pxPerUnit)) * 2);
  return useMemo(() => {
    const out: { floor?: Tex; fine?: Tex; wall?: Tex } = {};
    if (!on) return out;
    const rocks = images.filter((i) => i.type === 'texture' && deep(i) && (i.cat === 'roche' || i.cat === 'vase') && !i.usage?.includes('tactique'));
    if (!rocks.length) return out;
    const pick = (want: RegExp, salt: string) => {
      const c = rocks.filter((i) => want.test(i.nom));
      const list = c.length ? c : rocks;
      return list[hash(`${mapId}:${salt}`) % list.length];
    };
    const floor = pick(/sol de caverne|roche sombre/i, 'sol');
    const wall = pick(/roche-m.re|calcaire/i, 'paroi');
    const fine = pick(/sol de caverne|limon|roche sombre/i, 'grain');
    const safe = mapId.replace(/[^a-z0-9]/gi, '');
    const mk = (img: BankImage, tile: number, key: string): Tex => ({ id: `cv-${key}-${safe}`, src: bankSrc(img, tile * pxPerUnit), tile, px: tile * pxPerUnit });
    out.floor = mk(floor, W * BASE_TILE, 'sol');
    out.wall = mk(wall, W * BASE_TILE * 1.4, 'paroi');
    const f = mk(fine, W * FINE_TILE, 'grain');
    if (f.px >= 48) out.fine = f;
    return out;
  }, [mapId, W, images, on, zoomStep]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Définitions <pattern> des textures de caverne. */
export function CavePatterns({ tex }: { tex: ReturnType<typeof useCaveTextures> }) {
  return (
    <>
      {[tex.floor, tex.wall, tex.fine].filter(Boolean).map((t) => (
        <pattern key={t!.id} id={t!.id} patternUnits="userSpaceOnUse" width={t!.tile} height={t!.tile}>
          <image href={t!.src} x={0} y={0} width={t!.tile} height={t!.tile} preserveAspectRatio="none" />
        </pattern>
      ))}
    </>
  );
}

/** Opacité du grain fin : il naît quand une tuile fine dépasse ~48 px, plein vers ~160 px. */
export const fineOpacity = (t?: Tex) => (t ? Math.min(1, Math.max(0, (t.px - 48) / 112)) * 0.5 : 0);

type Sprite = { key: string; img: BankImage; x: number; y: number; w: number; h: number; a: number; flip: boolean };

/** Décor tiré pour chaque caverne (calculé une fois par plan). */
function useCaveSprites(mapId: string, cavities: Cavity[], W: number, H: number, on: boolean) {
  const images = useBank();
  return useMemo(() => {
    const out: Sprite[] = [];
    if (!on) return out;
    const pools = DECOR.map(([cat, w]) => ({ w, list: images.filter((i) => i.type === 'element' && deep(i) && i.cat === cat && i.vue === 'zenith') })).filter((p) => p.list.length);
    const total = pools.reduce((s, p) => s + p.w, 0);
    if (!total) return out;
    cavities.forEach((c, ci) => {
      const r = rnd(`${mapId}:cv${ci}:${c.seed}`);
      const rx = c.rx * W, ry = c.ry * H;
      const n = Math.max(3, Math.min(12, Math.round(Math.sqrt(rx * ry) / (W * 0.009))));
      for (let k = 0; k < n; k++) {
        let x = r() * total, pool = pools[0];
        for (const p of pools) { x -= p.w; if (x < 0) { pool = p; break; } }
        const img = pool.list[Math.floor(r() * pool.list.length)];
        // Dans l'ellipse, loin du bord (la paroi ondule) ; un amas près d'une paroi plutôt qu'au centre.
        const ang = r() * Math.PI * 2, dist = 0.35 + r() * 0.38;
        const size = Math.sqrt(rx * ry) * (0.16 + r() * 0.14) * (img.cat === 'sol' || img.cat === 'flaque' ? 1.25 : 1);
        const ratio = img.ratio || 1;
        out.push({ key: `${ci}-${k}`, img, x: c.cx * W + Math.cos(ang) * rx * dist, y: c.cy * H + Math.sin(ang) * ry * dist,
          w: ratio >= 1 ? size : size * ratio, h: ratio >= 1 ? size / ratio : size, a: r() * 360, flip: r() < 0.5 });
      }
    });
    // Le sol (traces, croûtes, flaques) passe sous les volumes (stalagmites, rochers).
    return out.sort((a, b) => Number(b.img.cat === 'sol' || b.img.cat === 'flaque') - Number(a.img.cat === 'sol' || a.img.cat === 'flaque'));
  }, [mapId, cavities, W, H, images, on]);
}

/** Décor visible des cavernes : seulement ce qui tombe dans la vue et fait au moins MIN_SPRITE_PX pixels. */
export function CaveDecor({ mapId, cavities, W, H, pxPerUnit, view, on }: { mapId: string; cavities: Cavity[]; W: number; H: number; pxPerUnit: number; view: View; on: boolean }) {
  const sprites = useCaveSprites(mapId, cavities, W, H, on);
  if (!sprites.length) return null;
  const shown = sprites.filter((s) => Math.max(s.w, s.h) * pxPerUnit >= MIN_SPRITE_PX
    && s.x + s.w > view.x && s.x - s.w < view.x + view.w && s.y + s.h > view.y && s.y - s.h < view.y + view.h);
  if (!shown.length || shown.length > 1500) return null;
  return (
    <g className="am-cave-decor" aria-hidden pointerEvents="none">
      {shown.map((s) => (
        <image key={s.key} href={bankSrc(s.img, Math.max(s.w, s.h) * pxPerUnit)} x={-s.w / 2} y={-s.h / 2} width={s.w} height={s.h} preserveAspectRatio="none"
          transform={`translate(${s.x} ${s.y}) rotate(${s.a})${s.flip ? ' scale(-1 1)' : ''}`} />
      ))}
    </g>
  );
}
