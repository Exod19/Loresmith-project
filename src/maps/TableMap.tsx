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
/** Rayon (en fraction du plan) où l'on cherche les dangers autour du groupe. */
const DANGER_RADIUS = 0.05;

type Props = {
  maps: Record<string, MapRecord>;
  universeId?: string;
  heroes: Hero[];
  dispatch: (a: { type: string; [k: string]: unknown }) => void;
  /** Passe à la page Cartes (la carte à ouvrir est déposée dans l'intention). */
  onOpenMaps: () => void;
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

export default function TableMap({ maps, universeId, heroes, dispatch, onOpenMaps }: Props) {
  const list = mapsOf(maps, universeId);
  const [chosen, setChosen] = useState<string>(storedChoice);
  const rec = list.find((m) => m.id === chosen) ?? list[0] ?? null;
  const { feed, error } = useUnderdarkFeed();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; tick: number } | null>(null);
  const [projecting, setProjecting] = useState(false);
  const [open, setOpen] = useState(true);

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
  const move = (place: PartyPlace, trailId?: string) => {
    let next = withPartyAt(overlay, place);
    const reveal = [trailId, place.kind === 'feature' ? place.id : undefined].filter((x): x is string => !!x && !next.revealed.includes(x));
    if (reveal.length) next = { ...next, revealed: [...next.revealed, ...reveal] };
    save(next);
    setSelectedId(null);
    focusOn(place.kind === 'marker' ? `mk-${place.id}` : place.id);
  };
  const toggleReveal = (id: string) => save({ ...overlay, revealed: overlay.revealed.includes(id) ? overlay.revealed.filter((x) => x !== id) : [...overlay.revealed, id] });
  const setDest = (p?: PartyPlace) => save({ ...overlay, party: { ...party, dest: p } });
  const goMaps = (battle: boolean) => { setMapIntent({ mapId: rec.id, battle }); onOpenMaps(); };

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
            </div>

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
                      {t.to && <button className="maps-btn gold" onClick={() => move(t.to!, t.f.id)} title={`Le groupe suit ${t.f.title} jusqu’à ${t.to.title}`}>Suivre ➜</button>}
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
