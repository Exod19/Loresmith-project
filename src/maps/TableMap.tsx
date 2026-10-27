/**
 * Carte de jeu, dans la Table de jeu (MJ) : où est le groupe, où il va, les dangers proches et les sentiers
 * qui partent d'ici. On fait avancer le groupe d'un clic, on projette la carte aux joueurs, et l'on passe en
 * mode Carte (ou directement au combat) quand il faut manipuler le plateau.
 * Même carte que la page Cartes : le suivi du groupe et les révélations sont partagés.
 */
import { useEffect, useMemo, useState } from 'react';
import MapCanvas, { type Layers, type MapMark } from './atlas/MapCanvas';
import { useUnderdarkFeed } from '../feeds/underdark';
import { activateMap, ATLAS_DEFAULT_PLAN, EMPTY_OVERLAY, mapIdOf, placeCoords, type MapOverlay, type MapRecord, type PartyPlace } from './mapStore';
import { DangerChip, trailsNear } from './TrailsPanel';
import { detectLabel, passiveOf } from './atlas/trails';
import { describe } from './atlas/lore';
import { searchFor, type SearchEntry } from './battle/search';
import { trailHazard, type Hazard } from './atlas/hazards';
import TrialPanel from './TrialPanel';
import { askAI, aiReady } from '../ai/client';
import { CATEGORIES } from './atlas/model';
import { farEnd, placeNear, withPartyAt } from './party';
import { setMapIntent } from './intent';
import { mapBoard } from './playerBoard';
import { publishStage } from '../present/stage';
import type { AtlasData, AtlasFeature, FeatureCategory } from './atlas/types';
import type { Hero } from './battle/CombatPanel';
import './maps.css';
import './atlas/atlas.css';

const LAYERS: Layers = { points: true, etiquettes: true, galeries: true, connexions: true, ambiance: true };
const NO_HIDDEN = new Set<FeatureCategory>();
const KEY = 'loresmith:table-map';
/** Position de défilement de la Table de jeu, pour y revenir exactement depuis la carte de combat. */
const SCROLL_KEY = 'loresmith:table-scroll';
/** Rayon où l'on cherche ce qu'il y a à observer autour du groupe. */
const DISCOVER_RADIUS = 0.045;
/** Rayon (en fraction du plan) où l'on cherche les dangers autour du groupe. */
const DANGER_RADIUS = 0.05;

type Props = {
  maps: Record<string, MapRecord>;
  universeId?: string;
  heroes: Hero[];
  dispatch: (a: { type: string; [k: string]: unknown }) => void;
  /** Passe à la page Cartes (la carte à ouvrir est déposée dans l'intention). */
  onOpenMaps: () => void;
  /** Campagne et scène en cours : contexte pour relier un élément à l'intrigue (IA). */
  campaign?: { title: string; premise?: string } | null;
  scene?: string;
};

/** Cartes de l'univers, l'Atlas d'abord. */
const mapsOf = (maps: Record<string, MapRecord>, universeId?: string) => Object.values(maps)
  .filter((m) => !universeId || m.universeId === universeId)
  .sort((a, b) => Number(b.kind === 'atlas') - Number(a.kind === 'atlas') || a.title.localeCompare(b.title, 'fr'));
const storedChoice = () => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } };

/** Carte de jeu choisie dans la Table de jeu (pour y lancer un combat depuis ailleurs). */
export function tableMapId(maps: Record<string, MapRecord>, universeId?: string): string | null {
  const list = mapsOf(maps, universeId);
  return (list.find((m) => m.id === storedChoice()) ?? list[0])?.id ?? null;
}

export default function TableMap({ maps, universeId, heroes, dispatch, onOpenMaps, campaign, scene }: Props) {
  const list = mapsOf(maps, universeId);
  const [chosen, setChosen] = useState<string>(storedChoice);
  const rec = list.find((m) => m.id === chosen) ?? list[0] ?? null;
  const { feed, error } = useUnderdarkFeed();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; tick: number } | null>(null);
  const [projecting, setProjecting] = useState(false);
  const [open, setOpen] = useState(true);
  /** Épreuve en cours avant de suivre un sentier risqué. */
  const [trial, setTrial] = useState<{ trailId: string; trail: string; to: PartyPlace; hazard: Hazard } | null>(null);
  /** Élément à observer dont le détail est ouvert, et liens à la campagne demandés à l'IA. */
  const [openFind, setOpenFind] = useState<string | null>(null);
  const [hooks, setHooks] = useState<Record<string, { busy?: boolean; text?: string; error?: string }>>({});

  // Retour depuis la carte de combat : la Table de jeu revient là où on l'avait laissée.
  useEffect(() => {
    let y: string | null = null;
    try { y = sessionStorage.getItem(SCROLL_KEY); } catch { /* stockage indisponible */ }
    if (!y) return;
    // La page se remplit peu à peu (carte, scène) : on recale jusqu'à atteindre la position, cinq secondes au plus,
    // sauf si le MJ fait défiler lui-même. La position n'est oubliée qu'une fois atteinte (un double montage ne doit pas la perdre).
    const target = Number(y);
    let tries = 0;
    const done = () => {
      window.clearInterval(id);
      ['wheel', 'touchmove', 'keydown'].forEach((ev) => window.removeEventListener(ev, done));
      try { sessionStorage.removeItem(SCROLL_KEY); } catch { /* stockage indisponible */ }
    };
    const id = window.setInterval(() => {
      window.scrollTo({ top: target });
      if (Math.abs(window.scrollY - target) < 4 || ++tries > 50) done();
    }, 100);
    ['wheel', 'touchmove', 'keydown'].forEach((ev) => window.addEventListener(ev, done, { passive: true }));
    return () => {
      window.clearInterval(id);
      ['wheel', 'touchmove', 'keydown'].forEach((ev) => window.removeEventListener(ev, done));
    };
  }, []);

  const ready = !!rec && (rec.kind !== 'atlas' || !!feed);
  const data = ready ? activateMap(rec!, true, feed?.atlas as AtlasData) : null;
  const overlay: MapOverlay = rec?.overlay ?? EMPTY_OVERLAY;
  const party = overlay.party ?? { trail: [] };
  const planId = party.at?.planId ?? (rec?.kind === 'atlas' ? ATLAS_DEFAULT_PLAN : rec ? mapIdOf(rec) : '');
  const map = data ? data.maps.find((m) => m.id === planId) ?? data.maps[0] : null;
  const at = data && rec && party.at && map && party.at.planId === map.id ? placeCoords(data, rec, party.at) : null;

  /** Perception passive du groupe : la meilleure de ses membres. */
  const best = heroes.reduce<{ pp: number; who?: string }>((acc, h) => {
    const pp = passiveOf(Number(h.wis) || undefined, Number(h.perceptionBonus) || 0);
    return pp > acc.pp ? { pp, who: h.name } : acc;
  }, { pp: 10 });

  // Sentiers qui partent d'ici, chacun avec le lieu où il mène.
  const trails = useMemo(() => {
    if (!data || !map || !at) return [];
    return trailsNear(data, map, at, overlay.revealed, best.pp).map((t) => ({
      ...t, to: placeNear(data, map.id, farEnd(t.g, at), { radius: 0.04, exclude: party.at?.id }),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, map?.id, at?.[0], at?.[1], overlay.revealed, best.pp, party.at?.id]);

  // Dangers proches : lieux dangereux et rencontres posées autour du groupe.
  const dangers = useMemo(() => {
    if (!data || !map || !at) return [];
    const byId = new Map(data.features.map((f) => [f.id, f]));
    const out: { id: string; title: string; d: number; kind: string }[] = [];
    for (const g of data.geometries) {
      if (g.mapId !== map.id || g.type !== 'point') continue;
      const f = byId.get(g.featureId);
      if (!f || f.area) continue;
      const isEncounter = g.featureId.startsWith('mk-') && overlay.markers.some((m) => `mk-${m.id}` === g.featureId && m.kind === 'rencontre');
      if (f.category !== 'danger' && !isEncounter) continue;
      const [x, y] = g.coordinates as [number, number];
      const d = Math.hypot(x - at[0], y - at[1]);
      if (d <= DANGER_RADIUS) out.push({ id: f.id, title: f.title, d, kind: isEncounter ? 'Rencontre' : 'Danger' });
    }
    return out.sort((a, b) => a.d - b.d).slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, map?.id, at?.[0], at?.[1], overlay.markers]);

  // À observer / découvrir : lieux jouables autour du groupe (fouille, savoir), et repères posés par le MJ.
  const finds = useMemo(() => {
    if (!data || !map || !at) return [];
    const byId = new Map(data.features.map((f) => [f.id, f]));
    const out: { f: AtlasFeature; entry: SearchEntry; d: number; read: string }[] = [];
    for (const g of data.geometries) {
      if (g.mapId !== map.id || g.type !== 'point') continue;
      const f = byId.get(g.featureId);
      if (!f || f.area || f.trace) continue;
      const [x, y] = g.coordinates as [number, number];
      const d = Math.hypot(x - at[0], y - at[1]);
      if (d > DISCOVER_RADIUS) continue;
      const marker = f.id.startsWith('mk-') ? overlay.markers.find((m) => `mk-${m.id}` === f.id) : undefined;
      if (marker && marker.kind === 'rencontre') continue;
      const entry: SearchEntry | null = marker
        ? { skill: 'Investigation', dc: marker.dcInvestigate ?? 12, find: marker.reading || marker.summary || 'À décrire.', loot: marker.keep, effect: marker.effect }
        : searchFor(f.title, overlay.searchNotes?.[f.id]);
      if (!entry) continue;
      out.push({ f, entry, d, read: marker ? (marker.reading || marker.summary) : describe(f) });
    }
    return out.sort((a, b) => a.d - b.d).slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, map?.id, at?.[0], at?.[1], overlay.markers, overlay.searchNotes]);

  // Projection : la carte des joueurs suit le groupe.
  useEffect(() => {
    if (!projecting || !rec || !feed?.atlas || !map) return;
    publishStage({ kind: 'board', board: mapBoard(rec, feed.atlas as AtlasData, map.id, focus ? { kind: 'point', id: focus.id, tick: focus.tick } : undefined) });
  }, [projecting, rec, feed, map, focus]);

  if (!rec) {
    return (
      <section className="scene-card table-map">
        <div className="table-map-head"><div className="scene-label">Carte de jeu</div></div>
        <p className="scene-muted">Aucune carte pour cet univers. Ouvre la page Cartes pour en créer une, ou synchroniser l’Atlas.</p>
        <button className="maps-btn" onClick={onOpenMaps}>🗺 Ouvrir les cartes</button>
      </section>
    );
  }

  const save = (next: MapOverlay) => dispatch({ type: 'UPDATE_MAP', id: rec.id, patch: { overlay: next, updatedAt: Date.now() } });
  const focusOn = (id: string) => setFocus({ id, tick: Date.now() });
  /** Le groupe avance : par un sentier (révélé aux joueurs, avec le lieu d'arrivée), ou directement vers un lieu. */
  const move = (place: PartyPlace, trailId?: string, note?: string) => {
    let next = withPartyAt(overlay, place);
    const reveal = [trailId, place.kind === 'feature' ? place.id : undefined].filter((x): x is string => !!x && !next.revealed.includes(x));
    if (reveal.length) next = { ...next, revealed: [...next.revealed, ...reveal] };
    if (note) next = { ...next, party: { ...next.party!, log: [{ t: Date.now(), text: note }, ...(next.party?.log ?? [])].slice(0, 12) } };
    save(next);
    setSelectedId(null);
    setTrial(null);
    focusOn(place.kind === 'marker' ? `mk-${place.id}` : place.id);
  };
  /** Suivre un sentier : directement s'il est sûr ou praticable, sinon par une épreuve de passage. */
  const follow = (t: (typeof trails)[number]) => {
    if (!t.to) return;
    const hazard = trailHazard(t.f, t.profile);
    if (hazard) setTrial({ trailId: t.f.id, trail: t.f.title, to: t.to, hazard });
    else move(t.to, t.f.id);
  };
  /** Montre (ou cache) plusieurs éléments d'un coup. */
  const setShown = (ids: string[], on: boolean) => {
    const set = new Set(overlay.revealed);
    ids.forEach((id) => (on ? set.add(id) : set.delete(id)));
    save({ ...overlay, revealed: [...set] });
  };
  async function linkToCampaign(f: AtlasFeature, entry: SearchEntry) {
    setHooks((h) => ({ ...h, [f.id]: { busy: true } }));
    try {
      const text = await askAI(
        'Tu es un maître du jeu de D&D 5e. Tu relies un détail du décor à l’intrigue en cours, en français, de façon concrète et jouable.',
        `Campagne : ${campaign?.title ?? 'non précisée'}${campaign?.premise ? ` — ${campaign.premise}` : ''}.${scene ? ` Scène en cours : ${scene}.` : ''}
Lieu : ${party.at?.title ?? 'inconnu'}. Élément : ${f.title} (${describe(f)}). Fouille prévue : ${entry.skill} DC ${entry.dc}, ${entry.find}
En 3 phrases au plus : ce que les aventuriers peuvent apprendre ou trouver ici en lien avec la campagne, avec la compétence et le DC à réussir.`,
      );
      setHooks((h) => ({ ...h, [f.id]: { text } }));
    } catch (e) {
      setHooks((h) => ({ ...h, [f.id]: { error: (e as Error).message } }));
    }
  }
  const toggleReveal = (id: string) => save({ ...overlay, revealed: overlay.revealed.includes(id) ? overlay.revealed.filter((x) => x !== id) : [...overlay.revealed, id] });
  const setDest = (p?: PartyPlace) => save({ ...overlay, party: { ...party, dest: p } });
  const goMaps = (battle: boolean) => {
    try { sessionStorage.setItem(SCROLL_KEY, String(window.scrollY)); } catch { /* stockage indisponible */ }
    setMapIntent({ mapId: rec.id, battle, from: 'table' });
    onOpenMaps();
  };
  const noticed = trails.filter((t) => t.noticed && !t.shown);
  const placeId = party.at?.kind === 'feature' ? party.at.id : null;

  const selected: AtlasFeature | null = selectedId && data ? data.features.find((f) => f.id === selectedId) ?? null : null;
  const selectedPlace: PartyPlace | null = selected && map
    ? selected.id.startsWith('mk-')
      ? { id: selected.id.slice(3), kind: 'marker', title: selected.title, planId: map.id }
      : { id: selected.id, kind: 'feature', title: selected.title, planId: map.id }
    : null;
  const marks: MapMark[] = data && map ? ([['party', party.at, 'Groupe'], ['dest', party.dest, 'Destination']] as const).flatMap(([tone, p, label]) => {
    const c = p && p.planId === map.id ? placeCoords(data, rec, p) : null;
    return c ? [{ id: tone, x: c[0], y: c[1], label: `${label} · ${p!.title}`, tone }] : [];
  }) : [];

  return (
    <section className="scene-card table-map">
      <div className="table-map-head">
        <button className="table-map-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <span className="scene-label">Carte de jeu</span> <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        </button>
        {list.length > 1 && (
          <select className="maps-btn" value={rec.id} onChange={(e) => { setChosen(e.target.value); try { localStorage.setItem(KEY, e.target.value); } catch { /* stockage indisponible */ } }}>
            {list.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        )}
        <div className="table-map-actions">
          <button className={`maps-btn ${projecting ? 'gold' : ''}`} onClick={() => { if (projecting) { setProjecting(false); publishStage({ kind: 'blank' }); } else { setProjecting(true); if (party.at) focusOn(party.at.kind === 'marker' ? `mk-${party.at.id}` : party.at.id); } }} disabled={rec.kind === 'atlas' && !feed}>
            {projecting ? '■ Arrêter la projection' : '▶ Projeter aux joueurs'}
          </button>
          <button className="maps-btn" onClick={() => goMaps(false)} title="Ouvrir cette carte en mode Carte (repères, révélations, construction)">🗺 Mode Carte</button>
          <button className="maps-btn gold" onClick={() => goMaps(true)} disabled={!party.at} title={party.at ? `Carte de combat : ${party.at.title}` : 'Place d’abord le groupe'}>⚔ Combat ici</button>
        </div>
      </div>

      {open && party.at && (
        <div className="table-map-quick" role="group" aria-label="Révélations rapides">
          <button className="maps-btn gold" disabled={!noticed.length} onClick={() => setShown(noticed.map((t) => t.f.id), true)} title="Sentiers évidents ou repérés grâce à la Perception passive du groupe">
            👁 Sentiers évidents ({noticed.length})
          </button>
          <button className="maps-btn" disabled={!trails.some((t) => !t.shown)} onClick={() => setShown(trails.map((t) => t.f.id), true)}>Montrer tous les sentiers d’ici</button>
          <button className="maps-btn" disabled={!trails.some((t) => t.shown)} onClick={() => setShown(trails.map((t) => t.f.id), false)}>Cacher les sentiers d’ici</button>
          {placeId && (
            <button className="maps-btn" onClick={() => toggleReveal(placeId)}>{overlay.revealed.includes(placeId) ? '🙈 Cacher ce lieu' : '👁 Montrer ce lieu'}</button>
          )}
          {finds.length > 0 && (
            <button className="maps-btn" disabled={finds.every((x) => overlay.revealed.includes(x.f.id) || x.f.id.startsWith('mk-'))} onClick={() => setShown(finds.filter((x) => !x.f.id.startsWith('mk-')).map((x) => x.f.id), true)}>
              Montrer les éléments visibles
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="table-map-body">
          <div className="table-map-canvas">
            {!ready || !map ? (
              <p className="scene-muted">{error ?? 'Chargement des Archives…'}</p>
            ) : (
              <MapCanvas
                key={map.id} map={map} layers={LAYERS} hidden={NO_HIDDEN} dm
                selectedId={selectedId} onSelect={(f) => setSelectedId(f.id)} onAnchor={() => {}}
                dataKey={rec.updatedAt} marks={marks}
                focus={focus ? { kind: 'point', id: focus.id } : party.at ? { kind: party.at.kind === 'anchor' ? 'anchor' : 'point', id: party.at.kind === 'marker' ? `mk-${party.at.id}` : party.at.id } : null}
                focusKey={focus ? String(focus.tick) : party.at ? `party-${party.at.id}` : undefined}
              />
            )}
          </div>

          <aside className="table-map-side">
            <div className="table-map-where">
              <div>📍 {party.at ? <>Le groupe est à <b>{party.at.title}</b></> : <span className="scene-muted">Position du groupe inconnue : clique un lieu sur la carte, puis « Le groupe y va ».</span>}</div>
              <div>🎯 {party.dest ? <>Vers <b>{party.dest.title}</b> <button className="maps-link" onClick={() => setDest(undefined)} aria-label="Retirer la destination">×</button></> : <span className="scene-muted">Pas de destination</span>}</div>
              {party.trail.length > 0 && <div className="table-map-trail">{[...party.trail, ...(party.at ? [party.at] : [])].map((p) => p.title).join(' › ')}</div>}
              {party.log?.length ? (
                <details className="table-map-log">
                  <summary>Journal de route ({party.log.length})</summary>
                  <ul>{party.log.map((l) => <li key={l.t}>{l.text}</li>)}</ul>
                </details>
              ) : null}
            </div>

            {trial && (
              <TrialPanel
                trail={trial.trail} to={trial.to.title} hazard={trial.hazard} heroes={heroes}
                onPass={(summary) => move(trial.to, trial.trailId, summary)}
                onCancel={() => setTrial(null)}
              />
            )}

            {selected && selectedPlace && (
              <div className="table-map-sel">
                <b>{selected.title}</b> <small className="scene-muted">{CATEGORIES[selected.category]?.label}</small>
                <p>{describe(selected) || ' '}</p>
                <div className="table-map-btns">
                  <button className="maps-btn gold" onClick={() => move(selectedPlace)} disabled={party.at?.id === selectedPlace.id}>📍 Le groupe y va</button>
                  <button className="maps-btn" onClick={() => setDest(party.dest?.id === selectedPlace.id ? undefined : selectedPlace)}>{party.dest?.id === selectedPlace.id ? '🎯 Retirer' : '🎯 Destination'}</button>
                  {!selected.id.startsWith('mk-') && (
                    <button className="maps-btn" onClick={() => toggleReveal(selected.id)}>{overlay.revealed.includes(selected.id) ? '🙈 Cacher' : '👁 Montrer'}</button>
                  )}
                </div>
              </div>
            )}

            {dangers.length > 0 && (
              <div className="table-map-block">
                <div className="scene-label">Dangers proches</div>
                <ul className="table-map-list">
                  {dangers.map((d) => (
                    <li key={d.id}>
                      <span className="table-map-warn">⚠</span>
                      <button className="maps-link" onClick={() => { setSelectedId(d.id); focusOn(d.id); }}>{d.title}</button>
                      <small className="scene-muted">{d.kind} · {d.d < 0.02 ? 'tout près' : 'à proximité'}</small>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {finds.length > 0 && (
              <div className="table-map-block">
                <div className="scene-label">À observer · découvrir</div>
                <ul className="table-map-list table-map-finds">
                  {finds.map(({ f, entry, read }) => {
                    const isOpen = openFind === f.id;
                    const hook = hooks[f.id];
                    const shown = overlay.revealed.includes(f.id);
                    return (
                      <li key={f.id} className={isOpen ? 'is-open' : ''}>
                        <button className="maps-link table-map-find" onClick={() => { setOpenFind(isOpen ? null : f.id); focusOn(f.id); }} aria-expanded={isOpen}>
                          {isOpen ? '▾' : '▸'} {f.title}
                        </button>
                        <small className="place-dc">{entry.skill} {entry.dc}</small>
                        {!f.id.startsWith('mk-') && <button className="place-eye" onClick={() => toggleReveal(f.id)} title={shown ? 'Visible des joueurs' : 'Caché aux joueurs'}>{shown ? '👁' : '🙈'}</button>}
                        {isOpen && (
                          <div className="table-map-find-body">
                            {read && <blockquote className="table-map-read">{read}</blockquote>}
                            <dl>
                              <dt>Pour trouver ou apprendre</dt><dd><b>{entry.skill} DC {entry.dc}</b> — {entry.find}</dd>
                              {entry.loot && <><dt>Butin</dt><dd>{entry.loot}</dd></>}
                              {entry.effect && <><dt>Effet</dt><dd>{entry.effect}</dd></>}
                            </dl>
                            {!f.id.startsWith('mk-') && (
                              <button className="maps-btn" disabled={hook?.busy || !aiReady()} title={aiReady() ? 'Relier cet élément à la campagne en cours' : 'Configure une clé d’IA dans Réglages'} onClick={() => linkToCampaign(f, entry)}>
                                {hook?.busy ? 'L’IA cherche…' : '✨ Lien avec la campagne'}
                              </button>
                            )}
                            {hook?.text && <p className="table-map-hook">{hook.text}</p>}
                            {hook?.error && <p className="combat-ai-error">{hook.error}</p>}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {party.at && (
              <div className="table-map-block">
                <div className="scene-label">Avancer · sentiers d’ici <small>(PP {best.pp}{best.who ? `, ${best.who}` : ''})</small></div>
                {trails.length === 0 && <p className="scene-muted">Aucun sentier ne part d’ici sur ce plan.</p>}
                <ul className="table-map-list">
                  {trails.map((t) => (
                    <li key={t.f.id} data-on={t.shown ? 1 : 0}>
                      <DangerChip profile={t.profile} />
                      <span className="table-map-trail-name">
                        {t.f.title}{t.to ? <small> → {t.to.title}</small> : null}
                        <small className={`trails-dc ${t.noticed ? 'is-noticed' : ''}`}> · {detectLabel(t.profile.detect)}{t.noticed ? ' · vu' : ''}</small>
                      </span>
                      <button className="place-eye" onClick={() => toggleReveal(t.f.id)} title={t.shown ? 'Visible des joueurs' : 'Caché aux joueurs'}>{t.shown ? '👁' : '🙈'}</button>
                      {t.to && (
                        <button className="maps-btn gold" onClick={() => follow(t)} title={`Le groupe suit ${t.f.title} jusqu’à ${t.to.title}${t.profile.danger.level >= 3 ? ' (épreuve de passage)' : ''}`}>
                          {t.profile.danger.level >= 3 ? 'Suivre 🎲' : 'Suivre ➜'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
