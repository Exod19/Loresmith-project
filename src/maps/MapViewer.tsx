/**
 * Visionneuse de carte : plan interactif, repères, rencontres, combat sur grille, et projection vers l'écran joueur.
 * Mode MJ : tout est visible, notes comprises. La projection montre aux joueurs ce qu'ils doivent voir, et se met à jour en direct.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import MapCanvas, { type Layers, type MapMark } from './atlas/MapCanvas';
import { CATEGORIES } from './atlas/model';
import { describe as describeFeature, dmFeature } from './atlas/lore';
import { rollEncounter, type EncCtx, type Encounter, type Zone } from './atlas/encounters';
import { STATS, SRD_CREDIT, mod, type Stat } from './atlas/statblocks';
import type { AtlasData, AtlasFeature, FeatureCategory } from './atlas/types';
import {
  activateMap, ATLAS_DEFAULT_PLAN, DEFAULT_BATTLE, EMPTY_OVERLAY, mapIdOf, placeCoords,
  type MapMarker, type MapOverlay, type MapRecord, type MarkerKind, type PartyPlace, type PartyTrack, type PassageLink, type PointRecord,
} from './mapStore';
import { battleBoard, mapBoard } from './playerBoard';
import BattleMode, { type CombatSlot } from './battle/BattleMode';
import type { Hero } from './battle/CombatPanel';
import TrailsPanel, { DangerChip, trailsNear } from './TrailsPanel';
import { placeNear, withPartyAt } from './party';
import { detectLabel, noticedPassively, passiveOf, trailProfile } from './atlas/trails';
import Interactables from './Interactables';
import CampaignGuide, { type BestiaryRef, type GuideCampaign, type GuidePlace } from './CampaignGuide';
import { publishStage } from '../present/stage';
import './maps.css';

const LAYERS: Layers = { points: true, etiquettes: true, galeries: true, connexions: true, ambiance: true };
const ZONES: { v: Zone; l: string }[] = [{ v: 'sauvage', l: 'Sauvage' }, { v: 'transit', l: 'Transit' }, { v: 'cite', l: 'Cité' }];
const KIND_LABEL: Record<MarkerKind, string> = { rencontre: 'Rencontre', passage: 'Passage secret', objet: 'Objet', repere: 'Repère' };
const KIND_ICON: Record<MarkerKind, string> = { rencontre: '⚔', passage: '🗝', objet: '◆', repere: '◆' };
const DEFAULT_TITLE: Record<MarkerKind, string> = { rencontre: 'Rencontre', passage: 'Passage secret', objet: 'Objet', repere: 'Repère' };
const uid = () => Math.random().toString(36).slice(2, 10);

/** Repère en cours de placement : le prochain clic sur la carte le crée. */
type Draft = { kind: MarkerKind; title: string; summary?: string; notes?: string; groups?: MapMarker['groups'] };

export default function MapViewer({ rec, atlas, dm, onDm, onUpdate, onBack, heroes = [], startInBattle = false, onReturn, renderCombat, campaigns = [], activeCampaignId, onCampaign, onCampaignProgress, bestiary = [], artOf }: {
  rec: MapRecord; atlas: AtlasData; dm: boolean; onDm: (v: boolean) => void;
  /** Illustration d'une créature par son nom, pour l'écran joueur. */
  artOf?: (name: string, id: string) => string;
  onUpdate: (patch: Partial<MapRecord>) => void; onBack: () => void;
  /** Personnages du groupe, pour les ajouter au combat. */
  heroes?: Hero[];
  /** Ouverte depuis la Table de jeu pour un combat : la carte de combat du lieu du groupe s'affiche d'emblée. */
  startInBattle?: boolean;
  /** Ouverte depuis la Table de jeu : y revenir d'un clic, là où on l'avait laissée. */
  onReturn?: () => void;
  /** Module Combat de l'application, affiché sous la carte de combat. */
  renderCombat?: (slot: CombatSlot) => ReactNode;
  /** Campagnes de l'univers, et celle qui est invoquée sur la carte. */
  campaigns?: GuideCampaign[];
  activeCampaignId?: string;
  onCampaign?: (id: string) => void;
  onCampaignProgress?: (id: string, progress: { sceneId?: string; done?: string[] }) => void;
  /** Fiches de PNJ & Créatures (jetons, PV, CA) pour les rencontres et le combat. */
  bestiary?: BestiaryRef[];
}) {
  const data = activateMap(rec, dm, atlas);
  // Le plan affiché d'abord : celui où se trouve le groupe, s'il est connu.
  const [planId, setPlanId] = useState(rec.overlay?.party?.at?.planId ?? (rec.kind === 'atlas' ? ATLAS_DEFAULT_PLAN : mapIdOf(rec)));
  /** Carte de combat ouverte à la place de la carte de navigation (même mise en page). */
  const [battleOpen, setBattleOpen] = useState(startInBattle);
  const [projecting, setProjecting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enc, setEnc] = useState<{ ctx: EncCtx; e: Encounter } | null>(null);
  const [placing, setPlacing] = useState<Draft | null>(null);
  /** Lieu que les joueurs doivent voir au centre de l'écran (demandé depuis la fiche). */
  const [focus, setFocus] = useState<{ kind: 'anchor' | 'point'; id: string; tick: number } | null>(null);

  const overlay = rec.overlay ?? EMPTY_OVERLAY;
  const map = data.maps.find((m) => m.id === planId) ?? data.maps[0];
  const markers = overlay.markers.filter((m) => m.planId === map.id);
  const markerId = selectedId?.startsWith('mk-') ? selectedId.slice(3) : null;
  const selectedMarker = markers.find((m) => m.id === markerId) ?? null;
  const feature = !markerId && selectedId ? data.features.find((f) => f.id === selectedId) ?? null : null;
  const point = rec.points?.find((p) => p.id === selectedId) ?? null;
  const party: PartyTrack = overlay.party ?? { trail: [] };
  /** Où est le groupe, quand rien n'est sélectionné : la carte de combat garde son lieu d'un passage à l'autre. */
  const partyFeature = !selectedId && party.at?.kind === 'feature' && party.at.planId === map.id ? data.features.find((f) => f.id === party.at!.id) ?? null : null;
  const partyMarker = !selectedId && party.at?.kind === 'marker' && party.at.planId === map.id ? markers.find((m) => m.id === party.at!.id) ?? null : null;
  const hintFeature = feature ?? partyFeature;
  const hintMarker = selectedMarker ?? partyMarker;
  /** Lieu courant (lieu de l'Atlas, point perso ou repère) : c'est lui qui donne le terrain de la carte de combat. */
  const locationHint = hintFeature
    ? { id: hintFeature.id, title: hintFeature.title, category: hintFeature.category, trace: hintFeature.trace, text: [hintFeature.subtitle, describeFeature(hintFeature)].filter(Boolean).join(' ') }
    : hintMarker
      ? { id: `mk-${hintMarker.id}`, title: hintMarker.title, category: hintMarker.kind === 'rencontre' ? 'danger' : 'indetermine', trace: hintMarker.kind === 'passage' ? 'secret' : undefined, text: hintMarker.summary, groups: hintMarker.groups }
      : null;

  /** Perception passive du groupe : la meilleure de ses membres (10 + Sagesse). */
  const best = heroes.reduce<{ pp: number; who?: string }>((acc, h) => {
    const pp = passiveOf(Number(h.wis) || undefined, Number(h.perceptionBonus) || 0);
    return pp > acc.pp ? { pp, who: h.name } : acc;
  }, { pp: 10 });
  /** Sentiers qui partent de la position du groupe, sur le plan affiché. */
  const partyAt = party.at && party.at.planId === map.id ? placeCoords(data, rec, party.at) : null;
  const trails = useMemo(
    () => (partyAt && rec.kind === 'atlas' ? trailsNear(data, map, partyAt, overlay.revealed, best.pp) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, map.id, partyAt?.[0], partyAt?.[1], overlay.revealed, best.pp, rec.kind],
  );

  /** Repères du groupe sur le plan affiché (MJ) : où il est, et où il veut aller. */
  const partyMarks: MapMark[] = ([['party', party.at, 'Groupe'], ['dest', party.dest, 'Destination']] as const).flatMap(([tone, p, label]) => {
    const at = p && p.planId === map.id ? placeCoords(data, rec, p) : null;
    return at ? [{ id: tone, x: at[0], y: at[1], label: `${label} · ${p!.title}`, tone }] : [];
  });
  /**
   * Où arrive le groupe en suivant un passage. Une ancre (entrée d'un autre plan) n'est pas un lieu :
   * le groupe se retrouve au lieu nommé le plus proche, pour que la carte de combat ait un endroit à montrer.
   */
  const arrivalOf = (link: PassageLink): PartyPlace => {
    const fallback: PartyPlace = { id: link.id, kind: link.kind, title: link.label.split(' · ')[0], planId: link.planId };
    if (link.kind !== 'anchor') return fallback;
    const a = data.anchors.find((x) => x.id === link.id);
    if (!a) return fallback;
    return placeNear(data, link.planId, a.at as [number, number], { name: link.label.split(' · ')[0] }) ?? fallback;
  };

  /** Le lieu sélectionné, tel que le suivi du groupe le retient. */
  const selectedPlace: PartyPlace | null = feature
    ? { id: feature.id, kind: 'feature', title: feature.title, planId: map.id }
    : selectedMarker ? { id: selectedMarker.id, kind: 'marker', title: selectedMarker.title, planId: map.id } : null;
  const setDest = (p: PartyPlace | undefined) => setOverlay({ ...overlay, party: { ...party, dest: p } });
  /** Montre un lieu suivi sur la carte de navigation (et le sélectionne). */
  const showPlace = (p: PartyPlace) => {
    setBattleOpen(false);
    setPlanId(p.planId);
    setSelectedId(p.kind === 'marker' ? `mk-${p.id}` : p.kind === 'feature' ? p.id : null);
    setFocus({ kind: p.kind === 'anchor' ? 'anchor' : 'point', id: p.kind === 'marker' ? `mk-${p.id}` : p.id, tick: Date.now() });
  };
  /** Ouvre la carte de combat du lieu sélectionné (le groupe y est), ou de la position du groupe. */
  const openBattle = () => {
    if (selectedPlace && party.at?.id !== selectedPlace.id) setOverlay(withPartyAt(overlay, selectedPlace));
    setBattleOpen(true);
  };

  /** Lieux nommés de la carte (tous plans) : la campagne invoquée y retrouve ses scènes par leur nom. */
  const guidePlaces = useMemo<GuidePlace[]>(() => {
    if (!campaigns.length) return [];
    const planTitle = new Map(data.maps.map((m) => [m.id, m.title]));
    const byId = new Map(data.features.map((f) => [f.id, f]));
    const out: GuidePlace[] = [];
    const seen = new Set<string>();
    for (const g of data.geometries) {
      if (g.featureId.startsWith('mk-') || seen.has(g.featureId)) continue;
      const f = byId.get(g.featureId);
      if (!f || f.trace) continue;
      seen.add(f.id);
      out.push({ id: f.id, kind: 'feature', title: f.title, planId: g.mapId, plan: planTitle.get(g.mapId) });
    }
    for (const m of overlay.markers) out.push({ id: m.id, kind: 'marker', title: m.title, planId: m.planId, plan: planTitle.get(m.planId) });
    return out;
  }, [data, overlay.markers, campaigns.length]);

  /** Rencontre de la campagne : posée au lieu de la scène s'il est sur la carte, sinon au prochain clic. */
  const placeCampaignEncounter = (enc: { name?: string; detail?: string; tactics?: string; complication?: string; nonCombatResolution?: string }, groups: MapMarker['groups'], at: GuidePlace | null) => {
    const draft: Draft = {
      kind: 'rencontre',
      title: enc.name || DEFAULT_TITLE.rencontre,
      summary: enc.detail ?? '',
      notes: [enc.tactics && `Tactique : ${enc.tactics}`, enc.complication && `Complication : ${enc.complication}`, enc.nonCombatResolution && `Sans combat : ${enc.nonCombatResolution}`].filter(Boolean).join('\n'),
      groups,
    };
    const xy = at ? placeCoords(data, rec, at) : null;
    if (at && xy) createMarker(draft, xy[0] + 0.004, xy[1] + 0.004, at.planId);
    else { setBattleOpen(false); setPlacing(draft); }
  };

  /** Lieux de l'atlas présents sur le plan : « tout révéler » ne touche qu'à ceux-là. */
  const planFeatureIds = useMemo(
    () => (rec.kind === 'atlas' ? atlas.geometries.filter((g) => g.mapId === map.id).map((g) => g.featureId) : []),
    [atlas, map.id, rec.kind],
  );

  // Fonction changée à chaque rendu : lue par référence pour ne pas relancer la projection.
  const artRef = useRef(artOf);
  artRef.current = artOf;

  // Projection : toute modification de la carte, du repérage ou du combat part vers l'écran joueur.
  useEffect(() => {
    if (!projecting) return;
    publishStage({ kind: 'board', board: battleOpen ? battleBoard(rec, (name, id) => artRef.current?.(name, id) ?? '') : mapBoard(rec, atlas, map.id, focus ?? undefined) });
  }, [projecting, battleOpen, rec, atlas, map.id, focus]);

  /** Amène la vue joueurs sur ce lieu : le révèle si besoin, centre la carte chez eux, et démarre la projection. */
  const bringPlayers = (id: string) => {
    if (rec.kind === 'atlas' && !overlay.revealed.includes(id)) toggleReveal(id);
    setFocus({ kind: 'point', id, tick: Date.now() });
    setProjecting(true);
  };

  /** Suit le passage jusqu'à sa destination, sur la carte de navigation. Une porte qui mène ailleurs s'ouvre pour les joueurs. */
  const followPassage = (link: PassageLink) => {
    // Une seule écriture : la porte s'ouvre, le lieu devient visible, et le groupe s'y déplace.
    let next = overlay;
    if (link.kind === 'marker') next = { ...next, markers: next.markers.map((m) => (m.id === link.id ? { ...m, revealed: true } : m)) };
    // Un lieu de l'Atlas qui n'est pas encore visible devient visible au passage.
    if (link.kind === 'feature' && rec.kind === 'atlas' && !next.revealed.includes(link.id)) next = { ...next, revealed: [...next.revealed, link.id] };
    next = withPartyAt(next, arrivalOf(link));
    setOverlay(next);
    setBattleOpen(false);
    setPlanId(link.planId);
    setSelectedId(null);
    setFocus({ kind: link.kind === 'anchor' ? 'anchor' : 'point', id: link.kind === 'anchor' ? link.id : link.kind === 'feature' ? link.id : `mk-${link.id}`, tick: Date.now() });
  };

  /** Inscrit (ou efface) la destination d'un passage. */
  const setPassageLink = (passageId: string, link: PassageLink | null) => {
    const links = { ...(overlay.passageLinks ?? {}) };
    if (link) links[passageId] = link; else delete links[passageId];
    setOverlay({ ...overlay, passageLinks: links });
  };

  function stopProjecting() {
    setProjecting(false);
    publishStage({ kind: 'blank' });
  }

  const setOverlay = (next: MapOverlay) => onUpdate({ overlay: next, updatedAt: Date.now() });
  const toggleReveal = (id: string) => setOverlay({
    ...overlay,
    revealed: overlay.revealed.includes(id) ? overlay.revealed.filter((x) => x !== id) : [...overlay.revealed, id],
  });
  const revealPlan = (on: boolean) => {
    const ids = new Set(overlay.revealed);
    planFeatureIds.forEach((id) => (on ? ids.add(id) : ids.delete(id)));
    setOverlay({ ...overlay, revealed: [...ids] });
  };

  function addMarker(x: number, y: number) {
    if (!placing) return;
    createMarker(placing, x, y, map.id);
  }
  function createMarker(draft: Draft, x: number, y: number, planOf: string) {
    const m: MapMarker = {
      id: uid(), kind: draft.kind, title: draft.title || DEFAULT_TITLE[draft.kind], planId: planOf, x, y,
      summary: draft.summary ?? '', notes: draft.notes ?? '', revealed: false, groups: draft.groups,
    };
    setPlacing(null);
    if (planOf !== map.id) setPlanId(planOf);
    setSelectedId(`mk-${m.id}`);
    if (m.kind === 'rencontre') {
      // Nouvelle rencontre : on oublie le plateau précédent et on ouvre la carte de combat de ce lieu, avec ses créatures.
      onUpdate({ overlay: { ...overlay, markers: [...overlay.markers, m] }, updatedAt: Date.now(), battle: { ...DEFAULT_BATTLE, tokens: [] } });
      setBattleOpen(true);
      return;
    }
    setOverlay({ ...overlay, markers: [...overlay.markers, m] });
  }
  const updateMarker = (id: string, patch: Partial<MapMarker>) => setOverlay({
    ...overlay, markers: overlay.markers.map((m) => (m.id === id ? { ...m, ...patch } : m)),
  });
  const removeMarker = (id: string) => {
    setOverlay({ ...overlay, markers: overlay.markers.filter((m) => m.id !== id) });
    setSelectedId(null);
  };

  return (
    <div className={`atlas-page maps-viewer ${battleOpen && renderCombat ? 'has-encounter' : ''}`}>
      <div className="maps-toolbar">
        {onReturn && <button className="maps-btn gold" onClick={onReturn} title="Revenir à la Table de jeu, là où tu l’avais laissée">← Table de jeu</button>}
        {battleOpen
          ? <button className="maps-btn" onClick={() => setBattleOpen(false)}>← Carte de navigation</button>
          : <button className="maps-btn" onClick={onBack}>← Cartes</button>}
        <strong className="maps-title">{rec.title}</strong>
        {rec.kind === 'atlas' && !battleOpen && (
          <select className="maps-btn" value={planId} onChange={(e) => { setPlanId(e.target.value); setSelectedId(null); setPlacing(null); }}>
            {atlas.maps.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        )}
        {!battleOpen && <button className="maps-btn" onClick={openBattle} title={locationHint ? `Carte de combat : ${locationHint.title}` : 'Sélectionne un lieu, ou place le groupe'}>⚔ Ouvrir la carte de combat</button>}
        <div className="maps-spacer" />
        <button className={`maps-btn ${projecting ? 'gold' : ''}`} onClick={() => (projecting ? stopProjecting() : setProjecting(true))}>
          {projecting ? '■ Arrêter la projection' : '▶ Projeter aux joueurs'}
        </button>
        {!battleOpen && (
          <div className="maps-seg" role="group" aria-label="Affichage">
            <button className={dm ? 'on' : ''} onClick={() => onDm(true)}>MJ</button>
            <button className={!dm ? 'on' : ''} onClick={() => onDm(false)}>Joueurs</button>
          </div>
        )}
      </div>
      {dm && (
        <PartyBar
          party={party} inBattle={battleOpen}
          onShow={showPlace}
          onBattle={(p) => { setPlanId(p.planId); setSelectedId(p.kind === 'marker' ? `mk-${p.id}` : p.kind === 'feature' ? p.id : null); setBattleOpen(true); }}
          onClearDest={() => setDest(undefined)}
        />
      )}
      {projecting && (
        <p className="maps-live">● Écran joueur : {battleOpen ? `carte de combat (${rec.title})` : map.title} · mis à jour en direct</p>
      )}

      {battleOpen ? (
        <BattleMode
          rec={rec} battle={rec.battle ?? DEFAULT_BATTLE} context={locationHint}
          atlas={data} plan={map} markers={overlay.markers}
          onFollow={followPassage} onLink={setPassageLink} onMarker={(id, patch) => updateMarker(id, patch)}
          onReveal={(id) => toggleReveal(id)}
          onBattle={(b) => onUpdate({ battle: b, updatedAt: Date.now() })}
          heroes={heroes} party={party} bestiary={bestiary} renderCombat={renderCombat}
          onSearchNote={(id, note) => {
            const notesMap = { ...(overlay.searchNotes ?? {}) };
            if (note) notesMap[id] = note; else delete notesMap[id];
            setOverlay({ ...overlay, searchNotes: notesMap });
          }}
        />
      ) : (
        <div className="maps-body">
          <div className="maps-canvas">
            <MapCanvas
              key={map.id}
              map={map}
              layers={LAYERS}
              hidden={new Set<FeatureCategory>()}
              selectedId={selectedId}
              onSelect={(f: AtlasFeature) => { setSelectedId(f.id); setEnc(null); }}
              marks={dm ? partyMarks : []}
              onAnchor={() => {}}
              onPlace={dm && placing ? addMarker : undefined}
              dataKey={rec.updatedAt}
              focus={focus ? { kind: 'point', id: focus.id } : null}
              focusKey={focus ? String(focus.tick) : undefined}
              dm={dm}
            />
          </div>

          <aside className="maps-panel">
            {dm && campaigns.length > 0 && (
              <CampaignGuide
                campaigns={campaigns}
                activeId={activeCampaignId}
                onPick={(id) => onCampaign?.(id)}
                onProgress={(c, progress) => onCampaignProgress?.(c.id, progress)}
                places={guidePlaces}
                partyAt={party.at}
                bestiary={bestiary}
                onShow={showPlace}
                onDest={(p) => setDest({ id: p.id, kind: p.kind, title: p.title, planId: p.planId })}
                onPartyHere={(p) => setOverlay(withPartyAt(overlay, { id: p.id, kind: p.kind, title: p.title, planId: p.planId }))}
                onEncounter={(enc, groups, at) => placeCampaignEncounter(enc, groups, at)}
                onMarkPlace={(title, summary) => setPlacing({ kind: 'objet', title, summary })}
              />
            )}
            {dm && placing && (
              <p className="maps-hint maps-placing">
                Clique sur la carte pour placer « {placing.title} ». <button className="maps-link" onClick={() => setPlacing(null)}>Annuler</button>
              </p>
            )}

            {dm && selectedMarker && (
              <MarkerEditor
                m={selectedMarker}
                onChange={(patch) => updateMarker(selectedMarker.id, patch)}
                onRemove={() => { if (window.confirm(`Supprimer « ${selectedMarker.title} » ?`)) removeMarker(selectedMarker.id); }}
                onClose={() => setSelectedId(null)}
              />
            )}

            {feature && !markerId && (
              <FeaturePanel
                f={feature} dm={dm} notes={point?.notes ?? ''}
                defaultCtx={{ zone: point?.zone ?? 'sauvage', depth: point?.depth ?? 3, place: feature.title }}
                onClose={() => setSelectedId(null)}
                onRoll={(ctx) => setEnc({ ctx, e: rollEncounter(ctx) })}
                onBring={() => bringPlayers(feature.id)}
                revealed={rec.kind === 'atlas' ? overlay.revealed.includes(feature.id) : undefined}
                onToggleReveal={rec.kind === 'atlas' ? () => toggleReveal(feature.id) : undefined}
                passive={best.pp}
                partyHere={party.at?.id === feature.id} partyDest={party.dest?.id === feature.id}
                onPartyHere={() => setOverlay(withPartyAt(overlay, { id: feature.id, kind: 'feature', title: feature.title, planId: map.id }))}
                onPartyDest={() => setDest(party.dest?.id === feature.id ? undefined : { id: feature.id, kind: 'feature', title: feature.title, planId: map.id })}
              />
            )}

            {!feature && !selectedMarker && (
              <p className="maps-hint">
                {dm
                  ? 'Touche un lieu pour le lire, ou place un repère ci-dessous. Tout ce que tu révèles apparaît en direct chez les joueurs.'
                  : 'Mode joueurs : seules les informations partagées sont visibles.'}
              </p>
            )}

            {dm && party.at && partyAt && (
              <TrailsPanel
                placeTitle={party.at.title} trails={trails} passive={best.pp} passiveWho={best.who}
                onToggle={(id) => toggleReveal(id)}
                onSelect={(f) => { setSelectedId(f.id); setEnc(null); }}
                onRevealNoticed={() => setOverlay({ ...overlay, revealed: [...new Set([...overlay.revealed, ...trails.filter((t) => t.noticed).map((t) => t.f.id)])] })}
              />
            )}

            {dm && rec.kind === 'atlas' && (
              <div className="maps-card">
                <h3>Révélations</h3>
                <p className="maps-sub">{overlay.revealed.length} lieu(x) visible(s) des joueurs, sur l'ensemble de l'Atlas.</p>
                <div className="maps-enc-ctrl">
                  <button className="maps-btn" onClick={() => revealPlan(true)}>Tout révéler sur ce plan</button>
                  <button className="maps-btn" onClick={() => revealPlan(false)}>Tout cacher sur ce plan</button>
                </div>
              </div>
            )}

            {dm && markers.some((m) => m.kind === 'rencontre') && (
              <div className="maps-card">
                <h3>Rencontres placées</h3>
                <ul className="maps-list">
                  {markers.filter((m) => m.kind === 'rencontre').map((m) => (
                    <li key={m.id} data-on={selectedId === `mk-${m.id}` ? 1 : 0}>
                      <button className="maps-link" onClick={() => setSelectedId(`mk-${m.id}`)}>{KIND_ICON[m.kind]} {m.title}</button>
                      <button className="maps-btn" onClick={() => updateMarker(m.id, { revealed: !m.revealed })}>
                        {m.revealed ? 'Visible' : 'Caché'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {dm && enc && (
              <EncounterBox
                enc={enc}
                onRoll={(force) => setEnc({ ctx: enc.ctx, e: rollEncounter(enc.ctx, force) })}
                onPlace={() => setPlacing({
                  kind: 'rencontre',
                  title: enc.e.entry?.title ?? DEFAULT_TITLE.rencontre,
                  summary: [enc.e.entry?.text, enc.e.attitude, enc.e.wants && `Veut : ${enc.e.wants}`].filter(Boolean).join('\n'),
                  notes: [enc.e.check, enc.e.entry?.hook && `Accroche : ${enc.e.entry.hook}`].filter(Boolean).join('\n'),
                  groups: enc.e.groups,
                })}
              />
            )}

            {dm && rec.kind === 'custom' && (
              <PointEditor rec={rec} onUpdate={onUpdate} selectedId={selectedId} onSelect={setSelectedId} />
            )}
          </aside>
        </div>
      )}

      {dm && !battleOpen && (
        <Interactables
          markers={markers.filter((m) => m.kind !== 'rencontre')}
          onChange={(id, patch) => updateMarker(id, patch)}
          onRemove={(id) => removeMarker(id)}
          onAdd={(kind) => setPlacing({ kind, title: DEFAULT_TITLE[kind] })}
        />
      )}

      <p className="maps-footer">
        {dm && rec.kind === 'atlas' && <>Statistiques : {SRD_CREDIT} </>}
        {rec.kind === 'custom' && !dm && 'Les repères secrets restent cachés.'}
      </p>
    </div>
  );
}

/** Fil du groupe (MJ) : où il est, où il veut aller, par où il est passé. Visible dans les deux cartes. */
function PartyBar({ party, inBattle, onShow, onBattle, onClearDest }: {
  party: PartyTrack; inBattle: boolean;
  onShow: (p: PartyPlace) => void; onBattle: (p: PartyPlace) => void; onClearDest: () => void;
}) {
  const { at, dest, trail } = party;
  return (
    <div className="party-bar" aria-label="Suivi du groupe">
      <span className="party-at">
        📍 {at ? <>Groupe : <b>{at.title}</b></> : <>Position du groupe inconnue <small>(sélectionne un lieu : « Le groupe est ici »)</small></>}
        {at && <button className="maps-link" onClick={() => onShow(at)}>voir</button>}
        {at && !inBattle && at.kind !== 'anchor' && <button className="maps-link" onClick={() => onBattle(at)}>⚔ combat ici</button>}
      </span>
      <span className="party-dest">
        🎯 {dest ? <>Destination : <b>{dest.title}</b> <button className="maps-link" onClick={() => onShow(dest)}>voir</button> <button className="maps-link" onClick={onClearDest} aria-label="Retirer la destination">×</button></> : <small>Pas de destination (fiche d’un lieu : « En faire la destination »)</small>}
      </span>
      {trail.length > 0 && (
        <span className="party-trail" title="Parcours du groupe">
          {trail.map((t) => <button key={t.id} className="maps-link" onClick={() => onShow(t)}>{t.title}</button>)}
          {at && <b>› {at.title}</b>}
        </span>
      )}
    </div>
  );
}

function FeaturePanel({ f, dm, notes, defaultCtx, onClose, onRoll, revealed, onToggleReveal, onBring, partyHere, partyDest, onPartyHere, onPartyDest, passive = 10 }: {
  f: AtlasFeature; dm: boolean; notes: string; defaultCtx: EncCtx; onClose: () => void; onRoll: (ctx: EncCtx) => void;
  revealed?: boolean; onToggleReveal?: () => void; onBring?: () => void;
  partyHere?: boolean; partyDest?: boolean; onPartyHere?: () => void; onPartyDest?: () => void;
  /** Perception passive du groupe, pour dire si un sentier se voit sans chercher. */
  passive?: number;
}) {
  const [zone, setZone] = useState<Zone>(defaultCtx.zone);
  const [depth, setDepth] = useState(defaultCtx.depth);
  const guide = dm ? dmFeature(f) : null;
  const text = describeFeature(f);
  return (
    <div className="maps-card">
      <div className="maps-card-head">
        <span>{CATEGORIES[f.category].glyph} {CATEGORIES[f.category].label}</span>
        <button className="maps-btn" onClick={onClose} aria-label="Fermer">×</button>
      </div>
      <h3>{f.title}</h3>
      {f.subtitle && <p className="maps-sub">{f.subtitle}</p>}
      <p>{text}</p>
      {f.trace && (() => {
        const t = trailProfile(f, f.trace === 'secret' ? 15 : undefined);
        return (
          <div className="trail-block">
            <p><DangerChip profile={t} /> <b>Dangerosité perçue : {t.danger.label}.</b> {t.danger.text}</p>
            <p className="maps-sub">Ce qui se voit : {t.danger.why.join(', ')}.</p>
            {dm && (
              <p className="maps-sub">
                Pour le repérer : <b>{detectLabel(t.detect)}</b>
                {noticedPassively(t.detect, passive) ? ` · le groupe le voit sans chercher (perception passive ${passive})` : ' · il faut le chercher'}
              </p>
            )}
          </div>
        );
      })()}
      {dm && notes && <Block title="Notes du MJ">{notes}</Block>}
      {guide && guide.checks.length > 0 && (
        <Block title="Jets suggérés">
          <ul>{guide.checks.map((c, i) => <li key={i}>{c.label}{c.dc ? ` · DD ${c.dc}` : ''}{c.ok ? ` — ${c.ok}` : ''}</li>)}</ul>
        </Block>
      )}
      {guide && guide.tips.map((t, i) => <p key={i} className="maps-tip">{t}</p>)}
      {dm && (onPartyHere || onPartyDest) && (
        <div className="maps-party-btns">
          {onPartyHere && <button className={`maps-btn ${partyHere ? 'gold' : ''}`} disabled={partyHere} onClick={onPartyHere}>{partyHere ? '📍 Le groupe est ici' : '📍 Le groupe est ici ?'}</button>}
          {onPartyDest && <button className={`maps-btn ${partyDest ? 'gold' : ''}`} onClick={onPartyDest}>{partyDest ? '🎯 Destination (retirer)' : '🎯 En faire la destination'}</button>}
        </div>
      )}
      {dm && onBring && <button className="maps-btn gold" onClick={onBring}>👁 Amener la vue joueurs ici</button>}
      {dm && onToggleReveal && (
        <button className={`maps-btn ${revealed ? '' : 'gold'}`} onClick={onToggleReveal}>
          {revealed ? '🙈 Cacher aux joueurs' : '👁 Montrer aux joueurs'}
        </button>
      )}
      {dm && (
        <div className="maps-enc-ctrl">
          <label>Zone
            <select className="maps-btn" value={zone} onChange={(e) => setZone(e.target.value as Zone)}>
              {ZONES.map((z) => <option key={z.v} value={z.v}>{z.l}</option>)}
            </select>
          </label>
          <label>Profondeur
            <input className="maps-btn" type="number" min={1} max={9} value={depth} onChange={(e) => setDepth(Math.max(1, Math.min(9, +e.target.value || 1)))} />
          </label>
          <button className="maps-btn gold" onClick={() => onRoll({ zone, depth, place: f.title })}>⚄ Rencontre ici (1d20)</button>
        </div>
      )}
    </div>
  );
}

function MarkerEditor({ m, onChange, onRemove, onClose }: {
  m: MapMarker; onChange: (patch: Partial<MapMarker>) => void; onRemove: () => void; onClose: () => void;
}) {
  return (
    <div className="maps-card">
      <div className="maps-card-head">
        <span>{KIND_ICON[m.kind]} {KIND_LABEL[m.kind]}</span>
        <button className="maps-btn" onClick={onClose} aria-label="Fermer">×</button>
      </div>
      <div className="maps-form">
        <input className="maps-btn" value={m.title} onChange={(e) => onChange({ title: e.target.value })} />
        <select className="maps-btn" value={m.kind} onChange={(e) => onChange({ kind: e.target.value as MarkerKind })}>
          {(Object.keys(KIND_LABEL) as MarkerKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        <textarea className="maps-btn" placeholder="Texte montré aux joueurs quand le repère est visible" value={m.summary} onChange={(e) => onChange({ summary: e.target.value })} />
        <textarea className="maps-btn" placeholder="Notes du MJ (jamais montrées)" value={m.notes} onChange={(e) => onChange({ notes: e.target.value })} />
        <label className="maps-row"><input type="checkbox" checked={m.revealed} onChange={(e) => onChange({ revealed: e.target.checked })} /> Visible des joueurs</label>
      </div>
      {m.groups && m.groups.length > 0 && (
        <Block title="Créatures (MJ)">
          {m.groups.map((g, i) => {
            const s: Stat | undefined = STATS[g.stat];
            return <div key={i}>{g.n} × {g.name ?? s?.name ?? g.stat}{g.role ? ` (${g.role})` : ''} {(g.hp || s) && <span className="maps-sub">CA {g.ac ?? s?.ac} · PV {g.hp ?? s?.hp}</span>}</div>;
          })}
        </Block>
      )}
      <button className="maps-btn" onClick={onRemove}>Supprimer le repère</button>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return <div className="maps-block"><h4>{title}</h4>{children}</div>;
}

function EncounterBox({ enc, onRoll, onPlace }: { enc: { ctx: EncCtx; e: Encounter }; onRoll: (force: boolean) => void; onPlace: () => void }) {
  const { e } = enc;
  return (
    <div className="maps-card maps-enc">
      <h3>Rencontre</h3>
      <p className="maps-sub">{e.check}</p>
      {!e.happens && <p>Rien ne vient. Le lieu reste calme pour l’instant.</p>}
      {e.happens && e.entry && (
        <>
          <p><strong>{e.entry.kind} · {e.entry.title}</strong></p>
          {e.entry.statut && <p className="maps-sub">{e.entry.statut}{e.entry.faune ? ' — réagit par instinct, ne parle pas' : ''}</p>}
          <p>{e.entry.text}</p>
          {e.attitude && <p><em>Attitude :</em> {e.attitude}</p>}
          {e.wants && <p><em>Veut :</em> {e.wants}</p>}
          {e.entry.hook && <p><em>Accroche :</em> {e.entry.hook}</p>}
          {e.groups?.map((g, i) => {
            const s: Stat | undefined = STATS[g.stat];
            return (
              <div key={i} className="maps-group">
                <div>{g.n} × {g.label ?? s?.name ?? g.stat}{g.role ? ` (${g.role})` : ''} <span className="maps-sub">{g.detail}</span></div>
                {s && <div className="maps-sub">CA {s.ac} · PV {s.hp} · For {mod(s.abil[0])} · Dex {mod(s.abil[1])} · Con {mod(s.abil[2])}</div>}
              </div>
            );
          })}
        </>
      )}
      <div className="maps-enc-ctrl">
        <button className="maps-btn" onClick={() => onRoll(false)}>Relancer (1d20)</button>
        <button className="maps-btn gold" onClick={() => onRoll(true)}>Imposer une rencontre</button>
        {e.happens && <button className="maps-btn" onClick={onPlace}>Placer sur la carte</button>}
      </div>
    </div>
  );
}

/** Édition des repères d'une carte personnalisée (MJ). Position en pourcentage de l'image. */
function PointEditor({ rec, onUpdate, selectedId, onSelect }: {
  rec: MapRecord; onUpdate: (patch: Partial<MapRecord>) => void; selectedId: string | null; onSelect: (id: string | null) => void;
}) {
  const points = rec.points ?? [];
  const blank = (): PointRecord => ({ id: uid(), title: '', category: 'indetermine', importance: 'regional', summary: '', notes: '', secret: false, x: 0.5, y: 0.5, zone: 'sauvage', depth: 3 });
  const [draft, setDraft] = useState<PointRecord>(blank);
  const [editing, setEditing] = useState(false);

  const save = (list: PointRecord[]) => onUpdate({ points: list, updatedAt: Date.now() });
  const submit = () => {
    if (!draft.title.trim()) return;
    save(editing ? points.map((p) => (p.id === draft.id ? draft : p)) : [...points, draft]);
    setDraft(blank()); setEditing(false);
  };
  const edit = (p: PointRecord) => { setDraft({ ...p }); setEditing(true); onSelect(p.id); };
  const set = <K extends keyof PointRecord>(k: K, v: PointRecord[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="maps-card">
      <h3>Repères ({points.length})</h3>
      <div className="maps-form">
        <input className="maps-btn" placeholder="Nom" value={draft.title} onChange={(e) => set('title', e.target.value)} />
        <select className="maps-btn" value={draft.category} onChange={(e) => set('category', e.target.value as FeatureCategory)}>
          {Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
        </select>
        <select className="maps-btn" value={draft.importance} onChange={(e) => set('importance', e.target.value as PointRecord['importance'])}>
          <option value="landmark">Repère majeur</option><option value="regional">Régional</option><option value="local">Local</option><option value="detail">Détail</option>
        </select>
        <div className="maps-row">
          <label>X % <input className="maps-btn" type="number" min={0} max={100} value={Math.round(draft.x * 100)} onChange={(e) => set('x', Math.min(1, Math.max(0, +e.target.value / 100)))} /></label>
          <label>Y % <input className="maps-btn" type="number" min={0} max={100} value={Math.round(draft.y * 100)} onChange={(e) => set('y', Math.min(1, Math.max(0, +e.target.value / 100)))} /></label>
        </div>
        <textarea className="maps-btn" placeholder="Description (visible des joueurs)" value={draft.summary} onChange={(e) => set('summary', e.target.value)} />
        <textarea className="maps-btn" placeholder="Notes du MJ (cachées)" value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
        <label className="maps-row"><input type="checkbox" checked={draft.secret} onChange={(e) => set('secret', e.target.checked)} /> Repère secret</label>
        <div className="maps-row">
          <select className="maps-btn" value={draft.zone} onChange={(e) => set('zone', e.target.value as Zone)}>
            {ZONES.map((z) => <option key={z.v} value={z.v}>{z.l}</option>)}
          </select>
          <input className="maps-btn" type="number" min={1} max={9} value={draft.depth} onChange={(e) => set('depth', Math.max(1, Math.min(9, +e.target.value || 1)))} />
        </div>
        <button className="maps-btn gold" onClick={submit}>{editing ? 'Enregistrer' : 'Ajouter le repère'}</button>
        {editing && <button className="maps-btn" onClick={() => { setDraft(blank()); setEditing(false); }}>Annuler</button>}
      </div>
      <ul className="maps-list">
        {points.map((p) => (
          <li key={p.id} data-on={selectedId === p.id ? 1 : 0}>
            <button className="maps-link" onClick={() => onSelect(p.id)}>{p.title}{p.secret ? ' (secret)' : ''}</button>
            <button className="maps-btn" onClick={() => edit(p)}>Modifier</button>
            <button className="maps-btn" onClick={() => save(points.filter((x) => x.id !== p.id))}>Supprimer</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
