/**
 * Atelier, étape 3 : régler les règles du mécanisme (configuration publique) et sa solution (configuration secrète).
 * Un éditeur par mécanisme ; ce qui se déduit (ordre des fresques, prochain alignement, bon coffret) est proposé
 * par le solveur plutôt que saisi à la main.
 */
import type { ReactNode } from 'react';
import { claimText, type Claim } from './solver';
import type { Puzzle } from './types';

type Props = { p: Puzzle; onChange: (p: Puzzle) => void };

const letters = (n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

export default function MechanismConfig({ p, onChange }: Props) {
  const c = p.engine.publicConfig, s = p.engine.serverConfig ?? {};
  const setPub = (patch: any) => onChange({ ...p, engine: { ...p.engine, publicConfig: { ...c, ...patch } } });
  const setSec = (patch: any) => onChange({ ...p, engine: { ...p.engine, serverConfig: { ...s, ...patch } } });
  const setBoth = (pub: any, sec: any) => onChange({ ...p, engine: { ...p.engine, publicConfig: { ...c, ...pub }, serverConfig: { ...s, ...sec } } });
  const field = (label: string, input: ReactNode, hint?: string) => <label className="pz-field">{label}{input}{hint && <small className="pz-note">{hint}</small>}</label>;

  switch (p.mechanic) {
    case 'braziers':
      return (
        <div className="pz-config">
          <p className="pz-note">Trois leviers (A, B, C) et trois brasiers (I, II, III). Une seule ouverture de la grille ne distingue que trois états : flamme, chaud, froid.</p>
          <div className="pz-row" style={{ justifyContent: 'flex-start' }}>
            {c.brazierIds.map((b: string, i: number) => field(`Brasier ${b} ← levier`, (
              <select className="input" value={s.brazierToLever?.[i] ?? ''} onChange={(e) => { const m = [...(s.brazierToLever ?? [])]; m[i] = e.target.value; setSec({ brazierToLever: m }); }}>
                {c.leverIds.map((l: string) => <option key={l} value={l}>{l}</option>)}
              </select>
            )))}
          </div>
        </div>
      );
    case 'heavy-stone':
      return (
        <div className="pz-config">
          {field('Nombre de galets', <input className="input" type="number" min={3} max={27} value={c.stoneIds.length} onChange={(e) => { const ids = letters(num(e.target.value, 3, 27)); setBoth({ stoneIds: ids }, { heavyStoneId: ids.includes(s.heavyStoneId) ? s.heavyStoneId : ids[ids.length - 1] }); }} />)}
          {field('Pesées permises', <input className="input" type="number" min={1} max={4} value={c.maxWeighings} onChange={(e) => setPub({ maxWeighings: num(e.target.value, 1, 4) })} />, 'Une pesée a trois issues : n pesées départagent au plus 3ⁿ galets.')}
          {field('Galet lourd (secret)', <select className="input" value={s.heavyStoneId} onChange={(e) => setSec({ heavyStoneId: e.target.value })}>{c.stoneIds.map((x: string) => <option key={x}>{x}</option>)}</select>)}
        </div>
      );
    case 'jugs':
      return (
        <div className="pz-config pz-row" style={{ justifyContent: 'flex-start' }}>
          {[0, 1].map((i) => field(`Jarre ${i + 1} (parts)`, <input className="input" type="number" min={1} max={20} value={c.capacities[i]} onChange={(e) => { const cap = [...c.capacities]; cap[i] = num(e.target.value, 1, 20); setPub({ capacities: cap }); }} />))}
          {field('Quantité exigée', <input className="input" type="number" min={1} max={20} value={c.target} onChange={(e) => setPub({ target: num(e.target.value, 1, 20) })} />, 'Atteignable seulement si c’est un multiple du PGCD des deux jarres.')}
        </div>
      );
    case 'statues': {
      const claims: Claim[] = p.design?.claims ?? c.coffrets.map((k: string) => ({ statue: k, is: false, chest: k }));
      const setClaims = (next: Claim[]) => onChange({
        ...p,
        design: { ...p.design, claims: next },
        // Les inscriptions sont les textes que lisent les joueurs : elles suivent les affirmations.
        player: { ...p.player, readables: next.map((cl) => ({ source: `Statue ${cl.statue}`, text: claimText(cl) })) },
      });
      return (
        <div className="pz-config">
          {field('Nombre de statues et de coffrets', <input className="input" type="number" min={3} max={6} value={c.coffrets.length} onChange={(e) => {
            const ids = letters(num(e.target.value, 3, 6));
            setPub({ coffrets: ids });
            setClaims(ids.map((k) => claims.find((cl) => cl.statue === k) ?? { statue: k, is: false, chest: k }));
          }} />)}
          <p className="pz-note">Exactement {c.truthCount ?? 1} inscription dit vrai. Chaque statue affirme :</p>
          {claims.map((cl, i) => (
            <div key={cl.statue} className="pz-prep-row">
              <b style={{ minWidth: 70 }}>Statue {cl.statue}</b>
              <select className="input" value={cl.is ? 'est' : 'pas'} onChange={(e) => setClaims(claims.map((x, k) => (k === i ? { ...x, is: e.target.value === 'est' } : x)))}>
                <option value="est">la clé se trouve dans</option><option value="pas">la clé n’est pas dans</option>
              </select>
              <select className="input" value={cl.chest} onChange={(e) => setClaims(claims.map((x, k) => (k === i ? { ...x, chest: e.target.value } : x)))}>
                {c.coffrets.map((k: string) => <option key={k} value={k}>le coffret {k}</option>)}
              </select>
            </div>
          ))}
          {field('Bon coffret (secret)', <select className="input" value={s.correctChest} onChange={(e) => setSec({ correctChest: e.target.value })}>{c.coffrets.map((k: string) => <option key={k}>{k}</option>)}</select>, 'Le solveur (étape 5) dit lequel la logique désigne.')}
        </div>
      );
    }
    case 'mirrors': {
      const n: number = c.grid;
      const at = (x: number, y: number) => c.mirrors.findIndex(([a, b]: number[]) => a === x && b === y);
      const cycle = (x: number, y: number) => {
        const i = at(x, y);
        if (i < 0) return setPub({ mirrors: [...c.mirrors, [x, y]], initial: [...c.initial, '/'] });
        if (c.initial[i] === '/') return setPub({ initial: c.initial.map((o: string, k: number) => (k === i ? '\\' : o)) });
        setPub({ mirrors: c.mirrors.filter((_: unknown, k: number) => k !== i), initial: c.initial.filter((_: unknown, k: number) => k !== i) });
      };
      return (
        <div className="pz-config">
          <div className="pz-row" style={{ justifyContent: 'flex-start' }}>
            {field('Taille', <input className="input" type="number" min={3} max={8} value={n} onChange={(e) => { const g = num(e.target.value, 3, 8); const keep = c.mirrors.map((m: number[], i: number) => [m, i]).filter(([m]: any) => m[0] < g && m[1] < g); setPub({ grid: g, sourceRow: Math.min(c.sourceRow, g - 1), targetRow: Math.min(c.targetRow, g - 1), mirrors: keep.map(([m]: any) => m), initial: keep.map(([, i]: any) => c.initial[i]) }); }} />)}
            {field('Rangée de la source (gauche)', <input className="input" type="number" min={1} max={n} value={c.sourceRow + 1} onChange={(e) => setPub({ sourceRow: num(e.target.value, 1, n) - 1 })} />)}
            {field('Rangée du réceptacle (droite)', <input className="input" type="number" min={1} max={n} value={c.targetRow + 1} onChange={(e) => setPub({ targetRow: num(e.target.value, 1, n) - 1 })} />)}
          </div>
          <p className="pz-note">Clic sur une case : poser un miroir « / », le tourner « \ », le retirer. L’orientation posée est celle de départ.</p>
          <div className="pz-cfg-grid" style={{ gridTemplateColumns: `repeat(${n}, 34px)` }}>
            {Array.from({ length: n * n }, (_, k) => {
              const x = k % n, y = Math.floor(k / n), i = at(x, y);
              return <button key={k} type="button" className={`pz-cfg-cell ${y === c.sourceRow && x === 0 ? 'src' : ''} ${y === c.targetRow && x === n - 1 ? 'dst' : ''}`} onClick={() => cycle(x, y)}>{i >= 0 ? c.initial[i] : ''}</button>;
            })}
          </div>
        </div>
      );
    }
    case 'prime-tiles': {
      const g: number[][] = c.grid;
      const setCell = (x: number, y: number, v: number) => setPub({ grid: g.map((row, b) => row.map((w, a) => (a === x && b === y ? v : w))) });
      const resize = (cols: number, rows: number) => setPub({ grid: Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => g[y]?.[x] ?? 4)), end: [cols - 1, rows - 1], start: [0, 0] });
      return (
        <div className="pz-config">
          <div className="pz-row" style={{ justifyContent: 'flex-start' }}>
            {field('Colonnes', <input className="input" type="number" min={3} max={7} value={g[0].length} onChange={(e) => resize(num(e.target.value, 3, 7), g.length)} />)}
            {field('Rangées', <input className="input" type="number" min={3} max={7} value={g.length} onChange={(e) => resize(g[0].length, num(e.target.value, 3, 7))} />)}
          </div>
          <p className="pz-note">Départ en haut à gauche, arrivée en bas à droite. La règle (nombres premiers) doit être découverte par les joueurs : place-la dans un document ou une observation.</p>
          <div className="pz-cfg-grid" style={{ gridTemplateColumns: `repeat(${g[0].length}, 52px)` }}>
            {g.flatMap((row, y) => row.map((v, x) => <input key={`${x},${y}`} className="input pz-cfg-num" type="number" min={1} max={99} value={v} onChange={(e) => setCell(x, y, num(e.target.value, 1, 99))} />))}
          </div>
        </div>
      );
    }
    case 'chronology': {
      const ev: string[] = c.events, rel: [string, string][] = s.relations ?? [];
      const setEvents = (next: string[]) => setBoth({ events: next, initialOrder: [...next].reverse() }, { relations: rel.filter(([a, b]) => next.includes(a) && next.includes(b)), orderedEvents: next });
      return (
        <div className="pz-config">
          {field('Événements (un par ligne)', <textarea className="input" rows={5} value={ev.join('\n')} onChange={(e) => setEvents(e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} />, 'L’ordre de départ montré aux joueurs est mélangé.')}
          <p className="pz-note">Ce que disent les témoignages (à écrire dans des documents dispersés) :</p>
          {rel.map(([a, b], i) => (
            <div key={i} className="pz-prep-row">
              <select className="input" value={a} onChange={(e) => setSec({ relations: rel.map((r, k) => (k === i ? [e.target.value, r[1]] : r)) })}>{ev.map((x) => <option key={x}>{x}</option>)}</select>
              <span>avant</span>
              <select className="input" value={b} onChange={(e) => setSec({ relations: rel.map((r, k) => (k === i ? [r[0], e.target.value] : r)) })}>{ev.map((x) => <option key={x}>{x}</option>)}</select>
              <button type="button" className="pz-chip" onClick={() => setSec({ relations: rel.filter((_, k) => k !== i) })}>✕</button>
            </div>
          ))}
          <button type="button" className="pz-chip" onClick={() => setSec({ relations: [...rel, [ev[0], ev[1] ?? ev[0]]] })}>+ Témoignage</button>
          <button type="button" className="pz-chip" onClick={() => setPub({ initialOrder: [...ev].sort(() => Math.random() - 0.5) })}>Mélanger l’ordre de départ</button>
        </div>
      );
    }
    case 'glyphs':
      return (
        <div className="pz-config">
          {[0, 1].map((slot) => field(slot ? 'Seconds glyphes' : 'Premiers glyphes', <input className="input" value={(slot ? c.secondGlyphs : c.firstGlyphs).join(' ')} onChange={(e) => { const g = e.target.value.split(/\s+/).filter(Boolean); setPub(slot ? { secondGlyphs: g } : { firstGlyphs: g }); }} />, 'Séparés par des espaces.'))}
          <div className="pz-row" style={{ justifyContent: 'flex-start' }}>
            {[0, 1].map((slot) => field(`Glyphe ${slot + 1} attendu (secret)`, <select className="input" value={s.correct?.[slot] ?? ''} onChange={(e) => { const cor = [...(s.correct ?? ['', ''])]; cor[slot] = e.target.value; setSec({ correct: cor }); }}>{(slot ? c.secondGlyphs : c.firstGlyphs).map((g: string) => <option key={g}>{g}</option>)}</select>))}
          </div>
          <p className="pz-note">Les exemples de traduction (documents) doivent permettre de déduire le sens de chaque glyphe.</p>
        </div>
      );
    case 'cycles':
      return (
        <div className="pz-config pz-row" style={{ justifyContent: 'flex-start' }}>
          {field('Cycles (séparés par des virgules)', <input className="input" value={c.periods.join(', ')} onChange={(e) => setPub({ periods: e.target.value.split(/[,\s]+/).map((x) => num(x, 2, 30)).filter(Boolean) })} />)}
          {field('Pulsation actuelle', <input className="input" type="number" min={0} max={200} value={c.currentTick} onChange={(e) => setPub({ currentTick: num(e.target.value, 0, 200) })} />)}
          {field('Dernière pulsation possible', <input className="input" type="number" min={1} max={400} value={c.maxTick} onChange={(e) => setPub({ maxTick: num(e.target.value, 1, 400) })} />)}
        </div>
      );
    case 'equal-balance':
      return (
        <div className="pz-config">
          {field('Masses des offrandes', <input className="input" value={c.weights.join(', ')} onChange={(e) => { const w = e.target.value.split(/[,\s]+/).map((x) => num(x, 1, 99)).filter(Boolean); setPub({ weights: w, targetPerSide: w.reduce((a, b) => a + b, 0) / 2 }); }} />, `Somme ${c.weights.reduce((a: number, b: number) => a + b, 0)} : chaque plateau doit porter ${c.targetPerSide}. Une somme impaire rend l’énigme impossible.`)}
        </div>
      );
    case 'gears':
      return (
        <div className="pz-config pz-row" style={{ justifyContent: 'flex-start' }}>
          {field('Roues fixes', <input className="input" type="number" min={2} max={8} value={c.baseGearIds.length} onChange={(e) => setPub({ baseGearIds: letters(num(e.target.value, 2, 8)) })} />)}
          {field('Roues à ajouter ou retirer', <input className="input" type="number" min={1} max={4} value={c.optionalGearIds.length} onChange={(e) => setPub({ optionalGearIds: ['X', 'Y', 'Z', 'W'].slice(0, num(e.target.value, 1, 4)) })} />)}
        </div>
      );
    case 'light-network': {
      const n: number = c.count;
      const toggle = (key: 'initial' | 'target', i: number) => setPub({ [key]: c[key].map((v: boolean, k: number) => (k === i ? !v : v)) });
      return (
        <div className="pz-config">
          {field('Nombre de cristaux', <input className="input" type="number" min={3} max={9} value={n} onChange={(e) => { const m = num(e.target.value, 3, 9); setPub({ count: m, initial: Array.from({ length: m }, (_, i) => c.initial[i] ?? false), target: Array.from({ length: m }, () => true) }); }} />)}
          {(['initial', 'target'] as const).map((key) => (
            <div key={key} className="pz-prep-row"><b style={{ minWidth: 90 }}>{key === 'initial' ? 'Au départ' : 'À obtenir'}</b>
              {Array.from({ length: n }, (_, i) => <button key={i} type="button" className={`pz-chip ${c[key][i] ? 'on' : ''}`} onClick={() => toggle(key, i)}>{i + 1} {c[key][i] ? '✦' : '·'}</button>)}
            </div>
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}

