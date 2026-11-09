/**
 * Lecture d'un plateau de surface généré (un caractère par case) : profondeur de l'eau, dehors d'un intérieur, ville ou
 * campagne, et terrain réel de chaque case pour le socle des jetons. Partagé par l'habillage du plateau
 * (src/banque/boardDress.ts) et par les socles : le socle montre le sol tel qu'il est peint.
 *
 * Purement visuel : ces terrains ne changent pas les règles de déplacement (voir surface.ts).
 */
import type { BoardTheme } from './theme';
import type { TerrainId } from './surface';

/**
 * Profondeur de l'eau en cases : 1 au bord, 2 ensuite, 3 et plus au large (distance à la terre) ; -1 pour une case de
 * terre qui touche l'eau (la berge) ; 0 ailleurs.
 */
export function waterDepth(terrain: string, cols: number, rows: number) {
  const out = new Int16Array(terrain.length);
  const queue: number[] = [];
  const nb = (i: number) => { const x = i % cols, y = Math.floor(i / cols); return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < cols && b < rows).map(([a, b]) => b * cols + a); };
  for (let i = 0; i < terrain.length; i++) {
    if (terrain[i] !== '~') continue;
    if (nb(i).some((j) => terrain[j] !== '~')) { out[i] = 1; queue.push(i); }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    for (const j of nb(i)) if (terrain[j] === '~' && !out[j]) { out[j] = out[i] + 1; queue.push(j); }
  }
  for (let i = 0; i < terrain.length; i++) if (terrain[i] !== '~' && nb(i).some((j) => terrain[j] === '~')) out[i] = -1;
  // Eau sans rivage dans le cadre (le large) : profonde partout.
  for (let i = 0; i < terrain.length; i++) if (terrain[i] === '~' && !out[i]) out[i] = 9;
  return out;
}

/** Cases du dehors d'un intérieur : même règle que le plateau peint (BattleBoard, paintInterior). */
export function outsideOf(terrain: string, cols: number, rows: number) {
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= cols || y >= rows ? '#' : terrain[y * cols + x]);
  // Embrasure : une case libre entre deux murs qui se font face, à une ou deux cases de part et d'autre (une porte de
  // 2 m occupe deux cases ; sans cela, le dehors entrerait dans le bâtiment par la porte).
  const wallNear = (x: number, y: number, dx: number, dy: number) => at(x + dx, y + dy) === '#' || (at(x + dx, y + dy) !== '#' && at(x + 2 * dx, y + 2 * dy) === '#');
  const doorway = (x: number, y: number) => (wallNear(x, y, -1, 0) && wallNear(x, y, 1, 0) && (at(x - 1, y) === '#' || at(x + 1, y) === '#'))
    || (wallNear(x, y, 0, -1) && wallNear(x, y, 0, 1) && (at(x, y - 1) === '#' || at(x, y + 1) === '#'));
  const out = new Set<number>();
  const queue: number[] = [];
  for (let i = 0; i < terrain.length; i++) {
    const x = i % cols, y = Math.floor(i / cols);
    if ((x === 0 || y === 0 || x === cols - 1 || y === rows - 1) && terrain[i] !== '#') { out.add(i); queue.push(i); }
  }
  while (queue.length) {
    const i = queue.pop()!, x = i % cols, y = Math.floor(i / cols);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, j = ny * cols + nx;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || out.has(j) || terrain[j] === '#' || doorway(nx, ny)) continue;
      out.add(j); queue.push(j);
    }
  }
  return out;
}

/** En ville (beaucoup de bâti, peu de champs), le sol libre est pavé ; à la campagne, c'est de la terre. */
export function isUrban(terrain: string, nature = false) {
  const count = (k: string) => terrain.split(k).length - 1;
  // Une place sans bâtiment dans le cadre (ni champ, ni bosquet) compte comme la ville.
  return !nature && (count('#') / terrain.length > 0.08 || (count(',') === 0 && count('I') < terrain.length * 0.02)) && count(',') / terrain.length < 0.1;
}

const memo = new Map<string, (TerrainId | undefined)[]>();

/**
 * Terrain peint sous chaque case d'un plateau de surface ou d'intérieur (`theme`), pour choisir le socle d'un jeton :
 * pavés en ville, terre à la campagne, sable au désert, neige l'hiver, herbes hautes dans les champs, eau peu profonde
 * près des berges et profonde au large, pont, plancher à l'intérieur. Sans thème (caverne) : rien, le terrain des règles
 * décide.
 */
export function groundCells(terrain: string | undefined, cols: number, rows: number, theme: BoardTheme | undefined): (TerrainId | undefined)[] | undefined {
  if (!terrain || !theme) return undefined;
  const key = `${theme}|${cols}|${terrain}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const out: (TerrainId | undefined)[] = new Array(terrain.length);
  if (theme === 'interieur') {
    const outside = outsideOf(terrain, cols, rows);
    for (let i = 0; i < terrain.length; i++) {
      const k = terrain[i];
      out[i] = k === '#' ? 'dalles' : outside.has(i) ? 'route' : k === '~' ? 'eau_peu_profonde' : 'plancher';
    }
  } else {
    const nature = theme.endsWith('-nature');
    const mode = theme.includes('neige') ? 'neige' : theme.includes('chaud') ? 'chaud' : theme.includes('froid') ? 'froid' : 'tempere';
    const sol: TerrainId = mode === 'neige' ? 'neige' : mode === 'chaud' ? 'sable' : isUrban(terrain, nature) ? 'route' : mode === 'froid' ? 'toundra' : nature ? 'herbe' : 'terre';
    const depth = mode === 'neige' ? null : waterDepth(terrain, cols, rows);
    for (let i = 0; i < terrain.length; i++) {
      const k = terrain[i];
      out[i] = k === '.' ? sol
        : k === ',' ? (mode === 'neige' ? 'neige' : 'herbes_hautes')
        : k === '~' ? (!depth ? 'glace' : depth[i] >= 2 ? 'eau_profonde' : 'eau_peu_profonde')
        : k === '=' ? 'pont'
        : k === ':' ? (mode === 'neige' ? 'neige' : 'eboulis')
        : k === 'I' ? (mode === 'neige' ? 'neige' : mode === 'chaud' ? 'sable' : 'sous_bois')
        : k === '#' ? (nature ? 'granite' : 'dalles')
        : undefined;
    }
  }
  if (memo.size > 8) memo.clear();
  memo.set(key, out);
  return out;
}
