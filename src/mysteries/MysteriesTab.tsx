/**
 * Liste des mystères de l'univers (section Énigmes) : leur campagne, leur état, la couverture de leurs verrous.
 */
import { useState } from 'react';
import { usePuzzles } from '../puzzles/context';
import ArcEditor, { READINESS_LABEL, type CampaignLike } from './ArcEditor';
import { arcStats, blankArc, coverageOf } from './planner';
import type { MysteryArc, SceneRef } from './types';

/** « 1 fait », « 2 faits ». */
const n = (k: number, w: string) => `${k} ${w}${k > 1 ? 's' : ''}`;
const STATUS: Record<MysteryArc['status'], string> = { draft: 'brouillon', verified: 'vérifié', scheduled: 'programmé', running: 'en cours', resolved: 'résolu', abandoned: 'abandonné' };

export default function MysteriesTab({ campaigns }: { campaigns: CampaignLike[] }) {
  const lib = usePuzzles();
  const [open, setOpen] = useState<MysteryArc | null>(null);
  if (!lib) return null;
  if (open) return <ArcEditor arc={open} campaigns={campaigns} onClose={() => setOpen(null)} />;
  const create = () => { const a = blankArc(lib.universeId, campaigns[0]?.id); lib.saveMystery(a); setOpen(a); };
  const scenesOf = (a: MysteryArc): SceneRef[] => (campaigns.find((c) => c.id === a.campaignId)?.scenes ?? []).map((s) => ({ id: s.id, title: s.title, played: !!s.played }));
  return (
    <>
      <p className="pz-lead" style={{ marginTop: 10 }}>Un mystère relie un verrou aux faits qu’il faut connaître, aux indices qui les enseignent et aux scènes où les trouver. LoreSmith sème, surveille ce qui est vu ou manqué, et t’aide à reporter une information avant qu’elle ne manque.</p>
      <div className="pz-lib-tools">
        <button type="button" className="pz-btn primary" onClick={create}>+ Nouveau mystère</button>
        {!campaigns.length && <small className="pz-note">Crée d’abord une campagne avec des scènes (Préparation → Campagnes).</small>}
      </div>
      {lib.mysteries.length === 0 ? <p className="pz-note">Aucun mystère pour l’instant.</p> : (
        <div className="pz-lib-grid">
          {lib.mysteries.map((a) => {
            const camp = campaigns.find((c) => c.id === a.campaignId);
            const st = arcStats(a);
            return (
              <article key={a.id} className="pz-lib-card">
                <div className="pz-row" style={{ justifyContent: 'space-between' }}>
                  <small className="pz-note">{camp ? (camp.title ?? camp.name) : 'sans campagne'}</small>
                  <small className={`pz-status ${a.status === 'draft' ? 'brouillon' : 'prete'}`}>{STATUS[a.status]}</small>
                </div>
                <h3>{a.title}</h3>
                {a.synopsis && <p>{a.synopsis}</p>}
                <p className="pz-note">{n(a.knowledgeAtoms.length, 'fait')} · {n(a.clueDesigns.length, 'support')} · {n(st.prevus + st.vus + st.pris, 'indice')} en jeu · {st.pris} pris · {n(st.manques, 'manqué')} · {n(st.reportes, 'reporté')}</p>
                {a.gates.map((g) => { const c = coverageOf(a, g, scenesOf(a)); return <p key={g.id} className="pz-note"><span className={`ms-ready r-${c.status}`}>{READINESS_LABEL[c.status]}</span> 🔒 {g.title}</p>; })}
                <div className="pz-row pz-small">
                  <button type="button" className="pz-chip on" onClick={() => setOpen(a)}>Ouvrir</button>
                  <button type="button" className="pz-chip" onClick={() => { if (confirm(`Supprimer « ${a.title} » et son historique ?`)) lib.deleteMystery(a.id); }}>Supprimer</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
