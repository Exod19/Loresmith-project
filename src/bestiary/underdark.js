/**
 * Bestiaire Underdark (683 fiches, src/data/underdark/bestiaire-683.json) : conversion au format des fiches de
 * PNJ & Créatures, et plan d'import NON destructif (seulement les IDs absents ; jamais d'écrasement).
 *
 * Les champs d'origine sont conservés intacts sous `underdark` (lootTable, gridFootprint, variantOf, visualAnchor,
 * rightsReview, sentience, danger, écologie…). Les statistiques sont des adaptations maison LoreSmith, pas des blocs
 * officiels : la fiche le dit dans `source`.
 */

const SIZE = { Tiny: 'TP', Small: 'P', Medium: 'M', Large: 'G', Huge: 'TG', Gargantuan: 'Gig', 'Medium Swarm': 'M' };
const DMG = {
  piercing: 'perforants', bludgeoning: 'contondants', slashing: 'tranchants', poison: 'de poison', acid: 'd’acide', necrotic: 'nécrotiques',
  psychic: 'psychiques', fire: 'de feu', force: 'de force', thunder: 'de tonnerre', lightning: 'de foudre', cold: 'de froid', radiant: 'radiants',
};
const RES = { poison: 'poison', necrotic: 'nécrotique', fire: 'feu', piercing: 'perforant', slashing: 'tranchant', bludgeoning: 'contondant', psychic: 'psychique', acid: 'acide', thunder: 'tonnerre', force: 'force', cold: 'froid', lightning: 'foudre', radiant: 'radiant', charm: 'charme' };
const COND = { poisoned: 'empoisonné', exhaustion: 'épuisement', charmed: 'charmé', frightened: 'effrayé', paralyzed: 'paralysé', petrified: 'pétrifié', prone: 'à terre', blinded: 'aveuglé', deafened: 'assourdi', grappled: 'agrippé', restrained: 'entravé', stunned: 'étourdi', unconscious: 'inconscient' };
const ABIL = { str: 'For', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Sag', cha: 'Cha' };
const ABIL_FULL = { str: 'Force', dex: 'Dextérité', con: 'Constitution', int: 'Intelligence', wis: 'Sagesse', cha: 'Charisme' };
const SKILL = { stealth: 'Discrétion', perception: 'Perception', athletics: 'Athlétisme', acrobatics: 'Acrobaties', insight: 'Perspicacité', deception: 'Tromperie', persuasion: 'Persuasion', intimidation: 'Intimidation', survival: 'Survie', investigation: 'Investigation', arcana: 'Arcanes', religion: 'Religion', history: 'Histoire', nature: 'Nature', medicine: 'Médecine' };

const ftToM = (ft) => `${String(Math.round(Number(ft) * 0.3 * 10) / 10).replace('.', ',')} m`;
const sign = (n) => (Number(n) >= 0 ? `+${Number(n)}` : `${Number(n)}`);
const tr = (map, v) => String(v || '').split(/\s*(\+|or|ou)\s*/).map((x) => map[x.trim()] ?? x).filter((x) => x && !['+', 'or', 'ou'].includes(x)).join(' ');
const frRange = (r) => String(r || '')
  .replace(/\bmelee\b/i, 'mêlée').replace(/\branged\b/i, 'distance').replace(/\bself\b/i, 'soi-même').replace(/see effects/i, 'voir effets')
  .replace(/(\d+)\s*ft/g, (_, n) => ftToM(n));

/** Vitesses : « 9 m, escalade 9 m, vol 18 m ». */
function speedOf(mv = {}) {
  const parts = [];
  if (mv.walk) parts.push(ftToM(mv.walk));
  for (const [k, label] of [['climb', 'escalade'], ['swim', 'nage'], ['fly', 'vol'], ['burrow', 'fouissement']]) if (mv[k]) parts.push(`${label} ${ftToM(mv[k])}`);
  return parts.join(', ') || '0 m';
}

/** Une action de la fiche d'origine → action jouable (bonus, dés, type de dégâts, portée, effets et sauvegarde). */
function actionOf(a, type) {
  const m = /^(\d+d\d+)\s*([+-]\s*\d+)?/.exec(String(a.damage || '').replace(/\s/g, ''));
  const save = a.save ? `${ABIL_FULL[a.save.ability] ?? a.save.ability} DD ${a.save.dc}` : '';
  const desc = [
    ...(Array.isArray(a.effects) ? a.effects : [a.effect].filter(Boolean)),
    a.recharge ? `Recharge : ${a.recharge}.` : '',
  ].filter(Boolean).join(' ');
  return {
    name: a.name,
    type: type ?? ({ bonus_action: 'bonus action', free_trigger: 'réaction' }[a.actionType] || 'action'),
    attackBonus: Number(a.toHit) > 0 ? Number(a.toHit) : undefined,
    damageDice: m ? m[1] : '',
    damageBonus: m && m[2] ? Number(m[2].replace(/\s/g, '')) : 0,
    damageType: a.damageType && !['none', 'special'].includes(a.damageType) ? tr(DMG, a.damageType) : '',
    range: frRange(a.range),
    save,
    desc: [save && `Sauvegarde ${save}.`, desc].filter(Boolean).join(' '),
  };
}

/** Fiche LoreSmith (avant normalisation par l'application) à partir d'une fiche du bestiaire Underdark. */
export function entityFromUnderdark(c) {
  const s = c.stats || {};
  const at = s.attributes || {};
  const tactics = c.tactics && typeof c.tactics === 'object'
    ? [c.tactics.opening && `Ouverture : ${c.tactics.opening}`, c.tactics.priority && `Priorité : ${c.tactics.priority}`, c.tactics.retreat && `Repli : ${c.tactics.retreat}`, c.tactics.terrain && `Terrain : ${c.tactics.terrain}`, c.tactics.encounterGroup && `Groupe : ${c.tactics.encounterGroup}`].filter(Boolean).join('\n')
    : String(c.tactics || '');
  const loot = Array.isArray(c.lootTable) && c.lootTable.length
    ? c.lootTable.map((l) => ({ roll: l.chancePercent != null ? `${l.chancePercent} %` : '', item: l.item, desc: [l.quantity, l.source, l.requirement, l.notes].filter(Boolean).join(' · '), rarity: 'mundane' }))
    : (c.loot || []).map((item) => ({ roll: '', item, desc: 'Potentiel récupérable, jamais garanti.', rarity: 'mundane' }));
  return {
    name: c.name,
    kind: c.subtype || c.category || '',
    type: c.category || '',
    size: SIZE[c.size] ?? 'M',
    alignment: c.alignmentSuggestion || '',
    role: (c.roles || []).join(', '),
    faction: typeof c.factionOrCulture === 'object' && c.factionOrCulture ? Object.entries(c.factionOrCulture).map(([k, v]) => (typeof v === 'boolean' ? (v ? k : '') : String(v))).filter(Boolean).join(' · ') : c.factionOrCulture || '',
    shortDescription: c.shortDescription || '',
    description: c.description || '',
    sceneUse: c.encounterUse || '',
    cr: String(s.challengeRatingEstimate ?? '').split(' ')[0] || '1',
    ac: Number(s.armor) || 10,
    hp: Number(s.hp) || 1,
    speed: speedOf(s.movement),
    str: at.str ?? 10, dex: at.dex ?? 10, con: at.con ?? 10, int: at.int ?? 10, wis: at.wis ?? 10, cha: at.cha ?? 10,
    saves: Object.entries(s.savingThrows || {}).map(([k, v]) => ({ name: ABIL[k] ?? k, bonus: sign(v) })),
    skills: Object.entries(s.skills || {}).map(([k, v]) => ({ name: SKILL[k] ?? k, bonus: sign(v) })),
    vulnerabilities: (s.vulnerabilities || []).map((x) => tr(RES, x)).join(', '),
    resistances: (s.resistances || []).map((x) => tr(RES, x)).join(', '),
    immunities: (s.immunities || []).map((x) => tr(RES, x)).join(', '),
    conditionImmunities: (s.conditionImmunities || []).map((x) => COND[x] ?? x).join(', '),
    senses: [...(s.senses || []).map((x) => frRange(String(x).replace(/darkvision/i, 'vision dans le noir').replace(/blindsight/i, 'perception aveugle').replace(/tremorsense/i, 'perception des vibrations'))), s.perception ? `Perception passive ${s.perception}` : ''].filter(Boolean).join(', '),
    languages: (s.languages || []).join(', ') || '—',
    traits: (c.passives || []).map((p) => ({ name: p.name, desc: p.effect })),
    actions: [...(c.actions || []).map((a) => actionOf(a)), ...(c.reactions || []).map((r) => ({ name: r.name, type: 'reaction', desc: r.effect }))],
    legendaryActions: (c.legendaryActions?.options || []).map((o) => ({ name: `${o.name}${o.cost > 1 ? ` (coûte ${o.cost})` : ''}`, desc: o.effect })),
    effects: (c.buffs || []).map((b) => ({ name: b.name, desc: b.effect, short: '', active: false, source: 'Bestiaire Underdark' })),
    tactics,
    lootTable: loot,
    imagePrompt: c.images?.portraitPrompt || '',
    habitat: c.habitat || [],
    tags: c.tags || ['Underdark'],
    underdarkId: c.id,
    source: 'Bestiaire Underdark LoreSmith (adaptation maison, non officielle)',
    // Fiche d'origine intacte : rien n'est perdu (empreinte de grille, butin détaillé, variantes, droits…).
    underdark: c,
  };
}

/** Une fiche de la bibliothèque déjà liée au bestiaire Underdark (par son ID d'origine). */
export const underdarkIdOf = (n) => n?.underdarkId || n?.underdark?.id || (typeof n?.sourceId === 'string' && /^underdark_\d{3}$/.test(n.sourceId) ? n.sourceId : null);

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Plan d'import : quelles fiches ajouter (IDs absents), lesquelles sont déjà là (laissées telles quelles), et les cas
 * à revoir (même nom sans lien d'ID, ou fiche liée qui diffère du bestiaire : jamais modifiée automatiquement).
 */
export function planUnderdarkImport(master, existing) {
  const byId = new Map();
  for (const n of existing) { const id = underdarkIdOf(n); if (id) byId.set(id, n); }
  const byName = new Map(existing.filter((n) => !underdarkIdOf(n)).map((n) => [fold(n.name), n]));
  const add = [], present = [], review = [];
  for (const c of master.creatures || []) {
    const cur = byId.get(c.id);
    if (cur) {
      present.push(c.id);
      const diff = ['name', 'hp', 'ac'].filter((k) => {
        const want = k === 'name' ? c.name : k === 'hp' ? Number(c.stats?.hp) : Number(c.stats?.armor);
        return cur[k] !== undefined && String(cur[k]) !== String(want);
      });
      if (diff.length) review.push({ id: c.id, name: c.name, localId: cur.id, reason: 'modifiée localement', fields: diff });
      continue;
    }
    const same = byName.get(fold(c.name));
    if (same) { review.push({ id: c.id, name: c.name, localId: same.id, reason: 'même nom déjà présent, sans lien d’ID', fields: [] }); continue; }
    add.push(c);
  }
  return { add, present, review, total: (master.creatures || []).length };
}

/** Contrôle du bestiaire : IDs uniques, variantes reliées, tag Underdark, taille et PV cohérents. */
export function checkUnderdarkMaster(master) {
  const errors = [];
  const ids = new Set();
  for (const c of master.creatures || []) {
    if (ids.has(c.id)) errors.push(`${c.id} : ID en double`);
    ids.add(c.id);
    if (!(c.tags || []).includes('Underdark')) errors.push(`${c.id} : tag Underdark absent`);
    if (!SIZE[c.size]) errors.push(`${c.id} : taille inconnue « ${c.size} »`);
    if (!(Number(c.stats?.hp) > 0)) errors.push(`${c.id} : PV absents`);
    if (!c.gridFootprint) errors.push(`${c.id} : emprise de grille absente`);
  }
  for (const c of master.creatures || []) if (c.variantOf && !ids.has(c.variantOf)) errors.push(`${c.id} : variante de ${c.variantOf} introuvable`);
  return { ok: !errors.length, count: ids.size, errors };
}

/** Cases occupées sur la grille de combat (cases de 5 pieds ; une nuée garde son emprise). */
export function gridCellsOf(c) {
  const g = c?.gridFootprint;
  const w = g?.recommendedTokenCells?.width ?? g?.integerCellRendererFallback?.width ?? g?.widthCells ?? 1;
  return Math.max(1, Math.round(w));
}
