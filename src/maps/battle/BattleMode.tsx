/**
 * Carte de combat, côté MJ : même mise en page que la carte de navigation (zone centrale + panneau latéral),
 * avec le plateau sur grille à la place du plan. Le lieu choisi donne la zone locale : ses passages et ses lieux
 * sont placés à leur position réelle. Les passages secrets se découvrent un à un, chacun avec son DC.
 */
import { useEffect, useState } from 'react';
import BattleBoard, { CATEGORY_ICON, type BoardElement, type BoardToken } from './BattleBoard';
import { STATS, type Stat } from '../atlas/statblocks';
import type { AtlasData, AtlasMap } from '../atlas/types';
import { DEFAULT_BATTLE, type Battle, type BattleToken, type MapMarker, type MapRecord } from '../mapStore';
import { blocksCell, effectiveGrid, generateTerrain, pathCost, seedOf, TERRAIN, type LocationHint } from './terrain';
import { buildLocalMap } from './local';
import './battle.css';

const uid = () => Math.random().toString(36).slice(2, 10);
const KIND_LABEL: Record<BattleToken['kind'], string> = { pc: 'Joueur', monster: 'Créature', other: 'Autre' };
const SRD = Object.values(STATS).sort((a, b) => a.name.localeCompare(b.name, 'fr'));

/** Nombre entier lu au début d'un texte (« 16 (armure d’écailles) » → 16). */
const leadingInt = (s: string) => { const n = parseInt(s, 10); return Number.isFinite(n) ? n : undefined; };

/** Vitesse « 7,5 m » → cases de 5 pieds (1 m ≈ 3,28 pieds). */
function speedInCells(speed: string) {
  const m = parseFloat(speed.replace(',', '.'));
  return Number.isFinite(m) ? Math.round((m * 3.28084) / 5) : undefined;
}

/** Icône d'une créature d'après le type de sa fiche (humanoïde, bête, mort-vivant…). */
function iconFor(kind: BattleToken['kind'], stat?: Stat) {
  if (kind === 'pc') return '🧝';
  if (!stat) return kind === 'monster' ? '👹' : '✨';
  const m = stat.meta.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/mort-vivant/.test(m)) return '💀';
  if (/bete/.test(m)) return '🐺';
  if (/elementaire/.test(m)) return '🔥';
  if (/monstruosite/.test(m)) return '👾';
  if (/aberration/.test(m)) return '🐙';
  if (/plante/.test(m)) return '🌿';
  if (/fielon|celeste/.test(m)) return '😈';
  if (/vase/.test(m)) return '🟢';
  if (/humanoide/.test(m)) return '🧌';
  return '👹';
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

/** Terrain effectif : passages creusés, passages secrets fermés tant qu'ils ne sont pas découverts. */
function effectiveOf(b: Battle): string | undefined {
  if (!b.terrain) return undefined;
  const local = b.local;
  return effectiveGrid(b.terrain.grid, local?.elements ?? [], local?.discovered ?? [], (local?.elements ?? []).map((e) => e.id));
}

export default function BattleMode({ rec, battle, onBattle, context, atlas, plan, markers }: {
  rec: MapRecord; battle: Battle; onBattle: (b: Battle) => void;
  /** Lieu sélectionné : sa zone locale est placée sur la grille à l'ouverture. */
  context: (LocationHint & { id: string }) | null;
  atlas: AtlasData | undefined; plan: AtlasMap | undefined; markers: MapMarker[];
}) {
  const b = battle ?? DEFAULT_BATTLE;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<BattleToken['kind']>('monster');
  const [statId, setStatId] = useState('');
  const [image, setImage] = useState<string | undefined>();

  const selected = b.tokens.find((t) => t.id === selectedId) ?? null;
  const set = (patch: Partial<Battle>) => onBattle({ ...b, ...patch });
  const grid = effectiveOf(b);

  /**
   * Construit la carte du lieu : terrain (texture de base), passages et lieux de l'Atlas à leur place.
   * `n` change la disposition du terrain sans toucher aux éléments (« Régénérer »).
   */
  const generate = (hint: LocationHint, source: string, n: number) => {
    const seed = (seedOf(source) + n * 2654435761) >>> 0;
    if (atlas && plan) {
      const local = buildLocalMap({ atlas, plan, markers, centerId: source, cols: b.cols, rows: b.rows, hint, seed });
      const previous = b.local?.source === source ? b.local.discovered : [];
      set({
        terrain: { source, seed, grid: local.base },
        local: { source, window: local.window, elements: local.elements, discovered: previous },
      });
    } else {
      set({ terrain: { source, seed, grid: generateTerrain(b.cols, b.rows, hint, seed) }, local: undefined });
    }
  };
  useEffect(() => {
    if (!context || b.local?.source === context.id) return;
    generate(context, context.id, 0);
    // Seul le changement de lieu déclenche la génération ; le reste se fait à la main.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context?.id]);

  const patchToken = (id: string, patch: Partial<BattleToken>) => set({ tokens: b.tokens.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const adjustHp = (t: BattleToken, delta: number) => {
    if (t.hp === undefined) return;
    patchToken(t.id, { hp: Math.max(0, Math.min(t.maxHp ?? t.hp, t.hp + delta)) });
  };

  /** Découvre ou recache un élément secret (passage, porte). */
  const toggleDiscovered = (id: string) => {
    if (!b.local) return;
    const discovered = b.local.discovered.includes(id)
      ? b.local.discovered.filter((x) => x !== id)
      : [...b.local.discovered, id];
    set({ local: { ...b.local, discovered } });
  };

  function addToken() {
    const st: Stat | undefined = statId ? STATS[statId] : undefined;
    const size: 1 | 2 = st && /taille (G|TG)/.test(st.meta) ? 2 : 1;
    const spot = firstFree(b, size);
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
    if (fits(b, selected.id, selected.size, x, y)) patchToken(selected.id, { x, y });
  }

  const boardTokens: BoardToken[] = b.tokens.map((t) => ({
    id: t.id, name: t.name, kind: t.kind, x: t.x, y: t.y, size: t.size, icon: t.icon, image: t.image,
    selected: t.id === selectedId, hidden: !t.visible,
  }));

  // Éléments du plateau : le MJ voit les secrets non découverts (en pointillés, avec leur DC).
  const discovered = b.local?.discovered ?? [];
  const boardElements: BoardElement[] = (b.local?.elements ?? []).map((e) => ({
    id: e.id, kind: e.kind, title: e.title, category: e.category, cell: e.cell, cells: e.cells,
    ghost: e.secret && !discovered.includes(e.id), dc: e.dc,
  }));

  const readout = selected && hover ? feetBetween(selected, { ...hover, size: 1 }, b.feetPerCell) : null;
  const walk = selected && hover ? pathCost(grid, b.cols, b.rows, selected, hover) : null;
  const hoverKind = hover && grid ? TERRAIN[grid[hover.y * b.cols + hover.x] as keyof typeof TERRAIN]?.label : null;
  const stat = selected?.statId ? STATS[selected.statId] : undefined;
  const secrets = (b.local?.elements ?? []).filter((e) => e.secret);
  const others = (b.local?.elements ?? []).filter((e) => !e.secret);

  return (
    <div className="maps-body">
      <div className="maps-canvas battle-canvas">
        <div className="battle-bar">
          <span className="battle-round">Round {b.round}</span>
          {context && <span className="battle-place">{context.title}</span>}
          <button className="maps-btn gold" onClick={() => set({ round: b.round + 1 })}>Round suivant</button>
          <button className="maps-btn" onClick={() => { if (window.confirm('Retirer tous les jetons du plateau ?')) set({ tokens: [], round: 1 }); }}>Vider le plateau</button>
          {b.terrain && (
            <button className="maps-btn" title="Propose une autre disposition de terrain pour le même lieu" onClick={() => generate(context ?? { title: 'Caverne' }, b.terrain!.source, (b.terrain!.seed & 0xff) + 1)}>
              ↻ Régénérer le terrain
            </button>
          )}
          {b.terrain && <button className="maps-btn" onClick={() => set({ terrain: undefined, local: undefined })}>Terrain vierge</button>}
          {!b.terrain && <button className="maps-btn" onClick={() => generate(context ?? { title: 'Caverne' }, context?.id ?? 'caverne', 0)}>Générer un terrain</button>}
          <span className="battle-hint">
            {selected ? `Clique une case pour déplacer ${selected.name}.` : 'Clique un jeton pour le sélectionner.'}
          </span>
        </div>
        <div className="battle-board-wrap">
          <BattleBoard
            cols={b.cols} rows={b.rows} backdrop={rec.image} terrain={grid} elements={boardElements} tokens={boardTokens} interactive
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
        {secrets.length > 0 && (
          <section className="maps-card battle-secrets">
            <h3>Secrets à découvrir ({discovered.filter((id) => secrets.some((s) => s.id === id)).length}/{secrets.length})</h3>
            <ul className="battle-list">
              {secrets.map((e) => {
                const found = discovered.includes(e.id);
                return (
                  <li key={e.id} data-on={found ? 1 : 0}>
                    <span className="battle-name">{found ? '🔓' : '🔒'} {e.title}</span>
                    <small>DC {e.dc} · {e.checkLabel}</small>
                    <button className={`maps-btn ${found ? '' : 'gold'}`} onClick={() => toggleDiscovered(e.id)}>
                      {found ? 'Recacher' : 'Découvert'}
                    </button>
                  </li>
                );
              })}
            </ul>
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
          {b.tokens.length === 0 && <p className="maps-sub">Aucun jeton. Ajoute les joueurs et les créatures.</p>}
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

        {b.local && others.length > 0 && (
          <section className="maps-card battle-legend">
            <h3>Dans la zone</h3>
            <ul>
              {others.map((e) => (
                <li key={e.id}><span className="battle-icon">{e.kind === 'passage' ? '⇢' : CATEGORY_ICON[e.category] ?? '◆'}</span>{e.title}</li>
              ))}
            </ul>
          </section>
        )}

        {b.terrain && (
          <section className="maps-card battle-legend">
            <h3>Terrain</h3>
            <ul>
              {(Object.keys(TERRAIN) as (keyof typeof TERRAIN)[]).filter((k) => k !== '.').map((k) => (
                <li key={k}><span className={`battle-swatch k-${k === '#' ? 'rock' : k === 'X' ? 'chasm' : k === '~' ? 'water' : k === ':' ? 'rubble' : k === '=' ? 'bridge' : k === 'I' ? 'pillar' : k === 'p' ? 'pass' : 'decor'}`} />{TERRAIN[k].label}</li>
              ))}
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
