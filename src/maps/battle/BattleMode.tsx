/**
 * Combat sur grille, côté MJ : plateau interactif, jetons, distances en pieds et aide aux règles D&D 5e.
 * L'écran joueur montre le même plateau en lecture seule (cf. playerBoard.ts) : jetons visibles, sans points de vie.
 */
import { useState } from 'react';
import BattleBoard, { type BoardToken } from './BattleBoard';
import { STATS, type Stat } from '../atlas/statblocks';
import { DEFAULT_BATTLE, type Battle, type BattleToken, type MapRecord } from '../mapStore';
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

type Box = { x: number; y: number; size: number };

/** Distance entre deux jetons (centres), selon la règle 5e : la diagonale compte comme une case droite. */
export function feetBetween(a: Box, b: Box, feetPerCell: number) {
  const ca = a.x + (a.size - 1) / 2, cb = b.x + (b.size - 1) / 2;
  const da = a.y + (a.size - 1) / 2, db = b.y + (b.size - 1) / 2;
  const cells = Math.round(Math.max(Math.abs(ca - cb), Math.abs(da - db)));
  return { cells, feet: cells * feetPerCell };
}

/** Le jeton peut-il occuper ce coin sans chevaucher un autre jeton ni sortir du plateau ? */
function fits(b: Battle, id: string | null, size: number, x: number, y: number) {
  if (x < 0 || y < 0 || x + size > b.cols || y + size > b.rows) return false;
  return !b.tokens.some((t) => t.id !== id && t.x < x + size && x < t.x + t.size && t.y < y + size && y < t.y + t.size);
}

function firstFree(b: Battle, size: 1 | 2): { x: number; y: number } | null {
  for (let y = 0; y < b.rows; y++) for (let x = 0; x < b.cols; x++) if (fits(b, null, size, x, y)) return { x, y };
  return null;
}

export default function BattleMode({ rec, battle, onBattle }: { rec: MapRecord; battle: Battle; onBattle: (b: Battle) => void }) {
  const b = battle ?? DEFAULT_BATTLE;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<BattleToken['kind']>('monster');
  const [statId, setStatId] = useState('');

  const selected = b.tokens.find((t) => t.id === selectedId) ?? null;
  const set = (patch: Partial<Battle>) => onBattle({ ...b, ...patch });
  const patchToken = (id: string, patch: Partial<BattleToken>) => set({ tokens: b.tokens.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const adjustHp = (t: BattleToken, delta: number) => {
    if (t.hp === undefined) return;
    patchToken(t.id, { hp: Math.max(0, Math.min(t.maxHp ?? t.hp, t.hp + delta)) });
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
    };
    set({ tokens: [...b.tokens, token] });
    setName(''); setStatId('');
    setSelectedId(token.id);
  }

  function moveTo(x: number, y: number) {
    if (!selected) { setSelectedId(null); return; }
    if (fits(b, selected.id, selected.size, x, y)) patchToken(selected.id, { x, y });
  }

  const boardTokens: BoardToken[] = b.tokens.map((t) => ({
    id: t.id, name: t.name, kind: t.kind, x: t.x, y: t.y, size: t.size,
    selected: t.id === selectedId, hidden: !t.visible,
  }));
  const readout = selected && hover ? feetBetween(selected, { ...hover, size: 1 }, b.feetPerCell) : null;
  const stat = selected?.statId ? STATS[selected.statId] : undefined;

  return (
    <div className="battle-mode">
      <div className="battle-bar">
        <span className="battle-round">Round {b.round}</span>
        <button className="maps-btn gold" onClick={() => set({ round: b.round + 1 })}>Round suivant</button>
        <button className="maps-btn" onClick={() => { if (window.confirm('Retirer tous les jetons du plateau ?')) set({ tokens: [], round: 1 }); }}>Vider le plateau</button>
        <span className="battle-hint">
          {selected ? `Clique une case pour déplacer ${selected.name}.` : 'Clique un jeton pour le sélectionner.'}
        </span>
      </div>

      <div className="battle-body">
        <div className="battle-board-wrap">
          <BattleBoard
            cols={b.cols} rows={b.rows} backdrop={rec.image} tokens={boardTokens} interactive
            onToken={setSelectedId} onCell={moveTo} onHover={(x, y) => setHover({ x, y })}
          />
          {readout && <div className="battle-readout">{readout.feet} pieds · {readout.cells} case{readout.cells > 1 ? 's' : ''}</div>}
        </div>

        <aside className="battle-side">
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
              <button className="maps-btn gold" onClick={addToken}>Placer sur le plateau</button>
            </div>
          </section>

          <section className="maps-card">
            <h3>Jetons ({b.tokens.length})</h3>
            {b.tokens.length === 0 && <p className="maps-sub">Aucun jeton. Ajoute les joueurs et les créatures.</p>}
            <ul className="battle-list">
              {b.tokens.map((t) => (
                <li key={t.id} data-on={t.id === selectedId ? 1 : 0}>
                  <button className="maps-link" onClick={() => setSelectedId(t.id)}>{t.name}</button>
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
    </div>
  );
}
