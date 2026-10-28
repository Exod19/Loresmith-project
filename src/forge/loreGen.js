import { FAUNA_RULE } from '../feeds/fauna';
/**
 * Lore de campagne, à tous les niveaux (séance, scène) : définition des rubriques et génération par l'IA.
 *
 * Chaque rubrique sait où elle est rangée (dans la scène ou dans la séance), quels champs elle montre,
 * et quel format l'IA doit renvoyer. Le MJ peut tout saisir à la main, ou demander une génération
 * avec ou sans consigne.
 */
import { buildLoreContext, LORE_RULES } from '../ai/loreContext';

/** Rubriques d'une scène. `kind` : liste d'objets, texte simple (`strings`) ou objet unique (`single`). */
export const SCENE_KINDS = {
  npcs: {
    label: 'PNJ présents',
    kind: 'list',
    fields: [['name', 'Nom'], ['role', 'Rôle'], ['note', 'Note de scène', 'area'], ['motivation', 'Motivation'], ['secret', 'Secret'], ['voice', 'Voix'], ['quotes', 'Répliques (une par ligne)', 'lines']],
    schema: '{ "name": str, "role": str, "note": str, "motivation": str, "secret": str, "voice": str, "quotes": [str] }',
    hint: 'PNJ qui vivent dans cette scène, avec une voix et un but propres.',
  },
  dialogues: {
    label: 'Dialogues',
    kind: 'list',
    fields: [['speaker', 'Qui parle'], ['voice', 'Ton'], ['situation', 'Situation'], ['text', 'Réplique', 'area']],
    schema: '{ "speaker": str, "voice": str, "situation": "bienvenue|première rencontre|appel à l’aide|provocation|indice de quête|mise en garde|mensonge|menace|révélation|marchandage", "text": str }',
    hint: 'Répliques réelles, en français, dans la voix de l’espèce et du statut de chacun.',
  },
  encounters: {
    label: 'Rencontres et créatures',
    kind: 'list',
    fields: [['name', 'Nom'], ['detail', 'Description', 'area'], ['creatures', 'Créatures (une par ligne : nom × nombre × FP)', 'creatures'], ['tactics', 'Tactique', 'area'], ['goal', 'But'], ['terrain', 'Terrain'], ['complication', 'Complication'], ['nonCombatResolution', 'Sans combat', 'area'], ['difficulty', 'Difficulté'], ['loot', 'Butin (une par ligne)', 'lines']],
    schema: `{ "name": str, "detail": str, "creatures": [{ "name": str, "count": num, "cr": "ex. 1/2" }], "tactics": str, "goal": str, "terrain": str, "complication": str, "nonCombatResolution": str, "difficulty": "facile|moyenne|difficile|mortelle", "loot": [str] }`,
    hint: 'Rencontres avec créatures réelles (noms de bestiaire), FP cohérent avec le groupe, et une façon de les éviter ou de les négocier.',
  },
  skillChecks: {
    label: 'Tests de compétence (DD)',
    kind: 'list',
    fields: [['check', 'Compétence'], ['dc', 'DD', 'num'], ['why', 'Pourquoi ce test'], ['on_success', 'Réussite', 'area'], ['on_failure', 'Échec', 'area']],
    schema: `{ "check": str, "dc": num, "why": str, "on_success": str, "on_failure": str }`,
    hint: 'Tests liés aux actions des joueurs dans la scène (Discrétion, Persuasion, Investigation…), DD réaliste.',
  },
  envChecks: {
    label: 'Environnement : tests de découverte (DD)',
    kind: 'list',
    fields: [['check', 'Ce qu’on cherche ou remarque'], ['dc', 'DD', 'num'], ['why', 'Lieu / détail'], ['on_success', 'Ce qu’on découvre', 'area'], ['on_failure', 'Si on rate', 'area']],
    schema: `{ "check": str, "dc": num, "why": str, "on_success": str, "on_failure": str }`,
    hint: 'Ce que le décor cache ou révèle (perception passive, Survie, Nature, Histoire, Investigation), selon le lieu et son ambiance, avec un DD réaliste.',
  },
  clues: {
    label: 'Indices',
    kind: 'strings',
    fields: [['_', 'Indice', 'area']],
    schema: '[str]',
    hint: 'Indices concrets que le groupe peut trouver dans la scène.',
  },
  environment: {
    label: 'Environnement',
    kind: 'single',
    fields: [['setting', 'Lieu précis'], ['sensoryDetails', 'Ambiance (sons, odeurs, lumière, textures)', 'area'], ['hiddenTruth', 'Ce qui se passe vraiment', 'area']],
    schema: '{ "setting": str, "sensoryDetails": str, "hiddenTruth": str }',
    hint: 'Le lieu tel qu’il est, avec son ambiance et ce qu’il cache.',
  },
  loot: {
    label: 'Butin',
    kind: 'strings',
    fields: [['_', 'Objet ou trouvaille', 'area']],
    schema: '[str]',
    hint: 'Butin rare et modeste : banal, abîmé, personnel ou porteur d’indice.',
  },
};

/** Rubriques d'une séance : mêmes formes, rangées dans la séance. */
export const SESSION_KINDS = {
  sessionBrief: { label: 'Brief de séance', kind: 'text', fields: [['dmBrief', 'Brief MJ', 'area']], schema: '{ "dmBrief": str }', hint: 'Ce qui doit arriver dans la séance, dans l’ordre, avec le rythme.' },
  npcs: { ...SCENE_KINDS.npcs, label: 'PNJ de la séance' },
  encounters: { ...SCENE_KINDS.encounters, label: 'Rencontres de la séance' },
  clues: { ...SCENE_KINDS.clues, label: 'Fils conducteurs de la séance' },
};

/** Texte de contexte d'une scène, pour l'IA. */
export function sceneBrief(camp, scene, session) {
  const x = scene.expanded || {};
  const names = (items, f = (i) => i.name) => (items || []).map((i) => f(i)).filter(Boolean).join(', ') || '—';
  return [
    `CAMPAGNE : ${camp.title} — ${camp.premise || ''}`,
    session ? `SÉANCE ${session.sessionNumber} : ${session.title} — ${session.summary || ''}\nBrief MJ : ${String(session.dmBrief || '').slice(0, 600)}` : '',
    `SCÈNE : ${scene.title} (${scene.type || '—'}) — lieu : ${scene.location || x.setting || '—'}\nRésumé : ${scene.summary || '—'}\nObjectif : ${x.purpose || '—'}`,
    `DÉJÀ DANS LA SCÈNE — PNJ : ${names(x.npcs)} · rencontres : ${names(x.encounters)} · tests : ${names(x.skillChecks, (c) => c.check)} · environnement : ${names(x.envChecks, (c) => c.check)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Demande à l'IA une ou plusieurs entrées d'une rubrique. `prompt` est facultatif : vide, l'IA décide.
 * Renvoie une liste (ou un objet / un texte selon la rubrique), déjà nettoyée.
 */
export async function generateLoreItems({ call, def, universe, state, feed, party, camp, scene, session, prompt = '', count = 3 }) {
  const ctx = buildLoreContext({
    universe,
    state,
    feed,
    party,
    budget: 8000,
    focus: [prompt, scene?.title, scene?.location, scene?.summary, camp?.title].filter(Boolean).join(' '),
  });
  const consigne = prompt.trim() ? `CONSIGNE DU MJ (à suivre à la lettre) :\n${prompt.trim()}` : 'AUCUNE CONSIGNE : décide toi-même ce qui sert le mieux cette scène.';
  const single = def.kind === 'single' || def.kind === 'text';
  const wanted = single ? '' : `Crée ${count} élément(s), tous différents.`;
  const retour = single
    ? `Retourne : { "item": ${def.schema} }`
    : def.kind === 'strings'
      ? `Retourne : { "items": ${def.schema} }`
      : `Retourne : { "items": [ ${def.schema} ] }`;
  const data = await call({
    system: `Tu es le co-auteur d'une campagne de jeu de rôle (D&D 5e) pour Loresmith. Tu écris en français, pour un MJ qui joue ce soir.
${FAUNA_RULE}
Réponds UNIQUEMENT en JSON valide, sans Markdown. Les DD sont réalistes, les créatures existent dans le bestiaire 5e ou le lore, les répliques sont dites à voix haute.
${LORE_RULES}`,
    prompt: `${ctx}

${sceneBrief(camp || {}, scene || {}, session)}

RUBRIQUE À REMPLIR : ${def.label}. ${def.hint || ''}
${consigne}
${wanted}
${retour}`,
    maxTokens: 4000,
    temperature: 0.8,
  });
  if (single) {
    const v = data?.item ?? data?.[def.kind === 'text' ? 'dmBrief' : 'item'];
    if (def.kind === 'text') return typeof v === 'string' ? v : v?.dmBrief || '';
    return v && typeof v === 'object' ? v : {};
  }
  const list = Array.isArray(data?.items) ? data.items : [];
  if (!list.length) throw new Error('L’IA n’a rien renvoyé d’exploitable pour cette rubrique. Réessaie, ou précise la consigne.');
  return def.kind === 'strings' ? list.map(String).filter(Boolean) : list.filter((x) => x && typeof x === 'object');
}

/** Une créature d'une rencontre : texte « nom × nombre × FP » vers et depuis la liste de champs. */
export function creaturesToText(list) {
  return (list || []).map((c) => [c.name, c.count && c.count !== 1 ? `× ${c.count}` : '', c.cr ? `FP ${c.cr}` : ''].filter(Boolean).join(' × ')).join('\n');
}
export function textToCreatures(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('×').map((p) => p.trim());
      const cr = (parts.find((p) => /^FP/i.test(p)) || '').replace(/^FP\s*/i, '');
      const count = Number((parts.find((p) => /^\d+$/.test(p)) || parts.find((p) => /^×\s*\d+/.test(p)) || '1').replace(/\D/g, '')) || 1;
      return { name: parts[0].replace(/\s*FP.*$/i, ''), count, cr };
    });
}
