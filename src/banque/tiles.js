/**
 * Tuiles tactiques de la banque (rivière, gué, baie, ravin…) : une image qui couvre tout le plateau de combat, et le
 * terrain de chaque case, lu dans l'image elle-même. L'eau bleue devient de l'eau (profonde si elle est sombre), le noir
 * d'un ravin un gouffre, l'herbe de l'herbe, la roche grise un sol rocheux ; sur une tuile de gué, les galets sont un
 * gué. Le MJ corrige ensuite case par case, comme d'habitude.
 *
 * JavaScript pur (testé par tiles.test.mjs) ; le chargement de l'image se fait dans le navigateur (tileCellsOf).
 */

/** Terrain d'un pixel. `ford` : tuile de gué (les galets clairs y sont un gué). */
export function classifyPixel(r, g, b, ford = false) {
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum < 0.11) return 'gouffre';
  const hi = Math.max(r, g, b), lo = Math.min(r, g, b);
  // Eau : plus bleue que rouge (turquoise des rivières, vert-bleu sombre des eaux profondes).
  if (b > r + 15 && b >= g - 30) return lum < 0.22 ? 'eau_profonde' : 'eau_peu_profonde';
  // Herbe des prairies peintes : olive (vert et rouge proches, nettement plus que le bleu) ; plus rouge, c'est de la terre.
  if (g > b + 22 && g >= r - 12) return 'herbe';
  if (hi - lo < 28) return ford ? 'gue' : lum < 0.2 ? 'escarpement' : 'granite';
  return ford ? 'gue' : 'terre';
}

/**
 * Terrain de chaque case d'un plateau `cols` × `rows` couvert par l'image (w × h pixels, RGBA), cadrée comme en CSS
 * « cover » (centrée, rognée sur le côté qui dépasse). Vote sur 5 × 5 points par case ; renvoie un tableau de terrains.
 */
export function tileCells(data, w, h, cols, rows, ford = false) {
  const s = Math.max(cols / w, rows / h); // unités de plateau par pixel
  const ox = (cols - w * s) / 2, oy = (rows - h * s) / 2;
  const out = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const votes = {};
      for (let j = 0; j < 5; j++) {
        for (let i = 0; i < 5; i++) {
          const px = Math.min(w - 1, Math.max(0, Math.floor((x + (i + 0.5) / 5 - ox) / s)));
          const py = Math.min(h - 1, Math.max(0, Math.floor((y + (j + 0.5) / 5 - oy) / s)));
          const k = (py * w + px) * 4;
          const t = classifyPixel(data[k], data[k + 1], data[k + 2], ford);
          votes[t] = (votes[t] ?? 0) + 1;
        }
      }
      // Un gouffre ou de l'eau profonde qui couvre au moins 40 % de la case l'emporte : on ne marche pas au bord du vide.
      let best = null, n = 0;
      for (const [t, c] of Object.entries(votes)) if (c > n) { best = t; n = c; }
      if ((votes.gouffre ?? 0) >= 10) best = 'gouffre';
      else if ((votes.eau_profonde ?? 0) >= 10 && best !== 'gouffre') best = 'eau_profonde';
      out.push(best);
    }
  }
  // Lissage : une case isolée au milieu d'un gouffre (une ombre sur la paroi) ou d'eau profonde (un reflet) prend le
  // terrain de ses voisines, pour qu'aucun jeton ne se retrouve « à l'abri » sur un îlot qui n'existe pas.
  const smooth = out.slice();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (out[i] === 'gouffre' || out[i] === 'eau_profonde') continue;
      const n = { gouffre: 0, eau_profonde: 0 };
      let around = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
        around++;
        const t = out[yy * cols + xx];
        if (t in n) n[t]++;
      }
      if (n.gouffre >= Math.ceil(around * 0.6)) smooth[i] = 'gouffre';
      else if (n.eau_profonde >= Math.ceil(around * 0.6)) smooth[i] = 'eau_profonde';
    }
  }
  return smooth;
}

/** Tuile de gué ? (d'après son identifiant ou son nom). */
export const isFordTile = (img) => /(^|-)gue(-|$)|gué/i.test(`${img?.id ?? ''} ${img?.nom ?? ''}`);
