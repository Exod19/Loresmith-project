/**
 * Avis et conditions d'utilisation, acceptés à la première connexion (lot 8).
 * Partagé par le site (affichage) et le serveur (version exigée). Toute modification du texte
 * doit changer `TERMS_VERSION` : chacun devra alors accepter la nouvelle version.
 */
export const TERMS_VERSION = '2026-10-29';

/** Personne à joindre pour toute question sur les renseignements personnels (Loi 25). */
export const PRIVACY_CONTACT = 'coordonnées à venir';

export const TERMS = [
  {
    title: 'Un projet personnel, en développement',
    text: 'Loresmith est un projet personnel et non commercial, encore en développement. Il est fourni tel quel, sans garantie de disponibilité ni de conservation des données. Garde tes propres sauvegardes : Exporter (.zip), en haut à droite.',
  },
  {
    title: 'Contenus de tiers',
    text: 'Loresmith contient des contenus de tiers, dont des éléments du SRD 5.1 (Wizards of the Coast LLC, licence CC BY 4.0) et d’autres éléments dont les droits appartiennent à leurs titulaires. Ils servent ici à un usage privé et non commercial, entre MJ. Ne les rediffuse pas.',
  },
  {
    title: 'Tes contenus et le partage',
    text: 'Tu restes propriétaire de ce que tu crées et tu n’y mets que ce que tu as le droit d’utiliser. Dans un univers partagé, tous les membres sont des MJ : ils voient tout son contenu, secrets compris. Ne note pas de renseignements sensibles sur tes joueurs.',
  },
  {
    title: 'Tes renseignements personnels',
    text: 'Pour ton compte, Loresmith garde ton courriel, ton nom affiché, ton mot de passe (haché, jamais en clair) et, pendant une session, ton adresse IP et ton navigateur. Tout est hébergé chez Cloudflare, hors du Québec. Les invitations envoient ton nom à la personne invitée. Les journaux techniques ne contiennent ni contenu ni courriel. Les sauvegardes de la base sont gardées 30 jours. Tes clés d’IA restent dans ton navigateur ; ce que tu envoies aux fournisseurs d’IA (OpenAI, Google, ElevenLabs…) suit leurs propres conditions. Aucune publicité, aucune revente.',
  },
  {
    title: 'Tes droits',
    text: `Dans Réglages, tu peux télécharger les renseignements de ton compte et ton grimoire, et supprimer ton compte en tout temps ; ses traces disparaissent des sauvegardes en 30 jours. Questions sur tes renseignements personnels : ${PRIVACY_CONTACT}.`,
  },
  {
    title: 'Âge',
    text: 'Le service est réservé aux personnes de 14 ans et plus.',
  },
];
