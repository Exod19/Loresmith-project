/**
 * Profil d'un passage (Atlas en strates) : la pente du tunnel d'un bout à l'autre, et les salles qu'il croise — celles
 * où il débouche (encadrées d'or) et celles qu'il passe au-dessus ou en dessous, sans ouverture (grisées).
 */
import type { AtlasData, AtlasGeometry } from './types';
import { caveDepth, cavePlace, metres, OPENING_LABEL, passage3d, planTop } from './strata3d';

export default function PassageProfile({ data, planId, g, at }: { data: AtlasData; planId: string; g: AtlasGeometry; at?: number }) {
  const p = passage3d(data, planId, g);
  const top = planTop(data, planId);
  const cavs = data.cavities[planId] ?? [];
  const rooms = [...p.crossings, ...p.ends.filter(Boolean)].map((c) => ({ c: c!, d: caveDepth(cavs[c!.cave], top) }));
  const zs = [p.z0, p.z1, ...rooms.flatMap((r) => [r.d.floor, r.d.ceiling])];
  const zMax = Math.max(...zs) + 3, zMin = Math.min(...zs) - 3;
  const W = 320, H = 130, pad = 10;
  const X = (s: number) => pad + (p.L ? s / p.L : 0) * (W - 2 * pad);
  const Y = (z: number) => pad + ((zMax - z) / (zMax - zMin || 1)) * (H - 2 * pad - 14);
  const roomW = Math.max(18, (W - 2 * pad) * 0.07);
  const ends = p.ends;
  return (
    <figure className="passage-profile">
      <figcaption>Profil du passage · dénivelé {metres(p.z1 - p.z0).replace('−', p.z1 < p.z0 ? '−' : '+')}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Profil du passage">
        {rooms.map(({ c, d }, i) => {
          const x = X(c.s) - roomW / 2;
          return (
            <g key={i} className={`pp-room ${c.open ? 'open' : 'closed'}`}>
              <rect x={x} y={Y(d.ceiling)} width={roomW} height={Math.max(4, Y(d.floor) - Y(d.ceiling))} rx={3} />
              <title>{`${cavePlace(data, planId, c.cave, top).title} · sol ${metres(d.floor)}, voûte ${metres(d.ceiling)}${c.open ? ` · ${OPENING_LABEL[c.opening ?? 'paroi']}` : ` · passé ${c.rel}, sans ouverture`}`}</title>
            </g>
          );
        })}
        <line x1={X(0)} y1={Y(p.z0)} x2={X(p.L)} y2={Y(p.z1)} className="pp-tunnel" />
        {rooms.filter(({ c }) => c.open).map(({ c }, i) => <circle key={`o${i}`} cx={X(c.s)} cy={Y(c.z)} r={4} className={`pp-open o-${c.opening}`} />)}
        {at !== undefined && <circle cx={X(at)} cy={Y(p.zAt(at))} r={5} className="pp-party" />}
        {ends.map((e, i) => e && (
          <text key={`t${i}`} x={X(e.s) + (i ? -4 : 4)} y={H - 4} textAnchor={i ? 'end' : 'start'} className="pp-label">
            {i ? 'B' : 'A'} · {OPENING_LABEL[e.opening ?? 'paroi']} · {metres(e.z)}
          </text>
        ))}
      </svg>
    </figure>
  );
}
