/**
 * Plateau de combat sur grille (5 pieds par case). Sert à la console MJ (interactif) et à l'écran joueur (lecture seule).
 * Le terrain est dessiné avec de vraies textures (SVG), les lieux et créatures avec des icônes.
 */
import type { BoardTheme } from './theme';
import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import type { PlayerElement, PlayerToken } from '../../present/stage';
import type { TerrainKind } from './terrain';
import { CATEGORY_IMG, vignette } from './vignettes';

/** `active` : c'est son tour. `hp`/`maxHp` : barre de vie (MJ seulement). */
export type BoardToken = PlayerToken & { selected?: boolean; hidden?: boolean; active?: boolean; hp?: number; maxHp?: number; out?: boolean; conditions?: string[] };

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
  /** `surface` : plateau tiré d'une carte du monde (rues, bâtiments, champs) plutôt que d'une caverne. */
  theme?: BoardTheme;
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
  /** Brouillard de guerre : cases vues maintenant, et déjà explorées. `dm` : voile léger, le MJ voit à travers. */
  fog?: { visible: number[]; explored: number[]; dm?: boolean };
  /** Sorties au bord du plateau (écran joueur) : flèche vers l'extérieur et destination si elle est connue. */
  exits?: { cell: number; dir: 'n' | 's' | 'e' | 'w'; label: string; known: boolean; goal?: boolean }[];
  /** Trait d'attaque : du centre de l'attaquant à celui de la cible (en cases). `pending` : la cible n'est pas encore choisie. */
  aim?: { x1: number; y1: number; x2: number; y2: number; tone?: 'hit' | 'miss' | 'crit' | 'info'; pending?: boolean; label?: string };
  /** Dégâts (amount < 0) et soins récents, écrits en grand au-dessus des jetons quelques secondes. */
  hits?: { id: string; to: string; amount: number; at: number }[];
};

/** Icône de chaque catégorie de lieu. */
export const CATEGORY_ICON: Record<string, string> = {
  eau: '💧', danger: '☠️', ruine: '🏛️', grotte: '🪨', ressource: '💎', vivant: '🍄', garde: '🛡️',
  sanctuaire: '🕯️', institution: '🏛️', cite: '🏘️', voie: '🚪', indetermine: '❔',
};

/** Voile du brouillard : noir où rien n'a été vu, assombri où l'on est passé mais qu'on ne voit plus. */
function FogLayer({ cols, rows, fog }: { cols: number; rows: number; fog: NonNullable<Props['fog']> }) {
  const visible = new Set(fog.visible), explored = new Set(fog.explored);
  const dark: string[] = [], dim: string[] = [];
  for (let i = 0; i < cols * rows; i++) {
    if (visible.has(i)) continue;
    const d = `M${i % cols} ${Math.floor(i / cols)}h1v1h-1z`;
    (explored.has(i) ? dim : dark).push(d);
  }
  return (
    <g className={`battle-fog ${fog.dm ? 'dm' : ''}`} pointerEvents="none">
      <path d={dark.join('')} fill="#030202" fillOpacity={fog.dm ? 0.5 : 1} />
      <path d={dim.join('')} fill="#030202" fillOpacity={fog.dm ? 0.22 : 0.62} />
    </g>
  );
}

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
async function paintTerrain(canvas: HTMLCanvasElement, cols: number, rows: number, terrain: string | undefined, theme?: BoardTheme) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = cols * CELL_PX; canvas.height = rows * CELL_PX;
  if (theme?.startsWith('surface')) { paintSurface(ctx, cols, rows, terrain, theme === 'surface-froid' ? 'froid' : theme === 'surface-chaud' ? 'chaud' : 'tempere'); return; }
  if (theme === 'interieur') { paintInterior(ctx, cols, rows, terrain); return; }
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

/**
 * Plateau de surface (cité, campagne), peint sans texture : sol de terre battue, bâtiments en toits (bordés là où ils
 * touchent la rue), arbres, champs, eau et pont. Même grille que le terrain de caverne : seules les couleurs changent.
 */
/** Couleurs du plateau de surface selon le climat de la cité : sol, champs, toits, eau, arbres. */
const SURFACE_PALETTE = {
  tempere: { ground: '#5b5444', field: '#4b512f', furrow: 'rgba(120,130,70,.55)', roof: '#8a4f3c', roofHi: '#9c5d47', roofEdge: '#3b241c', water: '#2f5c69', tree: '#22381f', treeHi: '#2f4a2a' },
  froid: { ground: '#6a6e68', field: '#5b6150', furrow: 'rgba(200,205,200,.45)', roof: '#4f4a4c', roofHi: '#625c5e', roofEdge: '#1e1b1c', water: '#2a4652', tree: '#1d3226', treeHi: '#2a4433' },
  chaud: { ground: '#8a7650', field: '#8a7a42', furrow: 'rgba(180,160,90,.55)', roof: '#d2b07a', roofHi: '#e0c290', roofEdge: '#6d5634', water: '#1f6a78', tree: '#4e6a2c', treeHi: '#6c8a3a' },
};

function paintSurface(ctx: CanvasRenderingContext2D, cols: number, rows: number, terrain: string | undefined, climate: keyof typeof SURFACE_PALETTE = 'tempere') {
  const C = CELL_PX;
  const P = SURFACE_PALETTE[climate];
  ctx.fillStyle = P.ground;
  ctx.fillRect(0, 0, cols * C, rows * C);
  if (!terrain) return;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= cols || y >= rows ? '' : terrain[y * cols + x]);
  // Grain du sol : quelques pavés et cailloux, toujours au même endroit.
  let z = 7;
  const r = () => ((z = (1664525 * z + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < terrain.length; i++) {
    const k = terrain[i], x = (i % cols) * C, y = Math.floor(i / cols) * C;
    if (k === '~') { ctx.fillStyle = P.water; ctx.fillRect(x, y, C, C); ctx.strokeStyle = 'rgba(160,200,210,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 8, y + C * 0.35 + r() * 8); ctx.quadraticCurveTo(x + C / 2, y + C * 0.25, x + C - 8, y + C * 0.4); ctx.stroke(); continue; }
    if (k === ',') {
      ctx.fillStyle = P.field; ctx.fillRect(x, y, C, C);
      ctx.strokeStyle = P.furrow; ctx.lineWidth = 2;
      for (let s = 10; s < C; s += 14) { ctx.beginPath(); ctx.moveTo(x + 4, y + s); ctx.lineTo(x + C - 4, y + s + 3); ctx.stroke(); }
      continue;
    }
    if (k === '.' || k === 'I') {
      ctx.fillStyle = 'rgba(40,36,28,.35)';
      for (let n = 0; n < 3; n++) ctx.fillRect(x + r() * (C - 6), y + r() * (C - 6), 3 + r() * 4, 2 + r() * 3);
    }
  }
  for (let i = 0; i < terrain.length; i++) {
    const k = terrain[i], cx = i % cols, cy = Math.floor(i / cols), x = cx * C, y = cy * C;
    if (k === '#') {
      ctx.fillStyle = P.roof; ctx.fillRect(x, y, C, C);
      ctx.fillStyle = P.roofHi; ctx.fillRect(x + 4, y + 4, C - 8, (C - 8) / 2);
      // Bord du bâtiment, côté rue : un mur d'ombre là où la case voisine n'est pas bâtie.
      ctx.fillStyle = P.roofEdge;
      if (at(cx, cy - 1) !== '#') ctx.fillRect(x, y, C, 5);
      if (at(cx, cy + 1) !== '#') ctx.fillRect(x, y + C - 7, C, 7);
      if (at(cx - 1, cy) !== '#') ctx.fillRect(x, y, 5, C);
      if (at(cx + 1, cy) !== '#') ctx.fillRect(x + C - 5, y, 5, C);
    } else if (k === '=') {
      ctx.fillStyle = '#9b8a69'; ctx.fillRect(x, y, C, C);
      ctx.strokeStyle = '#5e5340'; ctx.lineWidth = 2;
      for (let s = 8; s < C; s += 12) { ctx.beginPath(); ctx.moveTo(x + s, y); ctx.lineTo(x + s, y + C); ctx.stroke(); }
    } else if (k === 'I') {
      ctx.fillStyle = P.tree; ctx.beginPath(); ctx.arc(x + C / 2, y + C / 2, C * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P.treeHi; ctx.beginPath(); ctx.arc(x + C * 0.42, y + C * 0.4, C * 0.22, 0, Math.PI * 2); ctx.fill();
    } else if (k === 'X') {
      ctx.fillStyle = '#060606'; ctx.fillRect(x, y, C, C);
    } else if (k === ':') {
      ctx.fillStyle = '#6a604c'; ctx.fillRect(x, y, C, C);
    }
  }
}

/** Plateau d'intérieur : dalles et planches, murs de pierre, gros meubles (comptoir, âtre) et meubles bas (tables, lits). */
function paintInterior(ctx: CanvasRenderingContext2D, cols: number, rows: number, terrain: string | undefined) {
  const C = CELL_PX;
  ctx.fillStyle = '#6b5a44';
  ctx.fillRect(0, 0, cols * C, rows * C);
  if (!terrain) return;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= cols || y >= rows ? '#' : terrain[y * cols + x]);
  // Dehors : ce qu'on atteint depuis le bord du plateau sans franchir de mur ni d'embrasure (une case libre entre
  // deux murs qui se font face). Peint en pavés de rue ; le reste est le plancher du bâtiment.
  const doorway = (x: number, y: number) => (at(x - 1, y) === '#' && at(x + 1, y) === '#') || (at(x, y - 1) === '#' && at(x, y + 1) === '#');
  const outside = new Set<number>();
  const queue: number[] = [];
  for (let i = 0; i < terrain.length; i++) {
    const x = i % cols, y = Math.floor(i / cols);
    if ((x === 0 || y === 0 || x === cols - 1 || y === rows - 1) && terrain[i] !== '#') { outside.add(i); queue.push(i); }
  }
  while (queue.length) {
    const i = queue.pop()!, x = i % cols, y = Math.floor(i / cols);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, j = ny * cols + nx;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || outside.has(j) || terrain[j] === '#' || doorway(nx, ny)) continue;
      outside.add(j); queue.push(j);
    }
  }
  for (let i = 0; i < terrain.length; i++) {
    const k = terrain[i], cx = i % cols, cy = Math.floor(i / cols), x = cx * C, y = cy * C;
    if (outside.has(i) && k !== '#') {
      ctx.fillStyle = '#5b5444'; ctx.fillRect(x, y, C, C);
      ctx.fillStyle = 'rgba(40,36,28,.35)';
      for (let n = 0; n < 3; n++) ctx.fillRect(x + ((i * 37 + n * 23) % (C - 8)), y + ((i * 17 + n * 41) % (C - 8)), 5, 3);
      if (k === 'I') { ctx.fillStyle = '#5a3f26'; ctx.fillRect(x + 6, y + 6, C - 12, C - 12); }
      continue;
    }
    if (k === '#') {
      ctx.fillStyle = '#2d2823'; ctx.fillRect(x, y, C, C);
      ctx.strokeStyle = 'rgba(120,110,95,.35)'; ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, y + 3, C / 2 - 4, C / 2 - 4); ctx.strokeRect(x + C / 2 + 1, y + C / 2 + 1, C / 2 - 4, C / 2 - 4);
      continue;
    }
    // Sol : planches dans le sens de la longueur.
    ctx.fillStyle = (cx + cy) % 2 ? '#6e5c45' : '#695742'; ctx.fillRect(x, y, C, C);
    ctx.strokeStyle = 'rgba(40,30,20,.35)'; ctx.lineWidth = 1.5;
    for (let s = 0; s < C; s += 16) { ctx.beginPath(); ctx.moveTo(x, y + s); ctx.lineTo(x + C, y + s); ctx.stroke(); }
    if (k === 'I') {
      ctx.fillStyle = '#5a3f26'; ctx.fillRect(x + 4, y + 4, C - 8, C - 8);
      ctx.fillStyle = '#7a5835'; ctx.fillRect(x + 8, y + 8, C - 16, (C - 16) / 3);
      if (at(cx + 1, cy) === 'I') ctx.fillRect(x + C - 6, y + 4, 6, C - 8);
    } else if (k === ',') {
      ctx.fillStyle = '#9a7a52'; ctx.fillRect(x + 6, y + 10, C - 12, C - 20);
    } else if (k === '~') {
      ctx.fillStyle = '#2f5c69'; ctx.fillRect(x + 6, y + 6, C - 12, C - 12);
    }
  }
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

export default function BattleBoard({ cols, rows, backdrop, terrain, elements = [], ranges = [], tokens, interactive, onToken, onCell, onHover, onElement, preview, labels = [], highlight, fog, exits = [], aim, hits = [], theme }: Props) {
  const lines: string[] = [];
  for (let x = 0; x <= cols; x++) lines.push(`M${x} 0V${rows}`);
  for (let y = 0; y <= rows; y++) lines.push(`M0 ${y}H${cols}`);
  const cells = interactive ? Array.from({ length: cols * rows }, (_, i) => ({ x: i % cols, y: Math.floor(i / cols) })) : [];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Un chiffre de dégâts reste 4 s à partir du moment où ce plateau le reçoit (l'écran joueur peut le recevoir en retard).
  const seen = useRef(new Map<string, number>());
  const now = Date.now();
  for (const h of hits) if (!seen.current.has(h.id)) seen.current.set(h.id, now);
  const shownHits = hits.filter((h) => now - (seen.current.get(h.id) ?? now) <= 4000);
  useEffect(() => {
    if (canvasRef.current) void paintTerrain(canvasRef.current, cols, rows, terrain, theme);
  }, [cols, rows, terrain, theme]);

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
          const hit = onElement ? { className: 'battle-pass', onClick: pick(e.id), cursor: 'pointer' } : { pointerEvents: 'none' as const };
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

      {fog && <FogLayer cols={cols} rows={rows} fog={fog} />}

      {exits.map((e) => {
        const x = e.cell % cols, y = Math.floor(e.cell / cols), cx = x + 0.5, cy = y + 0.5;
        const rot = { n: 0, e: 90, s: 180, w: 270 }[e.dir];
        // Libellé vers l'intérieur du plateau, pour qu'il reste lisible au bord.
        const lx = e.dir === 'w' ? x + 1.15 : e.dir === 'e' ? x - 0.15 : cx;
        const ly = e.dir === 'n' ? y + 1.35 : e.dir === 's' ? y - 0.3 : cy + 0.1;
        const anchor = e.dir === 'w' ? 'start' : e.dir === 'e' ? 'end' : 'middle';
        return (
          <g key={`ex-${e.cell}`} className={`battle-exit ${e.known ? 'known' : ''} ${e.goal ? 'goal' : ''}`} pointerEvents="none">
            <path d="M-0.2 0.08 L0 -0.14 L0.2 0.08" transform={`translate(${cx} ${cy}) rotate(${rot})`} fill="none" strokeWidth={0.09} strokeLinecap="round" strokeLinejoin="round" />
            {e.label && <text x={lx} y={ly} textAnchor={anchor} fontSize={e.goal ? 0.36 : 0.3}>{e.goal ? `🎯 ${e.label}` : e.label}</text>}
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
            {t.conditions?.length ? (
              <g className="battle-token-conds">
                <title>{t.conditions.join(' · ')}</title>
                <circle cx={cx + r * 0.78} cy={cy - r * 0.78} r={0.17} fill="#ad97d8" stroke="#0b0906" strokeWidth={0.04} />
                <text x={cx + r * 0.78} y={cy - r * 0.78 + 0.075} textAnchor="middle" fontSize={0.2} fontWeight={700} fill="#1a1026" pointerEvents="none">{t.conditions.length}</text>
              </g>
            ) : null}
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

      {aim && (() => {
        const dx = aim.x2 - aim.x1, dy = aim.y2 - aim.y1, len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len, end = Math.max(0, len - 0.45);
        const ex = aim.x1 + ux * end, ey = aim.y1 + uy * end;
        return (
          <g className={`battle-aim tone-${aim.tone ?? 'info'} ${aim.pending ? 'pending' : ''}`} pointerEvents="none">
            <line x1={aim.x1 + ux * 0.45} y1={aim.y1 + uy * 0.45} x2={ex} y2={ey} strokeWidth={0.09} strokeLinecap="round" />
            <path d={`M${ex + ux * 0.22} ${ey + uy * 0.22} L${ex - uy * 0.16 - ux * 0.1} ${ey + ux * 0.16 - uy * 0.1} L${ex + uy * 0.16 - ux * 0.1} ${ey - ux * 0.16 - uy * 0.1}Z`} />
            {!aim.pending && <circle cx={aim.x2} cy={aim.y2} r={0.52} fill="none" strokeWidth={0.06} strokeDasharray="0.18 0.1" />}
            {aim.label && <text x={(aim.x1 + aim.x2) / 2} y={(aim.y1 + aim.y2) / 2 - 0.25} textAnchor="middle" fontSize={0.32}>{aim.label}</text>}
          </g>
        );
      })()}

      {/* Dégâts et soins : un grand chiffre qui monte et s'efface au-dessus du jeton touché. */}
      {shownHits.map((h) => {
        const t = tokens.find((q) => q.id === h.to);
        if (!t) return null;
        const stack = shownHits.filter((o) => o.to === h.to && o.at < h.at).length;
        const cx = t.x + t.size / 2, cy = t.y - 0.15 - stack * 0.75;
        const heal = h.amount > 0;
        return (
          <text
            key={h.id} className={`battle-hit ${heal ? 'heal' : 'dmg'}`} x={cx} y={cy} textAnchor="middle"
            fontSize={0.95 + Math.min(0.6, Math.abs(h.amount) / 40)} pointerEvents="none" paintOrder="stroke"
          >
            {heal ? `+${h.amount}` : h.amount}
          </text>
        );
      })}
    </svg>
    </div>
  );
}
