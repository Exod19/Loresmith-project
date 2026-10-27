/**
 * Contexte de lore pour l'IA : tout ce que l'univers sait déjà, trié par pertinence et tenu dans un budget.
 *
 * Sources, de la plus sûre à la plus large :
 *  - le canon et le ton de l'univers, ses sections structurées et sa mémoire vivante ;
 *  - la bibliothèque (fiches écrites ou importées) ;
 *  - les Archives de l'Underdark (fiches publiques), quand l'univers y est lié ;
 *  - les lieux nommés de l'Atlas, pour que les scènes se passent à des endroits qu'on retrouve sur la carte ;
 *  - les PNJ et créatures déjà créés, pour les réutiliser plutôt que d'en inventer d'autres.
 */
import { loadUnderdarkFeed } from '../feeds/underdark';

export const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const STOP = new Set(
  'le la les un une des de du d l et ou en au aux a dans sur pour par avec sans qui que quoi est sont son sa ses leur leurs ce cet cette ces il elle ils elles on nous vous the of and'.split(' ')
);
export const words = (s) => norm(s).split(' ').filter((w) => w.length > 2 && !STOP.has(w));

const clip = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

/** Score de pertinence d'un texte par rapport aux mots de la demande. */
function score(text, focus) {
  if (!focus.size) return 0;
  let n = 0;
  for (const w of new Set(words(text))) if (focus.has(w)) n++;
  return n;
}

/** Charge les Archives si l'univers y est lié (sinon null, sans erreur). */
export async function feedFor(universe) {
  if (universe?.archives !== 'underdark') return null;
  try {
    return await loadUnderdarkFeed();
  } catch {
    return null;
  }
}

/** Lieux nommés de l'Atlas (repères majeurs et régionaux), par plan, sans doublons ni noms génériques. */
export function atlasPlaces(feed, limit = 140) {
  const atlas = feed?.atlas;
  if (!atlas?.features) return [];
  const planOf = new Map();
  for (const g of atlas.geometries || []) if (!planOf.has(g.featureId)) planOf.set(g.featureId, g.mapId);
  const planTitle = new Map((atlas.maps || []).map((m) => [m.id, m.title]));
  const seen = new Set();
  const out = [];
  for (const f of atlas.features) {
    if (f.importance !== 'landmark' && f.importance !== 'regional') continue;
    if (f.trace) continue;
    if (/^(galerie|couloir|passage|tunnel|boyau)\b/i.test(f.title)) continue;
    const k = norm(f.title);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({ id: f.id, title: f.title, category: f.category, plan: planTitle.get(planOf.get(f.id)) || '', summary: f.summary || f.subtitle || '' });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Construit le bloc de contexte. `focus` : texte de la demande (thème, notes) qui oriente le tri.
 * `budget` : nombre de caractères visé, pour ne pas noyer le modèle.
 */
export function buildLoreContext({ universe, state, feed, focus = '', budget = 14000, party = [], noNamedPersons = false }) {
  const f = new Set(words(focus));
  const parts = [];

  parts.push(`UNIVERS : ${universe.name}\nTon : ${universe.tone || '—'}`);
  if (universe.lore) parts.push(`CANON DE L'UNIVERS :\n${clip(universe.lore, 3500)}`);

  const sections = universe.loreSuggestions?.structuredSections || [];
  if (sections.length) {
    parts.push(
      'SECTIONS DU SAVOIR :\n' +
        sections
          .slice(0, 12)
          .map((s) => `- ${s.title || s.name || 'Section'} : ${clip(s.body || s.content || s.summary, 300)}`)
          .join('\n')
    );
  }

  const memory = universe.memoryLog || [];
  if (memory.length) {
    parts.push('MÉMOIRE VIVANTE (ce qui s’est passé en jeu) :\n' + memory.slice(0, 14).map((m) => `- ${m.title} : ${clip(m.summary, 220)}`).join('\n'));
  }

  if (party.length) {
    parts.push(
      'GROUPE :\n' +
        party.map((c) => `- ${c.name} (niv. ${c.level || '?'} ${c.race || ''} ${c.cls || ''}${c.background ? ', ' + c.background : ''})${c.backstory ? ' — ' + clip(c.backstory, 160) : ''}`).join('\n')
    );
  }

  // Bibliothèque : les fiches les plus pertinentes en entier (résumé), les autres en simple nom.
  const lib = Object.values(state?.libraryEntries || {})
    .filter((e) => e.universeId === universe.id)
    .filter((e) => !(noNamedPersons && e.archiveType === 'person'));
  if (lib.length) {
    const ranked = lib
      .map((e) => ({ e, s: score(`${e.title} ${e.shortSummary} ${(e.tags || []).join(' ')} ${e.body?.slice(0, 600)}`, f) }))
      .sort((a, b) => b.s - a.s);
    const top = ranked.slice(0, 28);
    const rest = ranked.slice(28, 140);
    parts.push(
      'BIBLIOTHÈQUE DE L’UNIVERS (noms exacts à réutiliser) :\n' +
        top.map(({ e }) => `- [${e.archiveType}] ${e.title} : ${clip(e.shortSummary || e.body, 260)}`).join('\n') +
        (rest.length ? `\nAutres fiches : ${rest.map(({ e }) => e.title).join(' · ')}` : '')
    );
  }

  // Archives : uniquement les fiches pas encore copiées dans la bibliothèque.
  if (feed?.entries?.length) {
    const inLib = new Set(lib.map((e) => e.sourceId).filter(Boolean));
    const usable = feed.entries.filter((e) => !inLib.has(e.id) && e.type !== 'source' && !(noNamedPersons && ['personnage', 'divinite'].includes(e.type)));
    const ranked = usable
      .map((e) => ({ e, s: score(`${e.name} ${e.summary} ${(e.tags || []).join(' ')}`, f) + (['creature', 'peuple', 'faction', 'lieu', 'personnage', 'divinite'].includes(e.type) ? 0.5 : 0) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 40);
    if (ranked.length) {
      parts.push('ARCHIVES DE L’UNDERDARK (canon publié) :\n' + ranked.map(({ e }) => `- [${e.type}] ${e.name} : ${clip(e.summary, 220)}`).join('\n'));
    }
    const places = atlasPlaces(feed);
    if (places.length) {
      parts.push(
        'LIEUX DE L’ATLAS (présents sur la carte : utilise ces noms exacts pour les lieux de scène quand c’est cohérent) :\n' +
          places.map((p) => `${p.title}${p.plan ? ` (${p.plan})` : ''}`).join(' · ')
      );
    }
  }

  const npcs = Object.values(state?.npcs || {}).filter((n) => n.universeId === universe.id);
  if (npcs.length) {
    parts.push(
      'PNJ ET CRÉATURES DÉJÀ CRÉÉS (à réutiliser par leur nom) :\n' +
        npcs.slice(0, 40).map((n) => `- ${n.name} (${n.isMonster || n.entityType === 'monster' ? 'créature' : 'PNJ'}${n.cr ? `, FP ${n.cr}` : ''}) : ${clip(n.shortDescription || n.role || n.kind, 120)}`).join('\n')
    );
  }

  // Tenir le budget : on coupe d'abord les blocs les plus larges (en fin de liste).
  let text = parts.join('\n\n');
  if (text.length > budget) text = text.slice(0, budget) + '\n…';
  return text;
}

/** Règle commune donnée à l'IA pour qu'elle puise dans le contexte avant d'inventer. */
export const LORE_RULES = `RÈGLES DE COHÉRENCE :
- Puise d'abord dans le contexte fourni (canon, bibliothèque, Archives, lieux de l'Atlas, PNJ existants). Réutilise leurs noms EXACTS.
- N'invente que pour combler un vide, et dans le ton de l'univers. Ne contredis jamais le canon.
- Quand une scène se passe dans un lieu de l'Atlas, écris son nom exact dans le champ "location".`;
