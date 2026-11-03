/**
 * Section « Énigmes » : la bibliothèque des énigmes de l'univers (où chacune est posée, son état, sa note), l'atelier
 * de création guidé, et le carnet du groupe. Les énigmes se posent ensuite sur une porte, une herse ou un coffre de
 * la carte de combat.
 */
import { useEffect, useMemo, useState } from 'react';
import { usePuzzles } from './context';
import Atelier, { type CampaignRef } from './Atelier';
import { CarnetManager } from './CarnetPanel';
import { fromModel, loadCatalogue } from './catalogue';
import { MECHANIC_LABEL, MECHANICS } from './engine';
import { checksOf, readiness } from './quality';
import { solvePuzzle } from './solver';
import { blankPuzzle } from './templates';
import type { Puzzle } from './types';
import './puzzles.css';

type MapLike = { id: string; title?: string; universeId?: string; battle?: { walls?: { id: string; kind: string; label?: string; lock?: { puzzleId: string; solved?: boolean } }[]; objects?: { id: string; kind: string; lock?: { puzzleId: string; solved?: boolean } }[] } };

const OBJ: Record<string, string> = { coffre: 'Coffre', commode: 'Meuble à tiroirs', autel: 'Autel', porte: 'Porte', herse: 'Herse' };

export default function PuzzlesPage({ maps = {}, campaigns = [] }: { maps?: Record<string, MapLike>; campaigns?: CampaignRef[] }) {
  const lib = usePuzzles();
  const [tab, setTab] = useState<'enigmes' | 'carnet'>('enigmes');
  const [open, setOpen] = useState<Puzzle | null>(null);
  const [models, setModels] = useState<Puzzle[] | null>(null);
  const [showModels, setShowModels] = useState(false);
  const [q, setQ] = useState('');
  const [mech, setMech] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => { if (showModels && !models) loadCatalogue().then(setModels).catch(() => setModels([])); }, [showModels, models]);

  /** Où chaque énigme verrouille quelque chose, sur les cartes de combat de l'univers. */
  const uses = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const m of Object.values(maps)) {
      if (m.universeId !== lib?.universeId) continue;
      const add = (id: string, what: string) => out.set(id, [...(out.get(id) ?? []), `${what} · ${m.title ?? 'carte'}`]);
      (m.battle?.walls ?? []).forEach((w) => w.lock && add(w.lock.puzzleId, `${w.label ?? OBJ[w.kind] ?? 'Porte'}${w.lock.solved ? ' (ouverte)' : ''}`));
      (m.battle?.objects ?? []).forEach((o) => o.lock && add(o.lock.puzzleId, `${OBJ[o.kind] ?? 'Objet'}${o.lock.solved ? ' (ouvert)' : ''}`));
    }
    return out;
  }, [maps, lib?.universeId]);

  if (!lib) return null;
  if (open) return <div className="pz-section"><Atelier key={open.id} initial={open} campaigns={campaigns} onClose={() => setOpen(null)} /></div>;

  const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const list = lib.puzzles
    .filter((p) => (!mech || p.mechanic === mech) && (!status || (p.status ?? 'brouillon') === status) && (!q || fold(`${p.title} ${p.player.location ?? ''}`).includes(fold(q))))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const create = () => { const p = blankPuzzle('braziers', lib.universeId); lib.savePuzzle(p); setOpen(p); };
  const duplicate = (p: Puzzle) => {
    // La copie a ses propres documents : ceux du carnet restent attachés à l'original.
    const c = fromModel(p, lib.universeId);
    lib.savePuzzle({ ...c, title: `${p.title} (copie)`, origin: p.origin, player: { ...c.player, readables: (c.player.readables ?? []).map(({ source, text }) => ({ source, text })) } });
  };
  const remove = (p: Puzzle) => {
    const where = uses.get(p.id);
    if (!confirm(where ? `« ${p.title} » verrouille encore : ${where.join(', ')}. La supprimer quand même ? Ces verrous n’auront plus d’énigme.` : `Supprimer « ${p.title} » ?`)) return;
    lib.deletePuzzle(p.id);
  };

  return (
    <div className="pz-section">
      <h1 className="view">Énigmes</h1>
      <div className="pz-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'enigmes'} className={tab === 'enigmes' ? 'on' : ''} onClick={() => setTab('enigmes')}>🧩 Énigmes ({lib.puzzles.length})</button>
        <button type="button" role="tab" aria-selected={tab === 'carnet'} className={tab === 'carnet' ? 'on' : ''} onClick={() => setTab('carnet')}>📜 Carnet du groupe ({lib.clues.length})</button>
      </div>

      {tab === 'carnet' ? <div className="pz-step" style={{ marginTop: 12 }}><CarnetManager /></div> : (
        <>
          <p className="pz-lead" style={{ marginTop: 10 }}>Des énigmes qui se résolvent en observant et en raisonnant, pas aux dés. Crée-les ici, puis pose-les sur une porte, une herse ou un coffre depuis la carte de combat.</p>
          <div className="pz-lib-tools">
            <button type="button" className="pz-btn primary" onClick={create}>+ Nouvelle énigme</button>
            <button type="button" className={`pz-btn ${showModels ? 'on' : ''}`} onClick={() => setShowModels(!showModels)}>Partir d’un modèle (12)</button>
            <input className="input" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une énigme" />
            <select className="input" value={mech} onChange={(e) => setMech(e.target.value)} aria-label="Mécanisme"><option value="">Tous les mécanismes</option>{MECHANICS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="État"><option value="">Tous les états</option><option value="brouillon">Brouillons</option><option value="prete">Prêtes</option></select>
          </div>

          {showModels && (
            <div className="pz-step" style={{ marginBottom: 14 }}>
              <h3 style={{ marginTop: 0 }}>Modèles du kit (hors canon, à adapter)</h3>
              {!models ? <p className="pz-note">Chargement…</p> : (
                <ul className="pz-list">
                  {models.map((m) => (
                    <li key={m.id}>
                      <div><b>{m.title}</b> <small className="pz-note">· {MECHANIC_LABEL[m.mechanic]} · ~{m.estimatedMinutes} min</small><p className="pz-note">{m.player.objective}</p></div>
                      <button type="button" className="pz-chip on" onClick={() => { const p = fromModel(m, lib.universeId); lib.savePuzzle(p); setShowModels(false); setOpen(p); }}>Adapter dans l’atelier</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {list.length === 0 ? <p className="pz-note">{lib.puzzles.length ? 'Aucune énigme ne correspond.' : 'Aucune énigme pour l’instant : crée la première, ou pars d’un modèle.'}</p> : (
            <div className="pz-lib-grid">
              {list.map((p) => <PuzzleCard key={p.id} p={p} uses={uses.get(p.id)} clues={lib.clues} onOpen={() => setOpen(p)} onDuplicate={() => duplicate(p)} onDelete={() => remove(p)} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PuzzleCard({ p, uses, clues, onOpen, onDuplicate, onDelete }: { p: Puzzle; uses?: string[]; clues: import('./types').Clue[]; onOpen: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const r = useMemo(() => { const solver = solvePuzzle(p, p.design); return { solver, ...readiness(p, checksOf(p, clues, solver), solver) }; }, [p, clues]);
  const docs = (p.player.readables ?? []).filter((x) => x.clueId).length;
  return (
    <article className="pz-lib-card">
      <div className="pz-row" style={{ justifyContent: 'space-between' }}>
        <small className="pz-note">{MECHANIC_LABEL[p.mechanic]}{p.estimatedMinutes ? ` · ~${p.estimatedMinutes} min` : ''}</small>
        <small className={`pz-status ${p.status === 'prete' ? 'prete' : 'brouillon'}`}>{p.status === 'prete' ? 'prête' : 'brouillon'}</small>
      </div>
      <h3>{p.title}</h3>
      {p.player.location && <p className="pz-note">{p.player.location}</p>}
      {p.player.objective && <p>{p.player.objective}</p>}
      <p className="pz-note">
        {r.solver.ok ? '✔ résoluble' : '✖ pas encore jouable'} · qualité {r.total}/40{docs ? ` · ${docs} document${docs > 1 ? 's' : ''} à trouver ailleurs` : ''}{p.design?.aiDraft && !p.design.reviewed ? ' · proposée par l’IA, à relire' : ''}
      </p>
      {uses?.length ? <p className="pz-note">🔒 {uses.join(' ; ')}</p> : <p className="pz-note">Posée nulle part (carte de combat → « Verrouiller par une énigme »).</p>}
      <div className="pz-row pz-small">
        <button type="button" className="pz-chip on" onClick={onOpen}>Ouvrir dans l’atelier</button>
        <button type="button" className="pz-chip" onClick={onDuplicate}>Dupliquer</button>
        <button type="button" className="pz-chip" onClick={onDelete}>Supprimer</button>
      </div>
    </article>
  );
}
