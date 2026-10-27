/**
 * PNJ & Créatures : génération par l'IA (fiche 5e complète), import d'une fiche SRD sans IA,
 * et normalisation de ce que l'IA renvoie (elle ne respecte pas toujours le format).
 */
import { STATS } from '../maps/atlas/statblocks';
import { LORE_RULES, norm } from '../ai/loreContext';

const num = (v, d = 0) => {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : d;
};
const str = (v) => (v == null ? '' : typeof v === 'string' ? v : Array.isArray(v) ? v.map(str).join(', ') : typeof v === 'object' ? Object.values(v).map(str).join(' — ') : String(v));
const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const named = (list) => arr(list).map((x) => (typeof x === 'string' ? { name: x.split(/[.:]/)[0], desc: x } : { ...x, name: str(x.name), desc: str(x.desc ?? x.description) })).filter((x) => x.name || x.desc);

/** Bonus de maîtrise selon le FP. */
export function proficiencyForCr(cr) {
  const v = String(cr || '0').split(/\s/)[0];
  const n = v.includes('/') ? 0 : Number(v) || 0;
  return n < 5 ? 2 : n < 9 ? 3 : n < 13 ? 4 : n < 17 ? 5 : n < 21 ? 6 : n < 25 ? 7 : n < 29 ? 8 : 9;
}

const XP = { '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000, '21': 33000, '22': 41000, '23': 50000, '24': 62000, '30': 155000 };
export const xpForCr = (cr) => XP[String(cr || '').split(/\s/)[0]] ?? null;

const SCHEMA = `{
  "name": str, "kind": "nature / espèce", "size": "TP|P|M|G|TG|Gig", "type": "humanoïde, bête, aberration…", "alignment": str,
  "role": str, "faction": str, "attitude": "hostile|neutre|amical|craintif|manipulateur|inconnu",
  "function": "métier / place dans le monde", "shortDescription": "une phrase", "description": "apparence, 1 paragraphe",
  "backstory": "1 à 2 paragraphes", "voice": str, "speechPatterns": str, "motivation": str, "secret": str, "sceneUse": str,
  "quotes": ["3 répliques réelles, dans sa voix"],
  "cr": "ex. 1/2, 3", "ac": num, "acNote": "armure naturelle, cuir…", "hp": num, "hitDice": "ex. 6d8+12", "speed": "9 m, escalade 6 m",
  "str": num, "dex": num, "con": num, "int": num, "wis": num, "cha": num,
  "saves": [{ "name": "Dex", "bonus": "+4" }], "skills": [{ "name": "Discrétion", "bonus": "+6", "desc": "" }],
  "vulnerabilities": str, "resistances": str, "immunities": str, "conditionImmunities": str,
  "senses": "vision dans le noir 18 m, Perception passive 12", "languages": str,
  "traits": [{ "name": str, "desc": str }],
  "spellcasting": { "ability": str, "dc": num, "attack": str, "list": [str] },
  "actions": [{ "name": str, "type": "action|bonus action|reaction|legendary action|lair action", "ability": "str|dex|con|int|wis|cha",
    "attackBonus": num, "damageDice": "1d8", "damageBonus": num, "damageType": str, "range": str, "desc": "texte complet de l'action", "save": "ex. Con DD 13",
    "usesMax": num, "usesLeft": num, "reset": "round|turn|short rest|long rest|day|encounter|none" }],
  "legendaryActions": [{ "name": str, "desc": str }],
  "effects": [{ "name": str, "icon": "emoji", "short": str, "desc": str, "active": false, "usesMax": num, "usesLeft": num, "reset": str }],
  "tactics": "comment il se bat, quand il fuit ou négocie",
  "lootTable": [{ "roll": "1-10", "item": str, "desc": str, "rarity": "mundane|funny|damaged|clue|minor|valuable|magical" }],
  "imagePrompt": "description visuelle en anglais pour un portrait (sans texte)"
}`;

const SYSTEM = `Tu es le concepteur de PNJ et de créatures de Loresmith (D&D 5e).
Réponds UNIQUEMENT en JSON valide, sans Markdown. Tout le texte est en français (sauf imagePrompt, en anglais).
Les fiches sont COMPLÈTES et jouables telles quelles : caractéristiques cohérentes avec le FP, actions avec bonus d'attaque et dégâts,
sauvegardes avec DD. Un PNJ a aussi des statistiques (souvent modestes), mais sa voix, ses motivations et ses secrets comptent d'abord.
Le butin est rare et modeste (souvent banal, abîmé, drôle ou porteur d'indice). Tables de butin en plages de d20 ("1-5", "6-14"…).
${LORE_RULES}`;

const DIFFICULTY = { trivial: 'très facile', easy: 'facile', moderate: 'moyenne', hard: 'difficile', deadly: 'mortelle', boss: 'boss du groupe' };

/** Normalise une fiche renvoyée par l'IA. */
export function normalizeEntity(d, mode) {
  const isMonster = mode === 'monster';
  const actions = arr(d.actions).map((a) =>
    typeof a === 'string'
      ? { name: a.split(/[.:]/)[0], type: 'action', desc: a }
      : { ...a, name: str(a.name), type: str(a.type) || 'action', desc: str(a.desc ?? a.description), usesLeft: a.usesLeft ?? a.usesMax }
  );
  return {
    ...d,
    entityType: isMonster ? 'monster' : 'npc',
    isMonster,
    name: str(d.name) || (isMonster ? 'Créature sans nom' : 'PNJ sans nom'),
    kind: str(d.kind),
    size: str(d.size),
    type: str(d.type),
    alignment: str(d.alignment),
    role: str(d.role),
    function: str(d.function),
    shortDescription: str(d.shortDescription),
    description: str(d.description),
    backstory: str(d.backstory),
    voice: str(d.voice),
    speechPatterns: str(d.speechPatterns),
    motivation: str(d.motivation),
    secret: str(d.secret),
    sceneUse: str(d.sceneUse),
    quotes: arr(d.quotes).map(str).filter(Boolean),
    cr: str(d.cr) || (isMonster ? '1' : '1/4'),
    ac: num(d.ac, 10),
    acNote: str(d.acNote),
    hp: num(d.hp, 10),
    hitDice: str(d.hitDice),
    speed: str(d.speed) || '9 m',
    str: num(d.str, 10),
    dex: num(d.dex, 10),
    con: num(d.con, 10),
    int: num(d.int, 10),
    wis: num(d.wis, 10),
    cha: num(d.cha, 10),
    saves: arr(d.saves).map((x) => (typeof x === 'string' ? { name: x, bonus: '' } : { name: str(x.name), bonus: str(x.bonus) })),
    skills: arr(d.skills).map((x) => (typeof x === 'string' ? { name: x, bonus: '' } : { name: str(x.name), bonus: str(x.bonus), desc: str(x.desc) })),
    vulnerabilities: str(d.vulnerabilities),
    resistances: str(d.resistances),
    immunities: str(d.immunities),
    conditionImmunities: str(d.conditionImmunities),
    senses: str(d.senses),
    languages: str(d.languages),
    traits: named(d.traits),
    spellcasting: d.spellcasting && typeof d.spellcasting === 'object' && arr(d.spellcasting.list).length ? { ...d.spellcasting, list: arr(d.spellcasting.list).map(str) } : null,
    actions,
    legendaryActions: named(d.legendaryActions),
    effects: arr(d.effects).filter((e) => e && typeof e === 'object').map((e) => ({ ...e, name: str(e.name), desc: str(e.desc), active: !!e.active, usesLeft: e.usesLeft ?? e.usesMax })),
    tactics: str(d.tactics),
    lootTable: arr(d.lootTable).filter((l) => l && typeof l === 'object').map((l) => ({ roll: str(l.roll), item: str(l.item), desc: str(l.desc), rarity: str(l.rarity) })),
    imagePrompt: str(d.imagePrompt),
  };
}

function briefLines(it) {
  return [
    `Type : ${it.mode === 'monster' ? 'CRÉATURE / MONSTRE' : 'PNJ'}`,
    it.name && `Nom : ${it.name}`,
    it.function && `Fonction / espèce : ${it.function}`,
    it.ancestry && `Origine / nature : ${it.ancestry}`,
    it.role && `Rôle : ${it.role}`,
    it.cr && `FP visé : ${it.cr}`,
    it.difficulty && `Difficulté pour le groupe : ${DIFFICULTY[it.difficulty] || it.difficulty}`,
    it.backstory && `Histoire inventée en jeu : ${it.backstory}`,
    it.notes && `Notes : ${it.notes}`,
    !it.name && !it.notes && !it.function && 'Rien d’imposé : surprends-moi avec quelque chose qui vient du lore de l’univers.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Génère une ou plusieurs fiches. `items` : [{ mode, name, notes, function, ancestry, role, cr, difficulty, backstory }].
 * Une seule requête pour 1 à 3 fiches (au-delà, appeler par lots).
 */
export async function generateEntities(call, { ctx, items, level = 3, size = 4 }) {
  const data = await call({
    system: SYSTEM,
    prompt: `${ctx}

Groupe : ${size} héros autour du niveau ${level}.

Crée ${items.length} fiche(s) :
${items.map((it, i) => `--- Fiche ${i + 1} ---\n${briefLines(it)}`).join('\n\n')}

Retourne : { "entities": [ ${SCHEMA} ] } (dans l'ordre demandé)`,
    maxTokens: 4500 * items.length,
    temperature: 0.8,
  });
  const list = Array.isArray(data?.entities) ? data.entities : data?.name ? [data] : [];
  if (!list.length) throw new Error('L’IA n’a pas renvoyé de fiche lisible. Réessaie, ou change de modèle dans Réglages.');
  return list.slice(0, items.length).map((d, i) => normalizeEntity(d, items[i]?.mode || 'monster'));
}

/* ----------------------------- SRD ----------------------------------- */

/** Retrouve une fiche SRD par son nom (français ou identifiant anglais). */
export function findSrd(name) {
  const k = norm(name);
  if (!k) return null;
  for (const s of Object.values(STATS)) {
    const n = norm(s.name);
    if (n === k || norm(s.id.replace(/-/g, ' ')) === k || n.split(' (')[0] === k) return s;
  }
  for (const s of Object.values(STATS)) {
    const base = norm(s.name.replace(/\(.*\)/, ''));
    if (base.length > 3 && (k.includes(base) || base.includes(k))) return s;
  }
  return null;
}

const ABBR = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** Fiche complète à partir d'une fiche SRD : instantané, sans IA. */
export function entityFromSrd(stat, overrides = {}) {
  const hp = num(stat.hp, 10);
  const meta = stat.meta || '';
  const sizeMatch = /taille (TP|P|M|G|TG|Gig)/.exec(meta);
  const toActions = (list, type) =>
    arr(list).map(([name, desc]) => {
      const atk = /([+−-]\d+) au toucher/.exec(desc);
      const dmg = /\((\d+d\d+)(?:\s*[+−-]\s*(\d+))?\)\s*([a-zéèêàç]+)/i.exec(desc);
      return {
        name,
        type,
        desc,
        attackBonus: atk ? num(atk[1].replace('−', '-')) : undefined,
        damageDice: dmg ? dmg[1] : '',
        damageBonus: dmg && dmg[2] ? num(dmg[2]) : 0,
        damageType: dmg ? dmg[3] : '',
        range: /portée ([\d,/ ]+m)/.exec(desc)?.[1] || (/allonge ([\d,]+ m)/.exec(desc)?.[1] ?? ''),
      };
    });
  return normalizeEntity(
    {
      name: stat.name,
      kind: meta.split(' de taille')[0],
      type: meta.split(' de taille')[0],
      size: sizeMatch?.[1] || 'M',
      alignment: meta.split(',').slice(1).join(',').trim(),
      shortDescription: `${stat.name} — fiche du SRD 5.1.`,
      cr: stat.cr.split(' ')[0],
      ac: num(stat.ac, 10),
      acNote: (/\((.*)\)/.exec(stat.ac) || [])[1] || '',
      hp,
      hitDice: (/\((.*)\)/.exec(stat.hp) || [])[1] || '',
      speed: stat.speed,
      ...Object.fromEntries(ABBR.map((k, i) => [k, stat.abil[i]])),
      saves: stat.saves ? stat.saves.split(',').map((x) => ({ name: x.trim().split(' ')[0], bonus: x.trim().split(' ').slice(1).join(' ') })) : [],
      skills: stat.skills ? stat.skills.split(',').map((x) => ({ name: x.trim().replace(/\s*[+−-]\d+$/, ''), bonus: (/[+−-]\d+$/.exec(x.trim()) || [''])[0] })) : [],
      vulnerabilities: stat.vuln || '',
      resistances: stat.resist || '',
      immunities: stat.immune || '',
      conditionImmunities: stat.condImmune || '',
      senses: stat.senses,
      languages: stat.languages,
      traits: arr(stat.traits).map(([name, desc]) => ({ name, desc })),
      actions: [...toActions(stat.actions, 'action'), ...toActions(stat.reactions, 'reaction')],
      srdId: stat.id,
      source: 'SRD 5.1 (CC BY 4.0)',
      ...overrides,
    },
    overrides.entityType === 'npc' ? 'npc' : 'monster'
  );
}
