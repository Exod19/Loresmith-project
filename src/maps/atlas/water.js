/**
 * Eaux des plans de navigation : formes (rivières en polylignes avec leur demi-largeur, lacs et mer en polygones),
 * indépendantes des matières ; dégradé de profondeur et berges tirés des contours.
 *
 * JavaScript pur : testé par water.test.mjs.
 */

/** Tracé SVG d'une polyligne à plat [x0, y0, x1, y1, …] (fermé si `closed`). */
export function pathOf(flat, closed = false) {
  if (!flat || flat.length < 4) return '';
  let d = `M${flat[0]} ${flat[1]}`;
  for (let i = 2; i + 1 < flat.length; i += 2) d += `L${flat[i]} ${flat[i + 1]}`;
  return closed ? `${d}Z` : d;
}

/**
 * Scène d'eau d'un plan : `ground.water` (rivières : { pts, hw } ; mer et lacs : { pts, closed }), en unités de plan.
 * Renvoie { rivers: [{ d, hw }], lakes: [{ d }], bounds: [x0, y0, x1, y1] | null }.
 */
export function waterScene(ground) {
  const rivers = [], lakes = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const w of ground?.water ?? []) {
    if (!w?.pts || w.pts.length < 4) continue;
    const pad = w.closed ? 0 : w.hw ?? 0;
    for (let i = 0; i + 1 < w.pts.length; i += 2) {
      x0 = Math.min(x0, w.pts[i] - pad); x1 = Math.max(x1, w.pts[i] + pad);
      y0 = Math.min(y0, w.pts[i + 1] - pad); y1 = Math.max(y1, w.pts[i + 1] + pad);
    }
    if (w.closed) lakes.push({ d: pathOf(w.pts, true) });
    else if (w.hw > 0) rivers.push({ d: pathOf(w.pts), hw: w.hw });
  }
  return { rivers, lakes, bounds: Number.isFinite(x0) ? [x0, y0, x1, y1] : null };
}

/**
 * Paliers de profondeur d'une rivière : traits concentriques de plus en plus étroits et opaques, du bord (peu profond)
 * vers le milieu (profond). Superposés dans un seul masque, ils font un dégradé progressif, et les rivières qui se
 * rejoignent fusionnent sans couture (même masque, mêmes paliers). `steps` paliers ; renvoie [{ width, opacity }].
 */
export function depthSteps(hw, steps = 12) {
  const out = [];
  for (let k = 0; k < steps; k++) {
    const f = 0.9 - (0.75 * k) / Math.max(1, steps - 1); // 90 % → 15 % de la largeur
    // Chaque palier ajoute un peu de profondeur ; cumulés, ils donnent 90 % au milieu, sans marche visible.
    out.push({ width: 2 * hw * f, opacity: 1 - 0.1 ** (1 / steps) });
  }
  return out;
}

/**
 * Bandes de rivage d'un lac ou de la mer : traits noirs sur le contour, dans le masque de profondeur (la bordure reste
 * peu profonde), de plus en plus fins. `band` : largeur du haut-fond en unités de plan.
 */
export function shoreSteps(band, steps = 12) {
  const out = [];
  for (let k = 0; k < steps; k++) out.push({ width: 2 * band * (1 - k / steps), opacity: 1 - 0.08 ** (1 / steps) });
  return out;
}

/** Matières selon le climat et la nature de l'eau : { shallow, deep } (critères pour la banque). */
export function waterMaterials({ climate = 'tempere', kind = 'riviere' } = {}) {
  if (climate === 'chaud') return { shallow: ['claire', 'boueuse'], deep: ['profonde'] };
  if (kind === 'mer') return { shallow: climate === 'froid' ? ['boueuse', 'claire'] : ['claire', 'boueuse'], deep: ['profonde'] };
  return { shallow: ['boueuse', 'claire'], deep: ['profonde'] };
}

/** Couleur de berge (terre mouillée, sable, neige) selon le climat. */
export function bankColor({ climate = 'tempere', snow = 0, sea = false } = {}) {
  if (snow >= 0.3) return '#d9e0e4';
  if (climate === 'chaud' || sea) return climate === 'froid' ? '#8a8578' : '#c4ad7c';
  if (climate === 'froid') return '#6f6a5e';
  return '#6d5c41';
}
