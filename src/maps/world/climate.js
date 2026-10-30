/**
 * Climat de la carte du monde : température selon la latitude (et l'hémisphère), biome selon la température et
 * l'humidité, et climat d'une cité (qui décide de son allure : toits, sol, végétation).
 *
 * JavaScript pur, déterministe : testé par world.test.mjs.
 */

/** Étendues climatiques : température (0 = glacial, 1 = torride) au bord froid et au bord chaud de la carte. */
export const CLIMATE_RANGES = {
  complet: { label: 'Des neiges au désert', t: [0, 1] },
  froid: { label: 'Nordique (neiges et forêts)', t: [0, 0.55] },
  tempere: { label: 'Tempéré', t: [0.36, 0.64] },
  chaud: { label: 'Méridional (steppes et déserts)', t: [0.45, 1] },
};

export const BIOME_LABEL = {
  neige: 'Terres enneigées', taiga: 'Forêts de conifères', tempere: 'Prairies et feuillus', steppe: 'Steppe', desert: 'Désert',
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * Température (0–1) à une hauteur de carte `y01` (0 = haut, 1 = bas). Hémisphère nord : le haut est froid ;
 * hémisphère sud : le haut est chaud. `noise` décale un peu la limite des climats (côtes, vallées).
 */
export function temperatureAt(climate, y01, noise = 0) {
  const { hemisphere = 'nord', range = 'complet' } = climate ?? {};
  const [a, b] = (CLIMATE_RANGES[range] ?? CLIMATE_RANGES.complet).t;
  const t = hemisphere === 'sud' ? 1 - y01 : y01;
  return clamp(a + (b - a) * t + noise, 0, 1);
}

/** Biome selon la température et l'humidité (0–1, 1 = au bord de l'eau). */
export function biomeOf(T, wet = 0) {
  if (T < 0.17) return 'neige';
  if (T < 0.32) return 'taiga';
  if (T < 0.66) return 'tempere';
  if (T < 0.8) return wet > 0.65 ? 'tempere' : 'steppe';
  return wet > 0.8 ? 'steppe' : 'desert';
}

/** Climat d'une cité : il décide de son allure. */
export const climateOf = (T) => (T < 0.3 ? 'froid' : T > 0.7 ? 'chaud' : 'tempere');

/** Bord de carte le plus proche d'une position (0–1) : c'est là que s'étend la mer d'une cité portuaire. */
export function nearestEdge(at, W = 1240, H = 860) {
  const d = { O: at[0] * W, E: (1 - at[0]) * W, N: at[1] * H, S: (1 - at[1]) * H };
  return Object.entries(d).sort((a, b) => a[1] - b[1])[0][0];
}
/** Direction de la mer (angle, écran : y vers le bas) pour un bord. */
export const EDGE_ANGLE = { E: 0, S: Math.PI / 2, O: Math.PI, N: -Math.PI / 2 };

/** Bruit lisse (valeurs aléatoires sur une grille de pas `step`, interpolées) : 0–1, stable pour une graine. */
export function smoothNoise(seed, step) {
  const h = (i, j) => {
    let x = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 2246822519)) >>> 0;
    x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  };
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = x / step, gy = y / step, i = Math.floor(gx), j = Math.floor(gy), fx = s(gx - i), fy = s(gy - j);
    const a = h(i, j) + (h(i + 1, j) - h(i, j)) * fx, b = h(i, j + 1) + (h(i + 1, j + 1) - h(i, j + 1)) * fx;
    return a + (b - a) * fy;
  };
}

