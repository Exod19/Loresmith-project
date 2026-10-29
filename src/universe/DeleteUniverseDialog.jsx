import { useState } from 'react';
import { exportArchive } from '../store/backup';
import { universeContents } from './deleteUniverse';

const LABELS = {
  campaigns: 'campagne(s)',
  npcs: 'PNJ / créature(s)',
  libraryEntries: 'fiche(s) de bibliothèque',
  quests: 'quête(s)',
  characters: 'personnage(s) joueur',
  maps: 'carte(s)',
  assets: 'image(s) rattachée(s)',
  chatThreads: 'conversation(s) IA',
  log: 'entrée(s) de journal',
};

/** Confirmation forte avant de supprimer un univers : bilan, sauvegarde proposée, nom à retaper. */
export default function DeleteUniverseDialog({ state, universe, onConfirm, onClose, flash }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const contents = universeContents(state, universe.id);
  const match = typed.trim() === universe.name.trim();

  async function backup() {
    setBusy(true);
    try {
      await exportArchive(state, { kind: 'universe', id: universe.id }, universe.name);
      setSaved(true);
    } catch (e) {
      flash('Sauvegarde impossible : ' + e.message);
    }
    setBusy(false);
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="card-h">
          <h3>Supprimer « {universe.name} » ?</h3>
          <button className="btn ghost sm" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, lineHeight: 1.55 }}>
            Cette action est <b>définitive</b>. Elle supprime l’univers et tout ce qu’il contient
            {Object.keys(contents).length === 0 ? ' (il est vide).' : ' :'}
          </p>
          {Object.keys(contents).length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {Object.entries(contents).map(([k, n]) => (
                <li key={k}>
                  {n} {LABELS[k] || k}
                </li>
              ))}
            </ul>
          )}
          <div>
            <button className="btn" disabled={busy} onClick={backup}>
              {busy ? 'Sauvegarde…' : saved ? '✓ Sauvegarde téléchargée' : 'Télécharger une sauvegarde de cet univers (.zip)'}
            </button>
            <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
              Recommandé : cette sauvegarde permet de le restaurer par un import.
            </p>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>
              Pour confirmer, retape le nom de l’univers : <b>{universe.name}</b>
            </span>
            <input className="in" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </label>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn ghost" onClick={onClose}>
              Annuler
            </button>
            <button className="btn danger" disabled={!match || busy} onClick={onConfirm}>
              Supprimer définitivement
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
