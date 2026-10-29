/**
 * Cartes des univers : modèle persistant, superposition du MJ et conversion vers le format de l'Atlas.
 *
 * Deux sortes de cartes :
 *  - `atlas` : l'Atlas des profondeurs (données des Archives de l'Underdark, synchronisables) ;
 *  - `custom` : une image importée (ou une carte vierge) avec des repères placés par le MJ.
 *
 * La superposition du MJ (`overlay`, `battle`) est stockée à part de la source : une synchronisation des Archives
 * ne touche jamais aux révélations, aux repères ou aux combats.
 */
import { setAtlasData } from './atlas/model';
import type { LocalElement } from './battle/local';
import type { AtlasData, AtlasFeature, AtlasGeometry, AtlasMap, FeatureCategory, Importance } from './atlas/types';

export type Zone = 'sauvage' | 'transit' | 'cite';

export interface PointRecord {
  id: string;
  title: string;
  category: FeatureCategory;
  importance: Importance;
  /** Texte montré aux joueurs. */
  summary: string;
  /** Notes réservées au MJ : jamais affichées en mode joueurs. */
  notes: string;
  /** Repère caché aux joueurs. */
  secret: boolean;
  /** Position normalisée 0–1 sur l'image. */
  x: number;
  y: number;
  /** Contexte pour les rencontres aléatoires déclenchées depuis ce repère. */
  zone: Zone;
  depth: number;
}

/** `objet` : élément avec lequel les joueurs peuvent interagir. `passage` : porte ou passage secret. `repere` : ancien type, traité comme un objet. */
export type MarkerKind = 'rencontre' | 'passage' | 'objet' | 'repere';

/** Connaissance qu'un test (de Connaissance, d'Histoire…) peut révéler. */
export interface KnowledgeHint { skill: string; dc: number; text: string }

/** Repère posé par le MJ sur une carte : rencontre, passage secret, ou simple point d'intérêt. */
export interface MapMarker {
  id: string;
  kind: MarkerKind;
  title: string;
  /** Plan où le repère est posé (cf. mapIdOf). */
  planId: string;
  /** Position normalisée 0–1 sur le plan. */
  x: number;
  y: number;
  /** Texte montré aux joueurs quand le repère est révélé. */
  summary: string;
  /** Notes du MJ : jamais envoyées aux joueurs. */
  notes: string;
  revealed: boolean;
  /** Créatures d'une rencontre tirée au sort : fiche MJ seulement. */
  groups?: { stat: string; role?: string; n: number; detail: string; name?: string; image?: string; hp?: number; ac?: number; size?: 1 | 2 }[];
  /** Élément interactif : ce qu'on lit au joueur, ce que ça fait, s'il peut le garder, DC d'investigation, connaissances. */
  reading?: string;
  effect?: string;
  keep?: string;
  dcInvestigate?: number;
  knowledge?: KnowledgeHint[];
  /** Fiche des Archives à laquelle le repère est lié. Un lieu disparu après synchronisation le signale sans être effacé. */
  archiveId?: string;
}

/** Où mène un passage : une ancre de l'Atlas, ou un élément interactif de cet univers. */
export interface PassageLink { kind: 'anchor' | 'marker' | 'feature'; id: string; planId: string; label: string }

export interface MapOverlay {
  /** Identifiants des lieux de l'atlas visibles des joueurs. Rien n'est visible par défaut. */
  revealed: string[];
  /** Carte de navigation chez les joueurs : brouillard de guerre, jeton du groupe, héros séparés. */
  playerView?: { fog?: boolean; party?: boolean; heroes?: boolean };
  markers: MapMarker[];
  /** Destinations inscrites par le MJ, par identifiant de passage (tracé de l'Atlas). */
  passageLinks?: Record<string, PassageLink>;
  /** Où est le groupe, où il veut aller, et par où il est passé (MJ seulement). */
  party?: PartyTrack;
  /** Fiches de fouille réécrites par le MJ (ou par l'IA), par identifiant de lieu. */
  searchNotes?: Record<string, SearchNote>;
}

/** Un lieu repéré pour le suivi du groupe : un lieu de l'Atlas, une ancre ou un repère, sur un plan. */
export interface PartyPlace { id: string; kind: 'feature' | 'anchor' | 'marker'; title: string; planId: string }

export interface PartyTrack {
  at?: PartyPlace;
  dest?: PartyPlace;
  /** Lieux traversés, du plus ancien au plus récent (les derniers seulement). */
  trail: PartyPlace[];
  /** Journal de route : épreuves de passage et déplacements notables (les plus récents d'abord). */
  log?: { t: number; text: string }[];
  /** Héros séparés du groupe : sortis seuls d'une carte de combat, ils attendent là où leur sortie mène. */
  apart?: { id: string; name: string; heroId?: string; image?: string; at: PartyPlace; since: number }[];
}

/** Ce que le MJ sait d'un élément à fouiller : comment le trouver, ce qu'on y trouve, et ce que ça fait. */
export interface SearchNote { skill: string; dc: number; find: string; loot?: string; effect?: string }

export interface BattleToken {
  id: string;
  name: string;
  /** Icône (emoji) ou image de la créature ; à défaut, une icône selon la fiche. */
  icon?: string;
  image?: string;
  kind: 'pc' | 'monster' | 'other';
  /** Case de la grille (coin haut-gauche). */
  x: number;
  y: number;
  /** Taille en cases : 1 (moyenne), 2 (grande créature). */
  size: 1 | 2;
  /** Invisible pour les joueurs tant que le MJ ne le révèle pas. */
  visible: boolean;
  hp?: number;
  maxHp?: number;
  ac?: number;
  /** Fiche SRD (cf. statblocks.ts) si la créature est connue. */
  statId?: string;
  /** Initiative obtenue, et bonus d'initiative (Dextérité) pour les jets. */
  init?: number;
  initMod?: number;
  /** États 5e en cours (À terre, Empoisonné…). */
  conditions?: string[];
  /** Capacités à recharge ou à usage limité déjà utilisées. */
  spent?: string[];
  /** Identifiant du personnage du groupe dont vient ce jeton. */
  heroId?: string;
  /** Fiche de PNJ & Créatures (bestiaire de l'univers) dont vient ce jeton. */
  npcId?: string;
  /** Portée de vue en cases (vision dans le noir ou torche), et Perception passive. */
  sight?: number;
  passive?: number;
  /** Héros (repris du module Combat) : déplacement en cases et portée de l'arme en main. */
  move?: number;
  reach?: { melee: number; short: number; long: number; weapon?: string };
  /** Ajouté au combat sans place choisie : caché aux joueurs et sans vision, jusqu'à ce que le MJ le pose. */
  unplaced?: boolean;
}

export interface Battle {
  cols: number;
  rows: number;
  /** Une case = 5 pieds en D&D 5e. */
  feetPerCell: number;
  round: number;
  tokens: BattleToken[];
  /** Terrain généré depuis un lieu : `grid` = cols × rows caractères (cf. battle/terrain.ts). `source` = identifiant du lieu. */
  terrain?: { source: string; seed: number; grid: string };
  /** Zone locale autour du lieu : éléments de l'Atlas placés sur la grille, et ceux que le MJ a découverts. */
  local?: { source: string; planId?: string; place?: string; window: { x0: number; y0: number; w: number; h: number }; elements: LocalElement[]; discovered: string[] };
  /** Identifiant de la rencontre dont les créatures sont déjà placées sur le plateau. */
  encounterOf?: string;
  /** Construction manuelle : surcharges du terrain généré et objets déposés (cf. battle/build.ts). */
  build?: BattleBuild;
  /** Jeton dont c'est le tour, et journal des derniers jets. */
  turn?: string;
  log?: { id: string; text: string; tone?: 'hit' | 'miss' | 'crit' | 'info' }[];
  /** Brouillard de guerre (écran joueur) : actif ou non, et cases déjà explorées pour ce terrain (`source`). */
  fog?: { on: boolean; source?: string; explored: number[] };
  /** Attaque en cours sur le plateau : qui vise qui (trait tracé, aussi chez les joueurs) et le résultat annoncé. */
  aim?: { from: string; to: string; at: number; text?: string; tone?: 'hit' | 'miss' | 'crit' | 'info'; by?: 'joueurs';
    /** Montré aux joueurs : verdict du jet pour toucher, total, phrase de récit, dégâts appliqués, arme utilisée. */
    verdict?: 'hit' | 'crit' | 'miss' | 'fumble'; roll?: number; line?: string; damage?: number; weapon?: string;
    /** Importance de la phrase (Chroniques du Combat), pour son animation : discrète, marquée ou épique. */
    importance?: 'minor' | 'major' | 'epic';
    /** Attaque choisie d'avance (index dans la fiche du combattant). */
    pick?: number };
  /** Dégâts et soins récents (quelques secondes), écrits en grand au-dessus des jetons. */
  hits?: { id: string; to: string; amount: number; at: number }[];
  /** Case d'arrivée du groupe (la sortie qui mène au lieu d'où il vient) : les héros ajoutés y sont posés. */
  entry?: { x: number; y: number };
}

/** `edits` : index de case → type de terrain, posé à la main. `props` : objets déposés sur une case. */
export interface BattleBuild {
  edits: Record<string, string>;
  props: { id: string; key: string; cell: number; visible: boolean }[];
}

export interface MapRecord {
  id: string;
  universeId: string;
  kind: 'atlas' | 'custom';
  title: string;
  description?: string;
  /** Image de fond (data URL), pour une carte personnalisée. */
  image?: string;
  /** Proportions de l'image ; la largeur de référence est 1240. */
  width?: number;
  height?: number;
  points?: PointRecord[];
  overlay?: MapOverlay;
  battle?: Battle;
  /** Dernière synchronisation avec les Archives (atlas uniquement). */
  syncedAt?: number;
  createdAt: number;
  updatedAt: number;
}

/** Repère de l'Atlas intégré : la carte source appartient au projet, pas à l'utilisateur. */
export const ATLAS_MAP_ID = 'atlas-profondeurs';
export const ATLAS_DEFAULT_PLAN = 'carte-n1-s3';

export const EMPTY_OVERLAY: MapOverlay = { revealed: [], markers: [] };
export const DEFAULT_BATTLE: Battle = { cols: 24, rows: 16, feetPerCell: 5, round: 1, tokens: [] };

const MIN_ZOOM: Record<Importance, number> = { landmark: 0, regional: 0, local: 1.3, detail: 2.6 };
const REF_W = 1240;
const MARKER_CATEGORY: Record<MarkerKind, FeatureCategory> = { rencontre: 'danger', passage: 'voie', objet: 'indetermine', repere: 'indetermine' };

/** Construit le jeu de données d'une carte personnalisée. Les repères secrets sont retirés pour les joueurs. */
export function buildCustomAtlas(rec: MapRecord, dm: boolean): AtlasData {
  const mapId = `map-${rec.id}`;
  const w = rec.width ?? REF_W;
  const h = rec.height ?? Math.round((REF_W * 755) / REF_W);
  const pts = (rec.points ?? []).filter((p) => dm || !p.secret);
  const features: AtlasFeature[] = pts.map((p) => ({
    id: p.id, title: p.title, category: p.category, importance: p.importance, minZoom: MIN_ZOOM[p.importance],
    summary: p.summary || undefined, canonStatus: 'creation', placementStatus: 'documented',
  }));
  const geometries: AtlasGeometry[] = pts.map((p) => ({ id: `g-${p.id}`, mapId, featureId: p.id, type: 'point', coordinates: [p.x, p.y] }));
  return {
    version: 'custom-1',
    levels: [{ id: 'custom', order: 1, title: rec.title, description: rec.description ?? '', strataIds: [], survey: 'cartographie' }],
    strata: [],
    spaces: [],
    maps: [{ id: mapId, title: rec.title, scope: { kind: 'niveau', id: 'custom' }, width: REF_W, height: Math.round((REF_W * h) / w), defaultViewport: { x: 0.5, y: 0.5, zoom: 1 }, ambiance: rec.image }],
    cavities: {},
    features,
    geometries,
    anchors: [],
    connections: [],
  };
}

/** Identifiant de la carte rendue (dans son jeu de données). */
export const mapIdOf = (rec: MapRecord) => (rec.kind === 'atlas' ? ATLAS_DEFAULT_PLAN : `map-${rec.id}`);

/**
 * Ajoute les repères du MJ au jeu de données. Côté joueurs, seuls les repères révélés passent.
 * Un repère est un point d'atlas : il bénéficie donc du zoom, de la sélection et des étiquettes existantes.
 */
/** Coordonnées d'un lieu suivi (lieu de l'Atlas, ancre ou repère) sur son plan. */
export function placeCoords(data: AtlasData, rec: MapRecord, p: PartyPlace): [number, number] | null {
  if (p.kind === 'marker') {
    const m = rec.overlay?.markers.find((x) => x.id === p.id);
    return m ? [m.x, m.y] : null;
  }
  if (p.kind === 'anchor') {
    const a = data.anchors.find((x) => x.id === p.id);
    return a ? (a.at as [number, number]) : null;
  }
  const g = data.geometries.find((x) => x.featureId === p.id && x.mapId === p.planId) ?? data.geometries.find((x) => x.featureId === p.id);
  if (!g) return null;
  if (g.type === 'point') return g.coordinates as [number, number];
  const pts = g.coordinates as [number, number][];
  return pts[Math.floor(pts.length / 2)] ?? null;
}

function withMarkers(data: AtlasData, rec: MapRecord, dm: boolean): AtlasData {
  const markers = (rec.overlay?.markers ?? []).filter((m) => dm || m.revealed);
  if (markers.length === 0) return data;
  const features: AtlasFeature[] = markers.map((m) => ({
    id: `mk-${m.id}`, title: m.title, category: MARKER_CATEGORY[m.kind], importance: 'landmark', minZoom: 0,
    summary: dm ? [m.summary, m.notes && `Notes du MJ : ${m.notes}`].filter(Boolean).join('\n\n') || undefined : m.summary || undefined,
    canonStatus: 'creation', placementStatus: 'documented',
  }));
  const geometries: AtlasGeometry[] = markers.map((m) => ({
    id: `g-mk-${m.id}`, mapId: m.planId, featureId: `mk-${m.id}`, type: 'point', coordinates: [m.x, m.y],
  }));
  return { ...data, features: [...data.features, ...features], geometries: [...data.geometries, ...geometries] };
}

/** Jeu de données complet d'une carte, vue MJ (`dm`) ou joueurs. Pour l'Atlas, `atlas` est la source synchronisée. */
export function mapDataFor(rec: MapRecord, atlas: AtlasData, dm: boolean): AtlasData {
  if (rec.kind === 'custom') return withMarkers(buildCustomAtlas(rec, dm), rec, dm);
  if (dm) return withMarkers(atlas, rec, true);
  const revealed = new Set(rec.overlay?.revealed ?? []);
  return withMarkers(
    { ...atlas, features: atlas.features.filter((f) => revealed.has(f.id)), geometries: atlas.geometries.filter((g) => revealed.has(g.featureId)) },
    rec, false,
  );
}

/** Ne garde que le plan demandé : c'est ce qu'on envoie à l'écran joueur (petit, sans données MJ). */
export function restrictToPlan(data: AtlasData, planId: string): AtlasData {
  const geometries = data.geometries.filter((g) => g.mapId === planId);
  const ids = new Set(geometries.map((g) => g.featureId));
  const maps: AtlasMap[] = data.maps.filter((m) => m.id === planId);
  return {
    ...data,
    levels: [], strata: [], spaces: [], anchors: data.anchors.filter((a) => a.mapId === planId), connections: [],
    maps,
    cavities: { [planId]: data.cavities[planId] ?? [] },
    features: data.features.filter((f) => ids.has(f.id)),
    geometries,
  };
}

let activeKey = '';
let activeData: AtlasData | null = null;
/**
 * Active le jeu de données d'une carte avant son rendu (vue MJ). Ne reconstruit les index que si la carte
 * ou sa superposition a changé (`updatedAt`). Le moteur d'Atlas lit des index partagés : une seule carte est active à la fois.
 */
export function activateMap(rec: MapRecord, dm: boolean, atlas: AtlasData): AtlasData {
  const key = `${rec.id}:${rec.updatedAt}:${dm}`;
  if (key !== activeKey || !activeData) {
    activeData = mapDataFor(rec, atlas, dm);
    setAtlasData(activeData);
    activeKey = key;
  }
  return activeData;
}

/** Lit une image et la réduit (côté le plus long ≤ 2000 px) pour rester raisonnable dans le stockage local. */
export function imageFileToDataUrl(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
      const width = Math.round(img.naturalWidth * scale), height = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.86), width, height });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible.')); };
    img.src = url;
  });
}
