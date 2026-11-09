/**
 * Les environs, à pied : un plan d'environ 4 × 3,2 km autour d'un point de pleine nature de la carte du monde, pour
 * visiter une forêt, une lande ou un vallon sans cité ni lieu particulier. On y voit ce que la carte du monde ne peut
 * pas montrer à son échelle : les bosquets et les clairières, les ruisseaux, les sentiers, les mares, les rochers…
 *
 * - Le terrain vient du monde (forêt, altitude, eau) : un même endroit donne toujours le même plan.
 * - Les rivières et les routes du monde qui traversent la zone y passent.
 * - Chaque petit lieu de la zone (wilds.js : ruisseau, sentier, vieux chêne, clairière…) a sa trouée dans les arbres,
 *   son ruisseau, sa mare ou ses rochers, et un sentier le relie au réseau : on y entre ensuite comme dans tout lieu
 *   sauvage (plan d'une centaine de mètres).
 *
 * Même format que les plans de lieux sauvages (wildPlan.js). JavaScript pur : testé par zonePlan.test.mjs.
 */
export const ZONE_W = 1240;
export const ZONE_H = 1000;
/** Largeur de la zone (km). */
export const ZONE_KM = 4;
/** Mètres par unité de plan. */
export const ZONE_SCALE = (ZONE_KM * 1000) / ZONE_W;

const r1 = (v) => Math.round(v * 10) / 10;
function hash(text) { let h = 2166136261; for (const c of String(text)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) {
  let a = seed | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const M = (m) => m / ZONE_SCALE; // mètres → unités

/** Le plan d'une zone : identifiant stable. */
export const zonePlanId = (wid, key) => `${wid}:zone-${key}:plan`;
/** Clé d'une zone centrée en `km` (à 100 m près). */
export const zoneKey = (km) => `z${Math.round(km[0] * 10)}_${Math.round(km[1] * 10)}`;
/**
 * Marge dessinée autour du plan (part de sa largeur, de chaque côté) : en dézoomant, la forêt, les sentiers et l'eau
 * continuent au-delà du bord au lieu de s'arrêter sur un carré.
 */
export const ZONE_MARGIN = 0.5;
/** Fenêtre (km) d'une zone : [x0, y0, x1, y1] ; `margin` : avec la marge dessinée autour. */
export function zoneBox(km, margin = 0) {
  const w = ZONE_KM * (1 + 2 * margin), h = ((ZONE_KM * ZONE_H) / ZONE_W) * (1 + 2 * margin);
  return [km[0] - w / 2, km[1] - h / 2, km[0] + w / 2, km[1] + h / 2];
}
/** Position d'un point (km) dans le plan de la zone (0–1). */
export function zoneAt(km, p) {
  const [x0, y0, x1, y1] = zoneBox(km);
  return [Math.round(((p[0] - x0) / (x1 - x0)) * 1e5) / 1e5, Math.round(((p[1] - y0) / (y1 - y0)) * 1e5) / 1e5];
}

/** Morceaux d'une polyligne (km) qui passent dans la fenêtre, convertis en unités du plan. */
function clipLine(pts, box, U) {
  const [x0, y0, x1, y1] = box, pad = 0.3;
  const inside = ([x, y]) => x > x0 - pad && x < x1 + pad && y > y0 - pad && y < y1 + pad;
  const out = [];
  let cur = [];
  for (let i = 0; i < pts.length; i++) {
    if (inside(pts[i]) || (i > 0 && inside(pts[i - 1])) || (i + 1 < pts.length && inside(pts[i + 1]))) cur.push(U(pts[i]));
    else if (cur.length) { if (cur.length > 1) out.push(cur); cur = []; }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}
/** Ligne serpentine entre deux points (unités) : un sentier ou un ruisseau qui ne va jamais tout droit. */
function wiggle(a, b, r, amp, steps = 8) {
  const pts = [];
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const ph = r() * 6;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, w = Math.sin(t * Math.PI) * Math.sin(t * 5 + ph) * amp;
    pts.push([a[0] + dx * t + nx * w, a[1] + dy * t + ny * w]);
  }
  return pts;
}
const segDist = (x, y, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], q = dx * dx + dy * dy;
  const t = q ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / q)) : 0;
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
};
const nearLine = (x, y, line, d) => line.some((p, i) => i > 0 && segDist(x, y, line[i - 1], p) < d);

/**
 * Plan de la zone `z` ({ key, km, title }). `env` : `sample(xKm, yKm)` → { forest, e, biome, moist, water } (terrain du
 * monde), `rivers` et `roads` (polylignes en km), `lakes` (polygones en km), `sites` (petits et grands lieux de la zone : { key, km, kind }),
 * `seed` (graine du monde). Renvoie la carte (format des plans de lieux sauvages).
 */
export function generateZonePlan(z, planId, env) {
  const r = rng(hash(`${env.seed ?? 1}:zone:${z.key}`));
  const W = ZONE_W, H = ZONE_H;
  const box = zoneBox(z.km);
  const ext = zoneBox(z.km, ZONE_MARGIN);
  const MX = W * ZONE_MARGIN, MY = H * ZONE_MARGIN;
  const U = ([x, y]) => [((x - box[0]) / (box[2] - box[0])) * W, ((y - box[1]) / (box[3] - box[1])) * H];
  const t = [], o = [], water = [], roads = [], decor = [];
  const sites = (env.sites ?? []).map((s) => ({ ...s, u: U(s.km) }));

  // Eau du monde : rivières (larges) ; routes du monde (chemins de terre).
  const riverLines = (env.rivers ?? []).flatMap((p) => clipLine(p, ext, U));
  for (const l of riverLines) water.push({ pts: l.flat().map(r1), hw: r1(M(7)) });
  // Lacs du monde qui touchent la zone (la mer, elle, reste au-delà : on ne visite pas à pied le large).
  for (const poly of env.lakes ?? []) {
    if (!poly.some(([x, y]) => x > ext[0] - 1 && x < ext[2] + 1 && y > ext[1] - 1 && y < ext[3] + 1)) continue;
    water.push({ pts: poly.map(U).flat().map(r1), hw: 0, closed: true });
  }
  const roadLines = (env.roads ?? []).flatMap((p) => clipLine(p, ext, U));
  for (const l of roadLines) roads.push({ pts: l.flat().map(r1), hw: r1(M(2.5)) });

  // Les petits lieux : ruisseaux qui les traversent, mares, rochers, et un sentier qui les relie au réseau.
  const brooks = [], trails = [];
  const clear = [];
  for (const s of sites) {
    const [x, y] = s.u;
    const k = s.kind;
    clear.push([x, y, M(k === 'clairiere' || k === 'campagne' || k === 'bosquet' ? 45 : k === 'sous-bois' || k === 'fourre' || k === 'sentier' ? 10 : 22)]);
    if (k === 'ruisseau' || k === 'gue' || k === 'cascade' || k === 'source') {
      // Un ruisseau d'un bout de la zone (ou presque) à l'autre, qui passe par le lieu.
      const a = r() * Math.PI, d = M(500 + r() * 500);
      const p0 = [x - Math.cos(a) * d, y - Math.sin(a) * d], p1 = [x + Math.cos(a) * d, y + Math.sin(a) * d];
      const line = [...wiggle(p0, [x, y], r, M(40)), ...wiggle([x, y], p1, r, M(40)).slice(1)];
      brooks.push(line);
      water.push({ pts: line.flat().map(r1), hw: r1(M(k === 'gue' ? 6 : 3.5)) }); // élargi : lisible à l'échelle de la zone
    }
    if (k === 'mare' || k === 'marais' || k === 'oasis') {
      const pts = []; const rx = M(14 + r() * 10), ry = M(10 + r() * 8);
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, kk = 0.85 + r() * 0.3; pts.push(r1(x + Math.cos(a) * rx * kk), r1(y + Math.sin(a) * ry * kk)); }
      water.push({ pts, hw: 0, closed: true });
    }
    if (k === 'rochers' || k === 'eboulis' || k === 'grotte-geant' || k === 'taniere' || k === 'mine') {
      for (let i = 0; i < (k === 'eboulis' ? 14 : 6); i++) { const a = r() * Math.PI * 2, d = r() * M(30); o.push(r1(x + Math.cos(a) * d), r1(y + Math.sin(a) * d), r1(M(3 + r() * 6)), r1(M(3 + r() * 5)), Math.round(r() * 3000) / 1000); }
    }
  }
  // Sentiers : chaque lieu rejoint le plus proche déjà relié (ou la route, ou le bord du plan).
  const linked = roadLines.map((l) => l[Math.floor(l.length / 2)]);
  if (!linked.length) linked.push([W / 2, H + MY + 10]);
  for (const s of [...sites].sort((a, b) => b.u[1] - a.u[1])) {
    const to = linked.map((p) => [p, Math.hypot(p[0] - s.u[0], p[1] - s.u[1])]).sort((a, b) => a[1] - b[1])[0][0];
    if (Math.hypot(to[0] - s.u[0], to[1] - s.u[1]) > M(30)) {
      const line = wiggle(s.u, to, r, M(60), 10);
      trails.push(line);
      roads.push({ pts: line.flat().map(r1), hw: r1(M(1.1)) });
    }
    linked.push(s.u);
  }

  // Le terrain du monde est tiré sur une grille de quelques km : on le lisse (moyenne alentour) et on y ajoute un
  // bruit de lisière, pour que la forêt ait des bords naturels plutôt que des lignes droites.
  const noiseSeed = hash(`${env.seed ?? 1}:zonenoise`);
  const lattice = (i, j) => (hash(`${noiseSeed}:${i}:${j}`) % 1000) / 1000;
  const noise = (x, y) => { // x, y en km ; maille de 400 m, interpolée
    const u = x / 0.4, v = y / 0.4, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const sm = (q) => q * q * (3 - 2 * q), a1 = lattice(i, j), b1 = lattice(i + 1, j), c1 = lattice(i, j + 1), d1 = lattice(i + 1, j + 1);
    return a1 + (b1 - a1) * sm(fu) + (c1 - a1) * sm(fv) + (a1 - b1 - c1 + d1) * sm(fu) * sm(fv);
  };
  const forestAt = (x, y) => {
    let sum = 0, n = 0;
    for (const dx of [-1.2, 0, 1.2]) for (const dy of [-1.2, 0, 1.2]) { const q = env.sample(x + dx, y + dy); if (!q.water) { sum += q.e > 1900 || q.biome === 'desert' ? 0 : q.forest; n++; } }
    return Math.max(0, Math.min(1, (n ? sum / n : 0) + (noise(x, y) - 0.5) * 0.45));
  };
  // Végétation. La forêt est un champ de densité : le terrain du monde (case de 90 m), affiné par un bruit à deux
  // échelles (70 m et 25 m) pour une orée inégale, et creusé par les clairières, les sentiers, l'eau et les routes.
  // La canopée est le contour de ce champ (lignes de niveau), tracé en courbes : pas de ronds, une vraie lisière.
  const G = M(90);
  const ncx = Math.ceil((W + 2 * MX) / G), ncy = Math.ceil((H + 2 * MY) / G);
  const coarse = new Float32Array(ncx * ncy);
  for (let j = 0; j < ncy; j++) for (let i = 0; i < ncx; i++) {
    const gx = -MX + i * G, gy = -MY + j * G;
    const cxk = box[0] + ((gx + G / 2) / W) * (box[2] - box[0]), cyk = box[1] + ((gy + G / 2) / H) * (box[3] - box[1]);
    coarse[j * ncx + i] = env.sample(cxk, cyk).water ? -1 : forestAt(cxk, cyk);
  }
  const coarseAt = (x, y) => { // bilinéaire entre les centres des cases de 90 m
    const u = Math.max(0, Math.min(ncx - 1.001, (x + MX) / G - 0.5)), v = Math.max(0, Math.min(ncy - 1.001, (y + MY) / G - 0.5));
    const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, i1 = Math.min(ncx - 1, i + 1), j1 = Math.min(ncy - 1, j + 1);
    const q = (a, b) => coarse[b * ncx + a];
    return (q(i, j) * (1 - fu) + q(i1, j) * fu) * (1 - fv) + (q(i, j1) * (1 - fu) + q(i1, j1) * fu) * fv;
  };
  const kmOf = (x, y) => [box[0] + (x / W) * (box[2] - box[0]), box[1] + (y / H) * (box[3] - box[1])];
  const S = M(18), T = 0.4; // maille du champ (18 m), seuil de la canopée
  const nx = Math.ceil((W + 2 * MX) / S) + 3, ny = Math.ceil((H + 2 * MY) / S) + 3;
  const X = (i) => -MX + (i - 1) * S, Y = (j) => -MY + (j - 1) * S;
  const field = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) { field[j * nx + i] = -1; continue; } // bord fermé : contours bouclés
    const [kx, ky] = kmOf(X(i), Y(j));
    const base = coarseAt(X(i), Y(j));
    field[j * nx + i] = base < 0 ? -1 : base + (noise(kx * 5.7, ky * 5.7) - 0.5) * 0.42 + (noise(kx * 16, ky * 16) - 0.5) * 0.14;
  }
  // Trouées : chaque obstacle abaisse le champ autour de lui, avec un bord progressif (le bruit fait le reste).
  const carve = (x0, y0, x1, y1, dist) => {
    const i0 = Math.max(1, Math.floor((x0 + MX) / S) + 1), i1 = Math.min(nx - 2, Math.ceil((x1 + MX) / S) + 1);
    const j0 = Math.max(1, Math.floor((y0 + MY) / S) + 1), j1 = Math.min(ny - 2, Math.ceil((y1 + MY) / S) + 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const a = dist(X(i), Y(j));
      if (a > 0) field[j * nx + i] -= a;
    }
  };
  const fall = (d, w, soft) => Math.max(0, Math.min(1, 1 - (d - w) / soft)) * 1.6;
  for (const [qx, qy, qr] of clear) carve(qx - qr - M(40), qy - qr - M(40), qx + qr + M(40), qy + qr + M(40), (x, y) => fall(Math.hypot(x - qx, y - qy), qr * 0.8, M(30)));
  const carveLine = (line, w, soft) => {
    for (let k = 1; k < line.length; k++) {
      const a = line[k - 1], b = line[k], pad = w + soft;
      carve(Math.min(a[0], b[0]) - pad, Math.min(a[1], b[1]) - pad, Math.max(a[0], b[0]) + pad, Math.max(a[1], b[1]) + pad, (x, y) => fall(segDist(x, y, a, b), w, soft));
    }
  };
  for (const l of trails) carveLine(l, M(3), M(10));
  for (const l of brooks) carveLine(l, M(4), M(10));
  for (const l of roadLines) carveLine(l, M(6), M(12));
  for (const l of riverLines) carveLine(l, M(10), M(14));
  const fieldAt = (x, y) => {
    const u = Math.max(0, Math.min(nx - 1.001, (x + MX) / S + 1)), v = Math.max(0, Math.min(ny - 1.001, (y + MY) / S + 1));
    const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const q = (a, b) => field[b * nx + a];
    return (q(i, j) * (1 - fu) + q(i + 1, j) * fu) * (1 - fv) + (q(i, j + 1) * (1 - fu) + q(i + 1, j + 1) * fu) * fv;
  };

  // Contour de la canopée (carrés marchants) : segments reliés par arête de grille, puis bouclés et adoucis.
  const pts = new Map(), adj = new Map();
  const edgePt = (key, xa, ya, va, xb, yb, vb) => {
    if (!pts.has(key)) { const k = (T - va) / (vb - va || 1e-6); pts.set(key, [xa + (xb - xa) * k, ya + (yb - ya) * k]); }
    return key;
  };
  const link = (p, q) => { (adj.get(p) ?? adj.set(p, []).get(p)).push(q); (adj.get(q) ?? adj.set(q, []).get(q)).push(p); };
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = field[j * nx + i], b = field[j * nx + i + 1], c = field[(j + 1) * nx + i + 1], d = field[(j + 1) * nx + i];
    const code = (a >= T ? 8 : 0) | (b >= T ? 4 : 0) | (c >= T ? 2 : 0) | (d >= T ? 1 : 0);
    if (code === 0 || code === 15) continue;
    const x0 = X(i), y0 = Y(j), x1 = X(i + 1), y1 = Y(j + 1);
    const top = () => edgePt(`h${i},${j}`, x0, y0, a, x1, y0, b), bottom = () => edgePt(`h${i},${j + 1}`, x0, y1, d, x1, y1, c);
    const left = () => edgePt(`v${i},${j}`, x0, y0, a, x0, y1, d), right = () => edgePt(`v${i + 1},${j}`, x1, y0, b, x1, y1, c);
    const mid = (a + b + c + d) / 4 >= T;
    switch (code) {
      case 1: case 14: link(left(), bottom()); break;
      case 2: case 13: link(bottom(), right()); break;
      case 3: case 12: link(left(), right()); break;
      case 4: case 11: link(top(), right()); break;
      case 6: case 9: link(top(), bottom()); break;
      case 7: case 8: link(left(), top()); break;
      case 5: if (mid) { link(left(), top()); link(bottom(), right()); } else { link(top(), right()); link(left(), bottom()); } break;
      case 10: if (mid) { link(top(), right()); link(left(), bottom()); } else { link(left(), top()); link(bottom(), right()); } break;
      default: break;
    }
  }
  let canopy = '';
  const seen = new Set();
  for (const startKey of adj.keys()) {
    if (seen.has(startKey)) continue;
    const loop = [];
    let prev = null, cur = startKey;
    while (cur && !seen.has(cur)) {
      seen.add(cur); loop.push(pts.get(cur));
      const next = (adj.get(cur) ?? []).find((q) => q !== prev && !seen.has(q));
      prev = cur; cur = next;
    }
    // Miettes (moins de ~40 m de tour) : ni bosquet ni trouée, on les laisse de côté.
    if (loop.length < 9) continue;
    // Adoucissement (Chaikin, une passe) : la lisière ondule au lieu de suivre la grille.
    const sm = [];
    for (let k = 0; k < loop.length; k++) {
      const p0 = loop[k], p1 = loop[(k + 1) % loop.length];
      sm.push([p0[0] * 0.75 + p1[0] * 0.25, p0[1] * 0.75 + p1[1] * 0.25], [p0[0] * 0.25 + p1[0] * 0.75, p0[1] * 0.25 + p1[1] * 0.75]);
    }
    canopy += 'M' + sm.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L') + 'Z';
  }

  // Arbres : sous la canopée (`tc`), une vraie forêt dessinée seulement de près, quand la canopée s'efface ; ailleurs
  // (`t`), des arbres isolés, toujours seuls, jamais posés sur la canopée. Chacun à son niveau.
  const tc = [];
  for (let gy = -MY; gy < H + MY; gy += G) for (let gx = -MX; gx < W + MX; gx += G) {
    const near = gx > -W * 0.15 && gx < W * 1.15 && gy > -H * 0.15 && gy < H * 1.15;
    if (!near) continue;
    const f = coarseAt(gx + G / 2, gy + G / 2);
    if (f < 0) continue;
    const denseCell = fieldAt(gx + G / 2, gy + G / 2) >= T;
    const n = denseCell ? Math.floor(Math.max(0, f - 0.08) * 11 + r() * 2) : Math.floor(Math.max(0, f - 0.08) * 4 + r() * 1.4);
    for (let i = 0; i < n; i++) {
      const x = gx + r() * G, y = gy + r() * G;
      const rad = M(7 + f * 10 + r() * 7), keep = rad * 1.25;
      if (clear.some(([qx, qy, qr]) => Math.hypot(qx - x, qy - y) < qr + keep * 0.5 + r() * M(8))) continue;
      if (trails.some((l) => nearLine(x, y, l, M(3) + keep * 0.6)) || roadLines.some((l) => nearLine(x, y, l, M(6) + keep))) continue;
      if (brooks.some((l) => nearLine(x, y, l, M(5) + keep)) || riverLines.some((l) => nearLine(x, y, l, M(9) + keep))) continue;
      // Sous la canopée ou à sa lisière : arbre de la forêt ; loin d'elle : arbre isolé.
      const v = Math.max(fieldAt(x, y), fieldAt(x + rad, y), fieldAt(x - rad, y), fieldAt(x, y + rad), fieldAt(x, y - rad));
      (v >= T - 0.04 ? tc : t).push(r1(x), r1(y), r1(rad));
    }
  }
  // Quelques rochers épars, plus nombreux en relief.
  const mid = env.sample((box[0] + box[2]) / 2, (box[1] + box[3]) / 2);
  for (let i = 0; i < (mid.e > 900 ? 40 : 10); i++) o.push(r1(r() * W * 1.3 - W * 0.15), r1(r() * H * 1.3 - H * 0.15), r1(M(2 + r() * 4)), r1(M(2 + r() * 3)), Math.round(r() * 3000) / 1000);
  // Tracés de repli, visibles de loin (la banque dessine les arbres et l'eau quand on s'approche) : canopée, eaux.
  if (canopy) decor.push({ kind: 'forest', d: canopy });
  for (const wl of water) {
    let d = ''; for (let i = 0; i + 1 < wl.pts.length; i += 2) d += `${i ? 'L' : 'M'}${wl.pts[i]} ${wl.pts[i + 1]}`;
    decor.push(wl.closed ? { kind: 'lake', d: `${d}Z` } : { kind: 'river', d, w: r1(Math.max(wl.hw * 2, M(4))) });
  }
  const rect = (x, y, w2, d2, ang) => { const c = Math.cos(ang), sn = Math.sin(ang); return 'M' + [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => `${r1(x + (u * w2 * c - v * d2 * sn) / 2)} ${r1(y + (u * w2 * sn + v * d2 * c) / 2)}`).join('L') + 'Z'; };
  for (let i = 0; i + 4 < o.length; i += 5) decor.push({ kind: 'pillar', d: rect(o[i], o[i + 1], o[i + 2], o[i + 3], o[i + 4]) });

  const climate = mid.biome === 'neige' || mid.biome === 'taiga' ? 'froid' : mid.biome === 'desert' || mid.biome === 'steppe' ? 'chaud' : 'tempere';
  return {
    id: planId, title: z.title, scope: { kind: 'site', id: `${planId}:site` }, width: W, height: H,
    defaultViewport: { x: 0.5, y: 0.5, zoom: 1 }, decor,
    surface: { scale: ZONE_SCALE, theme: 'cite', nature: true, zone: true, climate, snow: mid.biome === 'neige' ? 0.5 : undefined,
      ground: { b: [], f: [], t, tc, o, p: [], walls: [], water, roads } },
  };
}
