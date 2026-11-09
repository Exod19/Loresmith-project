/**
 * Cavernes de l'Atlas en strates, habillées avec la Banque Loresmith (dossiers « Outreterre » du Drive) :
 *  - sols et parois en texture de roche, ancrées au plan (elles ne glissent pas quand on zoome) ;
 *  - une texture grossière, visible de loin, et une fine qui apparaît en zoomant ;
 *  - du décor posé dans chaque caverne (éboulis, stalagmites, champignons, cristaux, flaques), toujours le même pour
 *    une caverne donnée, en trois paliers de taille qui se révèlent en fondu à mesure qu'on zoome ; assombri pour se
 *    fondre dans la pénombre de la caverne.
 *
 * Une strate couvre plusieurs dizaines de kilomètres : à taille réelle, une stalagmite n'y ferait pas un pixel. Le
 * décor est donc symbolique, à l'échelle de la caverne, et ne se dessine qu'une fois assez grand à l'écran.
 * L'Atlas d'origine n'en reçoit pas : seul l'Atlas en strates est habillé.
 */
import { useMemo } from 'react';
import type { Cavity } from '../maps/atlas/types';
import { bankSrc, hash, noUpscale, useBank, type BankImage } from './index';

type View = { x: number; y: number; w: number; h: number };
type Tex = { id: string; src: string; tile: number; px: number };

const BASE_TILE = 1 / 26; // texture grossière : un 26e de la largeur du plan
const FINE_TILE = 1 / 420; // texture fine : un 420e
/** Décor des cavernes : catégories de la banque et poids du tirage. */
const DECOR: [string, number][] = [['rocher', 6], ['stalagmite', 5], ['souterrain', 4], ['champignon', 2], ['cristal', 1], ['flaque', 1]];
const MIN_SPRITE_PX = 10;

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

type Sprite = { key: string; img: BankImage; x: number; y: number; w: number; h: number; a: number; flip: boolean; flat: boolean };

/**
 * Trois paliers de décor, du plus grand au plus fin : quelques amas visibles de loin, puis des blocs, puis du menu
 * détail. Chaque palier a une taille presque fixe (à ±12 % près) par rapport à la caverne : rien de démesuré.
 * `k` : taille (part du rayon moyen de la caverne) ; `per` : nombre par unité de rayon ; `edge` : distance au centre.
 */
const TIERS = [
  { k: 0.075, per: 1.4, max: 3, edge: [0.45, 0.72] },
  { k: 0.032, per: 4, max: 9, edge: [0.5, 0.82] },
  { k: 0.014, per: 9, max: 20, edge: [0.55, 0.88] },
];
/** Une image trop claire (os blanchis, soufre vif) crèverait la pénombre : on la laisse au plateau de combat. */
const luma = (hex: string) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };

/** Décor tiré pour chaque caverne (calculé une fois par plan). */
function useCaveSprites(mapId: string, cavities: Cavity[], W: number, H: number, on: boolean) {
  const images = useBank();
  return useMemo(() => {
    const out: Sprite[] = [];
    if (!on) return out;
    const pools = DECOR.map(([cat, w]) => ({ w, list: images.filter((i) => i.type === 'element' && deep(i) && i.cat === cat && i.vue === 'zenith' && luma(i.couleur || '#555555') < 0.42) })).filter((p) => p.list.length);
    const total = pools.reduce((s, p) => s + p.w, 0);
    if (!total) return out;
    cavities.forEach((c, ci) => {
      const r = rnd(`${mapId}:cv${ci}:${c.seed}`);
      const rx = c.rx * W, ry = c.ry * H, R = Math.sqrt(rx * ry);
      const unit = R / (W * 0.012); // rayon de la caverne, en « unités » (une petite caverne ≈ 1)
      TIERS.forEach((tier, ti) => {
        const n = Math.max(ti === 0 ? 1 : 2, Math.min(tier.max, Math.round(unit * tier.per)));
        for (let k = 0; k < n; k++) {
          let x = r() * total, pool = pools[0];
          for (const p of pools) { x -= p.w; if (x < 0) { pool = p; break; } }
          const img = pool.list[Math.floor(r() * pool.list.length)];
          // Plutôt au pied des parois qu'au milieu de la salle, comme les éboulis et les concrétions.
          const ang = r() * Math.PI * 2, dist = tier.edge[0] + r() * (tier.edge[1] - tier.edge[0]);
          const size = R * tier.k * (0.88 + r() * 0.24);
          const ratio = Math.min(1.6, Math.max(0.6, img.ratio || 1));
          out.push({ key: `${ci}-${ti}-${k}`, img, x: c.cx * W + Math.cos(ang) * rx * dist, y: c.cy * H + Math.sin(ang) * ry * dist,
            w: ratio >= 1 ? size : size * ratio, h: ratio >= 1 ? size / ratio : size, a: r() * 360, flip: r() < 0.5, flat: img.cat === 'sol' || img.cat === 'flaque' });
        }
      });
    });
    // Le sol (traces, flaques) passe sous les volumes (stalagmites, rochers).
    return out.sort((a, b) => Number(b.flat) - Number(a.flat));
  }, [mapId, cavities, W, H, images, on]);
}

/** Fondu d'apparition : invisible sous MIN_SPRITE_PX pixels, entier vers 3,5 fois ce seuil ; jamais tout à fait opaque. */
const revealOf = (px: number) => Math.min(1, Math.max(0, (px - MIN_SPRITE_PX) / (MIN_SPRITE_PX * 2.5))) * 0.85;

/** Décor visible des cavernes : ce qui tombe dans la vue, en fondu selon sa taille à l'écran. */
export function CaveDecor({ mapId, cavities, W, H, pxPerUnit, view, on }: { mapId: string; cavities: Cavity[]; W: number; H: number; pxPerUnit: number; view: View; on: boolean }) {
  const sprites = useCaveSprites(mapId, cavities, W, H, on);
  if (!sprites.length) return null;
  const shown = sprites.filter((s) => Math.max(s.w, s.h) * pxPerUnit > MIN_SPRITE_PX
    && s.x + s.w > view.x && s.x - s.w < view.x + view.w && s.y + s.h > view.y && s.y - s.h < view.y + view.h);
  if (!shown.length) return null;
  // Trop d'éléments à la fois (vue large sur une zone dense) : on garde les plus grands, déjà visibles.
  const list = shown.length > 1200 ? [...shown].sort((a, b) => b.w - a.w).slice(0, 1200) : shown;
  return (
    <g className="am-cave-decor" aria-hidden pointerEvents="none">
      {list.map((s) => {
        const px0 = Math.max(s.w, s.h) * pxPerUnit, k = noUpscale(s.img, px0), px = px0 * k, w = s.w * k, h = s.h * k;
        return (
          <image key={s.key} href={bankSrc(s.img, px)} x={-w / 2} y={-h / 2} width={w} height={h} preserveAspectRatio="xMidYMid meet" opacity={revealOf(px) * (s.flat ? 0.7 : 1)}
            transform={`translate(${s.x} ${s.y}) rotate(${s.a})${s.flip ? ' scale(-1 1)' : ''}`} />
        );
      })}
    </g>
  );
}
