/**
 * Visionneuse de carte : plan interactif, repères, rencontres, combat sur grille, et projection vers l'écran joueur.
 * Mode MJ : tout est visible, notes comprises. La projection montre aux joueurs ce qu'ils doivent voir, et se met à jour en direct.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import MapCanvas, { type Layers, type MapMark } from './atlas/MapCanvas';
import { CATEGORIES, connectionAt } from './atlas/model';
import { describe as describeFeature, dmFeature } from './atlas/lore';
import { rollEncounter, type EncCtx, type Encounter, type Zone } from './atlas/encounters';
import { calmAlert, encounterAlert, suspenseAlert, type HaltAlert } from './atlas/omens';
import { STATS, SRD_CREDIT, mod, type Stat } from './atlas/statblocks';
import type { AtlasData, AtlasFeature, FeatureCategory } from './atlas/types';
import {
  activateMap, ATLAS_DEFAULT_PLAN, DEFAULT_BATTLE, EMPTY_OVERLAY, mapIdOf, placeCoords,
  type MapMarker, type MapOverlay, type MapRecord, type MarkerKind, type PartyPlace, type PartyTrack, type PartyFork, type PassageLink, type PointRecord, type BattleToken,
} from './mapStore';
import { battleBoard, mapBoard } from './playerBoard';
import BattleMode, { type CombatSlot } from './battle/BattleMode';
import type { Hero } from './battle/CombatPanel';
import TrailsPanel, { DangerChip, trailsNear } from './TrailsPanel';
import { placeNear, withPartyAt } from './party';
import { placeHazard, trailHazard, type Hazard } from './atlas/hazards';
import TrialPanel from './TrialPanel';
import { searchFor, type SearchEntry } from './battle/search';
import { VISION_R, seedExplored } from './playerBoard';
import { hoursLabel, hoursOf, legsOf, lengthOf, subpath, type Leg } from './journey';
import { journeyMs } from './atlas/MapCanvas';
import { detectLabel, noticedPassively, passiveOf, trailProfile } from './atlas/trails';
import Interactables from './Interactables';
import CampaignGuide, { type BestiaryRef, type GuideCampaign, type GuidePlace } from './CampaignGuide';
import { onPlayerFollow, onPlayerFork, onPlayerPick, publishStage } from '../present/stage';
import { zoneOf, inZone, trailInZone } from './zone';
import LiveEncounters, { type LiveBestiaryRef } from './LiveEncounters';
import { buildRoutes, distancesTo, goalNodes, judgeTrail, nodeOf, verdictText, type TrailVerdict } from './route';
import { interiorPlanId, isAtlasLike, useWorldSync, worldPlanId } from './world';
import WorldPanel from './world/WorldPanel';
import { isHiddenNpc } from './world/interior';
import type { LoreEntry } from './world/lore';
import './maps.css';

const LAYERS: Layers = { points: true, etiquettes: true, galeries: true, connexions: true, ambiance: true };
const ZONES: { v: Zone; l: string }[] = [{ v: 'sauvage', l: 'Sauvage' }, { v: 'transit', l: 'Transit' }, { v: 'cite', l: 'Cité' }];
const KIND_LABEL: Record<MarkerKind, string> = { rencontre: 'Rencontre', passage: 'Passage secret', objet: 'Objet', repere: 'Repère' };
const KIND_ICON: Record<MarkerKind, string> = { rencontre: '⚔', passage: '🗝', objet: '◆', repere: '◆' };
const DEFAULT_TITLE: Record<MarkerKind, string> = { rencontre: 'Rencontre', passage: 'Passage secret', objet: 'Objet', repere: 'Repère' };
const uid = () => Math.random().toString(36).slice(2, 10);

/** Repère en cours de placement : le prochain clic sur la carte le crée. */
type Draft = { kind: MarkerKind; title: string; summary?: string; notes?: string; groups?: MapMarker['groups'] };

/** Ce que lisent les joueurs en passant devant un lieu qu'ils ne connaissent pas encore (« gauche » ou « droite »). */
const FORK_LINES: ((side: string) => string)[] = [
  (c) => `Sur votre ${c}, une ouverture dans la pierre laisse deviner un passage. Vous l’empruntez, ou vous continuez ?`,
  (c) => `Le tunnel s’évase : sur votre ${c}, une trouée sombre s’enfonce dans la roche. Vous y entrez, ou vous continuez ?`,
  (c) => `Un courant d’air frais monte d’une faille, sur votre ${c}. Vous la suivez, ou vous continuez ?`,
  (c) => `Des traces quittent le sentier vers une ouverture, sur votre ${c}. Vous les suivez, ou vous continuez ?`,
  (c) => `Un écho différent, sur votre ${c} : la paroi s’ouvre sur un espace plus large. Vous allez voir, ou vous continuez ?`,
];

export default function MapViewer({ rec, atlas, dm, onDm, onUpdate, onBack, heroes = [], startInBattle = false, onReturn, renderCombat, campaigns = [], activeCampaignId, onCampaign, onCampaignProgress, bestiary = [], artOf, library }: {
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
  /** Fiches de la Bibliothèque de l'univers : la carte du monde y prend ses cités et ses lieux. */
  library?: LoreEntry[];
}) {
  const data = activateMap(rec, dm, atlas);
  /** L'Atlas et la carte du monde : lieux à révéler, chemins, brouillard. */
  const atlasLike = isAtlasLike(rec);
  // Carte du monde : les lieux du lore prennent leur bâtiment, avec leurs PNJ, dès qu'ils sont créés.
  useWorldSync(rec, library, bestiary as unknown as LoreEntry[], onUpdate);
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
  /** Colonne de droite de la carte de navigation (MJ) : un onglet à la fois. */
  const [side, setSide] = useState<'lieu' | 'groupe' | 'campagne' | 'reperes' | 'monde'>(rec.kind === 'monde' && !(rec.world?.cities.length) ? 'monde' : 'lieu');
  useEffect(() => { if (selectedId) setSide('lieu'); }, [selectedId]);

  const overlay = rec.overlay ?? EMPTY_OVERLAY;
  const pv = overlay.playerView ?? {};
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
    () => (partyAt && atlasLike ? trailsNear(data, map, partyAt, overlay.revealed, best.pp) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, map.id, partyAt?.[0], partyAt?.[1], overlay.revealed, best.pp, rec.kind],
  );
  /** Chaque chemin qui part du groupe, avec le lieu où il mène et l'épreuve qu'il demande (s'il en demande une). */
  const trailsTo = useMemo(
    () => (partyAt ? trails.flatMap((t) => legsOf(data, map.id, t.g, partyAt, t.f.trace, party.at?.id).map((leg) => ({ ...t, leg, to: leg.to, hazard: trailHazard(t.f, t.profile) }))) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trails, party.at?.id],
  );
  // Réseau des chemins du plan (MJ) : où mène chaque sentier, et s'il rapproche le groupe de l'objectif par le labyrinthe.
  const routes = useMemo(() => buildRoutes(data, map.id), [data, map.id]);
  const goalTargets = useMemo(() => {
    const dest = party.dest;
    if (!dest) return [];
    if (dest.planId === map.id) return goalNodes(routes, dest, placeCoords(data, rec, dest));
    // Objectif sur un autre plan : les ancres de ce plan qui y mènent directement deviennent les buts.
    const here = new Set(data.anchors.filter((a) => a.mapId === map.id).map((a) => a.id));
    const there = new Set(data.anchors.filter((a) => a.mapId === dest.planId).map((a) => a.id));
    return data.connections
      .flatMap((c) => (here.has(c.fromAnchorId) && there.has(c.toAnchorId) ? [c.fromAnchorId] : here.has(c.toAnchorId) && there.has(c.fromAnchorId) && c.direction === 'both' ? [c.toAnchorId] : []))
      .filter((id) => routes.places.has(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, party.dest?.id, party.dest?.planId]);
  const reach = useMemo(() => (goalTargets.length ? distancesTo(routes, goalTargets) : null), [routes, goalTargets]);
  const groupNode = { node: nodeOf(routes, party.at?.planId === map.id ? party.at : undefined, partyAt), at: partyAt };
  const routeOf = (trailId: string): TrailVerdict & { text: string; ends?: string } => {
    const v = judgeTrail(routes, reach, groupNode, trailId);
    const e = routes.ends.get(trailId);
    const ends = e ? e.map((id) => routes.places.get(id)?.title ?? '?').join(' ↔ ') : undefined;
    return { ...v, ends, text: verdictText(v, party.dest?.title) };
  };
  /** Sentier que les joueurs viennent de toucher sur leur écran : sa fiche s'ouvre ici, illuminé sur la carte. */
  const [playerPick, setPlayerPick] = useState<{ id: string; at: number } | null>(null);

  /** Ce qu'il y a à découvrir autour du groupe : lieux à fouiller, repères du MJ, chemins qu'il faut chercher. */
  /** La salle (ou le tunnel) où se tient le groupe : « À découvrir ici » ne montre que ce qui s'y trouve. */
  const zone = useMemo(() => (partyAt ? zoneOf(data, map.id, partyAt) : null), [data, map.id, partyAt?.[0], partyAt?.[1]]);
  const finds = useMemo(() => {
    if (!partyAt || !zone) return [];
    const byId = new Map(data.features.map((f) => [f.id, f]));
    const out: { f: AtlasFeature; entry: SearchEntry; d: number }[] = [];
    for (const g of data.geometries) {
      if (g.mapId !== map.id || g.type !== 'point') continue;
      const f = byId.get(g.featureId);
      if (!f || f.area || f.trace) continue;
      const [x, y] = g.coordinates as [number, number];
      const d = Math.hypot(x - partyAt[0], y - partyAt[1]);
      if (!inZone(zone, [x, y])) continue;
      const marker = f.id.startsWith('mk-') ? overlay.markers.find((m) => `mk-${m.id}` === f.id) : undefined;
      if (marker && marker.kind === 'rencontre') continue;
      const entry: SearchEntry | null = marker
        ? { skill: 'Investigation', dc: marker.dcInvestigate ?? 12, find: marker.reading || marker.summary || 'À décrire.', loot: marker.keep, effect: marker.effect }
        : searchFor(f.title, overlay.searchNotes?.[f.id]);
      if (entry) out.push({ f, entry, d });
    }
    return out.sort((a, b) => a.d - b.d).slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, map.id, zone, overlay.markers, overlay.searchNotes]);
  // Chemins cachés qui débouchent dans cette salle (pas ceux de la caverne voisine).
  const hiddenTrails = useMemo(
    () => (partyAt && zone && atlasLike ? trailsNear(data, map, partyAt, overlay.revealed, best.pp, Infinity) : [])
      .filter((t) => !t.noticed && !t.shown && t.profile.detect && trailInZone(zone!, t.g.coordinates as [number, number][])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, map.id, zone, overlay.revealed, best.pp],
  );
  /** Épreuve de passage en cours (le groupe veut suivre un chemin difficile). */
  const [trial, setTrial] = useState<{ trailId: string; trail: string; to: PartyPlace; hazard: Hazard; by?: 'joueurs'; leg: Leg; aside?: boolean } | null>(null);
  /** Demande des joueurs qu'on ne peut pas suivre d'ici (le groupe n'est pas au départ du chemin). */
  const [askNote, setAskNote] = useState<string | null>(null);

  /** Repères du groupe sur le plan affiché (MJ) : où il est, et où il veut aller. */
  const partyMarks: MapMark[] = ([['party', party.at, 'Groupe'], ['dest', party.dest, 'Destination']] as const).flatMap(([tone, p, label]) => {
    const at = p && p.planId === map.id ? placeCoords(data, rec, p) : null;
    return at ? [{ id: tone, x: at[0], y: at[1], label: `${label} · ${p!.title}`, tone }] : [];
  });
  // Héros séparés du groupe, regroupés par lieu sur le plan affiché.
  const apartByPlace = new Map<string, NonNullable<PartyTrack['apart']>>();
  for (const h of party.apart ?? []) apartByPlace.set(h.at.id, [...(apartByPlace.get(h.at.id) ?? []), h]);
  for (const [, hs] of apartByPlace) {
    const at = hs[0].at.planId === map.id ? placeCoords(data, rec, hs[0].at) : null;
    if (at) partyMarks.push({ id: `hero-${hs[0].at.id}`, x: at[0], y: at[1], label: hs.map((h) => h.name).join(', '), tone: 'hero' });
  }
  /** Aperçu « Joueurs » : mêmes jetons et même brouillard que sur l'écran joueur. */
  const playerPreview = useMemo(() => {
    if (dm) return { marks: [] as MapMark[], fog: null };
    const pb = mapBoard(rec, atlas, map.id);
    return pb.mode === 'map' ? { marks: (pb.marks ?? []) as MapMark[], fog: pb.fog ?? null } : { marks: [] as MapMark[], fog: null };
  }, [dm, rec, atlas, map.id]);
  /** Un héros sort seul du plateau de combat : il attend au bout de sa sortie, sur la carte de navigation. */
  const leaveBattle = (t: BattleToken, link: PassageLink | undefined) => {
    if (t.kind !== 'pc' || !link) return;
    const at = arrivalOf(link);
    const apart = [...(party.apart ?? []).filter((h) => h.id !== t.id), { id: t.id, name: t.name, heroId: t.heroId, image: t.image, at, since: Date.now() }];
    setOverlay({ ...overlay, party: { ...party, apart } });
  };
  const rejoin = (id: string) => {
    const apart = (party.apart ?? []).filter((h) => h.id !== id);
    setOverlay({ ...overlay, party: { ...party, apart: apart.length ? apart : undefined } });
  };
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
    () => (atlasLike ? atlas.geometries.filter((g) => g.mapId === map.id).map((g) => g.featureId) : []),
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
    if (atlasLike && !overlay.revealed.includes(id)) toggleReveal(id);
    setFocus({ kind: 'point', id, tick: Date.now() });
    setProjecting(true);
  };

  /** Suit le passage jusqu'à sa destination, sur la carte de navigation. Une porte qui mène ailleurs s'ouvre pour les joueurs. */
  const followPassage = (link: PassageLink) => {
    // Une seule écriture : la porte s'ouvre, le lieu devient visible, et le groupe s'y déplace.
    let next = overlay;
    if (link.kind === 'marker') next = { ...next, markers: next.markers.map((m) => (m.id === link.id ? { ...m, revealed: true } : m)) };
    // Un lieu de l'Atlas qui n'est pas encore visible devient visible au passage.
    if (link.kind === 'feature' && atlasLike && !next.revealed.includes(link.id)) next = { ...next, revealed: [...next.revealed, link.id] };
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

  /**
   * Le groupe arrive à un lieu, le long d'un tracé : il glisse sur le chemin (animé chez le MJ et les joueurs), le
   * chemin parcouru reste découvert dans le brouillard, et ce qui est évident autour de l'arrivée se révèle. Ce qui
   * demande un jet (passage secret, fissure cachée…) reste caché tant que le MJ ne le révèle pas.
   */
  const travelTo = (to: PartyPlace, opts: { points?: [number, number][]; trailId?: string; note?: string; walked?: number; nextCheck?: number; alert?: HaltAlert } = {}) => {
    let next = withPartyAt(overlay, to);
    const dest = placeCoords(data, rec, to);
    const reveal = new Set(next.revealed);
    if (opts.trailId) reveal.add(opts.trailId);
    if (to.kind === 'feature') reveal.add(to.id);
    const points = opts.points ?? [];
    if (dest && atlasLike) {
      const byId = new Map(data.features.map((f) => [f.id, f]));
      for (const g of data.geometries) {
        if (g.mapId !== to.planId || g.featureId.startsWith('mk-')) continue;
        const f = byId.get(g.featureId);
        if (!f || reveal.has(f.id)) continue;
        const pts = (g.type === 'point' ? [g.coordinates] : g.coordinates) as [number, number][];
        const close = pts.some(([x, y]) => Math.hypot(x - dest[0], y - dest[1]) <= VISION_R);
        if (!close) continue;
        // Évident : un lieu à découvert, ou un sentier qui se voit sans chercher. Le reste attend un jet.
        const evident = f.trace ? !trailProfile(f, f.trace === 'secret' ? 15 : undefined).detect : !f.area;
        if (evident) reveal.add(f.id);
      }
    }
    const newly = [...reveal].filter((id) => !next.revealed.includes(id));
    next = { ...next, revealed: [...reveal] };
    next = withExplored(next, to.planId, [...points.filter((_, i) => i % 2 === 0), ...(dest ? [dest] : []), ...newly.flatMap((id) => pointsOf(id, to.planId))]);
    if (points.length > 1) next = { ...next, travel: { key: `${Date.now()}`, planId: to.planId, points, at: Date.now() } };
    const p = next.party ?? { trail: [] };
    next = { ...next, party: {
      ...p, halt: undefined, fork: undefined,
      walked: opts.walked ?? p.walked, nextCheck: opts.nextCheck ?? p.nextCheck,
      log: opts.note ? [{ t: Date.now(), text: opts.note }, ...(p.log ?? [])].slice(0, 12) : p.log,
    } };
    // L'annonce de halte s'efface en reprenant la route (sauf la fausse alerte, qui s'éteint d'elle-même).
    next = { ...next, alert: opts.alert };
    setOverlay(next);
    setTrial(null);
    setAskNote(null);
    // Pas de saut de caméra : la vue suit le jeton pendant le trajet (chez le MJ comme chez les joueurs).
    if (points.length < 2) setFocus({ kind: to.kind === 'anchor' ? 'anchor' : 'point', id: to.kind === 'marker' ? `mk-${to.id}` : to.id, tick: Date.now() });
  };
  type TrailLeg = (typeof trailsTo)[number];
  /**
   * Prendre une direction sur un chemin jusqu'à la prochaine étape. Toutes les 1 à 2 heures de marche (jeu), le groupe
   * fait halte en chemin : le MJ décide d'une rencontre, la tire au hasard, ou laisse le groupe continuer.
   */
  const go = (e: { f: { id: string; title: string }; leg: Leg }, note?: string) => {
    const leg = e.leg;
    if (!leg.to) return;
    const fork = leg.aside ? forkOf(e.f, leg) : undefined;
    const walked = party.walked ?? 0;
    const nextCheck = party.nextCheck ?? 1 + Math.random();
    if (walked + leg.hours >= nextCheck && leg.hours > 0.2) {
      const frac = Math.max(0.2, Math.min(0.8, (nextCheck - walked) / leg.hours));
      const L = lengthOf(leg.points);
      const first = subpath(leg.points, 0, frac * L);
      const rest = subpath(leg.points, frac * L, L);
      const point = first[first.length - 1];
      let next: MapOverlay = { ...overlay, revealed: overlay.revealed.includes(e.f.id) ? overlay.revealed : [...overlay.revealed, e.f.id] };
      next = withExplored(next, map.id, first.filter((_, i) => i % 2 === 0));
      next = { ...next, travel: { key: `${Date.now()}`, planId: map.id, points: first, at: Date.now(), hold: true } };
      next = { ...next, party: { ...party, walked: nextCheck, fork: undefined, halt: {
        trailId: e.f.id, trail: e.f.title, planId: map.id, point, rest, back: [...first].reverse(), to: leg.to, from: party.at,
        hours: walked + frac * leg.hours, restHours: leg.hours * (1 - frac), fork, prevFork: party.fork,
      } } };
      if (note) next = { ...next, party: { ...next.party!, log: [{ t: Date.now(), text: note }, ...(next.party?.log ?? [])].slice(0, 12) } };
      setOverlay(next);
      setTrial(null);
      setAskNote(null);
      return;
    }
    if (fork) { stopAtFork(fork, leg.points, { note, walked: walked + leg.hours, nextCheck }); return; }
    travelTo(leg.to, { points: leg.points, trailId: e.f.id, note, walked: walked + leg.hours, nextCheck });
  };
  /** Bifurcation vis-à-vis d'un lieu à côté du chemin : ce que lisent les joueurs, selon qu'ils le connaissent ou non. */
  const forkOf = (f: { id: string; title: string }, leg: Leg): PartyFork | undefined => {
    const a = leg.aside;
    if (!a) return undefined;
    const known = rec.kind !== 'atlas' || overlay.revealed.includes(a.place.id);
    const pick = [...`${f.id}${a.place.id}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    const line = known
      ? `Sur votre ${a.side}, un passage mène à « ${a.place.title} ». Vous y allez, ou vous continuez ?`
      : FORK_LINES[pick % FORK_LINES.length](a.side);
    return {
      key: `${Date.now()}`, trailId: f.id, trail: f.title, planId: map.id, dir: leg.dir,
      point: leg.points[leg.points.length - 1], place: a.place, placeAt: a.at, side: a.side, known, line,
      out: known ? `Sortir vers ${a.place.title}` : 'Emprunter le passage', on: 'Continuer sur le sentier', from: party.at,
    };
  };
  /** Le groupe glisse jusqu'à la bifurcation et s'y arrête, sur le chemin : la question monte chez les joueurs. */
  const stopAtFork = (fork: PartyFork, points: [number, number][], opts: { note?: string; walked?: number; nextCheck?: number; alert?: HaltAlert } = {}) => {
    let next: MapOverlay = { ...overlay, revealed: overlay.revealed.includes(fork.trailId) ? overlay.revealed : [...overlay.revealed, fork.trailId] };
    next = withExplored(next, fork.planId, [...points.filter((_, i) => i % 2 === 0), fork.point]);
    if (points.length > 1) next = { ...next, travel: { key: `${Date.now()}`, planId: fork.planId, points, at: Date.now(), hold: true } };
    const p = next.party ?? { trail: [] };
    next = { ...next, alert: opts.alert, party: {
      ...p, halt: undefined, fork,
      walked: opts.walked ?? p.walked, nextCheck: opts.nextCheck ?? p.nextCheck,
      log: opts.note ? [{ t: Date.now(), text: opts.note }, ...(p.log ?? [])].slice(0, 12) : p.log,
    } };
    setOverlay(next);
    setTrial(null);
    setAskNote(null);
  };
  /** À la bifurcation : sortir vers le lieu, continuer sur le chemin, ou faire demi-tour. */
  const forkChoose = (choice: 'out' | 'on' | 'back', by?: 'joueurs', key?: string) => {
    const k = party.fork;
    if (!k || (key && key !== k.key)) return;
    const why = by ? ' (choix des joueurs)' : '';
    const f = data.features.find((x) => x.id === k.trailId);
    if (!f) return;
    if (choice === 'out') {
      // Le court passage jusqu'au lieu : son épreuve s'il est dangereux, puis la marche (et sa halte de rencontre).
      const points: [number, number][] = [k.point, k.placeAt];
      const leg: Leg = { dir: k.dir, to: k.place, points, hours: hoursOf(lengthOf(points), f.trace), toward: '' };
      const place = data.features.find((x) => x.id === k.place.id);
      const hazard = place ? placeHazard(place) : null;
      if (hazard) { setTrial({ trailId: f.id, trail: `passage vers ${k.place.title}`, to: k.place, hazard, by, leg, aside: true }); setSide('lieu'); return; }
      go({ f, leg }, `Le groupe quitte « ${k.trail} » vers ${k.place.title}${why}.`);
      return;
    }
    const g = data.geometries.find((x) => x.featureId === k.trailId && x.mapId === k.planId && x.type !== 'point');
    const dir = choice === 'back' ? (k.dir === 'a' ? 'b' : 'a') : k.dir;
    const leg = g ? legsOf(data, k.planId, g, k.point, f.trace, k.place.id).find((l) => l.dir === dir) : undefined;
    if (!leg?.to) { setAskNote(`« ${k.trail} » ne mène nulle part dans cette direction : sors vers ${k.place.title}, ou déplace le groupe à la main.`); return; }
    // Un chemin incertain ou périlleux redemande son épreuve à chaque tronçon.
    const hazard = trailHazard(f, trailProfile(f, f.trace === 'secret' ? 15 : undefined));
    if (hazard) { setTrial({ trailId: f.id, trail: f.title, to: leg.to, hazard, by, leg }); setSide('lieu'); return; }
    go({ f, leg }, choice === 'back' ? `Le groupe rebrousse chemin sur « ${k.trail} »${why}.` : undefined);
  };
  const forkRef = useRef(forkChoose);
  forkRef.current = forkChoose;
  useEffect(() => onPlayerFork((key, choice) => forkRef.current(choice, 'joueurs', key)), []);
  /** Suivre un chemin : directement s'il est sûr ou praticable, sinon par l'épreuve de passage (le MJ la fait jouer). */
  const followTrail = (e: TrailLeg, by?: 'joueurs') => {
    if (party.halt) { setAskNote('Le groupe a fait halte en chemin : décide d’abord de la suite (rencontre, reprendre la route, demi-tour).'); return; }
    if (party.fork) { setAskNote(`Le groupe est arrêté sur « ${party.fork.trail} », vis-à-vis de ${party.fork.place.title} : choisis d’abord d’y aller ou de continuer.`); return; }
    if (!e.to) { setAskNote(`« ${e.f.title} » ne mène à aucun lieu connu dans cette direction : déplace le groupe à la main.`); return; }
    if (e.hazard) { setTrial({ trailId: e.f.id, trail: e.f.title, to: e.to, hazard: e.hazard, by, leg: e.leg }); setSide('lieu'); return; }
    go(e);
  };
  /** Après la halte : reprendre la route jusqu'à l'étape, ou faire demi-tour. */
  const resume = (back = false, calm = false) => {
    const h = party.halt;
    if (!h) return;
    const walked = party.walked ?? 0;
    const nextCheck = walked + 1 + Math.random();
    const alert = calm ? calmAlert() : undefined;
    if (back) {
      const from = h.from ?? party.at;
      if (!from) return;
      // Parti d'une bifurcation, le demi-tour y ramène, et la question se repose.
      const fork = h.prevFork ? { ...h.prevFork, key: `${Date.now()}` } : undefined;
      setOverlay({ ...overlay, alert, travel: { key: `${Date.now()}`, planId: h.planId, points: h.back, at: Date.now(), hold: fork ? true : undefined }, party: { ...party, halt: undefined, fork, nextCheck } });
      return;
    }
    if (h.fork) { stopAtFork({ ...h.fork, key: `${Date.now()}` }, [h.point, ...h.rest], { walked: walked + h.restHours, nextCheck, alert }); return; }
    travelTo(h.to, { points: [h.point, ...h.rest], trailId: h.trailId, walked: walked + h.restHours, nextCheck, alert });
  };
  /** Ce que les joueurs voient de la rencontre tirée : son annonce et son image, ou la fausse alerte. */
  const alertFor = (e: Encounter) => (e.happens && e.entry ? encounterAlert(e, overlay.encounterImages?.[e.entry.title]) : null) ?? calmAlert();
  /** Halte : jet de rencontre (le hasard décide) ou rencontre imposée (tirée dans la table, à relancer au besoin). */
  const haltEncounter = (roll: boolean) => {
    const h = party.halt;
    if (!h) return;
    const ctx: EncCtx = { zone: 'sauvage', depth: 3, place: h.trail };
    const e = rollEncounter(ctx, !roll);
    setEnc({ ctx, e });
    setOverlay({ ...overlay, alert: alertFor(e), party: { ...party, halt: { ...h, encounter: true } } });
    setSide('lieu');
  };
  const rerollEncounter = (force: boolean) => {
    if (!enc) return;
    const e = rollEncounter(enc.ctx, force);
    setEnc({ ctx: enc.ctx, e });
    if (party.halt) setOverlay({ ...overlay, alert: alertFor(e) });
  };
  /** Illustration d'une rencontre (mémorisée pour les prochaines fois) ; montrée tout de suite si elle est annoncée. */
  const setEncounterImage = (title: string, image: string | undefined) => {
    const images = { ...(overlay.encounterImages ?? {}) };
    if (image) images[title] = image; else delete images[title];
    const a = overlay.alert;
    setOverlay({ ...overlay, encounterImages: images, alert: a && a.phase === 'encounter' && a.title === title ? { ...a, image } : a });
  };
  // La question « rencontre ? » attend que le jeton soit arrivé à la halte (fin de l'animation).
  const [, tick] = useState(0);
  const haltReadyAt = party.halt && overlay.travel?.hold ? overlay.travel.at + journeyMs(overlay.travel.points, map.width, map.height) : 0;
  useEffect(() => {
    const left = haltReadyAt - Date.now();
    if (left <= 0) return;
    const id = setTimeout(() => tick((n) => n + 1), left + 60);
    return () => clearTimeout(id);
  }, [haltReadyAt]);
  // Arrivé à la halte, les joueurs voient monter le suspense, pendant que le MJ décide.
  const haltReady = !!party.halt && !party.halt.encounter && haltReadyAt > 0 && Date.now() >= haltReadyAt;
  useEffect(() => {
    if (!dm || !haltReady || (overlay.alert && overlay.alert.at >= (overlay.travel?.at ?? 0))) return;
    setOverlay({ ...overlay, alert: suspenseAlert() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [haltReady]);
  // Les joueurs demandent à suivre un chemin (dans une direction) depuis leur écran.
  const followRef = useRef<(id: string, dir?: 'a' | 'b') => void>(() => {});
  followRef.current = (id, dir) => {
    const e = trailsTo.find((x) => x.f.id === id && (!dir || x.leg.dir === dir)) ?? trailsTo.find((x) => x.f.id === id);
    if (!e) { setAskNote(`Les joueurs veulent suivre « ${data.features.find((f) => f.id === id)?.title ?? 'un chemin'} », mais le groupe n'est pas sur ce chemin.`); return; }
    setSelectedId(id);
    followTrail(e, 'joueurs');
  };
  useEffect(() => onPlayerFollow((id, dir) => followRef.current(id, dir)), []);
  /** Points d'un lieu ou d'un chemin sur un plan (un point sur deux le long d'un tracé). */
  const pointsOf = (id: string, planId = map.id): [number, number][] => data.geometries
    .filter((g) => g.featureId === id && g.mapId === planId)
    .flatMap((g) => (g.type === 'point' ? [g.coordinates as [number, number]] : (g.coordinates as [number, number][]).filter((_, i, all) => i % 2 === 0 || i === all.length - 1)));
  /** Mémoire du brouillard d'un plan : ce qui a été découvert, et qui reste visible (assombri) chez les joueurs. */
  const exploredOf = (o: MapOverlay, planId: string) => o.explored?.[planId]
    ?? seedExplored(data, { ...rec, overlay: o }, planId, (p) => (p && p.planId === planId ? placeCoords(data, rec, p) : null));
  const withExplored = (o: MapOverlay, planId: string, add: [number, number][]): MapOverlay => (
    add.length ? { ...o, explored: { ...(o.explored ?? {}), [planId]: [...exploredOf(o, planId), ...add].slice(-4000) } } : o
  );
  /** Replonge dans le noir : tout le plan, ou seulement autour d'un lieu. */
  const forgetFog = (around?: [number, number][]) => {
    const keep = around ? exploredOf(overlay, map.id).filter(([x, y]) => !around.some(([a, b]) => Math.hypot(x - a, y - b) < 0.03)) : [];
    setOverlay({ ...overlay, explored: { ...(overlay.explored ?? {}), [map.id]: keep } });
  };
  const toggleReveal = (id: string) => {
    const on = !overlay.revealed.includes(id);
    const next = { ...overlay, revealed: on ? [...overlay.revealed, id] : overlay.revealed.filter((x) => x !== id) };
    setOverlay(on ? withExplored(next, map.id, pointsOf(id)) : next);
  };
  const pickRef = useRef<(id: string) => void>(() => {});
  pickRef.current = (id) => {
    const f = data.features.find((x) => x.id === id);
    if (!f?.trace) return;
    setSelectedId(id);
    setEnc(null);
    setPlayerPick({ id, at: Date.now() });
    const g = data.geometries.find((x) => x.featureId === id);
    if (g && g.mapId !== map.id) setPlanId(g.mapId);
    setFocus({ kind: 'point', id, tick: Date.now() });
  };
  useEffect(() => onPlayerPick((id) => pickRef.current(id)), []);
  const revealPlan = (on: boolean) => {
    const ids = new Set(overlay.revealed);
    planFeatureIds.forEach((id) => (on ? ids.add(id) : ids.delete(id)));
    const next = { ...overlay, revealed: [...ids] };
    setOverlay(on ? withExplored(next, map.id, planFeatureIds.flatMap((id) => pointsOf(id)).filter((_, i) => i % 3 === 0)) : next);
  };

  function addMarker(x: number, y: number) {
    if (!placing) return;
    createMarker(placing, x, y, map.id);
  }
  function createMarker(draft: Draft, x: number, y: number, planOf: string, extra: Partial<MapOverlay> = {}) {
    const m: MapMarker = {
      id: uid(), kind: draft.kind, title: draft.title || DEFAULT_TITLE[draft.kind], planId: planOf, x, y,
      summary: draft.summary ?? '', notes: draft.notes ?? '', revealed: false, groups: draft.groups,
    };
    setPlacing(null);
    if (planOf !== map.id) setPlanId(planOf);
    setSelectedId(`mk-${m.id}`);
    if (m.kind === 'rencontre') {
      // Nouvelle rencontre : on oublie le plateau précédent et on ouvre la carte de combat de ce lieu, avec ses créatures.
      onUpdate({ overlay: { ...overlay, ...extra, markers: [...overlay.markers, m] }, updatedAt: Date.now(), battle: { ...DEFAULT_BATTLE, tokens: [] } });
      setBattleOpen(true);
      return;
    }
    setOverlay({ ...overlay, ...extra, markers: [...overlay.markers, m] });
  }
  const updateMarker = (id: string, patch: Partial<MapMarker>) => setOverlay({
    ...overlay, markers: overlay.markers.map((m) => (m.id === id ? { ...m, ...patch } : m)),
  });
  const removeMarker = (id: string) => {
    setOverlay({ ...overlay, markers: overlay.markers.filter((m) => m.id !== id) });
    setSelectedId(null);
  };

  /** Carte du monde : entrer dans une cité (zoom au plus près, ou bouton), revenir au monde (dézoom au plus loin). */
  const wid = worldPlanId(rec.id);
  const cityOfPlan = rec.kind === 'monde' && map.scope.kind === 'site' ? data.features.find((f) => f.opens?.id === map.scope.id) : undefined;
  const enterSite = (siteId: string) => {
    const site = data.spaces.find((x) => x.id === siteId);
    if (!site?.mapId) return;
    // Le groupe se tient devant cette cité sur le plan monde : il y entre par la porte qui fait face à sa route.
    const cityF = data.features.find((f) => f.opens?.id === siteId);
    const cityXY = cityF ? placeCoords(data, rec, { id: cityF.id, kind: 'feature', title: cityF.title, planId: wid }) : null;
    const here = party.at?.planId === wid ? placeCoords(data, rec, party.at) : null;
    if (cityXY && here && Math.hypot(here[0] - cityXY[0], here[1] - cityXY[1]) < 0.012) {
      const prev = [...party.trail].reverse().map((p) => (p.planId === wid ? placeCoords(data, rec, p) : null))
        .find((c) => c && Math.hypot(c[0] - cityXY[0], c[1] - cityXY[1]) > 0.012);
      const want = prev ? Math.atan2(prev[1] - cityXY[1], prev[0] - cityXY[0]) : null;
      const gates = data.features.filter((f) => f.id.startsWith(`${site.mapId}:porte-`))
        .map((f) => ({ f, at: data.geometries.find((g) => g.featureId === f.id)!.coordinates as [number, number] }))
        .map((x) => ({ ...x, d: want === null ? 0 : Math.abs(Math.atan2(Math.sin(Math.atan2(x.at[1] - 0.5, x.at[0] - 0.5) - want), Math.cos(Math.atan2(x.at[1] - 0.5, x.at[0] - 0.5) - want))) }))
        .sort((a, b) => a.d - b.d);
      if (gates[0]) setOverlay(withExplored(withPartyAt(overlay, { id: gates[0].f.id, kind: 'feature', title: gates[0].f.title, planId: site.mapId }), site.mapId, [gates[0].at]));
    }
    setPlanId(site.mapId); setSelectedId(null); setPlacing(null);
  };
  /** Plan intérieur affiché : son bâtiment (emplacement) et la cité où il se trouve. */
  const interiorOf = (planId: string) => {
    const mm = planId.match(/^(.*):int(?::(e1|cave))?$/);
    if (!mm) return null;
    const slotId = mm[1];
    const cityPlan = slotId.replace(/:b\d+$/, '');
    return { slotId, cityPlan, rdc: interiorPlanId(slotId), level: mm[2] ? (mm[2] === 'e1' ? 'etage' : 'cave') : 'rdc' };
  };
  const inside = rec.kind === 'monde' ? interiorOf(map.id) : null;
  /** Remonter d'un cran : de l'intérieur à la rue, de la cité au monde. */
  const goUp = () => {
    // D'un étage ou de la cave : on revient au rez-de-chaussée, au pied de l'escalier.
    if (inside && inside.level !== 'rdc') {
      const anchor = data.anchors.find((a) => a.mapId === map.id && a.id.endsWith(':esc-rdc'));
      if (anchor) { followAnchor(anchor.id); return; }
      setPlanId(inside.rdc); setSelectedId(null); setPlacing(null);
      return;
    }
    if (inside) {
      const slotF = data.features.find((f) => f.id === inside.slotId);
      // Le groupe ressort avec la vue : il se retrouve devant le bâtiment, dans la rue.
      if (party.at?.planId === map.id) {
        const at = data.anchors.find((a) => a.id === `${inside.slotId}:porte`)?.at as [number, number] | undefined;
        const place: PartyPlace = slotF ? { id: slotF.id, kind: 'feature', title: slotF.title, planId: inside.cityPlan } : { id: `${inside.slotId}:rue`, kind: 'spot', title: 'Devant le bâtiment', planId: inside.cityPlan, at };
        setOverlay(withPartyAt(overlay, place));
      }
      setPlanId(inside.cityPlan); setSelectedId(slotF?.id ?? null); setPlacing(null);
      if (slotF) setFocus({ kind: 'point', id: slotF.id, tick: Date.now() });
      return;
    }
    setPlanId(wid); setSelectedId(cityOfPlan?.id ?? null); setPlacing(null);
    if (cityOfPlan) setFocus({ kind: 'point', id: cityOfPlan.id, tick: Date.now() });
  };
  /**
   * Entrer dans un bâtiment : son intérieur est généré (toujours le même) et s'ajoute à la carte. Si le groupe est devant,
   * il entre avec la vue : la première pièce, ce qu'on y voit et les PNJ qui s'y tiennent sont révélés aux joueurs.
   */
  const enterBuilding = (slotId: string) => {
    const world = rec.world;
    if (!world) return;
    const ipid = interiorPlanId(slotId);
    const slotXY = data.geometries.find((g) => g.featureId === slotId)?.coordinates as [number, number] | undefined
      ?? data.anchors.find((a) => a.id === `${slotId}:porte`)?.at as [number, number] | undefined;
    const here = party.at && party.at.planId === map.id ? placeCoords(data, rec, party.at) : null;
    const partyIn = !!here && (party.at!.id === slotId || (!!slotXY && Math.hypot(here[0] - slotXY[0], here[1] - slotXY[1]) < 0.02));
    let next = overlay;
    if (partyIn) {
      const bound = Object.values(world.bindings ?? {}).find((b) => b.slotId === slotId && !b.excluded);
      const seen = [`${ipid}:entree`, `${ipid}:piece-0`, ...(bound?.npcs ?? []).filter((n) => !isHiddenNpc(n)).map((n) => `${ipid}:pnj-${n.id}`)];
      next = withPartyAt(next, { id: `${ipid}:entree`, kind: 'feature', title: 'Entrée', planId: ipid });
      next = { ...next, revealed: [...new Set([...next.revealed, slotId, ...seen])] };
    }
    const interiors = (world.interiors ?? []).includes(slotId) ? world.interiors : [...(world.interiors ?? []), slotId];
    onUpdate({ world: { ...world, interiors }, ...(next !== overlay ? { overlay: next } : {}), updatedAt: Date.now() });
    setPlanId(ipid); setSelectedId(null); setPlacing(null);
  };
  /**
   * Prendre un passage entre deux plans (escalier, porte, sortie de ville) depuis la carte de navigation.
   * Le groupe suit s'il se tient sur ce niveau d'un bâtiment, ou près de l'ancre ailleurs ; ce qu'il voit à l'arrivée
   * (le palier, la pièce du bas) est révélé aux joueurs.
   */
  const followAnchor = (anchorId: string) => {
    const c = connectionAt(anchorId);
    if (!c || !c.canFollow) return;
    const here = data.anchors.find((a) => a.id === anchorId);
    const to = c.other;
    const partyXY = party.at?.planId === map.id ? placeCoords(data, rec, party.at) : null;
    const partyFollows = !!partyXY && !!here && (!!inside || Math.hypot(partyXY[0] - here.at[0], partyXY[1] - here.at[1]) < 0.03);
    if (partyFollows) {
      const seen = data.geometries
        .filter((g) => g.mapId === to.mapId && !g.featureId.startsWith('mk-'))
        .filter((g) => ((g.type === 'point' ? [g.coordinates] : g.coordinates) as [number, number][]).some(([x, y]) => Math.hypot(x - to.at[0], y - to.at[1]) < 0.04))
        .map((g) => g.featureId);
      const arrival = placeNear(data, to.mapId, to.at as [number, number], { radius: 0.09 }) ?? { id: to.id, kind: 'anchor' as const, title: to.label, planId: to.mapId };
      let next = withPartyAt(overlay, arrival);
      next = { ...next, revealed: [...new Set([...next.revealed, ...seen])] };
      setOverlay(next);
    }
    setPlanId(to.mapId); setSelectedId(null); setPlacing(null);
    setFocus({ kind: 'anchor', id: to.id, tick: Date.now() });
  };
  /** Bâtiment de la cité sous un point du plan (0–1), d'après son empreinte. */
  const buildingAt = (at: [number, number]): string | null => {
    const b = map.surface?.theme === 'cite' ? map.surface.ground.b : null;
    if (!b) return null;
    const x = at[0] * map.width, y = at[1] * map.height;
    for (let i = 0; i + 4 < b.length; i += 5) {
      const [cx, cy, w, d, ang] = b.slice(i, i + 5);
      const c = Math.cos(-ang), sn = Math.sin(-ang), dx = x - cx, dy = y - cy;
      if (Math.abs(dx * c - dy * sn) <= w / 2 + 2 && Math.abs(dx * sn + dy * c) <= d / 2 + 2) return `${map.id}:b${i / 5}`;
    }
    return null;
  };
  const onZoomLimit = rec.kind === 'monde' ? (dir: 'in' | 'out', at: [number, number]) => {
    if (dir === 'out' && map.id !== wid) { goUp(); return; }
    if (dir !== 'in') return;
    if (map.surface?.theme === 'cite') { const slot = buildingAt(at); if (slot) enterBuilding(slot); return; }
    if (map.id !== wid) return;
    const near = data.features
      .filter((f) => f.opens)
      .map((f) => ({ f, g: data.geometries.find((g) => g.featureId === f.id && g.mapId === wid) }))
      .filter((x) => x.g)
      .map((x) => ({ ...x, d: Math.hypot((x.g!.coordinates as [number, number])[0] - at[0], (x.g!.coordinates as [number, number])[1] - at[1]) }))
      .sort((a, b) => a.d - b.d)[0];
    if (near && near.d < 0.1) enterSite(near.f.opens!.id);
  } : undefined;

  return (
    <div className={`atlas-page maps-viewer ${battleOpen && renderCombat ? 'has-encounter' : ''}`}>
      <div className="maps-toolbar">
        {onReturn && <button className="maps-btn gold" onClick={onReturn} title="Revenir à la Table de jeu, là où tu l’avais laissée">← Table de jeu</button>}
        {battleOpen
          ? <button className="maps-btn" onClick={() => setBattleOpen(false)}>← Carte de navigation</button>
          : <button className="maps-btn" onClick={onBack}>← Cartes</button>}
        <strong className="maps-title">{rec.title}</strong>
        {rec.kind === 'monde' && !battleOpen && map.id !== wid && (
          <button className="maps-btn" onClick={goUp} title={inside ? (inside.level === 'rdc' ? 'Ressortir dans la rue (ou dézoomer au plus loin)' : 'Revenir au rez-de-chaussée (ou dézoomer au plus loin)') : 'Revenir à la carte du monde (ou dézoomer au plus loin)'} aria-label={inside ? (inside.level === 'rdc' ? 'Ressortir dans la rue' : 'Revenir au rez-de-chaussée') : 'Revenir à la carte du monde'}>↥</button>
        )}
        {atlasLike && !battleOpen && (
          <select className="maps-btn" value={planId} onChange={(e) => { setPlanId(e.target.value); setSelectedId(null); setPlacing(null); }}>
            {atlas.maps.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        )}
        {!battleOpen && <button className="maps-btn" onClick={openBattle} title={locationHint ? `Ouvrir la carte de combat : ${locationHint.title}` : 'Ouvrir la carte de combat (sélectionne un lieu, ou place le groupe)'}>⚔ Combat</button>}
        <div className="maps-spacer" />
        {dm && !battleOpen && (
          <div className="maps-pv" role="group" aria-label="Ce que voient les joueurs sur la carte de navigation">
            <span>Vue joueurs</span>
            {([['fog', '🌫 Brouillard', 'Brouillard de guerre : les joueurs ne voient que les lieux explorés ou révélés'],
              ['party', '👥 Groupe', 'Montrer le jeton du groupe aux joueurs'],
              ['heroes', '🧭 Séparés', 'Montrer aux joueurs les héros partis seuls']] as const).map(([k, label, title]) => (
              <button key={k} className={`maps-btn ${pv[k] ? 'gold on-soft' : ''}`} aria-pressed={!!pv[k]} title={title}
                onClick={() => setOverlay({ ...overlay, playerView: { ...pv, [k]: !pv[k] } })}>{label}</button>
            ))}
            {pv.fog && (
              <button className="maps-btn" title="Replonger tout ce plan dans le noir (les lieux découverts redeviennent cachés)"
                onClick={() => { if (window.confirm('Replonger tout ce plan dans le noir ? Les endroits découverts redeviendront cachés aux joueurs.')) forgetFog(); }}>↺ Noir</button>
            )}
          </div>
        )}
        <button className={`maps-btn ${projecting ? 'gold' : ''}`} onClick={() => (projecting ? stopProjecting() : setProjecting(true))} title={projecting ? 'Arrêter la projection aux joueurs' : 'Projeter aux joueurs (écran joueur)'}>
          {projecting ? '■ Projection en cours' : '▶ Projeter aux joueurs'}
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
          onRejoin={rejoin}
        />
      )}
      {projecting && (
        <p className="maps-live">● Écran joueur : {battleOpen ? `carte de combat (${rec.title})` : map.title} · mis à jour en direct</p>
      )}

      {battleOpen ? (
        <BattleMode
          rec={rec} battle={rec.battle ?? DEFAULT_BATTLE} context={locationHint}
          atlas={data} plan={map} markers={overlay.markers}
          onFollow={followPassage} onLink={setPassageLink} onMarker={(id, patch) => updateMarker(id, patch)} onLeave={leaveBattle}
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
          <div className={`maps-canvas ${playerPick && playerPick.id === selectedId ? 'player-pick' : ''}`}>
            <MapCanvas
              key={map.id}
              map={map}
              layers={LAYERS}
              hidden={new Set<FeatureCategory>()}
              selectedId={selectedId}
              onSelect={(f: AtlasFeature) => { setSelectedId(f.id); setEnc(null); }}
              marks={dm ? partyMarks : playerPreview.marks}
              fog={dm ? null : playerPreview.fog}
              journey={overlay.travel && overlay.travel.planId === map.id ? { ...overlay.travel, label: 'Groupe' } : null}
              onAnchor={(a) => { if (dm && rec.kind === 'monde') followAnchor(a.id); }}
              onPlace={dm && placing ? addMarker : undefined}
              dataKey={`${rec.updatedAt}:${dm}`}
              onZoomLimit={onZoomLimit}
              focus={focus ? { kind: 'point', id: focus.id } : null}
              focusKey={focus ? String(focus.tick) : undefined}
              dm={dm}
            />
          </div>

          <aside className="maps-panel maps-side">
            {dm && (
              <nav className="maps-tabs" role="tablist" aria-label="Panneau de la carte">
                {([...(rec.kind === 'monde' ? [['monde', '🏰 Monde']] : []), ['lieu', '📍 Lieu'], ['groupe', '👥 Groupe'], ...(campaigns.length ? [['campagne', '📜 Campagne']] : []), ['reperes', '🔖 Repères']] as [typeof side, string][]).map(([id, label]) => (
                  <button key={id} role="tab" aria-selected={side === id} className={side === id ? 'on' : ''} onClick={() => setSide(id)}>
                    {label}
                    {id === 'groupe' && (party.apart?.length ?? 0) > 0 && <small>{party.apart!.length}</small>}
                  </button>
                ))}
              </nav>
            )}
            {dm && party.halt && (
              <div className="maps-halt" role="status">
                <h4>⏸ Halte en chemin</h4>
                <p className="maps-sub">
                  Sur « {party.halt.trail} », en route vers <b>{party.halt.to.title}</b>, après ≈ {hoursLabel(party.halt.hours)} de marche depuis le dernier jet.
                </p>
                {overlay.alert && overlay.alert.phase !== 'calm' && (
                  <p className="maps-halt-said">Écran joueurs : « {overlay.alert.line} »{overlay.alert.title ? ` · ${overlay.alert.title}` : ''}{overlay.alert.phase === 'encounter' && !overlay.alert.image ? ' (sans image)' : ''}</p>
                )}
                {Date.now() < haltReadyAt ? (
                  <p className="maps-sub">Le groupe avance…</p>
                ) : !party.halt.encounter ? (
                  <>
                    <p><b>Rencontre ?</b></p>
                    <div className="maps-halt-btns">
                      <button className="maps-btn" onClick={() => resume(false, true)} title="Les joueurs lisent « Ah non, ce n'est rien… » et le groupe repart">Rien, on continue ➜</button>
                      <button className="maps-btn gold" onClick={() => haltEncounter(true)} title="Jet de rencontre selon le lieu (le hasard décide)">🎲 Jet de rencontre</button>
                      <button className="maps-btn gold" onClick={() => haltEncounter(false)} title="Le MJ décide qu'il y a une rencontre">⚔ Rencontre !</button>
                    </div>
                  </>
                ) : (
                  <div className="maps-halt-btns">
                    {overlay.alert && <button className="maps-link" onClick={() => setOverlay({ ...overlay, alert: undefined })}>Retirer l’annonce</button>}
                    <button className="maps-btn gold" onClick={() => resume()}>Reprendre la route → {party.halt.to.title}</button>
                    <button className="maps-btn" onClick={() => resume(true)}>← Demi-tour{party.halt.from ? ` vers ${party.halt.from.title}` : ''}</button>
                  </div>
                )}
              </div>
            )}
            {dm && party.fork && !party.halt && (
              <div className="maps-halt maps-fork" role="status">
                <h4>⑂ Bifurcation</h4>
                <p className="maps-sub">
                  Sur « {party.fork.trail} », vis-à-vis de <b>{party.fork.place.title}</b> (sur leur {party.fork.side}){party.fork.known ? '' : ' · lieu encore inconnu des joueurs'}.
                </p>
                <p className="maps-halt-said">Écran joueurs : « {party.fork.line} »</p>
                <div className="maps-halt-btns">
                  <button className="maps-btn gold" onClick={() => forkChoose('out')}>Sortir vers {party.fork.place.title}</button>
                  <button className="maps-btn" onClick={() => forkChoose('on')}>Continuer sur le sentier ➜</button>
                  <button className="maps-btn" onClick={() => forkChoose('back')}>← Demi-tour</button>
                </div>
              </div>
            )}
            {dm && askNote && (
              <p className="maps-hint maps-asknote">{askNote} <button className="maps-link" onClick={() => setAskNote(null)}>OK</button></p>
            )}
            {dm && trial && (
              <div className="maps-trial">
                {trial.by === 'joueurs' && <p className="maps-sub">Les joueurs veulent {trial.aside ? `rejoindre ${trial.to.title}` : 'suivre ce chemin'} : faites l’épreuve.</p>}
                <TrialPanel
                  trail={trial.trail} to={trial.to.title} hazard={trial.hazard} heroes={heroes}
                  onPass={(summary) => go({ f: { id: trial.trailId, title: trial.trail }, leg: trial.leg }, summary)}
                  onCancel={() => setTrial(null)}
                />
              </div>
            )}
            {dm && side === 'campagne' && campaigns.length > 0 && (
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

            {(!dm || side === 'lieu') && dm && selectedMarker && (
              <MarkerEditor
                m={selectedMarker}
                onChange={(patch) => updateMarker(selectedMarker.id, patch)}
                onRemove={() => { if (window.confirm(`Supprimer « ${selectedMarker.title} » ?`)) removeMarker(selectedMarker.id); }}
                onClose={() => setSelectedId(null)}
              />
            )}

            {(!dm || side === 'lieu') && feature && !markerId && (
              <FeaturePanel
                f={feature} dm={dm} notes={point?.notes ?? ''}
                defaultCtx={{ zone: point?.zone ?? (rec.kind === 'monde' ? 'cite' : 'sauvage'), depth: point?.depth ?? 3, place: feature.title }}
                onClose={() => setSelectedId(null)}
                onRoll={(ctx) => setEnc({ ctx, e: rollEncounter(ctx) })}
                onBring={() => bringPlayers(feature.id)}
                revealed={atlasLike ? overlay.revealed.includes(feature.id) : undefined}
                onToggleReveal={atlasLike ? () => toggleReveal(feature.id) : undefined}
                passive={best.pp}
                partyHere={party.at?.id === feature.id} partyDest={party.dest?.id === feature.id}
                onPartyHere={() => setOverlay(withExplored(withPartyAt(overlay, { id: feature.id, kind: 'feature', title: feature.title, planId: map.id }), map.id, pointsOf(feature.id)))}
                onForget={dm && pv.fog ? () => forgetFog(pointsOf(feature.id)) : undefined}
                onPartyDest={() => setDest(party.dest?.id === feature.id ? undefined : { id: feature.id, kind: 'feature', title: feature.title, planId: map.id })}
                follow={dm && feature.trace ? {
                  legs: trailsTo.filter((x) => x.f.id === feature.id).map((x) => ({ label: `Vers ${x.leg.toward}`, to: x.to, hours: x.leg.hours, onGo: () => followTrail(x) })),
                  hazard: trailHazard(feature, trailProfile(feature, feature.trace === 'secret' ? 15 : undefined)),
                  route: routeOf(feature.id), byPlayers: playerPick?.id === feature.id,
                } : undefined}
              />
            )}
            {dm && side === 'lieu' && rec.kind === 'monde' && feature && /:b\d+$/.test(feature.id) && map.surface?.theme === 'cite' && (
              <div className="maps-actions world-enter">
                <button className="maps-btn gold" onClick={() => enterBuilding(feature.id)}>Entrer dans {feature.title}</button>
              </div>
            )}
            {dm && side === 'lieu' && rec.kind === 'monde' && feature?.opens && (
              <div className="maps-actions world-enter">
                <button className="maps-btn gold" onClick={() => enterSite(feature.opens!.id)}>Entrer dans {feature.title}</button>
              </div>
            )}
            {dm && side === 'monde' && rec.kind === 'monde' && rec.world && (
              <WorldPanel rec={rec} data={data} library={library ?? []} planId={map.id} revealed={overlay.revealed} onUpdate={onUpdate}
                onShow={(pid, fid) => { setPlanId(pid); setSelectedId(fid ?? null); if (fid) { setSide('lieu'); setFocus({ kind: 'point', id: fid, tick: Date.now() }); } }} />
            )}
            {dm && side === 'lieu' && feature && !markerId && !feature.trace && rec.kind === 'atlas' && (
              <LiveEncounters
                feature={feature} data={data} bestiary={bestiary as LiveBestiaryRef[]} log={overlay.encounterLog ?? []}
                onLog={(entry) => setOverlay({ ...overlay, encounterLog: [entry, ...(overlay.encounterLog ?? [])].slice(0, 200) })}
                onPlace={(title, summary, notes, groups, entry) => {
                  const xy = placeCoords(data, rec, { id: feature.id, kind: 'feature', title: feature.title, planId: map.id });
                  const draft: Draft = { kind: 'rencontre', title, summary, notes, groups };
                  if (xy) createMarker(draft, xy[0] + 0.004, xy[1] + 0.004, map.id, { encounterLog: [entry, ...(overlay.encounterLog ?? [])].slice(0, 200) });
                  else setPlacing(draft);
                }}
              />
            )}

            {(!dm || side === 'lieu') && !feature && !selectedMarker && (
              <p className="maps-hint">
                {dm
                  ? 'Touche un lieu pour le lire. Objets, passages secrets et rencontres placées : onglet Repères. Tout ce que tu révèles apparaît en direct chez les joueurs.'
                  : 'Mode joueurs : seules les informations partagées sont visibles.'}
              </p>
            )}

            {dm && side === 'groupe' && (
              <div className="maps-card">
                <h3>Groupe</h3>
                <p className="maps-sub">
                  {party.at ? <>Au lieu : <b>{party.at.title}</b> <button className="maps-link" onClick={() => showPlace(party.at!)}>centrer</button></> : 'Position inconnue : choisis un lieu, puis « Le groupe est ici ».'}
                </p>
                {party.dest && <p className="maps-sub">Objectif : <b>{party.dest.title}</b> <button className="maps-link" onClick={() => showPlace(party.dest!)}>centrer</button></p>}
                {(party.apart ?? []).length > 0 && (
                  <ul className="maps-list">
                    {party.apart!.map((h) => (
                      <li key={h.id}>
                        <button className="maps-link" onClick={() => showPlace(h.at)}>🧭 {h.name} · {h.at.title}</button>
                        <button className="maps-btn" onClick={() => rejoin(h.id)} title="Rejoint le groupe">Rejoint</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {dm && side === 'groupe' && party.at && partyAt && (
              <div className="maps-card finds-card">
                <h3>À découvrir ici</h3>
                <p className="maps-sub">Jets à faire faire au groupe à <b>{party.at.title}</b> (Perception passive {best.pp}{best.who ? `, ${best.who}` : ''}).</p>
                {finds.length === 0 && hiddenTrails.length === 0 && <p className="maps-sub">Rien de caché ni à fouiller ici.</p>}
                <ul className="maps-list finds-list">
                  {hiddenTrails.map((t) => (
                    <li key={t.f.id}>
                      <span className="finds-dc">{detectLabel(t.profile.detect)}</span>
                      <button className="maps-link" onClick={() => setSelectedId(t.f.id)}>{t.f.trace === 'secret' ? '🔒 ' : '〰 '}{t.f.title}</button>
                      <button className="maps-btn" onClick={() => toggleReveal(t.f.id)} title="Réussi : le révéler sur la carte des joueurs">Trouvé</button>
                    </li>
                  ))}
                  {finds.map(({ f, entry }) => (
                    <li key={f.id} title={[entry.find, entry.loot && `Butin : ${entry.loot}`, entry.effect].filter(Boolean).join('\n')}>
                      <span className="finds-dc">{entry.skill} {entry.dc}</span>
                      <button className="maps-link" onClick={() => setSelectedId(f.id)}>🔍 {f.title}</button>
                      {atlasLike && !f.id.startsWith('mk-') && (
                        <button className="maps-btn" onClick={() => toggleReveal(f.id)}>{overlay.revealed.includes(f.id) ? 'Visible' : 'Révéler'}</button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {dm && side === 'groupe' && party.at && partyAt && (
              <TrailsPanel
                routeOf={(id) => routeOf(id)}
                onFollow={(id) => { setSelectedId(id); setSide('lieu'); }}
                placeTitle={party.at.title} trails={trails} passive={best.pp} passiveWho={best.who}
                onToggle={(id) => toggleReveal(id)}
                onSelect={(f) => { setSelectedId(f.id); setEnc(null); }}
                onRevealNoticed={() => setOverlay({ ...overlay, revealed: [...new Set([...overlay.revealed, ...trails.filter((t) => t.noticed).map((t) => t.f.id)])] })}
              />
            )}

            {dm && side === 'groupe' && atlasLike && (
              <div className="maps-card">
                <h3>Révélations</h3>
                <p className="maps-sub">{overlay.revealed.length} lieu(x) visible(s) des joueurs, sur l'ensemble {rec.kind === 'monde' ? 'du monde' : 'de l’Atlas'}.</p>
                <div className="maps-enc-ctrl">
                  <button className="maps-btn" onClick={() => revealPlan(true)}>Tout révéler sur ce plan</button>
                  <button className="maps-btn" onClick={() => revealPlan(false)}>Tout cacher sur ce plan</button>
                </div>
              </div>
            )}

            {dm && side === 'reperes' && markers.some((m) => m.kind === 'rencontre') && (
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

            {dm && side === 'lieu' && enc && (
              <EncounterBox
                enc={enc}
                onRoll={rerollEncounter}
                image={enc.e.entry ? overlay.encounterImages?.[enc.e.entry.title] : undefined}
                onImage={(img) => { if (enc.e.entry) setEncounterImage(enc.e.entry.title, img); }}
                onPlace={() => setPlacing({
                  kind: 'rencontre',
                  title: enc.e.entry?.title ?? DEFAULT_TITLE.rencontre,
                  summary: [enc.e.entry?.text, enc.e.attitude, enc.e.wants && `Veut : ${enc.e.wants}`].filter(Boolean).join('\n'),
                  notes: [enc.e.check, enc.e.entry?.hook && `Accroche : ${enc.e.entry.hook}`].filter(Boolean).join('\n'),
                  groups: enc.e.groups,
                })}
              />
            )}

            {dm && side === 'reperes' && (
              <Interactables
                markers={markers.filter((m) => m.kind !== 'rencontre')}
                onChange={(id, patch) => updateMarker(id, patch)}
                onRemove={(id) => removeMarker(id)}
                onAdd={(kind) => setPlacing({ kind, title: DEFAULT_TITLE[kind] })}
              />
            )}

            {dm && side === 'reperes' && rec.kind === 'custom' && (
              <PointEditor rec={rec} onUpdate={onUpdate} selectedId={selectedId} onSelect={setSelectedId} />
            )}
          </aside>
        </div>
      )}



      <p className="maps-footer">
        {dm && atlasLike && <>Statistiques : {SRD_CREDIT} </>}
        {rec.kind === 'custom' && !dm && 'Les repères secrets restent cachés.'}
      </p>
    </div>
  );
}

/** Fil du groupe (MJ) : où il est, où il veut aller, par où il est passé. Visible dans les deux cartes. */
function PartyBar({ party, inBattle, onShow, onBattle, onClearDest, onRejoin }: {
  party: PartyTrack; inBattle: boolean;
  onShow: (p: PartyPlace) => void; onBattle: (p: PartyPlace) => void; onClearDest: () => void;
  /** Un héros séparé rejoint le groupe (il n'est plus suivi à part). */
  onRejoin: (id: string) => void;
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
      {(party.apart ?? []).length > 0 && (
        <span className="party-apart" aria-label="Héros séparés du groupe">
          🧭 Séparés :
          {(party.apart ?? []).map((h) => (
            <span key={h.id} className="party-apart-hero">
              <button className="maps-link" onClick={() => onShow(h.at)} title={`Centrer la carte sur ${h.name}`}>
                {h.image ? <img src={h.image} alt="" /> : null}<b>{h.name}</b> · {h.at.title}
              </button>
              <button className="maps-link" onClick={() => onRejoin(h.id)} aria-label={`${h.name} rejoint le groupe`} title="Rejoint le groupe">×</button>
            </span>
          ))}
        </span>
      )}
      {trail.length > 0 && (
        <span className="party-trail" title="Parcours du groupe">
          {trail.map((t) => <button key={t.id} className="maps-link" onClick={() => onShow(t)}>{t.title}</button>)}
          {at && <b>› {at.title}</b>}
        </span>
      )}
    </div>
  );
}

function FeaturePanel({ f, dm, notes, defaultCtx, onClose, onRoll, revealed, onToggleReveal, onBring, partyHere, partyDest, onPartyHere, onPartyDest, passive = 10, follow, onForget }: {
  f: AtlasFeature; dm: boolean; notes: string; defaultCtx: EncCtx; onClose: () => void; onRoll: (ctx: EncCtx) => void;
  revealed?: boolean; onToggleReveal?: () => void; onBring?: () => void;
  partyHere?: boolean; partyDest?: boolean; onPartyHere?: () => void; onPartyDest?: () => void;
  /** Perception passive du groupe, pour dire si un sentier se voit sans chercher. */
  passive?: number;
  /** Chemin (MJ) : où il mène depuis le groupe, l'épreuve qu'il demande, et l'action de le suivre. */
  follow?: { legs: { label: string; to: PartyPlace | null; hours: number; onGo: () => void }[]; hazard: Hazard | null; route?: TrailVerdict & { text: string; ends?: string }; byPlayers?: boolean };
  /** Brouillard (MJ) : replonger ce lieu dans le noir chez les joueurs. */
  onForget?: () => void;
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
      {follow && (
        <div className="trail-follow">
          <h4>🚶 Suivre ce chemin</h4>
          {follow.byPlayers && <p className="trail-asked">👀 Les joueurs regardent ce chemin sur leur écran.</p>}
          {follow.route?.ends && <p className="maps-sub">Relie : <b>{follow.route.ends}</b></p>}
          {follow.route && <p className={`trail-route v-${follow.route.verdict}`}>{follow.route.text}</p>}
          {follow.legs.length === 0 ? (
            <p className="maps-sub">Le groupe n’est pas sur ce chemin : place-le d’abord à un lieu qu’il traverse (« Le groupe est ici »).</p>
          ) : (
            <>
              {f.trace === 'etroit' && <p className="maps-sub">Étroit : on y passe en file indienne, un à la fois.</p>}
              {follow.hazard ? (
                <div className="trail-hazard">
                  <p><b>Épreuve : {follow.hazard.check} DC {follow.hazard.dc}</b> (chacun, ou l’aventurier de tête)</p>
                  <p><span className="ok">Réussite :</span> {follow.hazard.success}</p>
                  <p><span className="ko">Échec :</span> {follow.hazard.fail}{follow.hazard.damage ? ` ${follow.hazard.damage} dégâts.` : ''}{follow.hazard.setback ? ` ${follow.hazard.setback}` : ''}</p>
                </div>
              ) : <p className="maps-sub">Se suit sans jet.</p>}
              <p className="maps-sub">Le groupe s’arrête à la prochaine caverne ou au prochain lieu sur le tracé.</p>
              <div className="trail-legs">
                {follow.legs.map((l) => (
                  <button key={l.label} className="maps-btn gold" disabled={!l.to} onClick={l.onGo}>
                    {l.label} → <b>{l.to?.title ?? 'aucun lieu connu'}</b> <small>≈ {hoursLabel(l.hours)}{follow.hazard ? ' · épreuve' : ''}</small>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
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
      {dm && onForget && (
        <button className="maps-btn" onClick={onForget} title="Les joueurs ne voient plus cet endroit : il redevient noir dans leur brouillard">🌑 Replonger dans le noir</button>
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

/** Image réduite (1600 px de large au plus, JPEG) pour qu'elle voyage vite jusqu'à l'écran joueur. */
function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1600 / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.84));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image illisible')); };
    img.src = url;
  });
}

function EncounterBox({ enc, onRoll, onPlace, image, onImage }: {
  enc: { ctx: EncCtx; e: Encounter }; onRoll: (force: boolean) => void; onPlace: () => void;
  image?: string; onImage?: (image: string | undefined) => void;
}) {
  const { e } = enc;
  return (
    <div className="maps-card maps-enc">
      <h3>Rencontre</h3>
      <p className="maps-sub">{e.check}</p>
      {!e.happens && <p>Rien ne vient. Le lieu reste calme pour l’instant.</p>}
      {e.happens && e.entry && (
        <>
          <p><strong>{e.entry.kind} · {e.entry.title}</strong></p>
          {onImage && (
            <div className="maps-enc-image">
              {image && <img src={image} alt={e.entry.title} />}
              <label className="maps-btn" title="Illustration montrée aux joueurs quand cette rencontre survient (gardée pour les prochaines fois)">
                🖼 {image ? 'Changer l’image' : 'Ajouter une image'}
                <input type="file" accept="image/*" hidden onChange={async (ev) => { const f = ev.target.files?.[0]; ev.target.value = ''; if (f) onImage(await shrinkImage(f)); }} />
              </label>
              {image && <button className="maps-link" onClick={() => onImage(undefined)}>Retirer</button>}
            </div>
          )}
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
