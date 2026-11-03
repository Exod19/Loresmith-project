/**
 * Les mécanismes des énigmes, dessinés et manipulables (SVG et boutons, au clavier comme au toucher). Partagés par
 * l'écran joueur et la console MJ : ils ne lisent que la vue publique (`PublicPuzzle`) et envoient des actions,
 * jamais un résultat. Chaque retour est causal : ce qu'on voit découle de ce qu'on a fait.
 */
import type { ReactNode } from 'react';
import { traceMirrors } from './engine';
import type { PublicPuzzle, PuzzleAction } from './types';

type Props = { pub: PublicPuzzle; act: (a: PuzzleAction) => void };

/** Libellé du geste qui soumet la réponse, propre à chaque mécanisme. */
export const SUBMIT_LABEL: Record<string, string> = {
  braziers: 'Rendre le verdict', 'heavy-stone': 'Désigner ce galet au juge', jugs: 'Verser dans la vasque', statues: 'Ouvrir ce coffret',
  mirrors: 'Activer le réceptacle', 'prime-tiles': 'Poser le pied sur la dernière dalle', chronology: 'Sceller cet ordre', glyphs: 'Graver ces glyphes',
  cycles: 'Fixer cette pulsation', 'equal-balance': 'Déposer les offrandes', gears: 'Lancer la manivelle', 'light-network': 'Sceller les lueurs',
};

export default function Mechanism({ pub, act }: Props) {
  const off = pub.state.status !== 'active';
  const body: ReactNode = (() => {
    switch (pub.mechanic) {
      case 'braziers': return <Braziers pub={pub} act={act} />;
      case 'heavy-stone': return <Stones pub={pub} act={act} />;
      case 'jugs': return <Jugs pub={pub} act={act} />;
      case 'mirrors': return <Mirrors pub={pub} act={act} />;
      case 'statues': return <Choice items={pub.publicConfig.coffrets} value={pub.state.draft.guess} label={(x) => `Coffret ${x}`} onPick={(value) => act({ type: 'statues.choose', value })} />;
      case 'prime-tiles': return <Tiles pub={pub} act={act} />;
      case 'chronology': return <Chronology pub={pub} act={act} />;
      case 'glyphs': return <Glyphs pub={pub} act={act} />;
      case 'cycles': return <Cycles pub={pub} act={act} />;
      case 'equal-balance': return <Offerings pub={pub} act={act} />;
      case 'gears': return <Gears pub={pub} act={act} />;
      case 'light-network': return <Lights pub={pub} act={act} />;
      default: return <p className="muted">Mécanisme inconnu.</p>;
    }
  })();
  return <div className={`pz-mech pz-${pub.mechanic}`} aria-disabled={off || undefined} data-off={off ? 1 : undefined}>{body}</div>;
}

/* ——— Brasiers : trois leviers, une seule ouverture de la grille ——— */

const FLAME_LABEL: Record<string, string> = { flamme: 'brûle', chaud: 'éteint, mais la pierre est chaude', froid: 'éteint et froid' };

function Braziers({ pub, act }: Props) {
  const c = pub.publicConfig, d = pub.state.draft;
  return (
    <div className="pz-braziers">
      <div className="pz-row pz-levers" role="group" aria-label="Leviers">
        {c.leverIds.map((id: string) => (
          <button key={id} type="button" className={`pz-lever ${d.levers[id] ? 'up' : 'down'}`} disabled={d.inspected} aria-pressed={d.levers[id]}
            title={d.inspected ? 'Figé depuis l’ouverture de la grille' : 'Basculer'} onClick={() => act({ type: 'braziers.toggle', id })}>
            <svg viewBox="0 0 40 70" aria-hidden><rect x={14} y={44} width={12} height={22} rx={2} className="pz-bronze" /><g className="pz-lever-arm"><line x1={20} y1={50} x2={20} y2={12} /><circle cx={20} cy={10} r={6} /></g></svg>
            <span>Levier {id} · {d.levers[id] ? 'haut' : 'bas'}</span>
          </button>
        ))}
      </div>
      <div className="pz-row pz-hearths">
        {c.brazierIds.map((b: string) => {
          const o = d.observations?.[b];
          return (
            <figure key={b} className={`pz-hearth ${o ?? 'veiled'}`}>
              <svg viewBox="0 0 80 80" aria-hidden>
                <path d="M12 52 Q40 70 68 52 L62 62 Q40 74 18 62 Z" className="pz-bronze" />
                {o === 'flamme' && <g className="pz-flame"><path d="M40 18 C52 34 50 44 40 52 C30 44 28 34 40 18Z" /><path d="M40 32 C46 40 45 46 40 50 C35 46 34 40 40 32Z" className="core" /></g>}
                {o === 'chaud' && <g className="pz-embers"><circle cx={32} cy={50} r={3} /><circle cx={42} cy={48} r={3.5} /><circle cx={50} cy={51} r={2.5} /><path d="M30 40 q3 -6 0 -12 M40 38 q3 -6 0 -12 M50 40 q3 -6 0 -12" className="heat" /></g>}
                {o === 'froid' && <g className="pz-ash"><ellipse cx={40} cy={51} rx={16} ry={3} /></g>}
                {!o && <g className="pz-grate">{[16, 26, 36, 46, 56, 66].map((x) => <line key={x} x1={x} y1={10} x2={x} y2={68} />)}</g>}
              </svg>
              <figcaption>Brasier {b}{o ? ` · ${FLAME_LABEL[o]}` : ''}</figcaption>
              {d.inspected && (
                <div className="pz-row pz-small" role="group" aria-label={`Levier du brasier ${b}`}>
                  {c.leverIds.map((l: string) => (
                    <button key={l} type="button" className={`pz-chip ${d.guess[b] === l ? 'on' : ''}`} aria-pressed={d.guess[b] === l}
                      onClick={() => act({ type: 'braziers.guess', brazier: b, lever: d.guess[b] === l ? '' : l })}>{l}</button>
                  ))}
                </div>
              )}
            </figure>
          );
        })}
      </div>
      {!d.inspected && <button type="button" className="pz-btn" onClick={() => act({ type: 'braziers.inspect' })}>Ouvrir la grille (une seule fois)</button>}
    </div>
  );
}

/* ——— Galets : une balance, un nombre limité de pesées ——— */

const SIDE_NEXT: Record<string, string> = { reserve: 'left', left: 'right', right: 'reserve' };
const SIDE_LABEL: Record<string, string> = { reserve: 'réserve', left: 'plateau gauche', right: 'plateau droit' };

function Stones({ pub, act }: Props) {
  const c = pub.publicConfig, d = pub.state.draft;
  const last = d.weighings.at(-1);
  const tilt = last ? (last.result === 'left' ? -9 : last.result === 'right' ? 9 : 0) : 0;
  const on = (side: string) => c.stoneIds.filter((x: string) => d.placements[x] === side);
  const left = c.maxWeighings - d.weighings.length;
  return (
    <div className="pz-stones">
      <svg viewBox="0 0 240 110" className="pz-balance" role="img" aria-label={last ? `Dernière pesée : ${last.result === 'equal' ? 'équilibre' : last.result === 'left' ? 'le plateau gauche penche' : 'le plateau droit penche'}` : 'Balance au repos'}>
        <path d="M120 100 L110 30 L130 30 Z" className="pz-bronze" />
        <g style={{ transform: `rotate(${tilt}deg)`, transformOrigin: '120px 30px', transition: 'transform .6s ease' }}>
          <line x1={30} y1={30} x2={210} y2={30} className="pz-beam" />
          {[30, 210].map((x, i) => (
            <g key={x}><line x1={x} y1={30} x2={x - 18} y2={62} /><line x1={x} y1={30} x2={x + 18} y2={62} /><path d={`M${x - 26} 62 Q${x} 78 ${x + 26} 62Z`} className="pz-pan" />
              <text x={x} y={74} textAnchor="middle" className="pz-pan-label">{on(i ? 'right' : 'left').join(' ') || '—'}</text></g>
          ))}
        </g>
      </svg>
      <div className="pz-row pz-pebbles" role="group" aria-label="Galets (clic : réserve → gauche → droite)">
        {c.stoneIds.map((id: string) => (
          <button key={id} type="button" className={`pz-pebble at-${d.placements[id]} ${d.guess === id ? 'chosen' : ''}`}
            title={`Galet ${id} : ${SIDE_LABEL[d.placements[id]]}. Clic pour le déplacer.`} onClick={() => act({ type: 'heavy.move', id, side: SIDE_NEXT[d.placements[id]] })}>
            {id}<small>{d.placements[id] === 'reserve' ? '' : d.placements[id] === 'left' ? '◀' : '▶'}</small>
          </button>
        ))}
      </div>
      <div className="pz-row">
        <button type="button" className="pz-btn" disabled={left <= 0} onClick={() => act({ type: 'heavy.weigh' })}>Peser ({left} pesée{left > 1 ? 's' : ''} restante{left > 1 ? 's' : ''})</button>
        <label className="pz-inline">Galet désigné :
          <select value={d.guess} onChange={(e) => act({ type: 'heavy.guess', id: e.target.value })}>
            <option value="" disabled>—</option>
            {c.stoneIds.map((id: string) => <option key={id} value={id}>{id}</option>)}
          </select>
        </label>
      </div>
      {d.weighings.length > 0 && (
        <ol className="pz-log">
          {d.weighings.map((w: { left: string[]; right: string[]; result: string }, i: number) => (
            <li key={i}>Pesée {i + 1} : {w.left.join(' ')} <span aria-hidden>⚖</span> {w.right.join(' ')} → <b>{w.result === 'equal' ? 'équilibre' : w.result === 'left' ? 'le plateau gauche penche' : 'le plateau droit penche'}</b></li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ——— Jarres : remplir, vider, transvaser (sans graduation) ——— */

function Jugs({ pub, act }: Props) {
  const c = pub.publicConfig, d = pub.state.draft;
  const max = Math.max(...c.capacities);
  return (
    <div className="pz-jugs">
      <div className="pz-row">
        {c.capacities.map((cap: number, i: number) => {
          const h = 90 * (cap / max), fill = d.amounts[i] / cap;
          const state = d.amounts[i] === 0 ? 'vide' : d.amounts[i] === cap ? 'pleine' : 'en partie remplie';
          return (
            <figure key={i} className="pz-jug">
              <svg viewBox="0 0 80 110" role="img" aria-label={`Jarre de ${cap} parts : ${state}`}>
                <defs><clipPath id={`jug-${i}`}><path d={`M18 ${108 - h} Q12 ${108 - h / 2} 16 104 Q40 112 64 104 Q68 ${108 - h / 2} 62 ${108 - h} Z`} /></clipPath></defs>
                <rect x={0} y={108 - h * fill} width={80} height={h * fill} className="pz-water" clipPath={`url(#jug-${i})`} style={{ transition: 'y .5s ease, height .5s ease' }} />
                <path d={`M18 ${108 - h} Q12 ${108 - h / 2} 16 104 Q40 112 64 104 Q68 ${108 - h / 2} 62 ${108 - h} Z`} className="pz-clay" />
                <text x={40} y={108 - h + 14} textAnchor="middle" className="pz-engrave">{cap === 3 ? 'III' : cap === 5 ? 'V' : cap}</text>
              </svg>
              <figcaption>Jarre « {cap} parts » · {state}</figcaption>
              <div className="pz-row pz-small">
                <button type="button" className="pz-chip" onClick={() => act({ type: 'jugs.fill', i })}>Remplir</button>
                <button type="button" className="pz-chip" onClick={() => act({ type: 'jugs.empty', i })}>Vider</button>
                <button type="button" className="pz-chip" onClick={() => act({ type: 'jugs.pour', i, j: 1 - i })}>Verser dans l’autre</button>
              </div>
            </figure>
          );
        })}
      </div>
      <p className="pz-note">{d.moves} geste{d.moves > 1 ? 's' : ''} depuis le début.</p>
    </div>
  );
}

/* ——— Miroirs : le rayon suit la loi de réflexion, recalculée à chaque rotation ——— */

function Mirrors({ pub, act }: Props) {
  const c = pub.publicConfig, d = pub.state.draft;
  const n: number = c.grid, S = 40, pad = 30;
  const tr = traceMirrors(c, d.orientations);
  const P = (x: number, y: number) => `${pad + x * S + S / 2},${pad + y * S + S / 2}`;
  const beam = [P(-1, c.sourceRow), ...tr.points.map((p) => P(p.x, p.y))].join(' ');
  return (
    <svg viewBox={`0 0 ${n * S + 2 * pad} ${n * S + 2 * pad}`} className="pz-mirror-grid" role="group" aria-label={tr.hit ? 'Le rayon atteint le réceptacle' : 'Le rayon n’atteint pas le réceptacle'}>
      {Array.from({ length: n * n }, (_, k) => <rect key={k} x={pad + (k % n) * S} y={pad + Math.floor(k / n) * S} width={S} height={S} className="pz-flag" />)}
      <circle cx={pad - 12} cy={pad + c.sourceRow * S + S / 2} r={8} className="pz-source" />
      <circle cx={pad + n * S + 12} cy={pad + c.targetRow * S + S / 2} r={9} className={`pz-receptacle ${tr.hit ? 'lit' : ''}`} />
      <polyline points={beam} className="pz-beam-light" />
      {c.mirrors.map(([x, y]: [number, number], i: number) => {
        const cx = pad + x * S + S / 2, cy = pad + y * S + S / 2, o = d.orientations[i];
        return (
          <g key={i} className="pz-mirror" role="button" tabIndex={0} aria-label={`Miroir ${i + 1}, orienté ${o === '/' ? 'en barre oblique' : 'en barre oblique inverse'} : pivoter`}
            onClick={() => act({ type: 'mirrors.rotate', index: i })} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act({ type: 'mirrors.rotate', index: i }); } }}>
            <circle cx={cx} cy={cy} r={17} className="pz-mirror-base" />
            <line x1={cx - 13} y1={o === '/' ? cy + 13 : cy - 13} x2={cx + 13} y2={o === '/' ? cy - 13 : cy + 13} className="pz-mirror-glass" style={{ transition: 'all .25s ease' }} />
          </g>
        );
      })}
    </svg>
  );
}

/* ——— Mécanismes plus simples ——— */

function Choice({ items, value, label, onPick }: { items: string[]; value: string; label: (x: string) => string; onPick: (x: string) => void }) {
  return (
    <div className="pz-row" role="radiogroup">
      {items.map((x) => <button key={x} type="button" role="radio" aria-checked={value === x} className={`pz-chip big ${value === x ? 'on' : ''}`} onClick={() => onPick(x)}>{label(x)}</button>)}
    </div>
  );
}

function Tiles({ pub, act }: Props) {
  const c = pub.publicConfig, d = pub.state.draft;
  const [hx, hy] = d.path.at(-1);
  const onPath = (x: number, y: number) => d.path.some(([a, b]: number[]) => a === x && b === y);
  return (
    <div className="pz-tiles" role="grid" style={{ gridTemplateColumns: `repeat(${c.grid[0].length}, 1fr)` }}>
      {c.grid.flatMap((row: number[], y: number) => row.map((v, x) => {
        const near = Math.abs(x - hx) + Math.abs(y - hy) === 1;
        const here = x === hx && y === hy, end = x === c.end[0] && y === c.end[1];
        return (
          <button key={`${x},${y}`} type="button" className={`pz-tile ${onPath(x, y) ? 'walked' : ''} ${here ? 'here' : ''} ${end ? 'end' : ''}`} disabled={!near}
            title={near ? 'Avancer sur cette dalle' : undefined} onClick={() => act({ type: 'prime.step', x, y })}>{v}</button>
        );
      }))}
      <p className="pz-note">{d.mistakes ? `${d.mistakes} faux pas` : 'Aucun faux pas'} · on avance d’une dalle à la fois, jamais en diagonale.</p>
    </div>
  );
}

function Chronology({ pub, act }: Props) {
  const order: string[] = pub.state.draft.order;
  const move = (i: number, k: number) => { const o = [...order]; [o[i], o[i + k]] = [o[i + k], o[i]]; act({ type: 'chronology.reorder', order: o }); };
  return (
    <ol className="pz-fresco">
      {order.map((e, i) => (
        <li key={e}><span>{e}</span>
          <button type="button" className="pz-chip" disabled={i === 0} aria-label={`Avancer ${e}`} onClick={() => move(i, -1)}>▲</button>
          <button type="button" className="pz-chip" disabled={i === order.length - 1} aria-label={`Reculer ${e}`} onClick={() => move(i, 1)}>▼</button>
        </li>
      ))}
    </ol>
  );
}

function Glyphs({ pub, act }: Props) {
  const c = pub.publicConfig, pair = pub.state.draft.pair;
  return (
    <div className="pz-glyphs">
      {[c.firstGlyphs, c.secondGlyphs].map((row: string[], slot: number) => (
        <div key={slot} className="pz-row" role="radiogroup" aria-label={slot ? 'Second glyphe' : 'Premier glyphe'}>
          {row.map((g) => <button key={g} type="button" role="radio" aria-checked={pair[slot] === g} className={`pz-glyph ${pair[slot] === g ? 'on' : ''}`} onClick={() => act({ type: 'glyphs.choose', slot, glyph: g })}>{g}</button>)}
        </div>
      ))}
      <p className="pz-glyph-pair" aria-live="polite">{pair[0]} {pair[1]}</p>
    </div>
  );
}

function Cycles({ pub, act }: Props) {
  const c = pub.publicConfig, tick: number = pub.state.draft.tick;
  return (
    <div className="pz-cycles">
      <div className="pz-row">
        {c.periods.map((p: number, i: number) => {
          const phase = tick % p;
          return (
            <figure key={i} className="pz-dial">
              <svg viewBox="0 0 80 80" aria-hidden><circle cx={40} cy={40} r={32} className="pz-bronze-ring" />
                {Array.from({ length: p }, (_, k) => { const a = (k / p) * Math.PI * 2 - Math.PI / 2; return <circle key={k} cx={40 + Math.cos(a) * 26} cy={40 + Math.sin(a) * 26} r={k === phase ? 5 : 3} className={k === 0 ? 'mark home' : 'mark'} />; })}
                <line x1={40} y1={40} x2={40 + Math.cos((phase / p) * Math.PI * 2 - Math.PI / 2) * 22} y2={40 + Math.sin((phase / p) * Math.PI * 2 - Math.PI / 2) * 22} className="pz-hand" />
              </svg>
              <figcaption>Marée {i + 1} · cycle de {p}</figcaption>
            </figure>
          );
        })}
      </div>
      <label className="pz-inline">Pulsation
        <input type="range" min={c.currentTick + 1} max={c.maxTick} value={Math.max(tick, c.currentTick + 1)} onChange={(e) => act({ type: 'cycles.set', tick: Number(e.target.value) })} />
        <b>{tick}</b> <small>(maintenant : {c.currentTick})</small>
      </label>
    </div>
  );
}

function Offerings({ pub, act }: Props) {
  const c = pub.publicConfig, placed: string[] = pub.state.draft.placements;
  const sum = (side: string) => c.weights.reduce((a: number, w: number, i: number) => a + (placed[i] === side ? w : 0), 0);
  const l = sum('left'), r = sum('right'), tilt = l === r ? 0 : l > r ? -8 : 8;
  return (
    <div className="pz-offerings">
      <svg viewBox="0 0 240 70" className="pz-balance" role="img" aria-label={l === r ? 'Les plateaux sont en équilibre' : `Le plateau ${l > r ? 'gauche' : 'droit'} penche`}>
        <path d="M120 66 L112 22 L128 22 Z" className="pz-bronze" />
        <g style={{ transform: `rotate(${tilt}deg)`, transformOrigin: '120px 22px', transition: 'transform .5s ease' }}><line x1={30} y1={22} x2={210} y2={22} className="pz-beam" /><path d="M6 40 Q30 54 54 40Z" className="pz-pan" /><path d="M186 40 Q210 54 234 40Z" className="pz-pan" /></g>
      </svg>
      <div className="pz-row">
        {c.weights.map((w: number, i: number) => (
          <button key={i} type="button" className={`pz-pebble at-${placed[i]}`} title={`Offrande de ${w} : ${SIDE_LABEL[placed[i]]}`} onClick={() => act({ type: 'equal.move', index: i, side: SIDE_NEXT[placed[i]] })}>
            {w}<small>{placed[i] === 'reserve' ? '' : placed[i] === 'left' ? '◀' : '▶'}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function Gears({ pub, act }: Props) {
  const c = pub.publicConfig, inst = pub.state.draft.installed;
  const chain = [...c.baseGearIds, ...c.optionalGearIds.filter((g: string) => inst[g])];
  return (
    <div className="pz-gears">
      <div className="pz-row" aria-label="Train d’engrenages">
        {chain.map((g: string, i: number) => <span key={g} className={`pz-gear ${i % 2 ? 'ccw' : 'cw'}`} title={i % 2 ? 'tourne à gauche' : 'tourne à droite'}>⚙<small>{g} {i % 2 ? '↺' : '↻'}</small></span>)}
      </div>
      <div className="pz-row">
        {c.optionalGearIds.map((g: string) => <button key={g} type="button" className={`pz-chip ${inst[g] ? 'on' : ''}`} aria-pressed={!!inst[g]} onClick={() => act({ type: 'gears.toggle', id: g })}>{inst[g] ? `Retirer la roue ${g}` : `Ajouter la roue ${g}`}</button>)}
      </div>
    </div>
  );
}

function Lights({ pub, act }: Props) {
  const c = pub.publicConfig, lights: boolean[] = pub.state.draft.lights;
  return (
    <div className="pz-lights">
      <svg viewBox="0 0 200 200" role="group" aria-label="Cristaux">
        <circle cx={100} cy={100} r={70} className="pz-ring" />
        {lights.map((on, i) => {
          const a = (i / c.count) * Math.PI * 2 - Math.PI / 2, x = 100 + Math.cos(a) * 70, y = 100 + Math.sin(a) * 70;
          return (
            <g key={i} role="button" tabIndex={0} aria-label={`Cristal ${i + 1} : ${on ? 'allumé' : 'éteint'} — presser`} className={`pz-crystal ${on ? 'lit' : ''}`}
              onClick={() => act({ type: 'lights.press', index: i })} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act({ type: 'lights.press', index: i }); } }}>
              <path d={`M${x} ${y - 16} L${x + 10} ${y} L${x} ${y + 16} L${x - 10} ${y} Z`} />
            </g>
          );
        })}
      </svg>
      <p className="pz-note">{pub.state.draft.presses} pression{pub.state.draft.presses > 1 ? 's' : ''}.</p>
    </div>
  );
}

