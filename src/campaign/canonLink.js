/**
 * Lot B : rattachement au canon existant.
 * Pour chaque élément proposé par un compte rendu de séance, on cherche s'il existe déjà (même nom, nom proche,
 * ou désigné par l'IA), on propose de le fusionner, et on tisse des liens entre les fiches.
 * Tout est additif : une fusion ajoute des informations, elle ne remplace ni ne supprime rien.
 * Logique pure, sans React ni IA.
 */
import { normKey, buildEntry } from './sessionReport.js';

// Titres et mots vides ignorés pour comparer « Capitaine Orsk » et « Orsk ».
const STOP = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'au', 'aux',
  'capitaine', 'seigneur', 'dame', 'sire', 'maitre', 'roi', 'reine', 'prince', 'princesse', 'sergent', 'general', 'pere', 'mere', 'frere', 'soeur',
]);

const compact = (s) => normKey(s).replace(/ /g, '');
const sigTokens = (s) => normKey(s).split(' ').filter((t) => t.length >= 3 && !STOP.has(t));

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Ressemblance de deux noms, de 0 à 1. */
export function similarity(a, b) {
  const ka = normKey(a);
  const kb = normKey(b);
  if (!ka || !kb) return 0;
  if (ka === kb) return 1;
  const ca = compact(a);
  const cb = compact(b);
  if (ca === cb) return 0.95; // « Val-Lombre » et « Vallombre »
  const ta = sigTokens(a);
  const tb = sigTokens(b);
  if (ta.length && tb.length) {
    const [small, big] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
    if (small.every((t) => big.includes(t))) return 0.85; // « Capitaine Orsk » et « Orsk »
  }
  if (ca.length >= 5 && cb.length >= 5 && levenshtein(ca, cb) <= 1) return 0.75; // faute de frappe
  return 0;
}

const compatible = (a, b) => a === b || a === 'document' || b === 'document';

/**
 * Fiches existantes qui pourraient désigner la même chose. L'indication `sameAs` de l'IA
 * (titre exact d'une fiche connue) pèse 0,9 : c'est ce qui permet de relier « le capitaine » à « Orsk ».
 */
export function findCandidates(entity, existing, limit = 3) {
  const aiKey = normKey(entity.sameAs);
  const out = [];
  for (const e of existing || []) {
    let score = 0;
    if (aiKey && normKey(e.title) === aiKey) score = 0.9;
    const sim = similarity(entity.name, e.title);
    if (sim >= 0.95 || (sim > 0 && compatible(entity.kind, e.archiveType))) score = Math.max(score, sim);
    if (score >= 0.7) out.push({ id: e.id, title: e.title, archiveType: e.archiveType, score });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, limit);
}

/** Ajoute à chaque élément ses candidats et une décision par défaut : fusionner seulement si on est quasi sûr. */
export function matchEntities(entities, existing) {
  return entities.map((e) => {
    const candidates = findCandidates(e, existing);
    const top = candidates[0];
    return { ...e, candidates, decision: top && top.score >= 0.9 ? `merge:${top.id}` : 'new' };
  });
}

const union = (a = [], b = []) => [...new Set([...(a || []), ...(b || [])])];

/** Patch de fusion : ajoute la séance aux notes de la fiche existante, sans rien remplacer. */
export function buildMerge(entity, existing, { campaignId, sessionId, sessionNumber, now }) {
  const label = sessionNumber ? `Séance ${sessionNumber}` : 'Séance';
  const block = `[${label}] ${entity.summary}`.trim();
  const rough = String(existing.roughNotes || '');
  const patch = { updatedAt: now };
  if (entity.summary && !rough.includes(block)) patch.roughNotes = rough ? `${rough}\n\n${block}` : block;
  const secret = String(entity.secret || '').trim();
  const secrets = String(existing.secrets || '');
  if (secret && !secrets.includes(secret)) patch.secrets = secrets ? `${secrets}\n\n[${label}] ${secret}` : `[${label}] ${secret}`;
  const tags = union(existing.tags, entity.tags);
  if (tags.length !== (existing.tags || []).length) patch.tags = tags;
  if (campaignId) patch.linkedCampaignIds = union(existing.linkedCampaignIds, [campaignId]);
  patch.sessionRefs = [...(existing.sessionRefs || []), { campaignId: campaignId || null, sessionId: sessionId || null }];
  return patch;
}

/**
 * Relations entre éléments, résolues sur les noms : un nom peut désigner un élément de ce compte rendu
 * (nouveau ou fusionné) ou une fiche déjà connue. Les cibles introuvables sont ignorées.
 */
export function resolveEdges(items, existing) {
  const known = (existing || []).map((e) => ({ id: e.id, name: e.title }));
  const local = items.filter((i) => i.targetId).map((i) => ({ id: i.targetId, name: i.entity.name }));
  const pool = [...local, ...known];
  const find = (name) => {
    let best = null;
    for (const p of pool) {
      const s = similarity(name, p.name);
      if (s >= 0.85 && (!best || s > best.s)) best = { id: p.id, s };
    }
    return best?.id || null;
  };
  const seen = new Set();
  const edges = [];
  for (const it of items) {
    if (!it.targetId) continue;
    for (const r of it.entity.relations || []) {
      const to = find(r.target);
      const label = String(r.label || '').trim() || 'lié à';
      const key = `${it.targetId}>${to}>${normKey(label)}`;
      if (!to || to === it.targetId || seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: it.targetId, to, label });
    }
  }
  return edges;
}

/** Entrées `related` (format de « Dans la Toile ») à ajouter à chaque fiche, liens directs et inverses. */
export function relatedPatches(edges, nameOf) {
  const out = {};
  const push = (id, item) => {
    out[id] = out[id] || [];
    out[id].push(item);
  };
  for (const e of edges) {
    push(e.from, { id: e.to, name: nameOf(e.to), kind: e.label });
    push(e.to, { id: e.from, name: nameOf(e.from), kind: `← ${e.label}` });
  }
  return out;
}

const mergeRelated = (current = [], added = []) => {
  const key = (r) => `${r.id}|${r.kind}`;
  const have = new Set((current || []).map(key));
  return [...(current || []), ...added.filter((r) => !have.has(key(r)))];
};

/**
 * Plan complet des changements à appliquer pour un compte rendu :
 * nouvelles fiches, patchs sur les fiches existantes (fusions et liens), et bilan pour le rapport.
 * `entities` porte chacune une `decision` : 'new', 'skip' ou 'merge:<id>'.
 */
export function planChanges({ entities, existing, ctx, newId }) {
  const byId = new Map((existing || []).map((e) => [e.id, e]));
  const items = entities.map((entity) => {
    const d = entity.decision || 'new';
    if (d === 'skip') return { entity, kind: 'skip', targetId: null };
    if (d.startsWith('merge:') && byId.has(d.slice(6))) return { entity, kind: 'merge', targetId: d.slice(6) };
    return { entity, kind: 'new', targetId: newId() };
  });

  const edges = resolveEdges(items, existing);
  const names = new Map(items.filter((i) => i.targetId).map((i) => [i.targetId, i.kind === 'merge' ? byId.get(i.targetId).title : i.entity.name]));
  for (const e of existing || []) if (!names.has(e.id)) names.set(e.id, e.title);
  const related = relatedPatches(edges, (id) => names.get(id) || '');

  const newEntries = [];
  const patches = {};
  for (const it of items) {
    if (it.kind === 'new') {
      newEntries.push({
        ...buildEntry(it.entity, { ...ctx, id: it.targetId }),
        related: mergeRelated([], related[it.targetId] || []),
      });
    } else if (it.kind === 'merge') {
      patches[it.targetId] = buildMerge(it.entity, byId.get(it.targetId), ctx);
    }
  }
  for (const [id, added] of Object.entries(related)) {
    if (newEntries.some((e) => e.id === id)) continue;
    const base = byId.get(id);
    if (!base) continue;
    patches[id] = { updatedAt: ctx.now, ...patches[id], related: mergeRelated(base.related, added) };
  }

  return {
    newEntries,
    patches,
    mergedIds: items.filter((i) => i.kind === 'merge').map((i) => i.targetId),
    conflicts: items.filter((i) => i.kind !== 'skip' && i.entity.conflict).map((i) => ({ name: i.entity.name, issue: i.entity.conflict })),
    edges,
  };
}
