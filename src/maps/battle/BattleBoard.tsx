/**
 * Plateau de combat sur grille (5 pieds par case). Sert à la console MJ (interactif) et à l'écran joueur (lecture seule).
 * Le terrain est dessiné avec de vraies textures (SVG), les lieux et créatures avec des icônes.
 */
import type { PlayerElement, PlayerToken } from '../../present/stage';
import { TERRAIN, type TerrainKind } from './terrain';

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

/** Textures du terrain : motifs répétés, en unités de case (le plateau est en coordonnées cases). */
const TEXTURES = (
  <defs>
    <pattern id="tex-floor" patternUnits="userSpaceOnUse" width={1} height={1}>
      <rect width={1} height={1} fill="#2b241b" />
      <circle cx={0.2} cy={0.3} r={0.03} fill="#382f23" />
      <circle cx={0.7} cy={0.8} r={0.025} fill="#382f23" />
    </pattern>
    <pattern id="tex-rock" patternUnits="userSpaceOnUse" width={1} height={1}>
      <rect width={1} height={1} fill="#4a3c2a" />
      <path d="M0 0.25 H1 M0 0.75 H1 M0.25 0 V1 M0.75 0 V1" stroke="#2c2319" strokeWidth={0.07} />
      <circle cx={0.5} cy={0.5} r={0.08} fill="#5b4a34" />
    </pattern>
    <pattern id="tex-water" patternUnits="userSpaceOnUse" width={1} height={1}>
      <rect width={1} height={1} fill="#1d4a5b" />
      <path d="M0.05 0.35 q0.225 -0.18 0.45 0 t0.45 0 M0.05 0.8 q0.225 -0.18 0.45 0 t0.45 0" fill="none" stroke="#5fb3c9" strokeWidth={0.06} opacity={0.55} />
    </pattern>
    <pattern id="tex-rubble" patternUnits="userSpaceOnUse" width={1} height={1}>
      <rect width={1} height={1} fill="#3e3429" />
      <circle cx={0.3} cy={0.35} r={0.17} fill="#6e6152" />
      <circle cx={0.75} cy={0.7} r={0.13} fill="#5a4e40" />
      <circle cx={0.7} cy={0.2} r={0.09} fill="#7a6b5a" />
    </pattern>
    <pattern id="tex-pass" patternUnits="userSpaceOnUse" width={1} height={1}>
      <rect width={1} height={1} fill="#6b5a3e" />
      <path d="M0 0.5 H1" stroke="#7d6a4b" strokeWidth={0.08} strokeDasharray="0.2 0.15" />
    </pattern>
    <pattern id="tex-bridge" patternUnits="userSpaceOnUse" width={1} height={1}>
      <rect width={1} height={1} fill="#8a6a2c" />
      <path d="M0.33 0 V1 M0.66 0 V1" stroke="#5a4119" strokeWidth={0.08} />
    </pattern>
    <radialGradient id="grad-chasm" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stopColor="#000" />
      <stop offset="70%" stopColor="#060606" />
      <stop offset="100%" stopColor="#2a2a2a" />
    </radialGradient>
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

  // Terrain regroupé par type : un seul tracé par type, plus léger qu'un rectangle par case.
  const byKind = new Map<TerrainKind, number[]>();
  const decor: number[] = [];
  if (terrain) Array.from(terrain).forEach((k, i) => {
    const kind = k as TerrainKind;
    if (kind === ',') decor.push(i);
    else if (kind !== '.') byKind.set(kind, [...(byKind.get(kind) ?? []), i]);
  });
  const TEX: Partial<Record<TerrainKind, string>> = { '#': 'tex-rock', '~': 'tex-water', ':': 'tex-rubble', p: 'tex-pass', '=': 'tex-bridge' };

  return (
    <svg className="battle-board" viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Plateau de combat">
      {TEXTURES}
      <rect x={0} y={0} width={cols} height={rows} fill="url(#tex-floor)" />
      <rect x={0} y={0} width={cols} height={rows} filter="url(#grain)" opacity={0.6} pointerEvents="none" />
      {backdrop && <image href={backdrop} x={0} y={0} width={cols} height={rows} preserveAspectRatio="xMidYMid slice" opacity={0.55} />}

      {[...byKind.entries()].map(([kind, idx]) => {
        if (kind === 'X') return <path key={kind} d={cellPath(idx, cols)} fill="url(#grad-chasm)"><title>{TERRAIN.X.label}</title></path>;
        if (kind === 'I') return idx.map((i) => (
          <g key={i}>
            <ellipse cx={(i % cols) + 0.5} cy={Math.floor(i / cols) + 0.7} rx={0.3} ry={0.12} fill="#000" opacity={0.35} />
            <circle cx={(i % cols) + 0.5} cy={Math.floor(i / cols) + 0.45} r={0.34} fill="#6b5a44" stroke="#0b0906" strokeWidth={0.04} />
          </g>
        ));
        return <path key={kind} d={cellPath(idx, cols)} fill={`url(#${TEX[kind] ?? 'tex-floor'})`}><title>{TERRAIN[kind].label}</title></path>;
      })}
      {decor.length > 0 && (
        <path fill="#7fd1a8" opacity={0.85}
          d={decor.map((i) => `M${(i % cols) + 0.5} ${Math.floor(i / cols) + 0.5}m-0.14 0a0.14 0.14 0 1 0 0.28 0a0.14 0.14 0 1 0 -0.28 0`).join('')} />
      )}

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
          // Passage secret non découvert (MJ seulement) : contour pointillé sur ses cases.
          if (!e.ghost || !e.cells) return null;
          return <path key={`g-${e.id}`} d={cellPath(e.cells, cols)} fill="rgba(236,210,137,0.16)" stroke="#ecd289" strokeWidth={0.07} strokeDasharray="0.15 0.1" opacity={0.95} pointerEvents="none"><title>{`${e.title} (secret, visible du MJ seulement)`}</title></path>;
        }
        if (e.cell === undefined) return null;
        const cx = (e.cell % cols) + 0.5, cy = Math.floor(e.cell / cols) + 0.5;
        return (
          <g key={e.id} className="battle-element" onClick={onElement ? () => onElement(e.id) : undefined} opacity={e.ghost ? 0.7 : 1}>
            <circle cx={cx} cy={cy} r={0.4} fill="#0b0906" stroke={e.ghost ? '#ecd289' : '#7d6128'} strokeWidth={0.05} strokeDasharray={e.ghost ? '0.1 0.07' : undefined} />
            <text x={cx} y={cy + 0.14} textAnchor="middle" fontSize={0.42} pointerEvents="none">{e.ghost ? '?' : CATEGORY_ICON[e.category] ?? '◆'}</text>
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
  );
}
