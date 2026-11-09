/**
 * Plateau de combat habillé par la Banque Loresmith (plans de surface et intérieurs de la carte du monde ; le terrain
 * des cavernes et de l'Atlas des profondeurs n'est pas touché).
 *
 * Une case vaut 1,5 m : une texture couvre sa taille réelle (une tuile de 4 m s'étend sur un peu moins de 3 cases), un
 * toit couvre son bâtiment, un arbre sa couronne. Le dessin vectoriel déjà peint reste dessous : si une image manque,
 * le plateau reste lisible.
 */
import { isUrban, outsideOf, waterDepth } from '../maps/battle/groundCells';
import { bankImages, bankSrc, fitRoof, hash, maskFromParts, pickElement, pickTexture, type BankImage } from './index';

const CELL_M = 1.5;
const cache = new Map<string, Promise<HTMLImageElement | null>>();
function load(src: string) {
  let p = cache.get(src);
  if (!p) {
    p = new Promise((resolve) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => resolve(null); im.src = src; });
    cache.set(src, p);
  }
  return p;
}

type Climate = 'tempere' | 'froid' | 'chaud' | 'neige';

/** Remplit les cases `keep` d'une texture continue (le motif suit la position réelle, sans couture case à case). */
async function fillCells(ctx: CanvasRenderingContext2D, C: number, cols: number, terrain: string, keep: (k: string, i: number) => boolean, img: BankImage | null, alpha = 1) {
  if (!img) return;
  const tileM = typeof img.taille === 'number' ? img.taille : 5;
  const tilePx = (tileM / CELL_M) * C;
  const im = await load(bankSrc(img, tilePx));
  if (!im) return;
  const pat = ctx.createPattern(im, 'repeat');
  if (!pat) return;
  pat.setTransform(new DOMMatrix().scale(tilePx / im.width, tilePx / im.height));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pat;
  ctx.beginPath();
  for (let i = 0; i < terrain.length; i++) if (keep(terrain[i], i)) ctx.rect((i % cols) * C, Math.floor(i / cols) * C, C, C);
  ctx.fill();
  ctx.restore();
}

/** Dessine une image centrée en (x, y), de w × h pixels, tournée de `a` radians. */
function put(ctx: CanvasRenderingContext2D, im: HTMLImageElement, x: number, y: number, w: number, h: number, a: number, flip = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(im, -w / 2, -h / 2, w, h);
  ctx.restore();
}

/** Groupes de cases d'un même type (bâtiments) : leur rectangle englobant et leur taux de remplissage. */
function groups(terrain: string, cols: number, rows: number, kind: string) {
  const seen = new Uint8Array(terrain.length);
  const out: { x0: number; y0: number; x1: number; y1: number; n: number }[] = [];
  for (let i = 0; i < terrain.length; i++) {
    if (seen[i] || terrain[i] !== kind) continue;
    const g = { x0: cols, y0: rows, x1: -1, y1: -1, n: 0 };
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop()!, x = j % cols, y = Math.floor(j / cols);
      g.n++; g.x0 = Math.min(g.x0, x); g.y0 = Math.min(g.y0, y); g.x1 = Math.max(g.x1, x); g.y1 = Math.max(g.y1, y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = ny * cols + nx;
        if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen[k] && terrain[k] === kind) { seen[k] = 1; stack.push(k); }
      }
    }
    out.push(g);
  }
  return out;
}

/**
 * Habille un plateau de surface (`climate`) ou d'intérieur. `alive()` : faux si un autre dessin a commencé entre-temps
 * (on abandonne alors sans rien peindre de travers).
 */
/** `nature` : plan d'un lieu sauvage (sol d'herbe et de terre, paroi de roche ; ni pavés ni toits). */
export async function dressBoard(canvas: HTMLCanvasElement, cols: number, rows: number, terrain: string | undefined, mode: Climate | 'interieur', C: number, alive: () => boolean, nature = false, furnished = false) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !terrain) return;
  const images = bankImages();
  const climat = mode === 'neige' ? 'froid' : mode === 'interieur' ? 'tempere' : mode;
  const saison = mode === 'neige' ? 'hiver' : undefined;
  const ctxPick = { climat, saison, region: 'surface' };
  const tex = (cats: string[], seed: string) => pickTexture(images, { cats, ...ctxPick, seed });
  const steps: (() => Promise<void>)[] = [];
  const compact = (g: { x0: number; y0: number; x1: number; y1: number; n: number }) => { const a = (g.x1 - g.x0 + 1) * (g.y1 - g.y0 + 1); return a <= 60 && g.n / a >= 0.7; };
  const rockCells = new Set<number>();
  if (nature && terrain) for (const g of groups(terrain, cols, rows, '#')) if (!compact(g)) for (let y = g.y0; y <= g.y1; y++) for (let x = g.x0; x <= g.x1; x++) if (terrain[y * cols + x] === '#') rockCells.add(y * cols + x);
  // Sol sous un objet dessiné : la case est repeinte avant l'image, pour qu'aucun tracé vectoriel ne reste dessous.
  let under: BankImage | null = null;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= cols || y >= rows ? '#' : terrain[y * cols + x]);
  if (mode === 'interieur') {
    // Plancher au-dedans, pavés au-dehors (ce qu'on atteint depuis le bord sans franchir de mur ni d'embrasure), murs de
    // pierre. Les meubles peints (comptoir, tables, lits) restent visibles : le plancher ne passe pas dessus.
    const out = outsideOf(terrain, cols, rows);
    under = tex(['planches'], 'sol');
    steps.push(() => fillCells(ctx, C, cols, terrain, (k, i) => (k === '.' || k === ':') && !out.has(i), under, 0.92));
    // Dehors : neutre, comme la carte de navigation de l'intérieur (plus de pavés de rue autour du bâtiment).
    steps.push(() => fillCells(ctx, C, cols, terrain, (k) => k === '#', tex(['dalles'], 'mur'), 0.75));
  } else {
    // En ville (beaucoup de bâti, peu de champs), le sol libre est pavé ; à la campagne, c'est de la terre.
    const urban = isUrban(terrain, nature);
    const sol = mode === 'neige' ? ['neige'] : mode === 'chaud' ? ['sable', 'terre'] : urban ? ['paves', 'terre'] : mode === 'froid' ? ['toundra', 'terre'] : nature ? ['herbe', 'terre'] : ['terre'];
    under = tex(sol, 'sol');
    steps.push(() => fillCells(ctx, C, cols, terrain, (k) => k === '.', under, 0.9));
    steps.push(() => fillCells(ctx, C, cols, terrain, (k) => k === ',', tex(mode === 'neige' ? ['neige'] : ['champ', 'herbe'], 'champ'), 0.95));
    // Eau : peu profonde près des berges, profonde au large (distance en cases à la terre) ; berges de terre mouillée.
    if (mode === 'neige') steps.push(() => fillCells(ctx, C, cols, terrain, (k) => k === '~', tex(['glace', 'eau'], 'eau'), 0.9));
    else {
      const depth = waterDepth(terrain, cols, rows);
      const byUsage = (u: string, seed: string) => pickTexture(images.filter((i) => i.usage?.includes(u)), { cats: ['eau'], ...ctxPick, seed });
      const shallow = byUsage(mode === 'chaud' ? 'claire' : 'boueuse', 'eau-s') ?? byUsage('peu-profonde', 'eau-s') ?? tex(['eau'], 'eau');
      const deep = byUsage('profonde', 'eau-p');
      steps.push(() => fillCells(ctx, C, cols, terrain, (k) => k === '~', shallow, 0.95));
      steps.push(() => fillCells(ctx, C, cols, terrain, (k, i) => k === '~' && depth[i] === 2, deep, 0.45));
      steps.push(() => fillCells(ctx, C, cols, terrain, (k, i) => k === '~' && depth[i] >= 3, deep, 0.9));
      steps.push(async () => {
        ctx.save();
        ctx.fillStyle = mode === 'chaud' ? 'rgba(196,173,124,.35)' : mode === 'froid' ? 'rgba(111,106,94,.35)' : 'rgba(80,66,44,.32)';
        for (let i = 0; i < terrain.length; i++) if ((terrain[i] === '.' || terrain[i] === ',') && depth[i] === -1) ctx.fillRect((i % cols) * C, Math.floor(i / cols) * C, C, C);
        ctx.restore();
      });
    }
    steps.push(() => fillCells(ctx, C, cols, terrain, (k) => k === '=', tex(['planches'], 'pont'), 1));
    steps.push(() => fillCells(ctx, C, cols, terrain, (k) => k === ':', tex(mode === 'neige' ? ['neige'] : ['eboulis'], 'eboulis'), 0.9));
    // Pleine nature : une paroi ou des rochers (formes étirées) sont de la roche ; un abri compact (tente, cabane) garde son toit.
    if (nature) steps.push(() => fillCells(ctx, C, cols, terrain, (_k, i) => rockCells.has(i), tex(['roche', 'eboulis'], 'roche'), 0.95));
  }
  for (const s of steps) { if (!alive()) return; await s(); }
  if (!alive()) return;
  const clear = async (cells: Set<number>) => fillCells(ctx, C, cols, terrain, (_k, i) => cells.has(i), under, 1);

  if (mode !== 'interieur') {
    // Toits : chaque bâtiment (rectangle, L, T, U…) reçoit le toit qui épouse sa forme, dans la bonne orientation.
    for (const g of groups(terrain, cols, rows, '#').filter((q) => !nature || compact(q))) {
      const wC = g.x1 - g.x0 + 1, hC = g.y1 - g.y0 + 1;
      if (wC * hC < 4) continue;
      const parts: number[][] = [];
      for (let y = g.y0; y <= g.y1; y++) for (let x = g.x0; x <= g.x1; x++) if (at(x, y) === '#') parts.push([(x - g.x0) / wC, (y - g.y0) / hC, (x - g.x0 + 1) / wC, (y - g.y0 + 1) / hC]);
      const seed = `toit:${g.x0}:${g.y0}`;
      const fit = fitRoof(images, { mask: maskFromParts(parts), w: wC, h: hC, climat, usage: wC * hC * 2.25 > 260 ? 'civique' : 'maison', seed, min: 0.8 });
      if (!fit) continue;
      const im = await load(bankSrc(fit.img, Math.max(wC, hC) * C));
      if (!alive()) return;
      if (!im) continue;
      await clear(new Set(parts.map(([u, v]) => Math.round(g.y0 + v * hC) * cols + Math.round(g.x0 + u * wC))));
      put(ctx, im, (g.x0 + wC / 2) * C, (g.y0 + hC / 2) * C, fit.iw * C, fit.ih * C, (fit.rot * Math.PI) / 2, fit.flip);
    }
    // Fontaine : une petite pièce d'eau ronde ou carrée, en ville, est la fontaine de la place.
    for (const g of groups(terrain, cols, rows, '~')) {
      const wC = g.x1 - g.x0 + 1, hC = g.y1 - g.y0 + 1;
      if (wC > 6 || hC > 6 || Math.abs(wC - hC) > 1 || g.n < 4) continue;
      const img = pickElement(images.filter((im) => im.usage?.includes('place') && /fontaine/i.test(im.nom)), { cat: 'monument', seed: `fontaine:${g.x0}:${g.y0}` });
      if (!img) continue;
      const side = Math.max(wC, hC) * C * 1.05;
      const im = await load(bankSrc(img, side));
      if (!alive()) return;
      if (!im) continue;
      const cells = new Set<number>();
      for (let y = g.y0; y <= g.y1; y++) for (let x = g.x0; x <= g.x1; x++) if (at(x, y) === '~') cells.add(y * cols + x);
      await clear(cells);
      put(ctx, im, (g.x0 + wC / 2) * C, (g.y0 + hC / 2) * C, side, side, ((hash(`f${g.x0}`) % 4) * Math.PI) / 2);
    }
    // Arbres : une couronne par case boisée, débordant un peu sur les voisines, chacune tournée à sa façon.
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] !== 'I') continue;
      const seed = `arbre:${i}`;
      const img = pickElement(images, { cats: ['arbre', 'arbuste'], ...ctxPick, seed });
      if (!img) continue;
      const m = Array.isArray(img.taille) ? Math.min(img.taille[0], 7) : 4;
      const px = Math.max(C * 1.3, Math.min(C * 2.4, (m / CELL_M) * C * 0.5));
      const im = await load(bankSrc(img, px));
      if (!alive()) return;
      if (!im) continue;
      await clear(new Set([i]));
      put(ctx, im, (i % cols + 0.5) * C, (Math.floor(i / cols) + 0.5) * C, px, px, ((hash(seed) % 360) * Math.PI) / 180);
    }
  } else if (!furnished) {
    // Intérieur sans mobilier connu : un obstacle isolé devient un tonneau ou un coffre (sa case est repeinte en plancher
    // dessous). Avec le mobilier du plan, chaque meuble est dessiné tel qu'en navigation (BattleBoard, FurnitureLayer).
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] !== 'I') continue;
      const x = i % cols, y = Math.floor(i / cols);
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) === 'I')) continue;
      const usage = hash(`p${i}`) % 3 ? 'tonneau' : 'coffre';
      const img = pickElement(images.filter((im) => im.usage?.includes(usage)), { cat: 'mobilier', region: 'surface', seed: `p${i}` });
      if (!img?.usage?.includes(usage)) continue;
      const t = Array.isArray(img.taille) ? img.taille : [1, 1];
      const k = (C * 0.9) / (Math.max(t[0], t[1]) / CELL_M) / C;
      const [w, h] = [(t[0] / CELL_M) * C * k, (t[1] / CELL_M) * C * k];
      const im = await load(bankSrc(img, Math.max(w, h)));
      if (!alive()) return;
      if (!im) continue;
      await clear(new Set([i]));
      put(ctx, im, (x + 0.5) * C, (y + 0.5) * C, w, h, ((hash(`a${i}`) % 4) * Math.PI) / 2 + (usage === 'tonneau' ? (hash(`b${i}`) % 90) * 0.0175 : 0));
    }
  }
}
