/**
 * Emblèmes des cités sur les cartes : un écu à créneaux (la cité) qui porte le symbole de son peuple.
 * Moriquendi : l'araignée d'Araushnée ; duergar : l'enclume et le marteau ; svirfnebelin : la gemme.
 * Un peuple sans symbole propre reçoit son initiale.
 */
type People = { label: string; color: string; symbol: JSX.Element | null };

const SPIDER = (
  <g className="sym">
    <ellipse cx="0" cy="1.2" rx="2.3" ry="3.1" /><circle cx="0" cy="-2.6" r="1.5" />
    <path d="M-1.6 -0.6 L-5.2 -3.6 L-6.4 -6 M1.6 -0.6 L5.2 -3.6 L6.4 -6 M-1.9 0.8 L-6 -0.2 L-7.4 -2 M1.9 0.8 L6 -0.2 L7.4 -2 M-1.9 2.2 L-5.8 3.6 L-7 6 M1.9 2.2 L5.8 3.6 L7 6 M-1.4 3.6 L-4 6.6 L-4.6 8.4 M1.4 3.6 L4 6.6 L4.6 8.4" fill="none" />
  </g>
);
const ANVIL = (
  <g className="sym">
    <path d="M-6.6 -0.6 H5.6 C5.6 1.4 3.6 2.2 1.8 2.4 V4.4 H3.8 V6.2 H-3.8 V4.4 H-1.8 V2.4 C-4 2.2 -6.6 1.2 -6.6 -0.6 Z" />
    <path d="M-1 -7.4 L4.6 -2.8 M2.4 -7.4 L5.6 -4.4 L3.8 -2.4 L0.6 -5.4 Z" fill="none" />
  </g>
);
const GEM = (
  <g className="sym">
    <path d="M-5.6 -2 L-3 -5.6 H3 L5.6 -2 L0 6.2 Z" /><path d="M-5.6 -2 H5.6 M-3 -5.6 L-1.4 -2 L0 6.2 L1.4 -2 L3 -5.6" fill="none" />
  </g>
);

const PEOPLES: Record<string, People> = {
  moriquendi: { label: 'Cité moriquendi', color: '#a58ad8', symbol: SPIDER },
  drow: { label: 'Cité drow', color: '#a58ad8', symbol: SPIDER },
  duergar: { label: 'Cité duergar', color: '#d08a55', symbol: ANVIL },
  nain: { label: 'Cité naine', color: '#d08a55', symbol: ANVIL },
  svirfneblin: { label: 'Cité svirfnebelin', color: '#7fb4c9', symbol: GEM },
  svirfnebelin: { label: 'Cité svirfnebelin', color: '#7fb4c9', symbol: GEM },
};

const key = (p: string) => p.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/s$/, '').trim();
export const peopleOf = (p?: string): People | undefined => {
  if (!p) return undefined;
  const k = key(p);
  return PEOPLES[k] ?? { label: `Cité ${p.toLowerCase()}`, color: '#c5ab7f', symbol: null };
};

/** Peuples dotés d'emblèmes peints (images/atlas/cites/emblemes/<peuple>-1..6.webp). */
const PAINTED: Record<string, string> = { moriquendi: 'moriquendi', drow: 'drow', duergar: 'duergar', nain: 'duergar', illithid: 'illithid', flagelleur: 'illithid',
  'kuo-toa': 'kuo-toa', kuotoa: 'kuo-toa', myconide: 'myconide' };
const hash = (s: string) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
/** Emblème peint d'une cité : variante choisie (1–6) ou stable selon l'identifiant ; sans cadre ni contour. */
export function paintedEmblem(people?: string, id = '', variant?: number): string | undefined {
  const k = PAINTED[key(people ?? '')]; if (!k) return undefined;
  return `images/atlas/cites/emblemes/${k}-${variant && variant >= 1 && variant <= 6 ? variant : (hash(id) % 6) + 1}.webp`;
}

/** Écu à créneaux, dessiné dans une boîte d'environ 2R de côté, centré sur le point. */
export function CityEmblem({ people, R, id, variant }: { people: string; R: number; id?: string; variant?: number }) {
  const img = paintedEmblem(people, id, variant);
  if (img) { const S = R * 3.4; return <image className="am-emblem-img" href={img} x={-S / 2} y={-S / 2} width={S} height={S} preserveAspectRatio="xMidYMid meet" />; }
  const p = peopleOf(people)!; const k = R / 9;
  return (
    <g className="am-emblem" style={{ '--e': p.color } as React.CSSProperties} transform={`scale(${k})`}>
      <path className="shield" d="M-9 -7 H-6 V-9.5 H-3 V-7 H-1.5 V-9.5 H1.5 V-7 H3 V-9.5 H6 V-7 H9 V2 C9 7 4.5 10 0 12 C-4.5 10 -9 7 -9 2 Z" />
      <g transform="translate(0 0.6) scale(0.82)">{p.symbol ?? <text y="3.6" textAnchor="middle" className="ini">{people.trim()[0]?.toUpperCase()}</text>}</g>
    </g>
  );
}
