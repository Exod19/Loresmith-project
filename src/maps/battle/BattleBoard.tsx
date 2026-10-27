/**
 * Plateau de combat sur grille (5 pieds par case). Sert à la console MJ (interactif) et à l'écran joueur (lecture seule).
 * Le terrain est dessiné avec de vraies textures (SVG), les lieux et créatures avec des icônes.
 */
import { useEffect, useRef } from 'react';
import type { PlayerElement, PlayerToken } from '../../present/stage';
import type { TerrainKind } from './terrain';
import { CATEGORY_IMG, vignette } from './vignettes';

export type BoardToken = PlayerToken & { selected?: boolean; hidden?: boolean };

/** Élément du plateau. `ghost` : secret non découvert, visible du MJ seulement (pointillés + DC). */
export type BoardElement = PlayerElement & { cells?: number[]; ghost?: boolean; dc?: number };

/** Portées d'une créature (MJ seulement) : cases atteignables, et anneau de portée d'attaque. */
export type BoardRange = { id: string; x: number; y: number; size: number; move: number[]; attack: number; selected: boolean };

type Props = {
  cols: number;
  rows: number;
  backdrop?: string;
  /** Terrain effectif (cols × rows caractères, cf. terrain.ts). */
  terrain?: string;
  elements?: BoardElement[];
  /** Portées à afficher (MJ seulement, absentes sur l'écran joueur). */
  ranges?: BoardRange[];
  tokens: BoardToken[];
  /** Présent = mode MJ : la grille accepte les clics. */
  interactive?: boolean;
  onToken?: (id: string) => void;
  onCell?: (x: number, y: number) => void;
  onHover?: (x: number, y: number) => void;
  onElement?: (id: string) => void;
};

/** Icône de chaque catégorie de lieu. */
export const CATEGORY_ICON: Record<string, string> = {
  eau: '💧', danger: '☠️', ruine: '🏛️', grotte: '🪨', ressource: '💎', vivant: '🍄', garde: '🛡️',
  sanctuaire: '🕯️', institution: '🏛️', cite: '🏘️', voie: '🚪', indetermine: '❔',
};

const KIND_FILL: Record<PlayerToken['kind'], string> = { pc: '#54d8c6', monster: '#c0492f', other: '#c9a24a' };

/** Textures du terrain (public/images/combat-map/variants) : quatre variantes par type, tirées au sort de façon
 *  stable pour chaque case. Une image par case, posée sur la grille : une répétition de motif donnait des rayures. */
const TEX_URL = (name: string) => `${import.meta.env.BASE_URL}images/combat-map/variants/${name}.webp`;
const TILE_FILE: Partial<Record<TerrainKind, string>> = {
  '.': 'sol', '#': 'roche', '~': 'eau', ':': 'eboulis', '=': 'pont', X: 'gouffre', ',': 'decor', I: 'pilier',
};
const VARIANTS = 4;
const TILE_BASE: Record<string, string> = {
  sol: '#2b241b', roche: '#4a3c2a', eau: '#1d4a5b', eboulis: '#3e3429', pont: '#8a6a2c', gouffre: '#030303', decor: '#2b241b', pilier: '#4a3c2a',
};
/** Taille d'une case dans le canevas de terrain (pixels). Le canevas est ensuite mis à l'échelle par le CSS. */
const CELL_PX = 64;
const imageCache = new Map<string, Promise<HTMLImageElement>>();
function loadTile(file: string): Promise<HTMLImageElement> {
  let p = imageCache.get(file);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = TEX_URL(file);
    });
    imageCache.set(file, p);
  }
  return p;
}

/** Variante stable d'une case (0 à VARIANTS-1), dérivée de son index : le terrain ne scintille pas d'un rendu à l'autre. */
const variantOf = (i: number) => ((i * 2654435761) >>> 0) % VARIANTS;

/** Dessine le terrain case par case dans le canevas : une variante de texture par case, avec la couleur de base dessous. */
async function paintTerrain(canvas: HTMLCanvasElement, cols: number, rows: number, terrain: string | undefined) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = cols * CELL_PX; canvas.height = rows * CELL_PX;
  ctx.fillStyle = TILE_BASE.sol;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!terrain) return;
  const keys = Array.from(terrain, (k, i) => {
    const file = TILE_FILE[k as TerrainKind] ?? 'sol';
    return `${file}_${String(variantOf(i) + 1).padStart(2, '0')}`;
  });
  const names = [...new Set(keys)];
  const images = Object.fromEntries(await Promise.all(names.map(async (f) => [f, await loadTile(f).catch(() => null)])));
  Array.from(terrain).forEach((k, i) => {
    const file = TILE_FILE[k as TerrainKind] ?? 'sol';
    const x = (i % cols) * CELL_PX, y = Math.floor(i / cols) * CELL_PX;
    ctx.fillStyle = TILE_BASE[file] ?? TILE_BASE.sol;
    ctx.fillRect(x, y, CELL_PX, CELL_PX);
    const img = images[keys[i]];
    if (img) ctx.drawImage(img, x, y, CELL_PX, CELL_PX);
  });
}

const TEXTURES = (
  <defs>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
      <feComponentTransfer><feFuncA type="linear" slope="0.12" /></feComponentTransfer>
    </filter>
  </defs>
);

const cellPath = (cells: number[], cols: number) =>
  cells.map((i) => `M${i % cols} ${Math.floor(i / cols)}h1v1h-1z`).join('');

export default function BattleBoard({ cols, rows, backdrop, terrain, elements = [], ranges = [], tokens, interactive, onToken, onCell, onHover, onElement }: Props) {
  const lines: string[] = [];
  for (let x = 0; x <= cols; x++) lines.push(`M${x} 0V${rows}`);
  for (let y = 0; y <= rows; y++) lines.push(`M0 ${y}H${cols}`);
  const cells = interactive ? Array.from({ length: cols * rows }, (_, i) => ({ x: i % cols, y: Math.floor(i / cols) })) : [];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) void paintTerrain(canvasRef.current, cols, rows, terrain);
  }, [cols, rows, terrain]);

  return (
    <div className="battle-stack">
      <canvas ref={canvasRef} className="battle-terrain" aria-hidden="true" />
    <svg className="battle-board" viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Plateau de combat">
      {TEXTURES}
      {backdrop && <image href={backdrop} x={0} y={0} width={cols} height={rows} preserveAspectRatio="xMidYMid slice" opacity={0.55} />}

      <path d={lines.join('')} stroke="rgba(201,162,74,.22)" strokeWidth={0.03} fill="none" pointerEvents="none" />

      {ranges.map((r) => (
        <g key={`range-${r.id}`} pointerEvents="none">
          {r.move.length > 0 && <path d={cellPath(r.move, cols)} fill="rgba(84,216,198,0.18)" opacity={r.selected ? 1 : 0.7} />}
          <rect
            x={r.x - r.attack} y={r.y - r.attack} width={r.size + 2 * r.attack} height={r.size + 2 * r.attack}
            fill="none" stroke="#e0603f" strokeWidth={r.selected ? 0.1 : 0.05} strokeDasharray="0.25 0.15" opacity={r.selected ? 1 : 0.6}
          />
        </g>
      ))}

      {elements.map((e) => {
        if (e.kind === 'passage') {
          if (!e.cells) return null;
          // Passage secret non découvert (MJ seulement) : contour pointillé sur ses cases.
          if (e.ghost) return <path key={`g-${e.id}`} d={cellPath(e.cells, cols)} fill="rgba(236,210,137,0.16)" stroke="#ecd289" strokeWidth={0.07} strokeDasharray="0.15 0.1" opacity={0.95} pointerEvents="none"><title>{`${e.title} (secret, visible du MJ seulement)`}</title></path>;
          // Passage secret découvert : teinte violette, distincte des chemins ordinaires.
          if (e.secret) return <path key={`s-${e.id}`} d={cellPath(e.cells, cols)} fill="rgba(156,123,214,0.32)" stroke="#9c7bd6" strokeWidth={0.05} pointerEvents="none"><title>{`${e.title} (passage secret)`}</title></path>;
          return null;
        }
        if (e.cell === undefined) return null;
        const cx = (e.cell % cols) + 0.5, cy = Math.floor(e.cell / cols) + 0.5;
        const img = e.ghost ? vignette('element_cache') : CATEGORY_IMG[e.category] ? vignette(CATEGORY_IMG[e.category]) : undefined;
        const clip = `clip-el-${e.id.replace(/[^a-zA-Z0-9]/g, '')}`;
        return (
          <g key={e.id} className="battle-element" onClick={onElement ? () => onElement(e.id) : undefined} opacity={e.ghost ? 0.85 : 1}>
            {img ? (
              <>
                <clipPath id={clip}><circle cx={cx} cy={cy} r={0.4} /></clipPath>
                <image href={img} x={cx - 0.4} y={cy - 0.4} width={0.8} height={0.8} clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMid slice" />
                <circle cx={cx} cy={cy} r={0.4} fill="none" stroke={e.ghost ? '#ecd289' : '#7d6128'} strokeWidth={0.05} strokeDasharray={e.ghost ? '0.1 0.07' : undefined} />
              </>
            ) : (
              <>
                <circle cx={cx} cy={cy} r={0.4} fill="#0b0906" stroke={e.ghost ? '#ecd289' : '#7d6128'} strokeWidth={0.05} strokeDasharray={e.ghost ? '0.1 0.07' : undefined} />
                <text x={cx} y={cy + 0.14} textAnchor="middle" fontSize={0.42} pointerEvents="none">{CATEGORY_ICON[e.category] ?? '◆'}</text>
              </>
            )}
            <title>{e.ghost ? `${e.title} (secret)${e.dc ? ` · DC ${e.dc}` : ''}` : e.title}</title>
          </g>
        );
      })}

      {tokens.map((t) => {
        const r = t.size * 0.42;
        const cx = t.x + t.size / 2, cy = t.y + t.size / 2;
        return (
          <g key={t.id} className="battle-token" opacity={t.hidden ? 0.4 : 1} onClick={interactive && onToken ? (e) => { e.stopPropagation(); onToken(t.id); } : undefined}>
            {t.image ? (
              <>
                <clipPath id={`clip-${t.id}`}><circle cx={cx} cy={cy} r={r} /></clipPath>
                <image href={t.image} x={cx - r} y={cy - r} width={2 * r} height={2 * r} clipPath={`url(#clip-${t.id})`} preserveAspectRatio="xMidYMid slice" />
                <circle cx={cx} cy={cy} r={r} fill="none" stroke={t.selected ? '#ecd289' : '#0b0906'} strokeWidth={t.selected ? 0.12 : 0.05} strokeDasharray={t.hidden ? '0.12 0.08' : undefined} />
              </>
            ) : (
              <>
                <circle cx={cx} cy={cy} r={r} fill={KIND_FILL[t.kind]} stroke={t.selected ? '#ecd289' : '#0b0906'} strokeWidth={t.selected ? 0.12 : 0.05} strokeDasharray={t.hidden ? '0.12 0.08' : undefined} />
                <text x={cx} y={cy + r * 0.35} textAnchor="middle" fontSize={r * 1.1} pointerEvents="none">{t.icon ?? '◆'}</text>
              </>
            )}
            <text x={cx} y={cy - r - 0.08} textAnchor="middle" fontSize={0.22} fill="#ecd289" fontFamily="Cinzel, serif" pointerEvents="none" stroke="#0b0906" strokeWidth={0.04} paintOrder="stroke">
              {t.name}
            </text>
          </g>
        );
      })}

      {interactive && cells.map((c) => (
        <rect
          key={`${c.x}-${c.y}`} x={c.x} y={c.y} width={1} height={1} fill="transparent" className="battle-cell"
          onClick={() => onCell?.(c.x, c.y)}
          onPointerEnter={() => onHover?.(c.x, c.y)}
        />
      ))}
    </svg>
    </div>
  );
}
