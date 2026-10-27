/**
 * Campagne invoquée sur la carte (MJ seulement) : où en est le groupe dans l'histoire, où l'amener ensuite,
 * qui il y rencontre et quels combats l'y attendent. Les lieux des scènes sont retrouvés sur la carte par leur nom.
 */
import { useMemo, useState } from 'react';
import type { PartyPlace } from './mapStore';
import type { EncounterGroup } from './battle/encounter';
import { findSrd } from '../bestiary/entityGen';
import { norm, words } from '../ai/loreContext';

type Creature = { name?: string; count?: number; cr?: string };
type SceneEncounter = { name?: string; detail?: string; creatures?: Creature[]; tactics?: string; goal?: string; complication?: string; nonCombatResolution?: string };
type Scene = {
  id: string; title: string; type?: string; summary?: string; sessionNumber?: number | null; location?: string;
  expanded?: {
    setting?: string; readAloud?: string; guidance?: string[]; nextLocation?: string; hiddenTruth?: string;
    npcs?: { name?: string; role?: string; note?: string }[]; encounters?: SceneEncounter[];
    skillChecks?: { check?: string; dc?: number | string; on_success?: string }[]; clues?: string[];
    dialogues?: { speaker?: string; text?: string }[];
  } | null;
};
export type GuideCampaign = { id: string; title: string; scenes: Scene[]; sessions?: { sessionNumber: number; title?: string }[]; progress?: { sceneId?: string; done?: string[] } };
export type BestiaryRef = { id: string; name: string; isMonster?: boolean; entityType?: string; hp?: number; ac?: number; dex?: number; token?: string; size?: string; srdId?: string };
/** Lieu de la carte qu'une scène peut désigner. */
export type GuidePlace = PartyPlace & { plan?: string };

const txt = (v: unknown): string => (v == null ? '' : typeof v === 'string' ? v : Array.isArray(v) ? v.map(txt).join(', ') : typeof v === 'object' ? Object.values(v as object).map(txt).join(' — ') : String(v));
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(txt).filter(Boolean) : v ? [txt(v)] : []);

/** Retrouve sur la carte le lieu nommé par une scène : nom exact, puis inclusion, puis mots en commun. */
export function findPlace(name: string | undefined, places: GuidePlace[]): GuidePlace | null {
  const k = norm(name);
  if (!k) return null;
  const exact = places.find((p) => norm(p.title) === k);
  if (exact) return exact;
  // « Taverne du Gond, dans Hosten Valak » : on essaie chaque morceau.
  for (const part of k.split(/ (?:dans|a|au|pres de|sous|sur) /)) {
    const hit = places.find((p) => norm(p.title) === part);
    if (hit) return hit;
  }
  const inc = places
    .filter((p) => {
      const t = norm(p.title);
      return t.length >= 5 && (k.includes(t) || (k.length >= 5 && t.includes(k)));
    })
    .sort((a, b) => b.title.length - a.title.length)[0];
  if (inc) return inc;
  const want = new Set(words(name));
  if (want.size < 2) return null;
  let best: GuidePlace | null = null;
  let bestScore = 0;
  for (const p of places) {
    const w = words(p.title);
    if (!w.length) continue;
    const common = w.filter((x) => want.has(x)).length;
    const score = common / Math.max(w.length, want.size);
    if (common >= 2 && score > bestScore) { bestScore = score; best = p; }
  }
  return bestScore >= 0.5 ? best : null;
}

/** Créatures d'une rencontre, prêtes pour la carte : fiche de PNJ & Créatures, sinon fiche SRD, sinon un nom. */
export function encounterGroups(enc: SceneEncounter, bestiary: BestiaryRef[]): EncounterGroup[] {
  const creatures = enc.creatures?.length ? enc.creatures : [{ name: enc.name, count: 1 }];
  return creatures.filter((c) => c.name).map((c) => {
    const own = bestiary.find((b) => norm(b.name) === norm(c.name));
    const srd = findSrd(c.name || '');
    return {
      stat: own?.srdId || srd?.id || txt(c.name),
      n: Math.max(1, Math.min(12, Number(c.count) || 1)),
      role: enc.tactics ? txt(enc.tactics).slice(0, 40) : undefined,
      detail: txt(enc.detail).slice(0, 160),
      name: own?.name || txt(c.name),
      image: own?.token,
      hp: own?.hp,
      ac: own?.ac,
      size: own?.size === 'G' || own?.size === 'TG' || own?.size === 'Gig' ? 2 : undefined,
    };
  });
}

type Props = {
  campaigns: GuideCampaign[];
  activeId?: string;
  onPick: (id: string) => void;
  onProgress: (camp: GuideCampaign, progress: { sceneId?: string; done?: string[] }) => void;
  places: GuidePlace[];
  partyAt?: PartyPlace;
  bestiary: BestiaryRef[];
  onShow: (p: GuidePlace) => void;
  onDest: (p: GuidePlace) => void;
  onPartyHere: (p: GuidePlace) => void;
  /** Place une rencontre : au lieu trouvé, ou au prochain clic sur la carte. */
  onEncounter: (enc: SceneEncounter, groups: EncounterGroup[], place: GuidePlace | null) => void;
  /** Place un repère pour un lieu absent de la carte (au prochain clic). */
  onMarkPlace: (title: string, summary: string) => void;
};

export default function CampaignGuide({ campaigns, activeId, onPick, onProgress, places, partyAt, bestiary, onShow, onDest, onPartyHere, onEncounter, onMarkPlace }: Props) {
  const camp = campaigns.find((c) => c.id === activeId) ?? null;
  const [readOpen, setReadOpen] = useState(false);
  const scenes = camp?.scenes ?? [];
  const done = useMemo(() => new Set(camp?.progress?.done ?? []), [camp?.progress?.done]);
  const current = scenes.find((s) => s.id === camp?.progress?.sceneId) ?? scenes.find((s) => !done.has(s.id)) ?? scenes[0] ?? null;
  const idx = current ? scenes.indexOf(current) : -1;

  if (!campaigns.length) return null;

  const go = (i: number) => camp && scenes[i] && onProgress(camp, { ...camp.progress, sceneId: scenes[i].id });
  const finish = () => {
    if (!camp || !current) return;
    const next = scenes.slice(idx + 1).find((s) => !done.has(s.id));
    onProgress(camp, { done: [...new Set([...(camp.progress?.done ?? []), current.id])], sceneId: next?.id ?? current.id });
  };

  const x = current?.expanded ?? null;
  const locName = current?.location || x?.setting || '';
  const place = findPlace(locName, places);
  const here = !!(place && partyAt && partyAt.id === place.id);
  const next = scenes[idx + 1];
  const nextName = x?.nextLocation || next?.location || '';
  const nextPlace = findPlace(nextName, places);
  const session = camp?.sessions?.find((s) => s.sessionNumber === current?.sessionNumber);
  const npcRef = (name?: string) => bestiary.find((b) => norm(b.name) === norm(name));

  return (
    <div className="maps-card camp-guide">
      <div className="maps-card-head">
        <span>📜 Campagne</span>
        <select className="maps-btn" value={camp?.id ?? ''} onChange={(e) => onPick(e.target.value)}>
          <option value="">Aucune campagne invoquée</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>
      {!camp && <p className="maps-sub">Invoque une campagne pour savoir où amener le groupe, qui il y rencontre, et placer les rencontres prévues.</p>}
      {camp && !current && <p className="maps-sub">Cette campagne n’a pas encore de scènes : écris ses séances depuis la Forge.</p>}
      {camp && current && (
        <>
          <p className="maps-sub">
            {session ? `Séance ${session.sessionNumber}${session.title ? ` · ${session.title}` : ''} · ` : ''}Scène {idx + 1}/{scenes.length}
            {done.size > 0 && ` · ${done.size} terminée(s)`}
          </p>
          <div className="camp-guide-nav">
            <button className="maps-btn" disabled={idx <= 0} onClick={() => go(idx - 1)} aria-label="Scène précédente">◀</button>
            <h3>{current.title}{done.has(current.id) && ' ✓'}</h3>
            <button className="maps-btn" disabled={idx >= scenes.length - 1} onClick={() => go(idx + 1)} aria-label="Scène suivante">▶</button>
          </div>
          {current.summary && <p>{txt(current.summary)}</p>}
          {!x && <p className="maps-sub">Scène pas encore écrite en détail (Forge → « Écrire cette séance »).</p>}

          <div className="maps-block">
            <h4>Où</h4>
            {!locName && <p className="maps-sub">Lieu non précisé.</p>}
            {locName && place && (
              <>
                <p>📍 <b>{place.title}</b>{place.plan ? <span className="maps-sub"> · {place.plan}</span> : null}{here && <b className="camp-guide-here"> · le groupe y est</b>}</p>
                <div className="maps-enc-ctrl">
                  <button className="maps-btn" onClick={() => onShow(place)}>Voir</button>
                  {!here && <button className="maps-btn gold" onClick={() => onDest(place)}>🎯 En faire la destination</button>}
                  {!here && <button className="maps-btn" onClick={() => onPartyHere(place)}>📍 Le groupe y est</button>}
                </div>
              </>
            )}
            {locName && !place && (
              <>
                <p>« {locName} » <span className="maps-sub">n’est pas sur cette carte.</span></p>
                <button className="maps-btn" onClick={() => onMarkPlace(locName, txt(x?.readAloud).slice(0, 300))}>＋ Placer ce lieu sur la carte</button>
              </>
            )}
          </div>

          {list(x?.guidance).length > 0 && (
            <div className="maps-block camp-guide-lead">
              <h4>Pour y amener le groupe</h4>
              <ul className="maps-list">{list(x?.guidance).map((g, i) => <li key={i}>{g}</li>)}</ul>
            </div>
          )}

          {(x?.npcs?.length ?? 0) > 0 && (
            <div className="maps-block">
              <h4>PNJ présents</h4>
              <ul className="camp-guide-npcs">
                {x!.npcs!.map((n, i) => {
                  const ref = npcRef(n.name);
                  return (
                    <li key={i}>
                      {ref?.token ? <img src={ref.token} alt="" /> : <span className="camp-guide-ph">✦</span>}
                      <span><b>{txt(n.name)}</b> <small>{txt(n.role || n.note).slice(0, 120)}</small></span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {(x?.encounters?.length ?? 0) > 0 && (
            <div className="maps-block">
              <h4>Rencontres prévues</h4>
              {x!.encounters!.map((e, i) => {
                const groups = encounterGroups(e, bestiary);
                return (
                  <div key={i} className="camp-guide-enc">
                    <p><b>{txt(e.name)}</b> {e.detail && <span className="maps-sub">{txt(e.detail).slice(0, 220)}</span>}</p>
                    <div className="camp-guide-creatures">
                      {groups.map((g, j) => (
                        <span key={j}>{g.image && <img src={g.image} alt="" />}{g.n} × {g.name}</span>
                      ))}
                    </div>
                    {e.tactics && <p className="maps-sub">Tactique : {txt(e.tactics)}</p>}
                    {e.nonCombatResolution && <p className="maps-sub">Sans combat : {txt(e.nonCombatResolution)}</p>}
                    <button className="maps-btn gold" onClick={() => onEncounter(e, groups, place)}>
                      ⚔ {place ? `Placer à ${place.title}` : 'Placer sur la carte'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {(x?.skillChecks?.length ?? 0) > 0 && (
            <div className="maps-block">
              <h4>Jets</h4>
              <ul className="maps-list">{x!.skillChecks!.map((c, i) => <li key={i}><b>{txt(c.check)} DD {txt(c.dc)}</b> — {txt(c.on_success)}</li>)}</ul>
            </div>
          )}

          {list(x?.clues).length > 0 && (
            <div className="maps-block">
              <h4>Indices</h4>
              <ul className="maps-list">{list(x?.clues).map((c, i) => <li key={i}>{c}</li>)}</ul>
            </div>
          )}

          {x?.readAloud && (
            <div className="maps-block">
              <button className="maps-link" onClick={() => setReadOpen((v) => !v)}>{readOpen ? '▾' : '▸'} Texte à lire</button>
              {readOpen && <p className="camp-guide-read">{txt(x.readAloud)}</p>}
            </div>
          )}

          {nextName && (
            <div className="maps-block">
              <h4>Ensuite</h4>
              <p>➜ {next ? <b>{next.title}</b> : null} {nextName && <span className="maps-sub">à {nextName}</span>}</p>
              {nextPlace && <button className="maps-btn" onClick={() => onDest(nextPlace)}>🎯 {nextPlace.title} comme destination</button>}
            </div>
          )}

          <div className="maps-enc-ctrl">
            <button className="maps-btn gold" onClick={finish}>✓ Scène jouée, suivante</button>
          </div>
        </>
      )}
    </div>
  );
}
