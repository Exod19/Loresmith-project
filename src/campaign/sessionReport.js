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
/** Lignes « titre (type) : résumé » des fiches connues ; celles citées dans les notes passent en premier. */
export function knownLines(entries, notes, limit = 60) {
  const text = normKey(notes);
  const mentioned = (e) => (normKey(e.title) && text.includes(normKey(e.title)) ? 0 : 1);
  return [...(entries || [])]
    .sort((a, b) => mentioned(a) - mentioned(b))
    .slice(0, limit)
    .map((e) => `- ${e.title} (${e.archiveType || 'fiche'})${e.shortSummary ? ` : ${clean(e.shortSummary).slice(0, 140)}` : ''}`);
}

export function reportPrompt({ universe, campaign, session, notes, known = [] }) {
  return {
    system: `Tu es l'archiviste d'un maître de jeu. À partir de notes de séance, tu extrais ce qui s'est réellement passé et les éléments d'univers nouveaux qui méritent une fiche.
N'invente rien : n'utilise que les notes. Rattache chaque élément au canon : s'il désigne un élément déjà connu (même sous un autre nom ou titre), renseigne sameAs ; relie-le aux éléments connus avec relations ; signale toute contradiction avec conflict. Si une information est incertaine, laisse-la de côté.
Langue : français. Réponds uniquement en JSON valide.`,
    prompt: `Univers : ${clean(universe?.name)}
Ton : ${clean(universe?.tone)}
Canon (extrait) : ${clean(universe?.lore).slice(0, 1500)}
Campagne : ${clean(campaign?.title)}
Séance : ${session ? `${session.sessionNumber} · ${clean(session.title)}` : 'hors séance planifiée'}

Éléments déjà connus de l'univers :
${known.join('\n') || 'aucun'}

Notes de séance :
${clean(notes)}

Retourne exactement :
{
  "summary": "compte rendu de la séance en 3 à 6 phrases",
  "consequences": ["ce qui a changé dans le monde à cause des actions des joueurs"],
  "futureSeeds": ["pistes ou menaces ouvertes que de futures aventures pourraient reprendre"],
  "entities": [
    {
      "kind": "person|place|faction|event|artifact|mystery",
      "name": "nom",
      "summary": "ce que l'on sait, en 1 à 3 phrases, d'après les notes",
      "secret": "ce que seul le MJ sait, vide si rien",
      "tags": ["mot-clé"],
      "sameAs": "titre EXACT d'un élément déjà connu si c'est le même, sinon vide",
      "relations": [{"target": "nom exact d'un élément connu ou de cette liste", "label": "lien court : habite, dirige, membre de, allié de, ennemi de, situé dans, possède…"}],
      "conflict": "ce qui contredit le canon ou les fiches connues, sinon vide"
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
      sameAs: clean(e?.sameAs),
      conflict: clean(e?.conflict),
      relations: (Array.isArray(e?.relations) ? e.relations : [])
        .map((r) => ({ target: clean(r?.target), label: clean(r?.label) }))
        .filter((r) => r.target)
        .slice(0, 6),
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
    futureSeeds: (Array.isArray(data?.futureSeeds) ? data.futureSeeds : []).map(clean).filter(Boolean).slice(0, 8),
    entities: unique.slice(0, 40),
  };
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
export function buildReport({ id, now, session, notes, summary, consequences, futureSeeds, entryIds, mergedIds, conflicts }) {
  return {
    id,
    createdAt: now,
    sessionId: session?.id || null,
    sessionNumber: session?.sessionNumber ?? null,
    sessionTitle: clean(session?.title),
    notes: clean(notes),
    summary: clean(summary),
    consequences: consequences || [],
    futureSeeds: futureSeeds || [],
    entryIds: entryIds || [],
    mergedIds: mergedIds || [],
    conflicts: conflicts || [],
  };
}

/** Marque une séance comme jouée (ou non). Ne touche à aucune autre séance. */
export function markPlayed(sessions, sessionId, played, now) {
  return (sessions || []).map((s) =>
    s.id === sessionId ? { ...s, played: !!played, playedAt: played ? now : null } : s,
  );
}

/**
 * Entrée de mémoire vivante (univers ou campagne) tirée d'un compte rendu.
 * Le résumé contient les conséquences : toutes les consignes d'IA qui relisent la mémoire (`titre : résumé`) les voient donc.
 */
export function buildMemory(report, { id, campaignId }) {
  const label = report.sessionNumber ? `Séance ${report.sessionNumber}${report.sessionTitle ? ` · ${report.sessionTitle}` : ''}` : 'Séance hors plan';
  const consequences = report.consequences || [];
  const summary = [clean(report.summary), consequences.length ? `Conséquences : ${consequences.map((c) => c.replace(/[.\s]+$/, '')).join(' ; ')}.` : ''].filter(Boolean).join(' ');
  return {
    id,
    createdAt: report.createdAt,
    title: label,
    summary,
    consequences,
    futureSeeds: report.futureSeeds || [],
    source: { kind: 'session-report', campaignId: campaignId || null, sessionId: report.sessionId, reportId: report.id },
  };
}

/** Prompt « idées pour la prochaine séance », fondé sur ce qui s'est passé et sur les graines laissées. */
export function nextSessionPrompt({ universe, campaign, reports, next, known = [] }) {
  const recent = (reports || []).slice(0, 4).reverse();
  return {
    system:
      "Tu es le conseiller de préparation d'un maître de jeu. Tu proposes des pistes concrètes pour la prochaine séance, qui tiennent compte de ce qui a été joué et des conséquences. N'invente pas de faits contraires au canon. Langue : français. Réponds uniquement en JSON valide.",
    prompt: `Univers : ${clean(universe?.name)} — ${clean(universe?.tone)}
Canon (extrait) : ${clean(universe?.lore).slice(0, 1200)}
Campagne : ${clean(campaign?.title)} — ${clean(campaign?.premise)}
Prochaine séance : ${next ? `${next.sessionNumber} · ${clean(next.title)} — ${clean(next.summary)}` : 'non planifiée'}

Ce qui s'est joué (du plus ancien au plus récent) :
${recent.map((r) => `- ${r.sessionNumber ? `S${r.sessionNumber}` : 'Hors plan'} : ${r.summary} | Conséquences : ${(r.consequences || []).join(' ; ') || 'aucune'} | Pistes : ${(r.futureSeeds || []).join(' ; ') || 'aucune'}`).join('\n') || 'rien encore'}

Éléments connus de l'univers :
${known.join('\n') || 'aucun'}

Retourne exactement : {"ideas":[{"title":"titre court","pitch":"2 à 3 phrases","uses":["noms d'éléments connus réutilisés"]}]}
Propose 4 idées, dont au moins une qui réutilise un personnage ou un lieu déjà connu.`,
  };
}

export function parseIdeas(data) {
  return (Array.isArray(data?.ideas) ? data.ideas : [])
    .map((i) => ({
      title: clean(i?.title),
      pitch: clean(i?.pitch),
      uses: (Array.isArray(i?.uses) ? i.uses : []).map(clean).filter(Boolean).slice(0, 6),
    }))
    .filter((i) => i.title)
    .slice(0, 6);
}
