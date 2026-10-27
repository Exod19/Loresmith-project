/**
 * Choisir une image dans les Archives de l'Underdark (fiches et lieux de l'Atlas) ou parmi les portraits
 * de créatures livrés avec la carte de combat. Les correspondances par nom sont proposées en premier.
 */
import { useMemo, useState } from 'react';
import { norm } from '../ai/loreContext';
import { CREATURE_VIGNETTES } from '../maps/battle/vignettes';
import './media.css';

export default function ArchiveImagePicker({ index = [], suggested = [], withCreatures = false, onPick, onClose }) {
  const [q, setQ] = useState('');
  const all = useMemo(() => {
    const creatures = withCreatures ? CREATURE_VIGNETTES.map((v) => ({ id: `vig:${v.id}`, src: v.src, caption: v.id.replace(/-/g, ' '), entryName: 'Portrait de créature', names: [v.id] })) : [];
    const ids = new Set(suggested.map((s) => s.id));
    return [...suggested, ...index.filter((i) => !ids.has(i.id)), ...creatures];
  }, [index, suggested, withCreatures]);
  const shown = useMemo(() => {
    const k = norm(q);
    return k ? all.filter((i) => norm(`${i.caption} ${i.entryName} ${(i.names || []).join(' ')}`).includes(k)) : all;
  }, [all, q]);
  const sugg = new Set(suggested.map((s) => s.id));

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal media-picker" onClick={(e) => e.stopPropagation()}>
        <div className="card-h">
          <h3>Images des Archives</h3>
          <button className="btn ghost sm" onClick={onClose}>
            ✕
          </button>
        </div>
        <input className="in" autoFocus placeholder="Chercher : moulasse, cité, araignée…" value={q} onChange={(e) => setQ(e.target.value)} />
        {shown.length === 0 && <p className="muted">Aucune image ne correspond.</p>}
        <div className="media-grid">
          {shown.slice(0, 160).map((img) => (
            <button key={img.id} type="button" className="media-tile" data-sugg={sugg.has(img.id) ? 1 : 0} onClick={() => onPick(img)} title={img.caption}>
              <img src={img.src} alt="" loading="lazy" />
              <span>{img.entryName}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
