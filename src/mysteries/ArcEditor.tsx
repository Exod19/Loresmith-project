/**
 * Éditeur d'un mystère (Fil des Mystères, kit v3) : intention, verrous, faits, supports d'indices, distribution dans
 * les scènes de la campagne, validation. Tout est enregistré à chaque modification ; la couverture des verrous
 * (prêt, à risque, bloqué) se recalcule en direct. Le planificateur propose, le MJ décide.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { aiReady, askAI, parseJson } from '../ai/client';
import { usePuzzles } from '../puzzles/context';
import { secretTokens } from '../puzzles/quality';
import { coverageOf, isActive, newId, place, proposalsFor, validateArc, type Readiness } from './planner';
import { CRITICALITY, MEDIA, MEDIUM_LABEL, READINESS_LABEL, STATE_LABEL, type ClueDesign, type Gate, type KnowledgeAtom, type Medium, type MysteryArc, type SceneRef, type SceneSlot } from './types';
import './mysteries.css';

/** Ce que l'IA rend pour enrichir un mystère (tout est facultatif, et relu par le MJ). */
type AiArc = {
  atoms?: { statement?: unknown; criticality?: string; discoverableBy?: string[] }[];
  designs?: { title?: unknown; media?: string; atoms?: number[]; playerContent?: unknown; gmIntent?: unknown; unique?: unknown }[];
};

export type CampaignLike = { id: string; title?: string; name?: string; scenes?: { id: string; title?: string; played?: boolean }[] };

export { READINESS_LABEL };
const STEPS = ['Intention', 'Verrous', 'Faits', 'Supports', 'Distribution', 'Validation'] as const;
const DISCOVER: { id: KnowledgeAtom['discoverableBy'][number]; label: string }[] = [
  { id: 'manifestation', label: 'par un indice semé' }, { id: 'local_observation', label: 'en observant le verrou' },
  { id: 'experiment', label: 'en expérimentant sur place' }, { id: 'dialogue', label: 'en parlant à quelqu’un' },
];

export default function ArcEditor({ arc, campaigns, onClose }: { arc: MysteryArc; campaigns: CampaignLike[]; onClose: () => void }) {
  const lib = usePuzzles();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const current = lib?.mysteries.find((m) => m.id === arc.id) ?? arc;
  const camp = campaigns.find((c) => c.id === current.campaignId);
  const scenes: SceneRef[] = useMemo(() => (camp?.scenes ?? []).map((s) => ({ id: s.id, title: s.title, played: !!s.played })), [camp]);
  const issues = useMemo(() => validateArc(current, scenes), [current, scenes]);
  const coverage = useMemo(() => current.gates.map((g) => ({ g, c: coverageOf(current, g, scenes) })), [current, scenes]);
  if (!lib) return null;

  const save = (next: MysteryArc) => lib.saveMystery({ ...next, updatedAt: Date.now() });
  const set = (patch: Partial<MysteryArc>) => save({ ...current, ...patch });
  const edit = <K extends 'knowledgeAtoms' | 'clueDesigns' | 'sceneSlots' | 'gates'>(key: K, id: string, patch: Partial<MysteryArc[K][number]>) =>
    set({ [key]: (current[key] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) } as Partial<MysteryArc>);
  const remove = (key: 'knowledgeAtoms' | 'clueDesigns' | 'sceneSlots' | 'gates', id: string) => {
    if (!confirm('Retirer cet élément ?')) return;
    const next: MysteryArc = { ...current, [key]: (current[key] as { id: string }[]).filter((x) => x.id !== id) };
    // Un support ou un emplacement retiré emporte ses placements jamais montrés (ce qui a été vu reste dans l'historique).
    if (key === 'clueDesigns' || key === 'sceneSlots') next.manifestations = next.manifestations.filter((m) => (key === 'clueDesigns' ? m.clueDesignId : m.slotId) !== id || m.state !== 'slotted');
    save(next);
  };
  const field = (label: string, input: ReactNode, hint?: string) => <label className="pz-field">{label}{input}{hint && <small className="pz-note">{hint}</small>}</label>;
  const sceneTitle = (id: string) => scenes.find((s) => s.id === id)?.title ?? 'scène inconnue';
  const puzzleOf = (id?: string) => lib.puzzles.find((p) => p.id === id);

  /** L'IA propose des faits et des supports variés à partir des énigmes liées (toujours à relire). */
  const proposeWithAI = async () => {
    setBusy(true); setAiError(null);
    try {
      const gates = current.gates.map((g) => { const p = puzzleOf(g.puzzleId); return `- ${g.title}${p ? ` (énigme « ${p.title} » : ${(p.design?.laws ?? []).join(' ')} ; démonstration : ${(p.gm.deductionPath ?? []).join(' / ')})` : ''}`; }).join('\n');
      const system = 'Tu conçois des mystères à la Myst pour un jeu de rôle dark fantasy, en français. Un fait (KnowledgeAtom) est une règle stable du monde ; un support d’indice l’enseigne sans jamais donner la solution, le code ou le dernier geste. Varie les supports (journal, inscription, fresque, dialogue, expérience, observation du lieu). Chaque objet doit être intéressant en lui-même.';
      const user = `Mystère : ${current.title}. Question : ${current.synopsis || '—'}. Intention : ${current.intention || '—'}.\nVerrous :\n${gates || '—'}\nFaits déjà écrits : ${current.knowledgeAtoms.map((a) => a.statement).join(' | ') || 'aucun'}.\nRends {"atoms":[{"statement","criticality":"critical"|"supporting"|"enrichment","discoverableBy":["manifestation"|"local_observation"|"experiment"|"dialogue"]}],"designs":[{"title","media":"journal"|"inscription"|"fresque"|"schema"|"objet"|"dialogue"|"experience"|"environnement"|"chant"|"vision","atoms":[indices des faits],"playerContent","gmIntent","unique":bool}]}. 2 à 4 faits, 3 à 6 supports, au moins deux supports différents par fait critique.`;
      const out = parseJson<AiArc>(await askAI(system, user, { json: true }));
      if (!out) throw new Error('Réponse illisible de l’IA.');
      const atoms: KnowledgeAtom[] = (out.atoms ?? []).map((a) => ({ id: newId('fait'), statement: String(a.statement ?? ''), criticality: (['critical', 'supporting', 'enrichment', 'optional'].includes(a.criticality ?? '') ? a.criticality : 'supporting') as KnowledgeAtom['criticality'], discoverableBy: (a.discoverableBy ?? ['manifestation']).filter((x) => DISCOVER.some((d) => d.id === x)) as KnowledgeAtom['discoverableBy'] }));
      const designs: ClueDesign[] = (out.designs ?? []).map((d) => ({ id: newId('support'), title: String(d.title ?? 'Indice'), media: (MEDIA.some((m) => m.id === d.media) ? d.media : 'journal') as Medium, knowledgeAtomIds: (d.atoms ?? []).map((i) => atoms[i]?.id).filter((x): x is string => !!x), playerContent: String(d.playerContent ?? ''), gmIntent: String(d.gmIntent ?? ''), unique: !!d.unique }));
      set({ knowledgeAtoms: [...current.knowledgeAtoms, ...atoms], clueDesigns: [...current.clueDesigns, ...designs] });
    } catch (e) { setAiError((e as Error).message); } finally { setBusy(false); }
  };

  /** Valeurs secrètes des énigmes liées : un support qui les contient donnerait la réponse. */
  const secrets = current.gates.flatMap((g) => { const p = puzzleOf(g.puzzleId); return p ? secretTokens(p) : []; });
  const leaks = (text: string) => secrets.filter((t) => t.length >= 2 && text.toLowerCase().includes(t.toLowerCase()));

  const body = (() => {
    switch (STEPS[step]) {
      case 'Intention': return (
        <>
          <p className="pz-lead">Quelle question le groupe se posera-t-il ? Que protège le mécanisme, qui l’a construit, pour qui la connaissance devait-elle être lisible ?</p>
          {field('Titre', <input className="input" value={current.title} onChange={(e) => set({ title: e.target.value })} />)}
          {field('La question du mystère', <input className="input" value={current.synopsis ?? ''} placeholder="Pourquoi la Porte des Veilleurs s’ouvre-t-elle au reflux ?" onChange={(e) => set({ synopsis: e.target.value })} />)}
          {field('Intention', <textarea className="input" rows={3} value={current.intention ?? ''} onChange={(e) => set({ intention: e.target.value })} />)}
          <div className="pz-grid2">
            {field('Campagne', <select className="input" value={current.campaignId ?? ''} onChange={(e) => set({ campaignId: e.target.value || undefined })}><option value="">— choisir —</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.title ?? c.name}</option>)}</select>, 'Ses scènes, dans l’ordre, servent de chronologie pour semer les indices.')}
            {field('Nature', <select className="input" value={current.pathKind ?? 'critical_path'} onChange={(e) => set({ pathKind: e.target.value as MysteryArc['pathKind'] })}><option value="critical_path">Chemin principal</option><option value="optional_path">Voie facultative</option><option value="world_secret">Secret du monde</option></select>)}
          </div>
        </>
      );
      case 'Verrous': return (
        <>
          <p className="pz-lead">Le verrou est une énigme du grimoire, rencontrée dans une scène : c’est l’échéance avant laquelle les faits doivent être accessibles.</p>
          {!camp && <p className="pz-feedback failure">Choisis d’abord une campagne (étape 1).</p>}
          {current.gates.map((g) => (
            <div key={g.id} className="ms-card">
              <div className="pz-grid2">
                {field('Énigme', <select className="input" value={g.puzzleId ?? ''} onChange={(e) => { const p = puzzleOf(e.target.value); edit('gates', g.id, { puzzleId: e.target.value || undefined, title: p?.title ?? g.title }); }}><option value="">— aucune —</option>{lib.puzzles.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>)}
                {field('Nom du verrou', <input className="input" value={g.title} onChange={(e) => edit('gates', g.id, { title: e.target.value })} />)}
                {field('Première rencontre (scène)', <select className="input" value={g.targetSceneId} onChange={(e) => edit('gates', g.id, { targetSceneId: e.target.value })}><option value="">—</option>{scenes.map((s, i) => <option key={s.id} value={s.id}>{i + 1}. {s.title}</option>)}</select>)}
              </div>
              <label className="pz-check"><input type="checkbox" checked={g.criticalPath} onChange={(e) => edit('gates', g.id, { criticalPath: e.target.checked })} /> Sur le chemin principal (ne doit jamais bloquer la campagne)</label>
              <p className="pz-note">Faits exigés :</p>
              <div className="pz-row" style={{ justifyContent: 'flex-start' }}>
                {current.knowledgeAtoms.length ? current.knowledgeAtoms.map((a) => (
                  <label key={a.id} className="pz-check"><input type="checkbox" checked={g.requiredAtomIds.includes(a.id)} onChange={(e) => edit('gates', g.id, { requiredAtomIds: e.target.checked ? [...g.requiredAtomIds, a.id] : g.requiredAtomIds.filter((x) => x !== a.id) })} /> {a.statement || '(fait sans texte)'}</label>
                )) : <small className="pz-note">Écris les faits à l’étape suivante, puis reviens les cocher.</small>}
              </div>
              {field('Contournement (à coût narratif)', <input className="input" value={g.bypass ?? ''} placeholder="Forcer la trappe, au prix d’un grand bruit." onChange={(e) => edit('gates', g.id, { bypass: e.target.value })} />)}
              <button type="button" className="pz-chip" onClick={() => remove('gates', g.id)}>Retirer ce verrou</button>
            </div>
          ))}
          <button type="button" className="pz-chip" onClick={() => set({ gates: [...current.gates, { id: newId('verrou'), title: 'Verrou', targetSceneId: scenes[scenes.length - 1]?.id ?? '', criticalPath: current.pathKind !== 'optional_path', requiredAtomIds: [] } as Gate] })}>+ Verrou</button>
        </>
      );
      case 'Faits': return (
        <>
          <p className="pz-lead">Décompose la solution en faits stables que le groupe peut apprendre. Un fait ne dépend jamais d’un seul objet.</p>
          <div className="pz-row" style={{ justifyContent: 'flex-start' }}>
            <button type="button" className="pz-btn" disabled={busy || !aiReady()} title={aiReady() ? 'Faits et supports proposés à partir des énigmes liées : à relire.' : 'Configure une clé d’IA dans Réglages'} onClick={proposeWithAI}>{busy ? 'L’IA réfléchit…' : '✨ Proposer faits et supports avec l’IA'}</button>
            {aiError && <small className="pz-feedback failure">{aiError}</small>}
          </div>
          {current.knowledgeAtoms.map((a) => (
            <div key={a.id} className="ms-card">
              {field('Fait', <input className="input" value={a.statement} placeholder="La cloche d’obsidienne marque le reflux, non l’aube." onChange={(e) => edit('knowledgeAtoms', a.id, { statement: e.target.value })} />)}
              <div className="pz-row" style={{ justifyContent: 'flex-start' }}>
                <select className="input" style={{ maxWidth: 200 }} value={a.criticality} onChange={(e) => edit('knowledgeAtoms', a.id, { criticality: e.target.value as KnowledgeAtom['criticality'] })} aria-label="Nécessité">{CRITICALITY.map((c) => <option key={c.id} value={c.id} title={c.help}>{c.label}</option>)}</select>
                {DISCOVER.map((d) => <label key={d.id} className="pz-check"><input type="checkbox" checked={a.discoverableBy.includes(d.id)} onChange={(e) => edit('knowledgeAtoms', a.id, { discoverableBy: e.target.checked ? [...a.discoverableBy, d.id] : a.discoverableBy.filter((x) => x !== d.id) })} /> {d.label}</label>)}
                <button type="button" className="pz-chip" onClick={() => remove('knowledgeAtoms', a.id)}>✕</button>
              </div>
            </div>
          ))}
          <button type="button" className="pz-chip" onClick={() => set({ knowledgeAtoms: [...current.knowledgeAtoms, { id: newId('fait'), statement: '', criticality: 'critical', discoverableBy: ['manifestation'] }] })}>+ Fait</button>
        </>
      );
      case 'Supports': return (
        <>
          <p className="pz-lead">Chaque support enseigne un ou plusieurs faits, sans donner la solution. Vise deux sources indépendantes par fait critique, de natures différentes.</p>
          {current.clueDesigns.map((d) => {
            const leak = leaks(d.playerContent);
            return (
              <div key={d.id} className="ms-card">
                <div className="pz-grid2">
                  {field('Titre (MJ)', <input className="input" value={d.title} onChange={(e) => edit('clueDesigns', d.id, { title: e.target.value })} />)}
                  {field('Nature', <select className="input" value={d.media} onChange={(e) => edit('clueDesigns', d.id, { media: e.target.value as Medium })}>{MEDIA.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>)}
                </div>
                {field('Ce que lisent ou voient les joueurs', <textarea className="input" rows={2} value={d.playerContent} onChange={(e) => edit('clueDesigns', d.id, { playerContent: e.target.value })} />)}
                {leak.length > 0 && <p className="pz-feedback failure">Contient une valeur de la solution ({leak.join(', ')}) : il donnerait la réponse.</p>}
                {field('Pourquoi cet indice (MJ)', <input className="input" value={d.gmIntent ?? ''} onChange={(e) => edit('clueDesigns', d.id, { gmIntent: e.target.value })} />)}
                <div className="pz-row" style={{ justifyContent: 'flex-start' }}>
                  <span className="pz-note">Enseigne :</span>
                  {current.knowledgeAtoms.map((a) => <label key={a.id} className="pz-check"><input type="checkbox" checked={d.knowledgeAtomIds.includes(a.id)} onChange={(e) => edit('clueDesigns', d.id, { knowledgeAtomIds: e.target.checked ? [...d.knowledgeAtomIds, a.id] : d.knowledgeAtomIds.filter((x) => x !== a.id) })} /> {a.statement.slice(0, 60) || '(fait)'}</label>)}
                  <label className="pz-check"><input type="checkbox" checked={!!d.unique} onChange={(e) => edit('clueDesigns', d.id, { unique: e.target.checked })} /> objet unique</label>
                  <button type="button" className="pz-chip" onClick={() => remove('clueDesigns', d.id)}>✕</button>
                </div>
              </div>
            );
          })}
          <button type="button" className="pz-chip" onClick={() => set({ clueDesigns: [...current.clueDesigns, { id: newId('support'), title: 'Nouvel indice', knowledgeAtomIds: [], media: 'journal', playerContent: '' }] })}>+ Support</button>
        </>
      );
      case 'Distribution': return <Distribution arc={current} scenes={scenes} save={save} />;
      default: return (
        <>
          <p className="pz-lead">Le verdict expliqué : ce qui bloque, ce qui reste fragile, et la couverture de chaque verrou. « Prêt » veut dire accessible, pas compris.</p>
          <h3>Vérifications</h3>
          {issues.length ? <ul className="pz-checks">{issues.map((x, i) => <li key={i} className={x.level}>{x.level === 'bloquant' ? '✖' : '⚠'} {x.text}</li>)}</ul> : <p className="pz-checks"><span className="ok">✔ Aucun problème de structure ni de continuité.</span></p>}
          {current.clueDesigns.some((d) => leaks(d.playerContent).length) && <p className="pz-feedback failure">Un support contient une valeur de la solution.</p>}
          <h3>Couverture des verrous</h3>
          {coverage.map(({ g, c }) => (
            <div key={g.id} className="ms-card">
              <b>{g.title}</b> <span className={`ms-ready r-${c.status}`}>{READINESS_LABEL[c.status]}</span> <small className="pz-note">{sceneTitle(g.targetSceneId)}</small>
              <p className="pz-note">{c.why}</p>
              <ul className="ms-atoms">{c.atoms.map((x) => <li key={x.atom.id} className={`a-${x.status}`}><b>{x.status}</b> · {x.atom.statement} <small className="pz-note">— {x.why}</small></li>)}</ul>
            </div>
          ))}
          <div className="pz-row" style={{ justifyContent: 'flex-start' }}>
            <span className="pz-note">État :</span>
            {(['draft', 'verified', 'scheduled', 'running', 'resolved', 'abandoned'] as const).map((st) => (
              <button key={st} type="button" className={`pz-chip ${current.status === st ? 'on' : ''}`} disabled={(st === 'verified' || st === 'scheduled') && issues.some((x) => x.level === 'bloquant')}
                onClick={() => set({ status: st })}>{({ draft: 'Brouillon', verified: 'Vérifié', scheduled: 'Programmé', running: 'En cours', resolved: 'Résolu', abandoned: 'Abandonné' })[st]}</button>
            ))}
          </div>
        </>
      );
    }
  })();

  return (
    <div className="pz-atelier">
      <header className="pz-modal-head">
        <b>🕸 Fil des mystères · {current.title}</b>
        <div className="pz-row pz-small">
          <small className="pz-note">Enregistré à chaque modification</small>
          <button type="button" className="pz-btn ghost" onClick={onClose}>Fermer</button>
        </div>
      </header>
      <div className="ms-layout">
        <nav className="pz-steps" aria-label="Étapes">
          {STEPS.map((s, i) => <button key={s} type="button" className={i === step ? 'on' : ''} aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}><span>{i + 1}</span>{s}</button>)}
        </nav>
        <section className="pz-step" aria-label={STEPS[step]}>
          <h2>{step + 1}. {STEPS[step]}</h2>
          {body}
          <div className="pz-row pz-step-nav">
            <button type="button" className="pz-btn ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>← Précédent</button>
            {step < STEPS.length - 1 && <button type="button" className="pz-btn" onClick={() => setStep(step + 1)}>Suivant →</button>}
          </div>
        </section>
        <aside className="ms-side" aria-label="Aperçu">
          <h3>Verrous</h3>
          {coverage.length ? coverage.map(({ g, c }) => <p key={g.id}><span className={`ms-ready r-${c.status}`}>{READINESS_LABEL[c.status]}</span> {g.title}</p>) : <p className="pz-note">Aucun verrou.</p>}
          <h3>Sources par fait</h3>
          {current.knowledgeAtoms.map((a) => {
            const n = new Set(current.manifestations.filter((m) => isActive(m) && current.clueDesigns.find((d) => d.id === m.clueDesignId)?.knowledgeAtomIds.includes(a.id)).map((m) => m.clueDesignId)).size;
            return <p key={a.id} className="pz-note">{n} · {a.statement.slice(0, 48) || '(fait)'}{a.criticality === 'critical' && n < 2 && !a.discoverableBy.some((x) => x === 'local_observation' || x === 'experiment') ? ' ⚠' : a.discoverableBy.some((x) => x === 'local_observation' || x === 'experiment') ? ' · sur place' : ''}</p>;
          })}
          <h3>Prochaine action</h3>
          <p className="pz-note">{nextAction(current, issues.length, coverage.map((x) => x.c.status), !!camp)}</p>
        </aside>
      </div>
    </div>
  );
}

function nextAction(arc: MysteryArc, issues: number, statuses: Readiness[], hasCampaign: boolean) {
  if (!hasCampaign) return 'Choisir la campagne (étape 1).';
  if (!arc.gates.length) return 'Ajouter le verrou (étape 2).';
  if (!arc.knowledgeAtoms.length) return 'Écrire les faits à connaître (étape 3).';
  if (!arc.clueDesigns.length) return 'Créer des supports d’indices (étape 4).';
  if (!arc.sceneSlots.length) return 'Déclarer des emplacements dans les scènes (étape 5).';
  if (statuses.includes('BLOCKED')) return 'Placer des indices avant les verrous bloqués (étape 5).';
  if (issues) return 'Corriger les vérifications (étape 6).';
  if (statuses.includes('AT_RISK')) return 'Ajouter une seconde source ou un emplacement de secours.';
  return 'Prêt pour la séance : la Table de jeu signalera les indices à ne pas manquer.';
}

/** Étape 5 : emplacements par scène, placements, et propositions motivées du planificateur. */
function Distribution({ arc, scenes, save }: { arc: MysteryArc; scenes: SceneRef[]; save: (a: MysteryArc) => void }) {
  const [openDesign, setOpenDesign] = useState<string | null>(null);
  if (!scenes.length) return <p className="pz-feedback failure">La campagne n’a pas de scènes (ou aucune campagne n’est choisie).</p>;
  const key = () => newId('cle');
  const editSlot = (id: string, patch: Partial<SceneSlot>) => save({ ...arc, sceneSlots: arc.sceneSlots.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const addSlot = (sceneId: string) => save({ ...arc, sceneSlots: [...arc.sceneSlots, { id: newId('emplacement'), sceneId, label: 'Nouvel emplacement', allowedMedia: [], capacity: 1 }] });
  const designOf = (id: string) => arc.clueDesigns.find((d) => d.id === id);
  const placeAll = () => {
    let next = arc;
    for (const d of arc.clueDesigns) {
      if (next.manifestations.some((m) => m.clueDesignId === d.id && isActive(m))) continue;
      const [best] = proposalsFor(next, d, scenes);
      if (best) next = place(next, d.id, best.slot.id, key());
    }
    save(next);
  };
  return (
    <>
      <p className="pz-lead">Déclare où un indice peut se trouver dans chaque scène, puis accepte les propositions : semées tôt, variées, jamais seulement dans une scène facultative. Rien n’est publié sans toi.</p>
      <div className="pz-row" style={{ justifyContent: 'flex-start' }}><button type="button" className="pz-btn" onClick={placeAll}>Placer chaque support à sa meilleure place</button></div>
      <ol className="ms-timeline">
        {scenes.map((sc) => {
          const gates = arc.gates.filter((g) => g.targetSceneId === sc.id);
          return (
            <li key={sc.id} className={sc.played ? 'played' : ''}>
              <header><b>{sc.title}</b>{sc.played && <small className="pz-note"> · jouée</small>}{gates.map((g) => <span key={g.id} className="ms-gate">🔒 {g.title}</span>)}</header>
              {arc.sceneSlots.filter((s) => s.sceneId === sc.id).map((s) => (
                <div key={s.id} className="ms-slot">
                  <input className="input" value={s.label} aria-label="Emplacement" onChange={(e) => editSlot(s.id, { label: e.target.value })} />
                  <select className="input" value={s.allowedMedia[0] ?? ''} aria-label="Nature permise" onChange={(e) => editSlot(s.id, { allowedMedia: e.target.value ? [e.target.value as Medium] : [] })}><option value="">tout support</option>{MEDIA.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
                  <label className="pz-check"><input type="checkbox" checked={!!s.isOptional} onChange={(e) => editSlot(s.id, { isOptional: e.target.checked })} /> facultatif</label>
                  <label className="pz-check"><input type="checkbox" checked={!!s.isReserve} onChange={(e) => editSlot(s.id, { isReserve: e.target.checked })} /> secours</label>
                  <div className="ms-placed">
                    {arc.manifestations.filter((m) => m.slotId === s.id).map((m) => (
                      <span key={m.id} className={`ms-manif st-${m.state}`}>{designOf(m.clueDesignId)?.title ?? '?'} · {STATE_LABEL[m.state]}
                        {m.state === 'slotted' && <button type="button" aria-label="Retirer" onClick={() => save({ ...arc, manifestations: arc.manifestations.filter((x) => x.id !== m.id) })}>✕</button>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {!sc.played && <button type="button" className="pz-chip" onClick={() => addSlot(sc.id)}>+ Emplacement</button>}
            </li>
          );
        })}
      </ol>
      <h3>Propositions par support</h3>
      {arc.clueDesigns.map((d) => {
        const props = proposalsFor(arc, d, scenes).slice(0, 3);
        const placed = arc.manifestations.filter((m) => m.clueDesignId === d.id && isActive(m)).length;
        return (
          <div key={d.id} className="ms-card">
            <button type="button" className="ms-toggle" aria-expanded={openDesign === d.id} onClick={() => setOpenDesign(openDesign === d.id ? null : d.id)}>
              <b>{d.title}</b> <small className="pz-note">{MEDIUM_LABEL[d.media]} · {placed ? `placé ${placed} fois` : 'pas encore placé'}</small>
            </button>
            {openDesign === d.id && (props.length ? (
              <ol className="pz-proof">
                {props.map((p) => (
                  <li key={p.slot.id}><b>{p.slot.label}</b> · {p.scene.title} <small className="pz-note">({p.reasons.join(', ')})</small> <button type="button" className="pz-chip" onClick={() => save(place(arc, d.id, p.slot.id, key()))}>Placer ici</button></li>
                ))}
              </ol>
            ) : <p className="pz-note">Aucun emplacement compatible avant l’échéance : ajoute-en un dans une scène à venir, ou change la nature du support.</p>)}
          </div>
        );
      })}
    </>
  );
}
