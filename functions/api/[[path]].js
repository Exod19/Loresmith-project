/**
 * Pages Function : sert l'API à la même adresse que le site (`/api/...`), en relayant vers le Worker
 * `loresmith-api` par une liaison de service (`API`, réglée dans le projet Cloudflare Pages).
 * Même origine : témoins de session de première partie, et protection Cloudflare Access commune.
 * Sans liaison (aperçu non configuré), l'API répond 503 et le site fonctionne en local, comme avant.
 */
export async function onRequest({ request, env }) {
  if (!env.API) return Response.json({ error: 'API non configurée sur ce site.' }, { status: 503 });
  return env.API.fetch(request);
}
