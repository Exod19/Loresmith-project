/**
 * Qui peut parler ? D'après le bloc de statistiques d'une créature : ses langues (« — » : aucune), ce qu'elle comprend
 * sans parler, la télépathie, et son Intelligence. Un crabe, une vase ou un loup ne parlent pas.
 *
 * JavaScript pur : testé par world.test.mjs.
 */
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ');

/**
 * `stat` : { languages, abil?: [For, Dex, Con, Int, Sag, Cha], meta? }.
 * Renvoie { ok, how: 'parole' | 'telepathie' | null, why, languages } ; sans bloc de statistiques, on ne suppose rien.
 */
export function canSpeak(stat) {
  if (!stat) return { ok: false, how: null, why: 'langues inconnues : ajoute-les à sa fiche', languages: '' };
  const lang = norm(stat.languages).trim();
  const int = stat.abil?.[3];
  const tele = /telepathi/.test(lang);
  const none = !lang || /^[-—–\s]+$/.test(lang) || /^(aucune?|neant|nul)/.test(lang);
  const mute = /(ne (peut|sait) pas parler|ne parle (pas|aucune)|mais ne (les |le )?parle|comprend[^,;.]* mais ne|incapable de parler)/.test(lang);
  if (tele) return { ok: true, how: 'telepathie', why: 'communique par télépathie', languages: stat.languages };
  if (none) return { ok: false, how: null, why: 'ne parle aucune langue', languages: '' };
  if (mute) return { ok: false, how: null, why: 'comprend, mais ne parle pas', languages: stat.languages };
  if (int !== undefined && int <= 3) return { ok: false, how: null, why: 'trop peu d’intelligence pour parler', languages: stat.languages };
  return { ok: true, how: 'parole', why: '', languages: stat.languages };
}

/** Consignes de jeu pour l'IA selon l'intelligence et les langues de la créature. */
export function creatureVoice(stat, speak) {
  const int = stat?.abil?.[3] ?? 10;
  const lines = [
    stat?.meta ? `Tu es une créature : ${stat.meta}.` : 'Tu es une créature, pas un humain ordinaire.',
    `Tes langues : ${stat?.languages || 'inconnues'}. Si ton interlocuteur ne parle pas l'une d'elles, fais-le sentir (mots mal compris, gestes) plutôt que de parler couramment sa langue.`,
    speak?.how === 'telepathie' ? 'Tu communiques par télépathie : tes mots résonnent directement dans l’esprit de ton interlocuteur.' : '',
    int <= 6 ? 'Ton intelligence est très faible : phrases courtes, vocabulaire pauvre, besoins immédiats (faim, peur, territoire).'
      : int <= 9 ? 'Ton intelligence est modeste : langage simple et direct.'
        : int >= 16 ? 'Ton intelligence est remarquable : langage riche, sous-entendus, calcul.' : '',
    'Reste fidèle à la nature de ta créature : ses instincts, ses motivations et son hostilité éventuelle.',
  ];
  return lines.filter(Boolean).join('\n');
}
