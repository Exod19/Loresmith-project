/**
 * « Que s'est-il passé ici ? » (MJ) : ce que la mémoire du monde retient d'un lieu (événements et leurs suites :
 * incendie, déblaiement, chantier, vol, effraction…), du plus ancien au plus récent, et, si l'IA est configurée, un
 * court récit à lire aux joueurs, tel qu'un habitant le raconterait.
 */
import { useState } from 'react';
import { aiReady, askAI } from '../../ai/client';
import { clockOf } from './clock';
import { EVENT_KINDS, eventWhen, type WorldEvent } from './worldEvents';

type Props = {
  world: { events?: WorldEvent[]; clock?: unknown; time?: string };
  /** Le lieu, et les identifiants qui le désignent aussi (son intérieur `…:int` et ses pièces). */
  featureId: string; title: string;
  /** Contexte de l'univers (ton, lore) pour le récit. */
  loreContext?: string;
};

/** Événements qui concernent ce lieu (ou son intérieur), du plus ancien au plus récent. */
export function placeEvents(world: Props['world'], featureId: string) {
  const inner = `${featureId}:int`;
  return (world.events ?? []).filter((ev) => {
    const p = ev.place;
    if (!p) return false;
    return p.featureId === featureId || p.planId === inner || String(p.featureId ?? '').startsWith(`${inner}:`);
  }).sort((a, b) => a.at - b.at);
}

export default function PlaceHistory({ world, featureId, title, loreContext }: Props) {
  const [open, setOpen] = useState(false);
  const [tale, setTale] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const evs = placeEvents(world, featureId);
  const clock = clockOf(world);
  const lines = evs.map((ev) => {
    const suites = (ev.suites ?? []).filter((s) => s.status === 'auto' || s.status === 'accepte').map((s) => s.text);
    return { ev, when: eventWhen(ev, clock), suites };
  });
  const tell = async () => {
    setBusy(true); setErr('');
    try {
      const facts = lines.map((l) => `- ${l.when.label} (${l.when.ago}) : ${l.ev.title}${l.ev.text ? `. ${l.ev.text}` : ''}${l.suites.length ? ` Ensuite : ${l.suites.join(' ')}` : ''}`).join('\n');
      const system = 'Tu es le narrateur d’une partie de jeu de rôle, en français. Tu racontes l’histoire récente d’un lieu telle qu’un habitant la raconterait aux héros : concret, vivant, 4 à 6 phrases, sans inventer de faits majeurs absents de la liste (tu peux ajouter des détails sensoriels et des on-dit). Puis, sur une ligne commençant par « MJ : », une piste de jeu tirée de ces faits.'
        + (loreContext ? `\n\nUnivers : ${loreContext.slice(0, 1500)}` : '');
      const user = `Lieu : ${title}.\nCe que retient la mémoire du monde :\n${facts || '- Rien de notable : un lieu tranquille.'}`;
      setTale((await askAI(system, user, { maxTokens: 500 })).trim());
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return (
    <div className="maps-history">
      <button className="maps-btn" aria-expanded={open} onClick={() => setOpen(!open)}>📜 Que s’est-il passé ici ?{evs.length ? ` (${evs.length})` : ''}</button>
      {open && (
        <div className="maps-history-body">
          {!lines.length && <p className="maps-sub">La mémoire du monde ne retient rien de notable ici.</p>}
          <ol>
            {lines.map(({ ev, when, suites }) => (
              <li key={ev.id}>
                <b>{EVENT_KINDS[ev.kind]?.icon ?? '•'} {ev.title}</b> <span className="maps-sub">{when.label}, {when.ago}</span>
                {ev.text && <p>{ev.text}</p>}
                {suites.map((t, i) => <p key={i} className="maps-sub">↳ {t}</p>)}
              </li>
            ))}
          </ol>
          {aiReady() && <button className="maps-btn gold" disabled={busy} onClick={tell}>{busy ? 'Récit en cours…' : '✒ Raconter (IA)'}</button>}
          {err && <p className="maps-sub">{err}</p>}
          {tale && <div className="maps-history-tale">{tale.split('\n').filter(Boolean).map((p, i) => <p key={i} className={p.startsWith('MJ') ? 'maps-sub' : ''}>{p}</p>)}</div>}
        </div>
      )}
    </div>
  );
}
