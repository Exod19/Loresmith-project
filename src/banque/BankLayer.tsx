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
import { bankSrc, fitRoof, hash, maskFromParts, MIN_PX, pickElement, pickTexture, useBank, type BankImage } from './index';

type View = { x: number; y: number; w: number; h: number };
/** Un sprite : image centrée en (x, y), de w × h avant rotation, tournée de `a`, en miroir si `flip`. Sans image : le
 *  dessin vectoriel de repli (`d`, classe `cls`), pour qu'aucun objet ne disparaisse quand son tracé est masqué. */
type Sprite = { key: string; layer: 'arbres' | 'dessus'; img: BankImage | null; x: number; y: number; w: number; h: number; a: number; flip?: boolean; d?: string; cls?: string };

const SEASON_OF: Record<string, string> = { printemps: 'printemps', ete: 'ete', automne: 'automne', hiver: 'hiver' };
/** Mobilier et objets → ce qu'on cherche dans la banque (et le tracé vectoriel qu'il remplace). */
const PROPS: Record<string, { usage: string; cat?: string; decor: string }> = {
  lit: { usage: 'lit', decor: 'bed' }, table: { usage: 'table', decor: 'table' }, tonneau: { usage: 'tonneau', decor: 'barrel' },
  coffre: { usage: 'coffre', decor: 'chest' }, autel: { usage: 'autel', decor: 'altar' }, sarcophage: { usage: 'tombeau', decor: 'tomb' },
  colonne: { usage: 'colonne', cat: 'ruine', decor: 'pillar' }, bac: { usage: 'ecurie', decor: 'trough' },
  fontaine: { usage: 'place', cat: 'monument', decor: 'fountain' }, etal: { usage: 'marche', cat: 'marche', decor: '' }, auvent: { usage: 'marche', cat: 'marche', decor: '' },
};
/** Tracés vectoriels que la banque remplace, quand elle dessine. */
export const BANK_COVERS: Record<string, Set<string>> = {
  cite: new Set(['roof', 'roof-farm', 'roof-noble', 'roof-civic', 'keep', 'tree', 'fountain']),
  interieur: new Set(['table', 'bed', 'barrel', 'chest', 'altar', 'tomb', 'pillar', 'trough']),
};
/** La banque dessine-t-elle à ce zoom ? (une maison de 6 m, un meuble de 80 cm, doivent faire au moins MIN_PX pixels). */
export function bankActive(map: AtlasMap, pxPerUnit: number) {
  const s = map.surface;
  if (!s || (s.theme !== 'cite' && s.theme !== 'interieur')) return false;
  return pxPerUnit * ((s.theme === 'cite' ? 6 : 0.8) / s.scale) >= MIN_PX;
}

const rectD = (x: number, y: number, w: number, h: number, a: number) => {
  const c = Math.cos(a), sn = Math.sin(a);
  return 'M' + [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([u, v]) => `${(x + u * c - v * sn).toFixed(2)} ${(y + u * sn + v * c).toFixed(2)}`).join('L') + 'Z';
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
        const d = t[i + 2] * 2.3; // la couronne déborde le tronc posé par le plan
        out.push({ key: `t${i}`, layer: 'arbres', img, x: t[i], y: t[i + 1], w: d, h: d, a: ((hash(`${map.id}:ta${i}`) % 360) * Math.PI) / 180,
          d: img ? undefined : `M${t[i] - t[i + 2]} ${t[i + 1]}a${t[i + 2]} ${t[i + 2]} 0 1 0 ${t[i + 2] * 2} 0a${t[i + 2]} ${t[i + 2]} 0 1 0 ${-t[i + 2] * 2} 0`, cls: 'dc-tree' });
      }
      // Bâtiments : l'emprise entière (corps et ailes) reçoit un toit qui l'épouse ; à défaut, un toit par partie.
      const bx: number[][] = g.bx ?? [];
      const list = bx.length ? bx : Array.from({ length: Math.floor((g.b?.length ?? 0) / 5) }, (_, i) => [...g.b.slice(i * 5, i * 5 + 5), 0, 0, 1, 1]);
      list.forEach((e, i) => {
        const [x, y, W, D, ang] = e;
        const parts: number[][] = [];
        for (let k = 5; k + 3 < e.length; k += 4) parts.push(e.slice(k, k + 4));
        const seed = `${map.id}:b${i}`;
        const usage = W * D * s.scale * s.scale > 260 ? 'civique' : 'maison';
        const fit = fitRoof(images, { mask: maskFromParts(parts), w: W, h: D, climat: ctx.climat, usage, seed });
        const c = Math.cos(ang), sn = Math.sin(ang);
        if (fit) { out.push({ key: `b${i}`, layer: 'dessus', img: fit.img, x, y, w: fit.iw, h: fit.ih, a: ang + (fit.rot * Math.PI) / 2, flip: fit.flip }); return; }
        parts.forEach(([u0, v0, u1, v1], k) => {
          const pu = ((u0 + u1) / 2 - 0.5) * W, pv = ((v0 + v1) / 2 - 0.5) * D, pw = (u1 - u0) * W, pd = (v1 - v0) * D;
          const px = x + pu * c - pv * sn, py = y + pu * sn + pv * c;
          const f = fitRoof(images, { mask: maskFromParts([[0, 0, 1, 1]]), w: pw, h: pd, climat: ctx.climat, usage, seed: `${seed}:${k}` });
          out.push(f ? { key: `b${i}:${k}`, layer: 'dessus', img: f.img, x: px, y: py, w: f.iw, h: f.ih, a: ang + (f.rot * Math.PI) / 2, flip: f.flip }
            : { key: `b${i}:${k}`, layer: 'dessus', img: null, x: px, y: py, w: pw, h: pd, a: ang, d: rectD(px, py, pw, pd, ang), cls: 'dc-roof' });
        });
      });
    }
    // Objets posés (mobilier des intérieurs ; fontaine et étals de la place du marché).
    for (const [k, x, y, w, h, a0] of g.p ?? []) {
      const want = PROPS[k];
      if (!want) continue;
      const img = pickElement(images.filter((im) => im.usage?.includes(want.usage)), { cat: want.cat ?? 'mobilier', region: 'surface', seed: `${map.id}:${k}:${x}:${y}` });
      if (!img) { if (want.decor) out.push({ key: `p${k}${x}:${y}`, layer: 'dessus', img: null, x, y, w, h, a: a0, d: rectD(x, y, w, h, a0), cls: `dc-${want.decor}` }); continue; }
      // L'objet garde ses proportions dans son emplacement, tourné d'un quart de tour si l'emplacement est couché.
      const tw = Array.isArray(img.taille) ? img.taille : [1, 1];
      const r = tw[0] / tw[1], swap = (r >= 1) !== (w >= h);
      const [bw, bh] = swap ? [h, w] : [w, h];
      const k2 = Math.min(bw / r, bh) || 1;
      const turn = k === 'tonneau' || k === 'fontaine' ? a0 + ((hash(`${x}:${y}`) % 360) * Math.PI) / 180 : a0 + (swap ? Math.PI / 2 : 0) + (hash(`${x}:${y}`) % 2 ? Math.PI : 0);
      out.push({ key: `p${k}${x}:${y}`, layer: 'dessus', img, x, y, w: k2 * r, h: k2, a: turn });
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
 * Sprites visibles du plan. `layer` : 'arbres' (sous les rues) ou 'dessus' (toits, objets). `pxPerUnit` : pixels écran
 * par unité de plan ; `view` : partie visible, en unités de plan. Rien sous le seuil de netteté (bankActive) : le dessin
 * vectoriel suffit et reste affiché.
 */
export default function BankLayer({ map, layer, pxPerUnit, view }: { map: AtlasMap; layer: 'arbres' | 'dessus'; pxPerUnit: number; view: View }) {
  const images = useBank();
  const sprites = useSprites(map, images);
  if (!sprites.length || !bankActive(map, pxPerUnit)) return null;
  const pad = 30 / Math.max(pxPerUnit, 1e-6);
  const shown = sprites.filter((sp) => sp.layer === layer
    && sp.x > view.x - pad - sp.w && sp.x < view.x + view.w + pad + sp.w && sp.y > view.y - pad - sp.h && sp.y < view.y + view.h + pad + sp.h);
  if (!shown.length || shown.length > 3000) return null;
  return (
    <g className={`am-bank am-bank-${layer}`} aria-hidden>
      {shown.map((sp) => (sp.img ? (
        <image key={sp.key} href={bankSrc(sp.img, Math.max(sp.w, sp.h) * pxPerUnit)} x={-sp.w / 2} y={-sp.h / 2} width={sp.w} height={sp.h} preserveAspectRatio="none"
          transform={`translate(${sp.x} ${sp.y}) rotate(${(sp.a * 180) / Math.PI})${sp.flip ? ' scale(-1 1)' : ''}`} />
      ) : sp.d ? <path key={sp.key} d={sp.d} className={sp.cls} /> : null))}
    </g>
  );
}
