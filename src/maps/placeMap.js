/**
 * Lot D : « carte des lieux découverts ».
 * Chaque univers (hors Underdark, qui a son atlas) peut avoir une carte vierge où les lieux apparaissent
 * à mesure que les séances les découvrent. Logique pure : création de la carte, placement automatique, ajout des repères.
 * Les coordonnées sont normalisées (0–1), comme dans `mapStore.ts`.
 */

const W = 1240;
const H = 755;
const ASPECT = H / W; // les distances se mesurent en unités de largeur, pas en 0–1 brut
const MIN_DIST = 0.09;
const MARGIN = 0.06;
const GOLDEN = (137.5 * Math.PI) / 180;

/** Un id par univers : une seule carte des lieux. */
export const placeMapId = (universeId) => `places-${universeId}`;

/** La carte des lieux n'a pas de sens pour l'Underdark, qui a déjà son atlas dessiné. */
export const wantsPlaceMap = (universe) => !!universe && universe.archives !== 'underdark';

export function emptyPlaceMap(universeId, now) {
  return {
    id: placeMapId(universeId),
    universeId,
    kind: 'custom',
    title: 'Lieux découverts',
    description: 'Se complète toute seule : chaque lieu découvert en séance y est ajouté. Déplace les repères pour les ranger.',
    width: W,
    height: H,
    points: [],
    overlay: { revealed: [], markers: [] },
    placeMap: true,
    createdAt: now,
    updatedAt: now,
  };
}

const dist = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * ASPECT);
const inBounds = (p) => p.x >= MARGIN && p.x <= 1 - MARGIN && p.y >= MARGIN && p.y <= 1 - MARGIN;
const free = (p, markers) => inBounds(p) && markers.every((m) => dist(p, m) >= MIN_DIST);
const clamp = (v) => Math.min(1 - MARGIN, Math.max(MARGIN, v));

/** Position d'un nouveau lieu : près d'un lieu relié s'il y en a un, sinon en spirale autour du centre. Déterministe. */
export function positionFor(markers, neighborIds = []) {
  if (!markers.length) return { x: 0.5, y: 0.5 };
  const anchor = markers.find((m) => neighborIds.includes(m.entryId));
  const center = anchor || { x: 0.5, y: 0.5 };
  const base = anchor ? 0.12 : 0.1;
  const step = anchor ? 0.05 : 0.035;
  for (let k = 0; k < 400; k++) {
    const r = base + step * Math.floor(k / 6);
    const a = k * GOLDEN + markers.length;
    const p = { x: center.x + Math.cos(a) * r, y: center.y + (Math.sin(a) * r) / ASPECT };
    if (free(p, markers)) return p;
  }
  return { x: clamp(0.5 + (markers.length % 7) * 0.01), y: clamp(0.5) };
}

/**
 * Ajoute à la carte un repère pour chaque lieu qui n'y est pas encore (jamais de doublon, jamais de retrait).
 * Un lieu que le MJ a retiré à la main (`placeDismissed`) n'est pas remis.
 * `edges` : liens {from, to} entre fiches ; un lieu relié à un lieu déjà sur la carte est posé à côté de lui.
 */
export function addPlaces(map, places, { edges = [], now }) {
  const markers = [...(map.overlay?.markers || [])];
  let added = 0;
  for (const place of places) {
    if (markers.some((m) => m.entryId === place.id) || (map.placeDismissed || []).includes(place.id)) continue;
    const neighbors = edges.flatMap((e) => (e.from === place.id ? [e.to] : e.to === place.id ? [e.from] : []));
    const { x, y } = positionFor(markers, neighbors);
    markers.push({
      id: `pl-${place.id}`,
      kind: 'repere',
      title: place.title,
      planId: `map-${map.id}`,
      x,
      y,
      summary: place.shortSummary || '',
      notes: '',
      revealed: true, // un lieu découvert en séance est connu des joueurs
      entryId: place.id,
    });
    added++;
  }
  if (!added) return { map, added: 0 };
  return { map: { ...map, overlay: { ...(map.overlay || { revealed: [] }), markers }, updatedAt: now }, added };
}
