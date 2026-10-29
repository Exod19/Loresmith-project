/**
 * Authentification (Better Auth) : comptes par courriel et mot de passe, sessions en cookie, base D1.
 * L'envoi de courriels (vérification, mot de passe oublié) viendra avec Resend, au lot 6.
 */
import { betterAuth } from 'better-auth';

const cache = new WeakMap();

/** Instance Better Auth pour un environnement de Worker (une par environnement, réutilisée). */
export function authFor(env) {
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error('BETTER_AUTH_SECRET manquant ou trop court (voir server/.dev.vars.example).');
  }
  let auth = cache.get(env);
  if (!auth) {
    auth = betterAuth({
      database: env.DB,
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.BETTER_AUTH_URL,
      basePath: '/api/auth',
      trustedOrigins: [env.FRONT_ORIGIN].filter(Boolean),
      emailAndPassword: { enabled: true, minPasswordLength: 10 },
      // Aucun envoi de statistiques d'usage vers un service tiers.
      telemetry: { enabled: false },
    });
    cache.set(env, auth);
  }
  return auth;
}
