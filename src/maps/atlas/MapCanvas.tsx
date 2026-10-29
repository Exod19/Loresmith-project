/**
 * Plan cartographique vectoriel : cavités, eaux, zones à risque, galeries, accès et lieux.
 * Pan / zoom (glisser, molette au curseur, pincement, boutons), dévoilement progressif selon le zoom,
 * anticollision des étiquettes, mini-carte, arrivée centrée sur une ancre.
 * Coordonnées normalisées 0–1 et viewBox fixe : un redimensionnement ne déplace jamais les points.
 */
import { CityEmblem, paintedEmblem, peopleOf } from './emblems';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import {
  CATEGORIES, anchorsOn, cavitiesOf, cavityPath, connectionAt, densityOf, features, geometriesOn, maps, smoothPath, spaces, strata,
} from './model';
import type { AtlasAnchor, AtlasFeature, AtlasMap, Cavity, FeatureCategory, Trace } from './types';

export type Layers = { points: boolean; etiquettes: boolean; galeries: boolean; connexions: boolean; ambiance: boolean };
type T = { tx: number; ty: number; k: number };

const MIN_K = 0.75;
/** Zoom maximal à l'échelle des plans saisis (×8) ; une strate 4× plus vaste autorise donc ×32. */
const MAX_RZ = 8;
/** Taille des marqueurs (écran) et des étiquettes selon l'importance : la hiérarchie se lit d'un coup d'œil. */
const PIN_R = { landmark: 17, regional: 14, local: 10, detail: 5 } as const;
const LBL_FS = { landmark: 15, regional: 13, local: 12, detail: 11 } as const;
const traceOf = (f: AtlasFeature): Trace => f.trace ?? (f.importance === 'landmark' ? 'galerie' : f.importance === 'regional' ? 'galerie' : 'boyau');
/** Largeur des passages (unités de plan) : de vrais vides creusés dans la roche, pas des routes. */
const PASS_W: Record<Trace, number> = { tunnel: 30, galerie: 19, boyau: 10, etroit: 6.5, crevasse: 0, ruisseau: 0, secret: 0 };
const FLOOR = '#1f2a29', WALL = '#030607', RIM = '#6b7a75';
/** Vue mémorisée par carte : le retour retrouve position et échelle. */
const saved = new Map<string, T>();
/** Arrivées déjà appliquées (clé d'historique) : revenir en arrière ne recentre pas une seconde fois. */
const appliedFocus = new Set<string>();

/** Proportions de la fenêtre (largeur / hauteur), pour cadrer le plan sur écran vertical. */
let viewAspect = 1.64;
const fit = (m: AtlasMap, x: number, y: number, k: number): T => ({ k, tx: m.width / 2 - x * m.width * k, ty: m.height / 2 - y * m.height * k });

/** Rang de profondeur d'une carte : sert à orienter les flèches des accès (↧ descendre, ↥ remonter). */
function depthRank(mapId: string) {
  const m = maps.get(mapId); if (!m) return 0;
  if (m.scope.kind === 'strate') return (strata.get(m.scope.id)?.relativeDepthOrder ?? 0) * 10;
  if (m.scope.kind === 'espace') { const s = spaces.get(m.scope.id); if (s?.depth != null) return s.depth * 10; return Math.max(...(s?.stratumIds ?? []).map((id) => strata.get(id)?.relativeDepthOrder ?? 0)) * 10 - 5; }
  if (m.scope.kind === 'site') { const site = spaces.get(m.scope.id); const f = m.scope.floorId ? spaces.get(m.scope.floorId) : undefined; return (strata.get(site?.stratumIds[0] ?? '')?.relativeDepthOrder ?? 0) * 10 + (f?.floorOrder ?? 0) / 10; }
  return 0;
}

/** Fond minéral : fissures et stries déterministes (propres à chaque carte). */
function lithology(seed: number, W: number, H: number, n: number) {
  let z = seed >>> 0; const r = () => ((z = (1664525 * z + 1013904223) >>> 0) / 4294967296);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = 40 + r() * (W - 80), y = 40 + r() * (H - 80), len = 7 + r() * 26;
    out.push(`M${x.toFixed(1)} ${y.toFixed(1)}l${len.toFixed(1)} ${((r() - 0.5) * 16).toFixed(1)}l${((r() - 0.5) * 22).toFixed(1)} ${((r() - 0.5) * 12).toFixed(1)}`);
  }
  return out.join('');
}

/** Relief interne révélé au zoom : courbes de niveau, concrétions, blocs. Unités de plan, déterministe. */
function terrain(cavs: Cavity[], W: number, H: number) {
  const contours: string[] = [], dots: { x: number; y: number; r: number }[] = [], blocks: string[] = [];
  cavs.forEach((c, ci) => {
    let z = (c.seed * 7919 + ci) >>> 0; const r = () => ((z = (1664525 * z + 1013904223) >>> 0) / 4294967296);
    contours.push(cavityPath({ ...c, rx: c.rx * 0.74, ry: c.ry * 0.7, seed: c.seed + 11 }, W, H), cavityPath({ ...c, rx: c.rx * 0.46, ry: c.ry * 0.42, seed: c.seed + 23, cx: c.cx + (r() - 0.5) * c.rx * 0.3 }, W, H));
    const n = Math.round((c.rx * W * c.ry * H) / 700);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, k = Math.sqrt(r()) * 0.92;
      dots.push({ x: c.cx * W + Math.cos(a) * c.rx * W * k, y: c.cy * H + Math.sin(a) * c.ry * H * k, r: 0.8 + r() * 2.2 });
    }
    for (let i = 0; i < n / 6; i++) {
      const a = r() * Math.PI * 2, k = 0.55 + r() * 0.4, x = c.cx * W + Math.cos(a) * c.rx * W * k, y = c.cy * H + Math.sin(a) * c.ry * H * k, s = 1.2 + r() * 1.8;
      blocks.push(`M${(x - s).toFixed(1)} ${(y + s * 0.6).toFixed(1)}L${(x + s * 0.3).toFixed(1)} ${(y - s).toFixed(1)}L${(x + s).toFixed(1)} ${(y + s * 0.4).toFixed(1)}Z`);
    }
  });
  return { contours: contours.join(''), dots, blocks: blocks.join('') };
}

/** Grain minéral (bruit) produit une seule fois, posé en surimpression à l'écran. */
let grainUrl: string | null = null;
function grain() {
  if (grainUrl !== null || typeof document === 'undefined') return grainUrl ?? '';
  const c = document.createElement('canvas'); c.width = c.height = 180; const g = c.getContext('2d');
  if (!g) return (grainUrl = '');
  const img = g.createImageData(180, 180);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0); return (grainUrl = c.toDataURL('image/png'));
}

/** Cercles réunis en un seul tracé (beaucoup plus léger que des milliers d'éléments). */
const circles = (pts: { x: number; y: number; r: number }[], f: number) =>
  pts.map(({ x, y, r }) => { const q = r * f; return `M${(x - q).toFixed(1)} ${y.toFixed(1)}a${q.toFixed(2)} ${q.toFixed(2)} 0 1 0 ${(2 * q).toFixed(2)} 0a${q.toFixed(2)} ${q.toFixed(2)} 0 1 0 ${(-2 * q).toFixed(2)} 0`; }).join('');

/** Constructions d'un plan de site, posées dans sa cavité principale. */
function buildings(m: AtlasMap) {
  const c = cavitiesOf(m.id)[0]; if (!c) return [];
  let z = c.seed * 977 >>> 0; const r = () => ((z = (1664525 * z + 1013904223) >>> 0) / 4294967296);
  const out: { x: number; y: number; w: number; h: number }[] = [];
  const cx = c.cx * m.width, cy = c.cy * m.height, rx = c.rx * m.width * 0.82, ry = c.ry * m.height * 0.78;
  for (let i = 0; i < 46; i++) {
    const x = cx - rx + (i % 8) * (rx * 2 / 8) + (r() - 0.5) * 22, y = cy - ry + Math.floor(i / 8) * (ry * 2 / 6) + (r() - 0.5) * 24, s = 15 + r() * 20;
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 0.92) continue;
    out.push({ x, y, w: s * 1.7, h: s });
  }
  return out;
}

/** Repère MJ dessiné au-dessus de la carte (position du groupe, destination), en coordonnées de plan 0–1. */
export type MapMark = { id: string; x: number; y: number; label: string; tone: 'party' | 'dest' | 'hero' };

/** Brouillard de guerre : `vision` (cercles éclairés, rayon r), `explored` (déjà découvert, assombri, rayon er) ; le reste est noir. */
export type MapFog = { vision: [number, number][]; explored: [number, number][]; r: number; er: number };
/** Le groupe en chemin : il glisse le long des points du tracé (coins compris), de `points[0]` au dernier. */
export type MapTravel = { key: string; points: [number, number][]; at: number; label?: string };

export default function MapCanvas({ map, layers, hidden, focus, focusKey, selectedId, onSelect, onAnchor, onPlace, dataKey, dm, marks = [], fog, journey }: {
  map: AtlasMap; layers: Layers; hidden: Set<FeatureCategory>;
  /** Mode MJ : révèle les passages secrets. Hors MJ, la carte est une carte de lore. */
  dm: boolean;
  /** Cible à mettre en évidence et cadrer (ancre d'arrivée ou lieu recherché). */
  focus?: { kind: 'anchor' | 'point'; id: string } | null; focusKey?: string;
  selectedId?: string | null;
  onSelect: (f: AtlasFeature) => void; onAnchor: (a: AtlasAnchor) => void;
  /** Mode placement : un clic sur le fond de la carte renvoie sa position normalisée (0–1). */
  onPlace?: (x: number, y: number) => void;
  dataKey?: string | number;
  marks?: MapMark[];
  /** Brouillard de guerre (vue joueurs), en coordonnées 0–1 du plan ; rayons en largeur de plan. */
  fog?: MapFog | null;
  /** Déplacement du groupe à animer (ignoré s'il date de plus de quelques secondes). */
  journey?: MapTravel | null;
}) {
  // Le groupe en chemin : position courante le long du tracé, image par image.
  const [walker, setWalker] = useState<[number, number] | null>(null);
  useEffect(() => {
    if (!journey || journey.points.length < 2 || Date.now() - journey.at > 6000) { setWalker(null); return; }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setWalker(null); return; }
    const pts = journey.points.map(([x, y]) => [x * map.width, y * map.height] as [number, number]);
    const seg: number[] = [0];
    for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = seg[seg.length - 1] || 1;
    const duration = Math.min(5200, Math.max(1800, (total / map.width) * 9000));
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const d = e * total;
      let i = 1;
      while (i < seg.length - 1 && seg[i] < d) i++;
      const t = (d - seg[i - 1]) / ((seg[i] - seg[i - 1]) || 1);
      const [ax, ay] = journey.points[i - 1], [bx, by] = journey.points[i];
      setWalker([ax + (bx - ax) * t, ay + (by - ay) * t]);
      if (k < 1) raf = requestAnimationFrame(step); else setWalker(null);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey?.key]);
  const travelEnd = journey ? journey.points[journey.points.length - 1] : undefined;
  const near = (a: [number, number], b?: [number, number]) => !!b && Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.012;
  // Pendant le trajet, la vision suit le groupe en marche (pas encore à destination).
  const vision = fog ? (walker ? [...fog.vision.filter((p) => !near(p, travelEnd)), walker] : fog.vision) : [];
  const shownMarks = walker ? marks.filter((m) => !(m.tone === 'party' && near([m.x, m.y], travelEnd))) : marks;
  const svg = useRef<SVGSVGElement>(null);
  const W = map.width, H = map.height;
  /** Facteur d'échelle du plan par rapport aux plans saisis (1240 de large) : les seuils de zoom en dépendent. */
  const zf = W / 1240;
  const maxK = useRef(MAX_RZ * zf); maxK.current = MAX_RZ * zf;
  // Sur écran vertical, le plan est agrandi pour occuper la hauteur plutôt que de flotter dans le vide.
  const boost = () => Math.pow(Math.min(1.9, Math.max(1, W / H / viewAspect)), 0.75);
  const home = () => fit(map, map.defaultViewport.x, map.defaultViewport.y, map.defaultViewport.zoom * boost());
  const [t, setT] = useState<T>(() => saved.get(map.id) ?? home());
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; k: number } | null>(null);
  const travel = useRef({ x: 0, y: 0, dist: 0 });
  const drag = useRef({ x: 0, y: 0, pending: false });
  const [px, setPx] = useState(2); // unités de plan par pixel écran
  const [view, setView] = useState({ w: 0, h: 0 });
  /** Vue encore « par défaut » (ni restaurée, ni déplacée) : recadrable quand la taille est connue. */
  const fresh = useRef(!saved.has(map.id));

  useEffect(() => { fresh.current = !saved.has(map.id); setT(saved.get(map.id) ?? home()); }, [map.id]);
  useEffect(() => { saved.set(map.id, t); }, [map.id, t]);
  // La nouvelle vue est peinte : on retire la transformation provisoire du glisser.
  useLayoutEffect(() => { if (drag.current.pending && svg.current) { svg.current.style.transform = ''; drag.current.pending = false; } }, [t]);
  useEffect(() => {
    const el = svg.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect; if (!r.width) return;
      setPx(Math.max(W / r.width, H / r.height)); setView({ w: r.width, h: r.height }); viewAspect = r.width / r.height;
      if (fresh.current) { fresh.current = false; if (!focusKey || appliedFocus.has(focusKey) || !focus) setT(home()); }
    });
    ro.observe(el); return () => ro.disconnect();
  }, [W, H]);

  // `dataKey` change quand le contenu du plan change (repères, révélations) sans changer de plan : les listes sont recalculées.
  const geos = useMemo(() => geometriesOn(map.id), [map.id, dataKey]);
  const anchors = useMemo(() => anchorsOn(map.id), [map.id, dataKey]);
  const cavities = useMemo(() => cavitiesOf(map.id), [map.id, dataKey]);
  const houses = useMemo(() => (map.scope.kind === 'site' && !map.decor ? buildings(map) : []), [map]);
  const relief = useMemo(() => terrain(cavities, W, H), [cavities, W, H]);
  /** Tracés des passages triés par seuil de zoom : ceux qui sont visibles forment un préfixe de la liste. */
  const passages = useMemo(() => geos.filter((g) => g.type === 'polyline').map((g) => {
    const f = features.get(g.featureId)!; const tr = traceOf(f); const pts = g.coordinates as [number, number][];
    const d = tr === 'crevasse' ? `M${pts.map(([x, y]) => `${(x * W).toFixed(1)} ${(y * H).toFixed(1)}`).join('L')}` : smoothPath(pts, W, H);
    return { g, f, tr, d };
  }).sort((a, b) => a.f.minZoom - b.f.minZoom), [geos, W, H]);
  /** Boîtes englobantes des points (pour n'afficher que ce qui est à l'écran). */
  const pointGeos = useMemo(() => geos.filter((g) => g.type !== 'polyline').map((g) => {
    const pts = (g.type === 'point' ? [g.coordinates] : g.coordinates) as [number, number][];
    const xs = pts.map((p) => p[0] * W), ys = pts.map((p) => p[1] * H);
    return { g, f: features.get(g.featureId)!, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
  }), [geos, W, H]);

  // Arrivée : recentrer une seule fois par entrée d'historique.
  const focusPos = useMemo(() => {
    if (!focus) return null;
    if (focus.kind === 'anchor') { const a = anchors.find((x) => x.id === focus.id); return a ? a.at : null; }
    const g = geos.find((x) => x.featureId === focus.id && x.type === 'point');
    return g ? (g.coordinates as [number, number]) : null;
  }, [focus, anchors, geos]);
  useEffect(() => {
    if (!focusPos || !focusKey || appliedFocus.has(focusKey)) return;
    appliedFocus.add(focusKey); fresh.current = false;
    const f = focus?.kind === 'point' ? features.get(focus.id) : undefined;
    setT(fit(map, focusPos[0], focusPos[1], Math.max(1.7 * zf, (f?.minZoom ?? 0) + 0.3 * zf)));
  }, [focusKey, focusPos]);

  const toSvg = (cx: number, cy: number) => {
    const el = svg.current!; const p = el.createSVGPoint(); p.x = cx; p.y = cy;
    return p.matrixTransform(el.getScreenCTM()!.inverse());
  };
  const clampK = (k: number) => Math.min(maxK.current, Math.max(MIN_K, k));
  const zoomAt = (x: number, y: number, k2: number) => setT((o) => { const k = clampK(k2); return { k, tx: x - ((x - o.tx) * k) / o.k, ty: y - ((y - o.ty) * k) / o.k }; });
  const zoomBy = (f: number) => { fresh.current = false; setT((o) => { const k = clampK(o.k * f); const x = W / 2, y = H / 2; return { k, tx: x - ((x - o.tx) * k) / o.k, ty: y - ((y - o.ty) * k) / o.k }; }); };

  useEffect(() => {
    const el = svg.current; if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault(); fresh.current = false;
      const p = toSvg(e.clientX, e.clientY);
      setT((o) => { const k = clampK(o.k * Math.exp(-e.deltaY * 0.0015)); return { k, tx: p.x - ((p.x - o.tx) * k) / o.k, ty: p.y - ((p.y - o.ty) * k) / o.k }; });
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);

  const down = (e: RPointerEvent) => {
    fresh.current = false;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) travel.current = { x: e.clientX, y: e.clientY, dist: 0 };
    if (pointers.current.size === 2) { commitDrag(); const [a, b] = [...pointers.current.values()]; pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), k: t.k }; }
  };
  const move = (e: RPointerEvent) => {
    const prev = pointers.current.get(e.pointerId); if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    travel.current.dist += Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
    if (travel.current.dist > 6 && !(e.target as Element).hasPointerCapture?.(e.pointerId)) svg.current?.setPointerCapture(e.pointerId);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const c = toSvg((a.x + b.x) / 2, (a.y + b.y) / 2);
      zoomAt(c.x, c.y, pinch.current.k * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d)); return;
    }
    // Glisser : déplacement confié au compositeur (transformation CSS), validé au relâchement.
    const dr = drag.current; dr.x += e.clientX - prev.x; dr.y += e.clientY - prev.y;
    if (svg.current) svg.current.style.transform = `translate(${dr.x}px, ${dr.y}px)`;
  };
  const commitDrag = () => {
    const dr = drag.current; if (!dr.x && !dr.y) return;
    const sc = px; drag.current = { x: 0, y: 0, pending: true };
    setT((o) => ({ ...o, tx: o.tx + dr.x * sc, ty: o.ty + dr.y * sc }));
  };
  const up = (e: RPointerEvent) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) pinch.current = null; if (!pointers.current.size) commitDrag();
    // Clic sur le fond (pas sur un lieu, pas un glisser) : position dans le plan, en tenant compte du zoom et du décalage.
    if (onPlace && travel.current.dist <= 6 && !(e.target as Element).closest('[role="button"]')) {
      const c = toSvg(e.clientX, e.clientY);
      onPlace((c.x - t.tx) / t.k / W, (c.y - t.ty) / t.k / H);
    }
  };
  /** Un clic n'est valide que si le pointeur ne s'est presque pas déplacé (pas pendant un glisser). */
  const tap = (fn: () => void) => () => { if (travel.current.dist <= 6) fn(); };
  const selectRef = useRef(onSelect); selectRef.current = onSelect;

  // ——— Ce qui est à l'écran ———
  const rz = t.k / zf; // zoom ramené à l'échelle des plans saisis
  const vw = (view.w || 1300) * px, vh = (view.h || 800) * px;
  const m = 60 * px / t.k;
  const bx0 = (W / 2 - vw / 2 - t.tx) / t.k - m, by0 = (H / 2 - vh / 2 - t.ty) / t.k - m, bx1 = bx0 + vw / t.k + 2 * m, by1 = by0 + vh / t.k + 2 * m;
  const onScreen = (b: number[]) => b[2] >= bx0 && b[0] <= bx1 && b[3] >= by0 && b[1] <= by1;
  const visible = pointGeos.filter(({ f, box }) => t.k >= f.minZoom && !hidden.has(f.category) && onScreen(box));
  const points = layers.points ? visible.filter((v) => v.g.type === 'point').map((v) => v.g) : [];
  const areas = visible.filter((v) => v.g.type === 'polygon');
  const rank = { landmark: 0, regional: 1, local: 2, detail: 3 } as const;

  // Passages visibles à ce zoom (préfixe de la liste triée) : la couche n'est recalculée qu'au franchissement d'un seuil.
  let nPass = 0; while (nPass < passages.length && passages[nPass].f.minZoom <= t.k) nPass++;
  const hiddenKey = [...hidden].sort().join(',');
  // Les passages secrets sont des informations de MJ : invisibles hors mode MJ.
  const shown = useMemo(() => (layers.galeries ? passages.slice(0, nPass).filter((p) => !hidden.has(p.f.category) && (dm || p.tr !== 'secret')) : []), [passages, nPass, hiddenKey, layers.galeries, dm]);
  const kw = map.scope.kind === 'espace' ? 1.6 : map.scope.kind === 'site' ? 0.7 : 1;

  /** Roche, parois, sols : couches figées (ne dépendent ni du déplacement ni du zoom). */
  const rock = useMemo(() => {
    const litho = lithology(map.id.length * 131 + W, W, H, Math.round(160 * zf * zf));
    const floors = cavities.map((c) => cavityPath(c, W, H, 0, 44)).join('');
    const walls = cavities.map((c) => cavityPath(c, W, H, 7, 32)).join('');
    // Ombrage du sol : cœur plus clair, décalé vers la lumière, au lieu d'un dégradé par salle (bien plus léger).
    const light = cavities.map((c) => cavityPath({ ...c, cx: c.cx - c.rx * 0.08, cy: c.cy - c.ry * 0.1, rx: c.rx * 0.62, ry: c.ry * 0.55, seed: c.seed + 5 }, W, H, 0, 28)).join('');
    return { litho, floors, walls, light };
  }, [cavities, W, H]);
  const carved = shown.filter((p) => PASS_W[p.tr] > 0);
  const layerWalls = useMemo(() => (
    <g className="am-walls">
      <path d={rock.walls} fill={WALL} />
      {carved.map((p) => <path key={p.g.id} d={p.d} stroke={WALL} strokeWidth={PASS_W[p.tr] * kw + 14} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
    </g>
  ), [rock, shown]);
  const layerFloors = useMemo(() => (
    <g className="am-floors">
      {/* 1er passage : sols avec liseré de paroi ; 2e passage : sols seuls, qui effacent le liseré aux jonctions. */}
      <path d={rock.floors} fill={FLOOR} stroke={RIM} strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
      {carved.map((p) => <path key={p.g.id} d={p.d} className="rim" style={{ '--w': `${PASS_W[p.tr] * kw}px` } as React.CSSProperties} />)}
      <path d={rock.floors} fill={FLOOR} />
      <path d={rock.light} className="am-light" />
      {carved.map((p) => (
        <path key={p.g.id} d={p.d} className={`floor tr-${p.tr}`} stroke={FLOOR} strokeWidth={PASS_W[p.tr] * kw} fill="none" strokeLinecap="round" strokeLinejoin="round"
          onClick={tap(() => selectRef.current(p.f))} />
      ))}
      <path d={rock.floors} className="am-shade" vectorEffect="non-scaling-stroke" />
    </g>
  ), [rock, shown]);
  const layerLines = useMemo(() => (
    <g>
      {shown.filter((p) => p.tr === 'crevasse').map((p) => (
        <g key={p.g.id} className="am-crevasse" onClick={tap(() => selectRef.current(p.f))}>
          <path d={p.d} stroke="transparent" strokeWidth="12" vectorEffect="non-scaling-stroke" />
          <path d={p.d} stroke="#010203" strokeWidth={p.f.importance === 'regional' ? 6 : 3.5} />
          <path d={p.d} stroke="#77857f" strokeWidth=".7" opacity=".45" vectorEffect="non-scaling-stroke" transform="translate(1 -1)" />
        </g>
      ))}
      {shown.filter((p) => p.tr === 'ruisseau').map((p) => {
        const big = p.f.importance === 'regional';
        return (
          <g key={p.g.id} className="am-water-line" onClick={tap(() => selectRef.current(p.f))}>
            <path d={p.d} stroke="#111f21" strokeWidth={big ? 14 : 6} />
            <path d={p.d} stroke="#25403f" strokeWidth={big ? 9 : 3.6} />
            <path d={p.d} stroke="#5e8582" strokeWidth={big ? 1.6 : 0.8} opacity=".35" />
          </g>
        );
      })}
      {shown.filter((p) => p.tr === 'secret').map((p) => (
        <g key={p.g.id} className="am-secret" onClick={tap(() => selectRef.current(p.f))}>
          <path d={p.d} stroke="transparent" strokeWidth="14" vectorEffect="non-scaling-stroke" />
          <path d={p.d} stroke="#c49477" strokeWidth="1.4" strokeDasharray="0.5 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </g>
      ))}
    </g>
  ), [shown]);
  const reliefStep = Math.round(rz * 4) / 4;
  const layerSpeleo = useMemo(() => (reliefStep >= 2.25 ? circles(relief.dots, Math.min(1, 2.8 / reliefStep)) : ''), [relief, reliefStep]);
  const selPassage = selectedId ? passages.find((p) => p.f.id === selectedId) : undefined;

  // Anticollision : étiquettes posées par importance (grands noms d'abord), ignorées si elles chevauchent.
  const labelled = new Set<string>();
  if (layers.etiquettes) {
    const boxes: number[][] = [];
    const items = [
      ...anchors.filter(() => layers.connexions).map((a) => ({ id: a.id, at: a.at, w: a.label.length * 7 + 14, h: 11, dx: 24, r: -1, center: false })),
      ...points.map((g) => {
        const f = features.get(g.featureId)!; const fs = LBL_FS[f.importance];
        return f.area
          ? { id: g.id, at: g.coordinates as [number, number], w: f.title.length * fs * (f.importance === 'landmark' ? 0.95 : 0.55), h: fs * 0.8, dx: 0, r: rank[f.importance] - 0.5, center: true }
          : { id: g.id, at: g.coordinates as [number, number], w: f.title.length * fs * 0.54 + 8, h: fs * 0.8, dx: PIN_R[f.importance] + 7, r: rank[f.importance], center: false };
      }),
    ].sort((a, b) => a.r - b.r);
    for (const it of items) {
      const sx = it.at[0] * W * t.k + t.tx, sy = it.at[1] * H * t.k + t.ty;
      const w = it.w * px, h = it.h * px;
      const x0 = it.center ? sx - w / 2 : sx + it.dx * px;
      const box = [x0, sy - h, x0 + w, sy + h * (it.center ? 1 : 1.6)];
      if (boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      boxes.push(box); labelled.add(it.id);
    }
  }
  const s = px / t.k; // échelle des marqueurs : taille constante à l'écran
  const kind = map.scope.kind;
  const detailEmpty = rz >= 4.2 && !geos.some((g) => features.get(g.featureId)!.importance === 'detail');
  const fade = (from: number) => Math.min(1, Math.max(0, (rz - from) / 0.6));

  return (
    <div className="atlas-map">
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="application"
        aria-label={`${map.title} — glisser pour déplacer, molette ou pincement pour zoomer`}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <defs>
          <radialGradient id="am-floor" cx=".46" cy=".42" r=".62"><stop offset="0" stopColor="#2c3836" /><stop offset=".7" stopColor="#222d2c" /><stop offset="1" stopColor={FLOOR} /></radialGradient>
          <radialGradient id="am-floor-b" cx=".55" cy=".45" r=".62"><stop offset="0" stopColor="#2a3333" /><stop offset=".75" stopColor="#212a2a" /><stop offset="1" stopColor={FLOOR} /></radialGradient>
          <radialGradient id="am-water" cx=".45" cy=".4" r=".7"><stop offset="0" stopColor="#2f5a5e" /><stop offset="1" stopColor="#14282c" /></radialGradient>
          <pattern id="am-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><path d="M0 0V9" stroke="#8a5a49" strokeWidth="1.3" opacity=".55" /></pattern>
        </defs>
        <rect x={-W} y={-H} width={W * 3} height={H * 3} fill="#090d0e" />
        <g transform={`translate(${t.tx} ${t.ty}) scale(${t.k})`} style={{ '--rim': `${(2.4 * px) / t.k}px` } as React.CSSProperties}>
          <path d={rock.litho} stroke="#2b3536" strokeWidth=".8" fill="none" opacity=".55" />
          {layers.ambiance && map.ambiance && <image href={map.ambiance} x={0} y={0} width={W} height={H} preserveAspectRatio="xMidYMid slice" className="am-ambiance" />}
          <g className={layers.ambiance && map.ambiance ? 'am-caves see-through' : 'am-caves'}>
            {layerWalls}
            {layerFloors}
          </g>
          <path d={relief.contours} className="am-contour" vectorEffect="non-scaling-stroke" style={{ opacity: fade(1.3) * 0.8 }} />
          {layerSpeleo && <path d={layerSpeleo} className="am-speleo" style={{ opacity: fade(2.25) }} />}
          {rz >= 3.4 && <path d={relief.blocks} className="am-blocks" style={{ opacity: fade(3.4) }} />}
          {map.decor && <g className="am-decor">{map.decor.map((x, i) => <path key={i} d={x.d} className={`dc-${x.kind}`} />)}</g>}
          {houses.map((b, i) => (
            <g key={i} className="am-house"><rect x={b.x} y={b.y} width={b.w} height={b.h} rx="2" /><rect x={b.x + 4} y={b.y + 4} width={b.w * 0.76} height={b.h * 0.55} className="in" /></g>
          ))}
          {areas.map(({ g, f }) => {
            const pts = g.coordinates as [number, number][];
            const d = smoothPath([...pts, pts[0], pts[1]], W, H) + 'Z';
            return <path key={g.id} d={d} className={`am-area am-${f.category} ${selectedId === f.id ? 'is-sel' : ''}`} vectorEffect="non-scaling-stroke"
              onClick={tap(() => onSelect(f))} role="button" tabIndex={0} aria-label={f.title} onKeyDown={(e) => e.key === 'Enter' && onSelect(f)} />;
          })}
          {layerLines}
          {selPassage && <path d={selPassage.d} className="am-pass-sel" vectorEffect="non-scaling-stroke" />}
          {layers.connexions && anchors.map((a) => {
            const c = connectionAt(a.id);
            const down = c ? depthRank(c.other.mapId) > depthRank(map.id) : true;
            const blocked = c && !c.canFollow;
            const isFocus = focus?.kind === 'anchor' && focus.id === a.id;
            return (
              <g key={a.id} className={`am-pin am-anchor ${blocked ? 'blocked' : ''} ${isFocus ? 'is-focus' : ''} ${selectedId === a.id ? 'is-sel' : ''}`}
                transform={`translate(${a.at[0] * W} ${a.at[1] * H}) scale(${s})`} tabIndex={0} role="button"
                aria-label={`${a.label}${c ? ` — ${c.connection.title}${blocked ? ' (sens unique, arrivée)' : ''}` : ''}`}
                onClick={tap(() => onAnchor(a))} onKeyDown={(e) => e.key === 'Enter' && onAnchor(a)}>
                <circle r="15" className="disc" />
                <circle r="10" className="glow" />
                <text y="6" textAnchor="middle" className="glyph">{blocked ? '⊘' : down ? '↧' : '↥'}</text>
                {labelled.has(a.id) && <><text x="23" y="4" className="lbl">{a.label}</text>{c && <text x="23" y="19" className="sub">{c.connection.title}</text>}</>}
              </g>
            );
          })}
          {points.filter((g) => features.get(g.featureId)!.area && labelled.has(g.id)).map((g) => {
            const f = features.get(g.featureId)!; const [x, y] = g.coordinates as [number, number];
            return (
              <text key={g.id} className={`am-area-label imp-${f.importance} ${selectedId === f.id ? 'is-sel' : ''}`} textAnchor="middle"
                transform={`translate(${x * W} ${y * H}) scale(${s})`} onClick={tap(() => onSelect(f))}>{f.title}</text>
            );
          })}
          {points.filter((g) => !features.get(g.featureId)!.area).map((g) => {
            const f = features.get(g.featureId)!; const [x, y] = g.coordinates as [number, number]; const cat = CATEGORIES[f.category];
            const isFocus = focus?.kind === 'point' && focus.id === f.id; const R = PIN_R[f.importance];
            return (
              <g key={g.id} className={`am-pin imp-${f.importance} ${selectedId === f.id ? 'is-sel' : ''} ${isFocus ? 'is-focus' : ''}`} style={{ '--c': cat.color } as React.CSSProperties}
                transform={`translate(${x * W} ${y * H}) scale(${s})`} tabIndex={0} role="button" aria-label={`${f.title} — ${f.category === 'cite' && f.people ? peopleOf(f.people)!.label : cat.label}`}
                onClick={tap(() => onSelect(f))} onKeyDown={(e) => e.key === 'Enter' && onSelect(f)}>
                {f.importance === 'detail' && <circle r="12" className="hit" />}
                {f.category === 'cite' && f.people ? <CityEmblem people={f.people} R={R * 1.25} id={f.id} variant={f.emblem} /> : <>
                  <circle r={R} className="disc" />
                  {f.importance !== 'detail' && <><circle r={R * 0.7} className="glow" /><text y={R * 0.33} textAnchor="middle" className="glyph" style={{ fontSize: R * 0.92 }}>{cat.glyph}</text></>}
                </>}
                {labelled.has(g.id) && (() => { const lx = f.category === 'cite' && paintedEmblem(f.people) ? R * 2.2 + 6 : R + 7; return <><text x={lx} y="4" className="lbl">{f.title}</text>{f.subtitle && <text x={lx} y="19" className="sub">{f.subtitle}</text>}</>; })()}
              </g>
            );
          })}
          {fog && (
            <g className="am-fog" pointerEvents="none">
              <defs>
                <radialGradient id="am-fog-hole">
                  <stop offset="0" stopColor="#000" />
                  <stop offset=".55" stopColor="#000" />
                  <stop offset="1" stopColor="#000" stopOpacity="0" />
                </radialGradient>
                {/* Noir : tout sauf le découvert et la vision. Voile : tout sauf la vision. */}
                <mask id="am-fog-dark" maskUnits="userSpaceOnUse" x={-W} y={-H} width={W * 3} height={H * 3}>
                  <rect x={-W} y={-H} width={W * 3} height={H * 3} fill="#fff" />
                  {fog.explored.map(([x, y], i) => <circle key={`e${i}`} cx={x * W} cy={y * H} r={fog.er * W} fill="url(#am-fog-hole)" />)}
                  {vision.map(([x, y], i) => <circle key={`v${i}`} cx={x * W} cy={y * H} r={fog.r * W} fill="url(#am-fog-hole)" />)}
                </mask>
                <mask id="am-fog-dim" maskUnits="userSpaceOnUse" x={-W} y={-H} width={W * 3} height={H * 3}>
                  <rect x={-W} y={-H} width={W * 3} height={H * 3} fill="#fff" />
                  {vision.map(([x, y], i) => <circle key={`v${i}`} cx={x * W} cy={y * H} r={fog.r * W} fill="url(#am-fog-hole)" />)}
                </mask>
              </defs>
              <rect x={-W} y={-H} width={W * 3} height={H * 3} fill="#030404" opacity={0.985} mask="url(#am-fog-dark)" />
              <rect x={-W} y={-H} width={W * 3} height={H * 3} fill="#04060a" opacity={0.55} mask="url(#am-fog-dim)" />
            </g>
          )}
          {walker && (
            <g className="am-mark am-mark-party am-walker" transform={`translate(${walker[0] * W} ${walker[1] * H}) scale(${s})`} pointerEvents="none">
              <circle r={24} className="am-mark-ring" />
              <circle r={7} className="am-mark-dot" />
              {journey?.label && (
                <g transform="translate(0 -34)">
                  <rect x={-(journey.label.length * 3.6 + 10)} y={-11} width={journey.label.length * 7.2 + 20} height={20} rx={10} className="am-mark-flag" />
                  <text textAnchor="middle" y={4} className="am-mark-text">{journey.label}</text>
                </g>
              )}
            </g>
          )}
          {shownMarks.map((m) => (
            <g key={m.id} className={`am-mark am-mark-${m.tone}`} transform={`translate(${m.x * W} ${m.y * H}) scale(${s})`} pointerEvents="none">
              <circle r={24} className="am-mark-ring" />
              <circle r={6} className="am-mark-dot" />
              <g transform="translate(0 -34)">
                <rect x={-(m.label.length * 3.6 + 10)} y={-11} width={m.label.length * 7.2 + 20} height={20} rx={10} className="am-mark-flag" />
                <text textAnchor="middle" y={4} className="am-mark-text">{m.label}</text>
              </g>
            </g>
          ))}
        </g>
      </svg>
      <div className="am-grain" aria-hidden style={{ backgroundImage: `url(${grain()})` }} />
      <div className="atlas-tools" role="group" aria-label="Zoom">
        <button onClick={() => zoomBy(1.35)} aria-label="Zoom avant">+</button>
        <button onClick={() => zoomBy(1 / 1.35)} aria-label="Zoom arrière">−</button>
        <button onClick={() => setT(home())} aria-label="Recentrer" title="Recentrer">⌖</button>
      </div>
      <div className="atlas-density">Échelle : <b>{densityOf(rz).label}</b> · ×{rz.toFixed(1)}</div>
      {detailEmpty && <div className="atlas-empty-scale">Aucun relevé plus précis disponible.</div>}
      {kind !== 'site' && !fog && <MiniMap map={map} t={t} />}
      <VisibleList points={points.map((g) => features.get(g.featureId)!)} onSelect={onSelect} />
    </div>
  );
}

/** Mini-carte : cavités de la carte et cadre de la zone visible. */
function MiniMap({ map, t }: { map: AtlasMap; t: T }) {
  const W = map.width, H = map.height;
  const x = -t.tx / t.k, y = -t.ty / t.k, w = W / t.k, h = H / t.k;
  const base = useMemo(() => (
    <>
      <path d={cavitiesOf(map.id).map((c) => cavityPath(c, W, H, 0, 20)).join('')} fill="#4a5a58" />
      {geometriesOn(map.id).filter((g) => g.type === 'polyline' && ['landmark', 'regional'].includes(features.get(g.featureId)!.importance) && features.get(g.featureId)!.trace !== 'crevasse')
        .map((g) => <path key={g.id} d={smoothPath(g.coordinates as [number, number][], W, H)} fill="none" stroke={features.get(g.featureId)!.trace === 'ruisseau' ? '#5d8a8b' : '#4a5a58'} strokeWidth={W / 120} />)}
    </>
  ), [map.id, W, H]);
  return (
    <div className="atlas-minimap" aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`}>
        {base}
        <rect x={Math.max(0, x)} y={Math.max(0, y)} width={Math.max(0, Math.min(W, x + w) - Math.max(0, x))} height={Math.max(0, Math.min(H, y + h) - Math.max(0, y))} className="frame" style={{ strokeWidth: W / 140 }} />
      </svg>
      <span>Position dans le plan</span>
    </div>
  );
}

/** Alternative textuelle des lieux visibles (clavier, lecteur d'écran). */
function VisibleList({ points, onSelect }: { points: AtlasFeature[]; onSelect: (f: AtlasFeature) => void }) {
  return (
    <details className="atlas-visible">
      <summary>Lieux visibles ({points.length})</summary>
      <ul>{points.map((f) => <li key={f.id}><button className="linklike" onClick={() => onSelect(f)}>{f.title}</button> <small>{CATEGORIES[f.category].label}</small></li>)}</ul>
    </details>
  );
}
