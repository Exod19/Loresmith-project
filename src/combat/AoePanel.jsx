/**
 * Résolution d'une zone d'effet (sort, souffle) sur la carte de combat : un seul jet de dégâts pour toute la zone,
 * une sauvegarde par créature touchée (bonus de sa fiche), puis résistance, immunité ou vulnérabilité. Le MJ peut
 * retoucher chaque dé, retirer une créature (sort sculpté), puis appliquer : les dégâts passent par la Table de guerre.
 */
import { useMemo, useState } from 'react';
import { STATS } from '../maps/atlas/statblocks';
import { roll } from '../maps/atlas/encounters';
import { aoeDamage, aoeName, damageFactor, DAMAGE_TYPES, SAVE_LABEL, saveBonus } from '../maps/battle/aoe';

const SCORE_KEY = { for: 'str', dex: 'dex', con: 'con', int: 'int', sag: 'wis', cha: 'cha' };
const d20 = () => 1 + Math.floor(Math.random() * 20);
const uid = () => Math.random().toString(36).slice(2, 10);

/** Fiche utile d'un combattant : sauvegardes, caractéristique, résistances (fiche SRD, PNJ du bestiaire, combattant). */
function sheetOf(state, c, t) {
  const st = t?.statId ? STATS[t.statId] : null;
  const npc = c?.sourceId && !String(c.sourceId).startsWith('srd:') ? state.npcs?.[c.sourceId] : null;
  const text = (...xs) => xs.filter(Boolean).map(String).join('; ');
  return {
    saves: text(c?.saves, st?.saves),
    resist: text(st?.resist, npc?.resistances, c?.resistances),
    immune: text(st?.immune, npc?.immunities, c?.immunities),
    vuln: text(st?.vuln, npc?.vulnerabilities, c?.vulnerabilities),
  };
}

export default function AoePanel({ state, battle, setBattle }) {
  const hit = battle.aoeHit;
  const aoe = (battle.aoes || []).find((a) => a.id === hit?.aoeId);
  const effect = aoe?.effect;
  const combatants = state.combat?.combatants || [];
  const [damage, setDamage] = useState(() => (effect ? roll(effect.dice) : { total: 0, detail: '' }));
  const [rows, setRows] = useState(() => (hit?.targets || []).map((id) => ({ id, on: true, d20: d20() })));

  const typeLabel = DAMAGE_TYPES.find((d) => d.id === effect?.type)?.label.toLowerCase() ?? effect?.type;
  const lines = useMemo(() => rows.map((r) => {
    const t = battle.tokens.find((q) => q.id === r.id);
    const c = combatants.find((q) => q.id === r.id);
    const sheet = sheetOf(state, c, t);
    const sv = effect?.save ? saveBonus(effect.save.ability, { saves: sheet.saves, score: Number(c?.[SCORE_KEY[effect.save.ability]] ?? 10) }) : null;
    const total = sv ? r.d20 + sv.bonus : null;
    const saved = effect?.save ? (r.d20 === 1 ? false : total >= effect.save.dc) : null;
    const factor = damageFactor(effect?.type ?? '', sheet);
    const dmg = aoeDamage(damage.total, effect ?? { dice: '', type: '' }, saved, factor);
    return { ...r, name: t?.name ?? c?.name ?? '…', isPC: t?.kind === 'pc', hp: c?.hp ?? t?.hp, sv, total, saved, factor, dmg };
  }), [rows, damage.total, battle.tokens, combatants, effect, state]);

  const close = () => setBattle({ ...battle, aoeHit: undefined });
  if (!aoe || !effect) return <div className="attack-panel"><p className="muted">Zone d’effet introuvable.</p><button className="btn sm" onClick={close}>Fermer</button></div>;

  const apply = () => {
    const queue = lines.filter((l) => l.on && l.dmg > 0).map((l) => ({ id: uid(), to: l.id, amount: l.dmg, why: `${aoe.label || 'zone d’effet'} (${typeLabel})` }));
    setBattle({ ...battle, aoeHit: undefined, damage: [...(battle.damage || []), ...queue] });
  };
  const setRow = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const factorLabel = (f) => (f === 0 ? 'immunité' : f === 0.5 ? 'résistance' : f === 2 ? 'vulnérabilité' : '');

  return (
    <div className="attack-panel aoe-panel">
      <div className="attack-head">
        <b>✸ {aoeName(aoe)}</b>
        <button type="button" className="token-sheet-close" onClick={close} aria-label="Fermer sans appliquer">✕</button>
      </div>
      <p className="aoe-rule">
        {effect.dice} dégâts {typeLabel}
        {effect.save ? ` · sauvegarde de ${SAVE_LABEL[effect.save.ability]} DD ${effect.save.dc}${effect.save.half ? ', moitié si réussie' : ', aucun dégât si réussie'}` : ' · sans sauvegarde'}
        {effect.spare ? ` · ${effect.spare === 'pc' ? 'héros épargnés' : 'créatures épargnées'}` : ''}
      </p>
      <div className="aoe-roll">
        <span>Jet de dégâts (un pour toute la zone)</span>
        <input className="input" type="number" min={0} value={damage.total} onChange={(e) => setDamage({ total: Math.max(0, Number(e.target.value) || 0), detail: 'saisi' })} aria-label="Total des dégâts" />
        <button type="button" className="btn sm" onClick={() => setDamage(roll(effect.dice))} title="Relancer les dégâts">🎲</button>
        {damage.detail && damage.detail !== 'saisi' && <small className="muted">{damage.detail}</small>}
      </div>
      {lines.length === 0 ? <p className="muted">Personne dans la zone.</p> : (
        <ul className="aoe-list">
          {lines.map((l) => (
            <li key={l.id} data-on={l.on ? 1 : 0} data-side={l.isPC ? 'pc' : 'foe'}>
              <label className="aoe-who"><input type="checkbox" checked={l.on} onChange={(e) => setRow(l.id, { on: e.target.checked })} /> <b>{l.name}</b></label>
              {effect.save && (
                <span className="aoe-save" title={l.sv?.proficient ? 'Bonus de sauvegarde de la fiche' : 'Modificateur de caractéristique (maîtrise inconnue)'}>
                  d20 <input className="input" type="number" min={1} max={20} value={l.d20} onChange={(e) => setRow(l.id, { d20: Math.min(20, Math.max(1, Number(e.target.value) || 1)) })} />
                  {l.sv.bonus >= 0 ? '+' : ''}{l.sv.bonus} = <b>{l.total}</b> {l.saved ? '✔ réussie' : '✘ ratée'}
                </span>
              )}
              <span className="aoe-dmg"><b>{l.on ? l.dmg : 0}</b> {factorLabel(l.factor) && <small>({factorLabel(l.factor)})</small>}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="skirmish-row wrap">
        <button type="button" className="btn sm primary" onClick={apply} disabled={!lines.some((l) => l.on && l.dmg > 0)}>
          Appliquer les dégâts ({lines.filter((l) => l.on && l.dmg > 0).length})
        </button>
        <button type="button" className="btn sm" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, d20: d20() })))}>Relancer les sauvegardes</button>
        <button type="button" className="btn sm" onClick={close}>Fermer</button>
      </div>
    </div>
  );
}
