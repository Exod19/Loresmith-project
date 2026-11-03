/**
 * Mener une énigme en partie (console MJ) : à gauche, ce que voient les joueurs (le MJ peut manipuler pour eux) ;
 * à droite, ce que lui seul sait : démonstration, indices à donner un par un, jets utiles, conséquences des erreurs,
 * documents du carnet. Il peut projeter l'énigme, la suspendre, la réinitialiser ou accepter une solution narrative.
 */
import { usePuzzles } from './context';
import { MECHANIC_LABEL, publicProjection } from './engine';
import PuzzleStage from './PuzzleStage';
import type { PuzzleRun } from '../maps/mapStore';
import type { Puzzle, PuzzleAction } from './types';

export default function RunPanel({ puzzle, run, targetLabel, error, onAct, onShow, onPrep, onEnd, onClose }: {
  puzzle: Puzzle; run: PuzzleRun; targetLabel: string; error?: string | null;
  onAct: (a: PuzzleAction, role: 'player' | 'gm') => void;
  onShow: (shown: boolean) => void;
  onPrep: () => void;
  /** Clôt l'épreuve (le verrou garde son état : résolu ou non). */
  onEnd: () => void;
  onClose: () => void;
}) {
  const lib = usePuzzles();
  const clues = lib?.clues ?? [];
  const s = run.state, gm = puzzle.gm;
  const pub = publicProjection(puzzle, s, clues);
  const docs = (puzzle.player.readables ?? []).filter((r) => r.clueId).map((r) => ({ r, c: clues.find((c) => c.id === r.clueId) }));
  const nextHint = gm.nonSpoilerHints[s.hintLevel];
  return (
    <div className="pz-modal" role="dialog" aria-label={`Énigme : ${puzzle.title}`}>
      <div className="pz-modal-box full">
        <header className="pz-modal-head">
          <b>🔒 {targetLabel} · {MECHANIC_LABEL[puzzle.mechanic]} {puzzle.status !== 'prete' && <small className="pz-status brouillon">brouillon</small>}</b>
          <div className="pz-row pz-small">
            <button type="button" className={`pz-btn ${run.shown ? 'on' : ''}`} aria-pressed={run.shown} onClick={() => onShow(!run.shown)}>
              {run.shown ? '👁 Montrée aux joueurs' : '👁 Montrer aux joueurs'}
            </button>
            <button type="button" className="pz-btn ghost" onClick={onClose}>Fermer</button>
          </div>
        </header>
        {error && <p className="pz-feedback failure" role="alert">{error}</p>}
        <div className="pz-run">
          <PuzzleStage pub={pub} act={(a) => onAct(a, 'player')} compact />
          <aside className="pz-gm">
            <h3>État</h3>
            <p>{s.status === 'solved' ? '✔ Résolue : le verrou a cédé.' : s.status === 'paused' ? '⏸ Suspendue.' : '▶ En cours.'} {s.attempts} tentative{s.attempts > 1 ? 's' : ''}, {s.hintLevel} indice{s.hintLevel > 1 ? 's' : ''} donné{s.hintLevel > 1 ? 's' : ''}.</p>
            <h3>Démonstration</h3>
            {gm.deductionPath?.length ? <ol className="pz-proof">{gm.deductionPath.map((x, i) => <li key={i}>{x}</li>)}</ol> : <p>{gm.solutionRationale}</p>}
            {!!gm.acceptedAlternativeApproaches?.length && <><h3>Autres voies acceptables</h3><ul className="pz-proof">{gm.acceptedAlternativeApproaches.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
            <h3>Indices</h3>
            {nextHint ? (
              <p>Suivant : « {nextHint.text} » <button type="button" className="pz-chip" onClick={() => onAct({ type: 'gm.revealHint' }, 'gm')}>Le donner</button></p>
            ) : <p className="pz-note">Tous les indices sont donnés. Si le groupe bloque encore, préfère le détour à la réponse.</p>}
            {!!gm.skillChecks?.length && (
              <>
                <h3>Jets utiles (ils éclairent, ils ne résolvent pas)</h3>
                <ul className="pz-proof">{gm.skillChecks.map((k, i) => <li key={i}><b>{k.skill}</b> : {k.result}</li>)}</ul>
              </>
            )}
            {docs.length > 0 && (
              <>
                <h3>Documents à trouver ailleurs</h3>
                <ul className="pz-proof">
                  {docs.map(({ r, c }, i) => (
                    <li key={i}>{r.source} — {c ? (c.held ? '✔ dans le carnet' : <button type="button" className="pz-chip" onClick={() => lib?.saveClue({ ...c, held: true })}>Remettre au groupe</button>) : 'indice supprimé'}</li>
                  ))}
                </ul>
              </>
            )}
            {s.effects.some((e) => e.kind === 'gm-resolution') && (
              <>
                <h3>Conséquences à résoudre</h3>
                <ul className="pz-proof">
                  {s.effects.map((e, i) => e.kind === 'gm-resolution' && (
                    <li key={i} className={e.handled ? 'done' : ''}>{e.text} {!e.handled && <button type="button" className="pz-chip" onClick={() => onAct({ type: 'gm.handleEffect', index: i }, 'gm')}>Traitée</button>}</li>
                  ))}
                </ul>
                {gm.failureForward.cost && <p className="pz-note">Coût prévu : {gm.failureForward.cost}</p>}
              </>
            )}
            {gm.alternateBypass && <p className="pz-note"><b>Détour :</b> {gm.alternateBypass}</p>}
            <h3>Le MJ</h3>
            <div className="pz-row pz-small" style={{ justifyContent: 'flex-start' }}>
              {s.status === 'paused'
                ? <button type="button" className="pz-chip" onClick={() => onAct({ type: 'gm.resume' }, 'gm')}>▶ Reprendre</button>
                : <button type="button" className="pz-chip" disabled={s.status === 'solved'} onClick={() => onAct({ type: 'gm.pause' }, 'gm')}>⏸ Suspendre</button>}
              <button type="button" className="pz-chip" onClick={() => { if (confirm('Remettre le mécanisme à zéro ?')) onAct({ type: 'gm.reset' }, 'gm'); }}>↺ Réinitialiser</button>
              <button type="button" className="pz-chip" disabled={s.status === 'solved'} title="Solution narrative acceptée, sort, force brute coûteuse…" onClick={() => onAct({ type: 'gm.forceSuccess' }, 'gm')}>✔ Le verrou cède</button>
              <button type="button" className="pz-chip" onClick={onPrep}>✎ Préparer</button>
              <button type="button" className="pz-chip" onClick={onEnd} title="Retire l’énigme de l’écran joueur et la clôt ; le verrou reste résolu ou non">⏹ Clore l’épreuve</button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
