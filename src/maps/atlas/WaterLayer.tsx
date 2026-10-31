/**
 * Rivières, lacs et mer des plans de cité, dessinés en matières de la Banque Loresmith.
 *
 * - Les formes viennent du plan (rivières : polylignes et demi-largeur ; lacs et mer : polygones) et restent
 *   indépendantes des textures : les matières sont des motifs à échelle constante (leur taille réelle en mètres),
 *   ancrés au plan, jamais étirés le long d'une rivière.
 * - Profondeur : eau peu profonde partout, eau profonde révélée progressivement vers le milieu (rivières) ou loin du
 *   rivage (lacs, mer), par des paliers superposés dans un masque.
 * - Berges : tirées des contours, une bande de terre mouillée (ou de sable) qui s'estompe vers la terre.
 * - Confluences : toutes les rivières sont dans le même masque, leurs traits se fondent sans couture.
 * - Animation légère facultative : les motifs dérivent lentement (désactivée en mode statique, avec « réduire les
 *   animations » du système, et sur l'eau gelée).
 */
import { useMemo, useSyncExternalStore } from 'react';
import type { AtlasMap } from './types';
import { bankSrc, pickTexture, useBank, type BankImage } from '../../banque';
import { bankColor, depthSteps, shoreSteps, waterMaterials, waterScene } from './water';

/* ——— Réglage : eau animée ou statique (par navigateur) ——— */
const MOTION_KEY = 'loresmith:eau-animee';
const motionListeners = new Set<() => void>();
function readMotion(): boolean {
  try {
    const v = localStorage.getItem(MOTION_KEY);
    if (v !== null) return v === '1';
  } catch { /* stockage indisponible */ }
  return !(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}
let motion = typeof window !== 'undefined' ? readMotion() : false;
export function setWaterMotion(on: boolean) {
  motion = on;
  try { localStorage.setItem(MOTION_KEY, on ? '1' : '0'); } catch { /* pour la session */ }
  motionListeners.forEach((f) => f());
}
export function useWaterMotion() {
  return useSyncExternalStore((f) => { motionListeners.add(f); return () => motionListeners.delete(f); }, () => motion, () => false);
}

/** Les plans où l'eau est dessinée par cette couche (et dont les tracés vectoriels d'eau s'effacent). */
export function waterLayerOn(map: AtlasMap) {
  return map.surface?.theme === 'cite' && !!map.surface.ground.water?.length;
}
export const WATER_COVERS = new Set(['river', 'sea', 'beach', 'lake', 'lake-ice', 'stream']);

const tileOf = (img: BankImage | null, scale: number) => (typeof img?.taille === 'number' ? img.taille : 8) / scale;
const pickWater = (images: BankImage[], tags: string[], climat: string, seed: string) => {
  for (const t of tags) {
    const got = pickTexture(images.filter((i) => i.usage?.includes(t)), { cats: ['eau'], climat, seed });
    if (got) return got;
  }
  return pickTexture(images, { cats: ['eau'], climat, seed });
};

export default function WaterLayer({ map, pxPerUnit, animate }: { map: AtlasMap; pxPerUnit: number; animate: boolean }) {
  const s = map.surface!;
  const images = useBank();
  const scene = useMemo(() => waterScene(s.ground), [s.ground]);
  const climat = s.climate ?? 'tempere';
  const id = `w${map.id.replace(/[^a-z0-9]/gi, '').slice(-12)}`;
  const mats = useMemo(() => {
    const river = waterMaterials({ climate: climat, kind: 'riviere' }), sea = waterMaterials({ climate: climat, kind: 'mer' });
    return {
      rShallow: pickWater(images, river.shallow, climat, `${map.id}:rs`), rDeep: pickWater(images, river.deep, climat, `${map.id}:rd`),
      lShallow: pickWater(images, sea.shallow, climat, `${map.id}:ls`), lDeep: pickWater(images, sea.deep, climat, `${map.id}:ld`),
      ice: pickTexture(images, { cats: ['glace'], seed: `${map.id}:g` }),
    };
  }, [images, climat, map.id]);
  if (!scene.bounds) return null;

  const scale = s.scale;
  const [bx0, by0, bx1, by1] = scene.bounds;
  const pad = 40 / scale;
  const box = { x: bx0 - pad, y: by0 - pad, width: bx1 - bx0 + 2 * pad, height: by1 - by0 + 2 * pad };
  const iceRivers = s.frozen === 'tout' || s.frozen === 'rivieres';
  const iceLakes = s.frozen === 'tout';
  const moving = animate && !iceRivers;
  const snow = s.snow ?? 0;

  /** Motif à échelle constante (taille réelle de la matière), dérivant lentement si l'eau est animée. */
  const pattern = (pid: string, img: BankImage | null, drift: [number, number], dur: number, still = false) => {
    if (!img) return null;
    const T = tileOf(img, scale);
    return (
      <pattern key={pid} id={pid} patternUnits="userSpaceOnUse" width={T} height={T}>
        <image href={bankSrc(img, T * pxPerUnit)} x={0} y={0} width={T} height={T} preserveAspectRatio="none" />
        {moving && !still && <animateTransform attributeName="patternTransform" type="translate" from="0 0" to={`${drift[0] * T} ${drift[1] * T}`} dur={`${dur}s`} repeatCount="indefinite" />}
      </pattern>
    );
  };
  const riverBank = 2.4 / scale, shoreBank = 7 / scale;
  const rivers = scene.rivers, lakes = scene.lakes;

  return (
    <g className="am-water" aria-hidden>
      <defs>
        {pattern(`${id}-rs`, iceRivers ? mats.ice : mats.rShallow, [1, 0.35], 160, iceRivers)}
        {pattern(`${id}-rd`, mats.rDeep, [-0.6, 0.5], 220)}
        {pattern(`${id}-ls`, iceLakes ? mats.ice : mats.lShallow, [0.7, -0.3], 180, iceLakes)}
        {pattern(`${id}-ld`, mats.lDeep, [-0.5, -0.4], 240)}
        {/* Formes : toutes les rivières dans un même masque (confluences sans couture), lacs et mer pleins. */}
        <mask id={`${id}-shape-r`} maskUnits="userSpaceOnUse" {...box}>
          {rivers.map((r, i) => <path key={i} d={r.d} fill="none" stroke="#fff" strokeWidth={2 * r.hw} strokeLinecap="round" strokeLinejoin="round" />)}
        </mask>
        <mask id={`${id}-shape-l`} maskUnits="userSpaceOnUse" {...box}>
          {lakes.map((l, i) => <path key={i} d={l.d} fill="#fff" />)}
        </mask>
        {/* Profondeur : paliers concentriques (rivières) ; rivage peu profond (lacs, mer). */}
        <mask id={`${id}-depth-r`} maskUnits="userSpaceOnUse" {...box}>
          {rivers.flatMap((r, i) => depthSteps(r.hw).map((st, k) => (
            <path key={`${i}:${k}`} d={r.d} fill="none" stroke="#fff" strokeOpacity={st.opacity} strokeWidth={st.width} strokeLinecap="round" strokeLinejoin="round" />
          )))}
        </mask>
        <mask id={`${id}-depth-l`} maskUnits="userSpaceOnUse" {...box}>
          {lakes.map((l, i) => <path key={`f${i}`} d={l.d} fill="#fff" />)}
          {lakes.flatMap((l, i) => shoreSteps(14 / scale).map((st, k) => (
            <path key={`s${i}:${k}`} d={l.d} fill="none" stroke="#000" strokeOpacity={st.opacity} strokeWidth={st.width} strokeLinejoin="round" />
          )))}
        </mask>
      </defs>

      {/* Berges, depuis les contours : terre mouillée (ou sable) près de l'eau, qui s'estompe vers la terre. */}
      {[[3, 0.14], [2.2, 0.16], [1.5, 0.2], [1, 0.26]].map(([k, op]) => (
        <g key={k} opacity={op} fill="none" stroke={bankColor({ climate: climat, snow })} strokeLinecap="round" strokeLinejoin="round">
          {rivers.map((r, i) => <path key={i} d={r.d} strokeWidth={2 * r.hw + 2 * k * riverBank} />)}
          {lakes.map((l, i) => <path key={`l${i}`} d={l.d} strokeWidth={2 * k * shoreBank} stroke={bankColor({ climate: climat, snow, sea: true })} />)}
        </g>
      ))}

      {/* Rivières : eau peu profonde, puis eau profonde révélée vers le milieu. */}
      {rivers.length > 0 && (
        <>
          <rect {...box} fill={`url(#${id}-rs)`} mask={`url(#${id}-shape-r)`} />
          {!iceRivers && mats.rDeep && <g mask={`url(#${id}-shape-r)`}><rect {...box} fill={`url(#${id}-rd)`} mask={`url(#${id}-depth-r)`} /></g>}
        </>
      )}
      {/* Lacs et mer : haut-fond le long du rivage, eau profonde au large. */}
      {lakes.length > 0 && (
        <>
          <rect {...box} fill={`url(#${id}-ls)`} mask={`url(#${id}-shape-l)`} />
          {!iceLakes && mats.lDeep && <g mask={`url(#${id}-shape-l)`}><rect {...box} fill={`url(#${id}-ld)`} mask={`url(#${id}-depth-l)`} /></g>}
        </>
      )}
      {/* Liseré du bord de l'eau : un reflet clair, fin, qui suit les contours. */}
      <g fill="none" stroke="#e8f0ea" strokeOpacity={0.18} strokeLinejoin="round">
        {lakes.map((l, i) => <path key={i} d={l.d} strokeWidth={0.8 / scale} />)}
      </g>
    </g>
  );
}
