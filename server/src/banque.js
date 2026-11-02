/**
 * Banque Loresmith : retouches des étiquettes (peuple, rôles, taille, climats…) partagées par toute l'application.
 *  - `GET /api/banque/retouches` : { retouches, updatedAt } ;
 *  - `PUT /api/banque/retouches/:id` : { patch } fusionne la retouche d'une image ; { patch: null } la retire.
 * Stockées dans l'espace KV (une seule valeur JSON, cf. store.js) : pas de migration de la base.
 */
import { canBanque } from '../../src/shared/policy.js';
import { blobStore } from './store.js';
import { HttpError } from './documents.js';

const KEY = 'app/banque-retouches.json';
/** Champs qu'une retouche peut changer (le reste du catalogue vient du dépôt). */
const FIELDS = new Set(['nom', 'peuple', 'genre', 'roles', 'taille', 'milieux', 'climats', 'saisons', 'region', 'usage', 'forme', 'cat', 'exclu']);
const ID = /^[a-z0-9-]{1,80}$/;

async function read(env) {
  const got = await blobStore(env).get(KEY);
  if (!got) return { retouches: {}, updatedAt: 0 };
  try {
    return JSON.parse(new TextDecoder().decode(got.bytes));
  } catch {
    return { retouches: {}, updatedAt: 0 };
  }
}

/** Retouche nettoyée : seulement les champs connus, valeurs simples (texte, nombre, booléen, listes de textes ou nombres). */
export function cleanPatch(patch) {
  if (patch === null) return null;
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new HttpError(400, 'Retouche invalide.');
  const out = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!FIELDS.has(k)) continue;
    const ok = (x) => (typeof x === 'string' && x.length <= 200) || (typeof x === 'number' && Number.isFinite(x)) || typeof x === 'boolean';
    if (Array.isArray(v) ? v.length <= 30 && v.every(ok) : ok(v)) out[k] = v;
  }
  return out;
}

export function mountBanque(app) {
  app.get('/api/banque/retouches', async (c) => {
    if (!canBanque(c.get('actor'), 'read')) throw new HttpError(403, 'Action refusée.');
    return c.json(await read(c.env));
  });

  app.put('/api/banque/retouches/:id', async (c) => {
    const actor = c.get('actor');
    if (!canBanque(actor, 'update')) throw new HttpError(403, 'Action refusée.');
    const id = c.req.param('id');
    if (!ID.test(id)) throw new HttpError(400, 'Identifiant d’image invalide.');
    let body;
    try { body = await c.req.json(); } catch { throw new HttpError(400, 'Corps de requête JSON attendu.'); }
    const patch = cleanPatch(body?.patch ?? null);
    const doc = await read(c.env);
    if (patch === null) delete doc.retouches[id];
    else doc.retouches[id] = { ...doc.retouches[id], ...patch, par: actor.id, le: Date.now() };
    doc.updatedAt = Date.now();
    await blobStore(c.env).put(KEY, new TextEncoder().encode(JSON.stringify(doc)), { contentType: 'application/json' });
    return c.json(doc);
  });
}
