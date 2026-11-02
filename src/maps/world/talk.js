/**
 * Conversations du personnage du MJ avec les PNJ (mode Exploration) : l'IA joue le PNJ d'après sa fiche, son lieu,
 * le lore, la saison et le climat. Elle peut proposer du lore (lieu, PNJ, rumeur, fait) que le MJ accepte ou rejette.
 *
 * JavaScript pur : construction du prompt et lecture de la réponse (testés par world.test.mjs). L'appel à l'IA se
 * fait dans TalkPanel.tsx, avec la clé de l'utilisateur.
 */

const SEASON_TXT = { printemps: 'le printemps (dégel, boue, semailles)', ete: 'l’été (chaleur, moissons)', automne: 'l’automne (récoltes, jours qui raccourcissent)', hiver: 'l’hiver' };
const CLIMATE_TXT = { froid: 'un pays froid du nord', tempere: 'un pays tempéré', chaud: 'un pays chaud et sec' };
const TIME_TXT = { matin: 'le matin', jour: 'en pleine journée', soir: 'le soir', nuit: 'la nuit' };
const clip = (s, n) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/** Types de propositions de lore que l'IA peut faire. */
export const PROPOSAL_TYPES = { lieu: 'Lieu', pnj: 'PNJ', rumeur: 'Rumeur', fait: 'Fait' };

/**
 * Prompt système : l'IA incarne le PNJ.
 * `npc` : { name, role, summary } ; `fiche` : texte de sa fiche (s'il en a une) ; `place` : { title, type, summary } ;
 * `city` : { name, population } ; `ctx` : { season, climate, time } ; `avatar` : { name, role, desc } ;
 * `mode` : 'reverie' | 'chronique' ; `lore` : contexte de l'univers (déjà construit).
 */
export function npcSystemPrompt({ npc, fiche, place, city, ctx = {}, avatar = {}, mode = 'reverie', lore = '' }) {
  const lines = [
    `Tu joues ${npc.name}${npc.role ? `, ${npc.role}` : ''}, un personnage non joueur d'une partie de jeu de rôle médiéval-fantastique. Tu parles À LA PREMIÈRE PERSONNE, en français, dans le registre de ton personnage (familier pour un tavernier, soutenu pour un noble).`,
    npc.summary ? `Ce qu'on sait de toi : ${clip(npc.summary, 500)}` : '',
    fiche ? `TA FICHE (canon, à respecter) :\n${clip(fiche, 1800)}` : '',
    place ? `Tu te trouves ici : ${place.title}${place.type ? ` (${place.type})` : ''}${city?.name ? `, à ${city.name}` : ''}.${place.summary ? ` ${clip(place.summary, 400)}` : ''}` : '',
    city?.name ? `${city.name} est ${city.population && city.population < 400 ? 'un petit village' : 'une cité'}${city.population ? ` de ${city.population} habitants` : ''}, dans ${CLIMATE_TXT[ctx.climate] ?? 'un pays tempéré'}.` : '',
    `Moment : ${TIME_TXT[ctx.time] ?? 'en pleine journée'}${ctx.season ? `, pendant ${SEASON_TXT[ctx.season]}` : ''}. Parle du temps qu'il fait si c'est naturel.`,
    `Tu parles à ${avatar.name || 'un voyageur'}${avatar.role ? `, ${avatar.role}` : ''}${avatar.desc ? ` (${clip(avatar.desc, 200)})` : ''}. Tu ne sais de lui que ce que tu vois et ce qu'il te dit.`,
    mode === 'chronique'
      ? 'Cette conversation est réelle dans l’histoire de la campagne : ce que tu dis engage ton personnage.'
      : 'Cette conversation est une rêverie du MJ : tu peux improviser librement, rien n’est canon tant que le MJ ne l’accepte pas.',
    lore ? `LORE DE L'UNIVERS (puise-y d'abord, réutilise les noms exacts, ne contredis jamais le canon) :\n${lore}` : '',
    `FORMAT DE RÉPONSE :
- Réponds par une seule réplique de ton personnage (1 à 5 phrases), sans guillemets autour, sans narration à la troisième personne. Une courte action entre astérisques est permise (*essuie une chope*).
- Si, dans ta réplique, tu INVENTES un élément nouveau qui mériterait d'entrer dans le lore (un lieu, un PNJ, une rumeur, un fait sur toi ou sur la ville), ajoute APRÈS ta réplique une ligne « PROPOSITIONS : » puis une ligne par élément, au format :
- [lieu|pnj|rumeur|fait] Titre court : une phrase de description
- N'ajoute pas de propositions pour ce qui est déjà dans ta fiche ou dans le lore. Au plus trois propositions.`,
  ];
  return lines.filter(Boolean).join('\n\n');
}

/** Message utilisateur : l'historique récent, puis ce que dit le personnage du MJ. */
export function npcUserPrompt(history, said, avatarName = 'Le voyageur', npcName = 'PNJ') {
  const past = history.slice(-12).map((m) => `${m.from === 'avatar' ? avatarName : npcName} : ${m.text}`).join('\n');
  return `${past ? `CONVERSATION JUSQU'ICI :\n${past}\n\n` : ''}${avatarName} : ${said}\n\nRéponds en tant que ${npcName}.`;
}

/** Lit la réponse de l'IA : la réplique, puis les propositions de lore (s'il y en a). */
export function parseNpcReply(text) {
  const raw = String(text ?? '').replace(/\r/g, '').trim();
  const m = /\n?\s*\**PROPOSITIONS?\s*\**\s*:?\s*\**\s*\n?/i.exec(raw);
  const say = (m ? raw.slice(0, m.index) : raw).trim().replace(/^["«»“”\s]+|["«»“”\s]+$/g, '').trim();
  const proposals = [];
  if (m) {
    for (const line of raw.slice(m.index + m[0].length).split('\n')) {
      const p = /^\s*[-•*]?\s*\[?\s*(lieu|pnj|rumeur|fait)\s*\]?\s*[:—-]?\s*([^:]+?)\s*:\s*(.+)$/i.exec(line);
      if (p) proposals.push({ type: p[1].toLowerCase(), title: p[2].trim().replace(/^\*+|\*+$/g, ''), text: p[3].trim() });
    }
  }
  return { say: say || '…', proposals: proposals.slice(0, 3) };
}

/** Résumé d'une conversation pour la mémoire de l'univers (mode Chronique), sans appel à l'IA. */
export function chronicleOf({ avatar, npc, place, city, ctx = {}, history, accepted = [] }) {
  const where = [place?.title, city?.name].filter(Boolean).join(', ');
  const when = [ctx.season ? SEASON_TXT[ctx.season]?.split(' (')[0] : '', TIME_TXT[ctx.time] ?? ''].filter(Boolean).join(', ');
  const lastNpc = [...history].reverse().find((m) => m.from === 'npc');
  const asked = history.filter((m) => m.from === 'avatar').map((m) => clip(m.text, 90));
  return {
    title: `${avatar?.name || 'Le personnage du MJ'} parle avec ${npc.name}`,
    summary: [
      `${avatar?.name || 'Le personnage du MJ'} a parlé avec ${npc.name}${npc.role ? ` (${npc.role})` : ''}${where ? ` à ${where}` : ''}${when ? `, ${when}` : ''}.`,
      asked.length ? `Sujets : ${asked.slice(0, 4).join(' / ')}.` : '',
      lastNpc ? `Dernière réponse : « ${clip(lastNpc.text, 240)} »` : '',
      accepted.length ? `Lore retenu : ${accepted.map((p) => `${p.title} (${PROPOSAL_TYPES[p.type] ?? p.type})`).join(', ')}.` : '',
    ].filter(Boolean).join(' '),
  };
}
