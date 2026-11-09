/**
 * Porte verrouillée (MJ) : avant d'entrer dans un bâtiment fermé à clé (la nuit, cf. lockOf), une fenêtre propose le
 * jet de crochetage ou de force avec son DD. Réussi : on entre. Raté : une minute perdue (crocheter) ou du bruit
 * (forcer). Le MJ peut toujours passer outre (« Entrer quand même ») ou fermer la fenêtre (×, Échap) sans entrer.
 */
import { useEffect, useState } from 'react';
import { lockOf } from './effraction';

type Props = {
  title: string;
  batiment: { type?: string; quartier?: string };
  period: string;
  /** Entrer (porte ouverte) ; `forced` : la porte a été enfoncée (bruit, traces). */
  onEnter: (how: 'crochetee' | 'forcee' | 'mj') => void;
  onTime?: (minutes: number) => void;
  onClose: () => void;
};

export default function LockGate({ title, batiment, period, onEnter, onTime, onClose }: Props) {
  const lock = lockOf(batiment, period);
  const [roll, setRoll] = useState('');
  const [note, setNote] = useState('');
  const [noise, setNoise] = useState(0);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const n = Number(roll);
  const ok = roll !== '' && Number.isFinite(n);
  const attempt = (force: boolean) => {
    if (!ok) return;
    const dc = force ? lock.forceDc : lock.dc;
    onTime?.(force ? 0.1 : 1);
    setRoll('');
    if (n >= dc) { onEnter(force ? 'forcee' : 'crochetee'); return; }
    if (force) setNoise(noise + 1);
    setNote(force
      ? `La porte tient bon (${n} contre DD ${dc}) ; le choc a résonné${noise ? ', encore' : ''} : quelqu’un a pu l’entendre.`
      : `La serrure résiste (${n} contre DD ${dc}) : une minute de perdue. Réessayer, ou forcer.`);
  };
  return (
    <div className="lockgate-backdrop" onClick={onClose}>
      <div className="lockgate" role="dialog" aria-modal="true" aria-label={`Porte verrouillée : ${title}`} onClick={(e) => e.stopPropagation()}>
        <button className="lockgate-x" aria-label="Fermer" onClick={onClose}>×</button>
        <h3>🔒 Fermé à clé : {title}</h3>
        <p className="maps-sub">{lock.door.replace(/^./, (c) => c.toUpperCase())}. {lock.why}</p>
        <ul className="lockgate-dc">
          <li><b>Crocheter</b> : Dextérité (outils de voleur) <b>DD {lock.dc}</b> — une minute, sans bruit.</li>
          <li><b>Forcer</b> : Force (Athlétisme) <b>DD {lock.forceDc}</b> — un round, bruyant (Discrétion + 5 ensuite, traces au matin).</li>
        </ul>
        {note && <p className="maps-search-out">{note}</p>}
        <div className="maps-search-row">
          <input className="maps-btn" type="number" autoFocus placeholder="Jet du joueur" value={roll} onChange={(e) => setRoll(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && attempt(false)} />
          <button className="maps-btn gold" disabled={!ok} onClick={() => attempt(false)}>Crocheter</button>
          <button className="maps-btn" disabled={!ok} onClick={() => attempt(true)}>Forcer</button>
        </div>
        <div className="lockgate-foot">
          <button className="maps-btn" onClick={() => onEnter('mj')} title="Une clé, un occupant qui ouvre, une autre entrée : le MJ décide">Entrer quand même</button>
          <button className="maps-btn" onClick={onClose}>Rester dehors</button>
        </div>
      </div>
    </div>
  );
}
