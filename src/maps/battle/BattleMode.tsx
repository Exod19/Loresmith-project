/**
 * Carte de combat, côté MJ : le plateau au centre, et un panneau en trois onglets.
 * - Combat : initiative, tours, PV, attaques à lancer, conseils tactiques (et plan de l'IA).
 * - Lieu : ce qu'on peut fouiller, les passages secrets et les sorties, repérés sur le plateau (F1, S1, E1).
 * - Construction : peindre le terrain et déposer des objets.
 * Le lieu choisi donne la zone locale : ses passages (tracés réels de l'Atlas) et ses éléments y sont à leur position.
 * « Suivre » un passage ramène sur la carte de navigation, à sa destination, et y déplace le groupe.
 */
import { npcBankImage } from '../../banque/place';
import type { LoreEntry } from '../world/lore';
import { terrainAt, type Relief } from '../world/terrain';
import { boardTheme } from './theme';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import BattleBoard, { anchorOf, type BoardElement, type BoardLabel, type BoardRange, type BoardToken } from './BattleBoard';
import type { AtlasData, AtlasMap } from '../atlas/types';
import {
  DEFAULT_BATTLE, type Battle, type BattleBuild, type BattleToken, type MapMarker, type MapRecord, type PartyTrack, type PassageLink, type SearchNote,
} from '../mapStore';
import { blocksCell, effectiveGrid, generateTerrain, seedOf, TERRAIN, type LocationHint, type TerrainKind } from './terrain';
import { buildLocalMap, cellIn, trimPassages } from './local';
import { attackCells, rangedCells, speedCells } from './ranges';
import { tokenImage } from './vignettes';
import BuildPanel from './BuildPanel';
import CombatPanel, { type Hero } from './CombatPanel';
import type { BestiaryRef } from '../CampaignGuide';
import PlacePanel, { type ExitItem, type SearchItem, type SecretItem } from './PlacePanel';
import { DEFAULT_BRUSH, PROP_BY_KEY, PROP_LABEL, propUrl, shapeCells, type Brush } from './build';
import { passageDifficulty, searchFor, type SearchEntry } from './search';
import { advanceBattle, isOut, passiveOfToken, sightOf, statOf } from './combat';
import { moveAlerts, type Note } from './tactics';
import { partyVision } from './fog';
import { exitAt, exitsOf } from './trailRules';
import { onPlayerAim, onPlayerMove } from '../../present/stage';
import { detectLabel, trailProfile } from '../atlas/trails';
import { describeLite } from '../atlas/lore';
import { placeEncounter, type EncounterGroup } from './encounter';
import { askAI, aiReady, parseJson } from '../../ai/client';
import { baseGridOf, effectiveOf, fits, isDashing, moveLeft, overlaps, placeTokens as placeOnBoard, surfaceOf, usedMove, withMove } from './placement';
import { hazardsOf, moveField, moverOf, occupancy, planMove, reachDetail, type MovePlan, type Mover } from './movement';
import { roll } from '../atlas/encounters';
import { OPENABLE, socleOf, TERRAIN_DEF, TERRAINS, type SurfaceRules, type TerrainId } from './surface';
import { useSurfaceEditor } from './SurfaceEditor';
import { AOE_PRESETS, AOE_SHAPES, aoeName, aoeView, DAMAGE_TYPES, SAVE_LABEL, type AoeEffect, type AoeShape, type BattleAoe, type SaveAbility } from './aoe';
import type { PathView } from './SurfaceLayers';
import './battle.css';

/** Niveaux de zoom du plateau (même logique que la carte de navigation). */
const ZOOMS = [0.75, 1, 1.5, 2, 2.5, 3];
const uid = () => Math.random().toString(36).slice(2, 10);
/** Même type de données que le sélecteur de créatures (src/bestiary/CreaturePicker.jsx). */
const CREATURE_DRAG = 'application/x-loresmith-creature';
/** Types de terrain qui méritent une ligne dans la légende. */
const LEGEND_ORDER: TerrainKind[] = ['.', '#', '~', ':', '=', 'X', 'I', ','];
const SWATCH: Partial<Record<TerrainKind, string>> = { '.': 'floor', '#': 'rock', '~': 'water', ':': 'rubble', '=': 'bridge', X: 'chasm', I: 'pillar', ',': 'decor' };

type Box = { x: number; y: number; size: number };

/** Demi-case la plus proche (origine d'une zone d'effet : centre ou bord de case). */
const snapHalf = (p: [number, number]): [number, number] => [Math.round(p[0] * 2) / 2, Math.round(p[1] * 2) / 2];
/** Direction de a vers b, en degrés (arrondie au degré). */
const angleTo = (a: [number, number], b: [number, number]) => Math.round((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI);
/** Une créature est touchée si une case de son empreinte l'est. */
const touches = (cells: number[], t: BattleToken, cols: number) => {
  const set = new Set(cells);
  for (let dy = 0; dy < t.size; dy++) for (let dx = 0; dx < t.size; dx++) if (set.has((t.y + dy) * cols + t.x + dx)) return true;
  return false;
};

/** Capacités de déplacement d'un jeton : vitesses de sa fiche (ou déplacement du héros), modes accordés par le MJ. */
const moverFor = (t: BattleToken) => moverOf(t, statOf(t)?.speed, speedCells(statOf(t)));
/** …avec les autres créatures du plateau (hostiles infranchissables, alliés en terrain difficile). */
const moverIn = (b: Battle, t: BattleToken) => ({ ...moverFor(t), occ: occupancy(b.cols, t, b.tokens) });
/** Déplacement restant dans le tour (en cases). */
const leftOf = (b: Battle, t: BattleToken) => moveLeft(b, t.id, moverFor(t).speed);
const spot = (t: BattleToken) => ({ x: t.x, y: t.y, layer: t.layer === 'pont' ? 'pont' as const : 'sol' as const });
/** NdF répété `times` fois : « 1d4 » × 3 → « 3d4 ». */
const scaleDice = (dice: string, times: number) => { const m = /^(\d+)d(\d+)$/.exec(dice); return m ? `${Number(m[1]) * times}d${m[2]}` : dice; };
/** Élévation la plus haute sous l'empreinte d'un jeton (le tablier d'un pont ne compte pas). */
const elevAt = (r: SurfaceRules, t: { x: number; y: number; size: number }) => {
  let e = 0;
  for (let dy = 0; dy < t.size; dy++) for (let dx = 0; dx < t.size; dx++) e = Math.max(e, r.cells[(t.y + dy) * r.cols + t.x + dx]?.elev ?? 0);
  return e;
};
type Hurt = { to: string; amount: number; label: string };
/**
 * Dangers d'un déplacement validé : lave et ronces traversées (dés lancés), chute d'une hauteur ou dans un gouffre
 * lors d'un déplacement libre (pousser, tomber). Le MJ applique les dégâts d'un clic.
 */
function dangersOf(r: SurfaceRules, t: BattleToken, m: Mover, plan: MovePlan | null, to: { x: number; y: number }, free: boolean): { notes: Note[]; hurt: Hurt[] } {
  const notes: Note[] = [], hurt: Hurt[] = [];
  if (plan?.possible && !free) {
    for (const h of hazardsOf(r, m, plan)) {
      const dice = scaleDice(h.dice, h.times);
      const res = roll(dice);
      notes.push({ tone: 'alert', label: `${h.label} : ${res.total} dégâts de ${h.type}`, why: `${t.name} — ${res.detail}${h.times > 1 ? ` (${h.times} cases)` : ''}.` });
      hurt.push({ to: t.id, amount: res.total, label: `${h.label.toLowerCase()} (${h.type})` });
    }
  }
  if ((free || !plan?.possible) && !m.fly) {
    const drop = elevAt(r, t) - elevAt(r, { ...to, size: t.size });
    if (drop >= 10) {
      const dice = `${Math.min(20, Math.floor(drop / 10))}d6`;
      const res = roll(dice);
      notes.push({ tone: 'alert', label: `Chute de ${drop} pieds : ${res.total} dégâts contondants`, why: `${t.name} — ${res.detail}. À terre à l’arrivée (règle 5e).` });
      hurt.push({ to: t.id, amount: res.total, label: `chute de ${drop} pieds` });
    }
    const c = r.cells[to.y * r.cols + to.x];
    if (c && TERRAIN_DEF[c.t]?.mode === 'vide' && !c.deck) notes.push({ tone: 'alert', label: 'Chute dans le gouffre', why: `${t.name} tombe : 1d6 dégâts contondants par tranche de 3 m de profondeur (au MJ).` });
  }
  return { notes, hurt };
}

/** Ce que le terrain impose au déplacement validé : à rappeler au MJ. */
function terrainNotes(p: MovePlan): Note[] {
  const out: Note[] = [];
  if (p.notes.includes('sol glissant')) out.push({ tone: 'malus', label: 'Sol glissant', why: 'Jet de sauvegarde de Dextérité DD 10 pour qui se presse, ou il tombe à terre (selon le MJ).' });
  if (p.notes.includes('nage')) out.push({ tone: 'malus', label: 'Nage', why: 'Chaque case en eau profonde compte double sans vitesse de nage. Armure lourde, objets lourds : au MJ de juger.' });
  if (p.notes.includes('escalade')) out.push({ tone: 'malus', label: 'Escalade', why: 'Chaque case escaladée compte double sans vitesse d’escalade ; une paroi lisse peut demander un test de Force (Athlétisme).' });
  return out;
}
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
  /** 'encounter' : le pupitre de combat, à droite du plateau ; 'attack' : le panneau de l'attaque en cours. */
  area: 'encounter' | 'card' | 'attack' | 'aoe';
  /** Onglets propres à la carte (Lieu, Construire), rangés dans le pupitre à côté de ceux du combat. */
  side?: { tabs: { id: string; label: string; badge?: number }[]; active: string | null; onPick: (id: string | null) => void; render: (id: string) => ReactNode };
};

/** Thème du plateau d'un plan de surface : intérieur, neige, climat de la cité, ou terrain réel du monde à l'échelle. */
function surfaceTheme(surface: NonNullable<AtlasMap['surface']>, win: { x0: number; y0: number; w: number; h: number }): 'interieur' | 'neige' | 'froid' | 'chaud' | true {
  if (surface.theme === 'interieur') return 'interieur';
  if ((surface.snow ?? 0) >= 0.1) return 'neige';
  if (surface.relief) {
    const r = surface.relief as unknown as Relief;
    const [x0, y0, x1, y1] = r.bounds;
    const t = terrainAt(r, x0 + (win.x0 + win.w / 2) * (x1 - x0), y0 + (win.y0 + win.h / 2) * (y1 - y0));
    return t.biome === 'neige' ? 'neige' : t.T < 0.3 ? 'froid' : t.T > 0.7 ? 'chaud' : true;
  }
  return surface.climate === 'froid' || surface.climate === 'chaud' ? surface.climate : true;
}

export default function BattleMode({
  rec, battle, onBattle, context, atlas, plan, markers, onFollow, onLink, onMarker, onReveal, heroes = [], party, onSearchNote, bestiary = [], renderCombat, onLeave, library,
}: {
  rec: MapRecord; battle: Battle; onBattle: (b: Battle) => void;
  /** Fiches de la Bibliothèque : peuples de la cité, pour choisir des jetons cohérents dans la Banque Loresmith. */
  library?: LoreEntry[];
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
  /** Un jeton quitte le plateau par une sortie : sa destination (si elle est inscrite), pour le suivre sur la carte de navigation. */
  onLeave?: (token: BattleToken, link: PassageLink | undefined) => void;
}) {
  const b = battle ?? DEFAULT_BATTLE;
  const [tab, setTab] = useState<Tab | null>(renderCombat ? null : b.tokens.some((t) => t.kind === 'monster') ? 'combat' : 'lieu');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  /** Élément survolé dans les listes : éclairé sur le plateau, pour le MJ seulement. */
  const [hoverId, setHoverId] = useState<string | null>(null);
  /** Portées affichées sur le plateau : réservé au MJ, jamais envoyé aux joueurs. */
  const [showRanges, setShowRanges] = useState(false);
  /** Alertes du dernier déplacement (attaque d'opportunité, allonge ennemie), gardées jusqu'au prochain. */
  const [lastMove, setLastMove] = useState<{ name: string; notes: Note[]; exit?: { id: string; label: string; passage: string };
    /** Déplacement refusé (demandé par les joueurs) que le MJ peut accepter quand même. */
    force?: { id: string; x: number; y: number; layer?: 'pont' };
    /** Dégâts du terrain (lave, ronces, chute), à appliquer d'un clic. */
    hurt?: Hurt[] } | null>(null);
  /** Déplacement libre du MJ : ignore les règles de terrain (déplacement exceptionnel). */
  const [freeMove, setFreeMove] = useState(false);
  /** Zone d'effet : réglages, outil de pose actif, origine choisie et point visé. */
  const [aoeSetup, setAoeSetup] = useState<{ shape: AoeShape; size: number; label: string; effect?: AoeEffect }>({ shape: 'sphere', size: 20, label: '' });
  const [aoeTool, setAoeTool] = useState(false);
  const [aoeOrigin, setAoeOrigin] = useState<[number, number] | null>(null);
  const [aoeAim, setAoeAim] = useState<[number, number] | null>(null);
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
  /** Attaque : jeton qui vise, en attente de sa cible (clic sur un autre jeton). */
  const [aiming, setAiming] = useState<string | null>(null);
  const latest = useRef(b);
  latest.current = b;
  // Un joueur déclare une attaque depuis l'écran joueur : le trait apparaît ici, le MJ la résout.
  useEffect(() => onPlayerAim((from, to) => {
    const cur = latest.current;
    if (!cur.tokens.some((t) => t.id === from) || !cur.tokens.some((t) => t.id === to)) return;
    // Héros comme créatures : une attaque se déclare pendant le tour de l'attaquant.
    if (cur.turn && cur.turn !== from) return;
    onBattle({ ...cur, aim: { from, to, at: Date.now(), by: 'joueurs' } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  // Un jeton glissé sur l'écran joueur : déplacé ici si la case est libre et praticable (jamais un jeton caché).
  useEffect(() => onPlayerMove((id, x, y) => {
    const cur = latest.current;
    const t = cur.tokens.find((q) => q.id === id);
    const view = latestView.current;
    if (!t || !t.visible || (t.x === x && t.y === y)) return;
    // Mêmes règles que l'aperçu des joueurs : trajet possible, dans le déplacement du héros, case libre.
    const plan = planMove(surfaceOf(view), moverIn(view, t), spot(t), { x, y }, leftOf(cur, t));
    const free = plan.possible ? !overlaps(view, id, t.size, x, y) : false;
    if (!plan.ok || !free) {
      const why = !plan.possible ? plan.reason ?? 'Passage impossible' : !free ? 'La case d’arrivée est occupée.' : plan.reason ?? 'Trop loin';
      setLastMove({ name: t.name, notes: [{ tone: 'alert', label: `Déplacement refusé : ${t.name}`, why: `${why} (${plan.dest}).` }], force: { id, x, y, layer: plan.layer === 'pont' ? 'pont' : undefined } });
      return;
    }
    // Comme un glisser du MJ : alertes de déplacement, et la fiche de la sortie s'ouvre si le jeton s'y pose.
    const danger = dangersOf(surfaceOf(view), t, moverIn(view, t), plan, { x, y }, false);
    const notes = [...danger.notes, ...terrainNotes(plan), ...moveAlerts(view, id, { x, y })];
    const exit = exitAt(view, { x, y, size: t.size });
    setLastMove(notes.length || exit ? { name: t.name, notes, hurt: danger.hurt, exit: exit && { id, label: exit.label, passage: exit.id } } : null);
    if (exit) setInfoId(exit.id);
    onBattle({ ...cur, tokens: cur.tokens.map((q) => (q.id === id ? { ...q, x, y, layer: plan.layer === 'pont' ? 'pont' : undefined } : q)), moved: withMove(cur, id, { cost: plan.cost }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  const build: BattleBuild = b.build ?? { edits: {}, props: [] };
  const commitBuild = (next: BattleBuild | undefined) => {
    setHistory((h) => [...h.slice(-49), b.build]);
    set({ build: next });
  };
  // Une seule source de vérité : les éléments révélés de la fiche (« Montrer aux joueurs »).
  const discovered = rec.overlay?.revealed ?? [];
  const bv: Battle = b.local ? { ...b, local: { ...b.local, discovered } } : b;
  const latestView = useRef(bv);
  latestView.current = bv;
  const grid = effectiveOf(bv);
  /** Classification des cases (règles) et grille de base (dessin). */
  const rules = surfaceOf(bv);
  const baseGrid = baseGridOf(bv);
  // Zones d'effet posées, et celle qu'on est en train de placer.
  const aoeViews = [
    ...(b.aoes ?? []).map((a) => aoeView(a, rules, b.feetPerCell)),
    ...(aoeTool && aoeAim ? [aoeView({
      id: 'draft', shape: aoeSetup.shape, size: aoeSetup.size, label: aoeSetup.label || undefined,
      ...(aoeSetup.shape === 'sphere' || !aoeOrigin
        ? { x: snapHalf(aoeAim)[0], y: snapHalf(aoeAim)[1], dir: 0 }
        : { x: aoeOrigin[0], y: aoeOrigin[1], dir: angleTo(aoeOrigin, aoeAim) }),
    }, rules, b.feetPerCell, true)] : []),
  ];
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
    // Dans un bâtiment : ses PNJ y sont, combat ou pas. Chacun est posé à sa place (comptoir, porte…), visible des joueurs
    // sauf s'il est expressément caché ; le MJ les déplace ensuite à sa guise. Un PNJ déjà sur le plateau n'est pas reposé.
    if (plan.surface?.theme === 'interieur') {
      const revealed = new Set(rec.overlay?.revealed ?? []);
      const taken = (x: number, y: number) => tokens.some((t) => x >= t.x && x < t.x + t.size && y >= t.y && y < t.y + t.size);
      for (const f of atlas.features.filter((x) => x.id.startsWith(`${plan.id}:pnj-`))) {
        const id = `pnj-${f.entryId ?? f.id}`;
        if (tokens.some((t) => t.id === id)) continue;
        const g = atlas.geometries.find((x) => x.featureId === f.id && x.type === 'point');
        const cell = g && cellIn(local.window, b.cols, b.rows, (g.coordinates as [number, number])[0], (g.coordinates as [number, number])[1]);
        if (cell === undefined || !g) continue;
        const cx = cell % b.cols, cy = Math.floor(cell / b.cols);
        let best: { x: number; y: number } | null = null, bd = Infinity;
        for (let y = 0; y < b.rows; y++) for (let x = 0; x < b.cols; x++) {
          const d = Math.max(Math.abs(x - cx), Math.abs(y - cy));
          if (d < bd && !blocksCell(ground, b.cols, x, y) && !taken(x, y)) { bd = d; best = { x, y }; }
        }
        if (!best || bd > 4) continue;
        const ref = bestiary.find((r) => r.id === f.entryId);
        tokens = [...tokens, {
          id, name: f.title, kind: 'other', x: best.x, y: best.y, size: 1, visible: !f.hiddenNpc || revealed.has(f.id),
          npcId: ref?.id, hp: ref?.hp, maxHp: ref?.hp, ac: ref?.ac,
          // Sans jeton propre : un jeton de la Banque Loresmith, cohérent avec la cité (peuple, rôle).
          image: ref?.token ?? f.image ?? npcBankImage(rec, plan.id, library, f),
        }];
      }
    }
    set({
      terrain: { source, seed, grid: local.base },
      local: { source, planId: plan.id, place: hint.title, window: local.window, elements: local.elements, discovered: previous, surface: plan.surface ? surfaceTheme(plan.surface, local.window) : undefined, trimmed: !plan.surface },
      tokens,
      encounterOf: groups?.length ? source : b.encounterOf,
      build: undefined,
      ...(groups?.length ? { turn: undefined, round: 1, log: [] } : {}),
    });
    setHistory([]);
    if (groups?.length && !renderCombat) setTab('combat');
  };

  // Plateaux ouverts avant ce nettoyage : on retire une fois les galeries intérieures (souterrain seulement).
  useEffect(() => {
    if (!b.local || b.local.trimmed || b.local.surface || !b.terrain) return;
    set({ local: { ...b.local, elements: trimPassages(b.terrain.grid, b.local.elements, b.cols, b.rows), trimmed: true } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.local?.source]);

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
  /** Pose d'une zone d'effet ; elle reste sur le plateau jusqu'à ce que le MJ la retire. */
  const placeAoe = (o: [number, number], dir: number) => {
    const a: BattleAoe = { id: uid(), shape: aoeSetup.shape, size: aoeSetup.size, x: o[0], y: o[1], dir, label: aoeSetup.label.trim() || undefined, effect: aoeSetup.effect };
    // Avec des dégâts : la fenêtre de résolution s'ouvre aussitôt pour les créatures touchées.
    set({ aoes: [...(b.aoes ?? []), a], ...(a.effect ? { aoeHit: { aoeId: a.id, targets: aoeTargets(a), at: Date.now() } } : {}) });
    setAoeTool(false); setAoeOrigin(null);
  };
  /** Créatures dans la zone (une case de leur empreinte suffit), moins le camp épargné. */
  const aoeTargets = (a: BattleAoe) => {
    const cells = aoeView(a, rules, b.feetPerCell).cells;
    return b.tokens.filter((t) => !t.unplaced && touches(cells, t, b.cols) && !(a.effect?.spare && t.kind === a.effect.spare)).map((t) => t.id);
  };
  /** Point du plateau sous le pointeur, en cases (continu). */
  const pointAt = (clientX: number, clientY: number): [number, number] | null => {
    const svg = wrapRef.current?.querySelector('svg.battle-board');
    if (!(svg instanceof SVGSVGElement)) return null;
    const r = svg.getBoundingClientRect();
    const s = Math.min(r.width / b.cols, r.height / b.rows);
    const x = (clientX - (r.left + (r.width - b.cols * s) / 2)) / s, y = (clientY - (r.top + (r.height - b.rows * s) / 2)) / s;
    return x >= 0 && y >= 0 && x <= b.cols && y <= b.rows ? [x, y] : null;
  };
  const editor = useSurfaceEditor({ b, set, rules, active: building, pointAt });
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
  /** Pose `g.n` créatures autour d'une case : la case visée d'abord, puis les plus proches libres (jamais dans un mur). */
  const dropCreatures = (at: { x: number; y: number }, g: { n: number; name: string; hp?: number; ac?: number; size?: number; image?: string; npcId?: string; stat?: string }) => {
    const size = Math.max(1, Math.min(3, g.size ?? 1)) as 1 | 2;
    let next = bv;
    const added: BattleToken[] = [];
    const cells: { x: number; y: number; d: number }[] = [];
    for (let y = 0; y < b.rows; y++) for (let x = 0; x < b.cols; x++) cells.push({ x, y, d: Math.max(Math.abs(x - at.x), Math.abs(y - at.y)) + Math.hypot(x - at.x, y - at.y) * 0.01 });
    cells.sort((p, q) => p.d - q.d);
    for (let i = 0; i < Math.max(1, g.n); i++) {
      const spot = cells.find((c) => fits(next, null, size, c.x, c.y));
      if (!spot) break;
      const t: BattleToken = {
        id: uid(), name: g.n > 1 ? `${g.name} ${i + 1}` : g.name, kind: 'monster', x: spot.x, y: spot.y, size, visible: false,
        hp: g.hp, maxHp: g.hp, ac: g.ac, npcId: g.npcId, image: g.image, statId: g.stat || undefined,
      };
      added.push(t);
      next = { ...next, tokens: [...next.tokens, t] };
    }
    if (added.length) set({ tokens: [...b.tokens, ...added] });
  };
  const onBoardDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    if (aoeTool && !building) {
      // Zone d'effet : un clic pour l'origine (sphère : c'est tout), un second pour la direction.
      e.preventDefault();
      const p = pointAt(e.clientX, e.clientY);
      if (!p) return;
      const q = snapHalf(p);
      if (aoeSetup.shape === 'sphere') placeAoe(q, 0);
      else if (!aoeOrigin) setAoeOrigin(q);
      else placeAoe(aoeOrigin, angleTo(aoeOrigin, p));
      return;
    }
    if (building && editor.onDown(e)) return;
    if (!building) {
      // Saisir un jeton : il est sélectionné, et le glisser le déplace. Sans mouvement, c'est un simple clic.
      const c = cellAt(e.clientX, e.clientY);
      const t = c && b.tokens.find((q) => c.x >= q.x && c.x < q.x + q.size && c.y >= q.y && c.y < q.y + q.size);
      if (aiming) {
        e.preventDefault();
        if (t && t.id !== aiming) set({ aim: { from: aiming, to: t.id, at: Date.now() } });
        setAiming(null);
        return;
      }
      // Un jeton sélectionné : un clic sur une autre case l'y déplace (le trajet suivait déjà le pointeur).
      if (c && !t && selected && !selected.unplaced) {
        e.preventDefault();
        commitMove(selected, c.x, c.y, freeMove || e.altKey);
        justDropped.current = true;
        setTimeout(() => { justDropped.current = false; }, 0);
        return;
      }
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
    if (building && editor.onMove(e)) return;
    if (aoeTool) setAoeAim(pointAt(e.clientX, e.clientY));
    // Case survolée d'après le pointeur : les passages et vignettes posés dessus ne la masquent pas.
    if (!drag && !building) {
      const c = cellAt(e.clientX, e.clientY);
      if (c && (c.x !== hover?.x || c.y !== hover?.y)) setHover(c);
    }
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
    const up = (ev: PointerEvent) => {
      const t = b.tokens.find((q) => q.id === drag.id);
      if (t && drag.moved) {
        const x = drag.origin.x + drag.cur.x - drag.start.x, y = drag.origin.y + drag.cur.y - drag.start.y;
        commitMove(t, x, y, freeMove || ev.altKey);
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


  /**
   * Déplacer un jeton (glisser ou clic) : même calcul que l'aperçu. Un trajet impossible est refusé, sauf déplacement
   * libre du MJ (bouton ou Alt). Dangers, alertes, sortie et déplacement du tour suivent.
   */
  function commitMove(t: BattleToken, x: number, y: number, free: boolean) {
    const plan = t.unplaced ? null : planMove(rules, moverIn(bv, t), spot(t), { x, y }, leftOf(b, t));
    const placeable = plan?.possible ? !overlaps(bv, t.id, t.size, x, y) : fits(bv, t.id, t.size, x, y) || (free && !overlaps(bv, t.id, t.size, x, y));
    if (plan && !plan.possible && !free) {
      setLastMove({ name: t.name, notes: [{ tone: 'alert', label: 'Déplacement impossible', why: `${plan.reason ?? 'Aucun passage'} (${plan.dest}). Alt + clic ou glisser, ou « Déplacement libre », pour passer outre.` }] });
      return;
    }
    if (!placeable) {
      setLastMove({ name: t.name, notes: [{ tone: 'alert', label: 'Case occupée', why: 'Une autre créature occupe déjà cette place.' }] });
      return;
    }
    const danger = t.unplaced ? { notes: [], hurt: [] } : dangersOf(rules, t, moverIn(bv, t), plan, { x, y }, free);
    const notes = [...danger.notes, ...(plan ? terrainNotes(plan) : []), ...moveAlerts(bv, t.id, { x, y })];
    const exit = exitAt(bv, { x, y, size: t.size });
    setLastMove(notes.length || exit ? { name: t.name, notes, hurt: danger.hurt, exit: exit && { id: t.id, label: exit.label, passage: exit.id } } : null);
    // Sur une sortie : sa fiche s'ouvre (praticabilité, test à faire, destination).
    if (exit) setInfoId(exit.id);
    const layer = plan?.possible ? (plan.layer === 'pont' ? 'pont' as const : undefined) : rules.cells[y * b.cols + x]?.deck ? 'pont' as const : undefined;
    const patch = t.unplaced ? { x, y, unplaced: undefined, visible: true, layer } : { x, y, layer };
    // Le trajet compte dans le déplacement du tour (pas un placement ni un déplacement libre du MJ).
    set({ tokens: b.tokens.map((q) => (q.id === t.id ? { ...q, ...patch } : q)), ...(plan?.possible && !free ? { moved: withMove(b, t.id, { cost: plan.cost }) } : {}) });
  }

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
  /** Dégâts du terrain : par le module Combat quand il tient les PV (Table de guerre), sinon directement sur le jeton. */
  const applyHurt = (h: Hurt) => {
    if (renderCombat) { set({ damage: [...(b.damage ?? []), { id: uid(), to: h.to, amount: h.amount, why: h.label }] }); return; }
    const t = b.tokens.find((q) => q.id === h.to);
    if (t?.hp !== undefined) patchToken(t.id, { hp: Math.max(0, t.hp - h.amount) });
  };

  /** Pose des jetons près du centre, chacun sur la première case libre. */
  function placeTokens(list: Omit<BattleToken, 'x' | 'y'>[]) {
    const placed = placeOnBoard(bv, list);
    if (placed.length) set({ tokens: [...b.tokens, ...placed] });
  }

  /** Clic sur une case vide : désélectionne le jeton et ferme la fiche. Les jetons se déplacent par glisser-déposer. */
  function onBoardCell(x: number, y: number) {
    if (justDropped.current) return;
    // Un héros attend sa place : le clic le pose (visible des joueurs, sa vision compte dès lors).
    const waiting = b.tokens.find((t) => t.unplaced);
    if (waiting && !aiming && !building) {
      if (fits(bv, waiting.id, waiting.size, x, y)) {
        patchToken(waiting.id, { x, y, unplaced: undefined, visible: true });
        setSelectedId(waiting.id);
      }
      return;
    }
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
    if (e.key === 'Escape') { if (aoeTool) { setAoeTool(false); setAoeOrigin(null); return; } if (aiming) { setAiming(null); return; } setSelectedId(null); setInfoId(null); return; }
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
    // Sous terre, seules les sorties au bord du plateau comptent (les galeries intérieures sont sur la navigation).
    if (b.local && !b.local.surface ? !onEdge(p.cells) : !(rec.overlay?.passageLinks?.[p.id] || link.kind === 'anchor' || onEdge(p.cells))) return false;
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
    // Sous terre, chaque sortie est au bord et sa flèche porte déjà son code (E1 · vers…) : pas d'étiquette en double.
    ...(b.local && !b.local.surface ? [] : exits.flatMap((e) => { const c = cellsOf(e.id); return c.length ? [{ cell: anchorOf(c, b.cols), text: e.label, tone: e.toward ? 'dest' as const : 'exit' as const }] : []; })),
  ];
  const highlight = hoverId ? cellsOf(hoverId) : infoId ? cellsOf(infoId) : undefined;

  // Portées : déplacement (cases atteignables, terrain compté) et anneau d'attaque, pour chaque créature et chaque joueur.
  /** Allonge et portée : l'arme en main d'un héros, sinon la fiche. */
  const reachOf = (t: BattleToken) => ({ attack: t.reach?.melee || attackCells(statOf(t)), ranged: t.reach?.short ?? rangedCells(statOf(t)) });
  const rangeOf = (t: BattleToken): BoardRange => {
    const d = reachDetail(moveField(rules, moverIn(bv, t), spot(t)), leftOf(b, t));
    return {
      id: t.id, x: t.x, y: t.y, size: t.size, move: d.cells, costly: d.costly,
      ...reachOf(t), selected: t.id === selectedId,
      ...(t.kind === 'pc' ? { sight: sightOf(t), search: 1 } : {}),
    };
  };
  // Pendant un glisser : les cases accessibles depuis la case de départ (plus coûteuses en ambre), et l'allonge et la
  // portée d'attaque depuis la case visée.
  const dragged = drag?.moved ? b.tokens.find((t) => t.id === drag.id) : undefined;
  const dragRanges = (t: BattleToken): BoardRange[] => {
    const at = { x: drag!.origin.x + drag!.cur.x - drag!.start.x, y: drag!.origin.y + drag!.cur.y - drag!.start.y };
    return [{ ...rangeOf(t), attack: 0, ranged: 0, sight: undefined, search: undefined }, { id: `${t.id}-at`, ...at, size: t.size, move: [], ...reachOf(t), selected: true }];
  };
  const ranges: BoardRange[] = showRanges ? b.tokens.map(rangeOf) : dragged ? dragRanges(dragged) : [];

  const liveAt = (t: BattleToken) => (drag?.moved && drag.id === t.id
    ? { x: drag.origin.x + drag.cur.x - drag.start.x, y: drag.origin.y + drag.cur.y - drag.start.y }
    : { x: t.x, y: t.y });
  // Brouillard de guerre : ce que voient les héros, et la mémoire des cases explorées (propre à ce terrain).
  const fogSource = b.terrain?.source ?? 'plateau';
  const vision = b.fog?.on ? partyVision(bv, grid) : null;
  const explored = b.fog?.on && b.fog.source === fogSource ? b.fog.explored : [];
  useEffect(() => {
    if (!vision) return;
    const known = new Set(explored);
    const fresh = [...vision].filter((c) => !known.has(c));
    if (fresh.length || b.fog?.source !== fogSource) set({ fog: { on: true, source: fogSource, explored: [...explored, ...fresh] } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vision && [...vision].sort().join(','), fogSource]);
  const fogLayer = vision ? { visible: [...vision], explored, dm: true } : undefined;

  // Flèches de sortie (comme chez les joueurs) : une par sortie listée dans le panneau.
  const exitIds = new Set(exits.map((e) => e.id));
  // Côté MJ, chaque flèche dit où elle mène (code E du panneau Lieu et destination), et celles vers l'objectif ressortent.
  const exitById = new Map(exits.map((e) => [e.id, e]));
  const dmExits = exitsOf(bv).filter((e) => exitIds.has(e.id)).map((e) => {
    const x = exitById.get(e.id)!;
    return { ...e, label: `${x.label} · vers ${x.link.label.split(' · ')[0]}`, known: true, goal: x.toward };
  });
  const goalExits = exits.filter((e) => e.toward);
  // Entrée du lieu : la sortie qui mène à l'endroit d'où vient le groupe. Les héros ajoutés au combat y arrivent.
  const cameFrom = party?.trail?.[party.trail.length - 1];
  const entryExit = cameFrom ? exitsOf(bv).find((e) => linkOf(e.id)?.id === cameFrom.id) : undefined;
  const entryCell = entryExit ? { x: entryExit.cell % b.cols, y: Math.floor(entryExit.cell / b.cols) } : undefined;
  const waiting = b.tokens.filter((t) => t.unplaced);
  useEffect(() => {
    if (entryCell?.x === b.entry?.x && entryCell?.y === b.entry?.y) return;
    set({ entry: entryCell });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryCell?.x, entryCell?.y]);
  // Trait d'attaque : en visée, il suit la case survolée ; une fois la cible choisie, il relie les deux jetons.
  const centre = (t: { x: number; y: number; size: number }) => ({ x: t.x + t.size / 2, y: t.y + t.size / 2 });
  const aimFrom = aiming ? b.tokens.find((t) => t.id === aiming) : b.aim ? b.tokens.find((t) => t.id === b.aim!.from) : undefined;
  const aimTo = aiming ? (hover ? { x: hover.x, y: hover.y, size: 1 } : undefined) : b.aim ? b.tokens.find((t) => t.id === b.aim!.to) : undefined;
  const aimLine = aimFrom && aimTo
    ? { x1: centre(aimFrom).x, y1: centre(aimFrom).y, x2: centre(aimTo).x, y2: centre(aimTo).y, tone: b.aim?.tone, pending: !!aiming }
    : undefined;

  const boardTokens: BoardToken[] = b.tokens.map((t) => {
    const at = liveAt(t);
    return {
      id: t.id, name: t.name, kind: t.kind, x: at.x, y: at.y, size: t.size, icon: t.icon, image: tokenImage(t),
      selected: t.id === selectedId, hidden: !t.visible, active: t.id === b.turn, hp: t.hp, maxHp: t.maxHp, out: isOut(t), conditions: t.conditions,
      // Socle : terrain sous la position validée (pas pendant le glisser, pour éviter les clignotements).
      socle: socleOf(rules, t) ?? undefined,
      elev: elevAt(rules, t) || undefined,
    };
  });

  const readout = selected && hover && !building ? feetBetween(selected, { ...hover, size: 1 }, b.feetPerCell) : null;
  // Trajet prévu : pendant un glisser (vers la case visée), ou au survol quand un jeton est sélectionné.
  // Survoler une autre créature, c'est la viser, pas s'y rendre : pas de trajet.
  const onCreature = !!hover && b.tokens.some((q) => q.id !== selected?.id && !q.unplaced && hover.x >= q.x && hover.x < q.x + q.size && hover.y >= q.y && hover.y < q.y + q.size);
  const moving = dragged && drag ? dragged : !building && selected && hover && !aiming && !aoeTool && !onCreature && !selected.unplaced ? selected : null;
  const target = dragged && drag ? liveAt(dragged) : hover;
  const movePlan: MovePlan | null = moving && target && (target.x !== moving.x || target.y !== moving.y)
    ? planMove(rules, moverIn(bv, moving), spot(moving), target, leftOf(b, moving))
    : null;
  const pathView: PathView | undefined = movePlan && moving ? {
    steps: movePlan.possible ? movePlan.steps : [{ x: moving.x, y: moving.y }, { x: target!.x, y: target!.y }],
    size: moving.size, ok: movePlan.ok, possible: movePlan.possible,
    label: movePlan.possible ? `${movePlan.cost * b.feetPerCell} pi${movePlan.ok ? '' : ' ⚠'}` : '⛔',
  } : undefined;
  const present = new Set<string>(grid ? Array.from(grid) : []);
  const activeToken = b.tokens.find((t) => t.id === b.turn);

  // Fiche ouverte : élément du plateau, et ce que le MJ en sait.
  const info = boardElements.find((e) => e.id === infoId) ?? null;
  const infoSearch = info ? search.find((s) => s.id === info.id) ?? null : null;
  const infoPassage = info ? passages.find((p) => p.id === info.id) ?? null : null;
  const infoMarker = info?.id.startsWith('mk-') ? markers.find((m) => `mk-${m.id}` === info.id) ?? null : null;
  const infoKind = infoSearch ? (infoSearch.entry.loot ? 'butin' : 'fouille') : infoPassage ? (infoPassage.secret ? 'secret' : 'passage') : infoMarker ? 'repere' : 'lieu';
  const infoKindLabel = !info ? '' : infoSearch ? `${infoSearch.label} · à fouiller`
    : infoPassage ? `${secrets.find((s) => s.id === info.id)?.label ?? exits.find((e) => e.id === info.id)?.label ?? 'Galerie'} · ${infoPassage.secret ? 'passage secret' : 'passage'}`
    : info.info?.subtitle ?? 'Élément';
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

  // Fiche d'un élément du plateau (sortie, passage, objet) : à droite sans combat, posée sur le plateau avec.
  /** Le jeton posé sur une sortie quitte le plateau ; un héros est suivi sur la carte de navigation. */
  const leaveBy = (exit: { id: string; passage: string }) => {
    const leaving = b.tokens.find((q) => q.id === exit.id);
    if (leaving) onLeave?.(leaving, linkOf(exit.passage));
    set({ tokens: b.tokens.filter((q) => q.id !== exit.id), turn: b.turn === exit.id ? undefined : b.turn });
    setLastMove(null);
    if (infoId === exit.passage) setInfoId(null);
  };
  const onThisExit = lastMove?.exit && lastMove.exit.passage === infoId ? lastMove : null;
  const fiche = info ? (
    <aside className="battle-fiche battle-fiche-side" role="dialog" aria-label={info.title}
            data-kind={infoKind}>
            <button className="present-info-close" onClick={() => setInfoId(null)} aria-label="Fermer">×</button>
            {info.info?.image ? (
              <div className="battle-fiche-hero">
                <img src={info.info.image} alt="" />
                <div>
                  <span className="present-info-kind">{infoKindLabel}</span>
                  <h3>{info.title}</h3>
                </div>
              </div>
            ) : (
              <>
                <span className="present-info-kind">{infoKindLabel}</span>
                <h3>{info.title}</h3>
              </>
            )}
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
              {onThisExit?.exit && (
                <button className="maps-btn gold" onClick={() => leaveBy(onThisExit.exit!)}>
                  🚪 Faire sortir {onThisExit.name}{linkOf(onThisExit.exit.passage) ? ` → ${linkOf(onThisExit.exit.passage)!.label.split(' · ')[0]}` : ''}
                </button>
              )}
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
  ) : null;

  const placePanel = (
    <PlacePanel
            title={placeTitle} text={context?.text} dest={dest}
            search={search} secrets={secrets} exits={exits} others={others} options={options}
            onOpen={(id) => setInfoId(id)} onHover={setHoverId} onToggle={toggleShown} onFollow={onFollow} onLink={onLink}
            legend={legend}
          />
  );
  const buildPanel = (
    <>
    {editor.panel}
    <BuildPanel
            brush={brush} onBrush={setBrush} propVisible={propVisible} onPropVisible={setPropVisible}
            canUndo={history.length > 0} onUndo={undo} propCount={build.props.length}
            onClear={() => { if (window.confirm('Effacer toutes les modifications à la main ?')) commitBuild(undefined); }}
          />
    </>
  );

  const combatKey = `${rec.id}:${b.local?.source ?? b.terrain?.source ?? 'plateau'}`;

  /** Alertes du dernier déplacement (ou du glisser en cours). */
  const alertsNode = (() => {
              const live = dragged && drag ? moveAlerts(bv, dragged.id, { x: drag.origin.x + drag.cur.x - drag.start.x, y: drag.origin.y + drag.cur.y - drag.start.y }) : null;
              const shown = live ? { name: dragged!.name, notes: live } : drag ? null : lastMove;
              const exit = !live && lastMove?.exit && lastMove.exit.passage !== infoId ? lastMove.exit : null;
              if (!shown || (!shown.notes.length && !exit)) return null;
              return (
                <div className={`battle-move-alerts ${live ? 'live' : ''}`} role="status">
                  {shown.notes.map((n, i) => (
                    <div key={i} className={`battle-move-alert tone-${n.tone}`}>
                      <b>{n.label}</b><span>{n.why}</span>
                    </div>
                  ))}
                  {exit && (
                    <div className="battle-move-alert tone-chance">
                      <b>🚪 {shown!.name} est sur la sortie {exit.label}</b>
                      <span><button className="maps-btn gold battle-exit-btn" onClick={() => leaveBy(exit)}>Quitter la carte{linkOf(exit.passage) ? ` → ${linkOf(exit.passage)!.label.split(' · ')[0]}` : ''}</button></span>
                    </div>
                  )}
                  {!live && lastMove?.hurt?.map((h, i) => (
                    <span key={`h${i}`}><button className="maps-btn gold battle-exit-btn" onClick={() => {
                      applyHurt(h);
                      setLastMove((m) => (m ? { ...m, hurt: m.hurt?.filter((_, k) => k !== i) } : m));
                    }}>Appliquer {h.amount} dégâts à {b.tokens.find((q) => q.id === h.to)?.name ?? '…'}</button></span>
                  ))}
                  {!live && lastMove?.force && (
                    <span><button className="maps-btn gold battle-exit-btn" onClick={() => {
                      const f = lastMove.force!;
                      patchToken(f.id, { x: f.x, y: f.y, layer: f.layer });
                      setLastMove(null);
                    }}>Accepter quand même (MJ)</button></span>
                  )}
                  {!live && <button className="present-info-close" onClick={() => setLastMove(null)} aria-label="Fermer">×</button>}
                </div>
              );
            })();

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
            {dest && (
              <span className={`battle-goal-chip ${goalExits.length ? 'on' : ''}`} title={goalExits.length ? 'Sorties qui mènent à l’objectif (en doré sur le plateau)' : 'Aucune sortie de ce plateau ne mène directement à l’objectif'}>
                🎯 Objectif : <b>{dest.title}</b>
                {goalExits.length ? <> · par {goalExits.map((e) => e.label).join(', ')}</> : <> · aucune sortie directe</>}
              </span>
            )}
          </div>
          <div className="battle-tools">
            <details className="battle-menu battle-aoe-menu">
              <summary className={`maps-btn ${aoeTool ? 'gold' : ''}`}>✸ Zone d’effet ▾</summary>
              <div className="battle-menu-pop">
                <label className="surface-field">Modèle
                  <select value="" onChange={(e) => {
                    const pr = AOE_PRESETS.find((x) => x.label === e.target.value);
                    if (pr) setAoeSetup({ shape: pr.shape, size: pr.size, label: pr.label, effect: { ...pr.effect, save: pr.effect.save && { ...pr.effect.save } } });
                  }}>
                    <option value="">Choisir un sort ou un souffle…</option>
                    {AOE_PRESETS.map((x) => <option key={x.label} value={x.label}>{x.label} · {x.effect.dice} {DAMAGE_TYPES.find((d) => d.id === x.effect.type)?.label.toLowerCase()}</option>)}
                  </select>
                </label>
                <div className="build-seg">
                  {AOE_SHAPES.map((x) => (
                    <button key={x.shape} className={aoeSetup.shape === x.shape ? 'on' : ''} title={x.hint}
                      onClick={() => setAoeSetup({ ...aoeSetup, shape: x.shape, size: x.sizes.includes(aoeSetup.size) ? aoeSetup.size : x.sizes[Math.min(1, x.sizes.length - 1)] })}>{x.label}</button>
                  ))}
                </div>
                <label className="surface-field">{aoeSetup.shape === 'sphere' ? 'Rayon' : aoeSetup.shape === 'cube' ? 'Côté' : 'Longueur'}
                  <select value={aoeSetup.size} onChange={(e) => setAoeSetup({ ...aoeSetup, size: Number(e.target.value) })}>
                    {AOE_SHAPES.find((x) => x.shape === aoeSetup.shape)!.sizes.map((n) => <option key={n} value={n}>{n} pieds</option>)}
                  </select>
                </label>
                <label className="surface-field">Nom (facultatif)
                  <input value={aoeSetup.label} placeholder="Boule de feu" onChange={(e) => setAoeSetup({ ...aoeSetup, label: e.target.value })} />
                </label>
                <label className="build-check">
                  <input type="checkbox" checked={!!aoeSetup.effect} onChange={(e) => setAoeSetup({ ...aoeSetup, effect: e.target.checked ? { dice: '8d6', type: 'feu', save: { ability: 'dex', dc: 15, half: true } } : undefined })} />
                  Inflige des dégâts
                </label>
                {aoeSetup.effect && (() => {
                  const fx = aoeSetup.effect;
                  const setFx = (patch: Partial<AoeEffect>) => setAoeSetup({ ...aoeSetup, effect: { ...fx, ...patch } });
                  return (
                    <div className="battle-aoe-fx">
                      <label className="surface-field">Dés <input value={fx.dice} onChange={(e) => setFx({ dice: e.target.value.replace(/\s/g, '') })} placeholder="8d6" /></label>
                      <label className="surface-field">Nature
                        <select value={fx.type} onChange={(e) => setFx({ type: e.target.value })}>
                          {DAMAGE_TYPES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                        </select>
                      </label>
                      <label className="surface-field">Sauvegarde
                        <select value={fx.save?.ability ?? ''} onChange={(e) => setFx({ save: e.target.value ? { ability: e.target.value as SaveAbility, dc: fx.save?.dc ?? 15, half: fx.save?.half ?? true } : undefined })}>
                          <option value="">Aucune (touche d’office)</option>
                          {(Object.keys(SAVE_LABEL) as SaveAbility[]).map((k) => <option key={k} value={k}>{SAVE_LABEL[k]}</option>)}
                        </select>
                      </label>
                      {fx.save && (
                        <>
                          <label className="surface-field">DD <input type="number" min={5} max={30} value={fx.save.dc} onChange={(e) => setFx({ save: { ...fx.save!, dc: Number(e.target.value) || 10 } })} /></label>
                          <label className="build-check"><input type="checkbox" checked={fx.save.half} onChange={(e) => setFx({ save: { ...fx.save!, half: e.target.checked } })} /> Moitié des dégâts si réussie</label>
                        </>
                      )}
                      <label className="surface-field">Qui est touché
                        <select value={fx.spare ?? ''} onChange={(e) => setFx({ spare: (e.target.value || undefined) as AoeEffect['spare'] })}>
                          <option value="">Toutes les créatures (alliés compris)</option>
                          <option value="pc">Épargner les héros</option>
                          <option value="monster">Épargner les créatures</option>
                        </select>
                      </label>
                    </div>
                  );
                })()}
                <button className="maps-btn gold" onClick={(e) => { setAoeTool(true); setAoeOrigin(null); (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open'); }}>Placer sur le plateau</button>
              </div>
            </details>
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
            {renderCombat && selected && !building && (
              <button className={`maps-btn ${aiming ? 'gold' : ''}`} title="Attaquer : clique ensuite la cible sur le plateau (Échap pour annuler)" onClick={() => setAiming(aiming ? null : selected.id)}>🎯 Attaquer</button>
            )}
            <button className={`maps-btn ${showRanges ? 'gold' : ''}`} title="Déplacements et portées d'attaque (MJ seulement)" onClick={() => setShowRanges((v) => !v)}>◎ Portées</button>
            <button className={`maps-btn ${freeMove ? 'gold' : ''}`} title="Déplacement libre : le MJ pose un jeton où il veut, sans règles de terrain (téléportation, chute, poussée). Alt + glisser fait de même pour un seul déplacement." onClick={() => setFreeMove((v) => !v)}>{freeMove ? '🔓 Libre' : '🔒 Règles'}</button>
            <button className={`maps-btn ${b.fog?.on ? 'gold' : ''}`} title="Brouillard de guerre : les joueurs ne voient que ce que voient leurs héros (portée de vue et ligne de vue). Les cases explorées restent en mémoire." onClick={() => set({ fog: { on: !b.fog?.on, source: fogSource, explored: b.fog?.source === fogSource ? b.fog.explored : [] } })}>🌫 Brouillard</button>
            {b.fog?.on && explored.length > 0 && <button className="maps-btn" title="Oublier les cases explorées" onClick={() => set({ fog: { on: true, source: fogSource, explored: [] } })}>↺</button>}
          </div>
        </div>

        {selected && !building && !selected.unplaced && (() => {
          const m = moverFor(selected);
          const auto = socleOf(rules, { ...selected, socle: undefined });
          const value = selected.socle?.mode === 'manuel' ? selected.socle.t : selected.socle?.mode ?? 'auto';
          const toggle = (k: 'nage' | 'vol' | 'escalade', on: boolean) => patchToken(selected.id, { modes: { ...selected.modes, [k]: on } });
          return (
            <div className="battle-token-opts" aria-label={`Options de ${selected.name}`}>
              <b>{selected.name}</b>
              {selected.layer === 'pont' && <span className="battle-token-layer">sur le pont</span>}
              <span className={`battle-token-left ${leftOf(b, selected) ? '' : 'is-empty'}`} title="Déplacement restant pendant ce tour (remis à zéro au tour suivant)">
                Reste <b>{leftOf(b, selected) * b.feetPerCell}</b> / {m.speed * (isDashing(b, selected.id) ? 2 : 1) * b.feetPerCell} pi{m.fly ? ' en vol' : ''}
              </span>
              <button className={`maps-btn ${isDashing(b, selected.id) ? 'gold' : ''}`} title="Foncer (action) : vitesse doublée pour ce tour"
                onClick={() => set({ moved: withMove(b, selected.id, { dash: !isDashing(b, selected.id) }) })}>🏃 Foncer</button>
              {usedMove(b, selected.id) > 0 && (
                <button className="maps-btn" title="Rendre le déplacement de ce tour (erreur, retour en arrière)" onClick={() => set({ moved: withMove(b, selected.id, { reset: true }) })}>↺</button>
              )}
              <label className="build-check" title="Nage : l'eau profonde compte normalement"><input type="checkbox" checked={!!m.swim} onChange={(e) => toggle('nage', e.target.checked)} /> Nage</label>
              <label className="build-check" title="Vol : ignore le sol (eau, vide, terrain difficile)"><input type="checkbox" checked={!!m.fly} onChange={(e) => toggle('vol', e.target.checked)} /> Vol</label>
              <label className="build-check" title="Escalade : parois et dénivelés comptent normalement"><input type="checkbox" checked={!!m.climb} onChange={(e) => toggle('escalade', e.target.checked)} /> Escalade</label>
              <label className="battle-token-socle" title="Socle sous le jeton : purement visuel">Socle
                <select value={value} onChange={(e) => {
                  const v = e.target.value;
                  patchToken(selected.id, { socle: v === 'auto' ? undefined : v === 'aucun' ? { mode: 'aucun' } : { mode: 'manuel', t: v as TerrainId } });
                }}>
                  <option value="auto">Automatique{auto ? ` (${TERRAIN_DEF[auto].label.toLowerCase()})` : ''}</option>
                  <option value="aucun">Aucun</option>
                  <optgroup label="Choisi">{TERRAINS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</optgroup>
                </select>
              </label>
            </div>
          );
        })()}

        {(b.aoes ?? []).length > 0 && !building && (
          <div className="battle-chips battle-aoe-chips" aria-label="Zones d'effet">
            {(b.aoes ?? []).map((a) => {
              const view = aoeViews.find((v) => v.id === a.id);
              const hit = view ? b.tokens.filter((t) => !t.unplaced && touches(view.cells, t, b.cols)).map((t) => t.name) : [];
              return (
                <span key={a.id} className="battle-chip battle-aoe-chip">
                  ✸ <b>{aoeName(a)}</b>{a.effect ? ` · ${a.effect.dice} ${DAMAGE_TYPES.find((d) => d.id === a.effect!.type)?.label.toLowerCase() ?? a.effect.type}` : ''} · {hit.length ? `touche : ${hit.join(', ')}` : 'personne'}
                  {a.effect && <button className="maps-btn" title="Lancer les dégâts sur les créatures dans la zone (de nouveau, au tour suivant par exemple)" onClick={() => set({ aoeHit: { aoeId: a.id, targets: aoeTargets(a), at: Date.now() } })}>⚡ Résoudre</button>}
                  <button className="maps-btn" onClick={() => set({ aoes: (b.aoes ?? []).filter((q) => q.id !== a.id), ...(b.aoeHit?.aoeId === a.id ? { aoeHit: undefined } : {}) })}>✕ Retirer</button>
                </span>
              );
            })}
            {(b.aoes ?? []).length > 1 && <button className="battle-chip" onClick={() => set({ aoes: [], aoeHit: undefined })}>✕ Tout retirer</button>}
          </div>
        )}
        {(b.walls ?? []).some((w) => OPENABLE.has(w.kind)) && !building && (
          <div className="battle-chips" aria-label="Portes et herses">
            {(b.walls ?? []).filter((w) => OPENABLE.has(w.kind)).map((w, i) => (
              <button
                key={w.id} className={`battle-chip ${w.open ? 'on' : ''}`} aria-pressed={!!w.open}
                title={w.open ? 'Ouverte : clic pour la fermer' : 'Fermée : clic pour l’ouvrir'}
                onClick={() => set({ walls: (b.walls ?? []).map((q) => (q.id === w.id ? { ...q, open: !q.open } : q)) })}
              >
                {w.kind === 'porte' ? (w.open ? '🚪 ouverte' : '🚪 fermée') : (w.open ? '⛓ levée' : '⛓ baissée')} · {w.label ?? `${w.kind === 'porte' ? 'Porte' : 'Herse'} ${i + 1}`}
              </button>
            ))}
          </div>
        )}
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
            onPointerDown={onBoardDown} onPointerMove={onBoardMove} onDoubleClick={() => editor.onDouble()}
            onDragOver={(e) => { if (building || e.dataTransfer.types.includes(CREATURE_DRAG)) e.preventDefault(); }}
            onDrop={(e) => {
              const creature = e.dataTransfer.getData(CREATURE_DRAG);
              if (creature) {
                // Créature glissée depuis le sélecteur : posée sur la case visée (et les plus proches libres).
                e.preventDefault();
                const c = cellAt(e.clientX, e.clientY);
                if (c) dropCreatures(c, JSON.parse(creature));
                return;
              }
              if (!building) return;
              e.preventDefault();
              const key = e.dataTransfer.getData('text/plain');
              const c = cellAt(e.clientX, e.clientY);
              if (c && PROP_LABEL[key]) placeProp(c, key);
            }}
          >
            <BattleBoard
              cols={b.cols} rows={b.rows} backdrop={rec.image} terrain={baseGrid} elements={boardElements} ranges={ranges} tokens={boardTokens} interactive={!building}
              theme={boardTheme(b.local?.surface)}
              ground={b.ground} surface={editor.view} overlay={building && editor.overlay ? { rules, focus: editor.focus } : undefined}
              path={pathView} surfaceSelected={editor.selectedId} draft={editor.draft}
              onCell={onBoardCell} onElement={building || aoeTool || aiming || (selected && !selected.unplaced) ? undefined : (id) => { if (boardElements.some((e) => e.id === id)) setInfoId(id); }} onHover={(x, y) => setHover({ x, y })}
              preview={stroke && brush.tool === 'terrain' ? stroke.cells : undefined}
              labels={labels} highlight={highlight} fog={fogLayer} exits={dmExits} aim={aimLine} hits={b.hits} aoes={aoeViews}
            />
            {!renderCombat && alertsNode}
            {(movePlan || readout) && (
              <div className={`battle-readout ${movePlan && !movePlan.possible ? 'is-blocked' : movePlan && !movePlan.ok ? 'is-over' : ''}`}>
                {movePlan ? (
                  <>
                    <b>{movePlan.dest}</b>
                    {movePlan.possible
                      ? <span className="battle-sub"> · {movePlan.cost * b.feetPerCell} pi{movePlan.notes.length ? ` (${movePlan.notes.join(', ')})` : ''}{movePlan.ok ? '' : ` · au-delà des ${leftOf(b, moving!) * b.feetPerCell} pi restants`}</span>
                      : <span className="battle-sub"> · ⛔ {movePlan.reason}</span>}
                  </>
                ) : readout ? <span className="battle-sub">{readout.feet} pi à vol d'oiseau</span> : null}
              </div>
            )}
            {editor.cellCard}
          </div>

          {waiting.length > 0 && !building && (
            <div className="battle-place-hint" role="status">
              📍 Où arrive <b>{waiting[0].name}</b> ? Clique une case libre (ou glisse son jeton fantôme){waiting.length > 1 ? ` · ensuite : ${waiting.slice(1).map((t) => t.name).join(', ')}` : ''}.
              <small>Caché aux joueurs tant qu’il n’est pas posé.</small>
            </div>
          )}
          {/* Une seule colonne à gauche : l'attaque en cours, la fiche ouverte, puis les alertes du déplacement. */}
          {renderCombat && (fiche || ((b.aim || b.aoeHit) && !building) || alertsNode) && (
            <div className="battle-overlays">
              {b.aim && !building && (
                <div className="battle-token-card battle-attack-card">
                  {renderCombat({ battle: b, setBattle: onBattle, place: placeTitle, combatKey, selectedId, onSelect: setSelectedId, area: 'attack' })}
                </div>
              )}
              {b.aoeHit && !building && (
                <div className="battle-token-card battle-attack-card">
                  {renderCombat({ battle: b, setBattle: onBattle, place: placeTitle, combatKey, selectedId, onSelect: setSelectedId, area: 'aoe' })}
                </div>
              )}
              {fiche}
              {alertsNode}
            </div>
          )}
        </div>
        <p className="battle-hint">
          {aoeTool ? `✸ Zone d'effet : ${aoeSetup.shape === 'sphere' ? 'clique le centre' : aoeOrigin ? 'clique la direction' : 'clique l’origine (le lanceur, ou un bord de case)'} — Échap pour annuler.`
            : aiming ? `🎯 ${b.tokens.find((t) => t.id === aiming)?.name ?? ''} attaque : clique la cible (Échap pour annuler).`
            : building ? 'Construction : peins le terrain ou glisse des objets sur le plateau.'
            : selected ? `${selected.name} sélectionné : clique une case (ou glisse-le) pour le déplacer · clique-le de nouveau ou Échap pour le désélectionner.`
              : 'Glisse un jeton pour le déplacer · clique un élément pour sa fiche · survole une ligne du panneau pour la repérer.'}
        </p>
      </div>

      <aside className="maps-panel battle-side">
        {!renderCombat && fiche}
        {renderCombat ? (
          renderCombat({
            battle: b, setBattle: onBattle, place: placeTitle, combatKey, selectedId, onSelect: setSelectedId, area: 'encounter',
            side: {
              tabs: [{ id: 'lieu', label: 'Lieu', badge: search.length + secrets.length || undefined }, { id: 'construction', label: 'Construire' }],
              active: tab,
              onPick: (id) => { setTab(id as Tab | null); setStroke(null); },
              render: (id) => (id === 'lieu' ? placePanel : buildPanel),
            },
          })
        ) : (
          <>
            <div className="battle-tabs" role="tablist">
              {([['combat', '⚔ Combat'], ['lieu', '🧭 Lieu'], ['construction', '🛠 Construire']] as const).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => { setTab(tab === id ? null : id); setStroke(null); }} title={tab === id ? 'Rabattre' : undefined}>
                  {label}
                  {id === 'lieu' && search.length + secrets.length > 0 && <small>{search.length + secrets.length}</small>}
                  <i className="battle-tab-chev" aria-hidden>{tab === id ? '▴' : '▾'}</i>
                </button>
              ))}
            </div>

            {tab === 'combat' && (
              <CombatPanel
                b={b} grid={grid} place={placeTitle} selectedId={selectedId} onSelect={setSelectedId} set={set} heroes={heroes} bestiary={bestiary}
                onPlace={placeTokens}
                onRemove={(id) => { set({ tokens: b.tokens.filter((t) => t.id !== id), turn: b.turn === id ? undefined : b.turn }); setSelectedId(null); }}
              />
            )}
            {tab === 'lieu' && placePanel}
            {tab === 'construction' && buildPanel}
          </>
        )}
      </aside>
    </div>
    </>
  );
}
