/**
 * Plan d'un lieu sauvage enregistré (lot 26) : une clairière d'environ 100 × 80 m autour du lieu, au format des plans
 * de cité (sol, arbres, abris, objets, eau, sentier), que le moteur dessine et dont il tire le plateau de combat.
 *
 * - La végétation suit le terrain du lieu (forêt dense, lisière, plaine nue, désert, neige).
 * - Chaque type a son aménagement : la paroi et la bouche de la grotte, l'anneau de pierres, les tentes du camp, la
 *   cabane, la mare, les murs effondrés…
 * - Quelques points d'intérêt (lieux de la carte) donnent au MJ de quoi décrire et faire fouiller.
 *
 * Tout est déterministe (graine du monde et clé du lieu). JavaScript pur : testé par wilds.test.mjs.
 */
export const WILD_W = 1240;
export const WILD_H = 1000;
/** Mètres par unité de plan : 1 240 unités ≈ 100 m. */
export const WILD_SCALE = 0.08;

const r1 = (v) => Math.round(v * 10) / 10;
const r5 = (v) => Math.round(v * 1e5) / 1e5;
function hash(text) { let h = 2166136261; for (const c of String(text)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) {
  let a = seed | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const M = (m) => m / WILD_SCALE; // mètres → unités

/** Points d'intérêt par type : titre et ce qu'on y trouve (à lire, à fouiller). `at` : position (0–1) dans le plan. */
const POI = {
  'grotte-geant': [['Bouche de la grotte', 'Haute comme trois hommes ; des marches taillées à coups de massue y montent.', [0.5, 0.28]], ['Tas d’ossements', 'Bœufs, chèvres… et une épée rouillée au milieu (Investigation DD 12).', [0.33, 0.42]], ['Marmite renversée', 'Assez grande pour un homme. Encore tiède ?', [0.64, 0.4]]],
  'nid-wyverne': [['Nid', 'Branches, os et écailles mues ; peut-être des œufs.', [0.5, 0.35]], ['Carcasses', 'Des chamois à moitié dévorés, et le sac d’un chasseur.', [0.32, 0.5]]],
  mine: [['Entrée de la galerie', 'Étayée de poutres vermoulues ; un courant d’air froid en sort.', [0.5, 0.3]], ['Wagonnet', 'Renversé sur ses rails ; du minerai à l’intérieur.', [0.62, 0.45]], ['Cabane du contremaître', 'Un registre, une lampe, une clé (Investigation DD 13).', [0.3, 0.55]]],
  ermitage: [['Cabane de l’ermite', 'Pierres sèches, une clochette à l’auvent.', [0.5, 0.42]], ['Autel de pierre', 'Des offrandes, des mots gravés sur le seuil.', [0.66, 0.36]]],
  belvedere: [['Promontoire', 'Toute la région à vos pieds (Perception DD 12 : un détail au loin).', [0.5, 0.3]]],
  cascade: [['Bassin', 'Eau verte et profonde ; des pièces brillent au fond.', [0.5, 0.42]], ['Derrière le rideau d’eau', 'Une grotte sèche, des traces de campement (Perception DD 14).', [0.5, 0.25]]],
  'cercle-fees': [['Anneau de champignons', 'Qui y entre entend une musique lointaine (Sagesse DD 13 pour ne pas s’y attarder).', [0.5, 0.48]]],
  'arbre-coeur': [['Arbre-cœur', 'Tronc colossal ; des rubans et des noms gravés dans l’écorce.', [0.5, 0.45]], ['Creux du tronc', 'On peut s’y abriter à quatre ; quelque chose y a dormi.', [0.55, 0.52]]],
  druides: [['Autel de pierre', 'Offrandes fraîches de baies et de gui.', [0.5, 0.45]], ['Vasque', 'Eau de pluie ; le reflet n’est pas tout à fait le vôtre (Arcanes DD 13).', [0.6, 0.55]]],
  'camp-bandits': [['Feu de camp', 'Braises, broches, une marmite de ragoût.', [0.5, 0.48]], ['Tente du chef', 'Coffre fermé (Escamotage DD 14), une carte de la route annotée.', [0.65, 0.38]], ['Guet', 'Un poste caché dans un arbre, vers la route.', [0.28, 0.32]]],
  cabane: [['Cabane', 'Rondins, cheminée, un couvert resté mis.', [0.5, 0.42]], ['Jardin d’herbes', 'Herbes médicinales… et d’autres moins recommandables (Nature DD 12).', [0.66, 0.55]]],
  clairiere: [['Cœur de la clairière', 'Herbe haute, fleurs sauvages, un ruisseau qui chante.', [0.5, 0.5]]],
  taniere: [['Entrée de la tanière', 'Terrier béant sous les racines, odeur de fauve.', [0.5, 0.33]], ['Os et plumes', 'Les restes des derniers repas (Survie DD 12 : quelle bête ?).', [0.36, 0.48]]],
  tumulus: [['Tertre', 'Trop régulier pour être naturel ; une pierre dressée au sommet.', [0.5, 0.42]], ['Entrée scellée', 'Une dalle gravée, à demi dégagée (Force DD 15 pour l’ouvrir).', [0.5, 0.6]]],
  menhirs: [['Cercle de pierres', 'Douze pierres dressées ; au centre, l’herbe ne pousse pas.', [0.5, 0.48]], ['Spirales gravées', 'Une carte des étoiles (Histoire DD 13).', [0.62, 0.4]]],
  'ferme-ruine': [['Ferme brûlée', 'Murs noircis, toit effondré.', [0.48, 0.42]], ['Puits', 'Profond, une corde coupée pend (Perception DD 12 : un bruit en bas).', [0.64, 0.56]]],
  'champ-bataille': [['Cairns des morts', 'De petits cairns à perte de vue.', [0.5, 0.5]], ['Bannière déchirée', 'Aux couleurs d’une maison oubliée (Histoire DD 12).', [0.36, 0.38]]],
  'tour-guet': [['Tour en ruine', 'Escalier en colimaçon, plateforme ouverte au vent.', [0.5, 0.4]], ['Feu de signal', 'Pierres noircies au sommet ; du bois sec prêt à brûler.', [0.5, 0.33]]],
  source: [['Source', 'Eau pure sous un saule ; des pièces anciennes au fond.', [0.5, 0.45]]],
  nomades: [['Grande tente', 'Tapis, coussins, l’odeur des épices.', [0.5, 0.42]], ['Enclos des chevaux', 'Une dizaine de bêtes au piquet.', [0.3, 0.55]]],
  oasis: [['Mare', 'Eau claire sous les palmiers.', [0.5, 0.48]], ['Dalle gravée', 'À demi enfouie au bord de l’eau (Investigation DD 14).', [0.62, 0.6]]],
  'ruines-ensablees': [['Colonnade', 'Des colonnes brisées émergent du sable.', [0.5, 0.42]], ['Statue colossale', 'Seul le visage dépasse ; ses yeux sont des gemmes (Perception DD 13).', [0.34, 0.36]]],
  cairn: [['Cairn', 'Chaque voyageur y ajoute une pierre ; des runes usées.', [0.5, 0.45]]],
  trappeurs: [['Cabane des trappeurs', 'Peaux tendues, raquettes au mur.', [0.5, 0.42]], ['Pièges', 'Une ligne de collets vers la forêt (Survie DD 11).', [0.68, 0.56]]],
  marais: [['Eaux noires', 'Roseaux, souches mortes ; le fond est traître (Athlétisme DD 12).', [0.5, 0.5]], ['Îlot', 'Une hutte sur pilotis, au milieu des eaux.', [0.62, 0.38]]],
};

/** Plan d'un lieu sauvage enregistré `w` (WildRecord). `planId` : identifiant du plan ; `seed` : graine du monde. */
export function generateWildPlan(w, planId, seed = 1) {
  const r = rng(hash(`${seed}:wildplan:${w.key}`));
  const W = WILD_W, H = WILD_H, cx = W / 2, cy = H * 0.46;
  const b = [], o = [], t = [], p = [], walls = [], water = [], roads = [], decor = [];
  const box = (x, y, wm, dm, ang = 0, list = b) => list.push(r1(x), r1(y), r1(M(wm)), r1(M(dm)), Math.round(ang * 1000) / 1000);
  const prop = (k, x, y, wm, dm, ang = 0) => p.push([k, r1(x), r1(y), r1(M(wm)), r1(M(dm)), Math.round(ang * 1000) / 1000]);
  const kind = w.kind;
  // Une clairière plus ou moins grande autour du lieu ; un sentier y mène depuis le bas du plan.
  const clear = M(kind === 'clairiere' || kind === 'champ-bataille' || kind === 'menhirs' ? 30 : 18);
  const path = [[cx + M(6), H + 10], [cx - M(4), H * 0.78], [cx + M(3), cy + clear * 0.6]];
  roads.push({ pts: path.flat().map(r1), hw: r1(M(1.2)) });
  // Végétation : dense en forêt, clairsemée ailleurs, absente au désert et sur la haute montagne.
  const dense = Math.max(0, Math.min(1, w.forest ?? 0.1));
  const nTrees = w.biome === 'desert' || (w.e ?? 0) > 1800 ? 0 : Math.round(20 + dense * 240);
  for (let i = 0; i < nTrees; i++) {
    const x = r() * W, y = r() * H;
    const dc = Math.hypot((x - cx) / 1.15, y - cy);
    if (dc < clear + r() * M(10)) continue;
    if (path.some(([px, py]) => Math.hypot(px - x, py - y) < M(5))) continue;
    t.push(r1(x), r1(y), r1(M(1.6 + r() * 1.6)));
  }
  // Rochers épars (plus en montagne).
  const rocks = Math.round(4 + ((w.e ?? 0) > 900 ? 18 : 4) * r());
  for (let i = 0; i < rocks; i++) { const a = r() * Math.PI * 2, d = clear * (1 + r() * 1.6); box(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, 1 + r() * 2.5, 1 + r() * 2, r() * 3, o); }
  const ring = (n, rad, wm) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; prop('colonne', cx + Math.cos(a) * M(rad), cy + Math.sin(a) * M(rad) * 0.85, wm, wm, a); } };
  const pond = (x, y, rx, ry) => { const pts = []; for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2, k = 0.85 + r() * 0.3; pts.push(r1(x + Math.cos(a) * M(rx) * k), r1(y + Math.sin(a) * M(ry) * k)); } water.push({ pts, hw: 0, closed: true }); };
  const cliff = () => { const pts = []; for (let i = 0; i <= 10; i++) { const x = (i / 10) * W; pts.push(r1(x), r1(H * 0.2 + Math.sin(i * 1.3 + r()) * M(4) - (Math.abs(x - cx) < M(10) ? -M(6) : 0))); } walls.push({ pts, hw: r1(M(2.5)), cliff: true }); };
  switch (kind) {
    case 'grotte-geant': case 'mine': case 'taniere':
      cliff(); box(cx, H * 0.25, kind === 'taniere' ? 3 : 7, 3, 0, o);
      if (kind === 'mine') { box(cx - M(26), cy + M(8), 7, 5, 0.1); prop('tonneau', cx + M(12), cy + M(2), 1, 1); prop('coffre', cx - M(20), cy + M(14), 1.2, 0.7); }
      if (kind === 'grotte-geant') { prop('tonneau', cx + M(16), cy - M(6), 2.2, 2.2); prop('coffre', cx - M(14), cy - M(4), 1.6, 1); }
      break;
    case 'nid-wyverne': cliff(); for (let i = 0; i < 6; i++) box(cx + (r() - 0.5) * M(20), cy - M(8) + (r() - 0.5) * M(10), 2 + r() * 2, 2, r() * 3, o); break;
    case 'ermitage': box(cx, cy - M(4), 5, 4, 0.05); prop('autel', cx + M(14), cy - M(10), 1.6, 0.9); break;
    case 'cabane': box(cx, cy - M(4), 7, 5, -0.08); prop('tonneau', cx + M(6), cy + M(2), 0.8, 0.8); break;
    case 'trappeurs': box(cx, cy - M(4), 8, 5, 0.06); prop('tonneau', cx - M(7), cy + M(1), 0.8, 0.8); prop('coffre', cx + M(7), cy + M(1), 1, 0.6); break;
    case 'tour-guet': box(cx, cy - M(6), 6, 6, 0.12); for (let i = 0; i < 5; i++) box(cx + (r() - 0.5) * M(24), cy + M(4) + r() * M(10), 1 + r(), 0.8, r() * 3, o); break;
    case 'ferme-ruine': { box(cx - M(3), cy - M(4), 10, 6, 0.04); const x0 = cx + M(12), y0 = cy - M(14); walls.push({ pts: [x0, y0, x0 + M(10), y0, x0 + M(10), y0 + M(7)].map(r1), hw: r1(M(0.4)) }); prop('fontaine', cx + M(18), cy + M(10), 1.4, 1.4); break; }
    case 'camp-bandits': case 'nomades':
      for (let i = 0; i < (kind === 'nomades' ? 5 : 3); i++) { const a = -Math.PI / 2 + (i - 1) * 0.9, d = M(14); box(cx + Math.cos(a) * d, cy + Math.sin(a) * d, kind === 'nomades' ? 5 : 3, kind === 'nomades' ? 5 : 2.5, a); }
      prop('tonneau', cx, cy + M(2), 1, 1); prop('coffre', cx + M(16), cy - M(10), 1.2, 0.7);
      break;
    case 'cercle-fees': ring(14, 7, 0.9); break;
    case 'menhirs': ring(12, 13, 1.4); prop('autel', cx, cy, 1.4, 1); break;
    case 'druides': ring(8, 10, 0.9); prop('autel', cx, cy, 1.6, 1); prop('fontaine', cx + M(6), cy + M(7), 1.2, 1.2); break;
    case 'cairn': prop('colonne', cx, cy, 2, 2); break;
    case 'tumulus': box(cx, cy - M(2), 18, 14, 0.2, o); prop('sarcophage', cx, cy + M(10), 2.2, 1, 0); break;
    case 'champ-bataille': for (let i = 0; i < 22; i++) prop('colonne', cx + (r() - 0.5) * M(60), cy + (r() - 0.5) * M(40), 0.6, 0.6, r() * 3); break;
    case 'ruines-ensablees': for (let i = 0; i < 9; i++) prop('colonne', cx - M(20) + i * M(5), cy - M(6) + (i % 2) * M(2), 1.2, 1.2); walls.push({ pts: [cx - M(24), cy + M(8), cx + M(20), cy + M(10)].map(r1), hw: r1(M(0.6)) }); break;
    case 'arbre-coeur': t.push(r1(cx), r1(cy - M(2)), r1(M(9))); break;
    case 'source': pond(cx, cy, 5, 3.5); break;
    case 'oasis': pond(cx, cy + M(2), 11, 7); for (let i = 0; i < 7; i++) { const a = r() * Math.PI * 2; t.push(r1(cx + Math.cos(a) * M(14)), r1(cy + Math.sin(a) * M(10)), r1(M(2.4))); } break;
    case 'marais': for (let i = 0; i < 5; i++) pond(cx + (r() - 0.5) * M(50), cy + (r() - 0.5) * M(30), 4 + r() * 6, 3 + r() * 4); box(cx + M(16), cy - M(12), 4, 4, 0.2); break;
    case 'cascade': cliff(); pond(cx, cy - M(2), 9, 6); water.push({ pts: [cx, H * 0.2, cx + M(1), cy - M(6)].map(r1), hw: r1(M(1.5)) }); break;
    default: break;
  }
  // Tracés : parois et murs, rochers (le sol, les arbres, les abris, les objets et l'eau sont dessinés par le moteur).
  const rect = (x, y, w2, d2, ang) => { const c = Math.cos(ang), sn = Math.sin(ang); return 'M' + [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => `${r1(x + (u * w2 * c - v * d2 * sn) / 2)} ${r1(y + (u * w2 * sn + v * d2 * c) / 2)}`).join('L') + 'Z'; };
  for (const wl of walls) {
    let d = ''; for (let i = 0; i + 1 < wl.pts.length; i += 2) d += `${i ? 'L' : 'M'}${wl.pts[i]} ${wl.pts[i + 1]}`;
    // Une paroi (tout le haut du plan) est une masse rocheuse pleine ; un mur effondré, un trait.
    decor.push(wl.cliff ? { kind: 'cliff', d: `${d}L${W} -10L0 -10Z` } : { kind: 'wall', d, w: r1(wl.hw * 2) });
  }
  // Abris (toits) et objets : un tracé de repli, que la Banque remplace par ses images quand elle dessine.
  for (let i = 0; i + 4 < b.length; i += 5) decor.push({ kind: 'roof', d: rect(b[i], b[i + 1], b[i + 2], b[i + 3], b[i + 4]) });
  const PROP_DECOR = { colonne: 'pillar', autel: 'altar', coffre: 'chest', tonneau: 'barrel', sarcophage: 'tomb', fontaine: 'fountain' };
  for (const [k, x, y, w2, d2, a2] of p) decor.push({ kind: PROP_DECOR[k] ?? 'pillar', d: rect(x, y, w2, d2, a2) });
  for (let i = 0; i + 4 < o.length; i += 5) decor.push({ kind: o[i + 2] * WILD_SCALE > 8 ? 'hill' : 'pillar', d: rect(o[i], o[i + 1], o[i + 2], o[i + 3], o[i + 4]) });
  // Points d'intérêt : ce que le MJ décrit et fait fouiller (catégorie du lieu).
  const features = [], geometries = [];
  const base = { canonStatus: 'creation', placementStatus: 'documented' };
  (POI[kind] ?? []).forEach(([title, summary, at], i) => {
    const id = `${planId}:poi-${i}`;
    features.push({ ...base, id, title, summary, category: w.cat, importance: i ? 'local' : 'regional', minZoom: 0 });
    geometries.push({ id: `g-${id}`, mapId: planId, featureId: id, type: 'point', coordinates: [r5(at[0]), r5(at[1])] });
  });
  const climate = w.biome === 'neige' || w.biome === 'taiga' ? 'froid' : w.biome === 'desert' || w.biome === 'steppe' ? 'chaud' : 'tempere';
  const map = {
    id: planId, title: w.title, scope: { kind: 'site', id: `${planId}:site` }, width: W, height: H,
    defaultViewport: { x: 0.5, y: 0.48, zoom: 1 }, decor,
    surface: { scale: WILD_SCALE, theme: 'cite', nature: true, climate, snow: w.biome === 'neige' ? 0.5 : undefined, ground: { b, f: [], t, o, p, walls, water, roads } },
  };
  return { map, features, geometries };
}

/** Le plan d'un lieu sauvage : identifiant stable. */
export const wildPlanId = (wid, key) => `${wid}:wild-${key}:plan`;
