/**
 * Plateau de la carte de combat en version compacte (page Combat, colonne de droite) : le même terrain et les mêmes
 * jetons que la carte, glisser-déposer compris, avec les alertes d'attaque d'opportunité.
 */
import { boardTheme } from './theme';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import BattleBoard, { type BoardToken } from './BattleBoard';
import type { Battle } from '../mapStore';
import { baseGridOf, fits, surfaceOf } from './placement';
import { socleOf } from './surface';
import { tokenImage } from './vignettes';
import { isOut } from './combat';
import { moveAlerts, type Note } from './tactics';

export default function MiniBattle({ battle, onBattle, selectedId, onSelect }: {
  battle: Battle;
  onBattle: (b: Battle) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const b = battle;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; cur: { x: number; y: number }; moved: boolean } | null>(null);
  const [alerts, setAlerts] = useState<Note[]>([]);

  const cellAt = (clientX: number, clientY: number) => {
    const svg = wrapRef.current?.querySelector('svg.battle-board');
    if (!(svg instanceof SVGSVGElement)) return null;
    const r = svg.getBoundingClientRect();
    const s = Math.min(r.width / b.cols, r.height / b.rows);
    const x = Math.floor((clientX - (r.left + (r.width - b.cols * s) / 2)) / s);
    const y = Math.floor((clientY - (r.top + (r.height - b.rows * s) / 2)) / s);
    return x >= 0 && y >= 0 && x < b.cols && y < b.rows ? { x, y } : null;
  };
  const tokenAt = (c: { x: number; y: number }) => [...b.tokens].reverse().find((t) => c.x >= t.x && c.x < t.x + t.size && c.y >= t.y && c.y < t.y + t.size);

  const down = (e: ReactPointerEvent) => {
    const c = cellAt(e.clientX, e.clientY);
    const t = c && tokenAt(c);
    if (!c || !t) { onSelect(null); return; }
    e.preventDefault();
    onSelect(t.id);
    setDrag({ id: t.id, dx: c.x - t.x, dy: c.y - t.y, cur: { x: t.x, y: t.y }, moved: false });
  };
  const move = (e: ReactPointerEvent) => {
    if (!drag) return;
    const c = cellAt(e.clientX, e.clientY);
    if (!c) return;
    const at = { x: c.x - drag.dx, y: c.y - drag.dy };
    if (at.x !== drag.cur.x || at.y !== drag.cur.y) setDrag({ ...drag, cur: at, moved: true });
  };
  useEffect(() => {
    if (!drag) return;
    const up = () => {
      const t = b.tokens.find((q) => q.id === drag.id);
      if (t && drag.moved && fits(b, t.id, t.size, drag.cur.x, drag.cur.y)) {
        setAlerts(moveAlerts(b, t.id, drag.cur));
        onBattle({ ...b, tokens: b.tokens.map((q) => (q.id === t.id ? { ...q, ...drag.cur } : q)) });
      }
      setDrag(null);
    };
    window.addEventListener('pointerup', up, { once: true });
    return () => window.removeEventListener('pointerup', up);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  const rules = surfaceOf(b);
  const live = drag?.moved ? moveAlerts(b, drag.id, drag.cur) : null;
  const shown = live ?? (drag ? [] : alerts);
  const tokens: BoardToken[] = b.tokens.map((t) => {
    const at = drag?.moved && drag.id === t.id ? drag.cur : t;
    return {
      id: t.id, name: t.name, kind: t.kind, x: at.x, y: at.y, size: t.size, icon: t.icon, image: tokenImage(t),
      selected: t.id === selectedId, hidden: !t.visible, active: t.id === b.turn, hp: t.hp, maxHp: t.maxHp, out: isOut(t), conditions: t.conditions,
      socle: socleOf(rules, t) ?? undefined,
    };
  });
  const selected = b.tokens.find((t) => t.id === selectedId);

  return (
    <div className="mini-battle">
      <div ref={wrapRef} className={`mini-battle-board ${drag ? 'dragging' : ''}`} onPointerDown={down} onPointerMove={move}>
        <BattleBoard cols={b.cols} rows={b.rows} terrain={baseGridOf(b)} elements={[]} ranges={[]} tokens={tokens} interactive={false} hits={b.hits} theme={boardTheme(b.local?.surface)}
          ground={b.ground} surface={{ zones: b.zones, objects: b.objects, walls: b.walls }} />
        {shown.length > 0 && (
          <div className={`battle-move-alerts ${live ? 'live' : ''}`} role="status">
            {shown.map((n, i) => <div key={i} className={`battle-move-alert tone-${n.tone}`}><b>{n.label}</b><span>{n.why}</span></div>)}
            {!live && <button className="present-info-close" onClick={() => setAlerts([])} aria-label="Fermer">×</button>}
          </div>
        )}
      </div>
      {selected && (
        <div className="mini-battle-bar">
          <span><b>{selected.name}</b> · case ({selected.x + 1}, {selected.y + 1})</span>
          <button className="btn sm" onClick={() => onBattle({ ...b, tokens: b.tokens.map((t) => (t.id === selected.id ? { ...t, visible: !t.visible } : t)) })}>
            {selected.visible ? '👁 Visible des joueurs' : '🙈 Caché aux joueurs'}
          </button>
        </div>
      )}
    </div>
  );
}
