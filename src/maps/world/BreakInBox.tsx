/**
 * Effraction nocturne (MJ) : la serrure (crocheter ou forcer), puis la Discrétion pour ne réveiller personne ; si quelqu'un
 * se réveille, sa réaction et l'arrivée de la garde. L'effraction s'inscrit d'elle-même dans la mémoire du monde.
 */
import { useState } from 'react';
import type { AtlasFeature } from '../atlas/types';
import type { Period } from './generate';
import { breakInEvent, guardArrival, lockOf, nightOccupants, stealthDc, wakeOutcome } from './effraction';
import type { EventDraft } from './worldEvents';

type Occupant = { name: string; role: string; asleep: boolean };
type Props = {
  f: AtlasFeature; period: Period; planId: string;
  /** Occupants de l'intérieur déjà généré (la nuit), s'il l'a été. */
  known?: Occupant[];
  onEvent: (e: EventDraft) => void;
  onTime?: (minutes: number) => void;
};

export default function BreakInBox({ f, period, planId, known, onEvent, onTime }: Props) {
  const b = f.batiment!;
  const lock = lockOf(b, period);
  const occ = nightOccupants({ id: f.id, type: b.type }, known?.length ? known : undefined);
  const [step, setStep] = useState<'serrure' | 'discretion' | 'fin'>(lock.locked ? 'serrure' : 'discretion');
  const [forced, setForced] = useState(false);
  const [roll, setRoll] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<string[]>([]);
  const [tries, setTries] = useState(0);
  const sd = stealthDc(occ, forced);

  if (period !== 'nuit') return null;
  const n = Number(roll);
  const ok = roll !== '' && Number.isFinite(n);

  const tryLock = (force: boolean) => {
    if (!ok) return;
    const dc = force ? lock.forceDc : lock.dc;
    onTime?.(force ? 0.1 : 1);
    setTries(tries + 1);
    if (force) setForced(true);
    if (n >= dc) { setNote(force ? 'La porte cède dans un craquement.' : 'Un déclic : la serrure s’ouvre.'); setStep('discretion'); }
    else setNote(force ? 'La porte tient bon, mais le choc a résonné dans la maison.' : 'La serrure résiste ; une minute de perdue.');
    setRoll('');
  };
  const sneak = () => {
    if (!ok) return;
    onTime?.(10);
    const margin = n - sd.dc;
    const place = { planId, featureId: f.id, title: f.title };
    if (margin >= 0) {
      setLines(['Personne ne bouge. Les héros fouillent à leur aise et repartent sans bruit.']);
      onEvent(breakInEvent({ place }));
    } else {
      const w = wakeOutcome(occ, margin, `${f.id}:${tries}:${n}`);
      const guard = w.shout ? guardArrival(b.quartier, `${f.id}:${n}`) : null;
      setLines([...w.lines, ...(guard ? [`Les cris ont porté : ${guard.who} arrive dans ${guard.rounds} rounds (${guard.dice}).`] : [])]);
      onEvent(breakInEvent({ place, woken: w.woken, shout: w.shout, fight: w.fight, guard }));
    }
    setStep('fin'); setRoll('');
  };

  return (
    <div className="maps-search breakin">
      <p className="maps-search-dc"><b>🌙 Effraction</b></p>
      {step === 'serrure' && (
        <>
          <p className="maps-sub">C’est la nuit : {lock.door}. {lock.why}</p>
          <p className="maps-sub">Crocheter : Dextérité (outils de voleur) DD {lock.dc}, une minute. Forcer : Force (Athlétisme) DD {lock.forceDc}, un round, mais bruyant (Discrétion + 5 ensuite).</p>
          {note && <p className="maps-search-out">{note}</p>}
          <div className="maps-search-row">
            <input className="maps-btn" type="number" placeholder="Jet du joueur" value={roll} onChange={(e) => setRoll(e.target.value)} />
            <button className="maps-btn" disabled={!ok} onClick={() => tryLock(false)}>Crocheter</button>
            <button className="maps-btn" disabled={!ok} onClick={() => tryLock(true)}>Forcer</button>
          </div>
        </>
      )}
      {step === 'discretion' && (
        <>
          {note && <p className="maps-search-out">{note}</p>}
          {!lock.locked && <p className="maps-sub">{lock.why}</p>}
          <p className="maps-sub">
            Dedans : {occ.sleepers.length ? `${occ.sleepers.length} dormeur${occ.sleepers.length > 1 ? 's' : ''} (${occ.sleepers.map((p) => p.name || p.role).join(', ')})` : 'personne ne dort ici'}
            {occ.watchers.length ? `, ${occ.watchers.length} éveillé${occ.watchers.length > 1 ? 's' : ''} (${occ.watchers.map((p) => p.name || p.role).join(', ')})` : ''}{known?.length ? '' : ' (estimation : l’intérieur n’a pas encore été visité)'}.
          </p>
          <p><b>Discrétion DD {sd.dc}</b> <span className="maps-sub">({sd.why.join(' ; ')}) — le plus bas jet du groupe.</span></p>
          <div className="maps-search-row">
            <input className="maps-btn" type="number" placeholder="Jet le plus bas" value={roll} onChange={(e) => setRoll(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sneak()} />
            <button className="maps-btn gold" disabled={!ok} onClick={sneak}>Entrer et fouiller</button>
          </div>
        </>
      )}
      {step === 'fin' && (
        <>
          {lines.map((l, i) => <p key={i} className="maps-search-out">{l}</p>)}
          <p className="maps-sub">Inscrit dans la mémoire du monde (onglet Journal).</p>
          <button className="maps-btn" onClick={() => { setStep(lock.locked ? 'serrure' : 'discretion'); setForced(false); setNote(''); setLines([]); }}>Nouvelle tentative</button>
        </>
      )}
    </div>
  );
}
