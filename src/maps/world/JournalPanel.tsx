/**
 * Journal du monde (MJ) : l'horloge (la date du jeu, qu'on avance par actions) et la mémoire du monde (événements
 * datés et situés). Les notes de séance peuvent être lues par l'IA, qui propose des événements à cocher.
 */
import { useState } from 'react';
import { aiReady, askAI } from '../../ai/client';
import type { AtlasData } from '../atlas/types';
import type { Period } from './generate';
import type { World } from './index';
import { DURATIONS, clockLabel, clockOf, untilPeriod } from './clock';
import { EVENT_KINDS, GRAVITY, ROLES, eventWhen, eventsOf, eventsPrompt, newEvent, parseEvents, type EventDraft, type EventKind, type EventPlace, type EventRole, type WorldEvent } from './worldEvents';

type Props = {
  world: World; data: AtlasData;
  /** Lieu proposé par défaut pour un nouvel événement : le lieu choisi, sinon celui du groupe. */
  here?: EventPlace;
  /** Noms des PNJ connus (fiches et occupants), pour l'IA. */
  npcNames: string[];
  onAdvance: (minutes: number) => void;
  onEvents: (events: WorldEvent[]) => void;
  onShow?: (place: EventPlace) => void;
};

const UNITS: [string, number][] = [['minutes', 1], ['heures', 60], ['jours', DURATIONS.jour], ['semaines', DURATIONS.semaine], ['mois', DURATIONS.mois]];

export default function JournalPanel({ world, data, here, npcNames, onAdvance, onEvents, onShow }: Props) {
  const clock = clockOf(world);
  const events = eventsOf(world);
  const [n, setN] = useState('1');
  const [unit, setUnit] = useState(60);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [proposals, setProposals] = useState<(EventDraft & { keep: boolean })[]>([]);

  /** Lieux nommés de la carte (cités, bâtiments, lieux du lore), pour rattacher un événement à la carte. */
  const places = (() => {
    const pt = new Map(data.geometries.filter((g) => g.type === 'point').map((g) => [g.featureId, g.mapId]));
    return data.features.filter((f) => pt.has(f.id) && !f.id.includes(':pnj-') && !f.id.includes(':objet-') && !f.area && f.title)
      .map((f) => ({ title: f.title, planId: pt.get(f.id)!, featureId: f.id }));
  })();
  const add = (list: WorldEvent[]) => onEvents([...(world.events ?? []), ...list]);

  const readNotes = async () => {
    setBusy(true); setErr('');
    try {
      const { system, user } = eventsPrompt(notes, { places: [...new Set(places.map((p) => p.title))], npcs: npcNames, now: clockLabel(clock) });
      const got = parseEvents(await askAI(system, user, { json: true }), places);
      if (!got.length) setErr('L’IA n’a trouvé aucun événement marquant dans ces notes.');
      setProposals(got.map((p) => ({ ...p, keep: true })));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="maps-card journal">
      <div className="maps-card-head"><span>🕰 Horloge du monde</span></div>
      <h3>{clockLabel(clock)}</h3>
      <p className="maps-sub">La date avance avec le jeu : les voyages (heures de marche), les rounds de combat, les fouilles et ces boutons. Le moment de la journée et la saison suivent.</p>
      <div className="journal-row">
        <button className="maps-btn" onClick={() => onAdvance(DURATIONS.fouille)} title="Une fouille, une courte discussion">+10 min</button>
        <button className="maps-btn" onClick={() => onAdvance(DURATIONS.reposCourt)}>Repos court (1 h)</button>
        <button className="maps-btn" onClick={() => onAdvance(DURATIONS.reposLong)}>Repos long (8 h)</button>
        <button className="maps-btn" onClick={() => onAdvance(untilPeriod(world, 'matin' as Period))}>Jusqu’à l’aube</button>
        <button className="maps-btn" onClick={() => onAdvance(untilPeriod(world, 'soir' as Period))}>Jusqu’au soir</button>
        <button className="maps-btn" onClick={() => onAdvance(DURATIONS.jour)}>+1 jour</button>
        <button className="maps-btn" onClick={() => onAdvance(DURATIONS.semaine)}>+1 semaine</button>
      </div>
      <div className="journal-row">
        <input className="maps-btn" type="number" min="1" value={n} onChange={(e) => setN(e.target.value)} aria-label="Durée" style={{ width: '5em' }} />
        <select className="maps-btn" value={unit} onChange={(e) => setUnit(Number(e.target.value))} aria-label="Unité">
          {UNITS.map(([l, m]) => <option key={l} value={m}>{l}</option>)}
        </select>
        <button className="maps-btn gold" disabled={!(Number(n) > 0)} onClick={() => onAdvance(Number(n) * unit)}>Avancer le temps</button>
      </div>

      <div className="maps-card-head journal-head"><span>📜 Mémoire du monde</span>
        <button className="maps-btn" onClick={() => setDraft(draft ? null : { title: '', kind: 'autre', joueurs: 'temoins', gravite: 2, place: here })}>{draft ? 'Annuler' : '+ Événement'}</button>
      </div>
      {draft && (
        <div className="journal-form">
          <input className="maps-btn" placeholder="Ce qui s’est passé (« L’église a brûlé »)" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <div className="journal-row">
            <select className="maps-btn" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as EventKind })} aria-label="Nature">
              {Object.entries(EVENT_KINDS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
            <select className="maps-btn" value={draft.joueurs} onChange={(e) => setDraft({ ...draft, joueurs: e.target.value as EventRole })} aria-label="Implication des héros">
              {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="maps-btn" value={draft.gravite} onChange={(e) => setDraft({ ...draft, gravite: Number(e.target.value) as 1 | 2 | 3 })} aria-label="Gravité">
              {Object.entries(GRAVITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <select className="maps-btn" value={draft.place?.featureId ?? ''} aria-label="Lieu"
            onChange={(e) => { const p = places.find((x) => x.featureId === e.target.value); setDraft({ ...draft, place: p ? { planId: p.planId, featureId: p.featureId, title: p.title } : undefined }); }}>
            <option value="">Lieu : aucun</option>
            {here?.featureId && !places.some((p) => p.featureId === here.featureId) && <option value={here.featureId}>{here.title}</option>}
            {places.map((p) => <option key={p.featureId} value={p.featureId}>{p.title}</option>)}
          </select>
          <input className="maps-btn" placeholder="PNJ touchés (séparés par des virgules)" value={(draft.npcs ?? []).join(', ')} onChange={(e) => setDraft({ ...draft, npcs: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
          <textarea className="maps-btn" rows={2} placeholder="Détails (facultatif)" value={draft.text ?? ''} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
          <button className="maps-btn gold" disabled={!draft.title.trim()} onClick={() => { add([newEvent(clock, { ...draft, source: 'mj' })]); setDraft(null); }}>Inscrire</button>
        </div>
      )}

      <details className="journal-notes">
        <summary>Lire mes notes de séance (IA)</summary>
        <p className="maps-sub">Colle tes notes : l’IA propose les événements qui changent le monde. Rien n’est inscrit sans ton accord.</p>
        <textarea className="maps-btn" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Les héros ont mis le feu à l’église de Brumeval pour couvrir leur fuite ; ils ont laissé le corps du brigand sur la piste…" />
        <button className="maps-btn gold" disabled={busy || !notes.trim() || !aiReady()} onClick={readNotes} title={aiReady() ? '' : 'Configure l’IA dans Réglages'}>{busy ? 'Lecture…' : 'Proposer des événements'}</button>
        {err && <p className="maps-sub journal-err">{err}</p>}
        {proposals.length > 0 && (
          <div className="journal-proposals">
            {proposals.map((p, i) => (
              <label key={i} className="journal-proposal">
                <input type="checkbox" checked={p.keep} onChange={(e) => setProposals(proposals.map((q, j) => (j === i ? { ...q, keep: e.target.checked } : q)))} />
                <span>{EVENT_KINDS[p.kind ?? 'autre'].icon} <b>{p.title}</b>{p.place ? ` · ${p.place.title}` : ''} · {GRAVITY[p.gravite ?? 2]}{p.hoursAgo ? ` · il y a ${p.hoursAgo} h` : ''}{p.text ? <><br /><small>{p.text}</small></> : null}</span>
              </label>
            ))}
            <button className="maps-btn gold" disabled={!proposals.some((p) => p.keep)}
              onClick={() => { add(proposals.filter((p) => p.keep).map((p) => newEvent(clock, p))); setProposals([]); setNotes(''); }}>
              Inscrire les événements cochés
            </button>
          </div>
        )}
      </details>

      {events.length === 0 && <p className="maps-sub">Rien d’inscrit pour l’instant.</p>}
      <ul className="journal-list">
        {events.map((ev) => {
          const w = eventWhen(ev, clock);
          return (
            <li key={ev.id} className={`grav-${ev.gravite}`}>
              <div className="journal-ev-head">
                <span>{EVENT_KINDS[ev.kind].icon} <b>{ev.title}</b></span>
                <button className="maps-btn" aria-label="Retirer" title="Retirer du journal" onClick={() => onEvents((world.events ?? []).filter((e) => e.id !== ev.id))}>×</button>
              </div>
              <small>{w.label} · {w.ago}{ev.place ? <> · {ev.place.planId && onShow ? <button className="maps-link" onClick={() => onShow(ev.place!)}>{ev.place.title}</button> : ev.place.title}</> : null}</small>
              <small>{ROLES[ev.joueurs]} · {GRAVITY[ev.gravite]}{ev.npcs?.length ? ` · ${ev.npcs.join(', ')}` : ''}</small>
              {ev.text && <p>{ev.text}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
