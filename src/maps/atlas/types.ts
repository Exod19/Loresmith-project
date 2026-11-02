/**
 * Modèle de l'Atlas des profondeurs (docs/atlas/00-cahier-de-conception.md, §11 ; consignes de refonte).
 * Trois structures indépendantes reliées par identifiants :
 *  - hiérarchie : niveaux → strates → (secteurs) → sites → paliers ; entre-strates hors de cette hiérarchie ;
 *  - géométrie : cavités, surfaces, galeries et points, propres à chaque carte ;
 *  - circulation : ancres posées sur des cartes et connexions orientées entre ancres.
 */
/** Statut éditorial d'un élément (même vocabulaire que les fiches de Loresmith). */
export type CanonStatus = 'confirme' | 'recit' | 'oral' | 'hypothese' | 'conteste' | 'nonconfirme' | 'brouillon' | 'creation';

export type PlacementStatus = 'documented' | 'approximate' | 'illustrative' | 'unknown';
export type Importance = 'landmark' | 'regional' | 'local' | 'detail';

export type FeatureCategory =
  | 'cite' | 'sanctuaire' | 'grotte' | 'voie' | 'eau' | 'danger' | 'ressource'
  | 'vivant' | 'evenement' | 'institution' | 'ruine' | 'garde' | 'indetermine';

/** Familles de chemins, du plus large au plus discret. */
export type Trace = 'tunnel' | 'galerie' | 'boyau' | 'etroit' | 'crevasse' | 'ruisseau' | 'secret' | 'maritime';

export type ConnectionKind = 'tunnel' | 'galerie' | 'escalier' | 'puits' | 'ascenseur' | 'pont' | 'portail' | 'naturel' | 'inconnu';

export interface AtlasLevel {
  id: string; order: number; title: string; description: string; strataIds: string[];
  /** État de la documentation cartographique du niveau. */
  survey: 'cartographie' | 'fragmentaire' | 'inconnu';
}

export interface AtlasStratum {
  id: string; levelId: string; title: string; description?: string;
  /** Ordre de profondeur relative dans le niveau (1 = plus haute). Aucune altitude n'est inventée. */
  relativeDepthOrder: number;
  /** Libellé descriptif neutre (« strate médiane »…), pas un nom canonique. */
  depthLabel: string;
  mapId?: string; demo?: boolean;
}

export interface AtlasSpace {
  id: string; kind: 'secteur' | 'site' | 'palier' | 'entre-strate'; name: string; levelId: string; stratumIds: string[];
  parentSpaceId?: string; siteId?: string; floorOrder?: number; floorLabel?: string; mapId?: string;
  /** Palier d'accueil d'un site : on n'arrive jamais par accident au plus profond. */
  entryFloorId?: string; description?: string; demo?: boolean;
  /** Entre-strates : profondeur relative (3.5 = entre I-3 et I-4), degré d'imbrication (2 = entre-entre-strate) et extrémités (strate ou espace). */
  depth?: number; nesting?: number; between?: [string, string];
  /** Site sculpté (Hosten Valak) : chaque palier porte une partie d'un visage monumental. */
  faceSite?: boolean; facePart?: string;
}

export interface Viewport { x: number; y: number; zoom: number }

export interface AtlasMap {
  id: string; title: string;
  scope: { kind: 'niveau' | 'strate' | 'espace' | 'site'; id: string; floorId?: string };
  /** Repère interne : coordonnées normalisées 0–1 sur un plan de proportions width × height. */
  width: number; height: number; defaultViewport: Viewport; demo?: boolean;
  /** Illustration d'ambiance facultative, affichable en calque ; jamais la vérité géométrique. */
  ambiance?: string;
  /** Dessin vectoriel propre au plan (sculptures, escaliers, bâtiments, canalisations), en unités de plan. */
  decor?: MapDecor[];
  /**
   * Plan de surface (carte du monde, cité générée) : échelle en mètres par unité de plan, et sol réel
   * (bâtiments, remparts, eaux, arbres, champs, rues) dont la carte de combat est tirée. Absent : plan souterrain.
   */
  surface?: MapSurface;
}

/** Sol d'un plan de surface (voir src/maps/world/generate.js) ; rectangles et tracés en unités de plan. */
export interface MapSurface {
  scale: number;
  theme: 'cite' | 'monde' | 'interieur';
  /** Lumière du moment (carte du monde) : le soir et la nuit, le plan s'assombrit. */
  light?: 'soir' | 'nuit';
  /** Climat d'une cité (allure du plan et du plateau de combat). */
  climate?: 'froid' | 'tempere' | 'chaud';
  /** Saison choisie par le MJ (couleurs du plan). */
  season?: 'printemps' | 'ete' | 'automne' | 'hiver';
  /** Part du sol couverte de neige (congères : terrain difficile au combat). */
  snow?: number;
  /** Eaux gelées : toutes, ou seulement les rivières. */
  frozen?: 'tout' | 'rivieres';
  /** Relief continu d'un monde à l'échelle (lot 12) : voir world/terrain.js. */
  relief?: Record<string, unknown>;
  ground: {
    b: number[]; f: number[]; t: number[];
    /** Obstacles intérieurs (comptoir, âtre, autel…) : rectangles comme `b`, infranchissables mais pas des murs. */
    o?: number[];
    /** Ouvertures (portes, passages) que la grille de combat garde ouvertes : [x, y] à plat. */
    doors?: number[];
    walls: { pts: number[]; hw: number }[];
    water: { pts: number[]; hw: number; closed?: boolean }[];
    roads: { pts: number[]; hw: number }[];
    forests?: number[][];
    towns?: number[];
    /** Mobilier des intérieurs, dessiné avec la Banque Loresmith : [nature, x, y, largeur, profondeur, angle]. */
    p?: [string, number, number, number, number, number][];
    /** Bâtiments entiers (corps et ailes) : [x, y, largeur, profondeur, angle, puis u0, v0, u1, v1 de chaque partie]. */
    bx?: number[][];
  };
}

export interface MapDecor {
  kind: 'face' | 'eye' | 'pupil' | 'fang' | 'dark' | 'stair' | 'steps' | 'building' | 'ring' | 'fountain' | 'temple' | 'dome' | 'arch' | 'pit' | 'enclosure' | 'field' | 'mushroom' | 'tower' | 'pipe' | 'basin'
    /* Plans de surface (cités et monde générés). */
    | 'plot' | 'tree' | 'river' | 'square' | 'court' | 'wall' | 'roof' | 'roof-farm' | 'roof-noble' | 'roof-civic' | 'keep' | 'bridge'
    | 'forest' | 'lake' | 'hill' | 'town'
    /* Climat et côtes (lot 9). */
    | 'biome-neige' | 'biome-taiga' | 'biome-steppe' | 'biome-desert' | 'dune' | 'pine' | 'forest-sparse' | 'mountain' | 'snowcap'
    | 'shore' | 'shore-cold' | 'beach' | 'sea' | 'pier' | 'lake-ice' | 'stream'
    /* Intérieurs. */
    | 'street' | 'floor' | 'floor-stone' | 'hatch' | 'pillar' | 'stool' | 'wall-in' | 'furn' | 'table' | 'chest' | 'tomb' | 'throne' | 'bed' | 'hearth' | 'altar' | 'anvil' | 'trough' | 'stair' | 'barrel' | 'crate' | 'bars' | 'rug' | 'dais' | 'stall';
  d: string;
  /** Épaisseur du trait en unités de plan (rempart, rivière) : elle suit le zoom, contrairement aux traits fins. */
  w?: number;
}

/** Cavité rocheuse : ellipse irrégulière générée de façon stable (cx, cy, rx, ry en coordonnées 0–1, graine). */
export interface Cavity { cx: number; cy: number; rx: number; ry: number; seed: number; tone?: number }

export interface AtlasFeature {
  /** Peuple d'une cité (moriquendi, duergar…) : son emblème remplace le pictogramme sur les cartes. */
  people?: string;
  /** Variante d'emblème peint du peuple (1–6). */
  emblem?: number;
  id: string; title: string; category: FeatureCategory; importance: Importance; minZoom: number;
  subtitle?: string; summary?: string; entryId?: string; relatedEntryIds?: string[]; sourceEntryIds?: string[];
  canonStatus: CanonStatus; placementStatus: PlacementStatus;
  /** Lien vers une vue plus fine : « Ouvrir la strate », « Entrer dans le site ». */
  opens?: { kind: 'strate' | 'site'; id: string };
  /** Nom de zone (salle, secteur) : étiquette posée sur la carte, sans marqueur. */
  area?: boolean;
  /** Nature d'un tracé (polyligne) : détermine son dessin. */
  trace?: Trace;
  /** Illustration propre au lieu (cités importées). */
  image?: string;
  /** Conseils au MJ fournis par la source (cités importées) : jets, DD, conséquences. */
  dm?: { kind: 'test' | 'save' | 'info'; label: string; dc?: number; ok?: string; ko?: string }[];
  /** Tiré au sort, pas encore défini par le MJ (carte du monde, mode Exploration). */
  draft?: boolean;
  /** PNJ expressément caché (carte du monde) : pas révélé d'office, jeton caché en combat. */
  hiddenNpc?: boolean;
  demo?: boolean;
}

export interface AtlasGeometry {
  id: string; mapId: string; featureId: string;
  type: 'point' | 'polyline' | 'polygon';
  coordinates: [number, number] | [number, number][];
}

/** Extrémité d'une connexion, posée sur une carte. */
export interface AtlasAnchor { id: string; mapId: string; at: [number, number]; label: string }

export interface AtlasConnection {
  id: string; kind: ConnectionKind; fromAnchorId: string; toAnchorId: string;
  /** `forward` : uniquement de `from` vers `to`. */
  direction: 'both' | 'forward'; title: string; note?: string;
  canonStatus: CanonStatus; placementStatus: PlacementStatus; demo?: boolean;
  /** Difficulté de franchissement (1 aisé → 4 extrême) et obstacles rencontrés. */
  difficulty?: 1 | 2 | 3 | 4; hazards?: string[];
}

export interface AtlasData {
  version: string; levels: AtlasLevel[]; strata: AtlasStratum[]; spaces: AtlasSpace[]; maps: AtlasMap[];
  cavities: Record<string, Cavity[]>;
  features: AtlasFeature[]; geometries: AtlasGeometry[]; anchors: AtlasAnchor[]; connections: AtlasConnection[];
}
