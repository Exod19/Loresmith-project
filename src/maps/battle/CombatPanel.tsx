/**
 * Combat, dans le panneau de la carte de combat : initiative, tour courant, PV, états, attaques à lancer,
 * journal des jets, et conseils tactiques (calculés sur le plateau, ou demandés à l'IA).
 */
import { revealIn } from '../../shell/reveal';
import { useEffect, useRef, useState } from 'react';
import { STATS } from '../atlas/statblocks';
import type { Battle, BattleToken } from '../mapStore';
import { askAI, aiReady } from '../../ai/client';
import {
  advanceBattle, attacksOf, combatBrief, CONDITIONS, critical, initiativeOrder, initModOf, isOut, paceHints, passiveOfToken,
  roll, sightFor, sightOf, statOf, turnHints, type Attack, type Hint,
} from './combat';
import { passiveOf } from '../atlas/trails';
import { speedCells } from './ranges';
import { tokenImage } from './vignettes';
import { iconFor } from './encounter';
import type { BestiaryRef } from '../CampaignGuide';

/** Personnage du groupe (fiche de l'application) : seuls les champs utiles au combat. */
export type Hero = {
  id: string; name: string; hp?: number | string; maxHp?: number | string; ac?: number | string;
  str?: number | string; dex?: number | string; con?: number | string; int?: number | string; wis?: number | string; cha?: number | string;
  /** Bonus de Perception au-delà de la Sagesse (maîtrise, talents). */
  perceptionBonus?: number | string;
  cls?: string; race?: string; level?: number | string;
};

type Props = {
  b: Battle;
  grid?: string;
  place?: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  set: (patch: Partial<Battle>) => void;
  heroes: Hero[];
  /** Fiches de PNJ & Créatures : elles arrivent avec leur jeton, leurs PV et leur CA. */
  bestiary?: BestiaryRef[];
  /** Pose des jetons sur les premières cases libres. */
  onPlace: (tokens: Omit<BattleToken, 'x' | 'y'>[]) => void;
  onRemove: (id: string) => void;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const SRD = Object.values(STATS).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
const KIND_LABEL: Record<BattleToken['kind'], string> = { pc: 'Joueur', monster: 'Créature', other: 'Autre' };
const TONE_ICON: Record<Hint['tone'], string> = { move: '➜', attack: '⚔', power: '✦', warn: '!', story: '❝' };
const leadingInt = (s: string | number | undefined) => { const n = parseInt(String(s ?? ''), 10); return Number.isFinite(n) ? n : undefined; };
const signed = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);

export default function CombatPanel({ b, grid, place, selectedId, onSelect, set, heroes, bestiary = [], onPlace, onRemove }: Props) {
  const [amount, setAmount] = useState<Record<string, string>>({});
  const [last, setLast] = useState<{ from: string; dmg: number; label: string; reach: number } | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const [ai, setAi] = useState<{ busy: boolean; text?: string; error?: string }>({ busy: false });
  const [addStat, setAddStat] = useState('');
  const [addCount, setAddCount] = useState(1);
  const [addName, setAddName] = useState('');

  const order = initiativeOrder(b.tokens);
  const active = b.tokens.find((t) => t.id === b.turn) ?? null;
  const selected = b.tokens.find((t) => t.id === selectedId) ?? null;
  const patch = (id: string, p: Partial<BattleToken>) => set({ tokens: b.tokens.map((t) => (t.id === id ? { ...t, ...p } : t)) });
  const log = (text: string, tone?: 'hit' | 'miss' | 'crit' | 'info') => [{ id: uid(), text, tone }, ...(b.log ?? [])].slice(0, 30);

  /** Initiative : d20 + Dextérité pour chaque créature qui n'en a pas (et les joueurs si demandé). */
  function rollInitiative(all: boolean) {
    const lines: string[] = [];
    const tokens = b.tokens.map((t) => {
      if (t.init !== undefined || (t.kind === 'pc' && !all)) return t;
      const r = roll(`1d20${signed(initModOf(t)).replace('−', '-')}`);
      lines.push(`${t.name} ${r.total}`);
      return { ...t, init: r.total };
    });
    const first = initiativeOrder(tokens).find((t) => t.init !== undefined && !isOut(t));
    set({ tokens, turn: b.turn ?? first?.id, round: b.turn ? b.round : 1, log: lines.length ? log(`Initiative : ${lines.join(' · ')}`, 'info') : b.log });
    if (!b.turn && first) onSelect(first.id);
  }

  function advance(dir: 1 | -1) {
    const patch = advanceBattle(b, dir);
    set(patch);
    if (patch.turn) onSelect(patch.turn);
    setLast(null);
  }

  /** Fin du combat : on garde les jetons et leurs PV, on efface l'initiative. */
  function endCombat() {
    set({ turn: undefined, round: 1, tokens: b.tokens.map((t) => ({ ...t, init: undefined, spent: undefined })), log: log('Fin du combat', 'info') });
    setLast(null);
  }

  // La ligne du combattant actif reste visible dans la liste.
  useEffect(() => {
    revealIn(listRef.current?.querySelector('.is-turn'));
  }, [b.turn]);

  function changeHp(t: BattleToken, delta: number) {
    if (t.hp === undefined || !delta) return;
    const hp = Math.max(0, Math.min(t.maxHp ?? t.hp, t.hp + delta));
    const text = delta < 0 ? `${t.name} subit ${-delta} dégâts (${hp}/${t.maxHp ?? '?'})${hp === 0 ? ' : hors de combat' : ''}` : `${t.name} récupère ${delta} PV (${hp}/${t.maxHp ?? '?'})`;
    set({ tokens: b.tokens.map((x) => (x.id === t.id ? { ...x, hp } : x)), log: log(text, delta < 0 ? 'hit' : 'info') });
  }

  function attack(t: BattleToken, a: Attack) {
    const toHit = a.toHit ?? 0;
    const hit = roll(`1d20${signed(toHit).replace('−', '-')}`);
    const crit = hit.natural === 20, fumble = hit.natural === 1;
    const foes = b.tokens.filter((x) => x.kind !== t.kind && !isOut(x));
    const touches = foes.filter((f) => f.ac !== undefined && hit.total >= f.ac).map((f) => `${f.name} (CA ${f.ac})`);
    let text = `${t.name} · ${a.name} : ${hit.total} au toucher ${hit.text}`;
    if (fumble) text += ' — échec critique';
    let dmg: number | null = null;
    if (a.dice && !fumble) {
      const d = roll(crit ? critical(a.dice) : a.dice);
      dmg = d.total;
      text += ` · ${d.total} ${a.dmgType ?? 'dégâts'}${crit ? ' (critique !)' : ''}`;
    }
    if (!fumble && touches.length) text += ` · touche ${touches.join(', ')}`;
    const spent = a.limited ? [...new Set([...(t.spent ?? []), a.name])] : t.spent;
    set({ tokens: a.limited ? b.tokens.map((x) => (x.id === t.id ? { ...x, spent } : x)) : b.tokens, log: log(text, crit ? 'crit' : fumble ? 'miss' : 'hit') });
    setLast(dmg !== null ? { from: t.id, dmg, label: `${a.name} de ${t.name}`, reach: a.reach ?? 1 } : null);
  }

  async function askTactics() {
    setAi({ busy: true });
    try {
      const text = await askAI(
        'Tu es un maître du jeu expert de D&D 5e. Tu aides le MJ à mener un combat tactique, lisible et cinématique. Réponds en français, en 6 points maximum, une phrase chacun, sans titre : l’ordre des actions des créatures ce round, la cible de chacune, la capacité ou le trait à utiliser, le terrain à exploiter, et un rebondissement pour garder la tension. N’invente aucune statistique.',
        `${combatBrief(b, place)}\n\nTour actuel : ${active?.name ?? 'personne'}.`,
      );
      setAi({ busy: false, text });
    } catch (e) {
      setAi({ busy: false, error: (e as Error).message });
    }
  }

  function addHeroes() {
    const onBoard = new Set(b.tokens.map((t) => t.heroId).filter(Boolean));
    const fresh = heroes.filter((h) => !onBoard.has(h.id));
    onPlace(fresh.map((h) => {
      const hp = leadingInt(h.hp) ?? leadingInt(h.maxHp) ?? 20;
      const dex = leadingInt(h.dex);
      return {
        id: uid(), name: h.name, kind: 'pc', size: 1, visible: true, heroId: h.id,
        hp, maxHp: leadingInt(h.maxHp) ?? hp, ac: leadingInt(h.ac) ?? 14, initMod: dex !== undefined ? Math.floor((dex - 10) / 2) : 0,
        sight: sightFor(h.race), passive: passiveOf(leadingInt(h.wis), leadingInt(h.perceptionBonus) ?? 0),
      };
    }));
  }

  function addCreatures() {
    if (addStat.startsWith('own:')) return addOwn(addStat.slice(4));
    const st = addStat ? STATS[addStat] : undefined;
    const n = Math.max(1, Math.min(12, addCount));
    const base = addName.trim() || st?.name || 'Créature';
    const hp = st ? leadingInt(st.hp) : undefined;
    onPlace(Array.from({ length: n }, (_, i) => ({
      id: uid(), name: n > 1 ? `${base} ${i + 1}` : base, kind: 'monster', size: st && /taille (G|TG)/.test(st.meta) ? 2 : 1,
      visible: false, hp, maxHp: hp, ac: st ? leadingInt(st.ac) : undefined, statId: st ? addStat : undefined, icon: iconFor('monster', st),
    })));
    setAddName(''); setAddCount(1);
  }

  /** Ajoute une fiche de PNJ & Créatures : son jeton, ses PV, sa CA, et sa fiche SRD si elle en vient. */
  function addOwn(id: string) {
    const ref = bestiary.find((x) => x.id === id);
    if (!ref) return;
    const n = Math.max(1, Math.min(12, addCount));
    const base = addName.trim() || ref.name;
    const monster = ref.isMonster || ref.entityType === 'monster';
    const hp = leadingInt(ref.hp);
    const dex = leadingInt(ref.dex);
    onPlace(Array.from({ length: n }, (_, i) => ({
      id: uid(), name: n > 1 ? `${base} ${i + 1}` : base, kind: monster ? 'monster' : 'other',
      size: ref.size === 'G' || ref.size === 'TG' || ref.size === 'Gig' ? 2 : 1,
      visible: false, hp, maxHp: hp, ac: leadingInt(ref.ac), image: ref.token || undefined,
      statId: ref.srdId && STATS[ref.srdId] ? ref.srdId : undefined,
      initMod: dex !== undefined ? Math.floor((dex - 10) / 2) : undefined,
    })));
    setAddName(''); setAddCount(1);
  }

  const hints = active ? turnHints({ b, grid }, active) : [];
  const pace = paceHints({ b, grid });
  const sheet = selected ?? active;
  const sheetStat = sheet ? statOf(sheet) : undefined;
  const attacks = attacksOf(sheetStat);

  return (
    <div className="combat-panel">
      <section className="maps-card combat-turn">
        <div className="combat-turn-head">
          <span className="combat-round">Round {b.round}</span>
          <span className="combat-now">{active ? <>Tour de <b>{active.name}</b></> : 'Initiative non lancée'}</span>
        </div>
        <div className="combat-turn-ctrl">
          {b.turn ? (
            <>
              <button className="maps-btn" onClick={() => advance(-1)} aria-label="Tour précédent" title="Tour précédent (B)">◀</button>
              <button className="maps-btn gold combat-next" onClick={() => advance(1)} title="Tour suivant (N ou Espace)">Tour suivant ▶</button>
              <button className="maps-btn" onClick={() => rollInitiative(false)} title="Tire l’initiative des nouveaux venus">🎲</button>
              <button className="maps-btn" onClick={() => { if (window.confirm('Terminer le combat ? Les jetons et leurs PV restent.')) endCombat(); }}>■ Fin</button>
            </>
          ) : (
            <>
              <button className="maps-btn gold combat-next" onClick={() => rollInitiative(true)} disabled={!order.length} title="Tire l’initiative de tous ceux qui n’en ont pas, puis commence">⚔ Lancer le combat</button>
              <button className="maps-btn" onClick={() => rollInitiative(false)} disabled={!order.length} title="Seulement les créatures : saisis l’initiative des joueurs">🎲 Créatures</button>
            </>
          )}
        </div>
        {b.turn && <p className="combat-keys">Raccourcis : <kbd>N</kbd> ou <kbd>Espace</kbd> tour suivant · <kbd>B</kbd> précédent · <kbd>Échap</kbd> désélectionner</p>}

        {order.length === 0 && <p className="maps-sub">Aucun combattant. Ajoute le groupe et des créatures ci-dessous, ou lance une rencontre depuis la carte de navigation.</p>}
        <ol className="combat-order" ref={listRef}>
          {order.map((t) => {
            const pct = t.maxHp ? Math.max(0, Math.min(1, (t.hp ?? 0) / t.maxHp)) : null;
            return (
              <li key={t.id} className={`combat-row ${t.id === b.turn ? 'is-turn' : ''} ${t.id === selectedId ? 'is-sel' : ''} ${isOut(t) ? 'is-out' : ''} kind-${t.kind}`}>
                <input
                  className="combat-init" inputMode="numeric" aria-label={`Initiative de ${t.name}`} placeholder="—"
                  value={t.init ?? ''} onChange={(e) => patch(t.id, { init: e.target.value === '' ? undefined : Number(e.target.value) || 0 })}
                />
                <button className="combat-who" onClick={() => onSelect(t.id === selectedId ? null : t.id)}>
                  <img src={tokenImage(t)} alt="" />
                  <span className="combat-name">{t.name}{!t.visible && <small title="Caché aux joueurs"> · caché</small>}</span>
                  {t.conditions?.length ? <span className="combat-conds">{t.conditions.join(' · ')}</span> : null}
                </button>
                <span className="combat-ac" title="Classe d’armure">{t.ac ?? '—'}</span>
                <div className="combat-hp">
                  {pct !== null ? (
                    <>
                      <div className="combat-bar"><i style={{ width: `${pct * 100}%` }} data-level={pct > 0.5 ? 'ok' : pct > 0.25 ? 'mid' : 'low'} /></div>
                      <small>{t.hp}/{t.maxHp}</small>
                    </>
                  ) : <small>PV ?</small>}
                </div>
                <div className="combat-dmg">
                  <input inputMode="numeric" placeholder="±" aria-label={`Points de vie à retirer ou ajouter à ${t.name}`} value={amount[t.id] ?? ''}
                    onChange={(e) => setAmount((a) => ({ ...a, [t.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { changeHp(t, -(Number(amount[t.id]) || 0)); setAmount((a) => ({ ...a, [t.id]: '' })); } }} />
                  <button className="maps-btn" title="Dégâts" onClick={() => { changeHp(t, -(Number(amount[t.id]) || 0)); setAmount((a) => ({ ...a, [t.id]: '' })); }}>−</button>
                  <button className="maps-btn" title="Soins" onClick={() => { changeHp(t, Number(amount[t.id]) || 0); setAmount((a) => ({ ...a, [t.id]: '' })); }}>+</button>
                </div>
                <button className="combat-eye" title={t.visible ? 'Visible des joueurs' : 'Caché aux joueurs'} onClick={() => patch(t.id, { visible: !t.visible })}>{t.visible ? '👁' : '🙈'}</button>
              </li>
            );
          })}
        </ol>
      </section>

      {sheet && (
        <section className="maps-card combat-sheet">
          <div className="combat-sheet-head">
            <img src={tokenImage(sheet)} alt="" />
            <div>
              <h3>{sheet.name}</h3>
              <p className="maps-sub">{sheetStat?.meta ?? KIND_LABEL[sheet.kind]}</p>
              <p className="combat-stats">
                <span>CA <b>{sheet.ac ?? '—'}</b></span>
                <span>PV <b>{sheet.hp ?? '—'}/{sheet.maxHp ?? '—'}</b></span>
                <span>Vitesse <b>{speedCells(sheetStat)}</b> cases</span>
                <span>Init <b>{signed(initModOf(sheet))}</b></span>
                <span>Vue <b>{sightOf(sheet)}</b> cases</span>
                <span>Perception passive <b>{passiveOfToken(sheet)}</b></span>
              </p>
              {sheet.kind === 'pc' && (
                <p className="combat-senses">
                  <label>Vue <input inputMode="numeric" value={sheet.sight ?? ''} placeholder={String(sightOf(sheet))} onChange={(e) => patch(sheet.id, { sight: e.target.value === '' ? undefined : Number(e.target.value) || 0 })} /> cases</label>
                  <label>Perception passive <input inputMode="numeric" value={sheet.passive ?? ''} placeholder={String(passiveOfToken(sheet))} onChange={(e) => patch(sheet.id, { passive: e.target.value === '' ? undefined : Number(e.target.value) || 0 })} /></label>
                </p>
              )}
            </div>
          </div>

          <div className="combat-conditions">
            {(sheet.conditions ?? []).map((c) => (
              <button key={c} className="combat-cond" title={`${CONDITIONS.find((x) => x.name === c)?.rule ?? ''} (clic : retirer)`} onClick={() => patch(sheet.id, { conditions: sheet.conditions?.filter((x) => x !== c) })}>{c} ×</button>
            ))}
            <select className="maps-btn" value="" onChange={(e) => e.target.value && patch(sheet.id, { conditions: [...new Set([...(sheet.conditions ?? []), e.target.value])] })}>
              <option value="">+ État…</option>
              {CONDITIONS.filter((c) => !sheet.conditions?.includes(c.name)).map((c) => <option key={c.name} value={c.name} title={c.rule}>{c.name}</option>)}
            </select>
          </div>

          {attacks.length > 0 && (
            <ul className="combat-attacks">
              {attacks.map((a) => {
                const used = sheet.spent?.includes(a.name);
                return (
                  <li key={a.name} className={used ? 'is-used' : ''}>
                    <div className="combat-atk-head">
                      <b>{a.name}</b>
                      <span className="maps-sub">
                        {a.toHit !== undefined && `${signed(a.toHit)} · `}{a.dice ? `${a.dice} ${a.dmgType ?? ''}` : ''}{a.reach ? ` · ${a.reach} case${a.reach > 1 ? 's' : ''}` : ''}{a.limited ? ` · ${a.limited}` : ''}
                      </span>
                      {a.toHit !== undefined
                        ? <button className="maps-btn gold" onClick={() => attack(sheet, a)}>🎲 Attaquer</button>
                        : a.limited && <button className="maps-btn" onClick={() => patch(sheet.id, { spent: used ? sheet.spent?.filter((x) => x !== a.name) : [...(sheet.spent ?? []), a.name] })}>{used ? 'Rechargée' : 'Utilisée'}</button>}
                    </div>
                    <details><summary>Détail</summary><p>{a.text}</p></details>
                  </li>
                );
              })}
            </ul>
          )}
          {last && last.from === sheet.id && (
            <div className="combat-apply">
              <span>{last.dmg} dégâts ({last.label}) : appliquer à</span>
              {b.tokens.filter((t) => t.kind !== sheet.kind && !isOut(t) && t.hp !== undefined)
                .map((t) => ({ t, d: Math.max(Math.max(0, t.x - (sheet.x + sheet.size - 1), sheet.x - (t.x + t.size - 1)), Math.max(0, t.y - (sheet.y + sheet.size - 1), sheet.y - (t.y + t.size - 1))) }))
                .sort((x, y) => x.d - y.d)
                .map(({ t, d }) => (
                  <button key={t.id} className={`maps-btn ${d <= last.reach ? 'gold' : ''}`} title={d <= last.reach ? 'À portée' : `À ${d} cases`} onClick={() => { changeHp(t, -last.dmg); setLast(null); }}>
                    {t.name}{d <= last.reach ? ' · à portée' : ''}
                  </button>
                ))}
            </div>
          )}
          {(sheetStat?.traits?.length || sheetStat?.reactions?.length) ? (
            <details className="combat-traits">
              <summary>Traits et réactions</summary>
              {[...(sheetStat?.traits ?? []), ...(sheetStat?.reactions ?? []).map(([n, t]) => [`Réaction · ${n}`, t] as [string, string])].map(([n, t]) => <p key={n}><b>{n}.</b> {t}</p>)}
            </details>
          ) : null}
          <div className="combat-sheet-foot">
            <button className="maps-btn" onClick={() => patch(sheet.id, { visible: !sheet.visible })}>{sheet.visible ? 'Cacher aux joueurs' : 'Montrer aux joueurs'}</button>
            <button className="maps-btn" onClick={() => { if (window.confirm(`Retirer ${sheet.name} du plateau ?`)) onRemove(sheet.id); }}>Retirer</button>
          </div>
        </section>
      )}

      <section className="maps-card combat-hints">
        <h3>Conseils du MJ</h3>
        {active && <p className="maps-sub">Pour le tour de {active.name} :</p>}
        <ul>
          {[...hints, ...pace].map((h, i) => <li key={i} className={`tone-${h.tone}`}><span aria-hidden="true">{TONE_ICON[h.tone]}</span>{h.text}</li>)}
        </ul>
        <div className="combat-ai">
          <button className="maps-btn gold" disabled={ai.busy || !aiReady()} onClick={askTactics} title={aiReady() ? 'Envoie l’état du combat à l’IA configurée dans Réglages' : 'Configure une clé d’IA dans Réglages'}>
            {ai.busy ? 'L’IA réfléchit…' : '✨ Demander un plan à l’IA'}
          </button>
          {!aiReady() && <small className="maps-sub">Configure une clé d’IA dans Réglages pour un plan détaillé.</small>}
        </div>
        {ai.error && <p className="combat-ai-error">{ai.error}</p>}
        {ai.text && <ul className="combat-ai-answer">{ai.text.split('\n').map((l) => l.replace(/^[\s*•\-–\d.)]+/, '').trim()).filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}</ul>}
      </section>

      {(b.log?.length ?? 0) > 0 && (
        <section className="maps-card combat-log">
          <h3>Journal</h3>
          <ol>{b.log!.slice(0, 10).map((l) => <li key={l.id} className={l.tone ? `tone-${l.tone}` : ''}>{l.text}</li>)}</ol>
        </section>
      )}

      <section className="maps-card combat-add">
        <h3>Ajouter au combat</h3>
        {heroes.length > 0 && (
          <button className="maps-btn" onClick={addHeroes} disabled={heroes.every((h) => b.tokens.some((t) => t.heroId === h.id))}>
            + Le groupe ({heroes.map((h) => h.name).join(', ')})
          </button>
        )}
        <div className="combat-add-row">
          <select className="maps-btn" value={addStat} onChange={(e) => setAddStat(e.target.value)}>
            <option value="">Créature sans fiche</option>
            {bestiary.length > 0 && (
              <optgroup label="PNJ & Créatures">
                {bestiary.map((x) => <option key={x.id} value={`own:${x.id}`}>{x.name}</option>)}
              </optgroup>
            )}
            <optgroup label="SRD">
              {SRD.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </optgroup>
          </select>
          <input className="maps-btn" type="number" min={1} max={12} value={addCount} onChange={(e) => setAddCount(Number(e.target.value) || 1)} aria-label="Nombre" />
        </div>
        <div className="combat-add-row">
          <input className="maps-btn" placeholder={addStat.startsWith('own:') ? bestiary.find((x) => `own:${x.id}` === addStat)?.name : addStat ? STATS[addStat]?.name : 'Nom'} value={addName} onChange={(e) => setAddName(e.target.value)} />
          <button className="maps-btn gold" onClick={addCreatures}>Placer</button>
        </div>
        <p className="maps-sub">Les créatures arrivent cachées aux joueurs : révèle-les d’un clic sur 🙈.</p>
      </section>
    </div>
  );
}
