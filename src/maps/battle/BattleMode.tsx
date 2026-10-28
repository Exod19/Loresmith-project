/**
 * Carte de combat, côté MJ : le plateau au centre, et un panneau en trois onglets.
 * - Combat : initiative, tours, PV, attaques à lancer, conseils tactiques (et plan de l'IA).
 * - Lieu : ce qu'on peut fouiller, les passages secrets et les sorties, repérés sur le plateau (F1, S1, E1).
 * - Construction : peindre le terrain et déposer des objets.
 * Le lieu choisi donne la zone locale : ses passages (tracés réels de l'Atlas) et ses éléments y sont à leur position.
 * « Suivre » un passage ramène sur la carte de navigation, à sa destination, et y déplace le groupe.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import BattleBoard, { anchorOf, type BoardElement, type BoardLabel, type BoardRange, type BoardToken } from './BattleBoard';
import type { AtlasData, AtlasMap } from '../atlas/types';
import {
  DEFAULT_BATTLE, type Battle, type BattleBuild, type BattleToken, type MapMarker, type MapRecord, type PartyTrack, type PassageLink, type SearchNote,
} from '../mapStore';
import { blocksCell, effectiveGrid, generateTerrain, pathCost, seedOf, TERRAIN, type LocationHint, type TerrainKind } from './terrain';
import { buildLocalMap, cellIn } from './local';
import { attackCells, rangedCells, reachableCells, speedCells } from './ranges';
import { tokenImage } from './vignettes';
import BuildPanel from './BuildPanel';
import CombatPanel, { type Hero } from './CombatPanel';
import type { BestiaryRef } from '../CampaignGuide';
import PlacePanel, { type ExitItem, type SearchItem, type SecretItem } from './PlacePanel';
import { DEFAULT_BRUSH, PROP_BY_KEY, PROP_LABEL, propUrl, shapeCells, type Brush } from './build';
import { passageDifficulty, searchFor, type SearchEntry } from './search';
import { advanceBattle, isOut, passiveOfToken, sightOf, statOf } from './combat';
import { detectLabel, trailProfile } from '../atlas/trails';
import { describeLite } from '../atlas/lore';
import { placeEncounter, type EncounterGroup } from './encounter';
import { askAI, aiReady, parseJson } from '../../ai/client';
import { effectiveOf, fits, placeTokens as placeOnBoard } from './placement';
import './battle.css';

/** Niveaux de zoom du plateau (même logique que la carte de navigation). */
const ZOOMS = [0.75, 1, 1.5, 2, 2.5, 3];
const uid = () => Math.random().toString(36).slice(2, 10);
/** Types de terrain qui méritent une ligne dans la légende. */
const LEGEND_ORDER: TerrainKind[] = ['.', '#', '~', ':', '=', 'X', 'I', ','];
const SWATCH: Partial<Record<TerrainKind, string>> = { '.': 'floor', '#': 'rock', '~': 'water', ':': 'rubble', '=': 'bridge', X: 'chasm', I: 'pillar', ',': 'decor' };

type Box = { x: number; y: number; size: number };
type Tab = 'combat' | 'lieu' | 'construction';

/** Distance entre deux jetons (centres), selon la règle 5e : la diagonale compte comme une case droite. */
export function feetBetween(a: Box, b: Box, feetPerCell: number) {
  const ca = a.x + (a.size - 1) / 2, cb = b.x + (b.size - 1) / 2;
  const da = a.y + (a.size - 1) / 2, db = b.y + (b.size - 1) / 2;
  const cells = Math.round(Math.max(Math.abs(ca - cb), Math.abs(da - db)));
  return { cells, feet: cells * feetPerCell };
}

/**
 * Ce que reçoit le module Combat affiché sous le plateau : le combat de la carte (jetons, tour), le lieu,
 * une clé propre à ce combat (une autre zone = un autre combat), et la sélection partagée avec le plateau.
 */
export type CombatSlot = {
  battle: Battle;
  setBattle: (b: Battle) => void;
  place: string;
  combatKey: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** 'encounter' : le module sous le plateau ; 'card' : l'aperçu de la fiche du jeton sélectionné, à droite. */
  area: 'encounter' | 'card';
};

export default function BattleMode({
  rec, battle, onBattle, context, atlas, plan, markers, onFollow, onLink, onMarker, onReveal, heroes = [], party, onSearchNote, bestiary = [], renderCombat,
}: {
  rec: MapRecord; battle: Battle; onBattle: (b: Battle) => void;
  /** Lieu sélectionné : sa zone locale est placée sur la grille à l'ouverture ; une rencontre y place ses créatures. */
  context: (LocationHint & { id: string; groups?: EncounterGroup[] }) | null;
  atlas: AtlasData | undefined; plan: AtlasMap | undefined; markers: MapMarker[];
  onFollow: (link: PassageLink) => void;
  onLink: (passageId: string, link: PassageLink | null) => void;
  onMarker: (id: string, patch: Partial<MapMarker>) => void;
  /** Révèle ou cache un élément pour les joueurs : même interrupteur que sur la carte de navigation. */
  onReveal: (featureId: string) => void;
  heroes?: Hero[];
  /** Fiches de PNJ & Créatures, pour les ajouter au combat avec leur jeton. */
  bestiary?: BestiaryRef[];
  party?: PartyTrack;
  /** Réécrit (ou rétablit, avec null) la fiche de fouille d'un élément. */
  onSearchNote?: (id: string, note: SearchNote | null) => void;
  /** Module Combat de l'application, affiché sous le plateau (à la place de l'onglet Combat). */
  renderCombat?: (slot: CombatSlot) => ReactNode;
}) {
  const b = battle ?? DEFAULT_BATTLE;
  const [tab, setTab] = useState<Tab | null>(!renderCombat && b.tokens.some((t) => t.kind === 'monster') ? 'combat' : 'lieu');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  /** Élément survolé dans les listes : éclairé sur le plateau, pour le MJ seulement. */
  const [hoverId, setHoverId] = useState<string | null>(null);
  /** Portées affichées sur le plateau : réservé au MJ, jamais envoyé aux joueurs. */
  const [showRanges, setShowRanges] = useState(false);
  /** Construction manuelle : outil, tracé en cours, et historique pour « Annuler ». */
  const building = tab === 'construction';
  const [brush, setBrush] = useState<Brush>(DEFAULT_BRUSH);
  const [propVisible, setPropVisible] = useState(true);
  const [stroke, setStroke] = useState<{ anchor: { x: number; y: number }; cur: { x: number; y: number }; cells: number[] } | null>(null);
  const [history, setHistory] = useState<(BattleBuild | undefined)[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  /** Glisser d'un jeton en cours : case de départ, case actuelle, et si le jeton a bougé. */
  const [drag, setDrag] = useState<{ id: string; origin: { x: number; y: number }; start: { x: number; y: number }; cur: { x: number; y: number }; moved: boolean; wasSelected: boolean } | null>(null);
  /** Vrai juste après un déplacement : le clic qui suit le relâchement ne doit pas désélectionner. */
  const justDropped = useRef(false);
  const [zoom, setZoom] = useState(1);
  /** Élément dont la fiche est ouverte sur le plateau. */
  const [infoId, setInfoId] = useState<string | null>(null);
  // Une seule fiche ouverte à la fois : celle d'un jeton ou celle d'un élément du lieu.
  useEffect(() => { if (selectedId) setInfoId(null); }, [selectedId]);
  useEffect(() => { if (infoId) setSelectedId(null); }, [infoId]);
  const [rewrite, setRewrite] = useState<{ busy: boolean; error?: string }>({ busy: false });

  const selected = b.tokens.find((t) => t.id === selectedId) ?? null;
  const set = (patch: Partial<Battle>) => onBattle({ ...b, ...patch });
  const build: BattleBuild = b.build ?? { edits: {}, props: [] };
  const commitBuild = (next: BattleBuild | undefined) => {
    setHistory((h) => [...h.slice(-49), b.build]);
    set({ build: next });
  };
  // Une seule source de vérité : les éléments révélés de la fiche (« Montrer aux joueurs »).
  const discovered = rec.overlay?.revealed ?? [];
  const bv: Battle = b.local ? { ...b, local: { ...b.local, discovered } } : b;
  const grid = effectiveOf(bv);
  const placeTitle = context?.title ?? b.local?.place ?? rec.title;

  /**
   * Construit la carte du lieu : terrain, passages et éléments à leur place. Une rencontre place aussi ses créatures,
   * groupées (caravane) ou dispersées (mineurs) selon leur rôle. `n` change la disposition du terrain (« Régénérer »).
   */
  const generate = (hint: LocationHint, source: string, n: number, groups?: EncounterGroup[]) => {
    const seed = (seedOf(source) + n * 2654435761) >>> 0;
    if (!(atlas && plan)) {
      set({ terrain: { source, seed, grid: generateTerrain(b.cols, b.rows, hint, seed) }, local: undefined, build: undefined });
      setHistory([]);
      return;
    }
    const local = buildLocalMap({ atlas, plan, markers, centerId: source, cols: b.cols, rows: b.rows, hint, seed });
    const previous = b.local?.source === source ? b.local.discovered : [];
    const ids = local.elements.map((e) => e.id);
    const ground = effectiveGrid(local.base, local.elements, [], ids);
    let tokens = b.tokens;
    if (groups?.length) {
      const kept = b.tokens.filter((t) => t.kind !== 'monster');
      const free = (x: number, y: number, size: 1 | 2) =>
        x >= 0 && y >= 0 && x + size <= b.cols && y + size <= b.rows
        && !Array.from({ length: size * size }).some((_, i) => blocksCell(ground, b.cols, x + (i % size), y + Math.floor(i / size)))
        && !kept.some((t) => t.x < x + size && x < t.x + t.size && t.y < y + size && y < t.y + t.size);
      tokens = [...kept, ...placeEncounter(groups, b.cols, b.rows, free, seed)];
    }
    set({
      terrain: { source, seed, grid: local.base },
      local: { source, planId: plan.id, place: hint.title, window: local.window, elements: local.elements, discovered: previous },
      tokens,
      encounterOf: groups?.length ? source : b.encounterOf,
      build: undefined,
      ...(groups?.length ? { turn: undefined, round: 1, log: [] } : {}),
    });
    setHistory([]);
    if (groups?.length && !renderCombat) setTab('combat');
  };

  useEffect(() => {
    if (!context) return;
    const placed = !context.groups?.length || b.encounterOf === context.id;
    if (b.local?.source === context.id && placed) return;
    generate(context, context.id, 0, context.groups);
    // Seul le changement de lieu déclenche la génération ; le reste se fait à la main.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context?.id]);

  /** Case du plateau sous le pointeur (le SVG est mis à l'échelle en gardant les proportions). */
  const cellAt = (clientX: number, clientY: number) => {
    const svg = wrapRef.current?.querySelector('svg.battle-board');
    if (!(svg instanceof SVGSVGElement)) return null;
    const r = svg.getBoundingClientRect();
    const s = Math.min(r.width / b.cols, r.height / b.rows);
    const x = Math.floor((clientX - (r.left + (r.width - b.cols * s) / 2)) / s);
    const y = Math.floor((clientY - (r.top + (r.height - b.rows * s) / 2)) / s);
    return x >= 0 && y >= 0 && x < b.cols && y < b.rows ? { x, y } : null;
  };
  const paintCells = (cells: number[], kind: TerrainKind | 'gomme') => {
    const edits = { ...build.edits };
    for (const c of cells) { if (kind === 'gomme') delete edits[c]; else edits[c] = kind; }
    commitBuild({ ...build, edits });
  };
  const placeProp = (cell: { x: number; y: number }, prop: string | 'gomme') => {
    const idx = cell.y * b.cols + cell.x;
    if (prop === 'gomme' && !build.props.some((p) => p.cell === idx)) return;
    const props = build.props.filter((p) => p.cell !== idx);
    if (prop !== 'gomme') props.push({ id: uid(), key: prop, cell: idx, visible: propVisible });
    commitBuild({ ...build, props });
  };
  const onBoardDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    if (!building) {
      // Saisir un jeton : il est sélectionné, et le glisser le déplace. Sans mouvement, c'est un simple clic.
      const c = cellAt(e.clientX, e.clientY);
      const t = c && b.tokens.find((q) => c.x >= q.x && c.x < q.x + q.size && c.y >= q.y && c.y < q.y + q.size);
      if (!c || !t) return;
      e.preventDefault();
      setDrag({ id: t.id, origin: { x: t.x, y: t.y }, start: c, cur: c, moved: false, wasSelected: selectedId === t.id });
      setSelectedId(t.id);
      if (b.turn && !renderCombat) setTab('combat');
      return;
    }
    const c = cellAt(e.clientX, e.clientY);
    if (!c) return;
    e.preventDefault();
    if (brush.tool === 'objet') { placeProp(c, brush.prop); return; }
    setStroke({ anchor: c, cur: c, cells: [c.y * b.cols + c.x] });
  };
  const onBoardMove = (e: ReactPointerEvent) => {
    if (drag) {
      const c = cellAt(e.clientX, e.clientY);
      if (c && (c.x !== drag.cur.x || c.y !== drag.cur.y)) setDrag({ ...drag, cur: c, moved: true });
      return;
    }
    if (!stroke || brush.tool !== 'terrain') return;
    const c = cellAt(e.clientX, e.clientY);
    if (!c || (c.x === stroke.cur.x && c.y === stroke.cur.y)) return;
    const cells = brush.shape === 'pinceau'
      ? [...new Set([...stroke.cells, c.y * b.cols + c.x])]
      : shapeCells(brush.shape, stroke.anchor, c, b.cols);
    setStroke({ ...stroke, cur: c, cells });
  };
  // Le glisser se termine au relâchement : le jeton reste là si la case n'est pas libre.
  useEffect(() => {
    if (!drag) return;
    const up = () => {
      const t = b.tokens.find((q) => q.id === drag.id);
      if (t && drag.moved) {
        const x = drag.origin.x + drag.cur.x - drag.start.x, y = drag.origin.y + drag.cur.y - drag.start.y;
        if (fits(bv, t.id, t.size, x, y)) patchToken(t.id, { x, y });
        justDropped.current = true;
        setTimeout(() => { justDropped.current = false; }, 0);
      } else if (drag.wasSelected) {
        setSelectedId(null);
      }
      setDrag(null);
    };
    window.addEventListener('pointerup', up, { once: true });
    return () => window.removeEventListener('pointerup', up);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  // Le tracé se termine au relâchement, même hors du plateau.
  useEffect(() => {
    if (!stroke) return;
    const up = () => {
      if (brush.tool === 'terrain') paintCells(stroke.cells, brush.kind);
      setStroke(null);
    };
    window.addEventListener('pointerup', up, { once: true });
    return () => window.removeEventListener('pointerup', up);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stroke]);
  const undo = () => {
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    set({ build: prev });
  };

  const patchToken = (id: string, patch: Partial<BattleToken>) => set({ tokens: b.tokens.map((t) => (t.id === id ? { ...t, ...patch } : t)) });

  /** Pose des jetons près du centre, chacun sur la première case libre. */
  function placeTokens(list: Omit<BattleToken, 'x' | 'y'>[]) {
    const placed = placeOnBoard(bv, list);
    if (placed.length) set({ tokens: [...b.tokens, ...placed] });
  }

  /** Clic sur une case vide : désélectionne le jeton et ferme la fiche. Les jetons se déplacent par glisser-déposer. */
  function onBoardCell() {
    if (justDropped.current) return;
    setInfoId(null);
    setSelectedId(null);
  }
  /** Avance d'un tour et sélectionne le combattant dont c'est le tour. */
  const advance = (dir: 1 | -1) => {
    const patch = advanceBattle(b, dir);
    set(patch);
    if (patch.turn) setSelectedId(patch.turn);
  };
  // Raccourcis : N ou Espace = tour suivant, B = tour précédent, Échap = tout désélectionner (hors champs de saisie).
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    const typing = e.target instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName);
    if (e.key === 'Escape') { setSelectedId(null); setInfoId(null); return; }
    // Avec le module Combat sous le plateau, c'est lui qui mène l'initiative et les tours.
    if (renderCombat || typing || e.ctrlKey || e.metaKey || e.altKey || !b.tokens.some((t) => t.init !== undefined)) return;
    if (e.key === 'n' || e.key === 'N' || e.key === ' ') { e.preventDefault(); advance(1); }
    else if (e.key === 'b' || e.key === 'B') { e.preventDefault(); advance(-1); }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const zoomBy = (dir: 1 | -1) => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, ZOOMS.indexOf(z) + dir))] ?? z);

  // Passages : tracés réels de l'Atlas, et portes posées par le MJ sur ce plan.
  const localElements = b.local?.elements ?? [];
  const passages = [
    ...localElements.filter((e) => e.kind === 'passage').map((e) => ({
      id: e.id, title: e.title, secret: e.secret, found: discovered.includes(e.id), dc: e.dc, checkLabel: e.checkLabel, auto: e.auto,
      cells: e.cells ?? [], trace: e.trace, subtitle: e.subtitle, summary: describeLite(e) || undefined, marker: undefined as MapMarker | undefined,
    })),
    ...markers.filter((m) => m.kind === 'passage' && m.planId === plan?.id).map((m) => ({
      id: `mk-${m.id}`, title: m.title, secret: true, found: m.revealed, dc: m.dcInvestigate ?? 14, checkLabel: 'Investigation', auto: undefined as PassageLink | undefined,
      cells: [] as number[], trace: 'secret', subtitle: undefined as string | undefined, summary: m.summary, marker: m,
    })),
  ];
  const linkOf = (id: string) => rec.overlay?.passageLinks?.[id] ?? passages.find((p) => p.id === id)?.auto;
  const dest = party?.dest;
  const towardDest = (link?: PassageLink) => !!(dest && link && (link.id === dest.id || link.label.startsWith(dest.title)));

  const profileOf = (p: (typeof passages)[number]) => trailProfile({ title: p.title, trace: p.trace }, p.secret ? p.dc : undefined);
  // Joueurs sur le plateau : ce qu'ils voient sans chercher (Perception passive, à portée de vue).
  const pcs = b.tokens.filter((t) => t.kind === 'pc');
  const seenBy = (cells: number[], skill: string, dc: number) => {
    if (!/perception/i.test(skill) || !cells.length) return undefined;
    return pcs.find((t) => {
      const near = cells.some((c) => {
        const x = c % b.cols, y = Math.floor(c / b.cols);
        return Math.max(Math.max(0, t.x - x, x - (t.x + t.size - 1)), Math.max(0, t.y - y, y - (t.y + t.size - 1))) <= sightOf(t);
      });
      return near && dc <= passiveOfToken(t);
    })?.name;
  };
  const secrets: SecretItem[] = passages.filter((p) => p.secret).map((p, i) => ({
    id: p.id, label: `S${i + 1}`, title: p.title, dc: p.dc, check: p.checkLabel, found: p.found, link: linkOf(p.id), profile: profileOf(p),
    seenBy: seenBy(p.cells, p.checkLabel ?? 'Perception', p.dc ?? 15),
  }));
  // Sorties : les galeries qui quittent le plateau, mènent à un autre plan, ou dont le MJ a inscrit la destination.
  // Une même destination n'est listée qu'une fois ; les galeries internes restent sur le plateau, cliquables.
  const onEdge = (cells: number[]) => cells.some((c) => { const x = c % b.cols, y = Math.floor(c / b.cols); return x === 0 || y === 0 || x === b.cols - 1 || y === b.rows - 1; });
  const seenDest = new Set<string>();
  const exitList = passages.filter((p) => {
    const link = linkOf(p.id);
    if (p.secret || !link) return false;
    if (!(rec.overlay?.passageLinks?.[p.id] || link.kind === 'anchor' || onEdge(p.cells))) return false;
    if (seenDest.has(link.id)) return false;
    seenDest.add(link.id);
    return true;
  });
  const exits: ExitItem[] = exitList
    .map((p) => ({ id: p.id, label: '', title: p.title, link: linkOf(p.id)!, toward: towardDest(linkOf(p.id)), profile: profileOf(p) }))
    .sort((x, y) => Number(y.toward) - Number(x.toward))
    .map((e, i) => ({ ...e, label: `E${i + 1}` }));
  const others = passages.filter((p) => !p.secret).length - exits.length;

  // À fouiller : lieux de l'Atlas jouables (cf. search.ts), et éléments interactifs posés par le MJ.
  const notes = rec.overlay?.searchNotes ?? {};
  const searchPoints = localElements
    .filter((e) => e.kind === 'point' && e.cell !== undefined)
    .map((e) => ({ e, entry: searchFor(e.title, notes[e.id]) }))
    .filter((x): x is { e: typeof x.e; entry: SearchEntry } => !!x.entry);
  const markerPoints = b.local?.window && plan
    ? markers.filter((m) => m.planId === plan.id && (m.kind === 'objet' || m.kind === 'repere')).flatMap((m) => {
      const cell = cellIn(b.local!.window, b.cols, b.rows, m.x, m.y);
      const entry: SearchEntry = { skill: 'Investigation', dc: m.dcInvestigate ?? 12, find: m.reading || m.summary || 'À décrire.', loot: m.keep, effect: m.effect };
      return cell === undefined ? [] : [{ m, cell, entry }];
    })
    : [];
  const search: SearchItem[] = [
    ...searchPoints.map(({ e, entry }) => ({ id: e.id, label: '', title: e.title, entry, shown: discovered.includes(e.id) })),
    ...markerPoints.map(({ m, entry }) => ({ id: `mk-${m.id}`, label: '', title: m.title, entry, shown: m.revealed })),
  ].map((s, i) => ({ ...s, label: `F${i + 1}` }));
  // Qui remarque l'élément sans chercher (calculé après les cases, plus bas).

  // Destinations proposées : ancres de l'Atlas, et éléments interactifs de cet univers.
  const anchorOptions = (atlas?.anchors ?? []).map((a) => {
    const mapTitle = atlas?.maps.find((m) => m.id === a.mapId)?.title ?? a.mapId;
    return { value: `anchor:${a.id}`, label: `${a.label} · ${mapTitle}`, link: { kind: 'anchor' as const, id: a.id, planId: a.mapId, label: `${a.label} · ${mapTitle}` } };
  });
  const markerOptions = markers.filter((m) => m.kind === 'objet' || m.kind === 'repere').map((m) => ({
    value: `marker:${m.id}`, label: `${m.title} (élément)`, link: { kind: 'marker' as const, id: m.id, planId: m.planId, label: m.title },
  }));
  const options = [...anchorOptions, ...markerOptions];

  // Éléments du plateau : passages, éléments à fouiller, repères du MJ et objets déposés. Cachés : en pointillés pour le MJ.
  const boardElements: BoardElement[] = [
    ...localElements.filter((e) => e.kind === 'passage').map((e) => ({
      id: e.id, kind: 'passage' as const, title: e.title, category: e.category, cells: e.cells,
      ghost: e.secret && !discovered.includes(e.id), dc: e.dc, info: { subtitle: e.subtitle, text: describeLite(e) },
    })),
    ...searchPoints.map(({ e }) => ({
      id: e.id, kind: 'point' as const, title: e.title, category: e.category, cell: e.cell,
      ghost: !discovered.includes(e.id), info: { subtitle: e.subtitle, text: describeLite(e) },
    })),
    ...markerPoints.map(({ m, cell }) => ({
      id: `mk-${m.id}`, kind: 'point' as const, title: m.title, category: 'indetermine', cell, ghost: !m.revealed, dc: m.dcInvestigate,
      info: { text: [m.reading, m.summary].filter(Boolean).join('\n\n') },
    })),
    ...build.props.map((p) => ({
      id: `pr-${p.id}`, kind: 'point' as const, title: PROP_LABEL[p.key] ?? p.key, category: 'indetermine', cell: p.cell,
      image: propUrl(p.key), ghost: !p.visible,
      info: { subtitle: 'Objet', text: PROP_BY_KEY[p.key]?.text, image: propUrl(p.key) },
    })),
  ];
  const cellsOf = (id: string): number[] => {
    const el = boardElements.find((e) => e.id === id);
    return el ? (el.cells ?? (el.cell !== undefined ? [el.cell] : [])) : [];
  };

  // Repères MJ : F1 sur les éléments à fouiller, S1 sur les passages secrets, E1 sur les sorties.
  for (const s of search) s.seenBy = seenBy(cellsOf(s.id), s.entry.skill, s.entry.dc);
  const labels: BoardLabel[] = [
    ...search.flatMap((s) => { const c = cellsOf(s.id)[0]; return c === undefined ? [] : [{ cell: c, text: s.label, tone: 'search' as const, noticed: !!s.seenBy && !s.shown }]; }),
    ...secrets.flatMap((s) => { const c = cellsOf(s.id); return c.length ? [{ cell: anchorOf(c, b.cols), text: s.label, tone: 'secret' as const, noticed: !!s.seenBy && !s.found }] : []; }),
    ...exits.flatMap((e) => { const c = cellsOf(e.id); return c.length ? [{ cell: anchorOf(c, b.cols), text: e.label, tone: e.toward ? 'dest' as const : 'exit' as const }] : []; }),
  ];
  const highlight = hoverId ? cellsOf(hoverId) : infoId ? cellsOf(infoId) : undefined;

  // Portées : déplacement (cases atteignables, terrain compté) et anneau d'attaque, pour chaque créature et chaque joueur.
  const rangeOf = (t: BattleToken): BoardRange => ({
    id: t.id, x: t.x, y: t.y, size: t.size,
    move: reachableCells(grid, b.cols, b.rows, t, speedCells(statOf(t))),
    attack: attackCells(statOf(t)), ranged: rangedCells(statOf(t)), selected: t.id === selectedId,
    ...(t.kind === 'pc' ? { sight: sightOf(t), search: 1 } : {}),
  });
  // Pendant un glisser, la zone de déplacement du jeton s'affiche depuis sa case de départ.
  const dragged = drag?.moved ? b.tokens.find((t) => t.id === drag.id) : undefined;
  const ranges: BoardRange[] = showRanges ? b.tokens.map(rangeOf) : dragged ? [{ ...rangeOf(dragged), attack: 0, ranged: 0 }] : [];

  const liveAt = (t: BattleToken) => (drag?.moved && drag.id === t.id
    ? { x: drag.origin.x + drag.cur.x - drag.start.x, y: drag.origin.y + drag.cur.y - drag.start.y }
    : { x: t.x, y: t.y });
  const boardTokens: BoardToken[] = b.tokens.map((t) => {
    const at = liveAt(t);
    return {
      id: t.id, name: t.name, kind: t.kind, x: at.x, y: at.y, size: t.size, icon: t.icon, image: tokenImage(t),
      selected: t.id === selectedId, hidden: !t.visible, active: t.id === b.turn, hp: t.hp, maxHp: t.maxHp, out: isOut(t),
    };
  });

  const readout = selected && hover ? feetBetween(selected, { ...hover, size: 1 }, b.feetPerCell) : null;
  const walk = selected && hover ? pathCost(grid, b.cols, b.rows, selected, hover) : null;
  const hoverKind = hover && grid ? TERRAIN[grid[hover.y * b.cols + hover.x] as keyof typeof TERRAIN]?.label : null;
  const present = new Set<string>(grid ? Array.from(grid) : []);
  const activeToken = b.tokens.find((t) => t.id === b.turn);

  // Fiche ouverte : élément du plateau, et ce que le MJ en sait.
  const info = boardElements.find((e) => e.id === infoId) ?? null;
  const infoSearch = info ? search.find((s) => s.id === info.id) ?? null : null;
  const infoPassage = info ? passages.find((p) => p.id === info.id) ?? null : null;
  const infoMarker = info?.id.startsWith('mk-') ? markers.find((m) => `mk-${m.id}` === info.id) ?? null : null;
  /** Visibilité d'un élément pour les joueurs : lieu de l'Atlas, repère du MJ ou objet déposé. */
  const toggleShown = (id: string) => {
    if (id.startsWith('pr-')) {
      commitBuild({ ...build, props: build.props.map((p) => (`pr-${p.id}` === id ? { ...p, visible: !p.visible } : p)) });
    } else if (id.startsWith('mk-')) {
      const m = markers.find((x) => `mk-${x.id}` === id);
      if (m) onMarker(m.id, { revealed: !m.revealed });
    } else onReveal(id);
  };
  const isShown = (id: string) => (id.startsWith('pr-') ? !!build.props.find((p) => `pr-${p.id}` === id)?.visible
    : id.startsWith('mk-') ? !!markers.find((m) => `mk-${m.id}` === id)?.revealed : discovered.includes(id));
  /** Passage le plus proche d'un élément à fouiller (dans un rayon de 4 cases) : ce que la fouille peut ouvrir. */
  const passageNear = (cell: number | undefined) => {
    if (cell === undefined) return null;
    const x = cell % b.cols, y = Math.floor(cell / b.cols);
    let best: (typeof passages)[number] | null = null, bestD = 5;
    for (const p of passages) for (const c of p.cells) {
      const d = Math.max(Math.abs((c % b.cols) - x), Math.abs(Math.floor(c / b.cols) - y));
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  };

  async function rewriteSearch(id: string, title: string, entry: SearchEntry) {
    setRewrite({ busy: true });
    try {
      const el = localElements.find((e) => e.id === id);
      const text = await askAI(
        'Tu es un maître du jeu de D&D 5e qui prépare une séance dans l’Outreterre. Tu écris des fiches de fouille concises, concrètes et évocatrices, en français.',
        `Lieu : ${placeTitle}. Élément : ${title}${el?.summary ? ` (${el.summary})` : ''}.\nFiche actuelle : ${JSON.stringify(entry)}.\nRéécris-la avec des détails propres à ce lieu. Champs : skill (compétence 5e), dc (nombre), find (ce que le joueur trouve, 1 à 2 phrases), loot (butin, ou chaîne vide), effect (effet en jeu, ou chaîne vide).`,
        { json: true },
      );
      const note = parseJson<SearchNote>(text);
      if (!note?.find || !note.skill || !Number.isFinite(Number(note.dc))) throw new Error('Réponse de l’IA illisible.');
      onSearchNote?.(id, { skill: note.skill, dc: Number(note.dc), find: note.find, loot: note.loot || undefined, effect: note.effect || undefined });
      setRewrite({ busy: false });
    } catch (e) {
      setRewrite({ busy: false, error: (e as Error).message });
    }
  }

  const legend = grid ? (
    <details className="maps-card battle-legend">
      <summary>Légende</summary>
      <ul>
        {LEGEND_ORDER.filter((k) => present.has(k)).map((k) => (
          <li key={k}><span className={`battle-swatch k-${SWATCH[k]}`} />{TERRAIN[k].label}</li>
        ))}
        {secrets.some((s) => !s.found) && <li><span className="battle-swatch k-secret" />Passage secret fermé (MJ seulement)</li>}
        {secrets.some((s) => s.found) && <li><span className="battle-swatch k-secret-open" />Passage secret découvert</li>}
        <li><span className="place-tag tone-search">F</span><span className="place-tag tone-secret">S</span><span className="place-tag tone-exit">E</span>Repères du MJ, jamais montrés aux joueurs</li>
      </ul>
      <p className="maps-sub">Une case = 5 pieds ; une diagonale compte comme une case droite. Eau et éboulis comptent double.</p>
    </details>
  ) : null;

  const combatKey = `${rec.id}:${b.local?.source ?? b.terrain?.source ?? 'plateau'}`;

  return (
    <>
    <div className="maps-body battle-body">
      <div className="maps-canvas battle-canvas">
        <div className="battle-bar">
          <div className="battle-where">
            <span className="battle-place-name">{placeTitle}</span>
            <span className="battle-turn-chip">
              Round {b.round}{activeToken ? <> · tour de <b>{activeToken.name}</b></> : null}
            </span>
          </div>
          <div className="battle-tools">
            <details className="battle-menu">
              <summary className="maps-btn">Terrain ▾</summary>
              <div className="battle-menu-pop">
                <button
                  className="maps-btn" disabled={!b.terrain || !!b.local}
                  title={b.local ? 'Le terrain suit la carte de navigation : il ne change pas tant que le lieu ne change pas.' : 'Une autre disposition pour le même lieu'}
                  onClick={() => generate(context ?? { title: 'Caverne' }, b.terrain!.source, (b.terrain!.seed & 0xff) + 1, undefined)}
                >↻ Régénérer</button>
                {b.terrain
                  ? <button className="maps-btn" onClick={() => set({ terrain: undefined, local: undefined, encounterOf: undefined, build: undefined })}>Terrain vierge</button>
                  : <button className="maps-btn" onClick={() => generate(context ?? { title: 'Caverne' }, context?.id ?? 'caverne', 0)}>Générer un terrain</button>}
                <button className="maps-btn" onClick={() => { if (window.confirm('Retirer tous les jetons du plateau ?')) set({ tokens: [], round: 1, turn: undefined, log: [] }); }}>Vider le plateau</button>
              </div>
            </details>
            <div className="battle-zoom" title="Zoom du plateau">
              <button className="maps-btn" onClick={() => zoomBy(-1)} disabled={zoom <= ZOOMS[0]} aria-label="Dézoomer">−</button>
              <span>{Math.round(zoom * 100)} %</span>
              <button className="maps-btn" onClick={() => zoomBy(1)} disabled={zoom >= ZOOMS[ZOOMS.length - 1]} aria-label="Zoomer">+</button>
            </div>
            <button className={`maps-btn ${showRanges ? 'gold' : ''}`} title="Déplacements et portées d'attaque (MJ seulement)" onClick={() => setShowRanges((v) => !v)}>◎ Portées</button>
          </div>
        </div>

        {secrets.length > 0 && (
          <div className="battle-chips" aria-label="Passages secrets">
            {secrets.map((s) => (
              <button
                key={s.id} className={`battle-chip ${s.found ? 'on' : ''}`} aria-pressed={s.found}
                onMouseEnter={() => setHoverId(s.id)} onMouseLeave={() => setHoverId(null)}
                onClick={() => toggleShown(s.id)} title={s.found ? 'Trouvé : clic pour le recacher' : 'Caché : clic quand les joueurs le trouvent'}
              >
                <b>{s.label}</b> {s.found ? '🔓' : '🔒'} {s.title}
              </button>
            ))}
          </div>
        )}

        <div className="battle-stage">
          <div
            ref={wrapRef} className={`battle-board-wrap ${building ? 'building' : ''} ${zoom !== 1 ? 'zoomed' : ''} ${drag ? 'dragging' : ''}`}
            style={{ width: `${zoom * 100}%` }}
            onPointerDown={onBoardDown} onPointerMove={onBoardMove}
            onDragOver={(e) => { if (building) e.preventDefault(); }}
            onDrop={(e) => {
              if (!building) return;
              e.preventDefault();
              const key = e.dataTransfer.getData('text/plain');
              const c = cellAt(e.clientX, e.clientY);
              if (c && PROP_LABEL[key]) placeProp(c, key);
            }}
          >
            <BattleBoard
              cols={b.cols} rows={b.rows} backdrop={rec.image} terrain={grid} elements={boardElements} ranges={ranges} tokens={boardTokens} interactive={!building}
              onCell={onBoardCell} onElement={(id) => { if (boardElements.some((e) => e.id === id)) setInfoId(id); }} onHover={(x, y) => setHover({ x, y })}
              preview={stroke && brush.tool === 'terrain' ? stroke.cells : undefined}
              labels={labels} highlight={highlight}
            />
            {readout && (
              <div className="battle-readout">
                {walk === null ? 'Chemin coupé' : <>{walk * b.feetPerCell} pieds de marche</>}
                {walk !== null && <span className="battle-sub"> · {readout.feet} à vol d'oiseau</span>}
                {hoverKind && <span className="battle-sub"> · {hoverKind}</span>}
              </div>
            )}
          </div>

          {info && (
            <aside className="battle-fiche" role="dialog" aria-label={info.title}>
              <button className="present-info-close" onClick={() => setInfoId(null)} aria-label="Fermer">×</button>
              <span className="present-info-kind">
                {infoSearch ? `${infoSearch.label} · à fouiller` : infoPassage ? `${secrets.find((s) => s.id === info.id)?.label ?? exits.find((e) => e.id === info.id)?.label ?? 'Galerie'} · ${infoPassage.secret ? 'passage secret' : 'passage'}` : info.info?.subtitle ?? 'Élément'}
              </span>
              {info.info?.image && <img className="present-info-img" src={info.info.image} alt="" />}
              <h3>{info.title}</h3>
              {info.info?.subtitle && !infoSearch && <p className="maps-sub">{info.info.subtitle}</p>}

              {infoSearch && (() => {
                const near = infoSearch.entry.passage ? passageNear(info.cell) : null;
                const nearLink = near ? linkOf(near.id) : undefined;
                return (
                  <dl className="fiche-facts">
                    <dt>Pour le trouver</dt><dd><b>{infoSearch.entry.skill} DC {infoSearch.entry.dc}</b></dd>
                    <dt>Ce qu’on trouve</dt><dd>{infoSearch.entry.find}</dd>
                    {infoSearch.entry.loot && <><dt>Butin</dt><dd>{infoSearch.entry.loot}</dd></>}
                    {infoSearch.entry.effect && <><dt>Effet</dt><dd>{infoSearch.entry.effect}</dd></>}
                    {infoSearch.entry.passage && (
                      <>
                        <dt>Passage</dt>
                        <dd>
                          {infoSearch.entry.passage.text}{infoSearch.entry.passage.dc ? ` (${infoSearch.entry.passage.skill} DC ${infoSearch.entry.passage.dc})` : ''}
                          {near && (
                            <span className="fiche-actions">
                              {near.secret && !near.found && <button className="maps-btn gold" onClick={() => toggleShown(near.id)}>Révéler {secrets.find((s) => s.id === near.id)?.label ?? 'le passage'}</button>}
                              {nearLink && <button className="maps-btn" onClick={() => onFollow(nearLink)}>Suivre ➜ {nearLink.label}</button>}
                            </span>
                          )}
                        </dd>
                      </>
                    )}
                    {info.info?.text && <><dt>Atlas</dt><dd className="maps-sub">{info.info.text}</dd></>}
                  </dl>
                );
              })()}

              {infoPassage && (() => {
                const link = linkOf(infoPassage.id);
                const diff = passageDifficulty(infoPassage.trace);
                const current = rec.overlay?.passageLinks?.[infoPassage.id];
                return (
                  <dl className="fiche-facts">
                    {infoPassage.summary && <><dt>Description</dt><dd>{infoPassage.summary}</dd></>}
                    {(() => {
                      const t = profileOf(infoPassage);
                      return (
                        <>
                          <dt>Pour le repérer</dt><dd><b>{detectLabel(t.detect)}</b></dd>
                          <dt>Dangerosité</dt><dd><span className={`trail-danger lvl-${t.danger.level}`}>{t.danger.label}</span> {t.danger.text} <span className="maps-sub">({t.danger.why.join(', ')})</span></dd>
                        </>
                      );
                    })()}
                    {diff && <><dt>Pour le suivre</dt><dd>{diff.text}</dd></>}
                    <dt>Destination</dt>
                    <dd>
                      {link ? <>{link.label}{towardDest(link) && ' 🎯'}</> : <span className="battle-missing">non inscrite</span>}
                      <select className="maps-btn" value={current ? `${current.kind}:${current.id}` : ''} onChange={(e) => {
                        const opt = options.find((o) => o.value === e.target.value);
                        onLink(infoPassage.id, opt ? opt.link : null);
                      }}>
                        <option value="">{link && !current ? 'Celle de l’Atlas' : 'Choisir une destination…'}</option>
                        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </dd>
                  </dl>
                );
              })()}

              {!infoSearch && !infoPassage && info.info?.text && info.info.text.split('\n\n').map((para, i) => <p key={i}>{para}</p>)}
              {infoMarker?.notes && <p className="maps-sub">Notes : {infoMarker.notes}</p>}

              <div className="fiche-actions">
                <button className={`maps-btn ${isShown(info.id) ? '' : 'gold'}`} onClick={() => toggleShown(info.id)}>
                  {isShown(info.id) ? '👁 Visible des joueurs' : '🙈 Caché : le montrer'}
                </button>
                {infoPassage && linkOf(infoPassage.id) && (!infoPassage.secret || infoPassage.found) && (
                  <button className="maps-btn gold" onClick={() => onFollow(linkOf(infoPassage.id)!)}>Suivre ➜</button>
                )}
                {infoSearch && !infoSearch.id.startsWith('mk-') && (
                  <>
                    <button className="maps-btn" disabled={rewrite.busy || !aiReady()} title={aiReady() ? 'Réécrire la fiche pour ce lieu' : 'Configure une clé d’IA dans Réglages'}
                      onClick={() => rewriteSearch(infoSearch.id, infoSearch.title, infoSearch.entry)}>{rewrite.busy ? 'L’IA écrit…' : '✨ Détailler avec l’IA'}</button>
                    {notes[infoSearch.id] && <button className="maps-btn" onClick={() => onSearchNote?.(infoSearch.id, null)}>Rétablir</button>}
                  </>
                )}
              </div>
              {rewrite.error && <p className="combat-ai-error">{rewrite.error}</p>}
            </aside>
          )}
        </div>
        <p className="battle-hint">
          {building ? 'Construction : peins le terrain ou glisse des objets sur le plateau.'
            : selected ? `${selected.name} sélectionné : glisse-le pour le déplacer, clique à côté ou Échap pour le désélectionner.`
              : 'Glisse un jeton pour le déplacer · clique un élément pour sa fiche · survole une ligne du panneau pour la repérer.'}
        </p>
      </div>

      <aside className="maps-panel battle-side">
        {renderCombat && selected && !building && (
          <div className="battle-token-card">
            {renderCombat({ battle: b, setBattle: onBattle, place: placeTitle, combatKey, selectedId, onSelect: setSelectedId, area: 'card' })}
          </div>
        )}
        <div className="battle-tabs" role="tablist">
          {([['combat', '⚔ Combat'], ['lieu', '🧭 Lieu'], ['construction', '🛠 Construire']] as const).filter(([id]) => !(renderCombat && id === 'combat')).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => { setTab(tab === id ? null : id); setStroke(null); }} title={tab === id ? 'Rabattre' : undefined}>
              {label}
              {id === 'lieu' && search.length + secrets.length > 0 && <small>{search.length + secrets.length}</small>}
              <i className="battle-tab-chev" aria-hidden>{tab === id ? '▴' : '▾'}</i>
            </button>
          ))}
        </div>

        {tab === 'combat' && !renderCombat && (
          <CombatPanel
            b={b} grid={grid} place={placeTitle} selectedId={selectedId} onSelect={setSelectedId} set={set} heroes={heroes} bestiary={bestiary}
            onPlace={placeTokens}
            onRemove={(id) => { set({ tokens: b.tokens.filter((t) => t.id !== id), turn: b.turn === id ? undefined : b.turn }); setSelectedId(null); }}
          />
        )}

        {tab === 'lieu' && (
          <PlacePanel
            title={placeTitle} text={context?.text} dest={dest}
            search={search} secrets={secrets} exits={exits} others={others} options={options}
            onOpen={(id) => setInfoId(id)} onHover={setHoverId} onToggle={toggleShown} onFollow={onFollow} onLink={onLink}
            legend={legend}
          />
        )}

        {tab === 'construction' && (
          <BuildPanel
            brush={brush} onBrush={setBrush} propVisible={propVisible} onPropVisible={setPropVisible}
            canUndo={history.length > 0} onUndo={undo} propCount={build.props.length}
            onClear={() => { if (window.confirm('Effacer toutes les modifications à la main ?')) commitBuild(undefined); }}
          />
        )}
      </aside>
    </div>
    {renderCombat && (
      <section className="battle-encounter" aria-label="Combat">
        {renderCombat({ battle: b, setBattle: onBattle, place: placeTitle, combatKey, selectedId, onSelect: setSelectedId, area: 'encounter' })}
      </section>
    )}
    </>
  );
}
