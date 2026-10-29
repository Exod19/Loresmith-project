/**
 * Pages Function : l'API de Loresmith (server/src) servie à l'adresse même du site, sous `/api/...`.
 * Même origine : témoins de session de première partie, et protection Cloudflare Access commune.
 * Les liaisons (base D1 `DB`, espace KV `BLOBS`) et les variables (dont le secret BETTER_AUTH_SECRET)
 * sont réglées dans le projet Cloudflare Pages. En local, l'API tourne avec `npm run server:dev`.
 */
import worker from '../../server/src/index.js';

export function onRequest(context) {
  if (!context.env.DB) return Response.json({ error: 'API non configurée sur ce site.' }, { status: 503 });
  return worker.fetch(context.request, context.env, { waitUntil: context.waitUntil, passThroughOnException: context.passThroughOnException });
}
