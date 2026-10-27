/**
 * Plateau de combat sur grille (5 pieds par case). Sert à la console MJ (interactif) et à l'écran joueur (lecture seule).
 * Le terrain est dessiné avec de vraies textures (SVG), les lieux et créatures avec des icônes.
 */
import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import type { PlayerElement, PlayerToken } from '../../present/stage';
import type { TerrainKind } from './terrain';
import { CATEGORY_IMG, vignette } from './vignettes';

/** `active` : c'est son tour. `hp`/`maxHp` : barre de vie (MJ seulement). */
export type BoardToken = PlayerToken & { selected?: boolean; hidden?: boolean; active?: boolean; hp?: number; maxHp?: number; out?: boolean };

/** Repère MJ posé sur une case : S1 (passage secret), E1 (sortie), F1 (élément à fouiller). */
export type BoardLabel = { cell: number; text: string; tone: 'secret' | 'exit' | 'search' | 'dest'; noticed?: boolean };

/** Élément du plateau. `ghost` : secret non découvert, visible du MJ seulement (pointillés + DC). */
export type BoardElement = PlayerElement & { cells?: number[]; ghost?: boolean; dc?: number };

/** Portées d'une créature (MJ seulement) : cases atteignables, et anneau de portée d'attaque. */
/** `attack` : allonge au corps à corps (anneau plein). `ranged` : portée courte à distance (anneau en pointillés). */
export type BoardRange = {
  id: string; x: number; y: number; size: number; move: number[]; attack: number; ranged: number; selected: boolean;
  /** Joueurs : portée de vue (Perception) et cases à portée de main pour fouiller (Investigation). */
  sight?: number; search?: number;
};

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
  /** `at` : la case cliquée, pour déplacer un jeton jusqu'à l'endroit visé. */
  onElement?: (id: string, at?: { x: number; y: number }) => void;
  /** Cases survolées pendant un tracé (MJ, mode construction). */
  preview?: number[];
  /** Repères numérotés et cases mises en évidence (MJ seulement : jamais sur l'écran joueur). */
  labels?: BoardLabel[];
  highlight?: number[];
};

/** Icône de chaque catégorie de lieu. */
export const CATEGORY_ICON: Record<string, string> = {
  eau: '💧', danger: '☠️', ruine: '🏛️', grotte: '🪨', ressource: '💎', vivant: '🍄', garde: '🛡️',
  sanctuaire: '🕯️', institution: '🏛️', cite: '🏘️', voie: '🚪', indetermine: '❔',
};

const KIND_FILL: Record<PlayerToken['kind'], string> = { pc: '#54d8c6', monster: '#c0492f', other: '#c9a24a' };

/** Textures du terrain (public/images/combat-map/textures) : une image par case, posée sur la grille.
 *  Une répétition de motif donnait des rayures à cette échelle ; chaque case garde ainsi son image exacte. */
const TEX_URL = (name: string) => `${import.meta.env.BASE_URL}images/combat-map/textures/${name}.webp`;
const TILE_FILE: Partial<Record<TerrainKind, string>> = {
  '.': 'sol', '#': 'roche', '~': 'eau', ':': 'eboulis', '=': 'pont', X: 'gouffre', ',': 'decor', I: 'roche',
};
const TILE_BASE: Record<string, string> = {
  sol: '#2b241b', roche: '#4a3c2a', eau: '#1d4a5b', eboulis: '#3e3429', pont: '#8a6a2c', gouffre: '#030303', decor: '#2b241b', stalagmite: '#4a3c2a',
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

/** Dessine le terrain case par case dans le canevas : une texture par type, avec la couleur de base dessous. */
async function paintTerrain(canvas: HTMLCanvasElement, cols: number, rows: number, terrain: string | undefined) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = cols * CELL_PX; canvas.height = rows * CELL_PX;
  ctx.fillStyle = TILE_BASE.sol;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!terrain) return;
  const files = [...new Set([...Array.from(terrain).map((k) => TILE_FILE[k as TerrainKind] ?? 'sol'), 'stalagmite'])];
  const images = Object.fromEntries(await Promise.all(files.map(async (f) => [f, await loadTile(f).catch(() => null)])));
  Array.from(terrain).forEach((k, i) => {
    const file = TILE_FILE[k as TerrainKind] ?? 'sol';
    const x = (i % cols) * CELL_PX, y = Math.floor(i / cols) * CELL_PX;
    ctx.fillStyle = TILE_BASE[file] ?? TILE_BASE.sol;
    ctx.fillRect(x, y, CELL_PX, CELL_PX);
    const img = images[file];
    if (img) ctx.drawImage(img, x, y, CELL_PX, CELL_PX);
    if (k === 'I') {
      const col = images['stalagmite'];
      if (col) ctx.drawImage(col, x, y, CELL_PX, CELL_PX);
    }
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

/** Case d'un passage la plus proche de son centre : là où l'on pose son repère. */
export function anchorOf(cells: number[], cols: number): number {
  const mx = cells.reduce((t, i) => t + (i % cols), 0) / cells.length;
  const my = cells.reduce((t, i) => t + Math.floor(i / cols), 0) / cells.length;
  return cells.reduce((best, i) => {
    const d = (i % cols - mx) ** 2 + (Math.floor(i / cols) - my) ** 2;
    const db = (best % cols - mx) ** 2 + (Math.floor(best / cols) - my) ** 2;
    return d < db ? i : best;
  }, cells[0]);
}

/** Marque d'un lieu ou d'un objet sur sa case : vignette, image d'objet, ou icône à défaut. */
/** Portes, pièges et eau : le terrain et les tracés les montrent déjà, pas de cercle sur le plateau. */
const NO_MARK = new Set(['voie', 'danger', 'eau']);

function pointMark(e: BoardElement, cell: number, cols: number, pick?: (id: string) => (ev: ReactMouseEvent<SVGElement>) => void) {
  const cx = (cell % cols) + 0.5, cy = Math.floor(cell / cols) + 0.5;
  const click = pick ? pick(e.id) : undefined;
  if (!e.image && NO_MARK.has(e.category)) return null;
  if (e.image) {
    // Objet déposé : son image remplit la case ; en pointillé et estompé pour le MJ quand il est caché.
    return (
      <g key={`m-${e.id}`} className="battle-element" onClick={click} opacity={e.ghost ? 0.45 : 1}>
        <image href={e.image} x={cx - 0.46} y={cy - 0.46} width={0.92} height={0.92} preserveAspectRatio="xMidYMid meet" />
        {e.ghost && <rect x={cx - 0.46} y={cy - 0.46} width={0.92} height={0.92} fill="none" stroke="#ecd289" strokeWidth={0.05} strokeDasharray="0.1 0.07" />}
        <title>{e.ghost ? `${e.title} (caché aux joueurs)` : e.title}</title>
      </g>
    );
  }
  const img = e.ghost ? vignette('element_cache') : CATEGORY_IMG[e.category] ? vignette(CATEGORY_IMG[e.category]) : undefined;
  const clip = `clip-el-${e.id.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <g key={`m-${e.id}`} className="battle-element" onClick={click} opacity={e.ghost ? 0.85 : 1}>
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
}

/** Case du plateau sous un clic, à partir des coordonnées écran (le SVG peut être mis à l'échelle). */
function cellUnder(ev: ReactMouseEvent<SVGElement>, cols: number, rows: number) {
  const svg = ev.currentTarget.ownerSVGElement;
  const ctm = svg?.getScreenCTM();
  if (!svg || !ctm) return undefined;
  const pt = svg.createSVGPoint();
  pt.x = ev.clientX; pt.y = ev.clientY;
  const p = pt.matrixTransform(ctm.inverse());
  const x = Math.floor(p.x), y = Math.floor(p.y);
  return x >= 0 && y >= 0 && x < cols && y < rows ? { x, y } : undefined;
}

export default function BattleBoard({ cols, rows, backdrop, terrain, elements = [], ranges = [], tokens, interactive, onToken, onCell, onHover, onElement, preview, labels = [], highlight }: Props) {
  const lines: string[] = [];
  for (let x = 0; x <= cols; x++) lines.push(`M${x} 0V${rows}`);
  for (let y = 0; y <= rows; y++) lines.push(`M0 ${y}H${cols}`);
  const cells = interactive ? Array.from({ length: cols * rows }, (_, i) => ({ x: i % cols, y: Math.floor(i / cols) })) : [];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) void paintTerrain(canvasRef.current, cols, rows, terrain);
  }, [cols, rows, terrain]);

  const pick = (id: string) => (ev: ReactMouseEvent<SVGElement>) => onElement?.(id, cellUnder(ev, cols, rows));

  return (
    <div className="battle-stack">
      <canvas ref={canvasRef} className="battle-terrain" aria-hidden="true" />
    <svg className="battle-board" viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Plateau de combat">
      {TEXTURES}
      {backdrop && <image href={backdrop} x={0} y={0} width={cols} height={rows} preserveAspectRatio="xMidYMid slice" opacity={0.55} />}

      <path d={lines.join('')} stroke="rgba(201,162,74,.22)" strokeWidth={0.03} fill="none" pointerEvents="none" />

      {/* Cases cliquables sous les éléments et les jetons : ceux-ci reçoivent d’abord le clic. */}
      {interactive && cells.map((c) => (
        <rect
          key={`${c.x}-${c.y}`} x={c.x} y={c.y} width={1} height={1} fill="transparent" className="battle-cell"
          onClick={() => onCell?.(c.x, c.y)}
          onPointerEnter={() => onHover?.(c.x, c.y)}
        />
      ))}
      {ranges.map((r) => (
        <g key={`range-${r.id}`} pointerEvents="none">
          {r.move.length > 0 && <path d={cellPath(r.move, cols)} fill="rgba(84,216,198,0.18)" opacity={r.selected ? 1 : 0.7} />}
          {r.attack > 0 && (
            <rect
              x={r.x - r.attack} y={r.y - r.attack} width={r.size + 2 * r.attack} height={r.size + 2 * r.attack}
              fill="none" stroke="#e0603f" strokeWidth={r.selected ? 0.1 : 0.05} strokeDasharray="0.25 0.15" opacity={r.selected ? 1 : 0.6}
            />
          )}
          {r.sight ? (
            <circle cx={r.x + r.size / 2} cy={r.y + r.size / 2} r={r.sight + r.size / 2} fill="rgba(127,224,208,0.05)" stroke="#7fe0d0" strokeWidth={r.selected ? 0.07 : 0.04} strokeDasharray="0.3 0.2" opacity={r.selected ? 0.95 : 0.55}>
              <title>Portée de vue : {r.sight} cases ({r.sight * 5} pieds)</title>
            </circle>
          ) : null}
          {r.search ? (
            <rect x={r.x - r.search} y={r.y - r.search} width={r.size + 2 * r.search} height={r.size + 2 * r.search}
              fill="rgba(127,200,255,0.08)" stroke="#7fc8ff" strokeWidth={0.04} strokeDasharray="0.08 0.08" opacity={r.selected ? 1 : 0.6} />
          ) : null}
          {r.ranged > r.attack && (
            <rect
              x={r.x - r.ranged} y={r.y - r.ranged} width={r.size + 2 * r.ranged} height={r.size + 2 * r.ranged}
              fill="none" stroke="#c9a24a" strokeWidth={0.04} strokeDasharray="0.08 0.12" opacity={r.selected ? 0.8 : 0.4}
            />
          )}
        </g>
      ))}

      {preview && preview.length > 0 && <path d={cellPath(preview, cols)} fill="rgba(236,210,137,0.35)" stroke="#ecd289" strokeWidth={0.04} pointerEvents="none" />}

      {elements.map((e) => {
        if (e.kind === 'passage') {
          if (!e.cells) return null;
          // Passage secret non découvert (MJ seulement) : contour pointillé sur ses cases.
          if (e.ghost) return <path key={`g-${e.id}`} d={cellPath(e.cells, cols)} fill="rgba(236,210,137,0.16)" stroke="#ecd289" strokeWidth={0.07} strokeDasharray="0.15 0.1" opacity={0.95} pointerEvents="none"><title>{`${e.title} (secret, visible du MJ seulement)`}</title></path>;
          // Passage visible : zone cliquable, et teinte violette s'il était secret. Pas de marque : il y en a des milliers.
          const hit = onElement ? { className: 'battle-hit', onClick: pick(e.id), cursor: 'pointer' } : { pointerEvents: 'none' as const };
          const zone = e.secret
            ? <path d={cellPath(e.cells, cols)} fill="rgba(156,123,214,0.32)" stroke="#9c7bd6" strokeWidth={0.05} {...hit}><title>{`${e.title} (passage secret)`}</title></path>
            : <path d={cellPath(e.cells, cols)} fill="transparent" {...hit}><title>{e.title}</title></path>;
          return <g key={`p-${e.id}`}>{zone}</g>;
        }
        if (e.cell === undefined) return null;
        return pointMark(e, e.cell, cols, pick);
      })}

      {highlight && highlight.length > 0 && <path className="battle-glow" d={cellPath(highlight, cols)} fill="rgba(255,235,160,0.28)" stroke="#fff1c2" strokeWidth={0.08} pointerEvents="none" />}

      {labels.map((l) => {
        const x = l.cell % cols, y = Math.floor(l.cell / cols);
        return (
          <g key={`lb-${l.text}-${l.cell}`} className={`battle-label tone-${l.tone} ${l.noticed ? 'is-noticed' : ''}`} pointerEvents="none">
            <rect x={x + 0.02} y={y + 0.02} width={0.64} height={0.36} rx={0.1} />
            <text x={x + 0.34} y={y + 0.29} textAnchor="middle" fontSize={0.26}>{l.text}</text>
          </g>
        );
      })}

      {tokens.map((t) => {
        const r = t.size * 0.42;
        const cx = t.x + t.size / 2, cy = t.y + t.size / 2;
        return (
          <g key={t.id} className="battle-token" opacity={t.hidden ? 0.4 : 1} onClick={interactive && onToken ? (e) => { e.stopPropagation(); onToken(t.id); } : onElement ? pick(t.id) : undefined}>
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
            {t.out && (
              <path d={`M${cx - r * 0.7} ${cy - r * 0.7}L${cx + r * 0.7} ${cy + r * 0.7}M${cx + r * 0.7} ${cy - r * 0.7}L${cx - r * 0.7} ${cy + r * 0.7}`} stroke="#c0492f" strokeWidth={0.1} strokeLinecap="round" pointerEvents="none" />
            )}
            {t.active && <circle className="battle-turn-ring" cx={cx} cy={cy} r={r + 0.1} fill="none" stroke="#fff1c2" strokeWidth={0.07} pointerEvents="none" />}
            {t.maxHp ? (
              <g pointerEvents="none">
                <rect x={cx - r} y={cy + r + 0.04} width={2 * r} height={0.09} fill="#1a0f0b" />
                <rect x={cx - r} y={cy + r + 0.04} width={2 * r * Math.max(0, Math.min(1, (t.hp ?? 0) / t.maxHp))} height={0.09}
                  fill={(t.hp ?? 0) / t.maxHp > 0.5 ? '#5fae5a' : (t.hp ?? 0) / t.maxHp > 0.25 ? '#d6a43a' : '#c0492f'} />
              </g>
            ) : null}
          </g>
        );
      })}

    </svg>
    </div>
  );
}
