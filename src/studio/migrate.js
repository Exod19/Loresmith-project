/**
 * Migration des campagnes vers le format Campaign Studio V3 (schemaVersion 3).
 *
 * Pure et idempotente : appelée au chargement du grimoire, à l'import d'une sauvegarde et à la création
 * d'une campagne. Elle n'efface rien et n'invente rien : elle ajoute des identifiants stables aux actes et
 * aux séances, rattache les scènes, et crée les réglages de fondation avec des valeurs inconnues (null).
 * Aucune scène n'est jamais marquée comme validée par la migration.
 */
export const SCHEMA_VERSION = 3;

const key = (s) => String(s || '').trim().toLowerCase();

export function migrateCampaign(c) {
  if (!c || typeof c !== 'object') return c;
  if (c.schemaVersion >= SCHEMA_VERSION && c.foundations) return c;

  const acts = (c.acts || []).map((a, i) => ({ ...a, id: a.id || `act-${i + 1}` }));
  let scenes = (c.scenes || []).map((sc) => ({ ...sc }));
  let sessions = (c.sessions || []).map((s, i) => {
    const n = Number(s.sessionNumber) || i + 1;
    return { ...s, sessionNumber: n, id: s.id || `ses-${n}` };
  });

  // Anciennes campagnes : pas de séances. Une séance 1 regroupe leurs scènes, sans rien perdre.
  if (!sessions.length && scenes.length) {
    sessions = [{ id: 'ses-1', sessionNumber: 1, title: c.title || 'Séance 1', summary: c.premise || '', detailed: scenes.some((sc) => sc.expanded) }];
    scenes = scenes.map((sc) => ({ ...sc, sessionNumber: sc.sessionNumber ?? 1 }));
  }

  const actByTitle = new Map(acts.map((a) => [key(a.title), a.id]));
  sessions = sessions.map((s) => ({ ...s, actId: s.actId || actByTitle.get(key(s.act)) || '' }));
  const actOfSession = new Map(sessions.map((s) => [s.sessionNumber, s.actId]));
  scenes = scenes.map((sc) => ({
    ...sc,
    actId: sc.actId || actOfSession.get(sc.sessionNumber) || '',
    importance: sc.importance || 'essential',
  }));

  const hours = Number(c.hours || c.brief?.hours) || 3;
  return {
    ...c,
    schemaVersion: SCHEMA_VERSION,
    acts,
    sessions,
    scenes,
    brief: c.brief || { title: c.title || '', theme: c.theme || '', format: c.campaignMode || 'short', sessions: sessions.length || 1, hours, level: c.level || null },
    foundations: {
      edition: '2014',
      partyIds: [],
      partyCount: null,
      partyLevel: Number(c.level || c.brief?.level) || null,
      targetMinutes: hours * 60,
      skipped: [],
      proposed: [],
      ...(c.foundations || {}),
    },
  };
}

/** Applique la migration à toutes les campagnes d'un état complet (chargement, import). */
export function migrateState(state) {
  if (!state?.campaigns) return state;
  const campaigns = {};
  for (const [id, c] of Object.entries(state.campaigns)) campaigns[id] = migrateCampaign(c);
  return { ...state, campaigns };
}
