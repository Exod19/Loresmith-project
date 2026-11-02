/**
 * Préparation du terrain de combat (MJ) : zones aux contours naturels, éléments, murs, sol du fond, et vérification des
 * règles avec une surcouche colorée (correction case par case, retour au calcul automatique).
 *
 * Gestes sur le plateau, selon l'outil :
 * - Zone : un clic par point de contrôle ; double-clic ou Entrée pour finir, Retour arrière pour retirer un point, Échap.
 * - Élément : un clic le pose (centré sur la case ; Maj pour le poser au pixel près). Un pont : clic au départ, clic à l'arrivée.
 * - Mur : un clic par sommet de la grille ; double-clic ou Entrée pour finir.
 * - Sélection : clic sur une zone, un élément ou un mur ; on glisse un élément, ou les points d'une zone pour ajuster son contour.
 * - Correction : on peint les cases (pinceau ou rectangle) ; « Auto » rend la case au calcul automatique.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { Battle } from '../mapStore';
import {
  alignDeck, CATEGORY_LABEL, categoryOf, cellLabel, OBJECT_DEF, OBJECTS, originOf, outlineOf, TERRAIN_DEF, TERRAINS, WALLS, zoneHas, zoneWidth,
  type BattleObject, type BattleWall, type Category, type CellFix, type ObjectKind, type Pt, type SurfaceRules, type TerrainId, type TerrainZone, type WallKind,
} from './surface';
import { CATEGORY_COLOR, type SurfaceView } from './SurfaceLayers';

const uid = () => Math.random().toString(36).slice(2, 10);

export type SurfaceTool =
  | { kind: 'zone'; terrain: TerrainId; shape: 'area' | 'line'; width: number }
  | { kind: 'objet'; obj: ObjectKind }
  | { kind: 'mur'; wall: WallKind }
  | { kind: 'select' }
  | { kind: 'fix'; fix: CellFix | 'auto'; rect: boolean };

type Snapshot = Pick<Battle, 'zones' | 'objects' | 'walls' | 'cellFix' | 'ground'>;
type Sel = { kind: 'zone' | 'objet' | 'mur'; id: string } | null;

const FIX_CHOICES: { label: string; fix: CellFix | 'auto'; hint: string }[] = [
  { label: 'Auto', fix: 'auto', hint: 'Rend la case au calcul automatique.' },
  { label: 'Praticable', fix: { rule: 'normal' }, hint: 'Ignore terrain et obstacles : coût normal.' },
  { label: 'Difficile', fix: { rule: 'difficile' }, hint: 'Compte double.' },
  { label: 'Bloquée', fix: { rule: 'bloquee' }, hint: 'Personne n’y entre.' },
];

const distSeg = (p: Pt, a: Pt, b: Pt) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1e-9;
  const k = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L));
  return Math.hypot(a[0] + k * dx - p[0], a[1] + k * dy - p[1]);
};
const path = (pts: Pt[], closed = false) => (pts.length ? `M${pts.map((p) => `${p[0]} ${p[1]}`).join('L')}${closed ? 'Z' : ''}` : '');

export function useSurfaceEditor({ b, set, rules, active, pointAt }: {
  b: Battle; set: (patch: Partial<Battle>) => void; rules: SurfaceRules; active: boolean;
  /** Point du plateau sous le pointeur, en cases (continu). */
  pointAt: (clientX: number, clientY: number) => Pt | null;
}) {
  const [tool, setTool] = useState<SurfaceTool | null>(null);
  const [overlay, setOverlay] = useState(false);
  const [sel, setSel] = useState<Sel>(null);
  const [draft, setDraft] = useState<Pt[]>([]);
  const [hoverPt, setHoverPt] = useState<Pt | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  /** Glisser en cours : un élément, un point de zone, ou un coup de pinceau de correction. */
  const [drag, setDrag] = useState<
    | { kind: 'objet'; id: string; dx: number; dy: number; at: Pt }
    | { kind: 'point'; id: string; index: number; at: Pt }
    | { kind: 'fix'; from: number; cells: number[] }
    | null
  >(null);
  const latest = useRef({ b, draft, tool });
  latest.current = { b, draft, tool };

  // Les gestes au clavier (Entrée) et au relâchement passent par des écouteurs : ils lisent toujours la scène à jour.
  const setRef = useRef(set);
  setRef.current = set;
  const snapshot = (): Snapshot => { const q = latest.current.b; return { zones: q.zones, objects: q.objects, walls: q.walls, cellFix: q.cellFix, ground: q.ground }; };
  const commit = (patch: Partial<Battle>) => { setHistory((h) => [...h.slice(-49), snapshot()]); setRef.current(patch); };
  const undo = () => { const prev = history[history.length - 1]; if (!prev) return; setHistory((h) => h.slice(0, -1)); set(prev); };

  const zones = b.zones ?? [], objects = b.objects ?? [], walls = b.walls ?? [];
  const cellOf = (p: Pt) => {
    const x = Math.floor(p[0]), y = Math.floor(p[1]);
    return x >= 0 && y >= 0 && x < b.cols && y < b.rows ? y * b.cols + x : null;
  };
  const vertexOf = (p: Pt): Pt => [Math.max(0, Math.min(b.cols, Math.round(p[0]))), Math.max(0, Math.min(b.rows, Math.round(p[1])))];

  const finish = () => {
    const { draft: d, tool: t } = latest.current;
    if (t?.kind === 'zone' && d.length >= (t.shape === 'area' ? 3 : 2)) {
      const z: TerrainZone = { id: uid(), terrain: t.terrain, shape: t.shape, points: d, ...(t.shape === 'line' ? { width: t.width } : {}) };
      commit({ zones: [...(latest.current.b.zones ?? []), z] });
      setSel({ kind: 'zone', id: z.id });
    }
    if (t?.kind === 'mur' && d.length >= 2) {
      const w: BattleWall = { id: uid(), kind: t.wall, points: d };
      commit({ walls: [...(latest.current.b.walls ?? []), w] });
    }
    setDraft([]);
  };

  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key === 'Enter') { e.preventDefault(); finish(); }
      else if (e.key === 'Escape' && latest.current.draft.length) { e.stopPropagation(); setDraft([]); }
      else if (e.key === 'Backspace' && latest.current.draft.length) { e.preventDefault(); setDraft((d) => d.slice(0, -1)); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); remove(sel); }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, sel]);
  // Changer d'outil abandonne le tracé en cours.
  useEffect(() => { setDraft([]); }, [tool?.kind]);
  useEffect(() => { if (!active) { setDraft([]); setDrag(null); } }, [active]);

  const cur = () => latest.current.b;
  const remove = (s: NonNullable<Sel>) => {
    if (s.kind === 'zone') commit({ zones: (cur().zones ?? []).filter((z) => z.id !== s.id) });
    if (s.kind === 'objet') commit({ objects: (cur().objects ?? []).filter((o) => o.id !== s.id) });
    if (s.kind === 'mur') commit({ walls: (cur().walls ?? []).filter((w) => w.id !== s.id) });
    setSel(null);
  };
  const patchZone = (id: string, patch: Partial<TerrainZone>) => commit({ zones: (cur().zones ?? []).map((z) => (z.id === id ? { ...z, ...patch } : z)) });
  const patchObject = (id: string, patch: Partial<BattleObject>) => commit({ objects: (cur().objects ?? []).map((o) => (o.id === id ? alignDeck({ ...o, ...patch }) : o)) });
  const patchWall = (id: string, patch: Partial<BattleWall>) => commit({ walls: (cur().walls ?? []).map((w) => (w.id === id ? { ...w, ...patch } : w)) });

  /** Ce qui est sous le pointeur : élément, mur, puis zone (la plus prioritaire). */
  const pickAt = (p: Pt): Sel => {
    const o = [...objects].reverse().find((q) => Math.hypot(q.x - p[0], q.y - p[1]) <= Math.max(0.35, OBJECT_DEF[q.kind]?.deck ? 0.6 : (OBJECT_DEF[q.kind]?.radius ?? 0.4)));
    if (o) return { kind: 'objet', id: o.id };
    const w = walls.find((q) => q.points.some((a, i) => i > 0 && distSeg(p, q.points[i - 1], a) < 0.25));
    if (w) return { kind: 'mur', id: w.id };
    const z = [...zones].sort((a, c) => (c.priority ?? TERRAIN_DEF[c.terrain].priority) - (a.priority ?? TERRAIN_DEF[a.terrain].priority)).find((q) => zoneHas(q, p[0], p[1]));
    return z ? { kind: 'zone', id: z.id } : null;
  };

  const onDown = (e: ReactPointerEvent): boolean => {
    if (!active || e.button !== 0) return false;
    const p = pointAt(e.clientX, e.clientY);
    if (!p) return false;
    e.preventDefault();
    if (!tool) {
      // Sans outil, la surcouche sert à inspecter une case.
      if (overlay) setFocus(cellOf(p));
      return overlay;
    }
    if (tool.kind === 'zone') { setDraft((d) => [...d, [Math.round(p[0] * 4) / 4, Math.round(p[1] * 4) / 4]]); return true; }
    if (tool.kind === 'mur') {
      const v = vertexOf(p);
      setDraft((d) => (d.length && d[d.length - 1][0] === v[0] && d[d.length - 1][1] === v[1] ? d : [...d, v]));
      return true;
    }
    if (tool.kind === 'objet') {
      const def = OBJECT_DEF[tool.obj];
      const snap: Pt = e.shiftKey ? p : [Math.floor(p[0]) + 0.5, Math.floor(p[1]) + 0.5];
      if (def.deck) {
        // Pont : premier clic au départ, second à l'arrivée (de centre de case en centre de case).
        if (!draft.length) { setDraft([snap]); return true; }
        const a = draft[0], dx = snap[0] - a[0], dy = snap[1] - a[1];
        const len = Math.max(1, Math.round(Math.hypot(dx, dy)) + 1);
        const o: BattleObject = alignDeck({ id: uid(), kind: tool.obj, x: (a[0] + snap[0]) / 2, y: (a[1] + snap[1]) / 2, rot: Math.round((Math.atan2(dy, dx) * 180) / Math.PI), len, wid: def.wid });
        commit({ objects: [...objects, o] });
        setSel({ kind: 'objet', id: o.id });
        setDraft([]);
        return true;
      }
      const o: BattleObject = { id: uid(), kind: tool.obj, x: snap[0], y: snap[1] };
      commit({ objects: [...objects, o] });
      return true;
    }
    if (tool.kind === 'fix') {
      const c = cellOf(p);
      if (c !== null) { setDrag({ kind: 'fix', from: c, cells: [c] }); setFocus(c); }
      return true;
    }
    // Sélection : un point de la zone choisie, sinon ce qui est sous le pointeur.
    if (sel?.kind === 'zone') {
      const z = zones.find((q) => q.id === sel.id);
      const index = z ? z.points.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.3) : -1;
      if (z && index >= 0) { setDrag({ kind: 'point', id: z.id, index, at: z.points[index] }); return true; }
    }
    const hit = pickAt(p);
    setSel(hit);
    if (hit?.kind === 'objet') {
      const o = objects.find((q) => q.id === hit.id)!;
      setDrag({ kind: 'objet', id: o.id, dx: o.x - p[0], dy: o.y - p[1], at: [o.x, o.y] });
    }
    return true;
  };

  const onMove = (e: ReactPointerEvent): boolean => {
    if (!active) return false;
    const p = pointAt(e.clientX, e.clientY);
    setHoverPt(p);
    if (!p || !drag) return !!tool || overlay;
    if (drag.kind === 'objet') {
      const snap: Pt = e.shiftKey ? [p[0] + drag.dx, p[1] + drag.dy] : [Math.floor(p[0]) + 0.5, Math.floor(p[1]) + 0.5];
      const o = objects.find((q) => q.id === drag.id);
      setDrag({ ...drag, at: o && OBJECT_DEF[o.kind]?.deck ? [Math.round((p[0] + drag.dx) * 2) / 2, Math.round((p[1] + drag.dy) * 2) / 2] : snap });
    } else if (drag.kind === 'point') {
      setDrag({ ...drag, at: [Math.round(p[0] * 4) / 4, Math.round(p[1] * 4) / 4] });
    } else if (drag.kind === 'fix') {
      const c = cellOf(p);
      if (c === null) return true;
      if (tool?.kind === 'fix' && tool.rect) {
        const ax = drag.from % b.cols, ay = Math.floor(drag.from / b.cols), bx = c % b.cols, by = Math.floor(c / b.cols);
        const cells: number[] = [];
        for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) cells.push(y * b.cols + x);
        setDrag({ ...drag, cells });
      } else if (!drag.cells.includes(c)) setDrag({ ...drag, cells: [...drag.cells, c] });
    }
    return true;
  };

  // Fin du glisser : on valide l'élément déplacé, le point de zone, ou la correction peinte.
  useEffect(() => {
    if (!drag) return;
    const up = () => {
      if (drag.kind === 'objet') { const o = objects.find((q) => q.id === drag.id); if (o && (o.x !== drag.at[0] || o.y !== drag.at[1])) patchObject(drag.id, { x: drag.at[0], y: drag.at[1] }); }
      if (drag.kind === 'point') {
        const z = zones.find((q) => q.id === drag.id);
        if (z) patchZone(z.id, { points: z.points.map((q, i) => (i === drag.index ? drag.at : q)) });
      }
      if (drag.kind === 'fix' && tool?.kind === 'fix') {
        const fixes = { ...(b.cellFix ?? {}) };
        for (const c of drag.cells) { if (tool.fix === 'auto') delete fixes[c]; else fixes[c] = { ...tool.fix }; }
        commit({ cellFix: fixes });
      }
      setDrag(null);
    };
    window.addEventListener('pointerup', up, { once: true });
    return () => window.removeEventListener('pointerup', up);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  const onDouble = () => { if (active && (tool?.kind === 'zone' || tool?.kind === 'mur')) finish(); };

  // Vue du terrain avec le glisser en cours (l'élément ou le point suit le pointeur avant d'être validé).
  const view: SurfaceView = {
    zones: drag?.kind === 'point' ? zones.map((z) => (z.id === drag.id ? { ...z, points: z.points.map((q, i) => (i === drag.index ? drag.at : q)) } : z)) : zones,
    objects: drag?.kind === 'objet' ? objects.map((o) => (o.id === drag.id ? { ...o, x: drag.at[0], y: drag.at[1] } : o)) : objects,
    walls,
  };

  // Tracé en cours, poignées de la zone choisie, cases peintes.
  const selZone = sel?.kind === 'zone' ? view.zones?.find((z) => z.id === sel.id) : undefined;
  const live = hoverPt && (tool?.kind === 'zone' || tool?.kind === 'mur' || (tool?.kind === 'objet' && OBJECT_DEF[tool.obj].deck && draft.length))
    ? [...draft, tool?.kind === 'mur' ? vertexOf(hoverPt) : hoverPt] as Pt[] : draft;
  const draftNode: ReactNode = active ? (
    <g className="surface-draft" pointerEvents="none">
      {tool?.kind === 'zone' && live.length >= 2 && (() => {
        const z: TerrainZone = { id: 'draft', terrain: tool.terrain, shape: tool.shape, points: live, width: tool.width };
        const o = outlineOf(z);
        return tool.shape === 'area'
          ? <path d={path(o, true)} fill={TERRAIN_DEF[tool.terrain].color} fillOpacity={0.35} stroke="#ecd289" strokeWidth={0.05} strokeDasharray="0.15 0.1" />
          : <path d={path(o)} fill="none" stroke={TERRAIN_DEF[tool.terrain].color} strokeOpacity={0.5} strokeWidth={zoneWidth(z)} strokeLinecap="round" strokeLinejoin="round" />;
      })()}
      {tool?.kind === 'mur' && live.length >= 2 && <path d={path(live)} fill="none" stroke="#ecd289" strokeWidth={0.14} strokeDasharray="0.2 0.1" />}
      {tool?.kind === 'objet' && live.length === 2 && <path d={path(live)} fill="none" stroke="#ecd289" strokeWidth={(OBJECT_DEF[tool.obj].wid ?? 1) * 0.9} strokeOpacity={0.35} />}
      {draft.map((q, i) => <circle key={i} cx={q[0]} cy={q[1]} r={0.1} fill="#ecd289" stroke="#0b0906" strokeWidth={0.03} />)}
      {selZone && (
        <>
          <path d={selZone.shape === 'area' ? path(outlineOf(selZone), true) : path(outlineOf(selZone))} fill="none" stroke="#ecd289" strokeWidth={0.06} strokeDasharray="0.14 0.08" />
          {selZone.points.map((q, i) => <circle key={i} cx={q[0]} cy={q[1]} r={0.16} fill="#0b0906" stroke="#ecd289" strokeWidth={0.05} />)}
        </>
      )}
      {drag?.kind === 'fix' && drag.cells.map((c) => <rect key={c} x={c % b.cols + 0.05} y={Math.floor(c / b.cols) + 0.05} width={0.9} height={0.9} fill="none" stroke="#ecd289" strokeWidth={0.06} />)}
    </g>
  ) : null;

  // Fiche de la case inspectée (ou survolée) : terrain, propriétés, origine.
  const showCell = overlay || tool?.kind === 'fix';
  const hoverCell = hoverPt ? cellOf(hoverPt) : null;
  const cellIndex = focus ?? (showCell ? hoverCell : null);
  const c = cellIndex !== null ? rules.cells[cellIndex] : undefined;
  const cellCard: ReactNode = showCell && c && cellIndex !== null ? (
    <div className="surface-cellcard" role="status">
      <b>Case ({cellIndex % b.cols + 1}, {Math.floor(cellIndex / b.cols) + 1})</b>
      <span className="surface-cat" style={{ background: CATEGORY_COLOR[categoryOf(c)] }}>{CATEGORY_LABEL[categoryOf(c)]}</span>
      <span>{cellLabel(c)}</span>
      {c.deck && <span>Pont au-dessus : on y passe à pied, l’eau reste dessous.</span>}
      {c.elev ? <span>Élévation : {c.elev} pieds</span> : null}
      <span className="maps-sub">Origine : {originOf(c, zones)}{c.obs ? ` · élément « ${OBJECT_DEF[c.obs.kind].label} »` : ''}</span>
      {c.amb && <span className="surface-amb">⚠ {c.amb}</span>}
      {focus !== null && <button className="maps-link" onClick={() => setFocus(null)}>Fermer</button>}
    </div>
  ) : null;

  const ambiguous = rules.cells.flatMap((q, i) => (q.amb ? [i] : []));
  const counts = rules.cells.reduce((m, q) => { m[categoryOf(q)]++; return m; }, { normal: 0, difficile: 0, special: 0, bloquee: 0, danger: 0 } as Record<Category, number>);

  const selObject = sel?.kind === 'objet' ? objects.find((o) => o.id === sel.id) : undefined;
  const selWall = sel?.kind === 'mur' ? walls.find((w) => w.id === sel.id) : undefined;
  const zoneSel = sel?.kind === 'zone' ? zones.find((z) => z.id === sel.id) : undefined;
  const walkable = TERRAINS.filter((t) => t.mode === 'marche' && !t.danger && t.id !== 'pont' && t.id !== 'gue');
  const groups = [...new Set(TERRAINS.map((t) => t.group))];
  const zoneTool = tool?.kind === 'zone' ? tool : null;

  const hint = !tool ? (overlay ? 'Clique une case pour voir son terrain, ses propriétés et l’origine de sa classification.' : 'Choisis un outil.')
    : tool.kind === 'zone' ? 'Un clic par point · double-clic ou Entrée pour finir · Retour arrière retire le dernier point · Échap annule.'
    : tool.kind === 'mur' ? 'Un clic par sommet de la grille · double-clic ou Entrée pour finir.'
    : tool.kind === 'objet' ? (OBJECT_DEF[tool.obj].deck ? 'Clic au départ du pont, puis clic à l’arrivée.' : 'Clic pour poser (au centre de la case ; Maj : au point près).')
    : tool.kind === 'fix' ? 'Peins les cases à corriger (glisser). « Auto » rend la case au calcul automatique.'
    : 'Clic sur une zone, un élément ou un mur. Glisse un élément ; glisse les points d’une zone pour ajuster son contour.';

  const panel = (
    <section className="maps-card surface-panel">
      <h3>Terrain de la scène</h3>
      <p className="build-hint">{hint}</p>

      <div className="surface-row">
        <label className="surface-field">Sol du fond
          <select value={b.ground ?? 'sol'} onChange={(e) => commit({ ground: e.target.value === 'sol' ? undefined : e.target.value as TerrainId })}>
            {walkable.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <button className={`maps-btn ${overlay ? 'gold' : ''}`} onClick={() => { setOverlay((v) => !v); setFocus(null); }} title="Surcouche de vérification : jamais montrée aux joueurs">
          {overlay ? '✓ Vérification' : '◩ Vérifier le terrain'}
        </button>
      </div>

      <div className="build-label">Outils</div>
      <div className="build-seg surface-tools">
        <button className={tool?.kind === 'select' ? 'on' : ''} onClick={() => setTool(tool?.kind === 'select' ? null : { kind: 'select' })}>☝ Sélection</button>
        <button className={tool?.kind === 'zone' ? 'on' : ''} onClick={() => setTool(zoneTool ? null : { kind: 'zone', terrain: 'eau_profonde', shape: 'line', width: 2 })}>〰 Zone</button>
        <button className={tool?.kind === 'objet' ? 'on' : ''} onClick={() => setTool(tool?.kind === 'objet' ? null : { kind: 'objet', obj: 'rocher' })}>🪨 Élément</button>
        <button className={tool?.kind === 'mur' ? 'on' : ''} onClick={() => setTool(tool?.kind === 'mur' ? null : { kind: 'mur', wall: 'mur' })}>▬ Mur</button>
        <button className={tool?.kind === 'fix' ? 'on' : ''} onClick={() => { setTool(tool?.kind === 'fix' ? null : { kind: 'fix', fix: { rule: 'bloquee' }, rect: false }); setOverlay(true); }}>✎ Corriger</button>
      </div>

      {zoneTool && (
        <div className="surface-sub">
          <div className="build-seg">
            <button className={zoneTool.shape === 'line' ? 'on' : ''} onClick={() => setTool({ ...zoneTool, shape: 'line' })}>Tracé (rivière, chemin)</button>
            <button className={zoneTool.shape === 'area' ? 'on' : ''} onClick={() => setTool({ ...zoneTool, shape: 'area' })}>Contour (lac, mare)</button>
          </div>
          {zoneTool.shape === 'line' && (
            <label className="surface-field">Largeur : {zoneTool.width} case{zoneTool.width > 1 ? 's' : ''}
              <input type="range" min={0.5} max={6} step={0.5} value={zoneTool.width} onChange={(e) => setTool({ ...zoneTool, width: Number(e.target.value) })} />
            </label>
          )}
          <TerrainPicker value={zoneTool.terrain} groups={groups} onPick={(t) => setTool({ ...zoneTool, terrain: t })} />
        </div>
      )}

      {tool?.kind === 'objet' && (
        <div className="surface-sub surface-objs">
          {OBJECTS.map((o) => (
            <button key={o.kind} className={`build-tile ${tool.obj === o.kind ? 'on' : ''}`} title={o.text} onClick={() => setTool({ kind: 'objet', obj: o.kind })}>
              {o.label}<small>{o.deck ? 'surface' : o.collision === 'bloquant' ? 'bloquant' : o.collision === 'partiel' ? 'partiel' : 'décor'}</small>
            </button>
          ))}
        </div>
      )}

      {tool?.kind === 'mur' && (
        <div className="surface-sub build-seg">
          {WALLS.map((w) => <button key={w.kind} className={tool.wall === w.kind ? 'on' : ''} title={w.text} onClick={() => setTool({ kind: 'mur', wall: w.kind })}>{w.label}</button>)}
        </div>
      )}

      {tool?.kind === 'fix' && (
        <div className="surface-sub">
          <div className="build-seg">
            {FIX_CHOICES.map((f) => (
              <button key={f.label} title={f.hint} className={JSON.stringify(tool.fix) === JSON.stringify(f.fix) ? 'on' : ''} onClick={() => setTool({ ...tool, fix: f.fix })}>{f.label}</button>
            ))}
          </div>
          <label className="build-check"><input type="checkbox" checked={tool.rect} onChange={(e) => setTool({ ...tool, rect: e.target.checked })} /> Rectangle</label>
          <details>
            <summary className="maps-sub">Imposer un terrain</summary>
            <TerrainPicker value={typeof tool.fix === 'object' ? tool.fix.t : undefined} groups={groups} onPick={(t) => setTool({ ...tool, fix: { t } })} />
          </details>
        </div>
      )}

      {zoneSel && (
        <div className="surface-sel">
          <b>{zoneSel.label || TERRAIN_DEF[zoneSel.terrain].label}</b> <span className="maps-sub">({zoneSel.shape === 'area' ? 'contour' : 'tracé'}, {zoneSel.points.length} points)</span>
          <label className="surface-field">Nom <input value={zoneSel.label ?? ''} placeholder={TERRAIN_DEF[zoneSel.terrain].label} onChange={(e) => patchZone(zoneSel.id, { label: e.target.value || undefined })} /></label>
          <label className="surface-field">Terrain
            <select value={zoneSel.terrain} onChange={(e) => patchZone(zoneSel.id, { terrain: e.target.value as TerrainId })}>
              {TERRAINS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          {zoneSel.shape === 'line' && (
            <label className="surface-field">Largeur : {zoneWidth(zoneSel)}
              <input type="range" min={0.5} max={6} step={0.5} value={zoneWidth(zoneSel)} onChange={(e) => patchZone(zoneSel.id, { width: Number(e.target.value) })} />
            </label>
          )}
          <label className="surface-field">Priorité <input type="number" value={zoneSel.priority ?? TERRAIN_DEF[zoneSel.terrain].priority} onChange={(e) => patchZone(zoneSel.id, { priority: Number(e.target.value) })} /></label>
          <label className="surface-field">Élévation (pieds) <input type="number" step={5} value={zoneSel.elevation ?? 0} onChange={(e) => patchZone(zoneSel.id, { elevation: Number(e.target.value) || undefined })} /></label>
          <p className="maps-sub">Glisse ses points sur le plateau pour ajuster le contour.</p>
          <button className="maps-btn" onClick={() => remove(sel!)}>Supprimer la zone</button>
        </div>
      )}
      {selObject && (
        <div className="surface-sel">
          <b>{OBJECT_DEF[selObject.kind].label}</b> <span className="maps-sub">{OBJECT_DEF[selObject.kind].text}</span>
          {OBJECT_DEF[selObject.kind].deck && (
            <>
              <label className="surface-field">Longueur : {selObject.len ?? OBJECT_DEF[selObject.kind].len}<input type="range" min={1} max={12} value={selObject.len ?? OBJECT_DEF[selObject.kind].len} onChange={(e) => patchObject(selObject.id, { len: Number(e.target.value) })} /></label>
              <label className="surface-field">Largeur : {selObject.wid ?? OBJECT_DEF[selObject.kind].wid}<input type="range" min={1} max={4} value={selObject.wid ?? OBJECT_DEF[selObject.kind].wid} onChange={(e) => patchObject(selObject.id, { wid: Number(e.target.value) })} /></label>
            </>
          )}
          <label className="surface-field">Orientation : {selObject.rot ?? 0}°<input type="range" min={-180} max={180} step={15} value={selObject.rot ?? 0} onChange={(e) => patchObject(selObject.id, { rot: Number(e.target.value) })} /></label>
          <label className="build-check"><input type="checkbox" checked={!selObject.hidden} onChange={(e) => patchObject(selObject.id, { hidden: !e.target.checked })} /> Visible des joueurs</label>
          <button className="maps-btn" onClick={() => remove(sel!)}>Retirer</button>
        </div>
      )}
      {selWall && (
        <div className="surface-sel">
          <b>{WALLS.find((w) => w.kind === selWall.kind)?.label}</b>
          <div className="build-seg">{WALLS.map((w) => <button key={w.kind} className={selWall.kind === w.kind ? 'on' : ''} onClick={() => patchWall(selWall.id, { kind: w.kind })}>{w.label}</button>)}</div>
          {(selWall.kind === 'porte' || selWall.kind === 'herse') && (
            <>
              <label className="surface-field">Nom <input value={selWall.label ?? ''} placeholder={selWall.kind === 'porte' ? 'Porte' : 'Herse'} onChange={(e) => patchWall(selWall.id, { label: e.target.value || undefined })} /></label>
              <label className="build-check"><input type="checkbox" checked={!!selWall.open} onChange={(e) => patchWall(selWall.id, { open: e.target.checked })} /> {selWall.kind === 'porte' ? 'Ouverte' : 'Levée'}</label>
            </>
          )}
          <button className="maps-btn" onClick={() => remove(sel!)}>Retirer</button>
        </div>
      )}

      {overlay && (
        <div className="surface-legend">
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((k) => (
            <span key={k}><i style={{ background: CATEGORY_COLOR[k] }} />{CATEGORY_LABEL[k]} <small>({counts[k]})</small></span>
          ))}
          <span><i className="dash" />Bordure à vérifier <small>({ambiguous.length})</small></span>
          <span><i className="deck" />Pont (surface au-dessus)</span>
          {ambiguous.length > 0 && (
            <button className="maps-btn" onClick={() => { const i = ambiguous.indexOf(focus ?? -1); setFocus(ambiguous[(i + 1) % ambiguous.length]); }}>
              Case à vérifier suivante ({ambiguous.length})
            </button>
          )}
          <p className="maps-sub">Une bordure trompeuse se corrige à la case (outil Corriger) ou en déplaçant les points de la zone. Les murs : rouge (mur), bleu (falaise), ambre (muret).</p>
        </div>
      )}

      <div className="build-row">
        <button className="maps-btn" onClick={undo} disabled={!history.length}>↶ Annuler</button>
        {b.cellFix && Object.keys(b.cellFix).length > 0 && (
          <button className="maps-btn" onClick={() => { if (window.confirm('Rendre toutes les cases corrigées au calcul automatique ?')) commit({ cellFix: undefined }); }}>
            Retirer les {Object.keys(b.cellFix).length} corrections
          </button>
        )}
      </div>
    </section>
  );

  return { tool, overlay, focus, view, draft: draftNode, panel, cellCard, selectedId: sel?.id ?? null, onDown, onMove, onDouble, busy: !!tool || overlay };
}

function TerrainPicker({ value, groups, onPick }: { value?: TerrainId; groups: string[]; onPick: (t: TerrainId) => void }) {
  return (
    <div className="surface-terrains">
      {groups.map((g) => (
        <div key={g}>
          <div className="build-label">{g}</div>
          <div className="surface-swatches">
            {TERRAINS.filter((t) => t.group === g).map((t) => (
              <button key={t.id} className={`surface-swatch ${value === t.id ? 'on' : ''}`} onClick={() => onPick(t.id)} title={cellLabel({ t: t.id, src: 'zone', elev: 0 })}>
                <span style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/combat-map/${t.tex})`, backgroundColor: t.color }} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
