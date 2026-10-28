/**
 * Préparation d'une campagne, calculée à partir des données réelles (jamais d'une simple case cochée).
 *
 * Chaque scène passe une série de contrôles selon son contenu (texte à lire, objectif, sortie, plan B,
 * PNJ utilisables, rencontres complètes). Elle n'est « prête » que si tous ses contrôles passent ET que le MJ
 * l'a validée dans l'état où elle est : toute modification ultérieure, ou un changement du groupe pour une scène
 * de combat, la remet « à revoir ». La progression jouée (guide de la carte) est un autre état, non mélangé ici.
 */
import { norm } from '../ai/loreContext';
import { findSrd } from '../bestiary/entityGen';

/** Durée typique d'une scène, en minutes, quand le MJ ne l'a pas précisée. */
const TYPE_MINUTES = { social: 40, exploration: 45, combat: 50, puzzle: 35, climax: 60 };
export const sceneMinutes = (sc) => Number(sc.timeEstimate?.likely) || TYPE_MINUTES[sc.type] || 45;

/** Libellés des états de conception d'une scène. */
export const SCENE_STATE = {
  idea: { label: 'Idée', tone: 'faint' },
  planned: { label: 'Planifiée', tone: 'faint' },
  incomplete: { label: 'À compléter', tone: 'ember' },
  tovalidate: { label: 'À valider', tone: 'gold' },
  review: { label: 'À revoir', tone: 'blood' },
  ready: { label: 'Prête', tone: 'verdant' },
};

const filled = (v) => (Array.isArray(v) ? v.some((x) => (typeof x === 'string' ? x.trim() : x)) : typeof v === 'string' ? !!v.trim() : !!v);

/** Empreinte du contenu d'une scène : si elle change, la validation du MJ n'est plus valable. */
export function sceneHash(sc) {
  const s = JSON.stringify([sc.title, sc.summary, sc.type, sc.location, sc.importance, sc.timeEstimate || null, sc.expanded || null]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Groupe et édition retenus pour la campagne (fondations, sinon le groupe de l'univers). */
export function partyOf(camp, party = []) {
  const f = camp.foundations || {};
  const chosen = f.partyIds?.length ? party.filter((p) => f.partyIds.includes(p.id)) : party;
  const levels = chosen.map((p) => Number(p.level)).filter(Boolean);
  const avg = levels.length ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : null;
  return {
    edition: f.edition || null,
    count: Number(f.partyCount) || chosen.length || null,
    level: Number(f.partyLevel) || avg || null,
  };
}
export const partySignature = (p) => `${p.edition || '?'}|${p.count || '?'}|${p.level || '?'}`;

/**
 * Contrôles d'une scène. Chacun : { id, label, ok, critical, reason }.
 * `last` : dernière scène de la campagne (l'épilogue n'a pas besoin de sortie).
 */
export function sceneChecks(sc, { last = false, party } = {}) {
  const x = sc.expanded;
  if (!x) return [{ id: 'written', label: 'Scène écrite', ok: false, critical: true, reason: 'La scène n’est encore qu’une ligne du plan.' }];
  const checks = [];
  const add = (id, label, ok, reason, critical = true) => checks.push({ id, label, ok: !!ok, critical, reason: ok ? '' : reason });

  add('readAloud', 'Texte à lire ou à paraphraser', filled(x.readAloud), 'Il manque la description à donner aux joueurs.');
  add('objective', 'Objectif dramatique', filled(x.purpose) || filled(sc.summary), 'Pourquoi cette scène existe-t-elle ?');
  add('exit', 'Sortie vers la suite', last || filled(x.guidance) || filled(x.nextLocation) || filled(x.branches), 'Aucune sortie : comment le groupe passe-t-il à la suite ?');
  add('fallback', 'Plan B', filled(x.fallback) || (x.branches || []).length >= 2, 'Que se passe-t-il si les héros ignorent la piste ou échouent ?');

  const npcs = x.npcs || [];
  if (npcs.length) {
    const vague = npcs.filter((n) => !filled(n.motivation) && !filled(n.note));
    add('npcs', 'PNJ utilisables', !vague.length, `Motivation ou rôle manquant : ${vague.map((n) => n.name || 'PNJ sans nom').join(', ')}.`);
  }

  const encounters = x.encounters || [];
  const combat = sc.type === 'combat' || encounters.length > 0;
  if (combat) {
    const incomplete = encounters.filter((e) => !(e.creatures || []).some((c) => filled(c.name)) || !filled(e.tactics));
    add('encounter', 'Rencontre complète', encounters.length && !incomplete.length, encounters.length ? `Créatures ou tactique manquantes : ${incomplete.map((e) => e.name || 'rencontre').join(', ')}.` : 'Scène de combat sans rencontre décrite.');
    add('party', 'Groupe et édition connus', party?.edition && party?.count && party?.level, 'Le niveau, la taille du groupe ou l’édition ne sont pas définis (Fondations › Les joueurs).');
  }

  const dcs = [...(x.skillChecks || []), ...(x.envChecks || [])];
  if (dcs.length) {
    const noDc = dcs.filter((c) => !(Number(c.dc) > 0));
    add('dc', 'Tests avec DD', !noDc.length, `${noDc.length} test(s) sans DD.`, false);
  }
  if (sc.type === 'puzzle' && !filled(x.clues) && !dcs.length) add('clues', 'Indices ou tests', false, 'Une énigme sans indice ni test risque de bloquer la table.', false);

  // Validation du MJ : elle porte sur le contenu actuel, et sur le groupe actuel si la scène a un combat.
  const review = sc.prepReview;
  const stale = review && review.hash !== sceneHash(sc);
  const partyChanged = review && combat && party && review.partySig !== partySignature(party);
  checks.push({
    id: 'verified',
    label: 'Validée par le MJ',
    ok: !!review && !stale && !partyChanged,
    critical: true,
    reason: !review ? 'Relis la scène et confirme-la.' : stale ? 'Modifiée depuis ta validation : à relire.' : partyChanged ? 'Groupe ou édition modifiés : rencontre à revérifier.' : '',
    stale: !!(stale || partyChanged),
  });
  return checks;
}

export function sceneState(sc, checks) {
  if (!sc.expanded) return filled(sc.summary) || filled(sc.location) ? 'planned' : 'idea';
  const content = checks.filter((c) => c.id !== 'verified' && c.critical);
  const verified = checks.find((c) => c.id === 'verified');
  if (verified?.stale) return 'review';
  if (content.some((c) => !c.ok)) return 'incomplete';
  return verified?.ok ? 'ready' : 'tovalidate';
}

/** Ordre de priorité des manques : ce qui bloque le plus la table d'abord. */
const PRIORITY = ['party', 'written', 'exit', 'encounter', 'fallback', 'readAloud', 'objective', 'npcs', 'verified', 'dc', 'clues'];

/**
 * Préparation complète d'une campagne : par scène, par séance, et pour la campagne entière.
 * `party` : personnages de l'univers.
 */
export function campaignPrep(camp, { party = [] } = {}) {
  const p = partyOf(camp, party);
  const scenesList = camp.scenes || [];
  const sessions = [...(camp.sessions || [])].sort((a, b) => a.sessionNumber - b.sessionNumber);
  const lastId = scenesList[scenesList.length - 1]?.id;

  const scenes = scenesList.map((sc, i) => {
    const checks = sceneChecks(sc, { last: sc.id === lastId, party: p });
    return { scene: sc, index: i, checks, state: sceneState(sc, checks), minutes: sceneMinutes(sc) };
  });

  const campaignChecks = [];
  const addC = (id, label, ok, reason, critical = true) => campaignChecks.push({ id, label, ok: !!ok, critical, reason: ok ? '' : reason });
  addC('party', 'Groupe et édition définis', p.edition && p.count && p.level, 'Précise le nombre de joueurs, leur niveau et l’édition (Fondations › Les joueurs).');
  addC('scenes', 'Au moins une scène', scenesList.length > 0, 'La campagne n’a encore aucune scène.');
  const unwritten = sessions.filter((s) => !s.detailed && scenesList.some((sc) => sc.sessionNumber === s.sessionNumber && !sc.expanded));
  addC('sessions', 'Toutes les séances écrites', !unwritten.length, `Séance(s) à écrire : ${unwritten.map((s) => s.sessionNumber).join(', ')}.`);
  const last = scenes[scenes.length - 1];
  addC('ending', 'Dénouement écrit', last && last.scene.expanded, 'La dernière scène (dénouement) n’est pas encore écrite.');

  const target = Number(camp.foundations?.targetMinutes) || (Number(camp.hours) || 3) * 60;
  const sessionPlan = sessions.map((s) => {
    const own = scenes.filter((x) => x.scene.sessionNumber === s.sessionNumber);
    const minutes = own.reduce((a, x) => a + x.minutes, 0);
    const margin = target - minutes;
    return {
      session: s,
      scenes: own,
      minutes,
      target,
      ready: own.filter((x) => x.state === 'ready').length,
      warn: !own.length ? 'Aucune scène.' : margin < 15 ? 'Trop chargée : prévois une marge d’au moins 20 min.' : minutes < target * 0.5 ? 'Peu de matière pour la durée prévue.' : '',
    };
  });

  const items = [
    ...campaignChecks.filter((c) => !c.ok).map((c) => ({ ...c, scope: 'campaign' })),
    ...scenes.flatMap((x) => x.checks.filter((c) => !c.ok).map((c) => ({ ...c, scope: 'scene', sceneId: x.scene.id, sceneTitle: x.scene.title, sceneIndex: x.index, sessionNumber: x.scene.sessionNumber }))),
  ];
  const rank = (c) => (c.critical ? 0 : 100) + PRIORITY.indexOf(c.id) * 2 + (c.scope === 'campaign' ? -50 : 0);
  items.sort((a, b) => rank(a) - rank(b) || (a.sceneIndex ?? -1) - (b.sceneIndex ?? -1));

  const blockers = items.filter((c) => c.critical && c.id !== 'verified');
  const toValidate = items.filter((c) => c.id === 'verified');
  const warnings = items.filter((c) => !c.critical);
  const all = [...campaignChecks, ...scenes.flatMap((x) => x.checks)];
  const ok = all.filter((c) => c.ok).length;

  return {
    party: p,
    scenes,
    sessions: sessionPlan,
    campaignChecks,
    items,
    blockers,
    toValidate,
    warnings,
    scenesReady: scenes.filter((x) => x.state === 'ready').length,
    scenesTotal: scenes.length,
    checksOk: ok,
    checksTotal: all.length,
    pct: all.length ? Math.round((ok / all.length) * 100) : 0,
    status: blockers.length ? 'blocked' : toValidate.length ? 'review' : scenes.length ? 'ready' : 'blocked',
  };
}

/**
 * Ressources nécessaires, déduites des scènes : PNJ, créatures (avec le nombre d'instances) et lieux,
 * et la fiche existante qui leur correspond (PNJ & Créatures, SRD ou bibliothèque). Une fiche par nom.
 */
export function campaignResources(camp, { npcs = [], library = [] } = {}) {
  const map = new Map();
  const add = (kind, name, sceneId, count = 1) => {
    const k = `${kind}:${norm(name)}`;
    if (!norm(name)) return;
    const cur = map.get(k) || { kind, name, scenes: new Set(), instances: 0 };
    if (sceneId) cur.scenes.add(sceneId);
    cur.instances += count;
    map.set(k, cur);
  };
  for (const sc of camp.scenes || []) {
    const x = sc.expanded || {};
    (x.npcs || []).forEach((n) => add('npc', n.name, sc.id));
    (x.encounters || []).forEach((e) => (e.creatures || []).forEach((c) => add('creature', c.name, sc.id, Number(c.count) || 1)));
    if (sc.location) add('place', sc.location, sc.id, 0);
  }
  (camp.recurringNpcs || []).forEach((n) => add('npc', n.name, null, 0));
  (camp.monsters || []).forEach((m) => add('creature', m.name, null, 0));

  const byName = new Map(npcs.map((n) => [norm(n.name), n]));
  const places = new Map(library.filter((e) => e.archiveType === 'place').map((e) => [norm(e.title), e]));
  return [...map.values()]
    .map((r) => {
      const k = norm(r.name);
      const sheet = r.kind === 'place' ? places.get(k) : byName.get(k);
      const srd = r.kind === 'creature' && !sheet ? findSrd(r.name) : null;
      return {
        ...r,
        scenes: [...r.scenes],
        sheet: sheet || null,
        srd: srd || null,
        status: sheet ? 'created' : srd ? 'srd' : 'missing',
        required: r.kind !== 'place' && r.scenes.size > 0,
      };
    })
    .sort((a, b) => (a.status === 'missing' ? -1 : 0) - (b.status === 'missing' ? -1 : 0) || b.scenes.length - a.scenes.length);
}
