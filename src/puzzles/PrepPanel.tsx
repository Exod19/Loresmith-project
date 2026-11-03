/**
 * Préparer une énigme avant la séance : textes de la scène, observations, documents (sur place ou à trouver ailleurs,
 * à la Myst : ils passent alors dans le carnet, à remettre au groupe quand il les trouve), indices, conséquences,
 * puis contrôle : elle n'est « prête » qu'une fois chaque point vérifié par le MJ.
 */
import { useState } from 'react';
import { usePuzzles } from './context';
import { MECHANIC_LABEL } from './engine';
import type { Clue, Puzzle } from './types';

const uid = () => Math.random().toString(36).slice(2, 10);

export default function PrepPanel({ puzzleId, onClose }: { puzzleId: string; onClose: () => void }) {
  const lib = usePuzzles();
  const saved = lib?.puzzles.find((p) => p.id === puzzleId);
  const [p, setP] = useState<Puzzle | undefined>(saved && JSON.parse(JSON.stringify(saved)));
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  if (!lib || !p) return null;
  const pl = p.player, gm = p.gm;
  const setPl = (patch: Partial<Puzzle['player']>) => setP({ ...p, player: { ...pl, ...patch } });
  const setGm = (patch: Partial<Puzzle['gm']>) => setP({ ...p, gm: { ...gm, ...patch } });
  const clueOf = (id?: string) => lib.clues.find((c) => c.id === id);
  const readables = pl.readables ?? [];
  const checklist = [
    ...(gm.readyBeforeSession ?? []),
    'J’ai lu la démonstration et je sais l’expliquer.',
    ...readables.filter((r) => r.clueId).map((r) => `« ${r.source} » est placé dans une scène que le groupe peut atteindre avant ce verrou.`),
  ];
  const ready = checklist.every((_, i) => checked[i]);

  const save = (next: Puzzle = p) => { lib.savePuzzle(next); onClose(); };
  /** Un document quitte la scène : il devient une page du carnet, que le groupe devra trouver ailleurs. */
  const moveToCarnet = (i: number) => {
    const r = readables[i];
    const clue: Clue = { id: `indice-${uid()}`, universeId: lib.universeId, title: r.source, kind: 'page', text: r.text, held: false, puzzleId: p.id,
      gmNote: `Document de l’énigme « ${p.title} ». À placer dans une autre scène : remets-le au groupe quand il le trouve.`, createdAt: Date.now() };
    lib.saveClue(clue);
    setPl({ readables: readables.map((x, k) => (k === i ? { ...x, clueId: clue.id } : x)) });
  };
  const backToScene = (i: number) => setPl({ readables: readables.map((x, k) => (k === i ? { source: x.source, text: x.text } : x)) });

  return (
    <div className="pz-modal" role="dialog" aria-label={`Préparer : ${p.title}`}>
      <div className="pz-modal-box wide">
        <header className="pz-modal-head">
          <b>Préparer · {MECHANIC_LABEL[p.mechanic]}</b>
          <div className="pz-row pz-small">
            <button type="button" className="pz-btn ghost" onClick={onClose}>Annuler</button>
            <button type="button" className="pz-btn primary" onClick={() => save()}>Enregistrer</button>
          </div>
        </header>
        <div className="pz-prep">
          <section>
            <h3>Ce que voient les joueurs</h3>
            <label>Titre<input className="input" value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} /></label>
            <label>Lieu<input className="input" value={pl.location ?? ''} onChange={(e) => setPl({ location: e.target.value })} /></label>
            <label>Scène<textarea className="input" rows={3} value={pl.sceneDescription ?? ''} onChange={(e) => setPl({ sceneDescription: e.target.value })} /></label>
            <label>Objectif<input className="input" value={pl.objective ?? ''} onChange={(e) => setPl({ objective: e.target.value })} /></label>
            <h3>Observations</h3>
            {pl.observations.map((o, i) => (
              <div key={o.id} className="pz-prep-row">
                <input className="input" value={o.text} onChange={(e) => setPl({ observations: pl.observations.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })} />
                <select className="input" value={o.available === 'initiale' ? 'initiale' : 'inspection'} onChange={(e) => setPl({ observations: pl.observations.map((x, k) => (k === i ? { ...x, available: e.target.value === 'initiale' ? 'initiale' : 'inspection_sans_jet' } : x)) })}>
                  <option value="initiale">visible d’emblée</option><option value="inspection">en examinant</option>
                </select>
                <button type="button" className="pz-chip" aria-label="Retirer" onClick={() => setPl({ observations: pl.observations.filter((_, k) => k !== i) })}>✕</button>
              </div>
            ))}
            <button type="button" className="pz-chip" onClick={() => setPl({ observations: [...pl.observations, { id: `obs-${uid()}`, text: '', available: 'inspection_sans_jet' }] })}>+ Observation</button>
            <h3>Documents</h3>
            <p className="pz-note">Sur place, ils s’affichent avec l’énigme. « À trouver ailleurs » : ils passent dans le carnet et n’apparaissent que lorsque tu les remets au groupe.</p>
            {readables.map((r, i) => {
              const c = clueOf(r.clueId);
              return (
                <div key={i} className="pz-prep-doc">
                  <b>{r.source}</b> <span className="pz-note">{r.text}</span>
                  {r.clueId
                    ? <span className="pz-row pz-small"><small className={`pz-status ${c?.held ? 'prete' : 'brouillon'}`}>{c?.held ? 'dans le carnet du groupe' : 'à trouver ailleurs'}</small><button type="button" className="pz-chip" onClick={() => backToScene(i)}>Remettre sur place</button></span>
                    : <button type="button" className="pz-chip" onClick={() => moveToCarnet(i)}>À trouver ailleurs →</button>}
                </div>
              );
            })}
          </section>
          <section>
            <h3>Réservé au MJ</h3>
            {gm.deductionPath?.length ? <ol className="pz-proof">{gm.deductionPath.map((x, i) => <li key={i}>{x}</li>)}</ol> : <p className="pz-note">{gm.solutionRationale}</p>}
            <h3>Indices gradués (jamais la réponse)</h3>
            {gm.nonSpoilerHints.map((h, i) => (
              <div key={i} className="pz-prep-row">
                <input className="input" value={h.text} onChange={(e) => setGm({ nonSpoilerHints: gm.nonSpoilerHints.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })} />
              </div>
            ))}
            <h3>En cas d’échec</h3>
            <label>Conséquence<textarea className="input" rows={2} value={gm.failureForward.onWrongAnswer} onChange={(e) => setGm({ failureForward: { ...gm.failureForward, onWrongAnswer: e.target.value } })} /></label>
            <label>Après combien d’erreurs (0 : jamais)<input className="input" type="number" min={0} max={9} value={gm.failureForward.threshold} onChange={(e) => setGm({ failureForward: { ...gm.failureForward, threshold: Math.max(0, Number(e.target.value) || 0) } })} /></label>
            {gm.alternateBypass && <p className="pz-note"><b>Détour :</b> {gm.alternateBypass}</p>}
            <h3>Contrôle avant la séance</h3>
            {checklist.map((item, i) => (
              <label key={i} className="pz-check"><input type="checkbox" checked={!!checked[i]} onChange={(e) => setChecked({ ...checked, [i]: e.target.checked })} /> {item}</label>
            ))}
            <div className="pz-row pz-small">
              <button type="button" className="pz-btn" disabled={!ready} title={ready ? '' : 'Coche chaque point d’abord'} onClick={() => save({ ...p, status: 'prete' })}>✔ Marquer prête et enregistrer</button>
              {p.status === 'prete' && <button type="button" className="pz-chip" onClick={() => save({ ...p, status: 'brouillon' })}>Repasser en brouillon</button>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
