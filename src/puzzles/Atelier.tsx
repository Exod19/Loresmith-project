/**
 * Atelier des énigmes : un parcours guidé en sept étapes (d'après le kit v2), du rôle de l'énigme dans la campagne
 * jusqu'à sa publication. Le solveur vérifie la solution, l'essai à blanc montre exactement ce que verront les
 * joueurs, et le contrôle qualité dit ce qui manque. L'IA peut rédiger, jamais valider : seul le MJ marque
 * une énigme « relue » puis « prête ».
 */
import { useMemo, useState, type ReactNode } from 'react';
import { aiReady, askAI, parseJson } from '../ai/client';
import { usePuzzles } from './context';
import { createState, dispatchPuzzle, MECHANIC_LABEL, publicProjection } from './engine';
import MechanismConfig from './MechanismConfig';
import PuzzleStage from './PuzzleStage';
import { CRITERIA, checksOf, readiness } from './quality';
import { solvePuzzle } from './solver';
import { DEFAULTS, EXPERIENCES, mechanicStart } from './templates';
import type { Clue, Mechanic, Puzzle, PuzzleAction, PuzzleState } from './types';
import './puzzles.css';

/** Ce que l'IA rend pour remplir une énigme (tout est facultatif : on garde l'existant pour ce qui manque). */
type AiPuzzle = {
  title?: string; location?: string; sceneDescription?: string; objective?: string;
  observations?: { text?: unknown; available?: string }[]; readables?: { source?: unknown; text?: unknown }[];
  deductionPath?: unknown[]; hints?: unknown[]; onWrongAnswer?: string; alternateBypass?: string;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

export type CampaignRef = { id: string; title?: string; name?: string; scenes?: { id: string; title?: string; played?: boolean }[] };

const STEPS = [
  { id: 'place', label: 'Place dans la campagne' },
  { id: 'experience', label: 'Expérience voulue' },
  { id: 'regles', label: 'Règles du mécanisme' },
  { id: 'informations', label: 'Ce que les joueurs peuvent savoir' },
  { id: 'solution', label: 'Solution vérifiée' },
  { id: 'indices', label: 'Indices et échecs' },
  { id: 'publication', label: 'Essai et publication' },
] as const;

const OBJECTS = ['porte', 'herse', 'coffre', 'tiroirs', 'autel', 'trappe', 'passage', 'autre'];
const DIFFICULTY: Record<string, string> = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avancee: 'Avancée' };

export default function Atelier({ initial, campaigns = [], onClose }: { initial: Puzzle; campaigns?: CampaignRef[]; onClose: () => void }) {
  const lib = usePuzzles();
  const [p, setP] = useState<Puzzle>(() => clone(initial));
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const clues = lib?.clues ?? [];
  const solver = useMemo(() => solvePuzzle(p, p.design), [p]);
  const checks = useMemo(() => checksOf(p, clues, solver), [p, clues, solver]);
  const ready = useMemo(() => readiness(p, checks, solver), [p, checks, solver]);
  if (!lib) return null;

  const change = (next: Puzzle) => { setP({ ...next, status: next.status === 'prete' && JSON.stringify(next) !== JSON.stringify(p) ? 'brouillon' : next.status }); setDirty(true); };
  const pl = p.player, gm = p.gm, design = p.design ?? {};
  const setPl = (patch: Partial<Puzzle['player']>) => change({ ...p, player: { ...pl, ...patch } });
  const setGm = (patch: Partial<Puzzle['gm']>) => change({ ...p, gm: { ...gm, ...patch } });
  const setDesign = (patch: Partial<NonNullable<Puzzle['design']>>) => change({ ...p, design: { ...design, ...patch } });
  const save = (next: Puzzle = p) => { lib.savePuzzle({ ...next, updatedAt: Date.now() }); setP(next); setDirty(false); };
  const go = (i: number) => { if (dirty) save(); setStep(i); };

  const field = (label: string, input: ReactNode, hint?: string) => <label className="pz-field">{label}{input}{hint && <small className="pz-note">{hint}</small>}</label>;
  const lines = (label: string, value: string[] = [], onSet: (v: string[]) => void, hint?: string) => field(label, <textarea className="input" rows={Math.max(3, value.length + 1)} value={value.join('\n')} onChange={(e) => onSet(e.target.value.split('\n'))} />, hint ?? 'Une ligne par élément.');

  const camp = campaigns.find((c) => c.id === design.campaignId);
  const pickMechanic = (m: Mechanic) => {
    if (m === p.mechanic) return;
    if (!confirm(`Passer à « ${MECHANIC_LABEL[m]} » ? Les règles du mécanisme repartent du modèle ; les textes sont gardés.`)) return;
    const d = DEFAULTS[m], start = mechanicStart(m);
    change({ ...p, mechanic: m, family: d.family, engine: { kind: m, publicConfig: clone(d.publicConfig), serverConfig: clone(d.serverConfig) },
      design: { ...design, laws: start.laws, claims: start.claims }, player: { ...pl, readables: start.readables ?? (p.mechanic === 'statues' ? [] : pl.readables) } });
  };

  /** L'IA rédige la scène, les observations, les documents, la démonstration et les indices (à relire). */
  const draftWithAI = async () => {
    setBusy(true); setAiError(null);
    try {
      const system = 'Tu conçois des énigmes déductives pour un jeu de rôle dark fantasy, en français. L’énigme se résout par l’observation et le raisonnement, jamais par un jet de dé. Les indices orientent sans donner la réponse. Tu ne contredis jamais la règle ni la solution fournies.';
      const user = [
        `Mécanisme : ${MECHANIC_LABEL[p.mechanic]}. Loi : ${(design.laws ?? []).join(' ')}`,
        `Configuration visible : ${JSON.stringify(p.engine.publicConfig)}`,
        `Solution (secrète, pour la démonstration et les indices seulement) : ${JSON.stringify(p.engine.serverConfig)}`,
        p.mechanic === 'statues' ? 'Les inscriptions des statues sont déjà écrites : ne propose pas de documents.' : '',
        p.mechanic === 'chronology' ? 'Écris un document par relation « avant / après », chacun d’une source différente, sans jamais donner l’ordre complet.' : '',
        p.mechanic === 'prime-tiles' ? 'Un document doit permettre de comprendre la règle des dalles sûres sans la nommer directement.' : '',
        `Titre provisoire : ${p.title}. Lieu : ${pl.location || 'à proposer'}. Objet verrouillé : ${design.objectKind || 'porte'}. Enjeu : ${design.stakes || 'à proposer'}.`,
        camp ? `Campagne : ${camp.title ?? camp.name}.` : '',
        'Rends un objet : {"title","location","sceneDescription","objective","observations":[{"text","available":"initiale"|"inspection"}],"readables":[{"source","text"}],"deductionPath":[...],"hints":[3 textes : orienter, révéler une observation, rappeler la loi],"onWrongAnswer","alternateBypass"}. Au moins deux observations initiales et une à découvrir. Aucun indice ni observation ne contient la réponse.',
      ].filter(Boolean).join('\n');
      const out = parseJson<AiPuzzle>(await askAI(system, user, { json: true }));
      if (!out) throw new Error('Réponse illisible de l’IA.');
      const keepReadables = p.mechanic === 'statues';
      change({
        ...p,
        title: p.title === 'Nouvelle énigme' && out.title ? out.title : p.title,
        player: {
          ...pl,
          location: pl.location || out.location || '',
          sceneDescription: out.sceneDescription ?? pl.sceneDescription,
          objective: out.objective ?? pl.objective,
          observations: (out.observations ?? []).map((o) => ({ id: `obs-${uid()}`, text: String(o.text ?? ''), available: o.available === 'initiale' ? 'initiale' : 'inspection_sans_jet' })),
          readables: keepReadables ? pl.readables : (out.readables ?? []).map((r) => ({ source: String(r.source ?? 'Document'), text: String(r.text ?? '') })),
        },
        gm: {
          ...gm,
          deductionPath: (out.deductionPath ?? []).map(String),
          nonSpoilerHints: (out.hints ?? []).slice(0, 3).map((t, i) => ({ tier: i + 1, text: String(t), kind: ['orientation', 'nouvelle_observation', 'rappel_de_regle'][i] })),
          failureForward: { ...gm.failureForward, onWrongAnswer: out.onWrongAnswer ?? gm.failureForward.onWrongAnswer },
          alternateBypass: out.alternateBypass ?? gm.alternateBypass,
        },
        design: { ...design, aiDraft: true, reviewed: false },
      });
    } catch (e) { setAiError((e as Error).message); } finally { setBusy(false); }
  };

  const toCarnet = (i: number) => {
    const r = pl.readables![i];
    const clue: Clue = { id: `indice-${uid()}`, universeId: lib.universeId, title: r.source, kind: 'page', text: r.text, held: false, puzzleId: p.id,
      gmNote: `Document de l’énigme « ${p.title} » : à placer dans une autre scène, remis au groupe quand il le trouve.`, createdAt: Date.now() };
    lib.saveClue(clue);
    setPl({ readables: pl.readables!.map((x, k) => (k === i ? { ...x, clueId: clue.id } : x)) });
  };

  const body = (() => {
    switch (STEPS[step].id) {
      case 'place': return (
        <>
          <p className="pz-lead">À quoi sert cette énigme dans l’histoire ? Elle garde un passage, un trésor, un secret : elle doit avoir du sens là où elle se trouve.</p>
          {field('Titre', <input className="input" value={p.title} onChange={(e) => change({ ...p, title: e.target.value })} />)}
          <div className="pz-grid2">
            {field('Lieu', <input className="input" value={pl.location ?? ''} placeholder="Antichambre d’une porte basaltique" onChange={(e) => setPl({ location: e.target.value })} />)}
            {field('Ce qu’elle verrouille', <select className="input" value={design.objectKind ?? 'porte'} onChange={(e) => setDesign({ objectKind: e.target.value })}>{OBJECTS.map((o) => <option key={o}>{o}</option>)}</select>)}
            {field('Campagne', <select className="input" value={design.campaignId ?? ''} onChange={(e) => setDesign({ campaignId: e.target.value || undefined, sceneId: undefined })}><option value="">— aucune —</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.title ?? c.name}</option>)}</select>)}
            {field('Scène', <select className="input" value={design.sceneId ?? ''} disabled={!camp} onChange={(e) => setDesign({ sceneId: e.target.value || undefined })}><option value="">— aucune —</option>{(camp?.scenes ?? []).map((sc) => <option key={sc.id} value={sc.id}>{sc.title}</option>)}</select>)}
            {field('Difficulté', <select className="input" value={p.difficulty ?? 'intermediaire'} onChange={(e) => change({ ...p, difficulty: e.target.value })}>{Object.entries(DIFFICULTY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>)}
            {field('Durée visée (minutes)', <input className="input" type="number" min={3} max={60} value={p.estimatedMinutes ?? 12} onChange={(e) => change({ ...p, estimatedMinutes: Number(e.target.value) || 12 })} />, 'Une bonne énigme de 7 minutes vaut mieux que trois de 20.')}
          </div>
          {field('Enjeu et rôle dramatique', <textarea className="input" rows={3} value={design.stakes ?? ''} placeholder="Ce qui se passe si le groupe réussit, échoue ou contourne ; pourquoi c’est intéressant maintenant." onChange={(e) => setDesign({ stakes: e.target.value })} />)}
        </>
      );
      case 'experience': return (
        <>
          <p className="pz-lead">Quel genre de réflexion veux-tu offrir à ce groupe ? Chaque mécanisme suit une loi stable que les joueurs peuvent découvrir.</p>
          {EXPERIENCES.map((x) => (
            <section key={x.id} className="pz-exp">
              <h3>{x.label}</h3>
              <div className="pz-mech-cards">
                {x.mechanics.map((m) => (
                  <button key={m} type="button" className={`pz-mech-card ${p.mechanic === m ? 'on' : ''}`} aria-pressed={p.mechanic === m} onClick={() => pickMechanic(m)}>
                    <b>{MECHANIC_LABEL[m]}</b><span>{DEFAULTS[m].text}</span><small>Loi : {DEFAULTS[m].law}</small>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </>
      );
      case 'regles': return (
        <>
          <p className="pz-lead">Les lois que le monde suit, toujours les mêmes : un essai faux reçoit une réponse cohérente, jamais « mauvaise combinaison ».</p>
          {lines('Lois du mécanisme', design.laws, (v) => setDesign({ laws: v }))}
          <h3>Réglages</h3>
          <MechanismConfig p={p} onChange={change} />
          <Sandbox p={p} clues={clues} title="Essayer le mécanisme" />
        </>
      );
      case 'informations': return (
        <>
          <p className="pz-lead">Tout ce qu’il faut pour déduire la réponse doit être accessible : sur place, en examinant, ou dans des documents trouvés ailleurs (le carnet du groupe).</p>
          <div className="pz-row" style={{ justifyContent: 'flex-start' }}>
            <button type="button" className="pz-btn" disabled={busy || !aiReady()} title={aiReady() ? 'L’IA rédige la scène, les observations, les documents, la démonstration et les indices : à relire.' : 'Configure une clé d’IA dans Réglages'} onClick={draftWithAI}>{busy ? 'L’IA rédige…' : '✨ Rédiger avec l’IA'}</button>
            {design.aiDraft && <small className="pz-status brouillon">proposé par l’IA : à relire</small>}
            {aiError && <small className="pz-feedback failure">{aiError}</small>}
          </div>
          {field('Scène (lue aux joueurs)', <textarea className="input" rows={3} value={pl.sceneDescription ?? ''} onChange={(e) => setPl({ sceneDescription: e.target.value })} />)}
          {field('Objectif des joueurs', <input className="input" value={pl.objective ?? ''} onChange={(e) => setPl({ objective: e.target.value })} />)}
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
          {p.mechanic === 'statues' && <p className="pz-note">Les inscriptions des statues suivent les affirmations réglées à l’étape 3.</p>}
          {(pl.readables ?? []).map((r, i) => {
            const c = clues.find((x) => x.id === r.clueId);
            return (
              <div key={i} className="pz-prep-doc">
                <div className="pz-prep-row">
                  <input className="input" value={r.source} disabled={p.mechanic === 'statues'} onChange={(e) => setPl({ readables: pl.readables!.map((x, k) => (k === i ? { ...x, source: e.target.value } : x)) })} />
                  {p.mechanic !== 'statues' && <button type="button" className="pz-chip" aria-label="Retirer" onClick={() => setPl({ readables: pl.readables!.filter((_, k) => k !== i) })}>✕</button>}
                </div>
                <textarea className="input" rows={2} value={r.text} disabled={p.mechanic === 'statues'} onChange={(e) => setPl({ readables: pl.readables!.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })} />
                {r.clueId
                  ? <span className="pz-row pz-small" style={{ justifyContent: 'flex-start' }}><small className={`pz-status ${c?.held ? 'prete' : 'brouillon'}`}>{c ? (c.held ? 'dans le carnet du groupe' : 'à trouver ailleurs (carnet)') : 'indice supprimé'}</small><button type="button" className="pz-chip" onClick={() => setPl({ readables: pl.readables!.map((x, k) => (k === i ? { source: x.source, text: x.text } : x)) })}>Remettre sur place</button></span>
                  : <span className="pz-row pz-small" style={{ justifyContent: 'flex-start' }}><small className="pz-note">sur place</small><button type="button" className="pz-chip" onClick={() => toCarnet(i)}>À trouver ailleurs →</button></span>}
              </div>
            );
          })}
          {p.mechanic !== 'statues' && <button type="button" className="pz-chip" onClick={() => setPl({ readables: [...(pl.readables ?? []), { source: 'Inscription', text: '' }] })}>+ Document</button>}
        </>
      );
      case 'solution': return (
        <>
          <p className="pz-lead">Le solveur vérifie qu’une solution existe, combien sont acceptées, et en donne une preuve. Écris ensuite la démonstration telle que les joueurs pourraient la faire.</p>
          <SolverBox r={solver} onApply={solver.derived ? () => change({ ...p, engine: { ...p.engine, serverConfig: { ...p.engine.serverConfig, ...solver.derived } } }) : undefined} current={p.engine.serverConfig} />
          {lines('Démonstration : de l’observation à la conclusion', gm.deductionPath, (v) => setGm({ deductionPath: v }), '« Information A + observation B ⇒ conclusion C », une étape par ligne.')}
          {lines('Autres voies acceptables', gm.acceptedAlternativeApproaches, (v) => setGm({ acceptedAlternativeApproaches: v }), 'Sorts, objets, idées de joueurs que tu accepteras.')}
        </>
      );
      case 'indices': return (
        <>
          <p className="pz-lead">Trois paliers qui réorientent sans résoudre : déplacer le regard, révéler une observation manquée, rappeler une loi. Jamais l’ordre, le chiffre ou le dernier choix.</p>
          {gm.nonSpoilerHints.map((h, i) => field(['Palier 1 : orienter', 'Palier 2 : révéler une observation', 'Palier 3 : rappeler la loi'][i] ?? `Indice ${i + 1}`, (
            <input className="input" value={h.text} onChange={(e) => setGm({ nonSpoilerHints: gm.nonSpoilerHints.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })} />
          )))}
          <h3>Quand les joueurs se trompent</h3>
          {field('Conséquence (dans le monde)', <textarea className="input" rows={2} value={gm.failureForward.onWrongAnswer} onChange={(e) => setGm({ failureForward: { ...gm.failureForward, onWrongAnswer: e.target.value } })} />, 'Un détour, un coût, une alarme : jamais une impasse.')}
          <div className="pz-grid2">
            {field('Après combien d’erreurs (0 : jamais)', <input className="input" type="number" min={0} max={9} value={gm.failureForward.threshold} onChange={(e) => setGm({ failureForward: { ...gm.failureForward, threshold: Math.max(0, Number(e.target.value) || 0) } })} />)}
            {field('Coût', <input className="input" value={gm.failureForward.cost ?? ''} onChange={(e) => setGm({ failureForward: { ...gm.failureForward, cost: e.target.value } })} />)}
          </div>
          {field('Détour si le groupe bloque', <textarea className="input" rows={2} value={gm.alternateBypass ?? ''} onChange={(e) => setGm({ alternateBypass: e.target.value })} />)}
          <h3>Jets utiles (ils éclairent, ils ne résolvent pas)</h3>
          {(gm.skillChecks ?? []).map((k, i) => (
            <div key={i} className="pz-prep-row">
              <input className="input" style={{ maxWidth: 160 }} value={k.skill} placeholder="Perception" onChange={(e) => setGm({ skillChecks: gm.skillChecks!.map((x, j) => (j === i ? { ...x, skill: e.target.value } : x)) })} />
              <input className="input" value={k.result} placeholder="Ce qu’il révèle (une observation, pas la réponse)" onChange={(e) => setGm({ skillChecks: gm.skillChecks!.map((x, j) => (j === i ? { ...x, result: e.target.value } : x)) })} />
              <button type="button" className="pz-chip" aria-label="Retirer" onClick={() => setGm({ skillChecks: gm.skillChecks!.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button type="button" className="pz-chip" onClick={() => setGm({ skillChecks: [...(gm.skillChecks ?? []), { skill: '', result: '' }] })}>+ Jet</button>
        </>
      );
      default: return (
        <>
          <p className="pz-lead">Joue-la comme les joueurs la verront (sans rien de secret), puis relis-la. Elle n’est prête qu’une fois tout vérifié.</p>
          <Sandbox p={p} clues={clues} title="Essai à blanc (vue joueurs)" withCarnet />
          <h3>Vérifications</h3>
          <ul className="pz-checks">{checks.map((c, i) => <li key={i} className={c.level}>{c.level === 'ok' ? '✔' : c.level === 'bloquant' ? '✖' : '⚠'} {c.text}</li>)}</ul>
          <h3>Grille de qualité · {ready.total}/40</h3>
          <div className="pz-scores">
            {CRITERIA.map((c) => (
              <label key={c.id} className="pz-score" title={c.help}>
                <span>{c.label}{c.blocking ? ' *' : ''}</span>
                <input type="range" min={0} max={5} value={ready.scores[c.id]} onChange={(e) => setDesign({ scores: { ...ready.scores, [c.id]: Number(e.target.value) } })} />
                <b>{ready.scores[c.id]}</b>
                <small className="pz-note">{c.help}</small>
              </label>
            ))}
          </div>
          <p className="pz-note">* Critère bloquant : 4 au moins. 32/40 au moins pour publier. Notes proposées d’après les vérifications : ajuste-les.</p>
          <label className="pz-check"><input type="checkbox" checked={!!design.reviewed} onChange={(e) => setDesign({ reviewed: e.target.checked })} /> Je l’ai relue : jouable, cohérente avec mon univers, sans réponse donnée dans les indices.</label>
          <ol className="pz-pipeline">
            <li className="done">Brouillon</li>
            <li className={solver.ok ? 'done' : ''}>Vérifiée par le solveur</li>
            <li className={design.reviewed ? 'done' : ''}>Relue par le MJ</li>
            <li className={p.status === 'prete' ? 'done' : ''}>Prête à jouer</li>
          </ol>
          {p.status === 'prete'
            ? <button type="button" className="pz-btn" onClick={() => save({ ...p, status: 'brouillon' })}>Repasser en brouillon</button>
            : <button type="button" className="pz-btn primary" disabled={!ready.ready} onClick={() => save({ ...p, status: 'prete' })}>✔ Marquer prête</button>}
          {!ready.ready && <p className="pz-note">Pas encore : {ready.reasons.join(' ; ')}.</p>}
        </>
      );
    }
  })();

  return (
    <div className="pz-atelier">
      <header className="pz-modal-head">
        <b>🧩 Atelier · {p.title} <small className={`pz-status ${p.status === 'prete' ? 'prete' : 'brouillon'}`}>{p.status === 'prete' ? 'prête' : 'brouillon'}</small></b>
        <div className="pz-row pz-small">
          {dirty && <small className="pz-note">Modifications non enregistrées</small>}
          <button type="button" className="pz-btn" disabled={!dirty} onClick={() => save()}>Enregistrer</button>
          <button type="button" className="pz-btn ghost" onClick={() => { if (!dirty || confirm('Quitter sans enregistrer ?')) onClose(); }}>Fermer</button>
        </div>
      </header>
      <div className="pz-atelier-body">
        <nav className="pz-steps" aria-label="Étapes">
          {STEPS.map((s, i) => (
            <button key={s.id} type="button" className={`${i === step ? 'on' : ''}`} aria-current={i === step ? 'step' : undefined} onClick={() => go(i)}>
              <span>{i + 1}</span>{s.label}
              {s.id === 'solution' && <i className={solver.ok ? 'ok' : 'ko'}>{solver.ok ? '✔' : '✖'}</i>}
              {s.id === 'publication' && <i className={ready.ready ? 'ok' : ''}>{ready.total}/40</i>}
            </button>
          ))}
        </nav>
        <section className="pz-step" aria-label={STEPS[step].label}>
          <h2>{step + 1}. {STEPS[step].label}</h2>
          {body}
          <div className="pz-row pz-step-nav">
            <button type="button" className="pz-btn ghost" disabled={step === 0} onClick={() => go(step - 1)}>← Précédent</button>
            {step < STEPS.length - 1 && <button type="button" className="pz-btn" onClick={() => go(step + 1)}>Suivant →</button>}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Le mécanisme réel, joué en local (rien n'est enregistré) : pour vérifier qu'il réagit comme prévu. */
function Sandbox({ p, clues, title, withCarnet }: { p: Puzzle; clues: Clue[]; title: string; withCarnet?: boolean }) {
  const [state, setState] = useState<PuzzleState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [held, setHeld] = useState(true);
  const key = JSON.stringify(p.engine) + p.mechanic;
  const [k, setK] = useState(key);
  let s = state;
  if (!s || k !== key) { try { s = createState(p); } catch { s = null; } if (k !== key) { setK(key); setState(s); } }
  if (!s) return <p className="pz-note">Mécanisme incomplet.</p>;
  const own = clues.filter((c) => c.puzzleId === p.id).map((c) => ({ ...c, held: held || c.held }));
  const act = (a: PuzzleAction) => { try { setState(dispatchPuzzle(p, s!, a, 'player')); setError(null); } catch (e) { setError((e as Error).message); } };
  return (
    <div className="pz-sandbox">
      <div className="pz-row" style={{ justifyContent: 'space-between' }}>
        <h3>{title}</h3>
        <span className="pz-row pz-small">
          {withCarnet && own.length > 0 && <label className="pz-check"><input type="checkbox" checked={held} onChange={(e) => setHeld(e.target.checked)} /> le groupe a trouvé les documents</label>}
          <button type="button" className="pz-chip" onClick={() => { setState(createState(p)); setError(null); }}>↺ Recommencer</button>
        </span>
      </div>
      {error && <p className="pz-feedback failure">{error}</p>}
      <PuzzleStage pub={publicProjection(p, s, own)} act={act} compact={!withCarnet} />
    </div>
  );
}

/** Rapport du solveur : résultat, preuve (MJ), et valeurs déduites à reporter dans la solution. */
function SolverBox({ r, onApply, current }: { r: ReturnType<typeof solvePuzzle>; onApply?: () => void; current: Record<string, unknown> }) {
  const differs = r.derived && Object.entries(r.derived).some(([k, v]) => JSON.stringify(current?.[k]) !== JSON.stringify(v));
  return (
    <div className={`pz-solver ${r.ok ? 'ok' : 'ko'}`}>
      <b>{r.ok ? `✔ Résoluble${r.solutions !== undefined ? ` · ${r.solutions} solution${r.solutions > 1 ? 's' : ''} acceptée${r.solutions > 1 ? 's' : ''}` : ''}` : '✖ Pas encore jouable'}</b>
      {r.errors.map((e, i) => <p key={`e${i}`} className="pz-feedback failure">{e}</p>)}
      {r.warnings.map((w, i) => <p key={`w${i}`} className="pz-note">⚠ {w}</p>)}
      {r.proof.length > 0 && <ol className="pz-proof">{r.proof.map((x, i) => <li key={i}>{x}</li>)}</ol>}
      {differs && onApply && <button type="button" className="pz-btn" onClick={onApply}>Reporter dans la solution : {Object.values(r.derived!).map((v) => (Array.isArray(v) ? v.join(' → ') : String(v))).join(', ')}</button>}
    </div>
  );
}

