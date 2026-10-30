/**
 * Calques de la Banque Loresmith sur les plans de navigation (cités et intérieurs ; jamais sur la carte du monde ni sur
 * l'Atlas des profondeurs) : arbres et toits à leur taille réelle, mobilier des intérieurs, sols en texture.
 *
 * Taille : un objet de L mètres mesure L / (mètres par pixel) à l'écran ; sous MIN_PX pixels, il n'est pas dessiné
 * (le dessin vectoriel suffit). Netteté : la version d'image (256, 512 ou 1024 px) suit la taille à l'écran, sans jamais
 * agrandir l'original. Orientation : un toit suit son bâtiment, un arbre ou un meuble prend l'angle qui lui va.
 */
import { useMemo } from 'react';
import type { AtlasMap } from '../maps/atlas/types';
import { bankSrc, hash, MIN_PX, pickElement, pickTexture, roofAngle, useBank, type BankImage } from './index';

type View = { x: number; y: number; w: number; h: number };
type Sprite = { key: string; img: BankImage; x: number; y: number; w: number; h: number; a: number };

const SEASON_OF: Record<string, string> = { printemps: 'printemps', ete: 'ete', automne: 'automne', hiver: 'hiver' };
/** Mobilier des intérieurs → ce qu'on cherche dans la banque. */
const PROPS: Record<string, { usage: string; cat?: string }> = {
  lit: { usage: 'lit' }, table: { usage: 'table' }, tonneau: { usage: 'tonneau' }, coffre: { usage: 'coffre' },
  autel: { usage: 'autel' }, sarcophage: { usage: 'tombeau' }, colonne: { usage: 'colonne', cat: 'ruine' }, bac: { usage: 'ecurie' },
};

/** Les sprites d'un plan (calculés une fois par plan et par saison : la vue ne fait que trier ce qui se voit). */
function useSprites(map: AtlasMap, images: BankImage[]) {
  return useMemo(() => {
    const s = map.surface;
    const out: Sprite[] = [];
    if (!s || s.theme === 'monde') return out;
    const ctx = { climat: s.climate ?? 'tempere', saison: s.season ? SEASON_OF[s.season] : undefined, region: 'surface' };
    const g = s.ground;
    if (s.theme === 'cite') {
      const t = g.t ?? [];
      for (let i = 0; i + 2 < t.length; i += 3) {
        const img = pickElement(images, { cat: 'arbre', ...ctx, milieu: 'ville', seed: `${map.id}:t${i}` });
        if (!img) continue;
        const d = t[i + 2] * 2.3; // la couronne déborde le tronc posé par le plan
        out.push({ key: `t${i}`, img, x: t[i], y: t[i + 1], w: d, h: d, a: ((hash(`${map.id}:ta${i}`) % 360) * Math.PI) / 180 });
      }
      const b = g.b ?? [];
      for (let i = 0; i + 4 < b.length; i += 5) {
        const [x, y, w, d, ang] = [b[i], b[i + 1], b[i + 2], b[i + 3], b[i + 4]];
        const area = w * d * s.scale * s.scale, ratio = Math.max(w, d) / Math.max(0.01, Math.min(w, d));
        const seed = `${map.id}:b${i}`;
        // L'emprise est un rectangle : seuls les toits rectangulaires ou carrés la couvrent sans laisser voir de coin.
        const big = area > 260;
        const img = pickElement(images, { cat: 'toit', ...ctx, saison: undefined, formes: ['rect', 'carre'], forme: ratio > 1.5 ? 'rect' : 'carre', ratio, usage: big ? 'civique' : 'maison', seed });
        if (!img) continue;
        const a = roofAngle(img, w, d, ang, seed);
        const r = img.taille && Array.isArray(img.taille) ? img.taille[0] / img.taille[1] : img.ratio;
        const swap = (r >= 1) !== (w >= d);
        out.push({ key: `b${i}`, img, x, y, w: swap ? d : w, h: swap ? w : d, a });
      }
    } else if (s.theme === 'interieur') {
      for (const [k, x, y, w, h, a0] of g.p ?? []) {
        const want = PROPS[k];
        if (!want) continue;
        const img = pickElement(images.filter((im) => im.usage?.includes(want.usage)), { cat: want.cat ?? 'mobilier', region: 'surface', seed: `${map.id}:${k}:${x}:${y}` });
        if (!img || !img.usage?.includes(want.usage)) continue;
        // Le meuble garde ses proportions dans son emplacement, tourné d'un quart de tour si l'emplacement est couché.
        const tw = Array.isArray(img.taille) ? img.taille : [1, 1];
        const r = tw[0] / tw[1], swap = (r >= 1) !== (w >= h);
        const [bw, bh] = swap ? [h, w] : [w, h];
        const k2 = Math.min(bw / r, bh) || 1;
        const turn = k === 'tonneau' ? a0 : a0 + (swap ? Math.PI / 2 : 0) + (hash(`${x}:${y}`) % 2 ? Math.PI : 0);
        out.push({ key: `p${k}${x}:${y}`, img, x, y, w: k2 * r, h: k2, a: turn });
      }
    }
    return out;
  }, [map.id, map.surface, images]);
}

/** Textures de sol (motifs SVG) : rendues seulement quand une tuile fait au moins 24 px à l'écran. */
export function useGroundTextures(map: AtlasMap, pxPerUnit: number) {
  const images = useBank();
  const s = map.surface;
  return useMemo(() => {
    const out: Record<string, { id: string; img: BankImage; tile: number; src: string }> = {};
    if (!s || s.theme === 'monde') return out;
    const ctx = { climat: s.climate ?? 'tempere', saison: s.season, region: 'surface' };
    const snowy = (s.snow ?? 0) >= 0.3;
    const wants: Record<string, string[]> = s.theme === 'interieur'
      ? { floor: ['planches'], 'floor-stone': ['dalles'] }
      : { plot: snowy ? ['neige'] : s.season === 'printemps' ? ['herbe', 'champ'] : ['champ', 'herbe', 'sable'], square: ['paves'], court: ['paves', 'dalles'] };
    for (const [kind, cats] of Object.entries(wants)) {
      const img = pickTexture(images, { cats, ...ctx, seed: `${map.id}:${kind}` });
      if (!img) continue;
      const tileM = typeof img.taille === 'number' ? img.taille : 5;
      const tile = tileM / s.scale; // unités de plan
      const px = tile * pxPerUnit;
      if (px < 24) continue;
      out[kind] = { id: `bk-${kind}-${map.id.replace(/[^a-z0-9]/gi, '')}`, img, tile, src: bankSrc(img, px) };
    }
    return out;
  }, [map.id, s, images, Math.round(Math.log2(Math.max(1, pxPerUnit)) * 2)]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Définitions <pattern> des textures de sol. */
export function GroundPatterns({ tex }: { tex: ReturnType<typeof useGroundTextures> }) {
  return (
    <>
      {Object.values(tex).map((t) => (
        <pattern key={t.id} id={t.id} patternUnits="userSpaceOnUse" width={t.tile} height={t.tile}>
          <image href={t.src} x={0} y={0} width={t.tile} height={t.tile} preserveAspectRatio="none" />
        </pattern>
      ))}
    </>
  );
}

/**
 * Sprites visibles du plan. `layer` : 'arbres' (sous les rues) ou 'dessus' (toits, mobilier). `pxPerUnit` : pixels
 * écran par unité de plan ; `view` : partie visible, en unités de plan.
 */
export default function BankLayer({ map, layer, pxPerUnit, view }: { map: AtlasMap; layer: 'arbres' | 'dessus'; pxPerUnit: number; view: View }) {
  const images = useBank();
  const sprites = useSprites(map, images);
  if (!sprites.length) return null;
  const pad = 30 / Math.max(pxPerUnit, 1e-6);
  const shown = sprites.filter((sp) => (layer === 'arbres') === sp.key.startsWith('t')
    && Math.max(sp.w, sp.h) * pxPerUnit >= MIN_PX
    && sp.x > view.x - pad - sp.w && sp.x < view.x + view.w + pad + sp.w && sp.y > view.y - pad - sp.h && sp.y < view.y + view.h + pad + sp.h);
  if (!shown.length || shown.length > 2500) return null;
  return (
    <g className={`am-bank am-bank-${layer}`} aria-hidden>
      {shown.map((sp) => {
        const px = Math.max(sp.w, sp.h) * pxPerUnit;
        return (
          <image key={sp.key} href={bankSrc(sp.img, px)} x={-sp.w / 2} y={-sp.h / 2} width={sp.w} height={sp.h} preserveAspectRatio="none"
            transform={`translate(${sp.x} ${sp.y}) rotate(${(sp.a * 180) / Math.PI})`} />
        );
      })}
    </g>
  );
}
