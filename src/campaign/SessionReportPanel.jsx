import { useState } from 'react';
import {
  ENTITY_KINDS,
  reportPrompt,
  parseReport,
  markDuplicates,
  buildEntry,
  buildReport,
  markPlayed,
} from './sessionReport';

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Compte rendu de séance : le MJ colle ses notes, l'IA propose les éléments d'univers nouveaux,
 * le MJ coche ce qu'il garde. Rien n'est créé sans validation.
 */
export default function SessionReportPanel({ universe, campaign, library, ask, aiReady, dispatch, flash }) {
  const sessions = campaign.sessions || [];
  const [sessionId, setSessionId] = useState(sessions[0]?.id || '');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null); // { summary, consequences, entities[] }
  const [picked, setPicked] = useState({});
  const session = sessions.find((s) => s.id === sessionId) || null;
  const reports = campaign.sessionReports || [];

  async function analyze() {
    if (!notes.trim()) return flash('Colle d’abord les notes de la séance.');
    setBusy(true);
    try {
      const { system, prompt } = reportPrompt({
        universe,
        campaign,
        session,
        notes,
        knownTitles: library.map((e) => e.title),
      });
      const parsed = parseReport(await ask({ system, prompt }));
      const entities = markDuplicates(parsed.entities, library);
      setDraft({ ...parsed, entities });
      setPicked(Object.fromEntries(entities.map((e, i) => [i, !e.duplicateOf])));
    } catch (e) {
      flash(e.message || 'Analyse impossible.');
    }
    setBusy(false);
  }

  function save(withEntities) {
    const reportId = uid();
    const now = Date.now();
    const chosen = withEntities ? draft.entities.filter((_, i) => picked[i]) : [];
    const entries = chosen.map((e) =>
      buildEntry(e, { campaignId: campaign.id, sessionId: session?.id, reportId, id: uid(), now }),
    );
    for (const entry of entries) dispatch({ type: 'ADD_LIBRARY_ENTRY', entry });
    const report = buildReport({
      id: reportId,
      now,
      session,
      notes,
      summary: draft?.summary || '',
      consequences: draft?.consequences || [],
      entryIds: entries.map((e) => e.id),
    });
    const patch = { sessionReports: [report, ...reports].slice(0, 100) };
    if (session) patch.sessions = markPlayed(sessions, session.id, true, now);
    dispatch({ type: 'UPDATE_CAMPAIGN', id: campaign.id, patch });
    setDraft(null);
    setNotes('');
    flash(entries.length ? `Compte rendu enregistré, ${entries.length} fiche(s) ajoutée(s) à la bibliothèque.` : 'Compte rendu enregistré.');
  }

  const nPicked = draft ? Object.values(picked).filter(Boolean).length : 0;

  return (
    <div className="panel" style={{ marginTop: 14 }}>
      <div className="eyebrow">Compte rendu de séance</div>
      <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 0 }}>
        Colle tes notes de la séance jouée. L’app repère les personnages, lieux, peuples et objets nouveaux et te les propose
        sous forme de fiches : tu coches ce que tu gardes, rien n’est créé sans ton accord.
      </p>

      {sessions.length > 0 && (
        <label style={{ display: 'block', marginBottom: 10 }}>
          <span className="muted" style={{ fontSize: 12.5 }}>Séance jouée</span>
          <select className="in" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                Séance {s.sessionNumber} · {s.title}
                {s.played ? ' ✓ jouée' : ''}
              </option>
            ))}
            <option value="">Hors séance planifiée</option>
          </select>
        </label>
      )}

      {session && (
        <p className="muted" style={{ fontSize: 12.5, margin: '0 0 10px' }}>
          {session.played ? '✓ Séance marquée comme jouée. ' : 'Elle sera marquée comme jouée à l’enregistrement. '}
          <button
            type="button"
            className="linkbtn"
            onClick={() =>
              dispatch({ type: 'UPDATE_CAMPAIGN', id: campaign.id, patch: { sessions: markPlayed(sessions, session.id, !session.played, Date.now()) } })
            }
          >
            {session.played ? 'Remettre à « non jouée »' : 'La marquer jouée maintenant'}
          </button>
        </p>
      )}

      {!draft && (
        <>
          <textarea
            className="in"
            rows={6}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex. Le groupe a traversé la forêt de Brume et atteint Vallombre, où les Elfes-Lanternes leur ont proposé un marché. Le capitaine Orsk a été humilié devant sa troupe…"
          />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary" style={{ flex: 'none' }} disabled={busy || !aiReady} onClick={analyze}>
              {busy ? 'Analyse…' : 'Analyser la séance'}
            </button>
            <button
              className="btn"
              style={{ flex: 'none' }}
              disabled={busy || !notes.trim()}
              onClick={() => {
                setDraft({ summary: '', consequences: [], entities: [] });
                setPicked({});
              }}
            >
              Enregistrer sans analyse
            </button>
          </div>
          {!aiReady && <p className="muted" style={{ fontSize: 12.5 }}>L’analyse demande l’IA : configure-la dans Réglages.</p>}
        </>
      )}

      {draft && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label>
            <span className="muted" style={{ fontSize: 12.5 }}>Compte rendu (modifiable)</span>
            <textarea className="in" rows={4} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} placeholder="Résumé de la séance" />
          </label>
          {draft.consequences.length > 0 && (
            <div>
              <b style={{ fontSize: 13.5 }}>Conséquences dans le monde</b>
              <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                {draft.consequences.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {draft.entities.length > 0 ? (
            <div>
              <b style={{ fontSize: 13.5 }}>Fiches proposées ({nPicked} retenue(s))</b>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                {draft.entities.map((e, i) => (
                  <label key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 8, border: '1px solid var(--line)', borderRadius: 6 }}>
                    <input type="checkbox" checked={!!picked[i]} onChange={(ev) => setPicked({ ...picked, [i]: ev.target.checked })} style={{ marginTop: 4 }} />
                    <span>
                      <b>{e.name}</b> <span className="tag">{ENTITY_KINDS[e.kind]}</span>
                      {e.duplicateOf && (
                        <span className="muted" style={{ fontSize: 12.5 }}> · existe déjà (« {e.duplicateTitle} »), décochée par défaut</span>
                      )}
                      <br />
                      <span className="muted" style={{ fontSize: 13.5 }}>{e.summary}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>Aucune fiche proposée : le compte rendu sera simplement enregistré.</p>
          )}
          <div className="row">
            <button className="btn primary" style={{ flex: 'none' }} onClick={() => save(true)}>
              {nPicked ? `Ajouter ${nPicked} fiche(s) et enregistrer` : 'Enregistrer le compte rendu'}
            </button>
            <button className="btn ghost" style={{ flex: 'none' }} onClick={() => setDraft(null)}>
              Retour aux notes
            </button>
          </div>
        </div>
      )}

      {reports.length > 0 && (
        <details style={{ marginTop: 14 }}>
          <summary>Comptes rendus précédents ({reports.length})</summary>
          {reports.slice(0, 8).map((r) => (
            <div key={r.id} style={{ marginTop: 8 }}>
              <b>{r.sessionNumber ? `Séance ${r.sessionNumber} · ${r.sessionTitle}` : 'Hors séance planifiée'}</b>{' '}
              <span className="muted" style={{ fontSize: 12.5 }}>
                {new Date(r.createdAt).toLocaleDateString('fr-CA')} · {r.entryIds.length} fiche(s)
              </span>
              <div className="muted" style={{ fontSize: 13.5 }}>{r.summary || r.notes}</div>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
