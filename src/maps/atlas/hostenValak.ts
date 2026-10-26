/**
 * Hosten Valak — cité verticale du sud, taillée en paliers dans la paroi d'un gouffre.
 *
 * Reproduction vectorielle des cartes officielles des paliers (« GST2026_Hosten Valak », BAT001 à BAT008) :
 * terrasses, gouffre, escaliers, ponts, places, eaux et canalisations sont redessinés dans le style de l'Atlas ;
 * chaque lieu est posé à l'emplacement de son étiquette sur la carte d'origine (placement « approximate »).
 * Un visage immense de la déesse est sculpté à même la pierre : chaque palier en porte une partie
 * (couronne, front, regard, nez, gueule, menton), visible en haut de son plan.
 * Position de la cité : « au sud » ; grand niveau et strate non documentés.
 */
import type { AtlasAnchor, AtlasConnection, AtlasFeature, AtlasGeometry, AtlasMap, AtlasSpace, Cavity, FeatureCategory, MapDecor, Trace } from './types';

const SITE = 'hosten-valak';
const W = 1240, H = 755;
/** Coordonnées saisies en pixels des cartes d'origine (1920 × 1080). */
const IW = 1920, IH = 1080;
const N = (x: number, y: number): [number, number] => [+(Math.min(IW - 8, Math.max(8, x)) / IW).toFixed(4), +(Math.min(IH - 8, Math.max(8, y)) / IH).toFixed(4)];
const X = (x: number) => +((x * W) / IW).toFixed(1), Y = (y: number) => +((y * H) / IH).toFixed(1);
const SRC = 'Lieu inscrit sur la carte officielle du palier (cartes GST2026 de Hosten Valak) ; position reprise de cette carte.';

/* ——— Petits outils de dessin (coordonnées d'origine → unités de plan) ——— */
const poly = (...xy: number[]) => { let d = ''; for (let i = 0; i < xy.length; i += 2) d += `${i ? 'L' : 'M'}${X(xy[i])} ${Y(xy[i + 1])}`; return d + 'Z'; };
const ell = (cx: number, cy: number, rx: number, ry: number) => `M${X(cx - rx)} ${Y(cy)}a${X(rx)} ${Y(ry)} 0 1 0 ${X(2 * rx)} 0a${X(rx)} ${Y(ry)} 0 1 0 ${-X(2 * rx)} 0Z`;
const path = (d: string) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, a, b) => `${X(+a)} ${Y(+b)}`);
/** Escalier : bande et marches le long d'un segment. */
function stair(x1: number, y1: number, x2: number, y2: number, w = 46): MapDecor[] {
  const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len, nx = (-uy * w) / 2, ny = (ux * w) / 2;
  let steps = '';
  for (let s = 6; s < len - 4; s += 11) { const px = x1 + ux * s, py = y1 + uy * s; steps += `M${X(px - nx)} ${Y(py - ny)}L${X(px + nx)} ${Y(py + ny)}`; }
  return [{ kind: 'stair', d: poly(x1 - nx, y1 - ny, x2 - nx, y2 - ny, x2 + nx, y2 + ny, x1 + nx, y1 + ny) }, { kind: 'steps', d: steps }];
}
/** Pâté de maisons déterministe autour d'un point. */
function block(cx: number, cy: number, seed: number, n = 9, spread = 95): MapDecor {
  let z = (seed * 2654435761) >>> 0; const r = () => ((z = (1664525 * z + 1013904223) >>> 0) / 4294967296);
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, k = 0.45 + r() * 0.55, w = 18 + r() * 26, h = 14 + r() * 18;
    const x = cx + Math.cos(a) * spread * k, y = cy + Math.sin(a) * spread * 0.62 * k;
    d += poly(x - w / 2, y - h / 2, x + w / 2, y - h / 2, x + w / 2, y + h / 2, x - w / 2, y + h / 2);
  }
  return { kind: 'building', d };
}

type Place = [string, number, number, FeatureCategory?];
type Floor = {
  order: number; official: string; name: string; face: string; file: string;
  floors: [number, number, number, number][]; places: Place[]; decor: MapDecor[];
  traces?: { title: string; t: Trace; pts: number[]; cat?: FeatureCategory }[];
  zones?: { title: string; cat: FeatureCategory; pts: number[] }[];
  up?: [number, number]; down?: [number, number]; facePoint: [number, number]; noBlocks?: string[];
};

const CROWN = path('M640 270 L660 120 L690 250 L760 60 L820 230 L880 90 L930 220 L962 0 L995 220 L1045 90 L1100 230 L1160 60 L1230 250 L1260 120 L1290 270 Z');
const FLOORS: Floor[] = [
  {
    order: 0, official: 'Niveau 1 – Le Seuil', name: 'Le Seuil', face: 'la couronne', file: 'BAT001', facePoint: [962, 120],
    floors: [[260, 300, 290, 140], [960, 230, 390, 120], [968, 500, 62, 175], [1640, 320, 300, 130], [1700, 740, 250, 200], [120, 560, 110, 120], [290, 890, 330, 200], [990, 890, 370, 130]],
    places: [['La Porte souterraine', 190, 220, 'cite'], ['Les Tours jumelles', 695, 272, 'garde'], ['Porte de Hosten Valak', 962, 347, 'cite'], ['Retranchement militaire', 1645, 282, 'garde'],
      ['Le Grand Gouffre', 1252, 505, 'danger'], ['La Traversée du Vide', 978, 562, 'voie'], ['Le Passage du Canyon', 1645, 570, 'voie'], ['Le Pont suspendu', 390, 674, 'voie'],
      ['Le Pont de la Brume noire', 500, 856, 'voie'], ['Portail d’arrivée', 982, 856, 'cite'], ['Le Pont des Veines de pierre', 1460, 805, 'voie']],
    decor: [{ kind: 'face', d: CROWN }, { kind: 'dark', d: path('M770 270 Q962 120 1150 270 Z') }, ...stair(962, 330, 962, 470, 60), block(700, 230, 11, 6, 70), block(1650, 330, 12, 8, 110)],
    traces: [
      { title: 'Le Pont suspendu', t: 'galerie', pts: [300, 430, 340, 560, 380, 720] }, { title: 'Le Pont de la Brume noire', t: 'galerie', pts: [560, 880, 640, 890, 700, 880] },
      { title: 'Le Pont des Veines de pierre', t: 'galerie', pts: [1300, 860, 1390, 820, 1470, 780] }, { title: 'Le Passage du Canyon', t: 'boyau', pts: [1650, 620, 1660, 520, 1640, 430] },
      { title: 'La Traversée du Vide', t: 'galerie', pts: [968, 640, 975, 700, 980, 790] }, { title: 'Corniche des Tours', t: 'boyau', pts: [500, 300, 600, 290, 640, 280] },
      { title: 'Corniche du Retranchement', t: 'boyau', pts: [1320, 260, 1400, 270, 1460, 290] },
    ],
    zones: [{ title: 'Le Grand Gouffre', cat: 'danger', pts: [600, 420, 860, 380, 1100, 400, 1420, 450, 1430, 640, 1250, 760, 700, 760, 560, 620] }],
    down: [1090, 300], noBlocks: ['Le Grand Gouffre', 'La Traversée du Vide', 'Le Pont suspendu', 'Le Pont de la Brume noire', 'Le Pont des Veines de pierre', 'Le Passage du Canyon'],
  },
  {
    order: 1, official: 'Niveau 1 – L’Accueil', name: 'L’Accueil', face: 'le haut du front', file: 'BAT002', facePoint: [962, 40],
    floors: [[970, 380, 520, 330], [380, 470, 340, 430], [1560, 380, 330, 300], [970, 80, 560, 110], [720, 860, 440, 170], [1650, 620, 230, 120]],
    places: [['Quartier résidentiel noble', 648, 107, 'cite'], ['Enclos des bêtes', 303, 183, 'vivant'], ['Canalisations d’air', 718, 272, 'voie'], ['Canalisations d’eau', 1180, 250, 'eau'],
      ['Faubourgs résidentiels', 1575, 183, 'cite'], ['Temple', 517, 401, 'sanctuaire'], ['La Grande Place', 1155, 428, 'cite'], ['Parvis des Marchands', 338, 465, 'ressource'],
      ['Bazar', 1728, 549, 'ressource'], ['Voûtes historiques', 538, 613, 'institution'], ['Hall militaire', 1273, 633, 'garde'], ['Les Échoppes de pierre', 328, 715, 'ressource'], ['Pont suspendu', 436, 838, 'voie']],
    decor: [
      { kind: 'ring', d: ell(965, 380, 120, 70) }, { kind: 'fountain', d: ell(965, 380, 60, 36) },
      { kind: 'pit', d: ell(690, 215, 85, 55) }, { kind: 'pit', d: ell(1300, 235, 85, 55) }, { kind: 'pit', d: ell(560, 740, 130, 70) },
      ...stair(965, 160, 965, 60, 120), ...stair(965, 560, 965, 660, 150), ...stair(560, 210, 690, 350, 70), ...stair(1450, 230, 1320, 350, 70),
      block(300, 120, 21), block(1580, 110, 22), block(560, 480, 23, 7, 70), block(1300, 560, 24, 8, 80), block(1750, 470, 25), block(250, 600, 26),
    ],
    traces: [{ title: 'Pont suspendu', t: 'galerie', pts: [330, 850, 420, 860, 520, 860] }],
    up: [1080, 70], down: [870, 640],
  },
  {
    order: 2, official: 'Niveau 2 – Domaine urbain', name: 'Domaine urbain', face: 'le front et ses racines sculptées', file: 'BAT003', facePoint: [962, 60],
    floors: [[965, 560, 300, 290], [380, 520, 340, 430], [1560, 540, 340, 430], [965, 300, 270, 90], [965, 900, 90, 130]],
    places: [['Quartier des Nobles', 508, 362, 'cite'], ['Quartier des Magistrats', 412, 444, 'institution'], ['Quartier des Ambassades', 272, 576, 'institution'], ['Quartier des Archivistes', 380, 664, 'institution'],
      ['Salle des Délibérations', 1092, 362, 'institution'], ['Galerie des Ancêtres', 1252, 505, 'sanctuaire'], ['Quartier des Académies', 1457, 362, 'institution'], ['Quartier des Étudiants', 1650, 597, 'cite'],
      ['Quartier des Serviteurs des Temples', 1483, 872, 'sanctuaire']],
    decor: [
      { kind: 'face', d: path('M700 0 Q760 120 820 60 Q860 160 920 80 Q962 190 1005 80 Q1060 160 1100 60 Q1160 120 1220 0 Z') },
      { kind: 'ring', d: ell(965, 560, 230, 210) }, { kind: 'ring', d: ell(965, 560, 150, 135) }, { kind: 'fountain', d: ell(965, 560, 55, 50) },
      ...stair(965, 780, 965, 940, 70), block(330, 300, 31, 10, 120), block(240, 760, 32, 10, 110), block(1600, 250, 33, 10, 120), block(1700, 800, 34, 10, 110), block(965, 280, 35, 6, 120),
    ],
    traces: [
      { title: 'Allée des Nobles', t: 'galerie', pts: [780, 420, 680, 360, 560, 330] }, { title: 'Allée des Académies', t: 'galerie', pts: [1150, 420, 1260, 360, 1400, 330] },
      { title: 'Allée des Archivistes', t: 'galerie', pts: [780, 700, 660, 760, 560, 790] }, { title: 'Allée des Serviteurs', t: 'galerie', pts: [1150, 700, 1300, 780, 1440, 830] },
    ],
    up: [880, 300], down: [965, 960],
  },
  {
    order: 3, official: 'Niveau 3 – Regard de la Déesse', name: 'Regard de la Déesse', face: 'les yeux', file: 'BAT004', facePoint: [962, 150],
    floors: [[430, 410, 290, 95], [1490, 400, 290, 95], [965, 330, 210, 140], [965, 620, 190, 90], [965, 770, 70, 90]],
    places: [['Temple de la Fusion', 843, 370, 'sanctuaire'], ['Académie', 475, 456, 'institution'], ['Quartiers du Haut Clergé', 1305, 427, 'sanctuaire']],
    decor: [
      { kind: 'face', d: path('M560 70 Q700 -10 840 60 Q700 110 560 70 Z M1080 60 Q1220 -10 1360 70 Q1220 110 1080 60 Z') },
      { kind: 'eye', d: ell(700, 55, 70, 34) }, { kind: 'eye', d: ell(1220, 55, 70, 34) }, { kind: 'pupil', d: ell(700, 55, 8, 30) }, { kind: 'pupil', d: ell(1220, 55, 8, 30) },
      { kind: 'face', d: path('M920 90 L962 100 L1005 90 L990 200 L935 200 Z') },
      { kind: 'temple', d: path('M860 330 L880 200 L920 250 L962 100 L1005 250 L1045 200 L1065 330 Z') }, { kind: 'fountain', d: ell(965, 380, 50, 22) },
      ...stair(965, 420, 965, 560, 80), ...stair(965, 680, 965, 800, 70), ...stair(640, 470, 880, 600, 60), ...stair(1300, 460, 1060, 600, 60),
      block(400, 380, 41, 12, 140), block(1500, 370, 42, 12, 140),
    ],
    up: [1110, 290], down: [965, 830],
  },
  {
    order: 4, official: 'Niveau 4 – Grand Marché', name: 'Grand Marché', face: 'le nez', file: 'BAT005', facePoint: [962, 60],
    floors: [[960, 590, 880, 440], [960, 250, 420, 140]],
    places: [['Hall des Marchands', 958, 355, 'ressource'], ['Marché du Bas-Monde', 193, 392, 'ressource'], ['Marché des Artisans', 863, 465, 'ressource'], ['Marché des Ombres', 1822, 486, 'ressource'],
      ['Marché des Tisserands', 455, 680, 'ressource'], ['Marché des Voyageurs', 1158, 720, 'ressource'], ['Chambre des Cartographes', 1544, 700, 'institution'], ['Terrasse des Marchands', 1555, 923, 'ressource']],
    decor: [
      { kind: 'face', d: path('M860 0 Q850 90 900 130 Q930 160 962 150 Q995 160 1025 130 Q1075 90 1065 0 Z') },
      { kind: 'temple', d: path('M600 320 L600 200 L700 120 L760 200 L960 160 L1160 200 L1220 120 L1320 200 L1320 320 Z') },
      { kind: 'dome', d: ell(300, 240, 100, 85) }, { kind: 'dome', d: ell(1610, 250, 100, 85) }, { kind: 'dome', d: ell(1530, 480, 110, 80) },
      { kind: 'arch', d: path('M150 960 Q300 880 450 960 M1450 960 Q1600 880 1750 960') },
      block(250, 470, 51, 12, 140), block(420, 820, 52, 12, 150), block(680, 560, 53, 10, 120), block(1250, 560, 54, 10, 120), block(1700, 620, 55, 10, 130), block(1300, 880, 56, 10, 140),
    ],
    traces: [
      { title: 'Grande allée du marché', t: 'galerie', pts: [960, 400, 960, 700, 960, 1010] },
      { title: 'Ruisseau des cascades', t: 'ruisseau', pts: [480, 320, 600, 410, 720, 470], cat: 'eau' }, { title: 'Ruisseau des cascades', t: 'ruisseau', pts: [1440, 300, 1390, 450, 1330, 650, 1290, 780], cat: 'eau' },
    ],
    up: [1700, 160], down: [960, 1020],
  },
  {
    order: 5, official: 'Niveau 5 – Grande Place des Lames', name: 'Grande Place des Lames', face: 'la gueule', file: 'BAT006', facePoint: [962, 40],
    floors: [[960, 600, 900, 440], [960, 230, 600, 140]],
    places: [['Hall des Stratèges', 404, 277, 'garde'], ['Temple de la Gueule sacrée', 805, 297, 'sanctuaire'], ['Mess des Officiers', 1453, 257, 'garde'], ['Caserne des Veilleurs nocturnes', 1776, 297, 'garde'],
      ['Salle du Conseil des Capitaines', 143, 430, 'garde'], ['Dortoir des Ombres', 1800, 502, 'garde'], ['Grande Forge des Armes', 628, 686, 'ressource'], ['Fosses d’entraînement', 962, 652, 'garde'],
      ['Armurerie du Bastion', 1332, 763, 'garde'], ['Atelier des Lames empoisonnées', 1788, 783, 'danger'], ['Forges de réparation', 428, 814, 'ressource'], ['Laboratoire de venins', 1689, 950, 'danger'], ['Chenils de guerre', 443, 1053, 'garde']],
    decor: [
      { kind: 'dark', d: path('M760 0 L1170 0 L1140 200 Q962 260 790 200 Z') },
      { kind: 'fang', d: path('M790 0 L830 160 L860 0 Z M880 0 L900 100 L920 0 Z M940 0 L962 120 L985 0 Z M1005 0 L1025 100 L1045 0 Z M1065 0 L1095 160 L1130 0 Z M840 260 L860 190 L880 260 Z M1045 260 L1065 190 L1085 260 Z') },
      { kind: 'ring', d: path('M720 520 Q962 340 1200 520') }, ...stair(962, 290, 962, 350, 90), ...stair(962, 390, 962, 500, 90),
      { kind: 'pit', d: poly(1060, 620, 1180, 620, 1180, 710, 1060, 710) }, { kind: 'pit', d: poly(880, 690, 1040, 690, 1040, 760, 880, 760) },
      block(300, 280, 61, 10, 130), block(220, 520, 62, 9, 110), block(1600, 300, 63, 10, 130), block(1650, 560, 64, 10, 120), block(560, 860, 65, 10, 140), block(1400, 880, 66, 10, 140),
    ],
    up: [600, 170], down: [962, 980],
  },
  {
    order: 6, official: 'Niveau 5 – Le Grenier', name: 'Le Grenier', face: 'le menton', file: 'BAT007', facePoint: [1000, 70],
    floors: [[1000, 600, 900, 450], [1000, 250, 520, 150]],
    places: [['Culture de lichens', 457, 239, 'vivant'], ['Culture de spores', 1600, 259, 'vivant'], ['Sangliers cavernicoles', 805, 394, 'vivant'], ['Ferme de racines cavernicoles', 1015, 446, 'ressource'],
      ['Réservoir de nourriture', 1460, 466, 'ressource'], ['Grenier principal', 1760, 511, 'ressource'], ['Enclos de reproduction', 1190, 675, 'vivant'], ['Culture de spores (est)', 1767, 733, 'vivant'],
      ['Rivière souterraine', 398, 763, 'eau'], ['Ferme de champignons', 783, 754, 'ressource'], ['Enclos des scarabées', 1403, 912, 'vivant'], ['Cervidés cavernicoles aveugles', 551, 944, 'vivant'], ['Knollmark', 1561, 1053, 'cite']],
    decor: [
      { kind: 'face', d: path('M780 0 Q790 170 1000 200 Q1210 170 1220 0 Z') },
      { kind: 'enclosure', d: ell(785, 465, 130, 70) }, { kind: 'enclosure', d: ell(1130, 590, 170, 90) }, { kind: 'enclosure', d: ell(1180, 860, 210, 60) }, { kind: 'enclosure', d: ell(560, 960, 160, 70) },
      { kind: 'field', d: poly(500, 620, 760, 600, 790, 780, 560, 860) }, { kind: 'dome', d: ell(1260, 260, 60, 80) }, { kind: 'dome', d: ell(1390, 250, 52, 70) }, { kind: 'dome', d: ell(1470, 340, 52, 70) },
      { kind: 'dome', d: ell(1560, 760, 140, 90) }, { kind: 'mushroom', d: ell(130, 120, 120, 50) }, { kind: 'mushroom', d: ell(120, 520, 90, 40) }, { kind: 'mushroom', d: ell(80, 760, 120, 50) },
      block(1700, 430, 71, 8, 100), block(1420, 470, 72, 6, 80),
    ],
    traces: [{ title: 'Rivière souterraine', t: 'ruisseau', pts: [330, 120, 380, 300, 520, 460, 440, 620, 380, 760, 470, 900, 560, 1060], cat: 'eau' }],
    zones: [{ title: 'Étang du Grenier', cat: 'eau', pts: [940, 270, 1050, 250, 1170, 280, 1120, 330, 980, 320] }, { title: 'Bassin aux cascades', cat: 'eau', pts: [250, 380, 420, 360, 540, 470, 470, 540, 300, 520] }],
    up: [1110, 330], down: [900, 1040], noBlocks: ['Rivière souterraine'],
  },
  {
    order: 7, official: 'Niveau 6 – Le Bassin profond', name: 'Le Bassin profond', face: 'sous le menton : le lac', file: 'BAT008', facePoint: [962, 40],
    floors: [[960, 600, 900, 450], [960, 200, 760, 160]],
    places: [['Pompes principales (ouest)', 347, 265, 'eau'], ['Tour de pompage', 1120, 286, 'eau'], ['Pompes principales (est)', 1565, 286, 'eau'], ['Égouts principaux', 1080, 519, 'eau'],
      ['Bassins de filtration', 323, 618, 'eau'], ['Canaux secondaires', 1517, 619, 'eau'], ['Le Grand Lac', 961, 703, 'eau'], ['Réservoir intermédiaire', 451, 733, 'eau'],
      ['Salle de filtration', 148, 827, 'eau'], ['Aqueduc principal', 551, 912, 'eau'], ['Bassin de régulation', 1752, 934, 'eau'], ['Canaux d’évacuation', 1375, 1020, 'eau']],
    decor: [
      { kind: 'tower', d: poly(410, 110, 530, 110, 530, 330, 410, 330) }, { kind: 'tower', d: poly(890, 100, 1040, 100, 1040, 420, 890, 420) }, { kind: 'tower', d: poly(1370, 110, 1490, 110, 1490, 330, 1370, 330) },
      { kind: 'pipe', d: path('M60 900 Q500 1000 960 900 Q1500 800 1760 520 L1760 200') },
      { kind: 'pipe', d: path('M530 250 Q700 300 890 330 M1040 330 Q1200 300 1370 250 M965 420 L965 560') },
      { kind: 'pipe', d: path('M1200 1080 L1260 900 M300 600 Q350 750 520 830') },
      { kind: 'basin', d: poly(150, 560, 330, 540, 380, 640, 200, 680) }, { kind: 'basin', d: poly(300, 700, 460, 690, 470, 780, 320, 790) }, { kind: 'basin', d: ell(1752, 990, 90, 50) },
    ],
    zones: [{ title: 'Le Grand Lac', cat: 'eau', pts: [560, 420, 800, 360, 1150, 380, 1420, 440, 1470, 640, 1330, 830, 960, 880, 640, 820, 510, 620] }],
    up: [1720, 140],
  },
];

export const HV_FLOORS = FLOORS;
const FACE_KINDS = new Set<MapDecor['kind']>(['face', 'eye', 'pupil', 'fang', 'dark']);
/** Vue en coupe de la cité (illustration fournie) : à déposer à cet emplacement pour l'indicateur de palier. */
export const HV_SECTION_IMAGE = 'images/archives/atlas/hosten-valak-coupe.webp';
/** Bandes verticales (fractions de hauteur de l'illustration) correspondant à chaque palier, de la couronne au lac. */
export const HV_BANDS: [number, number][] = [[0, 0.24], [0.24, 0.31], [0.31, 0.37], [0.37, 0.47], [0.47, 0.56], [0.56, 0.7], [0.7, 0.83], [0.83, 1]];
const mapId = (o: number) => `carte-hv-p${o}`;
const floorId = (o: number) => `hv-p${o}`;

export function hostenValak() {
  const spaces: AtlasSpace[] = [{
    id: SITE, kind: 'site', name: 'Hosten Valak', levelId: '', stratumIds: [], entryFloorId: floorId(0), faceSite: true,
    description: 'Cité du sud, taillée en paliers dans la paroi d’un gouffre. Un visage immense de la déesse y est sculpté à même la pierre : chaque palier en porte une partie.',
  }];
  const maps: AtlasMap[] = [];
  const cavities: Record<string, Cavity[]> = {};
  const features: AtlasFeature[] = [];
  const geometries: AtlasGeometry[] = [];
  const anchors: AtlasAnchor[] = [];
  const connections: AtlasConnection[] = [];

  for (const f of FLOORS) {
    const m = mapId(f.order);
    spaces.push({
      id: floorId(f.order), kind: 'palier', name: f.name, floorLabel: f.official, facePart: f.face,
      parentSpaceId: SITE, siteId: SITE, levelId: '', stratumIds: [], floorOrder: f.order, mapId: m,
      description: `${f.official} — porte ${f.face} de la déesse.`,
    });
    // Le visage n'est pas dessiné sur les plans (rendu peu crédible) : seul son nom est indiqué.
    const decor: MapDecor[] = f.decor.filter((x) => !FACE_KINDS.has(x.kind));
    // Quartiers bâtis autour des lieux habités (pas sur les ponts, les eaux ni le gouffre).
    f.places.forEach(([t, x, y, cat], i) => {
      if (f.noBlocks?.includes(t) || cat === 'voie' || cat === 'eau' || cat === 'danger') return;
      decor.push(block(x, y + 45, f.order * 100 + i, 7, 80));
    });
    maps.push({ id: m, title: `Hosten Valak · ${f.official}`, scope: { kind: 'site', id: SITE, floorId: floorId(f.order) }, width: W, height: H, defaultViewport: { x: 0.45, y: 0.47, zoom: 0.88 }, decor });
    cavities[m] = f.floors.map(([cx, cy, rx, ry], i) => ({ cx: cx / IW, cy: cy / IH, rx: rx / IW, ry: ry / IH, seed: 900 + f.order * 17 + i }));

    const faceId = `hv-visage-${f.order}`;
    features.push({ id: faceId, title: `Visage de la déesse — ${f.face}`, category: 'sanctuaire', importance: 'landmark', minZoom: 0, area: true,
      summary: `Ce palier porte ${f.face} du visage sculpté de la déesse.`, canonStatus: 'confirme', placementStatus: 'approximate' });
    geometries.push({ id: `g-${faceId}`, mapId: m, featureId: faceId, type: 'point', coordinates: N(f.facePoint[0], f.facePoint[1] + 30) });

    f.places.forEach(([t, x, y, cat], i) => {
      const id = `hv-${f.order}-${i}`;
      features.push({ id, title: t, category: cat ?? 'institution', importance: i < 4 ? 'landmark' : 'regional', minZoom: 0, summary: SRC, canonStatus: 'confirme', placementStatus: 'approximate' });
      geometries.push({ id: `g-${id}`, mapId: m, featureId: id, type: 'point', coordinates: N(x, y) });
    });
    (f.traces ?? []).forEach((tr, i) => {
      const id = `hv-${f.order}-tr-${i}`; const pts: [number, number][] = [];
      for (let k = 0; k < tr.pts.length; k += 2) pts.push(N(tr.pts[k], tr.pts[k + 1]));
      features.push({ id, title: tr.title, category: tr.cat ?? 'voie', importance: 'regional', minZoom: 0, trace: tr.t, summary: SRC, canonStatus: 'confirme', placementStatus: 'approximate' });
      geometries.push({ id: `g-${id}`, mapId: m, featureId: id, type: 'polyline', coordinates: pts });
    });
    (f.zones ?? []).forEach((z, i) => {
      const id = `hv-${f.order}-z-${i}`; const pts: [number, number][] = [];
      for (let k = 0; k < z.pts.length; k += 2) pts.push(N(z.pts[k], z.pts[k + 1]));
      features.push({ id, title: z.title, category: z.cat, importance: 'regional', minZoom: 0, summary: SRC, canonStatus: 'confirme', placementStatus: 'approximate' });
      geometries.push({ id: `g-${id}`, mapId: m, featureId: id, type: 'polygon', coordinates: pts });
    });

    // Liaisons verticales entre paliers consécutifs.
    const prev = FLOORS[f.order - 1], next = FLOORS[f.order + 1];
    if (prev && f.up) anchors.push({ id: `a-hv-${f.order}-haut`, mapId: m, at: N(f.up[0], f.up[1]), label: `Monter vers ${prev.name}` });
    if (next && f.down) anchors.push({ id: `a-hv-${f.order}-bas`, mapId: m, at: N(f.down[0], f.down[1]), label: `Descendre vers ${next.name}` });
    if (next && f.down && next.up) connections.push({
      id: `c-hv-${f.order}-${f.order + 1}`, kind: 'escalier', fromAnchorId: `a-hv-${f.order}-bas`, toAnchorId: `a-hv-${f.order + 1}-haut`, direction: 'both',
      title: 'Escalier taillé dans le visage', note: 'Les paliers communiquent par de grands escaliers creusés dans la paroi sculptée.', difficulty: 1,
      canonStatus: 'creation', placementStatus: 'illustrative',
    });
  }
  assassins(features, geometries, anchors, connections);
  return { spaces, maps, cavities, features, geometries, anchors, connections };
}

/* ——— La cité des assassins : passages secrets, cachettes, voies de fuite, accès dérobés entre paliers ——— */
const SECRET_NAMES = ['Passage des Ombres', 'Couloir muet', 'Faille des Lames', 'Boyau du silence', 'Galerie aveugle', 'Chemin des Mains noires', 'Conduit des Veilleurs',
  'Passage du Poignard', 'Sente sans écho', 'Tunnel des Murmures', 'Coursive dérobée', 'Passage de la Dague'];
const HIDES: [string, FeatureCategory][] = [['Cache d’armes', 'garde'], ['Planque', 'garde'], ['Niche dérobée', 'garde'], ['Trappe', 'danger'], ['Alcôve secrète', 'garde'],
  ['Poste d’observation', 'garde'], ['Faux mur', 'indetermine'], ['Cache de poisons', 'danger'], ['Boîte aux lettres morte', 'indetermine'], ['Repaire de guet', 'garde'], ['Cache de vivres', 'ressource']];
/** Accès dérobés entre paliers, consécutifs ou non. */
const SHORTCUTS: { from: number; to: number; title: string; kind: AtlasConnection['kind']; dir: 'both' | 'forward'; difficulty: 1 | 2 | 3 | 4; hazards: string[] }[] = [
  { from: 0, to: 1, title: 'Échelle des guetteurs', kind: 'naturel', dir: 'both', difficulty: 2, hazards: ['Échelle de corde', 'Passage gardé'] },
  { from: 0, to: 2, title: 'Puits des Ombres', kind: 'puits', dir: 'forward', difficulty: 4, hazards: ['Chute contrôlée à la corde', 'Aucune remontée'] },
  { from: 1, to: 2, title: 'Conduit des Canalisations', kind: 'tunnel', dir: 'both', difficulty: 3, hazards: ['Reptation dans les conduits d’air', 'Grilles à forcer'] },
  { from: 1, to: 5, title: 'Monte-charge des Lames', kind: 'ascenseur', dir: 'both', difficulty: 2, hazards: ['Treuil bruyant', 'Contrôle de la garde'] },
  { from: 2, to: 3, title: 'Escalier dérobé des Archivistes', kind: 'escalier', dir: 'both', difficulty: 2, hazards: ['Porte à secret', 'Marches piégées'] },
  { from: 2, to: 5, title: 'Cheminée des Assassins', kind: 'puits', dir: 'both', difficulty: 3, hazards: ['Escalade en opposition', 'Prises enduites de poix'] },
  { from: 3, to: 4, title: 'Larmes de la Déesse', kind: 'naturel', dir: 'both', difficulty: 3, hazards: ['Descente le long d’une cascade', 'Roche glissante'] },
  { from: 3, to: 6, title: 'Gorge secrète', kind: 'naturel', dir: 'forward', difficulty: 4, hazards: ['Toboggan de pierre', 'Arrivée dans l’eau'] },
  { from: 4, to: 5, title: 'Trappe du Marché des Ombres', kind: 'escalier', dir: 'both', difficulty: 2, hazards: ['Trappe sous un étal', 'Guetteurs'] },
  { from: 5, to: 6, title: 'Gosier', kind: 'tunnel', dir: 'both', difficulty: 3, hazards: ['Passage sous les crocs', 'Obscurité'] },
  { from: 5, to: 7, title: 'Égout des Lames', kind: 'tunnel', dir: 'forward', difficulty: 3, hazards: ['Eaux usées', 'Courant vers le lac'] },
  { from: 6, to: 7, title: 'Rivière des fuyards', kind: 'naturel', dir: 'both', difficulty: 3, hazards: ['Nage à contre-courant', 'Siphon court'] },
  { from: 4, to: 7, title: 'Chute du Bassin', kind: 'puits', dir: 'forward', difficulty: 4, hazards: ['Saut dans la cascade', 'Aucune remontée'] },
];

function assassins(features: AtlasFeature[], geometries: AtlasGeometry[], anchors: AtlasAnchor[], connections: AtlasConnection[]) {
  const D = { canonStatus: 'creation' as const, placementStatus: 'illustrative' as const };
  const NOTE = 'Hosten Valak est la cité des assassins : passages secrets, cachettes et voies de fuite y sont partout. Tracé proposé, à valider.';
  for (const f of FLOORS) {
    let z = (f.order * 7919 + 13) >>> 0; const r = () => ((z = (1664525 * z + 1013904223) >>> 0) / 4294967296);
    const m = mapId(f.order);
    const used: [number, number][] = [...f.places.map(([, x, y]) => [x, y] as [number, number]), ...(f.up ? [f.up] : []), ...(f.down ? [f.down] : [])];
    const spot = (minDist = 70, spread = 0.7): [number, number] => {
      for (let t = 0; t < 60; t++) {
        const [cx, cy, rx, ry] = f.floors[Math.floor(r() * f.floors.length)];
        const a = r() * Math.PI * 2, k = Math.sqrt(r()) * spread, x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
        if (x > 40 && x < IW - 40 && y > 60 && y < IH - 40 && used.every(([px, py]) => Math.hypot(px - x, py - y) > minDist)) { used.push([x, y]); return [x, y]; }
      }
      const [cx, cy] = f.floors[0]; return [cx, cy];
    };
    const bend = (a: [number, number], b: [number, number], k = 0.35): number[] => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len, o1 = (r() - 0.5) * len * k, o2 = (r() - 0.5) * len * k;
      return [a[0], a[1], a[0] + (b[0] - a[0]) * 0.33 + nx * o1, a[1] + (b[1] - a[1]) * 0.33 + ny * o1, a[0] + (b[0] - a[0]) * 0.66 + nx * o2, a[1] + (b[1] - a[1]) * 0.66 + ny * o2, b[0], b[1]];
    };
    const addLine = (id: string, title: string, t: Trace, imp: AtlasFeature['importance'], minZoom: number, pts: number[], summary: string) => {
      const c: [number, number][] = []; for (let k = 0; k < pts.length; k += 2) c.push(N(pts[k], pts[k + 1]));
      features.push({ id, title, category: 'voie', importance: imp, minZoom: +minZoom.toFixed(2), trace: t, summary: `${summary} ${NOTE}`, ...D });
      geometries.push({ id: `g-${id}`, mapId: m, featureId: id, type: 'polyline', coordinates: c });
    };
    const places = f.places.filter(([, , , c]) => c !== 'voie');
    // Passages secrets entre lieux du palier.
    const nSec = Math.max(6, places.length);
    for (let k = 0; k < nSec; k++) {
      const a = places[Math.floor(r() * places.length)], b = places[Math.floor(r() * places.length)];
      const A: [number, number] = a && b && a !== b ? [a[1], a[2] + 30] : spot(), B: [number, number] = a && b && a !== b ? [b[1], b[2] + 30] : spot();
      addLine(`hv-${f.order}-sec-${k}`, SECRET_NAMES[(k + f.order * 3) % SECRET_NAMES.length], 'secret', 'detail', 1.4 + r() * 1.1, bend(A, B, 0.5), 'Passage secret derrière les murs et sous les dalles.');
    }
    // Voies de fuite : de chaque quartier vers le bord du palier (gouffre, paroi, conduits).
    places.forEach(([, x, y], k) => {
      if (r() > 0.75) return;
      const edges: [number, number][] = [[20, y + (r() - 0.5) * 200], [IW - 20, y + (r() - 0.5) * 200], [x + (r() - 0.5) * 300, 1060]];
      const e = edges.sort((p, q) => Math.hypot(p[0] - x, p[1] - y) - Math.hypot(q[0] - x, q[1] - y))[0];
      const end: [number, number] = [Math.max(20, Math.min(IW - 20, e[0])), Math.max(40, Math.min(IH - 20, e[1]))];
      addLine(`hv-${f.order}-fuite-${k}`, 'Voie de fuite', 'etroit', 'local', 1.2 + r() * 0.5, bend([x, y + 25], end, 0.4), 'Itinéraire de repli vers la paroi ou le gouffre, connu des guildes.');
      // Le bout de la voie de fuite : là où l'on quitte le palier (corde, conduit ou corniche).
      const t = end[1] > 1000 ? 'Point de rappel' : k % 2 ? 'Conduit de fuite' : 'Corniche du gouffre', id = `hv-${f.order}-fuite-${k}-fin`;
      features.push({ id, title: t, category: 'voie', importance: 'detail', minZoom: 1.6, summary: `Issue de la voie de fuite. ${NOTE}`, ...D });
      geometries.push({ id: `g-${id}`, mapId: m, featureId: id, type: 'point', coordinates: N(end[0], end[1]) });
    });
    // Cachettes.
    const nHide = 6 + Math.floor(r() * 4);
    for (let k = 0; k < nHide; k++) {
      const [t, cat] = HIDES[(k + f.order * 2) % HIDES.length]; const [x, y] = spot(55, 0.8);
      const id = `hv-${f.order}-cache-${k}`;
      features.push({ id, title: t, category: cat, importance: k < 3 ? 'local' : 'detail', minZoom: +(1.6 + r() * 1.4).toFixed(2), summary: `Cachette. ${NOTE}`, ...D });
      geometries.push({ id: `g-${id}`, mapId: m, featureId: id, type: 'point', coordinates: N(x, y) });
    }
  }
  // Accès dérobés entre paliers.
  SHORTCUTS.forEach((sc, i) => {
    const pick = (o: number) => { const f = FLOORS[o]; let z = (o * 31 + i * 977) >>> 0; const r = () => ((z = (1664525 * z + 1013904223) >>> 0) / 4294967296);
      const [cx, cy, rx, ry] = f.floors[Math.floor(r() * f.floors.length)]; const a = r() * Math.PI * 2, k = 0.35 + r() * 0.35; return N(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k); };
    const a = `a-hv-sc-${i}-a`, b = `a-hv-sc-${i}-b`;
    anchors.push({ id: a, mapId: mapId(sc.from), at: pick(sc.from), label: `${sc.title} ↓ ${FLOORS[sc.to].name}` });
    anchors.push({ id: b, mapId: mapId(sc.to), at: pick(sc.to), label: `${sc.title} ↑ ${FLOORS[sc.from].name}` });
    connections.push({ id: `c-hv-sc-${i}`, kind: sc.kind, fromAnchorId: a, toAnchorId: b, direction: sc.dir, title: sc.title, difficulty: sc.difficulty, hazards: sc.hazards,
      note: `Accès dérobé. ${NOTE}`, ...D });
  });
}
