/**
 * Lieux sauvages de l'Underdark (lot 28) : le long des galeries de l'Atlas, dans les tronçons sans caverne, une forêt de
 * champignons géants, un lac noir, un gouffre, une toile géante, un autel de Lolth… ou simplement un recoin saisissant.
 *
 * - Ils ne se mêlent jamais à ceux de la surface (world/wilds.js) : autres types, autres textes, rencontres de
 *   l'Underdark seulement.
 * - Tirage déterministe par galerie (graine de la galerie) : environ un lieu toutes les 6 à 7 heures de marche. Un lieu
 *   est posé un peu à l'écart du tracé (une niche, une faille latérale), jamais dans une caverne (l'Atlas les a déjà
 *   peuplées) ni contre un lieu existant.
 * - Même modèle que la surface : teneur (ambiance, scène, accroche), danger, textes, et ce qu'on en voit depuis la
 *   galerie (portée de torche, DD de Perception passive pour un lieu caché).
 *
 * JavaScript pur : testé par deepWilds.test.mjs. Coordonnées en unités de plan (0–1).
 */
const TENEUR_P = [0.55, 0.85];
const SLOT = 0.12; // longueur de galerie par tirage (≈ 2 h de marche)
const CHANCE = 0.3;

function hash(text) { let h = 2166136261; for (const c of String(text)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) {
  let a = seed | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (v, list) => list[Math.floor(v * list.length) % list.length];

/**
 * Types : où (`w` selon la galerie : `trace`, eau proche), catégorie, danger ajouté, ce qu'on en voit (`see` en unités
 * de plan, `dc` s'il faut chercher, phrases d'annonce avec {c}), textes (ambiance, scène, accroche).
 */
const KINDS = [
  { id: 'champignonniere', label: 'Forêt de champignons géants', cat: 'vivant', w: () => 3, see: 0.012,
    glimpse: ['Sur votre {c}, une lueur bleutée filtre d’une faille : des chapeaux de champignons hauts comme des arbres.'],
    amb: ['Des champignons géants dressent leurs chapeaux à six mètres de haut ; leurs spores flottent comme une neige lumineuse.', 'Une forêt de tiges pâles et de lamelles phosphorescentes ; le sol spongieux étouffe les pas.'],
    scene: ['Des cueilleurs myconides récoltent en silence et communiquent par nuages de spores.', 'Une bête de somme égarée, un lézard géant, broute les champignons et refuse de bouger.'],
    quete: ['Au cœur de la forêt pousse un champignon rare que les alchimistes de la cité paient à prix d’or.', 'Les spores de cette forêt rendent fou : un groupe de mineurs s’y est perdu il y a trois jours.'] },
  { id: 'lac-noir', label: 'Lac noir', cat: 'eau', w: (c) => (c.water ? 4 : 0.8), see: 0.012,
    glimpse: ['Sur votre {c}, un clapotis : la galerie s’ouvre sur une eau noire et immobile.'],
    amb: ['Un lac souterrain, noir comme de l’encre ; la lumière des torches n’en atteint jamais l’autre rive.', 'Une eau si calme qu’elle reflète la voûte comme un miroir ; des poissons aveugles y glissent.'],
    scene: ['Un passeur kuo-toa propose sa barque, contre un objet « qui a de la valeur pour vous ».', 'Quelque chose de très grand nage sous la surface, juste sous la barque.'],
    quete: ['Une cloche de pierre engloutie sonne parfois sous l’eau ; on dit qu’elle appelle les noyés.', 'Sur l’îlot au milieu du lac, une lanterne brûle depuis des siècles.'] },
  { id: 'source-chaude', label: 'Source chaude', cat: 'eau', w: (c) => (c.water ? 2 : 1), see: 0.01,
    glimpse: ['Une vapeur tiède monte d’une niche, sur votre {c}, avec une odeur de soufre.'],
    amb: ['Un bassin d’eau chaude fume dans une niche ; les voyageurs y délassent leurs membres gelés.', 'Une eau laiteuse et brûlante bouillonne entre des concrétions orange.'],
    scene: ['Des duergars s’y prélassent et n’aiment pas être dérangés pendant leur bain.', 'Une salamandre minuscule garde le bassin et crache des étincelles.'],
    quete: ['L’eau de la source guérit les brûlures d’acide ; un chef de clan en a désespérément besoin.', 'Au fond du bassin brille une clé de bronze, hors d’atteinte pour qui ne supporte pas la chaleur.'] },
  { id: 'gouffre', label: 'Gouffre sans fond', cat: 'danger', danger: 1, w: (c) => (c.trace === 'etroit' || c.trace === 'boyau' ? 1.5 : 2), see: 0.01,
    glimpse: ['Sur votre {c}, un souffle froid monte d’une fracture béante.'],
    amb: ['Le sol s’arrête net : un gouffre dont on n’entend jamais retomber les pierres.', 'Une faille vertigineuse, traversée d’un vieux pont de cordes à moitié pourri.'],
    scene: ['Un aventurier est suspendu à une corniche, quelques mètres sous le bord, et appelle à l’aide.', 'Des créatures remontent le long de la paroi, attirées par la lumière.'],
    quete: ['Au fond du gouffre, une cité oubliée ; les cartes duergars la nomment « la Descente sans retour ».', 'Un treuil abandonné et une nacelle : quelqu’un descendait régulièrement là-dessous.'] },
  { id: 'toile', label: 'Toile géante', cat: 'danger', danger: 1, w: () => 2, see: 0.008, dc: 13,
    glimpse: ['Sur votre {c}, des fils argentés tendus en travers d’une faille vibrent doucement.'],
    amb: ['Une toile immense obstrue une faille latérale ; des cocons secs y pendent comme des fruits.', 'Des fils épais comme des cordes tapissent une niche ; tout y est silencieux.'],
    scene: ['Des araignées géantes guettent dans l’ombre ; un cocon remue encore.', 'Un drow est prisonnier de la toile et promet monts et merveilles si on le libère.'],
    quete: ['Au centre de la toile, un cocon contient un messager disparu et sa lettre scellée.', 'La soie de ces araignées vaut une fortune chez les tisserands drows.'] },
  { id: 'cristaux', label: 'Grotte de cristaux chantants', cat: 'ressource', w: () => 1.5, see: 0.01,
    glimpse: ['Une note claire résonne sur votre {c}, comme un doigt sur le bord d’un verre.'],
    amb: ['Des cristaux translucides tapissent une niche et chantent doucement quand l’air bouge.', 'Une forêt de cristaux violets renvoie la lumière des torches en mille éclats.'],
    scene: ['Des prospecteurs se disputent la niche, pioches levées.', 'Le chant des cristaux attire quelque chose qui se nourrit de vibrations.'],
    quete: ['Un cristal de la niche résonne avec une pierre de la cité : ensemble, ils ouvriraient une porte scellée.', 'Un barde paie cher un cristal qui chante juste.'] },
  { id: 'camp-drow', label: 'Campement drow abandonné', cat: 'garde', danger: 1, w: () => 1.5, see: 0.008, dc: 13,
    glimpse: ['Sur votre {c}, des tentures de soie noire déchirées pendent dans une alcôve.'],
    amb: ['Des tentes de soie noire lacérées, des braseros froids : les drows sont partis précipitamment.', 'Une alcôve aménagée, des coussins brodés couverts de poussière, et un symbole d’araignée gravé.'],
    scene: ['Une patrouille drow revient chercher ce qu’elle a oublié.', 'Un esclave évadé se cache dans les tentures et supplie qu’on ne le livre pas.'],
    quete: ['Un coffret aux armes d’une maison drow : des lettres qui accusent une maison rivale.', 'Les drows ont fui quelque chose ; leurs traces s’arrêtent net au milieu de la galerie.'] },
  { id: 'epave-convoi', label: 'Épave d’un convoi duergar', cat: 'ruine', w: () => 1.5, see: 0.01,
    glimpse: ['Sur votre {c}, une charrette renversée et des caisses éventrées.'],
    amb: ['Des chariots renversés, des lézards de bât morts depuis longtemps : un convoi n’est jamais arrivé.', 'Des caisses éventrées et des lingots oubliés gisent dans une niche.'],
    scene: ['Des pillards fouillent l’épave et n’aiment pas la concurrence.', 'Un survivant duergar, à demi fou, garde encore la cargaison.'],
    quete: ['Le registre du convoi mentionne une caisse scellée qui manque à l’appel.', 'Le clan du convoi offre une prime pour retrouver le contremaître disparu.'] },
  { id: 'autel-lolth', label: 'Autel de Lolth', cat: 'sanctuaire', danger: 1, w: () => 1, see: 0.006, dc: 14,
    glimpse: ['Sur votre {c}, des bougies violettes brûlent dans une niche, devant une silhouette à huit pattes.'],
    amb: ['Un autel d’obsidienne en forme d’araignée, couvert de cire violette et d’offrandes sanglantes.', 'Une niche tendue de soie, une statue de la Reine Araignée aux yeux de rubis.'],
    scene: ['Une prêtresse drow officie et n’apprécie pas les témoins.', 'L’autel murmure aux voyageurs des promesses de pouvoir.'],
    quete: ['Les yeux de rubis de la statue valent une fortune… et la déesse le sait.', 'Un enfant svirfnebelin est promis au sacrifice de la prochaine lune.'] },
  { id: 'sanctuaire-svirf', label: 'Sanctuaire svirfnebelin caché', cat: 'sanctuaire', w: () => 1, see: 0.005, dc: 15,
    glimpse: ['Sur votre {c}, la paroi semble un peu trop lisse, et une gemme y luit faiblement.'],
    amb: ['Derrière une paroi factice, une petite chapelle taillée par les gnomes des profondeurs, ornée de gemmes.', 'Une niche secrète où brûle une lampe de cristal devant une statue de gnome souriant.'],
    scene: ['Un gardien svirfnebelin jaillit de la roche et exige le mot de passe.', 'Des gnomes y cachent des réfugiés et prient pour qu’on ne les trahisse pas.'],
    quete: ['Le sanctuaire garde la carte d’un passage sûr jusqu’à la cité des gnomes.', 'Une gemme sacrée du sanctuaire a été volée ; les gnomes accusent les premiers venus.'] },
  { id: 'myconides', label: 'Colonie de myconides', cat: 'vivant', w: () => 1.5, see: 0.01,
    glimpse: ['Sur votre {c}, des silhouettes trapues, coiffées de chapeaux, se tournent lentement vers vous.'],
    amb: ['Des myconides immobiles se dressent en cercle, reliés par un réseau de filaments pâles.', 'Une colonie de champignons doués de vie dort dans une niche ; leurs spores dansent dans l’air.'],
    scene: ['Le souverain myconide invite les voyageurs à « partager l’union » par ses spores.', 'Des myconides sont malades : une moisissure noire les ronge.'],
    quete: ['Les myconides demandent qu’on chasse le fléau qui dévore leur cercle.', 'Un ancien myconide se souvient de la surface et du soleil, qu’il voudrait revoir avant de mourir.'] },
  { id: 'gricks', label: 'Repaire de gricks', cat: 'danger', danger: 1, w: (c) => (c.trace === 'boyau' || c.trace === 'etroit' ? 2 : 1), see: 0.006, dc: 13,
    glimpse: ['Sur votre {c}, des os rongés jonchent l’entrée d’un trou dans la paroi.'],
    amb: ['Un trou dans la paroi, tapissé d’os rongés et de mues de vers.', 'Une niche puante, où des formes reptiliennes ont laissé des traînées de mucus.'],
    scene: ['Des gricks se déroulent lentement depuis le plafond.', 'Un grick blessé bloque le passage et attaque tout ce qui bouge.'],
    quete: ['Parmi les os, une sacoche de messager intacte et son sceau.', 'Le nid grandit : bientôt, les gricks couperont la galerie aux convois.'] },
  { id: 'vapeur', label: 'Faille de vapeur', cat: 'danger', w: () => 1, see: 0.01,
    glimpse: ['Un sifflement aigu, sur votre {c} : un jet de vapeur jaillit d’une fissure.'],
    amb: ['Une fissure crache par intermittence des jets de vapeur brûlante ; la roche y est lisse et chaude.', 'Une faille rouge sombre où l’air tremble de chaleur.'],
    scene: ['Un mephite de vapeur joue avec les jets et s’amuse à ébouillanter les passants.', 'Des forgerons duergars y ont installé un atelier clandestin.'],
    quete: ['La vapeur fait tourner une machine oubliée : un ascenseur vers une strate inconnue.', 'Un œuf de salamandre couve dans la fissure brûlante.'] },
  { id: 'ossuaire', label: 'Ossuaire oublié', cat: 'ruine', danger: 1, w: () => 1, see: 0.008,
    glimpse: ['Sur votre {c}, des crânes empilés en mur tapissent une alcôve.'],
    amb: ['Des milliers de crânes empilés avec soin forment les murs d’une crypte creusée dans la paroi.', 'Une niche funéraire, des niches plus petites, et une inscription effacée.'],
    scene: ['Des goules se repaissent dans l’ossuaire.', 'Une ombre glisse d’un crâne à l’autre, sans bruit.'],
    quete: ['Un des crânes porte une couronne de fer : celle d’un roi des profondeurs oublié.', 'L’ossuaire est plein : quelque chose « range » les morts de la galerie.'] },
  { id: 'filon', label: 'Filon de mithral', cat: 'ressource', w: () => 1, see: 0.006, dc: 13,
    glimpse: ['Sur votre {c}, un éclat argenté accroche la lumière dans la paroi.'],
    amb: ['Une veine argentée court dans la roche, plus brillante que l’argent ; quelqu’un l’a déjà entamée.', 'Des traces de pioche récentes autour d’un filon de métal pâle.'],
    scene: ['Des mineurs enchaînés y travaillent sous la garde de contremaîtres.', 'Deux clans se disputent le filon, armes au clair.'],
    quete: ['Le filon vaut une fortune ; le premier à le déclarer au conseil de la cité en aura les droits.', 'Le mithral « chante » : une créature dort dans la veine.'] },
  { id: 'vase', label: 'Mare de vase', cat: 'danger', danger: 1, w: () => 1, see: 0.006, dc: 12,
    glimpse: ['Sur votre {c}, une flaque luisante semble frémir.'],
    amb: ['Une mare luisante dans une niche ; des ossements à demi dissous en dépassent.', 'Le sol d’une alcôve est couvert d’une gelée translucide qui reflète la lumière.'],
    scene: ['La mare se soulève et glisse vers les voyageurs.', 'Un objet brillant flotte au milieu de la vase.'],
    quete: ['Au fond de la mare, une épée qui ne rouille pas.', 'Un alchimiste veut un échantillon vivant de cette vase.'] },
  { id: 'refugies', label: 'Bivouac de réfugiés', cat: 'institution', w: () => 1, see: 0.01,
    glimpse: ['Sur votre {c}, une maigre lueur de feu et des chuchotements s’arrêtent net.'],
    amb: ['Un bivouac déserté : des couvertures, une marmite froide, des jouets d’enfant.', 'Une alcôve aménagée pour dormir, des inscriptions de plusieurs peuples sur la paroi.'],
    scene: ['Une famille de réfugiés svirfnebelins fuit les drows et demande une escorte.', 'Des réfugiés affamés hésitent entre demander de l’aide et voler.'],
    quete: ['Les réfugiés fuient une cité tombée ; personne ne les croit encore.', 'Un enfant parmi eux porte un sceau royal.'] },
  { id: 'chauves-souris', label: 'Dortoir de chauves-souris', cat: 'vivant', w: () => 1.5, see: 0.01,
    glimpse: ['Un bruissement d’ailes emplit une faille, sur votre {c}.'],
    amb: ['Des milliers de chauves-souris pendent à la voûte d’une haute faille ; le guano couvre le sol.', 'Une cheminée naturelle où dort une colonie entière ; l’air y est âcre.'],
    scene: ['Un bruit trop fort : la nuée entière s’envole et aveugle les voyageurs.', 'Une chauve-souris géante veille sur la colonie.'],
    quete: ['Le guano de la faille, riche en salpêtre, vaut une fortune pour la poudre des duergars.', 'La cheminée remonte peut-être jusqu’à la surface : un courant d’air frais le laisse croire.'] },
];
/** Compléments de nom (sous terre). */
const NAMES = ['des Murmures', 'aux Échos', 'des Égarés', 'du Silence', 'aux Lueurs', 'des Os blanchis', 'de l’Ancien', 'du Puits noir', 'des Gouttes', 'de la Veuve', 'aux Spores', 'du Vent froid', 'des Oubliés', 'de la Dernière Torche', 'aux Cent Pattes', 'du Gardien'];
/** Touches d'ambiance souterraines, pour varier les textes. */
const TOUCH = ['Une goutte tombe quelque part, avec une régularité d’horloge.', 'L’air sent la pierre mouillée et le salpêtre.', 'Un courant d’air froid fait vaciller les torches.', 'Le silence y est si épais qu’on entend son sang battre.', 'Des lichens luminescents dessinent des motifs sur la paroi.', 'Un écho renvoie les pas avec un temps de retard.', 'La roche est tiède sous la main, comme vivante.', 'Des griffures anciennes marquent la pierre.', 'Une odeur de champignon et de terre remplit l’air.', 'On jurerait entendre un murmure, très loin.', 'Des concrétions pendent comme des dents.', 'La poussière n’a pas été dérangée depuis des années.'];

const segDist = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], q = dx * dx + dy * dy;
  const t = q ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / q)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const insidePoly = (p, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c; }
  return c;
};

/**
 * Lieux d'un plan : `trails` [{ id, trace, pts }], `caves` (contours, 0–1), `points` (lieux existants, 0–1), `water`
 * (tracés de ruisseau). Les galeries secrètes et les crevasses n'en ont pas. `skip` : clés déjà enregistrées.
 */
export function deepSitesOn({ planId, trails, caves = [], points = [] }, skip = new Set()) {
  const out = [];
  for (const tr of trails) {
    if (!tr.pts || tr.pts.length < 2 || tr.trace === 'secret' || tr.trace === 'crevasse') continue;
    const len = tr.pts.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - tr.pts[i][0], q[1] - tr.pts[i][1]), 0);
    const r = rng(hash(`deep:${tr.id}`));
    // Une galerie courte a sa chance, au prorata de sa longueur.
    const slots = Math.floor(len / SLOT + r());
    const span = Math.min(SLOT, len);
    for (let k = 0; k < slots; k++) {
      const roll = [r(), r(), r(), r(), r(), r(), r(), r(), r(), r(), r(), r()];
      if (roll[0] > CHANCE) continue;
      const key = `${tr.id}~${k}`;
      if (skip.has(key)) continue;
      // Point du tracé, puis un pas de côté (une niche, une faille latérale).
      let s = k * SLOT + (0.2 + roll[1] * 0.6) * span, i = 0, seg = 0;
      for (; i < tr.pts.length - 1; i++) { seg = Math.hypot(tr.pts[i + 1][0] - tr.pts[i][0], tr.pts[i + 1][1] - tr.pts[i][1]); if (s <= seg) break; s -= seg; }
      if (i >= tr.pts.length - 1) continue;
      const a = tr.pts[i], b = tr.pts[i + 1], t = seg ? s / seg : 0;
      const nx = -(b[1] - a[1]) / (seg || 1), ny = (b[0] - a[0]) / (seg || 1), side = roll[2] < 0.5 ? 1 : -1, off = 0.003 + roll[3] * 0.004;
      const at = [a[0] + (b[0] - a[0]) * t + nx * off * side, a[1] + (b[1] - a[1]) * t + ny * off * side];
      if (at[0] < 0.01 || at[0] > 0.99 || at[1] < 0.01 || at[1] > 0.99) continue;
      if (caves.some((poly) => insidePoly(at, poly))) continue;
      if (points.some((p) => Math.hypot(p[0] - at[0], p[1] - at[1]) < 0.006)) continue;
      const c = { trace: tr.trace, water: tr.trace === 'ruisseau' };
      const weights = KINDS.map((kd) => kd.w(c));
      let w = roll[4] * weights.reduce((x, y) => x + y, 0), kind = KINDS[0];
      for (let m = 0; m < KINDS.length; m++) { w -= weights[m]; if (w <= 0) { kind = KINDS[m]; break; } }
      const teneur = roll[5] < TENEUR_P[0] ? 'ambiance' : roll[5] < TENEUR_P[1] ? 'scene' : 'quete';
      // Sous terre, rien n'est tout à fait sûr : une scène ou une accroche est au moins incertaine.
      let lvl = teneur === 'ambiance' ? 0 : 1 + (roll[6] < 0.35 ? 1 : 0);
      if (kind.danger && teneur !== 'ambiance') lvl += kind.danger;
      out.push({
        key, planId, at: [Math.round(at[0] * 1e5) / 1e5, Math.round(at[1] * 1e5) / 1e5], kind: kind.id, label: kind.label, cat: kind.cat,
        title: `${kind.label} ${pick(roll[2] * 0.5 + roll[3] * 0.5, NAMES)}`, teneur, danger: ['calme', 'incertain', 'dangereux', 'perilleux'][Math.min(3, lvl)],
        text: [pick(roll[7], kind.amb), roll[8] < 0.75 ? pick(roll[9], TOUCH) : ''].filter(Boolean).join(' '),
        scene: teneur === 'scene' ? pick(roll[10], kind.scene) : undefined,
        hook: teneur === 'quete' ? pick(roll[11], kind.quete) : undefined,
        trailId: tr.id,
      });
    }
  }
  return out;
}

/** Ce qu'on voit d'un lieu depuis la galerie : portée (unités de plan), DD s'il est caché, phrase d'annonce ({c}). */
export function deepSightOf(site) {
  const k = KINDS.find((x) => x.id === site.kind) ?? {};
  const lines = k.glimpse ?? ['Sur votre {c}, quelque chose luit faiblement dans une niche.'];
  return { reach: k.see ?? 0.008, dc: k.dc, line: lines[hash(site.key) % lines.length] };
}

/** Types connus (formulaire « Définir »). */
export const DEEP_KINDS = KINDS.map((k) => ({ id: k.id, label: k.label, cat: k.cat }));
