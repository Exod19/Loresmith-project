/**
 * Intérieurs des bâtiments de la carte du monde.
 *
 * Un bâtiment donne toujours le même intérieur : la graine vient de son emplacement, le gabarit de son type
 * (une taverne a sa salle commune, son comptoir, sa cuisine et son cellier ; un temple sa nef et son autel…),
 * et ses dimensions de son empreinte sur le plan de la cité (agrandie si elle est trop petite pour le gabarit).
 * Les PNJ du lieu sont placés selon leur rôle : la tenancière derrière le comptoir, le forgeron à l'enclume.
 *
 * JavaScript pur : testé par world.test.mjs.
 */
import { SLOT_TYPES, hashSeed, rng } from './generate.js';

const W = 1240, H = 1000;
const r1 = (v) => Math.round(v * 10) / 10;
const r5 = (v) => Math.round(v * 1e5) / 1e5;
const f1 = (v) => (Math.round(v * 10) / 10).toString();
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Gabarits. Coordonnées relatives à l'intérieur du bâtiment : u de 0 à 1 le long de la façade, v de 0 (mur du fond)
 * à 1 (façade, où s'ouvre la porte). `walls` : cloisons (les ouvertures sont les trous entre deux tronçons).
 * `items` : [genre, u0, v0, u1, v1, nom?]. `spots` : où se tiennent les PNJ selon leur rôle.
 */
const TPL = {
  taverne: {
    min: [12, 10],
    rooms: [['Salle commune', 0, 0.38, 1, 1], ['Cuisine', 0, 0, 0.55, 0.38], ['Cellier', 0.55, 0, 1, 0.38]],
    walls: [[0, 0.38, 0.2, 0.38], [0.32, 0.38, 0.7, 0.38], [0.82, 0.38, 1, 0.38], [0.55, 0, 0.55, 0.38]],
    items: [['counter', 0.1, 0.45, 0.6, 0.51, 'Comptoir'], ['hearth', 0.92, 0.52, 1, 0.74, 'Cheminée'], ['tables', 0.06, 0.6, 0.86, 0.9],
      ['barrels', 0.6, 0.04, 0.96, 0.3, 'Tonneaux'], ['table', 0.08, 0.1, 0.42, 0.2], ['hearth', 0, 0.04, 0.07, 0.22, 'Four']],
    spots: { counter: [0.35, 0.42], hearth: [0.85, 0.63], kitchen: [0.27, 0.27], back: [0.78, 0.33], main: [0.45, 0.76], door: [0.5, 0.95] },
  },
  auberge: {
    min: [14, 12],
    rooms: [['Salle commune', 0, 0.4, 1, 1], ['Cuisine', 0, 0, 0.45, 0.4], ['Escalier des chambres', 0.45, 0, 0.7, 0.4], ['Réserve', 0.7, 0, 1, 0.4]],
    walls: [[0, 0.4, 0.18, 0.4], [0.3, 0.4, 0.5, 0.4], [0.64, 0.4, 0.78, 0.4], [0.9, 0.4, 1, 0.4], [0.45, 0, 0.45, 0.4], [0.7, 0, 0.7, 0.4]],
    items: [['counter', 0.08, 0.47, 0.5, 0.53, 'Comptoir'], ['hearth', 0.93, 0.5, 1, 0.72, 'Cheminée'], ['tables', 0.06, 0.62, 0.88, 0.9],
      ['stair', 0.5, 0.05, 0.65, 0.34, 'Escalier'], ['barrels', 0.73, 0.05, 0.97, 0.3, 'Tonneaux'], ['table', 0.06, 0.1, 0.36, 0.2]],
    spots: { counter: [0.3, 0.44], hearth: [0.86, 0.62], kitchen: [0.22, 0.28], back: [0.84, 0.34], main: [0.5, 0.76], door: [0.5, 0.95] },
  },
  echoppe: {
    min: [7, 8],
    rooms: [['Boutique', 0, 0.45, 1, 1], ['Arrière-boutique', 0, 0, 1, 0.45]],
    walls: [[0, 0.45, 0.62, 0.45], [0.82, 0.45, 1, 0.45]],
    items: [['counter', 0.15, 0.55, 0.85, 0.62, 'Comptoir'], ['shelf', 0, 0.62, 0.07, 0.95, 'Étals'], ['shelf', 0.93, 0.62, 1, 0.95, 'Étals'], ['crates', 0.05, 0.05, 0.6, 0.38, 'Réserve']],
    spots: { counter: [0.5, 0.52], back: [0.75, 0.25], main: [0.5, 0.8], door: [0.5, 0.95] },
  },
  forge: {
    min: [9, 8],
    rooms: [['Atelier', 0, 0.4, 1, 1], ['Logis', 0, 0, 1, 0.4]],
    walls: [[0, 0.4, 0.65, 0.4], [0.85, 0.4, 1, 0.4]],
    items: [['hearth', 0.05, 0.45, 0.32, 0.62, 'Forge'], ['anvil', 0.42, 0.6, 0.52, 0.68, 'Enclume'], ['trough', 0.06, 0.7, 0.26, 0.8, 'Bac de trempe'], ['rack', 0.93, 0.45, 1, 0.92, 'Râtelier'], ['bed', 0.05, 0.06, 0.3, 0.32], ['table', 0.55, 0.1, 0.85, 0.22]],
    spots: { anvil: [0.47, 0.74], hearth: [0.36, 0.55], back: [0.7, 0.3], main: [0.6, 0.8], door: [0.5, 0.95] },
  },
  temple: {
    min: [12, 16],
    rooms: [['Nef', 0, 0.2, 1, 1], ['Chœur', 0, 0, 0.72, 0.2], ['Sacristie', 0.72, 0, 1, 0.2]],
    walls: [[0.72, 0, 0.72, 0.13], [0.72, 0.2, 0.8, 0.2], [0.92, 0.2, 1, 0.2]],
    items: [['altar', 0.26, 0.06, 0.46, 0.12, 'Autel'], ['benches', 0.1, 0.3, 0.9, 0.86], ['shelf', 0.75, 0.02, 0.98, 0.07, 'Armoire aux reliques']],
    spots: { altar: [0.36, 0.16], back: [0.86, 0.1], main: [0.5, 0.9], door: [0.5, 0.95] },
  },
  maison: {
    min: [6, 7],
    rooms: [['Salle', 0, 0.45, 1, 1], ['Chambre', 0, 0, 1, 0.45]],
    walls: [[0, 0.45, 0.6, 0.45], [0.82, 0.45, 1, 0.45]],
    items: [['hearth', 0.86, 0.55, 1, 0.75, 'Âtre'], ['table', 0.2, 0.62, 0.6, 0.76], ['bed', 0.06, 0.06, 0.45, 0.36]],
    spots: { hearth: [0.75, 0.66], back: [0.6, 0.25], main: [0.45, 0.85], door: [0.5, 0.95] },
  },
  manoir: {
    min: [16, 13],
    rooms: [['Vestibule', 0.32, 0.55, 0.68, 1], ['Salon', 0, 0.55, 0.32, 1], ['Cuisine', 0.68, 0.55, 1, 1], ['Bibliothèque', 0, 0, 0.5, 0.55], ['Chambre', 0.5, 0, 1, 0.55]],
    walls: [[0, 0.55, 0.12, 0.55], [0.22, 0.55, 0.42, 0.55], [0.58, 0.55, 0.78, 0.55], [0.88, 0.55, 1, 0.55], [0.32, 0.55, 0.32, 0.7], [0.32, 0.82, 0.32, 1], [0.68, 0.55, 0.68, 0.7], [0.68, 0.82, 0.68, 1], [0.5, 0, 0.5, 0.55]],
    items: [['hearth', 0, 0.68, 0.05, 0.86, 'Cheminée'], ['table', 0.08, 0.66, 0.26, 0.8], ['shelf', 0.02, 0.02, 0.48, 0.07, 'Rayonnages'], ['table', 0.15, 0.25, 0.35, 0.35], ['bed', 0.62, 0.05, 0.92, 0.3], ['counter', 0.74, 0.62, 0.97, 0.68, 'Plan de travail'], ['rug', 0.38, 0.62, 0.62, 0.92]],
    spots: { main: [0.5, 0.75], hearth: [0.12, 0.85], back: [0.75, 0.4], kitchen: [0.84, 0.8], door: [0.5, 0.95], study: [0.25, 0.42] },
  },
  caserne: {
    min: [12, 9],
    rooms: [['Salle d’armes', 0, 0.5, 1, 1], ['Dortoir', 0, 0, 0.7, 0.5], ['Cachot', 0.7, 0, 1, 0.5]],
    walls: [[0, 0.5, 0.3, 0.5], [0.42, 0.5, 0.78, 0.5], [0.9, 0.5, 1, 0.5], [0.7, 0, 0.7, 0.5]],
    items: [['rack', 0, 0.55, 0.05, 0.95, 'Râtelier d’armes'], ['table', 0.3, 0.65, 0.7, 0.78], ['beds', 0.04, 0.05, 0.66, 0.45], ['bars', 0.7, 0.28, 1, 0.3, 'Grille']],
    spots: { door: [0.5, 0.9], main: [0.5, 0.86], back: [0.85, 0.14] },
  },
  chateau: {
    min: [20, 18],
    rooms: [['Grande salle', 0, 0.35, 1, 1], ['Appartements', 0, 0, 0.6, 0.35], ['Salle des archives', 0.6, 0, 1, 0.35]],
    walls: [[0, 0.35, 0.25, 0.35], [0.35, 0.35, 0.7, 0.35], [0.8, 0.35, 1, 0.35], [0.6, 0, 0.6, 0.35]],
    items: [['throne', 0.44, 0.38, 0.56, 0.45, 'Trône'], ['dais', 0.3, 0.37, 0.7, 0.48], ['longtable', 0.2, 0.6, 0.8, 0.68, 'Grande table'], ['hearth', 0, 0.5, 0.03, 0.7, 'Cheminée'], ['hearth', 0.97, 0.5, 1, 0.7, 'Cheminée'], ['bed', 0.05, 0.05, 0.3, 0.25], ['shelf', 0.62, 0.02, 0.98, 0.06, 'Archives'], ['rug', 0.42, 0.48, 0.58, 0.98]],
    spots: { throne: [0.5, 0.5], main: [0.5, 0.78], door: [0.5, 0.94], back: [0.3, 0.2], study: [0.8, 0.2] },
  },
  guilde: {
    min: [12, 10],
    rooms: [['Grande salle', 0, 0.45, 1, 1], ['Bureau', 0, 0, 0.5, 0.45], ['Archives', 0.5, 0, 1, 0.45]],
    walls: [[0, 0.45, 0.18, 0.45], [0.3, 0.45, 0.7, 0.45], [0.82, 0.45, 1, 0.45], [0.5, 0, 0.5, 0.45]],
    items: [['longtable', 0.15, 0.62, 0.85, 0.72, 'Table du conseil'], ['table', 0.12, 0.12, 0.38, 0.24], ['shelf', 0.52, 0.02, 0.98, 0.07, 'Registres'], ['shelf', 0.93, 0.1, 0.98, 0.42, 'Registres'], ['hearth', 0.96, 0.6, 1, 0.8, 'Cheminée']],
    spots: { study: [0.25, 0.3], main: [0.5, 0.82], back: [0.75, 0.25], door: [0.5, 0.95] },
  },
  ecurie: {
    min: [10, 12],
    rooms: [['Écurie', 0, 0, 1, 1]],
    walls: [],
    items: [['stalls', 0, 0.05, 0.3, 0.9, 'Stalles'], ['stalls', 0.7, 0.05, 1, 0.9, 'Stalles'], ['trough', 0.4, 0.05, 0.6, 0.1, 'Abreuvoir'], ['crates', 0.42, 0.15, 0.58, 0.3, 'Foin']],
    spots: { main: [0.5, 0.6], back: [0.5, 0.35], door: [0.5, 0.95] },
  },
  entrepot: {
    min: [12, 10],
    rooms: [['Entrepôt', 0, 0, 1, 1]],
    walls: [],
    items: [['crates', 0.05, 0.05, 0.4, 0.4, 'Caisses'], ['crates', 0.6, 0.05, 0.95, 0.4, 'Caisses'], ['barrels', 0.05, 0.55, 0.35, 0.8, 'Tonneaux'], ['crates', 0.65, 0.55, 0.95, 0.8, 'Ballots']],
    spots: { main: [0.5, 0.6], back: [0.5, 0.2], door: [0.5, 0.95] },
  },
  atelier: {
    min: [9, 8],
    rooms: [['Atelier', 0, 0, 1, 1]],
    walls: [],
    items: [['longtable', 0.1, 0.2, 0.9, 0.3, 'Établi'], ['crates', 0.05, 0.55, 0.3, 0.8, 'Matériaux'], ['rack', 0.93, 0.4, 1, 0.9, 'Outils']],
    spots: { main: [0.5, 0.42], back: [0.3, 0.12], door: [0.5, 0.95] },
  },
  ferme: {
    min: [12, 8],
    rooms: [['Salle commune', 0, 0, 0.55, 1], ['Étable', 0.55, 0, 1, 1]],
    walls: [[0.55, 0, 0.55, 0.62], [0.55, 0.76, 0.55, 1]],
    items: [['hearth', 0, 0.3, 0.06, 0.55, 'Âtre'], ['table', 0.15, 0.45, 0.42, 0.6], ['bed', 0.05, 0.05, 0.35, 0.22], ['stalls', 0.6, 0.05, 0.95, 0.6, 'Stalles']],
    spots: { hearth: [0.12, 0.42], main: [0.3, 0.75], back: [0.75, 0.75], door: [0.3, 0.95] },
  },
};
TPL.manoir.door = 0.5; TPL.ferme.door = 0.3;

/** Où se tient un PNJ, selon son rôle. */
const ROLE_SPOT = [
  [/tenanci|aubergist|barman|barmaid|serveu|cabaretier|tavernier|patron|patronne|hote|hotesse|marchand|vendeu|boutiqu|apothic|herbor|boulang|boucher|orfevre|commis|joailli|epici|libraire|cordonni|tailleur/, 'counter'],
  [/forgeron|armurier|marechal/, 'anvil'],
  [/pretre|pretresse|clerc|moine|moniale|chapelain|eveque|abbe|abbesse|acolyte|diacre|oracle|pretre/, 'altar'],
  [/\broi\b|reine|seigneur|duc|duchesse|comte|comtesse|baron|baronne|prince|princesse|chatelain|monarque|souverain/, 'throne'],
  [/garde|sergent|soldat|portier|videur|capitaine|milicien|sentinelle/, 'door'],
  [/cuisini|marmiton|cuistot/, 'kitchen'],
  [/scribe|archiviste|tresorier|notaire|maitre de guilde|bourgmestre|intendant|savant|mage|erudit/, 'study'],
];

/** Milieux des ouvertures d'une cloison : les trous entre deux tronçons alignés, ou entre un tronçon et un mur. */
function openingsOf(walls) {
  const out = [];
  const lines = new Map();
  for (const [u0, v0, u1, v1] of walls) {
    const horiz = Math.abs(v0 - v1) < 1e-6;
    const key = horiz ? `h${v0}` : `v${u0}`;
    if (!lines.has(key)) lines.set(key, { horiz, at: horiz ? v0 : u0, segs: [] });
    lines.get(key).segs.push(horiz ? [Math.min(u0, u1), Math.max(u0, u1)] : [Math.min(v0, v1), Math.max(v0, v1)]);
  }
  for (const { horiz, at, segs } of lines.values()) {
    segs.sort((a, b) => a[0] - b[0]);
    // Les tronçons d'une même ligne : les trous entre eux sont des passages. Une cloison qui s'arrête avant un mur
    // est une cloison partielle : rien à ouvrir.
    for (let i = 0; i < segs.length - 1; i++) {
      const mid = (segs[i][1] + segs[i + 1][0]) / 2;
      if (segs[i + 1][0] - segs[i][1] > 0.01) out.push(horiz ? [mid, at] : [at, mid]);
    }
  }
  return out;
}

/** Plan d'un intérieur. `slot` : emplacement de la cité (dimensions et façade) ; `bound` : lieu du lore posé dessus. */
export function generateInterior({ slot, planId, siteId, parentSiteId, bound }) {
  const type = bound?.type ?? slot.type;
  const tpl0 = TPL[type] ?? TPL.maison;
  const rand = rng(hashSeed(`interieur:${slot.id}`));
  // Une fois sur deux, le gabarit est retourné (porte et pièces à l'envers) : deux tavernes ne se ressemblent pas.
  const flip = rand() < 0.5;
  const U = (u) => (flip ? 1 - u : u);
  const iw = Math.max(slot.w ?? tpl0.min[0], tpl0.min[0]), id = Math.max(slot.d ?? tpl0.min[1], tpl0.min[1]);
  const scale = Math.max((iw + 12) / W, (id + 15) / H, 40 / W);
  const ox = (W * scale - iw) / 2, oy = (H * scale - id) / 2 - 2.5;
  /** Point de l'intérieur (u, v) en unités de plan, et en coordonnées 0–1. */
  const P = (u, v) => [(ox + U(u) * iw) / scale, (oy + v * id) / scale];
  const Nn = (u, v) => { const [x, y] = P(u, v); return [r5(x / W), r5(y / H)]; };
  const box = (u0, v0, u1, v1) => { const [a, b] = P(u0, v0), [c, d] = P(u1, v1); return [Math.min(a, c), Math.min(b, d), Math.abs(c - a), Math.abs(d - b)]; };
  const rectD = ([x, y, w, h]) => `M${f1(x)} ${f1(y)}h${f1(w)}v${f1(h)}h${f1(-w)}Z`;
  const circleD = (x, y, r) => `M${f1(x - r)} ${f1(y)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0`;
  const m = (v) => v / scale; // mètres → unités de plan
  const T = SLOT_TYPES[type] ?? SLOT_TYPES.maison;
  const title = bound?.title || slot.label || T.label;
  const pre = `${planId}:`;
  const base = { canonStatus: 'creation', placementStatus: 'documented' };

  const paths = {};
  const push = (k, d) => { (paths[k] ??= []).push(d); };
  const ground = { b: [], f: [], t: [], o: [], walls: [], water: [], roads: [] };
  const rectFlat = ([x, y, w, h]) => [r1(x + w / 2), r1(y + h / 2), r1(w), r1(h), 0];
  const features = [], geometries = [];
  const addPoint = (f, at) => { features.push({ ...base, ...f }); geometries.push({ id: `g-${f.id}`, mapId: planId, featureId: f.id, type: 'point', coordinates: at }); };

  // Sol de l'intérieur (la rue, autour, est le fond du plan).
  push('floor', rectD(box(0, 0, 1, 1)));
  // Murs extérieurs, avec la porte au milieu de la façade (1,6 m).
  const doorU = tpl0.door ?? 0.5;
  // Porte de 2 m : assez large pour rester ouverte sur la grille de combat (cases de 1,5 m).
  const half = 1 / iw;
  const outer = [[[doorU + half, 1], [1, 1], [1, 0], [0, 0], [0, 1], [doorU - half, 1]]];
  const wallHw = 0.3;
  const addWall = (pts, w) => {
    const pp = pts.map(([u, v]) => P(u, v));
    ground.walls.push({ pts: pp.flat().map(r1), hw: r1(m(w)) });
    paths.walls ??= []; paths.walls.push(`M${pp.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}`);
  };
  for (const pts of outer) addWall(pts, wallHw);
  for (const [u0, v0, u1, v1] of tpl0.walls) addWall([[u0, v0], [u1, v1]], 0.12);
  // Ouvertures (porte et passages entre pièces) : la grille de combat les garde ouvertes, quelle que soit sa trame.
  ground.doors = [...P(doorU, 1), ...openingsOf(tpl0.walls).flatMap(([u, v]) => P(u, v))].map(r1);

  // Mobilier.
  const named = [];
  for (const [kind, u0, v0, u1, v1, label] of tpl0.items) {
    const bx = box(u0, v0, u1, v1);
    const [cx, cy] = [bx[0] + bx[2] / 2, bx[1] + bx[3] / 2];
    if (kind === 'tables' || kind === 'benches' || kind === 'beds' || kind === 'stalls') {
      // Une rangée d'éléments réguliers, au mètre près, dans la zone.
      const size = { tables: [1.8, 0.9], benches: [3.2, 0.5], beds: [0.9, 1.9], stalls: [2.4, 2.8] }[kind];
      const gap = { tables: [1.4, 1.3], benches: [1, 0.9], beds: [0.6, 0.8], stalls: [0.2, 0.3] }[kind];
      const [ww, hh] = [m(size[0]), m(size[1])];
      const nx = Math.max(1, Math.floor((bx[2] + m(gap[0])) / (ww + m(gap[0])))), ny = Math.max(1, Math.floor((bx[3] + m(gap[1])) / (hh + m(gap[1]))));
      const x0 = bx[0] + (bx[2] - (nx * ww + (nx - 1) * m(gap[0]))) / 2, y0 = bx[1] + (bx[3] - (ny * hh + (ny - 1) * m(gap[1]))) / 2;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        if (kind === 'tables' && rand() < 0.12) continue;
        const r = [x0 + i * (ww + m(gap[0])), y0 + j * (hh + m(gap[1])), ww, hh];
        push(kind === 'beds' ? 'bed' : kind === 'stalls' ? 'stall' : 'furn', rectD(r));
        (kind === 'stalls' ? ground.f : ground.f).push(...rectFlat(r));
      }
      if (label) named.push([label, cx, cy]);
      continue;
    }
    if (kind === 'barrels' || kind === 'crates') {
      const n = Math.max(3, Math.round((bx[2] * bx[3]) / (m(1) * m(1)) / 2.2));
      for (let k = 0; k < n; k++) {
        const x = bx[0] + rand() * bx[2], y = bx[1] + rand() * bx[3];
        if (kind === 'barrels') { push('barrel', circleD(x, y, m(0.4))); ground.o.push(r1(x), r1(y), r1(m(0.8)), r1(m(0.8)), 0); } else { const s = m(0.8 + rand() * 0.4); push('crate', rectD([x - s / 2, y - s / 2, s, s])); ground.o.push(r1(x), r1(y), r1(s), r1(s), 0); }
      }
      if (label) named.push([label, cx, cy]);
      continue;
    }
    const decorKind = { counter: 'furn', table: 'furn', longtable: 'furn', hearth: 'hearth', bed: 'bed', altar: 'altar', shelf: 'furn', anvil: 'anvil', rack: 'furn', trough: 'trough', stair: 'stair', throne: 'altar', dais: 'dais', rug: 'rug', bars: 'bars' }[kind] ?? 'furn';
    push(decorKind, rectD(bx));
    // Sol de combat : ce qui bloque (comptoir, âtre, autel…), ce qui gêne (tables, lits, estrade), l'eau, et le reste.
    if (['counter', 'hearth', 'altar', 'shelf', 'anvil', 'rack', 'throne', 'bars'].includes(kind)) ground.o.push(...rectFlat(bx));
    else if (kind === 'trough') ground.water.push({ pts: [r1(bx[0]), r1(cy), r1(bx[0] + bx[2]), r1(cy)], hw: r1(bx[3] / 2) });
    else if (!['rug', 'dais', 'stair'].includes(kind)) ground.f.push(...rectFlat(bx));
    if (label) named.push([label, cx, cy]);
  }

  // Pièces (étiquettes) et éléments nommés.
  tpl0.rooms.forEach(([name, u0, v0, u1, v1], i) => addPoint({
    id: `${pre}piece-${i}`, title: name, category: 'cite', importance: 'local', minZoom: 0, area: true,
  }, Nn((u0 + u1) / 2, v0 + (v1 - v0) * (i === 0 ? 0.25 : 0.5))));
  named.forEach(([label, x, y], i) => addPoint({ id: `${pre}objet-${i}`, title: label, category: 'indetermine', importance: 'detail', minZoom: 1.3 }, [r5(x / W), r5(y / H)]));

  // Entrée (juste derrière la porte) et sortie sur la rue : le passage entre les deux mène à la cité.
  const entry = Nn(doorU, 0.9), exit = Nn(doorU, 1 + 1.8 / id);
  addPoint({ id: `${pre}entree`, title: 'Entrée', category: 'voie', importance: 'local', minZoom: 0, subtitle: title }, entry);
  features.push({ ...base, id: `${pre}porte`, title: 'Porte d’entrée', category: 'voie', importance: 'local', minZoom: 0, trace: 'etroit' });
  geometries.push({ id: `g-${pre}porte`, mapId: planId, featureId: `${pre}porte`, type: 'polyline', coordinates: [entry, exit] });
  const anchors = [{ id: `${pre}sortie`, mapId: planId, at: exit, label: 'Sortie · rue' }];

  // PNJ du lieu, chacun à sa place.
  const used = new Map();
  for (const npc of bound?.npcs ?? []) {
    const role = norm(`${npc.role ?? ''} ${npc.desc ?? ''}`);
    let spot = ROLE_SPOT.find(([re]) => re.test(role))?.[1] ?? 'main';
    if (!tpl0.spots[spot]) spot = spot === 'anvil' ? 'hearth' : 'main';
    if (!tpl0.spots[spot]) spot = 'main';
    const n = used.get(spot) ?? 0; used.set(spot, n + 1);
    const [u, v] = tpl0.spots[spot];
    addPoint({
      id: `${pre}pnj-${npc.id}`, title: npc.name, category: 'institution', importance: 'regional', minZoom: 0,
      subtitle: npc.role || undefined, summary: npc.desc || undefined, entryId: npc.id,
    }, Nn(Math.min(0.95, Math.max(0.05, u + (n % 2 ? -1 : 1) * Math.ceil(n / 2) * (1.2 / iw))), v));
  }

  const ORDER = ['street', 'floor', 'rug', 'dais', 'stall', 'furn', 'bed', 'hearth', 'altar', 'anvil', 'trough', 'stair', 'barrel', 'crate', 'bars'];
  const decor = [
    ...ORDER.filter((k) => paths[k]).map((k) => ({ kind: k, d: paths[k].join('') })),
    { kind: 'wall-in', d: paths.walls.join(''), w: r1(m(0.45)) },
  ];
  const map = {
    id: planId, title: `${title} · intérieur`, scope: { kind: 'site', id: siteId }, width: W, height: H,
    // Vue d'entrée : le bâtiment occupe l'écran (la rue reste visible devant la porte).
    defaultViewport: { x: r5((ox + iw / 2) / scale / W), y: r5((oy + id * 0.6) / scale / H), zoom: r1(Math.min(3, Math.max(1, 0.8 * Math.min((W * scale) / iw, (H * scale) / (id + 4))))) },
    decor, surface: { scale: r5(scale), theme: 'interieur', ground },
  };
  return {
    map, features, geometries, anchors,
    space: { id: siteId, kind: 'site', name: title, levelId: 'monde', stratumIds: [], mapId: planId, parentSpaceId: parentSiteId },
    entryId: `${pre}entree`,
  };
}
