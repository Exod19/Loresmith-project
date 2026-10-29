/**
 * Worker de sauvegarde (`loresmith-backup`) : seulement la tâche planifiée quotidienne.
 * En ligne, l'API est servie par les Pages Functions du site, qui n'ont pas de tâches planifiées :
 * ce petit Worker, lié à la même base D1 et au même espace KV, fait la sauvegarde de la nuit.
 * Voir wrangler.backup.toml.
 */
import { backupNow } from './backup.js';
import { log } from './log.js';

export default {
  async fetch() {
    return new Response('Loresmith : sauvegardes de la base.', { status: 404 });
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      backupNow(env).then(
        (r) => log(env, 'info', 'sauvegarde', r),
        (err) => log(env, 'error', 'sauvegarde échouée', { message: err?.message }),
      ),
    );
  },
};
