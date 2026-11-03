/**
 * L'énigme telle que la voient les joueurs : la scène, l'objectif, ce qu'ils ont observé, le mécanisme à manipuler,
 * et leur carnet (ce qu'ils ont ramassé en chemin). « Examiner la scène » est une action normale ; les indices, eux,
 * ne viennent que du MJ. Aucun texte ici ne vient de la solution.
 */
import { useState } from 'react';
import Mechanism, { SUBMIT_LABEL } from './Mechanism';
import { CLUE_KINDS, type PublicPuzzle, type PuzzleAction } from './types';
import './puzzles.css';

const KIND = Object.fromEntries(CLUE_KINDS.map((k) => [k.id, k]));

export default function PuzzleStage({ pub, act, compact }: { pub: PublicPuzzle; act: (a: PuzzleAction) => void; compact?: boolean }) {
  const [carnet, setCarnet] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const s = pub.state, pl = pub.player;
  const solved = s.status === 'solved', paused = s.status === 'paused';
  const page = pub.carnet.find((c) => c.id === open);
  return (
    <section className={`pz-stage ${compact ? 'compact' : ''} ${solved ? 'is-solved' : ''}`} aria-label={`Énigme : ${pub.title}`}>
      <header className="pz-head">
        <div>
          {pl.location && <p className="pz-where">{pl.location}</p>}
          <h2>{pub.title}</h2>
        </div>
        <button type="button" className={`pz-btn ghost ${carnet ? 'on' : ''}`} aria-expanded={carnet} onClick={() => setCarnet(!carnet)}>
          📜 Carnet du groupe ({pub.carnet.length})
        </button>
      </header>

      <div className="pz-body">
        <aside className="pz-notes">
          {pl.sceneDescription && <p className="pz-scene">{pl.sceneDescription}</p>}
          {pl.objective && <p className="pz-goal"><b>Objectif.</b> {pl.objective}</p>}
          <h3>Observations</h3>
          <ul className="pz-obs">{pl.observations.map((o) => <li key={o.id}>{o.text}</li>)}</ul>
          {pl.canInspectScene && !solved && <button type="button" className="pz-btn ghost" onClick={() => act({ type: 'scene.inspect' })}>🔍 Examiner la scène</button>}
          {pl.readables.length > 0 && (
            <>
              <h3>Inscriptions</h3>
              {pl.readables.map((r, i) => <blockquote key={i} className="pz-readable"><cite>{r.source}</cite>{r.text}</blockquote>)}
            </>
          )}
          {s.hints.length > 0 && (
            <>
              <h3>Ce que souffle le MJ</h3>
              <ol className="pz-hints">{s.hints.map((h, i) => <li key={i}>{h}</li>)}</ol>
            </>
          )}
        </aside>

        <div className="pz-center">
          <Mechanism pub={pub} act={act} />
          <div className="pz-actions">
            <button type="button" className="pz-btn primary" disabled={s.status !== 'active'} onClick={() => act({ type: 'submit' })}>{SUBMIT_LABEL[pub.mechanic] ?? 'Soumettre'}</button>
            {s.attempts > 0 && <small className="pz-note">{s.attempts} tentative{s.attempts > 1 ? 's' : ''}</small>}
          </div>
          {s.feedback && <p className={`pz-feedback ${s.feedback.kind}`} role="status">{s.feedback.message}</p>}
          {paused && <p className="pz-feedback paused" role="status">Le mécanisme est figé pour l’instant.</p>}
          {s.effects.length > 0 && <ul className="pz-effects">{s.effects.slice(-3).map((e, i) => <li key={i}>{e.text}</li>)}</ul>}
        </div>
      </div>

      {carnet && (
        <div className="pz-carnet" role="dialog" aria-label="Carnet du groupe">
          <header><b>Carnet du groupe</b><button type="button" className="pz-btn ghost" onClick={() => { setCarnet(false); setOpen(null); }}>Fermer</button></header>
          {pub.carnet.length === 0 ? <p className="pz-note">Le groupe n’a encore rien ramassé.</p> : (
            <div className="pz-carnet-grid">
              {pub.carnet.map((c) => (
                <button key={c.id} type="button" className={`pz-page ${open === c.id ? 'on' : ''}`} onClick={() => setOpen(open === c.id ? null : c.id)}>
                  {c.image ? <img src={c.image} alt="" /> : <span className="pz-page-glyph" aria-hidden>{KIND[c.kind]?.glyph ?? '📜'}</span>}
                  <span>{c.title}</span>
                </button>
              ))}
            </div>
          )}
          {page && (
            <article className="pz-page-open">
              <h4>{KIND[page.kind]?.glyph} {page.title}</h4>
              {page.image && <img src={page.image} alt={page.title} />}
              {page.text && <p>{page.text}</p>}
            </article>
          )}
        </div>
      )}
    </section>
  );
}
