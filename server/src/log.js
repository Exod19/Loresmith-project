/**
 * Journalisation structurée (une ligne JSON par événement), lue dans Workers Logs.
 * Jamais de contenu, de courriel, de jeton ni de mot de passe : seulement la route (son modèle, pas l'adresse réelle),
 * le statut, la durée et l'identifiant du compte.
 * `LOG_LEVEL` : `info` (défaut), `error` (erreurs seulement) ou `silent` (tests).
 */
const LEVELS = { info: 1, error: 2, silent: 9 };

export function log(env, level, event, data = {}) {
  const min = LEVELS[env?.LOG_LEVEL] ?? LEVELS.info;
  if ((LEVELS[level] ?? 1) < min) return;
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...data });
  if (level === 'error') console.error(line);
  else console.log(line);
}
