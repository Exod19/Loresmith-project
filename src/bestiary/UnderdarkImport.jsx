/**
 * Import du bestiaire Underdark (683 fiches) dans PNJ & Créatures, sans rien écraser :
 * 1. analyse (fiches à ajouter, déjà présentes, à revoir) ; 2. sauvegarde téléchargée ; 3. ajout des IDs absents.
 * Les fiches déjà présentes ou modifiées localement ne sont jamais touchées : elles sont listées pour revue.
 */
import { useState } from 'react';
import { entityFromUnderdark, planUnderdarkImport, checkUnderdarkMaster } from './underdark.js';

const loadMaster = () => import('../data/underdark/bestiaire-683.json').then((m) => m.default ?? m);

/** Télécharge une copie des fiches actuelles de l'univers (à garder avant tout import). */
function downloadBackup(npcs, universe) {
  const blob = new Blob([JSON.stringify({ kind: 'loresmith-npcs-backup', universe: universe?.name, at: new Date().toISOString(), npcs }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sauvegarde-pnj-creatures-${(universe?.name || 'univers').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export default function UnderdarkImport({ npcs, universe, onImport, normalize }) {
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState('');

  async function analyse() {
    setBusy(true); setErr('');
    try {
      const master = await loadMaster();
      const check = checkUnderdarkMaster(master);
      setPlan({ ...planUnderdarkImport(master, npcs), check });
    } catch (e) {
      setErr(`Bestiaire illisible : ${e.message}`);
    }
    setBusy(false);
  }

  function run() {
    if (!plan) return;
    downloadBackup(npcs, universe);
    const list = plan.add.map((c) => normalize(entityFromUnderdark(c)));
    onImport(list);
    setDone({ added: list.length, present: plan.present.length, review: plan.review.length });
    setPlan(null);
  }

  return (
    <div className="ud-import">
      <div className="ud-import-head">
        <b>📚 Bestiaire Underdark</b>
        <span className="faint">683 fiches maison (adaptations LoreSmith, non officielles), taguées « Underdark ».</span>
      </div>
      {!plan && !done && <button className="btn" disabled={busy} onClick={analyse}>{busy ? 'Analyse…' : 'Analyser avant import'}</button>}
      {err && <div style={{ color: 'var(--blood)', fontSize: 13 }}>{err}</div>}
      {plan && (
        <div className="ud-import-plan">
          <p>
            <b>{plan.add.length}</b> fiche{plan.add.length > 1 ? 's' : ''} à ajouter · <b>{plan.present.length}</b> déjà présente{plan.present.length > 1 ? 's' : ''} (laissées telles quelles)
            {plan.review.length > 0 && <> · <b>{plan.review.length}</b> à revoir (jamais modifiée{plan.review.length > 1 ? 's' : ''} automatiquement)</>}
          </p>
          {!plan.check.ok && <p style={{ color: 'var(--blood)' }}>Contrôle du bestiaire : {plan.check.errors.length} anomalie(s) — {plan.check.errors.slice(0, 3).join(' ; ')}</p>}
          {plan.review.length > 0 && (
            <details>
              <summary>Fiches à revoir</summary>
              <ul className="ud-review">
                {plan.review.slice(0, 60).map((r) => <li key={r.id}><code>{r.id}</code> {r.name} — {r.reason}{r.fields.length ? ` (${r.fields.join(', ')})` : ''}</li>)}
              </ul>
            </details>
          )}
          <div className="ud-import-btns">
            <button className="btn primary" disabled={!plan.add.length} onClick={run}>Sauvegarder puis importer {plan.add.length} fiche{plan.add.length > 1 ? 's' : ''}</button>
            <button className="btn ghost" onClick={() => setPlan(null)}>Annuler</button>
          </div>
          <p className="faint" style={{ fontSize: 12 }}>Une sauvegarde de tes fiches actuelles est téléchargée juste avant l’import.</p>
        </div>
      )}
      {done && (
        <p className="ud-done">
          ✓ {done.added} fiche{done.added > 1 ? 's' : ''} ajoutée{done.added > 1 ? 's' : ''}{done.present ? `, ${done.present} déjà présente${done.present > 1 ? 's' : ''}` : ''}{done.review ? `, ${done.review} à revoir` : ''}.
          <button className="btn ghost sm" onClick={() => setDone(null)}>OK</button>
        </p>
      )}
    </div>
  );
}
