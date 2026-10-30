/**
 * Catalogue du bestiaire : les fiches rangées par type (humanoïde, bête, mort-vivant…), puis par famille (le gobelin et
 * ses variantes), chaque famille triée de la plus faible à la plus forte. Sert à la liste de PNJ & Créatures, au
 * sélecteur de créatures du combat et au passage d'une variante à l'autre (« plus forte » / « plus faible »).
 */

const TYPE_FR = {
  Humanoid: 'Humanoïdes', Beast: 'Bêtes', Monstrosity: 'Monstruosités', Undead: 'Morts-vivants', Plant: 'Plantes et champignons',
  'Plant/Fungus': 'Plantes et champignons', Aberration: 'Aberrations', Construct: 'Créatures artificielles', Swarm: 'Nuées', Ooze: 'Vases et limons',
  Fiend: 'Fiélons', Elemental: 'Élémentaires', Dragon: 'Dragons', Giant: 'Géants', Hazard: 'Dangers', 'Humanoid/Fungus': 'Humanoïdes',
  Celestial: 'Célestes', Fey: 'Fées',
};
/** Types français saisis à la main ou venus du SRD (« Humanoïde (gobelinoïde) »…). */
const TYPE_GUESS = [
  [/humano/i, 'Humanoïdes'], [/b[êe]te/i, 'Bêtes'], [/monstruo/i, 'Monstruosités'], [/mort-vivant/i, 'Morts-vivants'], [/plante|champignon|fong/i, 'Plantes et champignons'],
  [/aberration/i, 'Aberrations'], [/artificiel|construct|golem/i, 'Créatures artificielles'], [/nu[ée]e/i, 'Nuées'], [/vase|limon|gel[ée]e/i, 'Vases et limons'],
  [/fi[ée]lon|d[ée]mon|diable/i, 'Fiélons'], [/[ée]l[ée]mentaire/i, 'Élémentaires'], [/dragon/i, 'Dragons'], [/g[ée]ant/i, 'Géants'],
];

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const isMon = (n) => n.entityType === 'monster' || n.isMonster;

/** Type d'une fiche, en français, pour la ranger. */
export function typeOf(n) {
  const u = n.underdark;
  if (u?.category && TYPE_FR[u.category]) return TYPE_FR[u.category];
  const text = `${n.type || ''} ${n.kind || ''}`;
  for (const [re, label] of TYPE_GUESS) if (re.test(text)) return label;
  return isMon(n) ? 'Autres créatures' : 'PNJ';
}

/** Puissance d'une fiche pour trier une famille : FP, puis indice de danger Underdark, puis PV. */
export function powerOf(n) {
  const raw = String(n.cr ?? n.underdark?.stats?.challengeRatingEstimate ?? '0').split(' ')[0].replace('+', '');
  const cr = raw.includes('/') ? Number(raw.split('/')[0]) / Number(raw.split('/')[1]) : Number(raw) || 0;
  return cr * 100 + (n.underdark?.danger?.tier ?? 0) * 10 + Math.min(9, (Number(n.hp) || 0) / 100);
}

/** Mots qui distinguent une variante de sa souche (« Cube gélatineux juvénile » → « cube gelatineux »). */
const VARIANT_WORDS = /\b(juvenile|jeune|adulte|ancien|ancienne|vieux|vieille|mature|alpha|elite|veteran|veterane|novice|apprenti|chef|champion|seigneur|reine|roi|geant|geante|grand|grande|petit|petite|enorme|majeur|mineur|primordial|primordiale|massif|massive)\b/g;

/**
 * Famille d'une fiche : la famille du bestiaire Underdark (souche + variantes), sinon le nom sans ses mots de variante.
 * Renvoie une clé stable.
 */
export function familyKeyOf(n, byUd) {
  const u = n.underdark;
  if (u?.familyId) return `fam:${u.familyId}`;
  if (u?.variantOf) return `fam-of:${u.variantOf}`;
  // Souche d'une famille Underdark : d'autres fiches la désignent comme variantOf.
  if (u?.id && byUd?.has(`fam-of:${u.id}`)) return `fam-of:${u.id}`;
  const stem = fold(n.name).replace(/\(.*?\)/g, '').replace(VARIANT_WORDS, '').replace(/\b(de|des|du|d)\b\s*$/, '').replace(/\s+/g, ' ').trim();
  return `nom:${stem || fold(n.name)}`;
}

/** Nom affiché d'une famille : la souche si elle est là, sinon le nom commun le plus court. */
function familyName(members) {
  const base = members.find((m) => !m.underdark?.variantOf && m.underdark?.familyId === undefined && members.length > 1 && members.some((x) => x.underdark?.variantOf === m.underdark?.id));
  if (base) return base.name;
  const fam = members.find((m) => m.underdark?.familyId)?.underdark?.familyId;
  if (fam) return fam.charAt(0).toUpperCase() + fam.slice(1).replace(/-/g, ' ');
  return [...members].sort((a, b) => a.name.length - b.name.length)[0].name;
}

/**
 * Arbre du bestiaire : [{ type, count, families: [{ key, name, members (de la plus faible à la plus forte) }] }].
 * Les types sont triés par nom, les familles aussi ; les PNJ forment leur propre rubrique, en tête.
 */
export function buildCatalog(npcs) {
  const variantOwners = new Set();
  for (const n of npcs) if (n.underdark?.variantOf) variantOwners.add(`fam-of:${n.underdark.variantOf}`);
  const byType = new Map();
  for (const n of npcs) {
    const type = isMon(n) ? typeOf(n) : 'PNJ';
    let key = familyKeyOf(n, variantOwners);
    // Une famille Underdark par familyId et sa souche (désignée par variantOf) ne font qu'une.
    if (key.startsWith('fam-of:')) {
      const root = npcs.find((m) => m.underdark?.id === key.slice(7));
      const viaFamily = npcs.find((m) => m.underdark?.variantOf === key.slice(7) && m.underdark?.familyId);
      if (viaFamily) key = `fam:${viaFamily.underdark.familyId}`;
      else if (root?.underdark?.familyId) key = `fam:${root.underdark.familyId}`;
    }
    if (!byType.has(type)) byType.set(type, new Map());
    const fams = byType.get(type);
    if (!fams.has(key)) fams.set(key, []);
    fams.get(key).push(n);
  }
  const out = [...byType.entries()].map(([type, fams]) => ({
    type,
    count: [...fams.values()].reduce((s, m) => s + m.length, 0),
    families: [...fams.entries()]
      .map(([key, members]) => ({ key, name: familyName(members), members: [...members].sort((a, b) => powerOf(a) - powerOf(b) || a.name.localeCompare(b.name, 'fr')) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  }));
  return out.sort((a, b) => (a.type === 'PNJ' ? -1 : b.type === 'PNJ' ? 1 : a.type.localeCompare(b.type, 'fr')));
}

/** Les variantes de la même famille qu'une fiche, de la plus faible à la plus forte, et sa position. */
export function siblingsOf(n, npcs) {
  for (const t of buildCatalog(npcs)) for (const f of t.families) {
    const i = f.members.findIndex((m) => m.id === n.id);
    if (i >= 0) return { family: f, index: i, weaker: f.members[i - 1] ?? null, stronger: f.members[i + 1] ?? null };
  }
  return { family: null, index: -1, weaker: null, stronger: null };
}
