/**
 * Carte de combat, côté MJ : même mise en page que la carte de navigation (zone centrale + panneau latéral),
 * avec le plateau sur grille à la place du plan. Le lieu choisi donne la zone locale : ses passages (tracés réels
 * de l'Atlas) et ses objets y sont à leur position. Chaque passage mène quelque part : « Suivre le chemin »
 * ramène sur la carte de navigation, à la destination.
 */
import { useEffect, useState } from 'react';
import BattleBoard, { type BoardElement, type BoardRange, type BoardToken } from './BattleBoard';
import { STATS, type Stat } from '../atlas/statblocks';
import type { AtlasData, AtlasMap } from '../atlas/types';
import { DEFAULT_BATTLE, type Battle, type BattleToken, type MapMarker, type MapRecord, type PassageLink } from '../mapStore';
import { blocksCell, effectiveGrid, generateTerrain, pathCost, seedOf, TERRAIN, type LocationHint, type TerrainKind } from './terrain';
import { buildLocalMap, cellIn } from './local';
import { attackCells, reachableCells, speedCells } from './ranges';
import { iconFor, placeEncounter, type EncounterGroup } from './encounter';
import './battle.css';

const uid = () => Math.random().toString(36).slice(2, 10);
const KIND_LABEL: Record<BattleToken['kind'], string> = { pc: 'Joueur', monster: 'Créature', other: 'Autre' };
const SRD = Object.values(STATS).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
/** Types de terrain qui méritent une ligne dans la légende (la roche et le sol sont évidents). */
const LEGEND_ORDER: TerrainKind[] = ['.', '#', 'p', '~', ':', '=', 'X', 'I', ','];
const SWATCH: Partial<Record<TerrainKind, string>> = { '.': 'floor', '#': 'rock', '~': 'water', ':': 'rubble', p: 'pass', '=': 'bridge', X: 'chasm', I: 'pillar', ',': 'decor' };

/** Nombre entier lu au début d'un texte (« 16 (armure d’écailles) » → 16). */
const leadingInt = (s: string) => { const n = parseInt(s, 10); return Number.isFinite(n) ? n : undefined; };

/** Vitesse « 7,5 m » → cases de 5 pieds (1 m ≈ 3,28 pieds). */
function speedInCells(speed: string) {
  const m = parseFloat(speed.replace(',', '.'));
  return Number.isFinite(m) ? Math.round((m * 3.28084) / 5) : undefined;
}

/** Redimensionne une image importée en vignette carrée (pour le jeton). */
function fileToTokenImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = 96;
      const c = document.createElement('canvas');
      c.width = s; c.height = s;
      const k = Math.max(s / img.naturalWidth, s / img.naturalHeight);
      const w = img.naturalWidth * k, h = img.naturalHeight * k;
      c.getContext('2d')!.drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible.')); };
    img.src = url;
  });
}

type Box = { x: number; y: number; size: number };

/** Distance entre deux jetons (centres), selon la règle 5e : la diagonale compte comme une case droite. */
export function feetBetween(a: Box, b: Box, feetPerCell: number) {
  const ca = a.x + (a.size - 1) / 2, cb = b.x + (b.size - 1) / 2;
  const da = a.y + (a.size - 1) / 2, db = b.y + (b.size - 1) / 2;
  const cells = Math.round(Math.max(Math.abs(ca - cb), Math.abs(da - db)));
  return { cells, feet: cells * feetPerCell };
}

/** Terrain effectif : passages creusés, passages secrets fermés tant qu'ils ne sont pas découverts. */
function effectiveOf(b: Battle): string | undefined {
  if (!b.terrain) return undefined;
  const local = b.local;
  return effectiveGrid(b.terrain.grid, local?.elements ?? [], local?.discovered ?? [], (local?.elements ?? []).map((e) => e.id));
}

/** Le jeton peut-il occuper ce coin sans chevaucher un autre jeton, un obstacle, ni sortir du plateau ? */
function fits(b: Battle, id: string | null, size: number, x: number, y: number) {
  if (x < 0 || y < 0 || x + size > b.cols || y + size > b.rows) return false;
  const grid = effectiveOf(b);
  for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) if (blocksCell(grid, b.cols, x + dx, y + dy)) return false;
  return !b.tokens.some((t) => t.id !== id && t.x < x + size && x < t.x + t.size && t.y < y + size && y < t.y + t.size);
}

function firstFree(b: Battle, size: 1 | 2): { x: number; y: number } | null {
  for (let y = 0; y < b.rows; y++) for (let x = 0; x < b.cols; x++) if (fits(b, null, size, x, y)) return { x, y };
  return null;
}

export default function BattleMode({ rec, battle, onBattle, context, atlas, plan, markers, onFollow, onLink, onMarker, onReveal }: {
  rec: MapRecord; battle: Battle; onBattle: (b: Battle) => void;
  /** Lieu sélectionné : sa zone locale est placée sur la grille à l'ouverture ; une rencontre y place ses créatures. */
  context: (LocationHint & { id: string; groups?: EncounterGroup[] }) | null;
  atlas: AtlasData | undefined; plan: AtlasMap | undefined; markers: MapMarker[];
  onFollow: (link: PassageLink) => void;
  onLink: (passageId: string, link: PassageLink | null) => void;
  onMarker: (id: string, patch: Partial<MapMarker>) => void;
  /** Révèle ou cache un passage pour les joueurs : même interrupteur que sur la carte de navigation. */
  onReveal: (featureId: string) => void;
}) {
  const b = battle ?? DEFAULT_BATTLE;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<BattleToken['kind']>('monster');
  const [statId, setStatId] = useState('');
  const [image, setImage] = useState<string | undefined>();
  const [groupBy, setGroupBy] = useState<'destination' | 'orientation'>('destination');
  /** Portées affichées sur le plateau : réservé au MJ, jamais envoyé aux joueurs. */
  const [showRanges, setShowRanges] = useState(false);

  const selected = b.tokens.find((t) => t.id === selectedId) ?? null;
  const set = (patch: Partial<Battle>) => onBattle({ ...b, ...patch });
  // Une seule source de vérité : les éléments révélés de la fiche (« Montrer aux joueurs »).
  const discovered = rec.overlay?.revealed ?? [];
  const bv: Battle = b.local ? { ...b, local: { ...b.local, discovered } } : b;
  const grid = effectiveOf(bv);

  /**
   * Construit la carte du lieu : terrain, passages et objets à leur place. Une rencontre place aussi ses créatures,
   * groupées (caravane) ou dispersées (mineurs) selon leur rôle. `n` change la disposition du terrain (« Régénérer »).
   */
  const generate = (hint: LocationHint, source: string, n: number, groups?: EncounterGroup[]) => {
    const seed = (seedOf(source) + n * 2654435761) >>> 0;
    if (!(atlas && plan)) {
      set({ terrain: { source, seed, grid: generateTerrain(b.cols, b.rows, hint, seed) }, local: undefined });
      return;
    }
    const local = buildLocalMap({ atlas, plan, markers, centerId: source, cols: b.cols, rows: b.rows, hint, seed });
    const previous = b.local?.source === source ? b.local.discovered : [];
    const ids = local.elements.map((e) => e.id);
    const ground = effectiveGrid(local.base, local.elements, [], ids);
    let tokens = b.tokens;
    if (groups?.length) {
      const kept = b.tokens.filter((t) => t.kind !== 'monster');
      const free = (x: number, y: number, size: 1 | 2) =>
        x >= 0 && y >= 0 && x + size <= b.cols && y + size <= b.rows
        && !Array.from({ length: size * size }).some((_, i) => blocksCell(ground, b.cols, x + (i % size), y + Math.floor(i / size)))
        && !kept.some((t) => t.x < x + size && x < t.x + t.size && t.y < y + size && y < t.y + t.size);
      tokens = [...kept, ...placeEncounter(groups, b.cols, b.rows, free, seed)];
    }
    set({
      terrain: { source, seed, grid: local.base },
      local: { source, planId: plan.id, window: local.window, elements: local.elements, discovered: previous },
      tokens,
      encounterOf: groups?.length ? source : b.encounterOf,
    });
  };

  useEffect(() => {
    if (!context) return;
    const placed = !context.groups?.length || b.encounterOf === context.id;
    if (b.local?.source === context.id && placed) return;
    generate(context, context.id, 0, context.groups);
    // Seul le changement de lieu déclenche la génération ; le reste se fait à la main.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context?.id]);

  const patchToken = (id: string, patch: Partial<BattleToken>) => set({ tokens: b.tokens.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const adjustHp = (t: BattleToken, delta: number) => {
    if (t.hp === undefined) return;
    patchToken(t.id, { hp: Math.max(0, Math.min(t.maxHp ?? t.hp, t.hp + delta)) });
  };

  /** Révèle ou cache un passage secret du tracé de l'Atlas (partagé avec la carte de navigation). */
  const toggleDiscovered = (id: string) => onReveal(id);

  function addToken() {
    const st: Stat | undefined = statId ? STATS[statId] : undefined;
    const size: 1 | 2 = st && /taille (G|TG)/.test(st.meta) ? 2 : 1;
    const spot = firstFree(bv, size);
    if (!spot) return; // plateau plein
    const hp = st ? leadingInt(st.hp) : undefined;
    const token: BattleToken = {
      id: uid(), name: name.trim() || st?.name || 'Jeton', kind, x: spot.x, y: spot.y, size,
      // Les créatures sont cachées jusqu'à ce que le MJ les révèle.
      visible: kind !== 'monster', hp, maxHp: hp, ac: st ? leadingInt(st.ac) : undefined, statId: st ? statId : undefined,
      icon: iconFor(kind, st), image,
    };
    set({ tokens: [...b.tokens, token] });
    setName(''); setStatId(''); setImage(undefined);
    setSelectedId(token.id);
  }

  function moveTo(x: number, y: number) {
    if (!selected) { setSelectedId(null); return; }
    if (fits(bv, selected.id, selected.size, x, y)) patchToken(selected.id, { x, y });
  }

  // Passages : tracés réels de l'Atlas, et portes posées par le MJ sur ce plan. Chacun mène quelque part.
  const passages: { id: string; title: string; secret: boolean; found: boolean; dc?: number; checkLabel?: string; auto?: PassageLink; marker?: MapMarker; cells: number[] }[] = [
    ...(b.local?.elements ?? []).filter((e) => e.kind === 'passage').map((e) => ({
      id: e.id, title: e.title, secret: e.secret, found: discovered.includes(e.id), dc: e.dc, checkLabel: e.checkLabel, auto: e.auto, cells: e.cells ?? [],
    })),
    ...markers.filter((m) => m.kind === 'passage' && m.planId === plan?.id).map((m) => ({
      id: `mk-${m.id}`, title: m.title, secret: true, found: m.revealed, dc: m.dcInvestigate ?? 14, checkLabel: 'Investigation', marker: m, cells: [],
    })),
  ];
  const linkOf = (id: string) => rec.overlay?.passageLinks?.[id] ?? passages.find((p) => p.id === id)?.auto;

  // Destinations proposées : ancres de l'Atlas, et éléments interactifs de cet univers.
  const anchorOptions = (atlas?.anchors ?? []).map((a) => {
    const mapTitle = atlas?.maps.find((m) => m.id === a.mapId)?.title ?? a.mapId;
    return { value: `anchor:${a.id}`, label: `${a.label} · ${mapTitle}`, link: { kind: 'anchor' as const, id: a.id, planId: a.mapId, label: `${a.label} · ${mapTitle}` } };
  });
  const markerOptions = markers.filter((m) => m.kind === 'objet' || m.kind === 'repere').map((m) => ({
    value: `marker:${m.id}`, label: `${m.title} (élément)`, link: { kind: 'marker' as const, id: m.id, planId: m.planId, label: m.title },
  }));
  const options = [...anchorOptions, ...markerOptions];

  // Éléments du plateau : passages (tracés) et objets (repères) ; les éléments cachés sont en pointillés pour le MJ.
  const boardElements: BoardElement[] = [
    ...(b.local?.elements ?? []).filter((e) => e.kind === 'passage').map((e) => ({
      id: e.id, kind: 'passage' as const, title: e.title, category: e.category, cells: e.cells,
      ghost: e.secret && !discovered.includes(e.id), dc: e.dc,
    })),
    ...(b.local?.window && plan
      ? markers.filter((m) => m.planId === plan.id && (m.kind === 'objet' || m.kind === 'passage' || m.kind === 'repere')).flatMap((m) => {
        const cell = cellIn(b.local!.window, b.cols, b.rows, m.x, m.y);
        return cell === undefined ? [] : [{
          id: `mk-${m.id}`, kind: 'point' as const, title: m.title, category: m.kind === 'passage' ? 'voie' : 'indetermine',
          cell, ghost: !m.revealed, dc: m.dcInvestigate,
        }];
      })
      : []),
  ];

  // Regroupement de la liste : par destination, ou par direction depuis le centre du plateau.
  const groupBy_ = groupBy;
  const center = { x: b.cols / 2, y: b.rows / 2 };
  const DIRS = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest'];
  const directionOf = (cells: number[]) => {
    if (!cells.length) return 'Autre';
    const mx = cells.reduce((t, i) => t + (i % b.cols), 0) / cells.length;
    const my = cells.reduce((t, i) => t + Math.floor(i / b.cols), 0) / cells.length;
    const angle = (Math.atan2(mx - center.x, -(my - center.y)) * 180) / Math.PI;
    return DIRS[Math.round((((angle % 360) + 360) % 360) / 45) % 8];
  };
  const groups = new Map<string, typeof passages>();
  for (const p of passages) {
    const key = groupBy_ === 'orientation'
      ? directionOf(p.cells)
      : linkOf(p.id)?.label ?? 'Destination non inscrite';
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }

  // Portées : déplacement (cases atteignables, terrain compté) et anneau d'attaque, pour chaque créature et chaque joueur.
  const statOf = (t: BattleToken) => (t.statId ? STATS[t.statId] : undefined);
  const rangeOf = (t: BattleToken): BoardRange => ({
    id: t.id, x: t.x, y: t.y, size: t.size,
    move: reachableCells(grid, b.cols, b.rows, t, speedCells(statOf(t))),
    attack: attackCells(statOf(t)), selected: t.id === selectedId,
  });
  const ranges: BoardRange[] = showRanges ? b.tokens.map(rangeOf) : [];

  const boardTokens: BoardToken[] = b.tokens.map((t) => ({
    id: t.id, name: t.name, kind: t.kind, x: t.x, y: t.y, size: t.size, icon: t.icon, image: t.image,
    selected: t.id === selectedId, hidden: !t.visible,
  }));

  const readout = selected && hover ? feetBetween(selected, { ...hover, size: 1 }, b.feetPerCell) : null;
  const walk = selected && hover ? pathCost(grid, b.cols, b.rows, selected, hover) : null;
  const hoverKind = hover && grid ? TERRAIN[grid[hover.y * b.cols + hover.x] as keyof typeof TERRAIN]?.label : null;
  const stat = selected?.statId ? STATS[selected.statId] : undefined;
  // Légende : seulement les terrains réellement présents sur ce plateau.
  const present = new Set<string>(grid ? Array.from(grid) : []);

  return (
    <div className="maps-body">
      <div className="maps-canvas battle-canvas">
        <div className="battle-bar">
          <span className="battle-round">Round {b.round}</span>
          {context && <span className="battle-place">{context.title}</span>}
          <button className="maps-btn gold" onClick={() => set({ round: b.round + 1 })}>Round suivant</button>
          <button className="maps-btn" onClick={() => { if (window.confirm('Retirer tous les jetons du plateau ?')) set({ tokens: [], round: 1 }); }}>Vider le plateau</button>
          {b.terrain && (
            <button className="maps-btn" title="Propose une autre disposition de terrain pour le même lieu" onClick={() => generate(context ?? { title: 'Caverne' }, b.terrain!.source, (b.terrain!.seed & 0xff) + 1, undefined)}>
              ↻ Régénérer le terrain
            </button>
          )}
          {b.terrain && <button className="maps-btn" onClick={() => set({ terrain: undefined, local: undefined, encounterOf: undefined })}>Terrain vierge</button>}
          {!b.terrain && <button className="maps-btn" onClick={() => generate(context ?? { title: 'Caverne' }, context?.id ?? 'caverne', 0)}>Générer un terrain</button>}
          <button className={`maps-btn ${showRanges ? 'gold' : ''}`} title="Afficher les déplacements et les portées d'attaque (MJ seulement)" onClick={() => setShowRanges((v) => !v)}>
            ◎ Portées
          </button>
          <span className="battle-hint">
            {selected ? `Clique une case pour déplacer ${selected.name}.` : 'Clique un jeton pour le sélectionner.'}
          </span>
        </div>
        <div className="battle-board-wrap">
          <BattleBoard
            cols={b.cols} rows={b.rows} backdrop={rec.image} terrain={grid} elements={boardElements} ranges={ranges} tokens={boardTokens} interactive
            onToken={setSelectedId} onCell={moveTo} onHover={(x, y) => setHover({ x, y })}
          />
          {readout && (
            <div className="battle-readout">
              {walk === null ? 'Chemin coupé' : <>{walk * b.feetPerCell} pieds de déplacement</>}
              {walk !== null && <span className="battle-sub"> · {readout.feet} à vol d'oiseau</span>}
              {hoverKind && <span className="battle-sub"> · {hoverKind}</span>}
            </div>
          )}
        </div>
      </div>

      <aside className="maps-panel battle-side">
        {passages.length > 0 && (
          <section className="maps-card battle-secrets">
            <div className="battle-group-head">
              <h3>Passages ({passages.length})</h3>
              <select className="maps-btn" value={groupBy} onChange={(e) => setGroupBy(e.target.value as 'destination' | 'orientation')}>
                <option value="destination">Par destination</option>
                <option value="orientation">Par orientation</option>
              </select>
            </div>
            {[...groups.entries()].map(([name, items]) => (
              <details key={name} className="battle-group">
                <summary>{name} <small>({items.length})</small></summary>
                <ul className="battle-list">
                  {items.map((p) => {
                    const link = linkOf(p.id);
                    const current = rec.overlay?.passageLinks?.[p.id];
                    const value = current ? `${current.kind}:${current.id}` : '';
                    return (
                      <li key={p.id} data-on={p.found ? 1 : 0} className="battle-passage">
                        <span className="battle-name">{p.secret ? (p.found ? '🔓' : '🔒') : '⇢'} {p.title}</span>
                        {p.secret && <small>DC {p.dc} · {p.checkLabel}</small>}
                        {p.secret && (
                          <button className={`maps-btn ${p.found ? '' : 'gold'}`} onClick={() => (p.marker ? onMarker(p.marker.id, { revealed: !p.found }) : toggleDiscovered(p.id))}>
                            {p.found ? 'Recacher' : 'Découvert'}
                          </button>
                        )}
                        <div className="battle-dest">
                          {link
                            ? <><span>→ {link.label}</span> <button className="maps-btn gold" onClick={() => onFollow(link)}>Suivre le chemin</button></>
                            : <span className="battle-missing">Destination non inscrite</span>}
                          <select className="maps-btn" value={value} onChange={(e) => {
                            const opt = options.find((o) => o.value === e.target.value);
                            onLink(p.id, opt ? opt.link : null);
                          }}>
                            <option value="">{link && !current ? 'Destination de l’Atlas' : 'Changer la destination…'}</option>
                            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </details>
            ))}
          </section>
        )}

        <section className="maps-card">
          <h3>Ajouter un jeton</h3>
          <div className="maps-form">
            <select className="maps-btn" value={statId} onChange={(e) => { setStatId(e.target.value); if (e.target.value) setKind('monster'); }}>
              <option value="">Sans fiche (saisie libre)</option>
              {SRD.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input className="maps-btn" placeholder={stat?.name ?? 'Nom'} value={name} onChange={(e) => setName(e.target.value)} />
            <select className="maps-btn" value={kind} onChange={(e) => setKind(e.target.value as BattleToken['kind'])}>
              {(Object.keys(KIND_LABEL) as BattleToken['kind'][]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
            <label className="battle-file">
              Image du jeton (facultatif)
              <input type="file" accept="image/*" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setImage(await fileToTokenImage(f).catch(() => undefined));
              }} />
            </label>
            {image && <img className="battle-thumb" src={image} alt="" />}
            <button className="maps-btn gold" onClick={addToken}>Placer sur le plateau</button>
          </div>
        </section>

        <section className="maps-card">
          <h3>Jetons ({b.tokens.length})</h3>
          {b.tokens.length === 0 && <p className="maps-sub">Aucun jeton. Ajoute les joueurs et les créatures, ou lance une rencontre depuis la carte.</p>}
          <ul className="battle-list">
            {b.tokens.map((t) => (
              <li key={t.id} data-on={t.id === selectedId ? 1 : 0}>
                <button className="maps-link" onClick={() => setSelectedId(t.id)}>{t.icon ?? '◆'} {t.name}</button>
                <small>{KIND_LABEL[t.kind]}{t.hp !== undefined ? ` · ${t.hp}/${t.maxHp} PV` : ''}</small>
                <button className="maps-btn" title={t.visible ? 'Visible des joueurs' : 'Caché des joueurs'} onClick={() => patchToken(t.id, { visible: !t.visible })}>
                  {t.visible ? '👁' : '🙈'}
                </button>
                {t.hp !== undefined && (
                  <span className="battle-hp">
                    {[-5, -1, 1, 5].map((d) => <button key={d} className="maps-btn" onClick={() => adjustHp(t, d)}>{d > 0 ? `+${d}` : d}</button>)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {selected && (
          <section className="maps-card battle-sheet">
            <h3>{selected.name}</h3>
            {selected.ac !== undefined && <p>CA <b>{selected.ac}</b>{selected.hp !== undefined && <> · PV <b>{selected.hp}/{selected.maxHp}</b></>}</p>}
            <p className="maps-sub">Déplacement : {speedCells(stat)} cases ({speedCells(stat) * b.feetPerCell} pieds) · Attaque : {attackCells(stat)} case{attackCells(stat) > 1 ? 's' : ''}</p>
            {stat && (
              <>
                <p className="maps-sub">Vitesse {stat.speed}{speedInCells(stat.speed) !== undefined && ` (≈ ${speedInCells(stat.speed)} cases par tour)`}</p>
                <p className="maps-sub">Actions : {stat.actions.map(([n]) => n.split(' (')[0]).join(' · ')}</p>
              </>
            )}
            <h4>Distances</h4>
            <ul className="battle-dist">
              {b.tokens.filter((t) => t.id !== selected.id).map((t) => (
                <li key={t.id}>{t.name} : {feetBetween(selected, t, b.feetPerCell).feet} pieds</li>
              ))}
            </ul>
            <button className="maps-btn" onClick={() => { if (window.confirm(`Retirer ${selected.name} ?`)) { set({ tokens: b.tokens.filter((t) => t.id !== selected.id) }); setSelectedId(null); } }}>
              Retirer du plateau
            </button>
          </section>
        )}

        {grid && (
          <section className="maps-card battle-legend">
            <h3>Légende</h3>
            <ul>
              {LEGEND_ORDER.filter((k) => present.has(k)).map((k) => (
                <li key={k}><span className={`battle-swatch k-${SWATCH[k]}`} />{TERRAIN[k].label}</li>
              ))}
              {passages.some((p) => p.secret && !p.found) && (
                <li><span className="battle-swatch k-secret" />Passage secret, fermé (contour pointillé)</li>
              )}
              {boardElements.some((e) => e.ghost && e.kind === 'point') && (
                <li><span className="battle-icon">?</span>Élément caché : visible du MJ seulement</li>
              )}
            </ul>
            <p className="maps-sub">Le déplacement suit le chemin réel : contourner les obstacles, et compter le terrain difficile (eau, éboulis) pour le double.</p>
          </section>
        )}

        <section className="maps-card battle-rules">
          <h3>Rappels D&amp;D 5e</h3>
          <ul>
            <li>Une case = 5 pieds (1,5 m). Une diagonale compte comme une case droite.</li>
            <li>Corps à corps : atteint à 1 case (5 pieds).</li>
            <li>Vitesse ÷ 5 = cases par tour ; l'action Se précipiter double le déplacement.</li>
            <li>Couvert : à moitié +2 CA, aux trois quarts +5 CA, total : impossible à viser directement.</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
