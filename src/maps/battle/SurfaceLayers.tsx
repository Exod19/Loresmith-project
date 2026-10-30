/**
 * Couches visuelles du terrain de combat (surface.ts) : zones aux contours naturels, éléments, murs, et pour le MJ la
 * surcouche de vérification des règles. Le dessin d'une zone reprend exactement la courbe qui classe les cases ;
 * seul un léger fondu adoucit le bord (les cases de bordure trompeuses sont signalées au MJ).
 */
import type { ReactNode } from 'react';
import {
  categoryOf, OBJECT_DEF, outlineOf, TERRAIN_DEF, texUrl, wallEdges, zoneWidth,
  type BattleObject, type BattleWall, type Category, type SurfaceRules, type TerrainId, type TerrainZone,
} from './surface';
import type { Spot } from './movement';

export type SurfaceView = { zones?: TerrainZone[]; objects?: BattleObject[]; walls?: BattleWall[] };

/** Motif de texture d'un terrain : les nouvelles textures couvrent 3 cases, celles des cavernes une case. */
const tile = (t: TerrainId) => (TERRAIN_DEF[t]?.tex.startsWith('terrains/') ? 3 : 1);
export const texId = (t: string) => `tx-${t}`;

export function TexturePatterns({ ids }: { ids: Iterable<TerrainId> }) {
  return (
    <>
      {[...new Set(ids)].filter((t) => TERRAIN_DEF[t]).map((t) => (
        <pattern key={t} id={texId(t)} patternUnits="userSpaceOnUse" width={tile(t)} height={tile(t)}>
          <rect width={tile(t)} height={tile(t)} fill={TERRAIN_DEF[t].color} />
          <image href={texUrl(TERRAIN_DEF[t].tex)} width={tile(t)} height={tile(t)} preserveAspectRatio="none" />
        </pattern>
      ))}
    </>
  );
}

const pathOf = (pts: [number, number][], closed: boolean) =>
  pts.length ? `M${pts.map((p) => `${p[0].toFixed(3)} ${p[1].toFixed(3)}`).join('L')}${closed ? 'Z' : ''}` : '';

const prio = (z: TerrainZone) => z.priority ?? TERRAIN_DEF[z.terrain]?.priority ?? 0;
const WATER = new Set<TerrainId>(['eau_peu_profonde', 'eau_profonde', 'gue']);

/** Filtres : bord légèrement irrégulier et fondu (apparence seulement). */
export const SURFACE_FILTERS = (
  <>
    <filter id="zone-edge" x="-5%" y="-5%" width="110%" height="110%" filterUnits="objectBoundingBox">
      <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="7" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="0.14" xChannelSelector="R" yChannelSelector="G" result="d" />
      <feGaussianBlur in="d" stdDeviation="0.06" />
    </filter>
    <filter id="zone-shore" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="0.12" />
    </filter>
    <filter id="obj-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="0.06" />
    </filter>
    <radialGradient id="rock-shade" cx="35%" cy="30%" r="75%">
      <stop offset="0" stopColor="#b9b2a6" /><stop offset="0.55" stopColor="#7d766b" /><stop offset="1" stopColor="#3f3a33" />
    </radialGradient>
    <radialGradient id="leaf-shade" cx="40%" cy="35%" r="70%">
      <stop offset="0" stopColor="#7aa04a" /><stop offset="0.6" stopColor="#3f6a2a" /><stop offset="1" stopColor="#1f3a17" />
    </radialGradient>
    <radialGradient id="bush-shade" cx="40%" cy="35%" r="70%">
      <stop offset="0" stopColor="#6b8f3c" /><stop offset="1" stopColor="#24401b" />
    </radialGradient>
    <radialGradient id="wood-shade" cx="40%" cy="35%" r="70%">
      <stop offset="0" stopColor="#a87a48" /><stop offset="1" stopColor="#4b331d" />
    </radialGradient>
  </>
);

/** Zones de terrain, de la moins prioritaire à la plus prioritaire : celle qu'on voit au-dessus est celle qui compte. */
export function ZonesLayer({ zones, cols, rows }: { zones: TerrainZone[]; cols: number; rows: number }) {
  const sorted = [...zones].filter((z) => TERRAIN_DEF[z.terrain]).sort((a, b) => prio(a) - prio(b) || (a.id < b.id ? 1 : -1));
  return (
    <g className="surface-zones" pointerEvents="none">
      {sorted.map((z) => {
        const o = outlineOf(z);
        const d = pathOf(o, z.shape === 'area');
        const mask = `zm-${z.id}`;
        const shape = z.shape === 'area'
          ? <path d={d} fill="white" filter="url(#zone-edge)" />
          : <path d={d} fill="none" stroke="white" strokeWidth={zoneWidth(z)} strokeLinecap="round" strokeLinejoin="round" filter="url(#zone-edge)" />;
        return (
          <g key={z.id}>
            <mask id={mask} maskUnits="userSpaceOnUse" x={0} y={0} width={cols} height={rows}>{shape}</mask>
            {/* Berge : une ombre douce sous l'eau. */}
            {WATER.has(z.terrain) && (z.shape === 'area'
              ? <path d={d} fill="none" stroke="#1c1408" strokeOpacity={0.55} strokeWidth={0.28} filter="url(#zone-shore)" />
              : <path d={d} fill="none" stroke="#1c1408" strokeOpacity={0.5} strokeWidth={zoneWidth(z) + 0.28} strokeLinecap="round" strokeLinejoin="round" filter="url(#zone-shore)" />)}
            <rect x={0} y={0} width={cols} height={rows} fill={`url(#${texId(z.terrain)})`} mask={`url(#${mask})`} />
            {WATER.has(z.terrain) && <rect x={0} y={0} width={cols} height={rows} fill="#0b2a33" opacity={z.terrain === 'eau_profonde' ? 0.18 : 0.06} mask={`url(#${mask})`} />}
          </g>
        );
      })}
    </g>
  );
}

/** Graine stable par identifiant (formes de rochers). */
function seed(id: string) { let h = 2166136261; for (const c of id) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function blob(cx: number, cy: number, r: number, id: string, n = 9) {
  let s = seed(id);
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = r * (0.78 + rnd() * 0.3); pts.push([cx + Math.cos(a) * k, cy + Math.sin(a) * k]); }
  return pathOf(pts, true);
}

function objectArt(o: BattleObject): ReactNode {
  const d = OBJECT_DEF[o.kind];
  if (!d) return null;
  const { x, y } = o;
  switch (o.kind) {
    case 'rocher': case 'gros_rocher': {
      const r = (d.radius ?? 0.4) * 1.02;
      return (
        <>
          <path d={blob(x + 0.08, y + 0.1, r, o.id)} fill="#000" opacity={0.45} filter="url(#obj-shadow)" />
          <path d={blob(x, y, r, o.id)} fill="url(#rock-shade)" stroke="#2b2620" strokeWidth={0.03} />
          <path d={blob(x - r * 0.25, y - r * 0.25, r * 0.35, `${o.id}h`, 6)} fill="#fff" opacity={0.12} />
        </>
      );
    }
    case 'pierres':
      return [0, 1, 2, 3].map((i) => {
        const a = (seed(o.id + i) % 628) / 100, k = 0.18 + ((seed(o.id + i + 'k') % 10) / 100);
        return <path key={i} d={blob(x + Math.cos(a) * k, y + Math.sin(a) * k, 0.12, `${o.id}${i}`, 7)} fill="url(#rock-shade)" stroke="#2b2620" strokeWidth={0.02} />;
      });
    case 'arbre':
      return (
        <>
          <ellipse cx={x + 0.25} cy={y + 0.3} rx={1.05} ry={0.85} fill="#000" opacity={0.35} filter="url(#obj-shadow)" />
          {[[0, 0, 0.78], [-0.42, -0.2, 0.5], [0.4, -0.25, 0.48], [0.05, 0.42, 0.5], [-0.3, 0.3, 0.42]].map(([dx, dy, r], i) => (
            <circle key={i} cx={x + dx} cy={y + dy} r={r} fill="url(#leaf-shade)" opacity={0.93} />
          ))}
          <circle cx={x} cy={y} r={0.12} fill="#4b331d" opacity={0.6} />
        </>
      );
    case 'buisson':
      return [[0, 0, 0.36], [-0.2, -0.12, 0.24], [0.22, 0.1, 0.24]].map(([dx, dy, r], i) => <circle key={i} cx={x + dx} cy={y + dy} r={r} fill="url(#bush-shade)" />);
    case 'souche':
      return (<><circle cx={x} cy={y} r={0.3} fill="url(#wood-shade)" stroke="#2b1d10" strokeWidth={0.03} /><circle cx={x} cy={y} r={0.18} fill="none" stroke="#c9a06a" strokeWidth={0.02} opacity={0.6} /><circle cx={x} cy={y} r={0.08} fill="none" stroke="#c9a06a" strokeWidth={0.02} opacity={0.6} /></>);
    case 'tonneau':
      return (<><circle cx={x} cy={y} r={0.3} fill="url(#wood-shade)" stroke="#2b1d10" strokeWidth={0.03} /><circle cx={x} cy={y} r={0.24} fill="none" stroke="#6b6359" strokeWidth={0.04} /></>);
    case 'caisses':
      return (
        <g>
          <rect x={x - 0.42} y={y - 0.42} width={0.84} height={0.84} fill="url(#wood-shade)" stroke="#2b1d10" strokeWidth={0.04} />
          <path d={`M${x - 0.42} ${y - 0.42}L${x + 0.42} ${y + 0.42}M${x + 0.42} ${y - 0.42}L${x - 0.42} ${y + 0.42}`} stroke="#2b1d10" strokeWidth={0.04} opacity={0.7} />
        </g>
      );
    case 'fleurs':
      return [0, 1, 2, 3, 4].map((i) => {
        const a = (seed(o.id + i) % 628) / 100, k = (seed(o.id + i + 'r') % 30) / 100;
        return <circle key={i} cx={x + Math.cos(a) * k} cy={y + Math.sin(a) * k} r={0.06} fill={['#e8d36a', '#d98ac6', '#f2f2f2'][i % 3]} opacity={0.9} />;
      });
    case 'pont': case 'passerelle': {
      const len = o.len ?? d.len ?? 4, wid = o.wid ?? d.wid ?? 1;
      return (
        <g transform={`translate(${x} ${y}) rotate(${o.rot ?? 0})`}>
          <rect x={-len / 2 + 0.1} y={-wid / 2 + 0.12} width={len} height={wid} fill="#000" opacity={0.4} filter="url(#obj-shadow)" />
          <rect x={-len / 2} y={-wid / 2} width={len} height={wid} fill={`url(#${texId('pont')})`} stroke="#2b1d10" strokeWidth={0.05} />
          {Array.from({ length: Math.max(1, Math.round(len)) + 1 }, (_, i) => -len / 2 + (i * len) / Math.max(1, Math.round(len))).map((u, i) => (
            <g key={i}>
              <circle cx={u} cy={-wid / 2} r={0.07} fill="#3b2715" />
              <circle cx={u} cy={wid / 2} r={0.07} fill="#3b2715" />
            </g>
          ))}
          <path d={`M${-len / 2} ${-wid / 2}H${len / 2}M${-len / 2} ${wid / 2}H${len / 2}`} stroke="#5a3d20" strokeWidth={0.06} />
        </g>
      );
    }
  }
  return null;
}

/** Éléments posés (rochers, arbres, ponts…). `ghost` : cachés aux joueurs, estompés pour le MJ. */
export function ObjectsLayer({ objects, selectedId }: { objects: BattleObject[]; selectedId?: string | null }) {
  // Ponts d'abord (au ras de l'eau), puis le reste ; les arbres en dernier (leur feuillage passe au-dessus).
  const order = (o: BattleObject) => (OBJECT_DEF[o.kind]?.deck ? 0 : o.kind === 'arbre' ? 2 : 1);
  return (
    <g className="surface-objects" pointerEvents="none">
      {[...objects].sort((a, b) => order(a) - order(b)).map((o) => (
        <g key={o.id} opacity={o.hidden ? 0.5 : 1}>
          {objectArt(o)}
          {selectedId === o.id && <circle cx={o.x} cy={o.y} r={OBJECT_DEF[o.kind]?.deck ? 0.3 : (OBJECT_DEF[o.kind]?.radius ?? 0.4) + 0.12} fill="none" stroke="#ecd289" strokeWidth={0.06} strokeDasharray="0.12 0.08" />}
        </g>
      ))}
    </g>
  );
}

const WALL_STYLE: Record<string, { w: number; c: string; top: string; dash?: string }> = {
  mur: { w: 0.3, c: '#1e1914', top: '#b3a58c' },
  falaise: { w: 0.24, c: '#2e2619', top: '#c2b292', dash: '0.18 0.06' },
  muret: { w: 0.14, c: '#4a4036', top: '#9b8f7c', dash: '0.22 0.08' },
};
export function WallsLayer({ walls, selectedId }: { walls: BattleWall[]; selectedId?: string | null }) {
  return (
    <g className="surface-walls" pointerEvents="none">
      {walls.map((w) => {
        const s = WALL_STYLE[w.kind] ?? WALL_STYLE.mur;
        const d = pathOf(w.points, false);
        return (
          <g key={w.id}>
            <path d={d} fill="none" stroke="#000" strokeOpacity={0.4} strokeWidth={s.w + 0.1} strokeLinecap="square" strokeLinejoin="miter" transform="translate(0.06 0.08)" filter="url(#obj-shadow)" />
            <path d={d} fill="none" stroke={selectedId === w.id ? '#ecd289' : s.c} strokeWidth={s.w} strokeLinecap="square" strokeLinejoin="miter" />
            <path d={d} fill="none" stroke={s.top} strokeWidth={s.w * 0.4} strokeDasharray={s.dash} strokeLinecap="butt" opacity={0.85} />
          </g>
        );
      })}
    </g>
  );
}

const CAT_FILL: Record<Category, string> = {
  normal: 'rgba(110,200,120,0.16)', difficile: 'rgba(240,180,60,0.42)', special: 'rgba(70,150,240,0.45)', bloquee: 'rgba(210,50,40,0.5)', danger: 'rgba(240,60,200,0.48)',
};
export const CATEGORY_COLOR: Record<Category, string> = {
  normal: '#6ec878', difficile: '#f0b43c', special: '#4696f0', bloquee: '#d23228', danger: '#f03cc8',
};

/** Surcouche de vérification (MJ) : catégorie de chaque case, cases à vérifier, ponts et murs tels que les règles les voient. */
export function RulesOverlay({ rules, focus }: { rules: SurfaceRules; focus?: number | null }) {
  const { cols } = rules;
  const byCat: Record<Category, string[]> = { normal: [], difficile: [], special: [], bloquee: [], danger: [] };
  const amb: string[] = [], deck: string[] = [], fixed: string[] = [];
  rules.cells.forEach((c, i) => {
    const x = i % cols, y = Math.floor(i / cols);
    byCat[categoryOf(c)].push(`M${x + 0.04} ${y + 0.04}h0.92v0.92h-0.92z`);
    if (c.amb) amb.push(`M${x + 0.1} ${y + 0.1}h0.8v0.8h-0.8z`);
    if (c.deck) deck.push(`M${x + 0.2} ${y + 0.5}h0.6`);
    if (c.src === 'mj') fixed.push(`M${x + 0.78} ${y + 0.08}l0.14 0.14l-0.14 0.14l-0.14-0.14z`);
  });
  const edges = Object.entries(rules.walls).map(([k, kind]) => {
    const [x, y] = k.slice(1).split(',').map(Number);
    return { d: k[0] === 'h' ? `M${x} ${y}h1` : `M${x} ${y}v1`, kind };
  });
  return (
    <g className="surface-overlay" pointerEvents="none">
      {(Object.keys(byCat) as Category[]).map((k) => <path key={k} d={byCat[k].join('')} fill={CAT_FILL[k]} />)}
      <path d={byCat.bloquee.map((p) => p.replace(/h0\.92v0\.92h-0\.92z/, 'l0.92 0.92')).join('')} stroke="rgba(255,220,210,0.45)" strokeWidth={0.04} />
      <path d={deck.join('')} stroke="#7fe0ff" strokeWidth={0.12} strokeLinecap="round" opacity={0.85} />
      <path d={amb.join('')} fill="none" stroke="#fff" strokeWidth={0.06} strokeDasharray="0.12 0.08" />
      <path d={fixed.join('')} fill="#ecd289" stroke="#0b0906" strokeWidth={0.02} />
      {edges.map((e, i) => <path key={i} d={e.d} stroke={e.kind === 'mur' ? '#ff4b3a' : e.kind === 'falaise' ? '#4696f0' : '#f0b43c'} strokeWidth={0.12} strokeLinecap="round" />)}
      {focus != null && <rect x={focus % cols} y={Math.floor(focus / cols)} width={1} height={1} fill="none" stroke="#ecd289" strokeWidth={0.08} />}
    </g>
  );
}

/** Trajet prévu : de centre de case en centre de case, coût et verdict au bout. */
export type PathView = { steps: Spot[]; size: number; ok: boolean; possible: boolean; label: string };
export function PathPreview({ path }: { path: PathView }) {
  const h = path.size / 2;
  const pts = path.steps.map((s) => [s.x + h, s.y + h] as [number, number]);
  const end = pts[pts.length - 1];
  const tone = !path.possible ? '#ff5a46' : path.ok ? '#7fe0d0' : '#f0b43c';
  return (
    <g className="surface-path" pointerEvents="none">
      {pts.length > 1 && <path d={pathOf(pts, false)} fill="none" stroke="#0b0906" strokeWidth={0.2} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />}
      {pts.length > 1 && <path d={pathOf(pts, false)} fill="none" stroke={tone} strokeWidth={0.09} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.22 0.12" />}
      {pts.slice(1, -1).map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={0.07} fill={tone} />)}
      {end && <circle cx={end[0]} cy={end[1]} r={0.2 * path.size} fill="none" stroke={tone} strokeWidth={0.07} />}
      {end && path.label && (
        <text x={end[0]} y={end[1] - 0.32 * path.size - 0.1} textAnchor="middle" fontSize={0.3} fill={tone} stroke="#0b0906" strokeWidth={0.06} paintOrder="stroke" fontFamily="Cinzel, serif">{path.label}</text>
      )}
    </g>
  );
}

/** Textures nécessaires : zones, ponts, socles. */
export function texturesOf(view: SurfaceView, extra: (TerrainId | null | undefined)[] = []): TerrainId[] {
  const ids = new Set<TerrainId>();
  for (const z of view.zones ?? []) ids.add(z.terrain);
  if (view.objects?.some((o) => OBJECT_DEF[o.kind]?.deck)) ids.add('pont');
  for (const t of extra) if (t) ids.add(t);
  return [...ids];
}

/** Arêtes d'un mur (pour un test de clic). */
export { wallEdges };
