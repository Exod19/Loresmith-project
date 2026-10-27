/**
 * Épreuve de passage (Table de jeu) : avant de suivre un sentier incertain ou périlleux, un aventurier
 * (tiré au hasard ou choisi) fait le test. L'app peut lancer le dé pour lui, ou le MJ saisit le résultat
 * annoncé à la table ; en cas d'échec, elle dit ce qui arrive et lance les dégâts.
 */
import { useState } from 'react';
import { roll } from './battle/combat';
import { abilityMod, type Hazard } from './atlas/hazards';
import type { Hero } from './battle/CombatPanel';

type Outcome = { who: string; total: number; detail: string; ok: boolean; damage?: { total: number; detail: string } };

const pickRandom = (heroes: Hero[], not?: string) => {
  const pool = heroes.filter((h) => h.id !== not);
  return (pool.length ? pool : heroes)[Math.floor(Math.random() * (pool.length || heroes.length))];
};
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export default function TrialPanel({ trail, to, hazard, heroes, onPass, onCancel }: {
  trail: string; to: string; hazard: Hazard; heroes: Hero[];
  /** Le groupe passe (avec, ou non, la conséquence d'un échec). */
  onPass: (summary: string) => void;
  onCancel: () => void;
}) {
  const [heroId, setHeroId] = useState<string>(() => (heroes.length ? pickRandom(heroes).id : ''));
  const [manual, setManual] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const hero = heroes.find((h) => h.id === heroId);
  const mod = abilityMod(Number(hero?.[hazard.ability]) || undefined);
  const who = hero?.name ?? 'L’aventurier de tête';

  function resolve(total: number, detail: string) {
    const ok = total >= hazard.dc;
    const damage = !ok && hazard.damage ? roll(hazard.damage) : undefined;
    setOutcome({ who, total, detail, ok, damage: damage && { total: damage.total, detail: damage.text } });
  }

  const summary = outcome
    ? `${outcome.who} · ${trail} : ${outcome.total} contre DC ${hazard.dc} — ${outcome.ok ? 'réussite' : `échec${outcome.damage ? `, ${outcome.damage.total} dégâts` : ''}`}`
    : '';

  return (
    <div className="trial">
      <div className="trial-head">
        <b>Épreuve · {trail}</b>
        <button className="maps-link" onClick={onCancel} aria-label="Annuler">×</button>
      </div>
      <p className="trial-dc">{hazard.check} <b>DC {hazard.dc}</b> pour rejoindre {to}.</p>
      <p className="trial-risk"><span>En cas d’échec :</span> {hazard.fail}{hazard.damage ? ` (${hazard.damage} dégâts)` : ''}{hazard.setback ? ` ${hazard.setback}` : ''}</p>

      {!outcome && (
        <>
          <div className="trial-who">
            <label>Qui passe en premier ?
              <select className="maps-btn" value={heroId} onChange={(e) => setHeroId(e.target.value)}>
                {heroes.length === 0 && <option value="">Aventurier de tête</option>}
                {heroes.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </label>
            {heroes.length > 1 && <button className="maps-btn" onClick={() => setHeroId(pickRandom(heroes, heroId).id)} title="Tirer un autre aventurier au hasard">🎲 Au hasard</button>}
          </div>
          <div className="trial-roll">
            <button className="maps-btn gold" onClick={() => { const r = roll(`1d20${signed(mod)}`); resolve(r.total, `${r.text}`); }}>
              🎲 Lancer pour {who} ({signed(mod)})
            </button>
            <span className="trial-or">ou résultat annoncé</span>
            <input className="maps-btn" inputMode="numeric" placeholder="ex. 14" value={manual} onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && manual) resolve(Number(manual) || 0, 'annoncé'); }} />
            <button className="maps-btn" disabled={!manual} onClick={() => resolve(Number(manual) || 0, 'annoncé')}>Valider</button>
          </div>
          <button className="maps-link trial-skip" onClick={() => onPass(`${trail} : suivi sans épreuve`)}>Suivre sans épreuve</button>
        </>
      )}

      {outcome && (
        <div className={`trial-result ${outcome.ok ? 'ok' : 'ko'}`}>
          <p><b>{outcome.who}</b> obtient <b>{outcome.total}</b> <small>({outcome.detail})</small> contre DC {hazard.dc} : <b>{outcome.ok ? 'réussite' : 'échec'}</b>.</p>
          <p className="trial-read">{outcome.ok ? hazard.success : hazard.fail}</p>
          {outcome.damage && <p><b>{outcome.damage.total} dégâts</b> <small>({hazard.damage} : {outcome.damage.detail})</small></p>}
          {!outcome.ok && hazard.setback && <p className="maps-sub">{hazard.setback}</p>}
          <div className="trial-actions">
            <button className="maps-btn gold" onClick={() => onPass(summary)}>{outcome.ok ? 'Le groupe passe ➜' : 'Le groupe passe quand même ➜'}</button>
            {!outcome.ok && <button className="maps-btn" onClick={onCancel}>Rester ici</button>}
            <button className="maps-link" onClick={() => setOutcome(null)}>Recommencer</button>
          </div>
        </div>
      )}
    </div>
  );
}
