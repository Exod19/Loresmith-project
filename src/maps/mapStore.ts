/**
 * Cartes des univers : modèle persistant et conversion vers le format de l'Atlas.
 *
 * Deux sortes de cartes :
 *  - `atlas` : l'Atlas des profondeurs intégré (données et code fournis par le projet) ;
 *  - `custom` : une image importée (ou une carte vierge) avec des repères placés par le MJ.
 *
 * Les cartes personnalisées sont converties en `AtlasData` pour être rendues par le même moteur (MapCanvas).
 */
import { setAtlasData } from './atlas/model';
import type { AtlasData, AtlasFeature, AtlasGeometry, FeatureCategory, Importance } from './atlas/types';

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
  createdAt: number;
  updatedAt: number;
}

/** Repère de l'Atlas intégré : la carte source appartient au projet, pas à l'utilisateur. */
export const ATLAS_MAP_ID = 'atlas-profondeurs';
export const ATLAS_DEFAULT_PLAN = 'carte-n1-s3';

const MIN_ZOOM: Record<Importance, number> = { landmark: 0, regional: 0, local: 1.3, detail: 2.6 };
const REF_W = 1240;

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

let activeKey = '';
/**
 * Active le jeu de données d'une carte avant son rendu. Ne reconstruit les index que si la carte change.
 * Le moteur d'Atlas lit des index partagés : une seule carte est active à la fois.
 */
export function activateMap(rec: MapRecord, dm: boolean, atlas: AtlasData): AtlasData {
  const key = rec.kind === 'atlas' ? 'atlas' : `${rec.id}:${rec.updatedAt}:${dm}`;
  const data = rec.kind === 'atlas' ? atlas : buildCustomAtlas(rec, dm);
  if (key !== activeKey) {
    setAtlasData(data);
    activeKey = key;
  }
  return data;
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
