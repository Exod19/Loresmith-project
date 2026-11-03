/**
 * Verrous à énigme de la carte de combat (console MJ) : portes, herses, coffres, meubles à tiroirs, autels. Un clic
 * sur un verrou lance son énigme ; les manipulations des joueurs arrivent de leur écran et sont validées ici.
 */
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { onPlayerPuzzle } from '../present/stage';
import type { Battle } from '../maps/mapStore';
import { LOCKABLE_OBJECTS, OBJECT_DEF, OPENABLE } from '../maps/battle/surface';
import { usePuzzles } from './context';
import { act, lockOf, startRun, withLock, type LockTarget } from './run';
import CarnetPanel from './CarnetPanel';
import LockDialog from './LockDialog';
import PrepPanel from './PrepPanel';
import RunPanel from './RunPanel';
import type { PuzzleAction } from './types';

export default function PuzzleLocks({ b, latest, onBattle }: { b: Battle; latest: MutableRefObject<Battle>; onBattle: (b: Battle) => void }) {
  const lib = usePuzzles();
  const [lockFor, setLockFor] = useState<LockTarget | null>(null);
  const [prep, setPrep] = useState<string | null>(null);
  const [runOpen, setRunOpen] = useState(false);
  const [carnet, setCarnet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const libRef = useRef(lib);
  libRef.current = lib;

  // Les joueurs manipulent le mécanisme sur leur écran : la console applique (ou refuse) l'action.
  useEffect(() => onPlayerPuzzle((action) => {
    const cur = latest.current, run = cur.puzzle;
    const p = run && libRef.current?.puzzles.find((x) => x.id === run.puzzleId);
    if (!run?.shown || !p || String(action.type).startsWith('gm.')) return;
    const r = act(cur, p, action, 'player');
    if (r.patch) onBattle({ ...cur, ...r.patch });
    setError(r.error ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  if (!lib) return null;
  const doors = (b.walls ?? []).filter((w) => OPENABLE.has(w.kind));
  const things = (b.objects ?? []).filter((o) => LOCKABLE_OBJECTS.has(o.kind) || o.lock);
  const labelOf = (on: LockTarget) => {
    if (on.kind === 'wall') { const i = doors.findIndex((w) => w.id === on.id), w = doors[i]; return w?.label ?? `${w?.kind === 'herse' ? 'Herse' : 'Porte'} ${i + 1}`; }
    const i = things.findIndex((o) => o.id === on.id); return `${OBJECT_DEF[things[i]?.kind]?.label ?? 'Objet'} ${i + 1}`;
  };
  const puzzleOf = (id?: string) => lib.puzzles.find((p) => p.id === id);
  const run = b.puzzle, running = run && puzzleOf(run.puzzleId);

  const launch = (on: LockTarget) => {
    const lock = lockOf(b, on), p = puzzleOf(lock?.puzzleId);
    if (!p) { setLockFor(on); return; }
    onBattle({ ...b, puzzle: startRun(b, on, p) });
    setError(null);
    setRunOpen(true);
  };
  const doAct = (a: PuzzleAction, role: 'player' | 'gm') => {
    const cur = latest.current;
    if (!running) return;
    const r = act(cur, running, a, role);
    if (r.patch) onBattle({ ...cur, ...r.patch });
    setError(r.error ?? null);
  };
  const targets: { on: LockTarget; lock?: { puzzleId: string; solved?: boolean } }[] = [
    ...doors.map((w) => ({ on: { kind: 'wall' as const, id: w.id }, lock: w.lock })),
    ...things.map((o) => ({ on: { kind: 'object' as const, id: o.id }, lock: o.lock })),
  ];

  return (
    <>
      <div className="battle-chips" aria-label="Énigmes et verrous">
        {targets.filter((t) => t.lock).map(({ on, lock }) => {
          const p = puzzleOf(lock!.puzzleId);
          return (
            <span key={on.id} className={`battle-chip ${lock!.solved ? 'on' : ''}`}>
              <button type="button" className="maps-btn" onClick={() => launch(on)} title={lock!.solved ? 'Énigme résolue : la revoir' : 'Lancer l’énigme'}>
                {lock!.solved ? '🔓' : '🔒'} <b>{labelOf(on)}</b> · {p?.title ?? 'énigme introuvable'}
              </button>
              <button type="button" className="maps-btn" aria-label={`Changer le verrou de ${labelOf(on)}`} onClick={() => setLockFor(on)}>⚙</button>
            </span>
          );
        })}
        {targets.some((t) => !t.lock) && (
          <select className="battle-chip" value="" aria-label="Verrouiller par une énigme" onChange={(e) => { const t = targets.find((x) => x.on.id === e.target.value); if (t) setLockFor(t.on); }}>
            <option value="">🔒 Verrouiller par une énigme…</option>
            {targets.filter((t) => !t.lock).map((t) => <option key={t.on.id} value={t.on.id}>{labelOf(t.on)}</option>)}
          </select>
        )}
        <button type="button" className="battle-chip" onClick={() => setCarnet(true)}>📜 Carnet du groupe ({lib.clues.filter((c) => c.held).length})</button>
        {run && running && !runOpen && (
          <button type="button" className="battle-chip on" onClick={() => setRunOpen(true)}>🧩 {running.title}{run.shown ? ' · à l’écran joueur' : ''}</button>
        )}
      </div>

      {lockFor && (
        <LockDialog
          targetLabel={labelOf(lockFor)} current={lockOf(b, lockFor)?.puzzleId}
          onPick={(id) => {
            const cur = latest.current;
            const patch = withLock(cur, lockFor, id);
            // Retirer le verrou de l'énigme en cours la referme.
            const stop = cur.puzzle && cur.puzzle.on.id === lockFor.id ? { puzzle: undefined } : {};
            onBattle({ ...cur, ...patch, ...stop });
          }}
          onPrep={(id) => { setLockFor(null); setPrep(id); }}
          onClose={() => setLockFor(null)}
        />
      )}
      {prep && <PrepPanel puzzleId={prep} onClose={() => setPrep(null)} />}
      {carnet && <CarnetPanel onClose={() => setCarnet(false)} />}
      {runOpen && run && running && !prep && (
        <RunPanel
          puzzle={running} run={run} targetLabel={labelOf(run.on)} error={error}
          onAct={doAct}
          onShow={(shown) => onBattle({ ...latest.current, puzzle: { ...run, shown } })}
          onPrep={() => setPrep(running.id)}
          onEnd={() => { onBattle({ ...latest.current, puzzle: undefined }); setRunOpen(false); }}
          onClose={() => setRunOpen(false)}
        />
      )}
    </>
  );
}
