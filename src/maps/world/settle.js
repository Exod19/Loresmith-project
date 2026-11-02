/**
 * Place des occupants d'un intérieur : chacun à un endroit plausible.
 * - Personne sur une table, un comptoir, un tonneau, un escalier, dans un bac ou dans un mur ; jamais deux
 *   personnes l'une sur l'autre.
 * - Un dormeur est dans un lit (le plus proche encore libre), couché (`pose: 'couche'`). S'il n'y a plus de lit,
 *   un occupant anonyme ne dort pas là (il est retiré) ; un PNJ du lore reste, éveillé.
 *
 * JavaScript pur, testé par settle.test.mjs. Coordonnées des lieux en 0–1 du plan (W × H unités) ; sol en unités de
 * plan ; `scale` : mètres par unité.
 */

const PERSON_M = 0.35; // demi-largeur d'une personne, marge comprise
const APART_M = 0.95; // distance minimale entre deux personnes

/** Rectangles [cx, cy, w, h, angle] à plat → liste. */
function rects(flat = []) {
  const out = [];
  for (let i = 0; i + 4 < flat.length; i += 5) out.push({ x: flat[i], y: flat[i + 1], w: flat[i + 2], h: flat[i + 3], a: flat[i + 4] || 0 });
  return out;
}

/** Le point (x, y) est-il dans le rectangle tourné, agrandi de `pad` ? */
function inRect(r, x, y, pad) {
  const c = Math.cos(-r.a), s = Math.sin(-r.a);
  const dx = x - r.x, dy = y - r.y;
  const u = dx * c - dy * s, v = dx * s + dy * c;
  return Math.abs(u) <= r.w / 2 + pad && Math.abs(v) <= r.h / 2 + pad;
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

const isSleeper = (f) => /^dort\b/i.test(String(f.summary ?? '').trim());

/**
 * Corrige les positions des PNJ (`:pnj-`) d'un niveau d'intérieur. `level` : { map, features, geometries } tel que
 * produit par generateInterior ; modifié en place. `W`, `H` : taille du plan en unités ; `keep` : identifiants
 * `pnj-…` à ne pas déplacer (résidents posés par le MJ).
 */
export function settleOccupants(level, W, H, keep = new Set()) {
  const ground = level.map?.surface?.ground;
  const scale = level.map?.surface?.scale;
  if (!ground || !scale) return level;
  const m = (v) => v / scale;
  const obstacles = [...rects(ground.f), ...rects(ground.o)];
  const water = (ground.water ?? []).filter((w) => !w.closed && w.pts?.length >= 4);
  const walls = ground.walls ?? [];
  const beds = (ground.p ?? []).filter((p) => p[0] === 'lit').map(([, x, y, w, h, a]) => ({ x, y, w, h, a: a || 0, taken: false }));
  // Emprise du bâtiment : le mur extérieur (premier tracé).
  const outer = walls[0]?.pts ?? [];
  const xs = outer.filter((_, i) => i % 2 === 0), ys = outer.filter((_, i) => i % 2 === 1);
  const box = xs.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : [0, 0, W, H];

  const placed = [];
  const stairs = (level.anchors ?? []).map((a) => [a.at[0] * W, a.at[1] * H]);
  const free = (x, y) => {
    const pad = m(PERSON_M);
    if (x < box[0] + pad + m(0.15) || y < box[1] + pad + m(0.15) || x > box[2] - pad - m(0.15) || y > box[3] - pad - m(0.15)) return false;
    if (obstacles.some((r) => inRect(r, x, y, pad))) return false;
    for (const w of water) for (let i = 0; i + 3 < w.pts.length; i += 2) if (segDist(x, y, w.pts[i], w.pts[i + 1], w.pts[i + 2], w.pts[i + 3]) < w.hw + pad) return false;
    for (const w of walls) for (let i = 0; i + 3 < w.pts.length; i += 2) if (segDist(x, y, w.pts[i], w.pts[i + 1], w.pts[i + 2], w.pts[i + 3]) < w.hw + pad) return false;
    // Ni sur un escalier ni sur une trappe : on ne bloque pas le passage.
    if (stairs.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < m(1.6))) return false;
    return !placed.some(([px, py]) => Math.hypot(px - x, py - y) < m(APART_M));
  };
  /** Point libre le plus proche de (x, y), en spirale, jusqu'à 6 m. */
  const nearestFree = (x, y) => {
    if (free(x, y)) return [x, y];
    for (let r = m(0.25); r <= m(6); r += m(0.25)) {
      const n = Math.max(8, Math.round((2 * Math.PI * r) / m(0.3)));
      for (let k = 0; k < n; k++) {
        const a = (2 * Math.PI * k) / n;
        const qx = x + Math.cos(a) * r, qy = y + Math.sin(a) * r;
        if (free(qx, qy)) return [qx, qy];
      }
    }
    return null;
  };

  const geo = new Map(level.geometries.filter((g) => g.type === 'point').map((g) => [g.featureId, g]));
  const drop = new Set();
  // Les PNJ du lore d'abord (leur place compte), puis les anonymes.
  // Résidents posés par le MJ : intouchés, mais on ne pose personne sur eux.
  for (const f of level.features) if (keep.has(f.id.slice(f.id.indexOf(':pnj-') + 1)) && geo.has(f.id)) placed.push([geo.get(f.id).coordinates[0] * W, geo.get(f.id).coordinates[1] * H]);
  const npcs = level.features.filter((f) => f.id.includes(':pnj-') && geo.has(f.id) && !keep.has(f.id.slice(f.id.indexOf(':pnj-') + 1)))
    .sort((a, b) => Number(a.id.includes(':pnj-gen-')) - Number(b.id.includes(':pnj-gen-')));
  for (const f of npcs) {
    const g = geo.get(f.id);
    const x = g.coordinates[0] * W, y = g.coordinates[1] * H;
    if (isSleeper(f)) {
      const bed = beds.filter((b) => !b.taken).sort((p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y))[0];
      if (bed) {
        bed.taken = true;
        f.pose = 'couche';
        g.coordinates = [Math.round((bed.x / W) * 1e5) / 1e5, Math.round((bed.y / H) * 1e5) / 1e5];
        placed.push([bed.x, bed.y]);
        continue;
      }
      // Pas de lit : un anonyme ne dort pas là ; un PNJ du lore reste, éveillé.
      if (f.id.includes(':pnj-gen-')) { drop.add(f.id); continue; }
      f.summary = String(f.summary).replace(/^\s*Dort\.?\s*/i, '').trim() || undefined;
    }
    const at = nearestFree(x, y);
    if (!at) { if (f.id.includes(':pnj-gen-')) drop.add(f.id); continue; }
    placed.push(at);
    g.coordinates = [Math.round((at[0] / W) * 1e5) / 1e5, Math.round((at[1] / H) * 1e5) / 1e5];
  }
  if (drop.size) {
    level.features = level.features.filter((f) => !drop.has(f.id));
    level.geometries = level.geometries.filter((g) => !drop.has(g.featureId));
  }
  return level;
}
