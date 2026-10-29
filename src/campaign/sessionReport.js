/**
 * Lot A : compte rendu de séance.
 * Logique pure (sans React ni IA directe) : prompt, lecture de la réponse, détection des doublons,
 * fabrication des fiches. Les fiches créées gardent un lien vers la campagne et la séance d'où elles viennent.
 */

/** Types proposés : correspondent aux `archiveType` de la bibliothèque. */
export const ENTITY_KINDS = {
  person: 'Personnage',
  place: 'Lieu',
  faction: 'Peuple ou groupe',
  event: 'Événement',
  artifact: 'Objet',
  mystery: 'Mystère',
};

const clean = (s) => String(s ?? '').trim();

/** Nom comparable : minuscules, sans accents ni ponctuation. */
export function normKey(s) {
  return clean(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Prompt d'analyse des notes de séance. */
export function reportPrompt({ universe, campaign, session, notes, knownTitles = [] }) {
  return {
    system: `Tu es l'archiviste d'un maître de jeu. À partir de notes de séance, tu extrais ce qui s'est réellement passé et les éléments d'univers nouveaux qui méritent une fiche.
N'invente rien : n'utilise que les notes. Si une information est incertaine, laisse-la de côté.
Langue : français. Réponds uniquement en JSON valide.`,
    prompt: `Univers : ${clean(universe?.name)}
Ton : ${clean(universe?.tone)}
Canon (extrait) : ${clean(universe?.lore).slice(0, 1500)}
Campagne : ${clean(campaign?.title)}
Séance : ${session ? `${session.sessionNumber} · ${clean(session.title)}` : 'hors séance planifiée'}

Éléments déjà connus (ne les redonne pas comme nouveaux) : ${knownTitles.slice(0, 120).join(', ') || 'aucun'}

Notes de séance :
${clean(notes)}

Retourne exactement :
{
  "summary": "compte rendu de la séance en 3 à 6 phrases",
  "consequences": ["ce qui a changé dans le monde à cause des actions des joueurs"],
  "entities": [
    {
      "kind": "person|place|faction|event|artifact|mystery",
      "name": "nom",
      "summary": "ce que l'on sait, en 1 à 3 phrases, d'après les notes",
      "secret": "ce que seul le MJ sait, vide si rien",
      "tags": ["mot-clé"]
    }
  ]
}`,
  };
}

/** Lit la réponse de l'IA sans jamais planter sur un JSON douteux. */
export function parseReport(data) {
  const entities = (Array.isArray(data?.entities) ? data.entities : [])
    .map((e) => ({
      kind: ENTITY_KINDS[e?.kind] ? e.kind : 'person',
      name: clean(e?.name),
      summary: clean(e?.summary),
      secret: clean(e?.secret),
      tags: Array.isArray(e?.tags) ? e.tags.map(clean).filter(Boolean).slice(0, 6) : [],
    }))
    .filter((e) => e.name);
  const seen = new Set();
  const unique = entities.filter((e) => {
    const k = `${e.kind}:${normKey(e.name)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return {
    summary: clean(data?.summary),
    consequences: (Array.isArray(data?.consequences) ? data.consequences : []).map(clean).filter(Boolean).slice(0, 12),
    entities: unique.slice(0, 40),
  };
}

/** Marque les entités dont le nom existe déjà dans la bibliothèque de l'univers (rattachement fin : lot B). */
export function markDuplicates(entities, existingEntries) {
  const byName = new Map();
  for (const e of existingEntries || []) byName.set(normKey(e.title), e);
  return entities.map((e) => {
    const hit = byName.get(normKey(e.name));
    return hit ? { ...e, duplicateOf: hit.id, duplicateTitle: hit.title } : e;
  });
}

/** Fiche de bibliothèque d'une entité acceptée. */
export function buildEntry(entity, { campaignId, sessionId, reportId, id, now }) {
  return {
    id,
    archiveType: entity.kind,
    title: entity.name,
    subtitle: '',
    shortSummary: entity.summary,
    body: entity.summary,
    secrets: entity.secret,
    tags: entity.tags,
    linkedCampaignIds: campaignId ? [campaignId] : [],
    source: { kind: 'session-report', campaignId: campaignId || null, sessionId: sessionId || null, reportId },
    createdAt: now,
    updatedAt: now,
  };
}

/** Enregistrement du compte rendu, rangé dans la campagne (`sessionReports`). */
export function buildReport({ id, now, session, notes, summary, consequences, entryIds }) {
  return {
    id,
    createdAt: now,
    sessionId: session?.id || null,
    sessionNumber: session?.sessionNumber ?? null,
    sessionTitle: clean(session?.title),
    notes: clean(notes),
    summary: clean(summary),
    consequences: consequences || [],
    entryIds: entryIds || [],
  };
}

/** Marque une séance comme jouée (ou non). Ne touche à aucune autre séance. */
export function markPlayed(sessions, sessionId, played, now) {
  return (sessions || []).map((s) =>
    s.id === sessionId ? { ...s, played: !!played, playedAt: played ? now : null } : s,
  );
}
