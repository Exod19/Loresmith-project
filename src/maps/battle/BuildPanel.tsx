/**
 * Palette de construction (MJ) : terrain et forme à peindre, objets à glisser sur le plateau.
 * Le plateau lui-même gère les gestes (cf. BattleMode).
 */
import { useState } from 'react';
import { BUILD_TERRAIN, GROUPS, PROPS, SHAPES, propUrl, type Brush } from './build';

type Props = {
  brush: Brush;
  onBrush: (brush: Brush) => void;
  propVisible: boolean;
  onPropVisible: (visible: boolean) => void;
  canUndo: boolean;
  onUndo: () => void;
  onClear: () => void;
  propCount: number;
};

export default function BuildPanel({ brush, onBrush, propVisible, onPropVisible, canUndo, onUndo, onClear, propCount }: Props) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = PROPS.filter((p) => !q || p.label.toLowerCase().includes(q));
  const shape = brush.tool === 'terrain' ? brush.shape : 'pinceau';
  const hint = brush.tool === 'terrain'
    ? SHAPES.find((s) => s.id === shape)?.hint
    : 'Glisse un objet sur le plateau, ou clique une case. « Gomme » retire l’objet.';

  return (
    <section className="maps-card build-panel">
      <h3>Construction</h3>
      <p className="build-hint">{hint}</p>

      <div className="build-label">Terrain</div>
      <div className="build-grid">
        {BUILD_TERRAIN.map((t) => (
          <button
            key={t.kind} className={`build-tile ${brush.tool === 'terrain' && brush.kind === t.kind ? 'on' : ''}`}
            onClick={() => onBrush({ tool: 'terrain', kind: t.kind, shape })}
          >
            {t.label}
          </button>
        ))}
        <button
          className={`build-tile ${brush.tool === 'terrain' && brush.kind === 'gomme' ? 'on' : ''}`}
          onClick={() => onBrush({ tool: 'terrain', kind: 'gomme', shape })}
        >
          Gomme
        </button>
      </div>

      <div className="build-label">Forme</div>
      <div className="build-seg">
        {SHAPES.map((s) => (
          <button
            key={s.id} className={shape === s.id ? 'on' : ''}
            onClick={() => onBrush({ tool: 'terrain', kind: brush.tool === 'terrain' ? brush.kind : '#', shape: s.id })}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="build-label">Objets <small>({propCount} posé{propCount > 1 ? 's' : ''})</small></div>
      <input className="build-search" type="search" placeholder="Rechercher un objet…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="build-groups">
        {GROUPS.map((g) => {
          const items = shown.filter((p) => p.group === g);
          if (!items.length) return null;
          return (
            <details key={g} className="build-group" open={!!q || undefined}>
              <summary>{g} <small>({items.length})</small></summary>
              <div className="build-props">
                {items.map((p) => (
                  <button
                    key={p.key} draggable title={`${p.label} — ${p.text}`}
                    className={`build-prop ${brush.tool === 'objet' && brush.prop === p.key ? 'on' : ''}`}
                    onClick={() => onBrush({ tool: 'objet', prop: p.key })}
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', p.key); onBrush({ tool: 'objet', prop: p.key }); }}
                  >
                    <img src={propUrl(p.key)} alt="" draggable={false} />
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </details>
          );
        })}
      </div>
      <div className="build-row">
        <button className={`build-tile ${brush.tool === 'objet' && brush.prop === 'gomme' ? 'on' : ''}`} onClick={() => onBrush({ tool: 'objet', prop: 'gomme' })}>
          Gomme objets
        </button>
        <label className="build-check">
          <input type="checkbox" checked={propVisible} onChange={(e) => onPropVisible(e.target.checked)} />
          Visibles des joueurs
        </label>
      </div>

      <div className="build-row">
        <button className="maps-btn" onClick={onUndo} disabled={!canUndo}>↶ Annuler</button>
        <button className="maps-btn" onClick={onClear}>Effacer mes modifications</button>
      </div>
    </section>
  );
}
