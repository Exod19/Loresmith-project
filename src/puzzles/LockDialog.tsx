/**
 * Verrouiller une porte, une herse ou un objet par une énigme : choisir une énigme du grimoire, ou en importer une
 * depuis le catalogue (copiée en brouillon : le MJ la vérifie avant de la jouer). Console MJ seulement.
 */
import { useEffect, useState } from 'react';
import { usePuzzles } from './context';
import { fromModel, loadCatalogue } from './catalogue';
import { MECHANIC_LABEL } from './engine';
import type { Puzzle } from './types';

export default function LockDialog({ targetLabel, current, onPick, onPrep, onClose }: {
  targetLabel: string;
  current?: string;
  onPick: (puzzleId: string | null) => void;
  /** Ouvre la préparation d'une énigme (textes, documents à cacher ailleurs, vérification). */
  onPrep: (puzzleId: string) => void;
  onClose: () => void;
}) {
  const lib = usePuzzles();
  const [models, setModels] = useState<Puzzle[] | null>(null);
  const [tab, setTab] = useState<'grimoire' | 'catalogue'>(lib?.puzzles.length ? 'grimoire' : 'catalogue');
  useEffect(() => { if (tab === 'catalogue' && !models) loadCatalogue().then(setModels).catch(() => setModels([])); }, [tab, models]);
  if (!lib) return null;
  const importModel = (m: Puzzle) => {
    const p = fromModel(m, lib.universeId);
    lib.savePuzzle(p);
    onPick(p.id);
    onPrep(p.id);
  };
  return (
    <div className="pz-modal" role="dialog" aria-label={`Verrouiller : ${targetLabel}`}>
      <div className="pz-modal-box">
        <header className="pz-modal-head">
          <b>🔒 {targetLabel} : quelle énigme ?</b>
          <button type="button" className="pz-btn ghost" onClick={onClose}>Fermer</button>
        </header>
        <div className="pz-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'grimoire'} className={tab === 'grimoire' ? 'on' : ''} onClick={() => setTab('grimoire')}>Mes énigmes ({lib.puzzles.length})</button>
          <button type="button" role="tab" aria-selected={tab === 'catalogue'} className={tab === 'catalogue' ? 'on' : ''} onClick={() => setTab('catalogue')}>Modèles (12)</button>
        </div>
        {tab === 'grimoire' ? (
          lib.puzzles.length === 0 ? <p className="pz-note">Aucune énigme dans cet univers : importe un modèle pour commencer.</p> : (
            <ul className="pz-list">
              {lib.puzzles.map((p) => (
                <li key={p.id} className={current === p.id ? 'on' : ''}>
                  <div>
                    <b>{p.title}</b> <small className={`pz-status ${p.status ?? 'brouillon'}`}>{p.status === 'prete' ? 'prête' : 'brouillon'}</small>
                    <p className="pz-note">{MECHANIC_LABEL[p.mechanic]}{p.player.location ? ` · ${p.player.location}` : ''}</p>
                  </div>
                  <div className="pz-row pz-small">
                    <button type="button" className="pz-chip" onClick={() => onPrep(p.id)}>Préparer</button>
                    <button type="button" className="pz-chip on" disabled={current === p.id} onClick={() => { onPick(p.id); onClose(); }}>{current === p.id ? 'Choisie' : 'Choisir'}</button>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : !models ? <p className="pz-note">Chargement du catalogue…</p> : (
          <ul className="pz-list">
            {models.map((m) => (
              <li key={m.id}>
                <div>
                  <b>{m.title}</b> <small className="pz-note">· {MECHANIC_LABEL[m.mechanic]} · {m.difficulty} · ~{m.estimatedMinutes} min</small>
                  <p className="pz-note">{m.player.objective}</p>
                </div>
                <button type="button" className="pz-chip on" onClick={() => importModel(m)}>Importer et préparer</button>
              </li>
            ))}
          </ul>
        )}
        {current && <button type="button" className="pz-btn ghost" onClick={() => { onPick(null); onClose(); }}>Retirer le verrou</button>}
        <p className="pz-note">Modèles hors canon : à adapter à ton univers. Ils restent en brouillon tant que tu ne les as pas vérifiés.</p>
      </div>
    </div>
  );
}
