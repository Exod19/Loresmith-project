/**
 * Terrain de combat généré à partir du lieu choisi dans l'Atlas : catégorie, type de passage et description
 * (mots-clés : lac, pont, stalactite, éboulis…). Déterministe : un même lieu donne toujours le même terrain.
 * Chaque case est un caractère (voir TERRAIN) ; la grille est stockée en une seule chaîne de cols × rows caractères.
 */

export type TerrainKind = '.' | '#' | '~' | ':' | '=' | 'X' | 'I' | ',';

export const TERRAIN: Record<TerrainKind, { label: string; blocks: boolean; difficult: boolean }> = {
  '.': { label: 'Sol', blocks: false, difficult: false },
  '#': { label: 'Roche', blocks: true, difficult: false },
  '~': { label: 'Eau (terrain difficile)', blocks: false, difficult: true },
  ':': { label: 'Éboulis (terrain difficile)', blocks: false, difficult: true },
  '=': { label: 'Pont', blocks: false, difficult: false },
  X: { label: 'Gouffre / faille', blocks: true, difficult: false },
  I: { label: 'Stalagmite / pilier', blocks: true, difficult: false },
  ',': { label: 'Cristaux / champignons (décor)', blocks: false, difficult: false },
};

export type LocationHint = { title: string; category?: string; trace?: string; text?: string };

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Graine stable à partir d'un texte (FNV-1a). */
export function seedOf(text: string) {
  let h = 2166136261;
  for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateTerrain(cols: number, rows: number, loc: LocationHint, seed: number): string {
  const rand = rng(seed);
  const t = normalize(`${loc.title} ${loc.text ?? ''}`);
  const trace = loc.trace ?? '';
  const narrow = ['boyau', 'etroit', 'secret'].includes(trace) || /etroit|boyau|passage/.test(t);
  const wide = ['galerie', 'tunnel'].includes(trace) || loc.category === 'cite';

  // 1. Cavité de base, lissée en automate cellulaire (formes de grotte plutôt que bruit).
  let grid: TerrainKind[] = Array.from({ length: cols * rows }, () => (rand() < (narrow ? 0.46 : wide ? 0.2 : 0.33) ? '#' : '.'));
  const at = (g: TerrainKind[], x: number, y: number) => (x < 0 || y < 0 || x >= cols || y >= rows ? '#' : g[y * cols + x]);
  for (let pass = 0; pass < 3; pass++) {
    const next = grid.slice();
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      let walls = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && at(grid, x + dx, y + dy) === '#') walls++;
      next[y * cols + x] = walls >= 5 ? '#' : walls <= 3 ? '.' : grid[y * cols + x];
    }
    grid = next;
  }
  const set = (x: number, y: number, k: TerrainKind) => { if (x > 0 && y > 0 && x < cols - 1 && y < rows - 1) grid[y * cols + x] = k; };
  const get = (x: number, y: number) => at(grid, x, y);

  // 2. Passage principal, d'un bord à l'autre : on peut toujours traverser.
  const half = narrow ? 1 : wide ? 2 : 1;
  const corridor: number[] = [];
  let cy = Math.floor(rows / 2);
  for (let x = 0; x < cols; x++) {
    cy = Math.min(rows - 3 - half, Math.max(2 + half, cy + Math.round((rand() - 0.5) * 1.2)));
    corridor[x] = cy;
    for (let dy = -half; dy <= half; dy++) set(x, cy + dy, '.');
  }
  const inCorridor = (x: number, y: number) => Math.abs(y - corridor[x]) <= half;

  // 3. Caractéristiques du lieu.
  const waterWord = /lac|eau|riviere|etang|source|cascade|bassin|ruisseau|mare|flaque|goutte/;
  const ruisseau = trace === 'ruisseau' || /ruisseau|riviere|cours d'eau/.test(t);
  if (loc.category === 'eau' || ruisseau || waterWord.test(t)) {
    if (ruisseau) {
      // Un cours d'eau traverse la carte ; il ne peut être franchi qu'au pont, ou au gué (terrain difficile).
      const bx = Math.floor(cols * (0.45 + rand() * 0.1));
      const bridge = /pont|passerelle|corde/.test(t);
      for (let y = 0; y < rows; y++) for (let w = 0; w < 2; w++) {
        const x = bx + w + Math.round(Math.sin(y / 2) * 0.6);
        set(x, y, '~');
      }
      if (bridge) for (let dy = -half; dy <= half; dy++) for (let w = 0; w < 2; w++) set(bx + w, corridor[bx] + dy, '=');
    } else {
      // Un lac : une tache d'eau dans une partie de la cave.
      const lx = cols * (0.55 + rand() * 0.25), ly = rows * (0.3 + rand() * 0.4);
      const rx = cols * (0.09 + rand() * 0.06), ry = rows * (0.18 + rand() * 0.1);
      for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) {
        if (((x - lx) / rx) ** 2 + ((y - ly) / ry) ** 2 <= 1 && !inCorridor(x, y)) set(x, y, '~');
      }
    }
  }

  if (trace === 'crevasse' || /crevass|faille|gouffre|fissure|abime/.test(t)) {
    // Une faille coupe la carte en travers ; le passage et le pont (s'il y en a un) restent ouverts.
    const fx = Math.floor(cols * (0.3 + rand() * 0.15));
    const bridge = /pont|passerelle|corde/.test(t);
    for (let y = 0; y < rows; y++) {
      const x = fx + Math.round(Math.sin(y / 3) * 0.5);
      if (inCorridor(x, y)) continue;
      set(x, y, 'X');
      set(x + 1, y, 'X');
    }
    if (bridge) for (let dy = -half; dy <= half; dy++) for (let w = 0; w <= 1; w++) set(fx + w, corridor[fx] + dy, '=');
  }

  if (/stalact|stalagm|colonne|pilier|colonnade|concretion/.test(t) || loc.category === 'ruine') {
    for (let n = 5 + Math.floor(rand() * 5); n > 0; n--) {
      const x = 2 + Math.floor(rand() * (cols - 4)), y = 2 + Math.floor(rand() * (rows - 4));
      if (!inCorridor(x, y) && get(x, y) === '.') set(x, y, 'I');
    }
  }

  if (/eboul|gravat|decombre|pierre|rocaille/.test(t) || (loc.category === 'danger' && rand() < 0.5)) {
    const ex = 2 + Math.floor(rand() * (cols - 4)), ey = 2 + Math.floor(rand() * (rows - 4));
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dy * dy <= 4 && get(ex + dx, ey + dy) === '.' && rand() < 0.7) set(ex + dx, ey + dy, ':');
    }
  }

  if (/cristal|champign|lichen|mousse|fongi/.test(t) || ['vivant', 'sanctuaire'].includes(loc.category ?? '')) {
    for (let n = 12 + Math.floor(rand() * 10); n > 0; n--) {
      const x = 1 + Math.floor(rand() * (cols - 2)), y = 1 + Math.floor(rand() * (rows - 2));
      if (get(x, y) === '.') set(x, y, ',');
    }
  }

  // 4. Pas de poche isolée : une case libre non reliée au passage principal devient de la roche.
  const reached = new Array<boolean>(cols * rows).fill(false);
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows && !TERRAIN[grid[y * cols + x]].blocks;
  const queue: number[] = [];
  for (let y = 0; y < rows; y++) if (open(cols >> 1, y) && inCorridor(cols >> 1, y)) { reached[y * cols + (cols >> 1)] = true; queue.push(y * cols + (cols >> 1)); }
  while (queue.length) {
    const u = queue.pop()!, ux = u % cols, uy = Math.floor(u / cols);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = ux + dx, y = uy + dy;
      if (open(x, y) && !reached[y * cols + x]) { reached[y * cols + x] = true; queue.push(y * cols + x); }
    }
  }
  grid = grid.map((k, i) => (!TERRAIN[k].blocks && !reached[i] ? '#' : k));

  return grid.join('');
}

export const cellKind = (grid: string | undefined, cols: number, x: number, y: number): TerrainKind | null => {
  if (!grid || x < 0 || y < 0 || x >= cols || y * cols + x >= grid.length) return null;
  return grid[y * cols + x] as TerrainKind;
};

/** Une case bloque le déplacement et le placement (roche, gouffre, pilier). */
export const blocksCell = (grid: string | undefined, cols: number, x: number, y: number) => {
  const k = cellKind(grid, cols, x, y);
  return k !== null && TERRAIN[k].blocks;
};

/**
 * Coût de déplacement en cases entre deux cases (diagonales à 1 case, comme en 5e), avec le terrain difficile compté double.
 * `null` si le chemin est coupé.
 */
export function pathCost(grid: string | undefined, cols: number, rows: number, from: { x: number; y: number }, to: { x: number; y: number }): number | null {
  if (!grid) return Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y));
  const n = cols * rows;
  const dist = new Array<number>(n).fill(Infinity);
  const done = new Array<boolean>(n).fill(false);
  const start = from.y * cols + from.x, goal = to.y * cols + to.x;
  dist[start] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === goal) break;
    done[u] = true;
    const ux = u % cols, uy = Math.floor(u / cols);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = ux + dx, y = uy + dy;
      if ((!dx && !dy) || x < 0 || y < 0 || x >= cols || y >= rows) continue;
      if (blocksCell(grid, cols, x, y)) continue;
      const k = cellKind(grid, cols, x, y)!;
      const v = y * cols + x;
      const cost = dist[u] + (TERRAIN[k].difficult ? 2 : 1);
      if (cost < dist[v]) dist[v] = cost;
    }
  }
  return dist[goal] === Infinity ? null : dist[goal];
}
