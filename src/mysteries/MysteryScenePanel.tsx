/**
 * Table de jeu (console MJ) : les indices des mystères posés dans la scène en cours. Un indice critique pas encore
 * trouvé pulse en améthyste — ici seulement : rien de tout cela ne part vers l'écran joueur. En un clic : montré,
 * découvert, pris (il entre dans le carnet du groupe), passé à côté, ou reporté vers une scène à venir (trois
 * propositions motivées, jamais de déplacement d'un indice déjà vu). Les verrous à venir signalent leur risque.
 */
import { useMemo, useState } from 'react';
import { usePuzzles } from '../puzzles/context';
import type { Clue, ClueKind } from '../puzzles/types';
import { approveDefer, coverageOf, markState, newId, requestDefer, sceneOrder, type DeferPreview } from './planner';
import { MEDIUM_LABEL, READINESS_LABEL, STATE_LABEL, type ClueManifestation, type Medium, type MysteryArc, type SceneRef } from './types';
import './mysteries.css';

const KIND: Partial<Record<Medium, ClueKind>> = { journal: 'journal', inscription: 'symbole', fresque: 'symbole', schema: 'croquis', objet: 'objet' };
const PULSE_KEY = 'loresmith:mysteres-pulse';
/** Au plus trois halos à la fois (kit v3), pour ne pas noyer l'attention. */
const MAX_PULSES = 3;

export default function MysteryScenePanel({ campaignId, sceneId, scenes }: { campaignId?: string; sceneId?: string; scenes: SceneRef[] }) {
  const lib = usePuzzles();
  const [pulse, setPulse] = useState(() => { try { return localStorage.getItem(PULSE_KEY) !== '0'; } catch { return true; } });
  const [defer, setDefer] = useState<{ arcId: string; preview: DeferPreview } | null>(null);
  const [reason, setReason] = useState('');
  const arcs = useMemo(() => (lib?.mysteries ?? []).filter((a) => a.campaignId === campaignId && a.status !== 'abandoned'), [lib?.mysteries, campaignId]);
  if (!lib || !campaignId || !sceneId || !arcs.length) return null;
  const order = sceneOrder(scenes);
  const here = order.get(sceneId) ?? -1;

  // Indices de la scène, et ce qu'ils enseignent.
  const rows = arcs.flatMap((arc) => arc.manifestations.filter((m) => {
    const slot = arc.sceneSlots.find((s) => s.id === m.slotId);
    return slot?.sceneId === sceneId && !slot.isReserve && m.state !== 'withdrawn';
  }).map((m) => {
    const design = arc.clueDesigns.find((d) => d.id === m.clueDesignId)!;
    const slot = arc.sceneSlots.find((s) => s.id === m.slotId)!;
    const atoms = arc.knowledgeAtoms.filter((a) => design?.knowledgeAtomIds.includes(a.id));
    const gates = arc.gates.filter((g) => atoms.some((a) => g.requiredAtomIds.includes(a.id)));
    const rank = atoms.some((a) => a.criticality === 'critical') ? 'critical' : atoms.some((a) => a.criticality === 'supporting') ? 'supporting' : 'enrichment';
    return { arc, m, design, slot, atoms, gates, rank };
  })).filter((r) => r.design);
  let pulses = 0;
  // Verrous à venir dont la couverture n'est pas sûre : alertes de pré-séance.
  const alerts = arcs.flatMap((arc) => arc.gates.filter((g) => (order.get(g.targetSceneId) ?? -1) >= here && g.state !== 'solved' && g.state !== 'bypassed')
    .map((g) => ({ arc, g, c: coverageOf(arc, g, scenes) })).filter((x) => x.c.status !== 'READY'));
  if (!rows.length && !alerts.length) return null;

  const save = (a: MysteryArc) => lib.saveMystery({ ...a, updatedAt: Date.now() });
  const mark = (arc: MysteryArc, m: ClueManifestation, state: ClueManifestation['state']) => save(markState(arc, m.id, state, newId('cle')));
  /** Pris : l'indice entre dans le carnet du groupe (ce que lisent les joueurs, rien d'autre). */
  const collect = (arc: MysteryArc, m: ClueManifestation) => {
    const d = arc.clueDesigns.find((x) => x.id === m.clueDesignId)!;
    const clue: Clue = { id: newId('indice'), universeId: lib.universeId, title: d.title, kind: KIND[d.media] ?? 'page', text: d.playerContent, held: true, createdAt: Date.now(),
      gmNote: `Mystère « ${arc.title} »${m.provenance ? ` · ${m.provenance.replace(/\.$/, '')}` : ''}.`, puzzleId: arc.gates.find((g) => g.requiredAtomIds.some((a) => d.knowledgeAtomIds.includes(a)))?.puzzleId };
    lib.saveClue(clue);
    save(markState(arc, m.id, 'collected', newId('cle'), { clueId: clue.id }));
  };
  const askDefer = (arc: MysteryArc, m: ClueManifestation) => { const p = requestDefer(arc, m.id, scenes, sceneId); if (p) { setReason(''); setDefer({ arcId: arc.id, preview: p }); } };
  const togglePulse = () => { const v = !pulse; setPulse(v); try { localStorage.setItem(PULSE_KEY, v ? '1' : '0'); } catch { /* préférence non retenue */ } };

  return (
    <section className="ms-scene" aria-label="Indices de la scène (MJ)">
      <div className="pz-row" style={{ justifyContent: 'space-between' }}>
        <h3>🕸 Fil des mystères · cette scène</h3>
        <label className="pz-check"><input type="checkbox" checked={pulse} onChange={togglePulse} /> halo animé</label>
      </div>
      {rows.map(({ arc, m, design, slot, atoms, gates, rank }) => {
        const pending = m.state === 'slotted' || m.state === 'presented';
        const glow = pulse && rank === 'critical' && pending && pulses++ < MAX_PULSES;
        const deadline = gates.map((g) => scenes.find((s) => s.id === g.targetSceneId)?.title).filter(Boolean).join(', ');
        const open = defer?.preview.manifestation.id === m.id && defer.preview;
        return (
          <article key={m.id} className={`ms-clue c-${rank} ${glow ? 'pulse' : ''}`}>
            <div><b>{design.title}</b> <small className="pz-note">· {slot.label} · {MEDIUM_LABEL[design.media]} · {STATE_LABEL[m.state]}</small></div>
            <p className="ms-why">
              {gates.length ? `Relié à : ${gates.map((g) => g.title).join(', ')}` : 'Aucun verrou'}{deadline ? ` · nécessaire avant : ${deadline}` : ''} · enseigne : {atoms.map((a) => a.statement).join(' ; ') || '—'}
            </p>
            {m.provenance && <p className="pz-note">Provenance : {m.provenance}</p>}
            <p className="pz-note">Ce que voient les joueurs : « {design.playerContent} »</p>
            {pending ? (
              <div className="pz-row pz-small">
                {m.state === 'slotted' && <button type="button" className="pz-chip" onClick={() => mark(arc, m, 'presented')} title="Il est sous leurs yeux (ils peuvent passer à côté)">Montré</button>}
                <button type="button" className="pz-chip" onClick={() => mark(arc, m, 'noticed')} title="Ils l’ont remarqué ou lu">Découvert</button>
                <button type="button" className="pz-chip on" onClick={() => collect(arc, m)} title="Ils le prennent : il entre dans le carnet du groupe">Pris → carnet</button>
                <button type="button" className="pz-chip" onClick={() => mark(arc, m, 'missed')}>Passé à côté</button>
                <button type="button" className="pz-chip" onClick={() => askDefer(arc, m)}>Reporter plus tard</button>
              </div>
            ) : m.state === 'missed' ? (
              <div className="pz-row pz-small"><button type="button" className="pz-chip on" onClick={() => askDefer(arc, m)}>Reporter l’information</button></div>
            ) : null}
            {open && (
              <div className="ms-defer">
                {open.kind === 'review' ? (
                  <>
                    <b>Aucun emplacement sûr avant l’échéance.</b>
                    <p className="pz-note">Fait à préserver : {open.facts.join(' ; ')}</p>
                    <ul className="pz-proof">{open.options.map((o, i) => <li key={i}>{o}</li>)}</ul>
                    <button type="button" className="pz-chip" onClick={() => setDefer(null)}>Fermer</button>
                  </>
                ) : (
                  <>
                    <b>{open.strategy === 'MOVE_UNEXPOSED' ? 'Déplacer cet indice (jamais vu)' : 'Ajouter une seconde source (celui-ci reste où il est)'}</b>
                    <p className="pz-note">Fait à préserver : {open.facts.join(' ; ')} · {open.risk}</p>
                    <input className="input" value={reason} placeholder="Justification dans la fiction (optionnel) : le capitaine a travaillé pour le réparateur…" onChange={(e) => setReason(e.target.value)} />
                    <ol>
                      {open.candidates.map((c) => (
                        <li key={c.slot.id}>
                          {c.justification} <small className="pz-note">({c.reasons.join(', ')})</small>{' '}
                          <button type="button" className="pz-chip on" onClick={() => { save(approveDefer(arc, open, c, `report:${m.id}:${c.slot.id}`, reason)); setDefer(null); }}>Confirmer</button>
                          {open.strategy === 'MOVE_UNEXPOSED' && <button type="button" className="pz-chip" title="La nouvelle manifestation est une copie crédible : on garde aussi celle-ci" onClick={() => { save(approveDefer(arc, open, c, `report:${m.id}:${c.slot.id}`, reason, true)); setDefer(null); }}>Garder ici aussi</button>}
                        </li>
                      ))}
                    </ol>
                    <button type="button" className="pz-chip" onClick={() => setDefer(null)}>Annuler</button>
                  </>
                )}
              </div>
            )}
          </article>
        );
      })}
      {alerts.length > 0 && (
        <>
          <h3>Verrous à venir</h3>
          {alerts.map(({ arc, g, c }) => (
            <p key={g.id} className="pz-note"><span className={`ms-ready r-${c.status}`}>{READINESS_LABEL[c.status]}</span> 🔒 {g.title} ({arc.title}) — {c.why}</p>
          ))}
        </>
      )}
    </section>
  );
}

