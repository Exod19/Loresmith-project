/**
 * Fiche d'un lieu sauvage de la carte du monde (MJ) : sa teneur, son danger, le texte à lire aux joueurs, la scène ou
 * l'accroche de quête, et les gestes du MJ — garder le brouillon tel quel, le définir à sa façon, l'écarter, ou le
 * montrer aux joueurs (ce qui le garde aussi). Un lieu enregistré ne bouge plus.
 */
import { useState } from 'react';
import type { AtlasFeature } from '../atlas/types';
import type { WildRecord } from './generate';
import { DANGER_LABEL, TENEURS, WILD_KINDS, type Danger, type Teneur } from './wilds';

const BIOME: Record<string, string> = { neige: 'terres enneigées', taiga: 'taïga', tempere: 'terres tempérées', steppe: 'steppe', desert: 'désert' };

export default function WildPanel({ feature, record, draft, revealed, onSave, onReveal }: {
  feature: AtlasFeature;
  /** L'enregistrement tel qu'il serait gardé (brouillon) ou tel qu'il est (lieu enregistré). */
  record: WildRecord;
  draft: boolean;
  revealed: boolean;
  /** Enregistre le lieu (gardé, défini ou écarté). */
  onSave: (r: WildRecord) => void;
  /** Montre le lieu aux joueurs (il est gardé du même coup), ou le leur cache. */
  onReveal: (r: WildRecord) => void;
}) {
  const w = feature.wild!;
  const [edit, setEdit] = useState<WildRecord | null>(null);
  const danger = (w.danger in DANGER_LABEL ? w.danger : 'calme') as Danger;

  if (edit) {
    const set = (patch: Partial<WildRecord>) => setEdit({ ...edit, ...patch });
    const kind = WILD_KINDS.find((k) => k.id === edit.kind);
    return (
      <div className="wild-panel wild-edit">
        <h4>✦ Définir ce lieu</h4>
        <label>Nom<input className="input" value={edit.title} onChange={(e) => set({ title: e.target.value })} /></label>
        <label>Type
          <select className="input" value={edit.kind} onChange={(e) => { const k = WILD_KINDS.find((x) => x.id === e.target.value); set({ kind: e.target.value, cat: k?.cat ?? edit.cat }); }}>
            {!kind && <option value={edit.kind}>{edit.kind}</option>}
            {WILD_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </label>
        <div className="wild-row">
          <label>Teneur
            <select className="input" value={edit.teneur} onChange={(e) => set({ teneur: e.target.value as Teneur })}>
              {(Object.keys(TENEURS) as Teneur[]).map((t) => <option key={t} value={t}>{TENEURS[t]}</option>)}
            </select>
          </label>
          <label>Danger
            <select className="input" value={edit.danger} onChange={(e) => set({ danger: e.target.value })}>
              {(Object.keys(DANGER_LABEL) as Danger[]).map((d) => <option key={d} value={d}>{DANGER_LABEL[d]}</option>)}
            </select>
          </label>
        </div>
        <label>À lire aux joueurs<textarea className="input" rows={3} value={edit.text} onChange={(e) => set({ text: e.target.value })} /></label>
        {edit.teneur === 'scene' && <label>Scène<textarea className="input" rows={2} value={edit.scene ?? ''} onChange={(e) => set({ scene: e.target.value })} /></label>}
        {edit.teneur === 'quete' && <label>Accroche de quête<textarea className="input" rows={2} value={edit.hook ?? ''} onChange={(e) => set({ hook: e.target.value })} /></label>}
        <label>Notes du MJ<textarea className="input" rows={2} value={edit.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} placeholder="PNJ, trésor, lien avec la campagne…" /></label>
        <div className="maps-actions">
          <button className="maps-btn gold" onClick={() => { onSave({ ...edit, title: edit.title.trim() || record.title }); setEdit(null); }}>Enregistrer</button>
          <button className="maps-btn" onClick={() => setEdit(null)}>Annuler</button>
        </div>
      </div>
    );
  }

  return (
    <div className="wild-panel">
      <div className="wild-tags">
        <span className={`wild-tag t-${w.teneur}`}>{TENEURS[w.teneur]}</span>
        <span className={`wild-tag d-${danger}`}>{DANGER_LABEL[danger]}</span>
        {draft ? <span className="wild-tag is-draft" title="Tiré au sort : rien n'est enregistré, et les joueurs ne le voient pas">Brouillon</span> : <span className="wild-tag is-kept">Enregistré</span>}
      </div>
      <p className="maps-sub">
        {[w.where, w.biome ? BIOME[w.biome] ?? w.biome : '', typeof w.e === 'number' ? `${Math.round(w.e / 10) * 10} m` : ''].filter(Boolean).join(' · ')}
      </p>
      <div className="wild-read">
        <b>À lire aux joueurs</b>
        <p>{w.text}</p>
      </div>
      {w.scene && <div className="wild-block"><b>Scène</b><p>{w.scene}</p></div>}
      {w.hook && <div className="wild-block is-hook"><b>Accroche de quête</b><p>{w.hook}</p></div>}
      {w.notes && <div className="wild-block"><b>Notes du MJ</b><p>{w.notes}</p></div>}
      <div className="maps-actions">
        {draft && <button className="maps-btn" onClick={() => onSave(record)} title="Garder ce lieu tel quel : il est enregistré et ne bougera plus">✓ Garder</button>}
        <button className="maps-btn" onClick={() => setEdit(record)} title="Changer son nom, sa teneur, ses textes, ajouter des notes">✦ {draft ? 'Définir' : 'Modifier'}</button>
        <button className={`maps-btn ${revealed ? 'gold' : ''}`} onClick={() => onReveal(record)} title={revealed ? 'Le cacher de nouveau aux joueurs' : 'Les joueurs le découvrent : il apparaît sur leur carte (et il est gardé)'}>
          {revealed ? '🙈 Cacher aux joueurs' : '👁 Montrer aux joueurs'}
        </button>
        {draft && <button className="maps-btn" onClick={() => onSave({ ...record, excluded: true })} title="Ce lieu n'existera pas : il disparaît, même en brouillon">✕ Écarter</button>}
      </div>
    </div>
  );
}
