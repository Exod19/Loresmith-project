/**
 * Carnet du groupe (côté MJ) : symboles, bouts de papier, journaux et objets que les héros ramassent au fil de
 * l'aventure. Le MJ les prépare, note où ils se trouvent, et les remet au groupe quand il les trouve : ils apparaissent
 * alors dans le carnet de l'écran joueur, consultable pendant une énigme.
 */
import { useState } from 'react';
import { fileToCompressed } from '../media/images';
import { usePuzzles } from './context';
import { CLUE_KINDS, type Clue, type ClueKind } from './types';

const uid = () => Math.random().toString(36).slice(2, 10);
const KIND = Object.fromEntries(CLUE_KINDS.map((k) => [k.id, k]));

export default function CarnetPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="pz-modal" role="dialog" aria-label="Carnet du groupe">
      <div className="pz-modal-box wide">
        <CarnetManager onClose={onClose} />
      </div>
    </div>
  );
}

/** Le carnet, dans une fenêtre (carte de combat) ou en pleine page (section Énigmes). */
export function CarnetManager({ onClose }: { onClose?: () => void }) {
  const lib = usePuzzles();
  const [edit, setEdit] = useState<Clue | null>(null);
  if (!lib) return null;
  const held = lib.clues.filter((c) => c.held), rest = lib.clues.filter((c) => !c.held);
  const blank = (): Clue => ({ id: `indice-${uid()}`, universeId: lib.universeId, title: '', kind: 'page', text: '', held: false, createdAt: Date.now() });
  const puzzleTitle = (id?: string) => lib.puzzles.find((p) => p.id === id)?.title;
  const row = (c: Clue) => (
    <li key={c.id}>
      <span className="pz-carnet-icon" aria-hidden>{c.image ? <img src={c.image} alt="" /> : KIND[c.kind]?.glyph}</span>
      <div>
        <b>{c.title || 'Sans titre'}</b> <small className="pz-note">{KIND[c.kind]?.label}{c.puzzleId ? ` · pour « ${puzzleTitle(c.puzzleId) ?? 'énigme supprimée'} »` : ''}</small>
        {c.gmNote && <p className="pz-note">MJ : {c.gmNote}</p>}
      </div>
      <div className="pz-row pz-small">
        <button type="button" className={`pz-chip ${c.held ? 'on' : ''}`} aria-pressed={c.held} onClick={() => lib.saveClue({ ...c, held: !c.held })}>
          {c.held ? '✔ Le groupe l’a' : 'Remettre au groupe'}
        </button>
        <button type="button" className="pz-chip" onClick={() => setEdit({ ...c })}>Modifier</button>
      </div>
    </li>
  );
  return (
      <>
        <header className="pz-modal-head">
          <b>📜 Carnet du groupe</b>
          <div className="pz-row pz-small">
            <button type="button" className="pz-btn" onClick={() => setEdit(blank())}>+ Nouvel indice</button>
            {onClose && <button type="button" className="pz-btn ghost" onClick={onClose}>Fermer</button>}
          </div>
        </header>
        {edit ? <ClueForm clue={edit} onCancel={() => setEdit(null)} onSave={(c) => { lib.saveClue(c); setEdit(null); }} onDelete={lib.clues.some((c) => c.id === edit.id) ? () => { if (confirm(`Supprimer « ${edit.title} » ?`)) { lib.deleteClue(edit.id); setEdit(null); } } : undefined} /> : (
          <>
            <h3>En possession du groupe ({held.length})</h3>
            {held.length ? <ul className="pz-list">{held.map(row)}</ul> : <p className="pz-note">Rien encore. Remets un indice au groupe quand il le trouve : il apparaîtra dans son carnet.</p>}
            <h3>À trouver ({rest.length})</h3>
            {rest.length ? <ul className="pz-list">{rest.map(row)}</ul> : <p className="pz-note">Prépare ici les symboles, pages et journaux que le groupe ramassera en chemin.</p>}
          </>
        )}
      </>
  );
}

function ClueForm({ clue, onSave, onCancel, onDelete }: { clue: Clue; onSave: (c: Clue) => void; onCancel: () => void; onDelete?: () => void }) {
  const [c, setC] = useState(clue);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Clue>) => setC({ ...c, ...patch });
  return (
    <div className="pz-prep single">
      <label>Titre<input className="input" value={c.title} placeholder="Page arrachée d’un registre" onChange={(e) => set({ title: e.target.value })} /></label>
      <label>Nature
        <select className="input" value={c.kind} onChange={(e) => set({ kind: e.target.value as ClueKind })}>
          {CLUE_KINDS.map((k) => <option key={k.id} value={k.id}>{k.glyph} {k.label}</option>)}
        </select>
      </label>
      <label>Ce que lisent ou voient les joueurs<textarea className="input" rows={5} value={c.text} onChange={(e) => set({ text: e.target.value })} /></label>
      <label>Image (symbole, croquis, page dessinée)
        <input type="file" accept="image/*" disabled={busy} onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setBusy(true);
          try { set({ image: await fileToCompressed(f) }); } finally { setBusy(false); }
        }} />
      </label>
      {c.image && <div className="pz-row pz-small"><img src={c.image} alt="" className="pz-clue-preview" /><button type="button" className="pz-chip" onClick={() => set({ image: undefined })}>Retirer l’image</button></div>}
      <label>Note du MJ (où le trouver, à quoi il sert ; jamais montrée)<textarea className="input" rows={2} value={c.gmNote ?? ''} onChange={(e) => set({ gmNote: e.target.value })} /></label>
      <label className="pz-check"><input type="checkbox" checked={c.held} onChange={(e) => set({ held: e.target.checked })} /> Le groupe l’a déjà</label>
      <div className="pz-row pz-small">
        {onDelete && <button type="button" className="pz-btn ghost" onClick={onDelete}>Supprimer</button>}
        <button type="button" className="pz-btn ghost" onClick={onCancel}>Annuler</button>
        <button type="button" className="pz-btn primary" disabled={!c.title.trim() || busy} onClick={() => onSave({ ...c, title: c.title.trim() })}>Enregistrer</button>
      </div>
    </div>
  );
}
