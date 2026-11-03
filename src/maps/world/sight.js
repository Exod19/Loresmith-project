/**
 * Ce que le groupe voit en entrant dans une pièce : tout ce qui est évident (occupants, mobilier nommé, escaliers,
 * pièces) dans son champ de vision, c'est-à-dire sans mur entre lui et la chose, à portée de regard. Ce qui est caché
 * (PNJ embusqué, passage secret, repère du MJ) reste caché.
 *
 * JavaScript pur, testé par sight.test.mjs. Points des lieux en 0–1 du plan ; murs en unités de plan (W × H).
 */

function cross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return t > 0.001 && t < 0.999 && u >= 0 && u <= 1;
}

/** Un mur coupe-t-il la ligne de vue entre (ax, ay) et (bx, by) ? Le trait du mur compte avec sa demi-épaisseur. */
export function blocked(walls, ax, ay, bx, by) {
  for (const w of walls ?? []) {
    const p = w.pts ?? [];
    for (let i = 0; i + 3 < p.length; i += 2) if (cross(ax, ay, bx, by, p[i], p[i + 1], p[i + 2], p[i + 3])) return true;
  }
  return false;
}

/** Ce qui ne se voit pas d'office : PNJ caché, passage secret, repère posé par le MJ. */
const concealed = (f) => !!f.hiddenNpc || f.trace === 'secret' || f.id.includes(':mk-') || /:secret/.test(f.id);

/**
 * Lieux visibles depuis `at` (0–1) sur le plan `map` : identifiants des lieux ponctuels et des tracés (escaliers) dont
 * un point se voit sans mur interposé, à moins de `range` mètres. `features`, `geometries` : données de l'Atlas.
 */
export function visibleFrom(map, at, features, geometries, range = 30) {
  const W = map.width, H = map.height;
  const scale = map.surface?.scale ?? 1;
  const walls = map.surface?.ground?.walls ?? [];
  const ax = at[0] * W, ay = at[1] * H;
  const reach = range / scale;
  const byId = new Map(features.map((f) => [f.id, f]));
  const out = new Set();
  for (const g of geometries) {
    if (g.mapId !== map.id || out.has(g.featureId)) continue;
    const f = byId.get(g.featureId);
    if (!f || concealed(f)) continue;
    const pts = g.type === 'point' ? [g.coordinates] : g.coordinates;
    for (const [x, y] of pts) {
      const bx = x * W, by = y * H;
      if (Math.hypot(bx - ax, by - ay) > reach) continue;
      if (!blocked(walls, ax, ay, bx, by)) { out.add(f.id); break; }
    }
  }
  return [...out];
}
