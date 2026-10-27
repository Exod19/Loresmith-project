/**
 * Éléments avec lesquels les joueurs peuvent interagir, sous la carte MJ. Chacun se déplie : ce qu'on lit au joueur,
 * ce que ça fait, s'il peut le garder, le DC pour l'investiguer et les connaissances à obtenir.
 * Un élément révélé apparaît sur la carte et sur le plateau de combat.
 */
import { useState } from 'react';
import type { KnowledgeHint, MapMarker, MarkerKind } from './mapStore';

type Props = {
  markers: MapMarker[];
  onChange: (id: string, patch: Partial<MapMarker>) => void;
  onRemove: (id: string) => void;
  onAdd: (kind: MarkerKind) => void;
};

export default function Interactables({ markers, onChange, onRemove, onAdd }: Props) {
  const revealed = markers.filter((m) => m.revealed).length;
  return (
    <section className="maps-card interact">
      <div className="interact-head">
        <h3>Éléments interactifs ({revealed}/{markers.length} visibles)</h3>
        <div className="maps-enc-ctrl">
          <button className="maps-btn gold" onClick={() => onAdd('objet')}>+ Objet</button>
          <button className="maps-btn" onClick={() => onAdd('passage')}>+ Passage secret</button>
        </div>
      </div>
      {markers.length === 0 && (
        <p className="maps-sub">Rien de cliquable pour l’instant. Ajoute un objet, un passage ou une trace, puis clique sur la carte pour le placer.</p>
      )}
      {markers.map((m) => (
        <Item key={m.id} m={m} onChange={(p) => onChange(m.id, p)} onRemove={() => onRemove(m.id)} />
      ))}
    </section>
  );
}

function Item({ m, onChange, onRemove }: { m: MapMarker; onChange: (p: Partial<MapMarker>) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const knowledge = m.knowledge ?? [];
  const setKnowledge = (list: KnowledgeHint[]) => onChange({ knowledge: list });

  return (
    <details className="interact-item">
      <summary>
        <span className="interact-title">{m.kind === 'passage' ? '🗝' : '◆'} {m.title}</span>
        {m.dcInvestigate !== undefined && <span className="tag arcane">Investigation DC {m.dcInvestigate}</span>}
        <button
          className={`maps-btn ${m.revealed ? '' : 'gold'}`}
          onClick={(e) => { e.preventDefault(); onChange({ revealed: !m.revealed }); }}
        >
          {m.revealed ? '🙈 Cacher' : '👁 Révéler'}
        </button>
      </summary>

      <div className="interact-body">
        {!editing && (
          <>
            {m.reading && <blockquote className="interact-read">{m.reading}</blockquote>}
            {m.effect && <p><b>Ce que ça fait :</b> {m.effect}</p>}
            {m.keep && <p><b>Peut-on le garder ?</b> {m.keep}</p>}
            {knowledge.length > 0 && (
              <ul className="interact-know">
                {knowledge.map((k, i) => <li key={i}><b>{k.skill} DC {k.dc} :</b> {k.text}</li>)}
              </ul>
            )}
            {m.notes && <p className="maps-sub">Notes du MJ : {m.notes}</p>}
            <div className="maps-enc-ctrl">
              <button className="maps-btn" onClick={() => setEditing(true)}>Modifier</button>
              <button className="maps-btn" onClick={() => { if (window.confirm(`Supprimer « ${m.title} » ?`)) onRemove(); }}>Supprimer</button>
            </div>
          </>
        )}

        {editing && (
          <div className="maps-form">
            <input className="maps-btn" placeholder="Nom" value={m.title} onChange={(e) => onChange({ title: e.target.value })} />
            <textarea className="maps-btn" placeholder="Ce que tu lis au joueur" value={m.reading ?? ''} onChange={(e) => onChange({ reading: e.target.value })} />
            <textarea className="maps-btn" placeholder="Ce que ça fait" value={m.effect ?? ''} onChange={(e) => onChange({ effect: e.target.value })} />
            <input className="maps-btn" placeholder="Peut-on le garder ? (ex. : oui, 2 kg de cuivre)" value={m.keep ?? ''} onChange={(e) => onChange({ keep: e.target.value })} />
            <label className="maps-row">
              DC d'investigation
              <input className="maps-btn" type="number" min={1} max={30} value={m.dcInvestigate ?? ''} onChange={(e) => onChange({ dcInvestigate: e.target.value === '' ? undefined : +e.target.value })} />
            </label>
            <div className="interact-know-edit">
              <b>Connaissances</b>
              {knowledge.map((k, i) => (
                <div key={i} className="interact-know-row">
                  <input className="maps-btn" placeholder="Compétence" value={k.skill} onChange={(e) => setKnowledge(knowledge.map((x, j) => (j === i ? { ...x, skill: e.target.value } : x)))} />
                  <input className="maps-btn" type="number" min={1} max={30} value={k.dc} onChange={(e) => setKnowledge(knowledge.map((x, j) => (j === i ? { ...x, dc: +e.target.value || 1 } : x)))} />
                  <input className="maps-btn" placeholder="Ce qu'on apprend" value={k.text} onChange={(e) => setKnowledge(knowledge.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                  <button className="maps-btn" onClick={() => setKnowledge(knowledge.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
              <button className="maps-btn" onClick={() => setKnowledge([...knowledge, { skill: 'Histoire (Intelligence)', dc: 13, text: '' }])}>+ Connaissance</button>
            </div>
            <textarea className="maps-btn" placeholder="Notes du MJ (jamais montrées)" value={m.notes} onChange={(e) => onChange({ notes: e.target.value })} />
            <button className="maps-btn gold" onClick={() => setEditing(false)}>Terminer</button>
          </div>
        )}
      </div>
    </details>
  );
}
