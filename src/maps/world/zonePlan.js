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
/** Fenêtre (km) d'une zone : [x0, y0, x1, y1]. */
export function zoneBox(km) {
  const w = ZONE_KM, h = (ZONE_KM * ZONE_H) / ZONE_W;
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
  const U = ([x, y]) => [((x - box[0]) / (box[2] - box[0])) * W, ((y - box[1]) / (box[3] - box[1])) * H];
  const t = [], o = [], water = [], roads = [], decor = [];
  const sites = (env.sites ?? []).map((s) => ({ ...s, u: U(s.km) }));

  // Eau du monde : rivières (larges) ; routes du monde (chemins de terre).
  const riverLines = (env.rivers ?? []).flatMap((p) => clipLine(p, box, U));
  for (const l of riverLines) water.push({ pts: l.flat().map(r1), hw: r1(M(7)) });
  // Lacs du monde qui touchent la zone (la mer, elle, reste au-delà : on ne visite pas à pied le large).
  for (const poly of env.lakes ?? []) {
    if (!poly.some(([x, y]) => x > box[0] - 1 && x < box[2] + 1 && y > box[1] - 1 && y < box[3] + 1)) continue;
    water.push({ pts: poly.map(U).flat().map(r1), hw: 0, closed: true });
  }
  const roadLines = (env.roads ?? []).flatMap((p) => clipLine(p, box, U));
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
  if (!linked.length) linked.push([W / 2, H + 10]);
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
  // Végétation : bosquets serrés en forêt, arbres épars ailleurs ; trouées autour des lieux, des sentiers et de l'eau.
  const G = M(90);
  let canopy = '';
  for (let gy = 0; gy < H; gy += G) for (let gx = 0; gx < W; gx += G) {
    const cxk = box[0] + ((gx + G / 2) / W) * (box[2] - box[0]), cyk = box[1] + ((gy + G / 2) / H) * (box[3] - box[1]);
    const s = env.sample(cxk, cyk);
    if (s.water) continue;
    const f = forestAt(cxk, cyk);
    // Densité continue (pas de bord net là où la forêt passe sous un seuil), un peu de hasard par case.
    const n = Math.floor(Math.max(0, f - 0.08) * 4 + r() * 1.4);
    // Canopée vue de loin : une tache par case boisée (hors trouées), la banque dessine les arbres de près.
    const ccx = gx + G / 2 + (r() - 0.5) * G * 0.4, ccy = gy + G / 2 + (r() - 0.5) * G * 0.4, cr = G * (0.35 + 0.45 * f);
    if (f > 0.22 && !clear.some(([qx, qy, qr]) => Math.hypot(qx - ccx, qy - ccy) < qr + cr * 0.7)
      && !trails.some((l) => nearLine(ccx, ccy, l, cr * 0.8)) && !roadLines.some((l) => nearLine(ccx, ccy, l, cr))
      && !brooks.some((l) => nearLine(ccx, ccy, l, cr)) && !riverLines.some((l) => nearLine(ccx, ccy, l, cr + M(6)))) {
      canopy += `M${r1(ccx - cr)} ${r1(ccy)}a${r1(cr)} ${r1(cr)} 0 1 0 ${r1(cr * 2)} 0a${r1(cr)} ${r1(cr)} 0 1 0 ${r1(-cr * 2)} 0`;
    }
    for (let i = 0; i < n; i++) {
      const x = gx + r() * G, y = gy + r() * G;
      const rad = M(7 + f * 10 + r() * 7), keep = rad * 1.25;
      if (clear.some(([qx, qy, qr]) => Math.hypot(qx - x, qy - y) < qr + keep * 0.5 + r() * M(8))) continue;
      if (trails.some((l) => nearLine(x, y, l, M(3) + keep * 0.6)) || roadLines.some((l) => nearLine(x, y, l, M(6) + keep))) continue;
      if (brooks.some((l) => nearLine(x, y, l, M(5) + keep)) || riverLines.some((l) => nearLine(x, y, l, M(9) + keep))) continue;
      t.push(r1(x), r1(y), r1(rad));
    }
  }
  // Quelques rochers épars, plus nombreux en relief.
  const mid = env.sample((box[0] + box[2]) / 2, (box[1] + box[3]) / 2);
  for (let i = 0; i < (mid.e > 900 ? 40 : 10); i++) o.push(r1(r() * W), r1(r() * H), r1(M(2 + r() * 4)), r1(M(2 + r() * 3)), Math.round(r() * 3000) / 1000);
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
      ground: { b: [], f: [], t, o, p: [], walls: [], water, roads } },
  };
}
