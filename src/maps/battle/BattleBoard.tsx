/**
 * Plateau de combat sur grille (5 pieds par case). Sert à la console MJ (interactif) et à l'écran joueur (lecture seule).
 */
import type { PlayerToken } from '../../present/stage';

/** `hidden` : jeton invisible pour les joueurs, grisé dans la console MJ. */
export type BoardToken = PlayerToken & { selected?: boolean; hidden?: boolean };

type Props = {
  cols: number;
  rows: number;
  backdrop?: string;
  tokens: BoardToken[];
  /** Présent = mode MJ : la grille accepte les clics. */
  interactive?: boolean;
  onToken?: (id: string) => void;
  onCell?: (x: number, y: number) => void;
  onHover?: (x: number, y: number) => void;
};

const KIND_FILL: Record<PlayerToken['kind'], string> = { pc: '#54d8c6', monster: '#c0492f', other: '#c9a24a' };

export default function BattleBoard({ cols, rows, backdrop, tokens, interactive, onToken, onCell, onHover }: Props) {
  const lines: string[] = [];
  for (let x = 0; x <= cols; x++) lines.push(`M${x} 0V${rows}`);
  for (let y = 0; y <= rows; y++) lines.push(`M0 ${y}H${cols}`);
  const cells = interactive ? Array.from({ length: cols * rows }, (_, i) => ({ x: i % cols, y: Math.floor(i / cols) })) : [];

  return (
    <svg className="battle-board" viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Plateau de combat">
      <rect x={0} y={0} width={cols} height={rows} fill="#0b0906" />
      {backdrop && <image href={backdrop} x={0} y={0} width={cols} height={rows} preserveAspectRatio="xMidYMid slice" opacity={0.7} />}
      <path d={lines.join('')} stroke="rgba(201,162,74,.35)" strokeWidth={0.03} fill="none" />

      {tokens.map((t) => {
        const r = (t.size * 0.42);
        const cx = t.x + t.size / 2, cy = t.y + t.size / 2;
        return (
          <g key={t.id} className="battle-token" opacity={t.hidden ? 0.4 : 1} onClick={interactive && onToken ? (e) => { e.stopPropagation(); onToken(t.id); } : undefined}>
            <circle cx={cx} cy={cy} r={r} fill={KIND_FILL[t.kind]} stroke={t.selected ? '#ecd289' : '#0b0906'} strokeWidth={t.selected ? 0.12 : 0.05} strokeDasharray={t.hidden ? "0.12 0.08" : undefined} />
            <text x={cx} y={cy + 0.11} textAnchor="middle" fontSize={0.32} fill="#0b0906" fontFamily="Cinzel, serif" fontWeight={700} pointerEvents="none">
              {t.name.slice(0, 2).toUpperCase()}
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
