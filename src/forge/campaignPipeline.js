import { FAUNA_RULE } from '../feeds/fauna';
/**
 * Forge de campagnes : génération en plusieurs passes, pour obtenir une campagne prête à jouer.
 *
 *  1. Brief : chaque champ est rempli par le MJ, ou laissé vide (« l'IA décide »). L'IA peut proposer
 *     tous les champs vides d'un coup, ou un seul ; le MJ corrige ensuite ce qu'il veut.
 *  2. Bible : canon, actes, séances (plan), PNJ récurrents, factions, lieux, mystères, créatures.
 *  3. Séances : une passe par séance, qui écrit chaque scène en entier (texte à lire, dialogues,
 *     rencontres, jets et DD, indices, embranchements, butin, comment guider le groupe vers la suite).
 *
 * Chaque passe est enregistrée dès qu'elle est finie : une coupure ne fait rien perdre, et la forge
 * peut reprendre là où elle s'est arrêtée.
 */
import { LORE_RULES } from '../ai/loreContext';

const uid = () => Math.random().toString(36).slice(2, 10);

/** Champs du brief. `ai: true` : laissé vide, l'IA décide. */
export const BRIEF_FIELDS = [
  { key: 'title', label: 'Titre', group: 'Cadre', ph: 'La Porte qui grince' },
  { key: 'theme', label: 'Thème / prémisse', group: 'Cadre', ph: 'Une colonie de moulasses s’étend sous la cité…', long: true },
  { key: 'tone', label: 'Ton', group: 'Cadre', ph: 'horreur lente, humour noir, espoir fragile…' },
  { key: 'startingSituation', label: 'Situation de départ', group: 'Cadre', ph: 'Le groupe est engagé pour réparer une herse…', long: true },
  { key: 'centralConflict', label: 'Conflit central', group: 'Intrigue', long: true },
  { key: 'mainVillain', label: 'Antagoniste', group: 'Intrigue' },
  { key: 'villainGoal', label: 'Objectif de l’antagoniste', group: 'Intrigue' },
  { key: 'finalStakes', label: 'Enjeux finaux', group: 'Intrigue' },
  { key: 'mysteries', label: 'Mystères à révéler', group: 'Intrigue', long: true },
  { key: 'mainLocations', label: 'Lieux majeurs', group: 'Monde', ph: 'Hosten Valak, Marché des Ombres…', long: true },
  { key: 'factions', label: 'Factions', group: 'Monde', long: true },
  { key: 'keyNpcs', label: 'PNJ importants', group: 'Monde', long: true },
  { key: 'creatures', label: 'Créatures / menaces', group: 'Monde', ph: 'Moulasses, duergars, sensommes…' },
  { key: 'recurringSymbols', label: 'Symboles et motifs', group: 'Monde' },
  { key: 'playerBackstoryHooks', label: 'Liens avec les personnages', group: 'Table', long: true },
  { key: 'rewardStyle', label: 'Style de récompenses', group: 'Table', ph: 'modeste, narratif, rarement magique' },
  { key: 'constraints', label: 'À inclure / à éviter', group: 'Table', long: true },
];

export const FORMATS = {
  oneshot: { label: 'One-shot', sessions: 1, scenes: '5 à 7' },
  short: { label: 'Courte (2–4 séances)', sessions: 3, scenes: '4 à 6' },
  arc: { label: 'Arc (6–10 séances)', sessions: 8, scenes: '4 à 5' },
  long: { label: 'Longue (12+ séances)', sessions: 12, scenes: '3 à 5' },
};

export function emptyBrief() {
  const b = { format: 'short', sessions: 3, hours: 3, level: 3, levelEnd: '', mindDump: '' };
  for (const f of BRIEF_FIELDS) b[f.key] = '';
  return b;
}

const lines = (arr, fmt) => (arr || []).map(fmt).filter(Boolean).join('\n');

function briefText(brief) {
  const fixed = BRIEF_FIELDS.filter((f) => String(brief[f.key] || '').trim());
  const free = BRIEF_FIELDS.filter((f) => !String(brief[f.key] || '').trim());
  return [
    `Format : ${FORMATS[brief.format]?.label || brief.format} · ${brief.sessions} séance(s) de ~${brief.hours} h · niveau ${brief.level}${brief.levelEnd ? ` → ${brief.levelEnd}` : ''}`,
    fixed.length ? 'CHOIX DU MJ (à respecter) :\n' + fixed.map((f) => `- ${f.label} : ${brief[f.key]}`).join('\n') : '',
    free.length ? `L'IA DÉCIDE : ${free.map((f) => f.label).join(', ')}.` : '',
    brief.mindDump?.trim() ? `NOTES LIBRES DU MJ :\n${brief.mindDump}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

const SYSTEM = `Tu es l'architecte de campagnes de Loresmith, un outil de maître de jeu (D&D 5e).
Tu écris en français, pour un MJ qui doit pouvoir jouer sans rien préparer de plus.
Réponds UNIQUEMENT en JSON valide, sans Markdown.
${LORE_RULES}`;

/** Propose des valeurs pour les champs vides du brief (ou pour `keys`). */
export async function proposeBrief(call, ctx, brief, keys) {
  const target = keys?.length ? BRIEF_FIELDS.filter((f) => keys.includes(f.key)) : BRIEF_FIELDS.filter((f) => !String(brief[f.key] || '').trim());
  if (!target.length) return {};
  const data = await call({
    system: SYSTEM,
    prompt: `${ctx}

BRIEF ACTUEL :
${briefText(brief)}

Propose une valeur riche et précise (1 à 3 phrases, noms propres inclus) pour chacun de ces champs, cohérente avec le brief et le contexte :
${target.map((f) => `- "${f.key}" : ${f.label}`).join('\n')}

Retourne : { ${target.map((f) => `"${f.key}": str`).join(', ')} }`,
    maxTokens: 3000,
    temperature: 0.8,
  });
  const out = {};
  for (const f of target) if (typeof data?.[f.key] === 'string' && data[f.key].trim()) out[f.key] = data[f.key].trim();
  return out;
}

/** Passe 1 : la bible de campagne. */
export async function forgeBible(call, ctx, brief) {
  const fmt = FORMATS[brief.format] || FORMATS.short;
  const n = Math.max(1, Number(brief.sessions) || fmt.sessions);
  return call({
    system: SYSTEM,
    prompt: `${ctx}

${briefText(brief)}

Écris la BIBLE de cette campagne : ${n} séance(s), ${fmt.scenes} scènes par séance.
La campagne doit avoir une vraie progression (indices qui s'accumulent, antagoniste qui réagit, conséquences des choix).
Chaque séance a un lieu principal, et le plan des scènes indique où elles se passent (noms de lieux de l'Atlas ou de la bibliothèque si possible).

Retourne :
{
  "title": str, "premise": "2 à 3 phrases", "hook": "l'accroche lue ou jouée pour lancer la campagne", "setting": str,
  "campaignCanon": "4 à 8 paragraphes : le contexte profond, ce qui se passe vraiment",
  "dmOverview": "brief MJ : structure, vérité cachée, rythme, comment l'antagoniste réagit",
  "finalTruth": str, "failureState": "ce qui arrive si les PJ échouent ou n'agissent pas",
  "campaignThemes": [str], "campaignQuestions": [str],
  "acts": [{ "title": str, "summary": str, "purpose": str, "openingBeat": str, "turningPoint": str, "finale": str, "secrets": [str], "consequences": [str] }],
  "sessions": [{
    "sessionNumber": num, "act": str, "title": str, "summary": str, "mainGoal": str, "dramaticQuestion": str,
    "mainLocation": str,
    "scenes": [{ "title": str, "type": "social|exploration|combat|puzzle|climax", "location": str, "purpose": str }]
  }],
  "recurringNpcs": [{ "name": str, "role": str, "kind": "race / nature", "motivation": str, "secret": str, "voice": str, "firstAppearance": str, "arc": str, "attitude": "allié|neutre|hostile|ambigu" }],
  "factions": [{ "name": str, "goal": str, "methods": str, "publicFace": str, "hiddenTruth": str, "relationshipToParty": str }],
  "majorLocations": [{ "name": str, "description": str, "sensoryDetails": str, "secrets": str, "campaignUse": str }],
  "mysteries": [{ "question": str, "truth": str, "clues": [str], "redHerrings": [str], "payoff": str }],
  "monsters": [{ "name": str, "kind": str, "cr": str, "role": "brute|tireur|contrôleur|embusqué|boss|nuée", "where": str, "description": str }]
}`,
    maxTokens: 12000,
    temperature: 0.75,
  });
}

/** Résumé compact de la bible, pour les passes suivantes. */
function bibleDigest(bible) {
  return [
    `CAMPAGNE : ${bible.title}\nPrémisse : ${bible.premise}\nVérité cachée : ${bible.finalTruth || ''}`,
    `Brief MJ : ${String(bible.dmOverview || '').slice(0, 1500)}`,
    'PNJ récurrents :\n' + lines(bible.recurringNpcs, (n) => `- ${n.name} (${n.role}) : ${n.motivation} / secret : ${n.secret} / voix : ${n.voice}`),
    'Factions :\n' + lines(bible.factions, (f) => `- ${f.name} : ${f.goal}`),
    'Lieux :\n' + lines(bible.majorLocations, (l) => `- ${l.name} : ${String(l.description || '').slice(0, 160)}`),
    'Mystères :\n' + lines(bible.mysteries, (m) => `- ${m.question} → ${m.truth} (indices : ${(m.clues || []).join(' ; ')})`),
    'Créatures :\n' + lines(bible.monsters, (m) => `- ${m.name} (${m.kind}, FP ${m.cr}) : ${m.where}`),
    'Plan des séances :\n' + lines(bible.sessions, (s) => `- S${s.sessionNumber} ${s.title} : ${s.summary}`),
  ].join('\n\n');
}

/** Passe 2 : une séance entière, scène par scène. `previous` : résumé de ce qui précède. */
export async function forgeSession(call, ctx, bible, session, brief, previous = '') {
  const plan = (session.scenes || []).map((sc, i) => `${i + 1}. ${sc.title} [${sc.type}] — ${sc.location || '?'} — ${sc.purpose || ''}`).join('\n');
  return call({
    system: `${SYSTEM}
Les dialogues reflètent l'espèce, le statut et l'émotion de qui parle (tics de langage légers).
${FAUNA_RULE}
Le butin est rare et modeste : souvent banal, abîmé, personnel ou porteur d'indice.`,
    prompt: `${ctx.slice(0, 9000)}

${bibleDigest(bible)}

${previous ? `CE QUI PRÉCÈDE :\n${previous}\n` : ''}
Groupe de niveau ${brief.level}, séance de ~${brief.hours} h.

ÉCRIS LA SÉANCE ${session.sessionNumber} « ${session.title} » EN ENTIER, prête à jouer.
Objectif : ${session.mainGoal || ''} · Question dramatique : ${session.dramaticQuestion || ''}
Plan prévu (adapte si besoin) :
${plan}

Pour CHAQUE scène : texte à lire (2 à 3 paragraphes), lieu exact, ce qui se passe vraiment, PNJ présents avec 2 à 4 répliques
réelles, rencontres avec les créatures (nom, nombre, FP), jets avec DD précis et ce qu'ils révèlent, indices, embranchements,
butin, et surtout "guidance" : comment amener naturellement le groupe vers la scène suivante (rumeurs, PNJ qui pousse, indice qui pointe un lieu, menace qui chasse).

Retourne :
{
  "dmBrief": "brief dense de la séance", "openingImage": str, "recap": "à lire en début de séance (si ce n'est pas la première)",
  "possibleEndings": [str], "cliffhanger": str,
  "scenes": [{
    "title": str, "type": "social|exploration|combat|puzzle|climax", "summary": str, "location": str,
    "readAloud": str, "purpose": str, "dmNotes": str, "sensoryDetails": str, "hiddenTruth": str,
    "guidance": ["comment orienter le groupe vers la suite"], "nextLocation": "lieu de la scène suivante",
    "npcs": [{ "name": str, "role": str, "note": str, "motivation": str, "secret": str, "voice": str }],
    "dialogues": [{ "speaker": str, "voice": str, "situation": str, "text": str }],
    "encounters": [{ "name": str, "detail": str, "creatures": [{ "name": str, "count": num, "cr": str }], "goal": str, "terrain": str, "tactics": str, "complication": str, "nonCombatResolution": str, "difficulty": "facile|moyenne|difficile|mortelle", "loot": [str] }],
    "skillChecks": [{ "check": "Compétence", "dc": num, "why": str, "on_success": str, "on_failure": str }],
    "clues": [str],
    "branches": [{ "if": str, "then": str }],
    "playerChoices": [str], "consequences": [str], "callbacks": [str],
    "loot": [str]
  }]
}`,
    maxTokens: 14000,
    temperature: 0.75,
  });
}

/** Scène enregistrée (format compris par la console de scène existante). */
export function toScene(sc, session) {
  return {
    id: uid(),
    title: sc.title || 'Scène',
    type: sc.type || 'exploration',
    summary: sc.summary || sc.purpose || '',
    sessionNumber: session?.sessionNumber ?? null,
    location: sc.location || '',
    expanded: {
      setting: sc.location || '',
      readAloud: sc.readAloud || '',
      purpose: sc.purpose || '',
      dmNotes: sc.dmNotes || '',
      sensoryDetails: sc.sensoryDetails || '',
      hiddenTruth: sc.hiddenTruth || '',
      guidance: sc.guidance || [],
      nextLocation: sc.nextLocation || '',
      npcs: sc.npcs || [],
      dialogues: sc.dialogues || [],
      encounters: (sc.encounters || []).map((e) => ({ ...e, loot: e.loot || [] })),
      skillChecks: sc.skillChecks || [],
      clues: sc.clues || [],
      branches: sc.branches || [],
      playerChoices: sc.playerChoices || [],
      consequences: sc.consequences || [],
      callbacks: sc.callbacks || [],
      loot: sc.loot || [],
      sessionNumber: session?.sessionNumber ?? null,
      act: session?.act || '',
    },
  };
}

/** Scènes provisoires (plan de la bible) : remplacées quand la séance est écrite. */
export function outlineScenes(session) {
  return (session.scenes || []).map((sc) => ({
    id: uid(),
    title: sc.title || 'Scène',
    type: sc.type || 'exploration',
    summary: sc.purpose || '',
    sessionNumber: session.sessionNumber,
    location: sc.location || '',
    outline: true,
    expanded: null,
  }));
}

/** Suggestions de bibliothèque tirées de la bible (lieux, PNJ, factions, mystères). */
export function librarySuggestionsFrom(bible) {
  return [
    ...(bible.majorLocations || []).map((l) => ({
      title: l.name, archiveType: 'place', shortSummary: l.description,
      body: [l.description, l.sensoryDetails].filter(Boolean).join('\n\n'), campaignUse: l.campaignUse || '', secrets: l.secrets || '',
    })),
    ...(bible.recurringNpcs || []).map((n) => ({
      title: n.name, archiveType: 'person', shortSummary: n.role,
      body: [n.motivation, n.arc].filter(Boolean).join('\n\n'), campaignUse: n.firstAppearance || '', secrets: n.secret || '',
    })),
    ...(bible.factions || []).map((f) => ({
      title: f.name, archiveType: 'faction', shortSummary: f.goal,
      body: [f.publicFace, f.methods].filter(Boolean).join('\n\n'), campaignUse: f.relationshipToParty || '', secrets: f.hiddenTruth || '',
    })),
    ...(bible.mysteries || []).map((m) => ({
      title: m.question, archiveType: 'mystery', shortSummary: m.payoff || '',
      body: `Indices :\n${(m.clues || []).join('\n')}\n\nFausses pistes :\n${(m.redHerrings || []).join('\n')}`, campaignUse: m.payoff || '', secrets: m.truth || '',
    })),
  ];
}

// Le digest vit dans un module pur (testable) : le vécu des comptes rendus prime sur le prévu.
export { previousDigest } from '../campaign/digest.js';
