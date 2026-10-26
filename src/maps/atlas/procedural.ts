/**
 * Enrichissement procédural (déterministe) des plans de DÉMONSTRATION.
 *
 * À partir des cavités et repères saisis à la main, chaque plan reçoit :
 *  - des cavités supplémentaires dans les vides de roche ;
 *  - un réseau de galeries (arbre couvrant + boucles) hiérarchisé : galeries, boyaux, passages étroits, diverticules ;
 *  - des noms de salles (étiquettes de zone), des points locaux et des micro-repères,
 *    révélés progressivement selon le zoom (comme une vraie carte : les grands noms d'abord, le détail ensuite).
 *
 * Tout ce qui est produit ici est fictif (`demo: true`, canonStatus « creation », placement « illustrative »).
 */
import type { AtlasAnchor, AtlasConnection, AtlasData, AtlasFeature, AtlasGeometry, Cavity, FeatureCategory, Importance, Trace } from './types';

/** Dimensions du plan en cours de génération (unités de plan). */
let W = 1240, H = 755;
/** Les strates sont 4 × 4 = 16 fois plus vastes que les plans saisis à la main, qui en occupent le centre. */
export const STRATA_SCALE = 4;
const D = { canonStatus: 'creation' as const, placementStatus: 'illustrative' as const, demo: true };
const NOTE = 'Repère de démonstration (fictif) : il sert à éprouver la lecture progressive de la carte. Ce n’est pas du lore canonique.';

function rng(seed: number) { let z = (seed * 2654435761) >>> 0; return () => ((z = (1664525 * z + 1013904223) >>> 0) / 4294967296); }
const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length)];
function shuffled<T>(r: () => number, a: T[]) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

/** Noms de salles et de secteurs (neutres, descriptifs). */
const SECTORS = ['Les Orgues', 'Le Labyrinthe', 'Les Hautes Voûtes', 'Le Dédale gris', 'Les Cuves', 'La Grande Fracture', 'Les Basses Salles', 'Le Pays des Gours',
  'Les Draperies', 'La Forêt minérale', 'Les Marches noires', 'Le Grand Effondrement', 'Les Boyaux du Nord', 'La Combe froide', 'Les Mille Piliers', 'Le Val de Cendre',
  'Les Fosses jumelles', 'La Lande de sel', 'Les Terrasses', 'Le Pays creux', 'Les Veines rouges', 'La Rive morte', 'Les Échelles', 'Le Seuil'];
const HALL_A = ['Salle', 'Grotte', 'Chambre', 'Nef', 'Voûte', 'Caverne', 'Dôme', 'Rotonde', 'Cuve', 'Puits', 'Abri', 'Crypte', 'Combe', 'Fosse'];
const HALL_B = ['des Échos', 'aux Orgues', 'des Brumes', 'des Colonnes', 'Basse', 'du Ressac', 'Fendue', 'aux Cristaux', 'des Stalactites', 'Aveugle', 'Ocre',
  'du Vent froid', 'Noyée', 'Grise', 'des Lichens', 'Rouge', 'Sèche', 'Longue', 'Jumelle', 'Effondrée', 'des Racines', 'aux Chiroptères', 'Tiède', 'du Silence',
  'des Cendres', 'Morte', 'Étroite', 'Haute', 'Bleue', 'aux Piliers', 'du Sel', 'des Soupirs', 'Blanche', 'aux Os', 'Fourchue', 'du Gué', 'Close', 'des Draperies',
  'Oblique', 'Ferreuse', 'des Gours', 'du Guetteur', 'des Pendus', 'Penchée', 'Sonore', 'Humide', 'aux Ombres', 'du Puisatier', 'des Veilleurs', 'Brisée',
  'aux Sources', 'des Vers', 'de l’Ermite', 'du Fondeur', 'Torse', 'Calme', 'aux Mille Gouttes', 'du Coude', 'de la Dalle', 'du Carrefour'];

type Spot = { title: string; category: FeatureCategory };
const S = (category: FeatureCategory, ...titles: string[]) => titles.map((title) => ({ title, category }));
/** Repères notables (échelle régionale). */
const NOTABLE: Spot[] = [
  ...S('eau', 'Lac sans fond', 'Rivière souterraine', 'Grande résurgence', 'Cascade intérieure'),
  ...S('danger', 'Gouffre', 'Faille fumante', 'Champ d’éboulis', 'Plafond effondré'),
  ...S('ressource', 'Carrière ancienne', 'Grand gisement de fer', 'Veine de cristal'),
  ...S('ruine', 'Comptoir abandonné', 'Fortin en ruine', 'Pont naturel'),
  ...S('vivant', 'Forêt de champignons géants', 'Colonie de chiroptères'),
  ...S('sanctuaire', 'Cercle de pierres levées', 'Autel oublié'),
];
/** Points locaux. */
const LOCAL: Spot[] = [
  ...S('eau', 'Source tiède', 'Résurgence', 'Vasque claire', 'Suintement', 'Puits d’eau', 'Gour profond', 'Mare d’infiltration'),
  ...S('vivant', 'Champignonnière', 'Lichen luisant', 'Nid de rothés', 'Mousse phosphorescente', 'Toiles anciennes', 'Terrier de vers'),
  ...S('ressource', 'Filon de fer', 'Affleurement de salpêtre', 'Filon d’argent pâle', 'Dépôt de soufre', 'Argile fine'),
  ...S('ruine', 'Campement abandonné', 'Muret écroulé', 'Ancien poste', 'Escalier taillé', 'Arche brisée'),
  ...S('sanctuaire', 'Niche votive', 'Pierre levée', 'Bas-relief effacé'),
  ...S('danger', 'Éboulis instable', 'Poche de gaz', 'Corniche glissante', 'Plafond fissuré', 'Trou souffleur'),
  ...S('garde', 'Poste de guet', 'Cache de vivres', 'Abri sous roche', 'Barricade'),
  ...S('grotte', 'Cheminée', 'Siphon', 'Salle annexe', 'Lucarne'),
];
/** Micro-repères (échelle de détail). */
const DETAIL: Spot[] = [
  ...S('indetermine', 'Cairn', 'Inscription gravée', 'Marque de passage', 'Empreintes', 'Galets polis', 'Fente d’aération', 'Coquilles fossiles'),
  ...S('ruine', 'Foyer éteint', 'Corde pourrie', 'Cristal-lueur brisé', 'Piton planté', 'Tas de scories', 'Outil rouillé'),
  ...S('vivant', 'Ossements', 'Crâne de rothé', 'Racine pendante', 'Mue de reptile', 'Guano'),
  ...S('eau', 'Flaque', 'Goutte-à-goutte', 'Cupule d’eau'),
  ...S('ressource', 'Cristal isolé', 'Pépite', 'Géode ouverte'),
  ...S('danger', 'Fissure fraîche', 'Pierre branlante'),
];
/** Lieux d'un site habité (paliers). */
const TOWN_LOCAL: Spot[] = [
  ...S('institution', 'Corps de garde', 'Maison commune', 'Greffe'), ...S('ressource', 'Forge', 'Entrepôt', 'Étals', 'Tannerie'),
  ...S('eau', 'Fontaine', 'Puits'), ...S('sanctuaire', 'Autel domestique'), ...S('vivant', 'Jardin de champignons'),
];
const TOWN_DETAIL: Spot[] = [
  ...S('ruine', 'Charrette renversée', 'Échafaudage', 'Lanterne de rue', 'Borne'), ...S('indetermine', 'Enseigne', 'Statue usée', 'Escalier extérieur'),
  ...S('eau', 'Abreuvoir', 'Rigole'), ...S('vivant', 'Enclos à rothés'),
];
const LANDMARKS: Record<string, Spot[]> = {
  'carte-n1-s1': [{ title: 'Halte des Lueurs', category: 'garde' }, { title: 'Grande Voûte', category: 'grotte' }],
  'carte-n1-s2': [{ title: 'Lac Sombre', category: 'eau' }, { title: 'Forêt minérale', category: 'vivant' }],
  'carte-n1-s4': [{ title: 'Gouffre de la Fosse', category: 'danger' }, { title: 'Ancien Comptoir', category: 'ruine' }],
  'carte-n1-s5': [{ title: 'Lac Profond', category: 'eau' }, { title: 'Faille Ardente', category: 'danger' }],
};

const P = (x: number, y: number): [number, number] => [+(Math.min(W - 4, Math.max(4, x)) / W).toFixed(5), +(Math.min(H - 4, Math.max(4, y)) / H).toFixed(5)];
/** Ellipses en unités de plan. */
type E = { x: number; y: number; rx: number; ry: number };
const toE = (c: Cavity): E => ({ x: c.cx * W, y: c.cy * H, rx: c.rx * W, ry: c.ry * H });

/** Grille d'occupation : évite de poser deux repères au même endroit sans tout comparer. */
class Taken {
  private cells = new Map<string, [number, number][]>();
  constructor(private size = 80) {}
  add(x: number, y: number) { const k = `${Math.floor(x / this.size)},${Math.floor(y / this.size)}`; (this.cells.get(k) ?? this.cells.set(k, []).get(k)!).push([x, y]); }
  free(x: number, y: number, d: number) {
    const cx = Math.floor(x / this.size), cy = Math.floor(y / this.size), n = Math.ceil(d / this.size);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (const [px, py] of this.cells.get(`${cx + i},${cy + j}`) ?? []) if (Math.hypot(px - x, py - y) < d) return false;
    return true;
  }
}

/**
 * Entre-strates supplémentaires (démonstration) : plusieurs entre deux mêmes strates, et des entre-entre-strates
 * imbriquées (entre une strate et une entre-strate, voire entre deux espaces de transit).
 * Les passages y sont difficiles : escalade, reptation, siphons, air vicié…
 */
type Extra = {
  id: string; name: string; up: string; down: string; depth: number; nesting: number; description: string;
  upKind: AtlasConnection['kind']; downKind: AtlasConnection['kind']; difficulty: [1 | 2 | 3 | 4, 1 | 2 | 3 | 4]; hazards: [string[], string[]]; oneWay?: boolean;
};
const EXTRA: Extra[] = [
  { id: 'entre-i1-i2', name: 'Entre-strate I-1 / I-2', up: 'n1-strate-1', down: 'n1-strate-2', depth: 1.5, nesting: 1, description: 'Cheminées et ressauts verticaux : on y progresse à la corde.',
    upKind: 'puits', downKind: 'naturel', difficulty: [3, 2], hazards: [['Puits de 12 m à la corde', 'Parois suintantes'], ['Ressaut glissant', 'Étroiture']] },
  { id: 'entre-i2-i3', name: 'Entre-strate I-2 / I-3 (ouest)', up: 'n1-strate-2', down: 'n1-strate-3', depth: 2.42, nesting: 1, description: 'Laminoirs bas où l’on rampe sur des centaines de pas.',
    upKind: 'tunnel', downKind: 'naturel', difficulty: [3, 3], hazards: [['Laminoir : reptation', 'Air rare'], ['Étroiture sévère', 'Boue collante']] },
  { id: 'entre-i2-i3-b', name: 'Entre-strate I-2 / I-3 (est)', up: 'n1-strate-2', down: 'n1-strate-3', depth: 2.58, nesting: 1, description: 'Réseau noyé : deux siphons à franchir en apnée.',
    upKind: 'naturel', downKind: 'naturel', difficulty: [2, 4], hazards: [['Vasque froide', 'Courant'], ['Siphon de 6 m en apnée', 'Second siphon', 'Obscurité totale']] },
  { id: 'entre-i4-i5', name: 'Entre-strate I-4 / I-5', up: 'n1-strate-4', down: 'n1-strate-5', depth: 4.5, nesting: 1, description: 'Failles chaudes et air vicié : un passage que l’on ne franchit pas sans préparation.',
    upKind: 'naturel', downKind: 'puits', difficulty: [3, 4], hazards: [['Faille chaude', 'Vapeurs'], ['Air vicié', 'Puits de 20 m', 'Roche friable']] },
  { id: 'entre-i1-e12', name: 'Entre-entre-strate I-1 / (I-1·I-2)', up: 'n1-strate-1', down: 'entre-i1-i2', depth: 1.25, nesting: 2, description: 'Poche intermédiaire, au-dessus de l’entre-strate I-1 / I-2 ; on y tombe par un puits étroit sans retour.',
    upKind: 'puits', downKind: 'naturel', difficulty: [4, 3], hazards: [['Chute dans un puits étroit', 'Aucune remontée'], ['Boyau en pente', 'Pierres roulantes']], oneWay: true },
  { id: 'entre-e34-i4', name: 'Entre-entre-strate (I-3·I-4) / I-4', up: 'entre-i3-i4', down: 'n1-strate-4', depth: 3.75, nesting: 2, description: 'Boyau de contournement sous l’alcôve de garde : on évite le poste, au prix d’une longue reptation.',
    upKind: 'naturel', downKind: 'naturel', difficulty: [3, 3], hazards: [['Reptation sous plafond bas', 'Silence obligé (garde proche)'], ['Étroiture', 'Ressaut de 4 m']] },
  { id: 'entre-e34-poche', name: 'Poche profonde (entre-entre-entre-strate)', up: 'entre-e34-i4', down: 'n1-strate-4', depth: 3.88, nesting: 3, description: 'Cavité minuscule nichée sous l’entre-entre-strate ; on n’y accède qu’en désescalade.',
    upKind: 'naturel', downKind: 'naturel', difficulty: [4, 4], hazards: [['Désescalade sans prise', 'Roche coupante'], ['Siphon temporaire', 'Étroiture extrême']] },
  { id: 'entre-e45-i5', name: 'Entre-entre-strate (I-4·I-5) / I-5', up: 'entre-i4-i5', down: 'n1-strate-5', depth: 4.75, nesting: 2, description: 'Galerie de lave refroidie, encore tiède.',
    upKind: 'naturel', downKind: 'tunnel', difficulty: [2, 3], hazards: [['Sol coupant', 'Chaleur'], ['Gaz par intermittence']] },
];
const HAZARD_PINS = ['Étroiture', 'Ressaut', 'Siphon', 'Laminoir', 'Puits à corde', 'Trémie instable', 'Air vicié', 'Désescalade', 'Vasque profonde', 'Boue collante', 'Chatière'];

export function enrich(base: AtlasData): AtlasData {
  const Z = STRATA_SCALE;
  const bigIds = new Set(base.maps.filter((m) => m.demo && m.scope.kind === 'strate').map((m) => m.id));
  const shrink = (v: number) => 0.5 + (v - 0.5) / Z;
  // Les plans saisis à la main deviennent la région centrale d'une strate 16 fois plus vaste.
  const d: AtlasData = {
    ...base,
    maps: base.maps.map((m) => (bigIds.has(m.id) ? { ...m, width: m.width * Z, height: m.height * Z } : m)),
    cavities: Object.fromEntries(Object.entries(base.cavities).map(([id, cs]) => [id, bigIds.has(id) ? cs.map((c) => ({ ...c, cx: shrink(c.cx), cy: shrink(c.cy), rx: c.rx / Z, ry: c.ry / Z })) : cs])),
    geometries: base.geometries.map((g) => {
      if (!bigIds.has(g.mapId)) return g;
      const f = ([x, y]: [number, number]): [number, number] => [shrink(x), shrink(y)];
      return { ...g, coordinates: g.type === 'point' ? f(g.coordinates as [number, number]) : (g.coordinates as [number, number][]).map(f) };
    }),
    anchors: base.anchors.map((a) => (bigIds.has(a.mapId) ? { ...a, at: [shrink(a.at[0]), shrink(a.at[1])] as [number, number] } : a)),
    features: [],
  };
  const onBig = new Set(d.geometries.filter((g) => bigIds.has(g.mapId)).map((g) => g.featureId));
  d.features = base.features.map((f) => (onBig.has(f.id) && f.minZoom ? { ...f, minZoom: f.minZoom * Z } : f));

  // Entre-strates supplémentaires : espaces, plans, connexions ; les ancres sont posées une fois les cavités connues.
  d.spaces = [...base.spaces]; d.maps = [...d.maps]; d.connections = [...base.connections]; d.anchors = [...d.anchors];
  const mapOf = (ref: string) => d.strata.find((x) => x.id === ref)?.mapId ?? d.spaces.find((x) => x.id === ref)?.mapId ?? '';
  const nameOf = (ref: string) => d.strata.find((x) => x.id === ref)?.title ?? d.spaces.find((x) => x.id === ref)?.name ?? ref;
  const strataOfRef = (ref: string): string[] => d.strata.some((x) => x.id === ref) ? [ref] : d.spaces.find((x) => x.id === ref)?.stratumIds ?? [];
  /** Ancres à poser : carte → [id, libellé, rôle]. */
  const planned = new Map<string, { id: string; label: string; role: 'in' | 'out' | 'side' }[]>();
  const plan = (mapId: string, a: { id: string; label: string; role: 'in' | 'out' | 'side' }) => (planned.get(mapId) ?? planned.set(mapId, []).get(mapId)!).push(a);
  for (const x of EXTRA) {
    const mapId = `carte-${x.id}`;
    const st = [...new Set([...strataOfRef(x.up), ...strataOfRef(x.down)])];
    d.spaces.push({ id: x.id, kind: 'entre-strate', name: x.name, levelId: 'niveau-1', stratumIds: [st[0], st[st.length - 1]], mapId, description: x.description, depth: x.depth, nesting: x.nesting, between: [x.up, x.down], demo: true });
    d.maps.push({ id: mapId, title: `Mini-plan · ${x.name}`, scope: { kind: 'espace', id: x.id }, width: 1240, height: 755, defaultViewport: { x: 0.5, y: 0.5, zoom: 1 }, demo: true });
  }
  for (const x of EXTRA) {
    const mapId = `carte-${x.id}`;
    plan(mapOf(x.up), { id: `a-${x.id}-src`, label: `Vers ${x.name}`, role: 'side' });
    plan(mapId, { id: `a-${x.id}-in`, label: `Entrée · depuis ${nameOf(x.up)}`, role: 'in' });
    plan(mapId, { id: `a-${x.id}-out`, label: `Sortie · vers ${nameOf(x.down)}`, role: 'out' });
    plan(mapOf(x.down), { id: `a-${x.id}-dst`, label: `Débouché de ${x.name}`, role: 'side' });
    const conn = (id: string, from: string, to: string, kind: AtlasConnection['kind'], k: 0 | 1, dir: 'both' | 'forward'): AtlasConnection => ({
      id, kind, fromAnchorId: from, toAnchorId: to, direction: dir, title: k === 0 ? `Accès à ${x.name}` : `Sortie de ${x.name}`,
      note: x.description, difficulty: x.difficulty[k], hazards: x.hazards[k], ...D,
    });
    d.connections.push(conn(`c-${x.id}-haut`, `a-${x.id}-src`, `a-${x.id}-in`, x.upKind, 0, x.oneWay ? 'forward' : 'both'));
    d.connections.push(conn(`c-${x.id}-bas`, `a-${x.id}-out`, `a-${x.id}-dst`, x.downKind, 1, 'both'));
  }
  const extraMaps = new Set(EXTRA.map((x) => `carte-${x.id}`));

  const add = (f: Omit<AtlasFeature, 'canonStatus' | 'placementStatus'>, g: Omit<AtlasGeometry, 'id' | 'featureId'>) => {
    d.features.push({ ...D, summary: NOTE, ...f } as AtlasFeature);
    d.geometries.push({ id: `g-${f.id}`, featureId: f.id, ...g });
  };

  d.maps.filter((m) => m.demo).forEach((m, mi) => {
    W = m.width; H = m.height;
    const r = rng(1000 + mi * 97);
    const kind = m.scope.kind, big = bigIds.has(m.id), town = kind === 'site';
    /** Seuil de zoom exprimé à l'échelle des plans saisis (×1 = plan d'origine). */
    const zf = big ? Z : 1;
    const zoom = (rz: number) => +(rz * zf).toFixed(2);
    const cavs = [...(d.cavities[m.id] ?? [])];
    const handmade = cavs.length;

    // 1. Cavités : quelques grandes salles, beaucoup de petites.
    const fresh = extraMaps.has(m.id);
    const target = big ? 250 : fresh ? 20 : kind === 'espace' ? 6 : handmade;
    for (let t = 0; t < 12000 && cavs.length < target; t++) {
      const huge = big && r() < 0.06;
      const rx = big ? (huge ? 180 + r() * 130 : 38 + r() ** 1.8 * 150) : fresh ? 22 + r() ** 1.5 * 60 : 35 + r() * 40, ry = rx * (0.5 + r() * 0.4);
      const x = 50 + rx + r() * (W - 100 - 2 * rx), y = 50 + ry + r() * (H - 100 - 2 * ry);
      const ok = cavs.every((c) => { const e = toE(c); return ((x - e.x) / (rx + e.rx)) ** 2 + ((y - e.y) / (ry + e.ry)) ** 2 > 0.6; });
      if (ok) cavs.push({ cx: x / W, cy: y / H, rx: rx / W, ry: ry / H, seed: 200 + mi * 997 + cavs.length, tone: r() < 0.3 ? 1 : 0 });
    }
    d.cavities[m.id] = cavs;
    const ells = cavs.map(toE);
    const n = ells.length;
    const dist = (i: number, j: number) => Math.hypot(ells[i].x - ells[j].x, ells[i].y - ells[j].y);
    const nearCache = new Map<number, number[]>();
    const nearest = (i: number) => nearCache.get(i) ?? nearCache.set(i, [...Array(n).keys()].filter((j) => j !== i).sort((a, b) => dist(i, a) - dist(i, b)).slice(0, 8)).get(i)!;

    // Ancres des entre-strates : entrée en haut, sortie en bas, accès latéraux dans une cavité libre.
    const used0 = new Set<number>(); const anchorAt = (i: number): [number, number] => [+(Math.min(0.94, Math.max(0.06, (ells[i].x + (r() - 0.5) * ells[i].rx * 0.3) / W))).toFixed(5), +(Math.min(0.9, Math.max(0.16, ells[i].y / H))).toFixed(5)];
    for (const a of planned.get(m.id) ?? []) {
      const pool = [...ells.keys()].filter((i) => !used0.has(i) && (i >= handmade || n === handmade));
      const byY = [...pool].sort((p, q) => ells[p].y - ells[q].y);
      const i = a.role === 'in' ? byY[0] : a.role === 'out' ? byY[byY.length - 1] : pool[Math.floor(r() * pool.length)];
      if (i == null) continue; used0.add(i);
      d.anchors.push({ id: a.id, mapId: m.id, at: anchorAt(i), label: a.label } as AtlasAnchor);
    }
    const taken = new Taken();
    d.geometries.filter((g) => g.mapId === m.id && g.type === 'point').forEach((g) => taken.add((g.coordinates as number[])[0] * W, (g.coordinates as number[])[1] * H));
    d.anchors.filter((a) => a.mapId === m.id).forEach((a) => taken.add(a.at[0] * W, a.at[1] * H));
    const place = (e: E, minDist: number, spread = 0.75): [number, number] | null => {
      for (let t = 0; t < 30; t++) {
        const a = r() * Math.PI * 2, k = Math.sqrt(r()) * spread;
        const x = e.x + Math.cos(a) * e.rx * k, y = e.y + Math.sin(a) * e.ry * k;
        if (taken.free(x, y, minDist)) { taken.add(x, y); return [x, y]; }
      }
      return null;
    };
    const line = (id: string, title: string, t: Trace, imp: Importance, minZoom: number, pts: [number, number][], summary: string, category: FeatureCategory = 'voie') =>
      add({ id: `${m.id}-${id}`, title, category, importance: imp, minZoom, trace: t, summary: `${summary} ${NOTE}` }, { mapId: m.id, type: 'polyline', coordinates: pts.map(([x, y]) => P(x, y)) });
    const curve = (A: { x: number; y: number }, B: { x: number; y: number }, bend: number, steps = 3): [number, number][] => {
      const len = Math.hypot(B.x - A.x, B.y - A.y) || 1, nx = -(B.y - A.y) / len, ny = (B.x - A.x) / len; const pts: [number, number][] = [[A.x, A.y]];
      for (let q = 1; q <= steps; q++) { const t = q / (steps + 1), o = (r() - 0.5) * len * bend; pts.push([A.x + (B.x - A.x) * t + nx * o, A.y + (B.y - A.y) * t + ny * o]); }
      pts.push([B.x, B.y]); return pts;
    };

    // 2. Réseau : arbre couvrant (Prim), puis boucles vers les voisins proches.
    if (n > 1) {
      const inTree = new Array(n).fill(false), best = new Array(n).fill(Infinity), from = new Array(n).fill(-1);
      const edges: [number, number, number][] = []; best[0] = 0;
      for (let it = 0; it < n; it++) {
        let u = -1; for (let i = 0; i < n; i++) if (!inTree[i] && (u < 0 || best[i] < best[u])) u = i;
        inTree[u] = true; if (from[u] >= 0) edges.push([from[u], u, 0]);
        for (let v = 0; v < n; v++) if (!inTree[v]) { const dd = dist(u, v); if (dd < best[v]) { best[v] = dd; from[v] = u; } }
      }
      const has = new Set(edges.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));
      for (let i = 0; i < n; i++) {
        const near = nearest(i);
        for (const [j, prob] of [[near[0], 0.5], [near[1], 0.7], [near[2], 0.4], [near[3], 0.18]] as const) {
          const key = j == null ? '' : `${Math.min(i, j)}-${Math.max(i, j)}`;
          if (j != null && r() < prob && !has.has(key)) { has.add(key); edges.push([i, j, 1]); }
        }
      }
      edges.forEach(([i, j, loop], k) => {
        if (i < handmade && j < handmade) return; // déjà reliées par les galeries saisies
        const A = ells[i], B = ells[j];
        const major = !loop && (Math.min(A.rx, B.rx) > (big ? 105 : 80) || (big && Math.max(A.rx, B.rx) > 160));
        const t: Trace = major ? 'galerie' : loop ? 'etroit' : 'boyau';
        line(`gal-${k}`, major ? 'Galerie' : loop ? 'Passage étroit' : 'Boyau', t, major ? 'regional' : loop ? 'detail' : 'local', zoom(major ? 0.45 : loop ? 2 : 1), curve(A, B, 0.28, 2),
          major ? 'Galerie large, praticable à plusieurs de front.' : loop ? 'Passage où l’on avance de profil.' : 'Boyau bas : on y progresse courbé.');
      });
      // Diverticules : courts culs-de-sac.
      if (!town) ells.forEach((e, i) => {
        if (r() > 0.55) return;
        const a = r() * Math.PI * 2; let x = e.x + Math.cos(a) * e.rx * 0.7, y = e.y + Math.sin(a) * e.ry * 0.7;
        const pts: [number, number][] = [[x, y]];
        for (let s2 = 0; s2 < 3 + Math.floor(r() * 3); s2++) { x += Math.cos(a + (r() - 0.5) * 1.2) * 35; y += Math.sin(a + (r() - 0.5) * 1.2) * 30; pts.push([x, y]); }
        line(`div-${i}`, 'Diverticule', 'boyau', 'detail', zoom(2.6), pts, 'Cul-de-sac étroit.');
      });
    }

    // 2b. Grands tunnels, crevasses, rivières, ruisseaux et chemins secrets.
    if (!town) {
      if (big) {
        const names = shuffled(r, ['Grand tunnel de l’Ouest', 'Route des Caravanes', 'Grand tunnel du Nord', 'Vieille Route', 'Tunnel des Porteurs', 'Route basse', 'Voie des Exilés', 'Tunnel du Sel', 'Grande Traverse']);
        const axes = [0.18, 0.5, 0.8].map((v) => ({ a: { x: 0, y: H * (v + (r() - 0.5) * 0.1) }, b: { x: W, y: H * (v + (r() - 0.5) * 0.1) } }))
          .concat([0.2, 0.47, 0.76].map((v) => ({ a: { x: W * (v + (r() - 0.5) * 0.1), y: 0 }, b: { x: W * (v + (r() - 0.5) * 0.1), y: H } })))
          .concat([{ a: { x: 0, y: H * 0.1 }, b: { x: W, y: H * 0.9 } }]);
        axes.forEach(({ a, b }, k) => {
          const len = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
          const via = ells.map((e) => ({ e, t: (e.x - a.x) * ux + (e.y - a.y) * uy, dd: Math.abs((e.x - a.x) * uy - (e.y - a.y) * ux) }))
            .filter((v) => v.dd < 170 && v.t > 0 && v.t < len).sort((p, q) => p.t - q.t);
          const pts: [number, number][] = [[a.x, a.y], ...via.map((v) => [v.e.x + (r() - 0.5) * v.e.rx * 0.4, v.e.y + (r() - 0.5) * v.e.ry * 0.3] as [number, number]), [b.x, b.y]];
          line(`tun-${k}`, names[k % names.length], 'tunnel', 'landmark', 0, pts, 'Voie majeure, taillée et entretenue : caravanes et patrouilles l’empruntent.');
        });
        // Rivières : longues, de cavité en cavité.
        for (let k = 0; k < 5; k++) {
          let i = Math.floor(r() * n); const pts: [number, number][] = [[ells[i].x, ells[i].y]]; const seen = new Set([i]);
          for (let h = 0; h < 7; h++) { const j = nearest(i).find((x) => !seen.has(x)); if (j == null) break; seen.add(j); pts.push(...curve(ells[i], ells[j], 0.4, 3).slice(1)); i = j; }
          line(`riv-${k}`, pick(r, ['Rivière noire', 'Rivière des Gours', 'Rivière lente', 'Fleuve souterrain', 'Rivière froide']), 'ruisseau', 'regional', zoom(0.4), pts, 'Rivière souterraine pérenne ; elle a creusé une partie des salles qu’elle traverse.', 'eau');
        }
      }
      const nCrev = big ? 150 : 5;
      for (let k = 0; k < nCrev; k++) {
        let x = 30 + r() * (W - 60), y = 30 + r() * (H - 60), a = r() * Math.PI * 2; const pts: [number, number][] = [[x, y]];
        const segs = 5 + Math.floor(r() * 10);
        for (let q = 0; q < segs; q++) { a += (r() - 0.5) * 1.5; const l = 15 + r() * 40; x += Math.cos(a) * l; y += Math.sin(a) * l; pts.push([x, y]); }
        line(`crev-${k}`, pick(r, ['Crevasse', 'Fissure praticable', 'Faille étroite', 'Lézarde', 'Diaclase']), 'crevasse', segs > 11 ? 'regional' : 'local', zoom(segs > 11 ? 0.9 : 1.4 + r() * 1.2), pts,
          'Fissure étroite et irrégulière : on la franchit en file, parfois en escalade.', 'danger');
      }
      const nRiv = big ? 35 : 1;
      for (let k = 0; k < nRiv; k++) {
        const i = Math.floor(r() * n), j = nearest(i)[Math.floor(r() * 2)]; if (j == null) continue;
        line(`ru-${k}`, pick(r, ['Ruisseau souterrain', 'Ru des gours', 'Écoulement', 'Filet d’eau']), 'ruisseau', 'local', zoom(1.1 + r() * 0.7), curve(ells[i], ells[j], 0.45, 5), 'Cours d’eau souterrain ; il suit la pente.', 'eau');
      }
      const nSec = big ? 60 : 2;
      for (let k = 0; k < nSec; k++) {
        const i = Math.floor(r() * n), near = nearest(i), j = near[2 + Math.floor(r() * 4)] ?? near[0]; if (j == null) continue;
        line(`sec-${k}`, pick(r, ['Passage secret', 'Chemin dérobé', 'Faille cachée', 'Conduit oublié', 'Sentier des contrebandiers']), 'secret', 'detail', zoom(3 + r() * 1.3), curve(ells[i], ells[j], 0.6, 4),
          'Chemin connu de peu : il n’apparaît qu’à l’échelle de détail.');
      }
    }

    // 2c. Chaque voie aboutit quelque part (aucun tirage aléatoire ici : le reste de la carte ne bouge pas).
    //  - crevasses : leurs extrémités sont prolongées jusqu'à la salle la plus proche ;
    //  - grands tunnels : ils vont d'une salle à l'autre au lieu de s'arrêter au bord du relevé ;
    //  - diverticules : culs-de-sac voulus, signalés par un repère au bout (impasse, piège, attrape-nigaud…).
    if (!town && cavs.length) {
      const inCav = (x: number, y: number) => cavs.some((c) => ((x - c.cx) / c.rx) ** 2 + ((y - c.cy) / c.ry) ** 2 <= 1);
      const nearCav = (x: number, y: number, not = -1) => { let b = -1, bd = Infinity; cavs.forEach((c, i) => { if (i === not) return; const dd = Math.hypot(x - c.cx, (y - c.cy) * (H / W)); if (dd < bd) { bd = dd; b = i; } }); return b; };
      const into = (i: number, x: number, y: number): [number, number] => { const c = cavs[i], dx = x - c.cx, dy = y - c.cy, k = Math.hypot(dx / c.rx, dy / c.ry) || 1; return [+(c.cx + (dx / k) * 0.55).toFixed(5), +(c.cy + (dy / k) * 0.55).toFixed(5)]; };
      const feats = new Map(d.features.filter((f) => f.id.startsWith(`${m.id}-`)).map((f) => [f.id, f]));
      const ENDS = ['Cul-de-sac', 'Impasse piégée', 'Poche close', 'Attrape-nigaud', 'Éboulement terminal', 'Cul-de-sac'];
      for (const g of d.geometries.filter((x) => x.mapId === m.id && x.type === 'polyline')) {
        const f = feats.get(g.featureId); if (!f?.trace) continue;
        let c = (g.coordinates as [number, number][]).map(([x, y]) => [Math.min(0.99, Math.max(0.01, x)), Math.min(0.99, Math.max(0.01, y))] as [number, number]);
        if (f.trace === 'tunnel' && c.length > 3) c = c.slice(1, -1);
        if (f.trace === 'crevasse' || f.trace === 'tunnel') {
          let first = -1;
          if (!inCav(...c[0])) { first = nearCav(...c[0]); c.unshift(into(first, ...c[0])); }
          const e = c[c.length - 1];
          if (!inCav(...e)) c.push(into(nearCav(e[0], e[1], first), ...e));
        }
        g.coordinates = c;
        if (f.title === 'Diverticule') {
          const e = c[c.length - 1], k = Number(f.id.split('-').pop()) || 0, t = ENDS[k % ENDS.length];
          add({ id: `${f.id}-fin`, title: t, category: t === 'Impasse piégée' || t === 'Attrape-nigaud' ? 'danger' : 'grotte', importance: 'detail', minZoom: f.minZoom, summary: `Fin du diverticule. ${NOTE}` }, { mapId: m.id, type: 'point', coordinates: e });
        }
      }
    }

    // 3. Secteurs (grands noms) et salles.
    const order = [...ells.keys()].sort((a, b) => ells[b].rx * ells[b].ry - ells[a].rx * ells[a].ry);
    if (big) {
      const sectors = shuffled(r, SECTORS); let k = 0;
      for (let gx = 0; gx < 4; gx++) for (let gy = 0; gy < 3; gy++) {
        const inCell = order.filter((i) => ells[i].x >= (gx * W) / 4 && ells[i].x < ((gx + 1) * W) / 4 && ells[i].y >= (gy * H) / 3 && ells[i].y < ((gy + 1) * H) / 3);
        const i = inCell[0]; if (i == null) continue;
        add({ id: `${m.id}-sect-${k}`, title: sectors[k++ % sectors.length], category: 'indetermine', importance: 'landmark', minZoom: 0, area: true, subtitle: 'Secteur' },
          { mapId: m.id, type: 'point', coordinates: P(ells[i].x, ells[i].y - ells[i].ry * 0.5) });
      }
    }
    const used = new Set<string>();
    const hallName = () => { for (let t = 0; t < 50; t++) { const nm = `${pick(r, HALL_A)} ${pick(r, HALL_B)}`; if (!used.has(nm)) { used.add(nm); return nm; } } return `Salle ${used.size + 1}`; };
    if (!town) order.forEach((i, k) => {
      const e = ells[i]; const tier = e.rx > (big ? 140 : 95) ? 0 : e.rx > 80 ? 1 : 2;
      add({ id: `${m.id}-salle-${i}`, title: hallName(), category: 'grotte', importance: tier === 0 ? 'regional' : 'local', minZoom: zoom([0.7, 1.2, 1.9][tier]), area: true },
        { mapId: m.id, type: 'point', coordinates: P(e.x, e.y + e.ry * (big && k < 12 ? 0.15 : 0.42)) });
    });

    // 4. Grands repères.
    (LANDMARKS[m.id] ?? []).forEach((s2, k) => {
      const e = ells[order[k * 5 + 3] ?? order[0]]; const at = place(e, 70, 0.3);
      if (at) add({ id: `${m.id}-land-${k}`, ...s2, importance: 'landmark', minZoom: 0 }, { mapId: m.id, type: 'point', coordinates: P(at[0], at[1]) });
    });

    // 5. Repères notables, plans d'eau et zones à risque.
    if (big) {
      for (let k = 0; k < 45; k++) {
        const s2 = NOTABLE[k % NOTABLE.length]; const e = ells[order[Math.floor(r() * Math.min(n, 120))]]; const at = place(e, 90, 0.5); if (!at) continue;
        add({ id: `${m.id}-not-${k}`, ...s2, importance: 'regional', minZoom: zoom(0.8 + r() * 0.5) }, { mapId: m.id, type: 'point', coordinates: P(at[0], at[1]) });
        if (s2.category === 'eau' || s2.category === 'danger') {
          const rad = Math.min(e.ry * 0.5, 25 + r() * 35), ring: [number, number][] = [];
          for (let q = 0; q < 11; q++) { const a = (q / 11) * Math.PI * 2, k2 = 0.7 + r() * 0.45; ring.push(P(at[0] + Math.cos(a) * rad * 1.5 * k2, at[1] + Math.sin(a) * rad * k2)); }
          add({ id: `${m.id}-zone-${k}`, title: s2.title, category: s2.category, importance: 'regional', minZoom: zoom(0.5) }, { mapId: m.id, type: 'polygon', coordinates: ring });
        }
      }
    }

    // 5b. Obstacles des espaces de transit (visibles d'emblée).
    if (kind === 'espace') {
      const hz = shuffled(r, HAZARD_PINS);
      for (let k = 0; k < (fresh ? 6 : 3); k++) {
        const at = place(ells[Math.floor(r() * n)], 50, 0.5); if (!at) continue;
        add({ id: `${m.id}-hz-${k}`, title: hz[k % hz.length], category: 'danger', importance: 'regional', minZoom: 0, summary: `Obstacle de franchissement. ${NOTE}` }, { mapId: m.id, type: 'point', coordinates: P(at[0], at[1]) });
      }
    }

    // 6. Points locaux et micro-repères, cavité par cavité.
    const locals = shuffled(r, town ? TOWN_LOCAL : LOCAL), details = shuffled(r, town ? TOWN_DETAIL : DETAIL);
    let li = 0, di = 0;
    ells.forEach((e, i) => {
      const area = (e.rx * e.ry) / 4000;
      const nl = town ? 7 : Math.max(1, Math.min(5, Math.round(area * 0.45 + r())));
      const nd = town ? 9 : Math.max(2, Math.min(10, Math.round(area * 0.8 + r() * 2)));
      for (let q = 0; q < nl; q++) {
        const at = place(e, town ? 60 : 46); if (!at) continue; const s2 = locals[li++ % locals.length];
        add({ id: `${m.id}-loc-${i}-${q}`, ...s2, importance: 'local', minZoom: zoom(1.8 + r() * 0.8) }, { mapId: m.id, type: 'point', coordinates: P(at[0], at[1]) });
      }
      for (let q = 0; q < nd; q++) {
        const at = place(e, town ? 32 : 24, 0.85); if (!at) continue; const s2 = details[di++ % details.length];
        add({ id: `${m.id}-det-${i}-${q}`, ...s2, importance: 'detail', minZoom: zoom(3.2 + r() * 2.2) }, { mapId: m.id, type: 'point', coordinates: P(at[0], at[1]) });
      }
    });
  });
  return d;
}
