import { useState } from 'react';
import {
  ENTITY_KINDS,
  reportPrompt,
  parseReport,
  knownLines,
  buildReport,
  markPlayed,
  buildMemory,
  nextSessionPrompt,
  parseIdeas,
} from './sessionReport';
import { matchEntities, planChanges } from './canonLink';

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
  const [draft, setDraft] = useState(null); // { summary, consequences, futureSeeds, entities[] }
  const [ideas, setIdeas] = useState(null);
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
        known: knownLines(library, notes),
      });
      const parsed = parseReport(await ask({ system, prompt }));
      setDraft({ ...parsed, entities: matchEntities(parsed.entities, library) });
    } catch (e) {
      flash(e.message || 'Analyse impossible.');
    }
    setBusy(false);
  }

  const setDecision = (i, decision) =>
    setDraft((d) => ({ ...d, entities: d.entities.map((e, j) => (j === i ? { ...e, decision } : e)) }));

  function save() {
    const reportId = uid();
    const now = Date.now();
    const plan = planChanges({
      entities: draft.entities,
      existing: library,
      ctx: { campaignId: campaign.id, sessionId: session?.id, sessionNumber: session?.sessionNumber, reportId, now },
      newId: uid,
    });
    for (const entry of plan.newEntries) dispatch({ type: 'ADD_LIBRARY_ENTRY', entry });
    for (const [id, patch] of Object.entries(plan.patches)) dispatch({ type: 'UPDATE_LIBRARY_ENTRY', id, patch });
    const report = buildReport({
      id: reportId,
      now,
      session,
      notes,
      summary: draft.summary,
      consequences: draft.consequences,
      futureSeeds: draft.futureSeeds,
      entryIds: plan.newEntries.map((e) => e.id),
      mergedIds: plan.mergedIds,
      conflicts: plan.conflicts,
    });
    // L'impact de la séance entre dans la mémoire vivante de la campagne et de l'univers.
    const memory = (id) => buildMemory(report, { id, campaignId: campaign.id });
    const hasImpact = report.summary || report.consequences.length;
    const patch = { sessionReports: [report, ...reports].slice(0, 100) };
    if (hasImpact) patch.memoryLog = [memory(uid()), ...(campaign.memoryLog || [])].slice(0, 60);
    if (session) patch.sessions = markPlayed(sessions, session.id, true, now);
    dispatch({ type: 'UPDATE_CAMPAIGN', id: campaign.id, patch });
    if (hasImpact) {
      dispatch({ type: 'UPDATE_UNIVERSE', id: universe.id, patch: { memoryLog: [memory(uid()), ...(universe.memoryLog || [])].slice(0, 80) } });
    }
    setIdeas(null);
    setDraft(null);
    setNotes('');
    const parts = [
      plan.newEntries.length && `${plan.newEntries.length} fiche(s) créée(s)`,
      plan.mergedIds.length && `${plan.mergedIds.length} fiche(s) enrichie(s)`,
      plan.edges.length && `${plan.edges.length} lien(s) tissé(s)`,
      hasImpact && 'mémoire de l’univers mise à jour',
    ].filter(Boolean);
    flash(parts.length ? `Compte rendu enregistré : ${parts.join(', ')}.` : 'Compte rendu enregistré.');
  }

  const count = (d) => (draft ? draft.entities.filter((e) => (e.decision || 'new').startsWith(d)).length : 0);
  const nNew = count('new');
  const nMerge = count('merge');

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
          {draft.futureSeeds?.length > 0 && (
            <div>
              <b style={{ fontSize: 13.5 }}>Pistes ouvertes pour la suite</b>
              <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                {draft.futureSeeds.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {draft.entities.length > 0 ? (
            <div>
              <b style={{ fontSize: 13.5 }}>
                Rattachement au canon : {nNew} nouvelle(s) fiche(s), {nMerge} fusion(s)
              </b>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                {draft.entities.map((e, i) => (
                  <div key={i} style={{ padding: 8, border: '1px solid var(--line)', borderRadius: 6, opacity: e.decision === 'skip' ? 0.55 : 1 }}>
                    <div>
                      <b>{e.name}</b> <span className="tag">{ENTITY_KINDS[e.kind]}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 13.5 }}>{e.summary}</div>
                    {e.relations.length > 0 && (
                      <div style={{ fontSize: 12.5, marginTop: 4 }}>
                        {e.relations.map((r, j) => (
                          <span className="tag" key={j} style={{ marginRight: 6 }}>
                            {r.label || 'lié à'} → {r.target}
                          </span>
                        ))}
                      </div>
                    )}
                    {e.conflict && (
                      <div style={{ color: 'var(--blood)', fontSize: 13, marginTop: 4 }}>⚠ Possible contradiction : {e.conflict}</div>
                    )}
                    <select className="in" style={{ marginTop: 6 }} value={e.decision || 'new'} onChange={(ev) => setDecision(i, ev.target.value)}>
                      <option value="new">Créer une nouvelle fiche</option>
                      {e.candidates.map((c) => (
                        <option key={c.id} value={`merge:${c.id}`}>
                          Ajouter à la fiche existante « {c.title} »{c.score >= 0.9 ? ' (même élément)' : ' (nom proche)'}
                        </option>
                      ))}
                      <option value="skip">Ignorer</option>
                    </select>
                  </div>
                ))}
              </div>
              <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
                Une fusion ajoute la séance aux notes de la fiche existante, sans rien remplacer. Les liens apparaissent dans « Dans la Toile ».
              </p>
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>Aucun élément proposé : le compte rendu sera simplement enregistré.</p>
          )}
          <div className="row">
            <button className="btn primary" style={{ flex: 'none' }} onClick={save}>
              Enregistrer le compte rendu
            </button>
            <button className="btn ghost" style={{ flex: 'none' }} onClick={() => setDraft(null)}>
              Retour aux notes
            </button>
          </div>
        </div>
      )}

      {reports.length > 0 && aiReady && (
        <div style={{ marginTop: 14 }}>
          <button
            className="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const next = sessions.find((x) => !x.played) || null;
                const { system, prompt } = nextSessionPrompt({ universe, campaign, reports, next, known: knownLines(library, '') });
                setIdeas(parseIdeas(await ask({ system, prompt })));
              } catch (e) {
                flash(e.message || 'Suggestion impossible.');
              }
              setBusy(false);
            }}
          >
            {busy ? 'Réflexion…' : 'Idées pour la prochaine séance, selon ce qui s’est joué'}
          </button>
          {ideas && ideas.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Aucune idée exploitable cette fois.</p>}
          {ideas?.map((i, k) => (
            <div key={k} style={{ marginTop: 8, padding: 8, border: '1px solid var(--line)', borderRadius: 6 }}>
              <b>{i.title}</b>
              <div className="muted" style={{ fontSize: 13.5 }}>{i.pitch}</div>
              {i.uses.length > 0 && <div style={{ fontSize: 12.5, marginTop: 4 }}>Réutilise : {i.uses.join(', ')}</div>}
            </div>
          ))}
        </div>
      )}

      {reports.length > 0 && (
        <details style={{ marginTop: 14 }}>
          <summary>Comptes rendus précédents ({reports.length})</summary>
          {reports.slice(0, 8).map((r) => (
            <div key={r.id} style={{ marginTop: 8 }}>
              <b>{r.sessionNumber ? `Séance ${r.sessionNumber} · ${r.sessionTitle}` : 'Hors séance planifiée'}</b>{' '}
              <span className="muted" style={{ fontSize: 12.5 }}>
                {new Date(r.createdAt).toLocaleDateString('fr-CA')} · {r.entryIds.length} nouvelle(s) · {(r.mergedIds || []).length} enrichie(s)
              </span>
              <div className="muted" style={{ fontSize: 13.5 }}>{r.summary || r.notes}</div>
              {(r.conflicts || []).map((c, j) => (
                <div key={j} style={{ color: 'var(--blood)', fontSize: 12.5 }}>⚠ {c.name} : {c.issue}</div>
              ))}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
