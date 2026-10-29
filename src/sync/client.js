/**
 * Côté navigateur : appels au serveur (comptes, synchronisation, images) et état local de la synchronisation.
 * L'adresse du serveur : en développement `http://localhost:8787`, sinon le site lui-même (`/api`),
 * ou celle choisie dans Réglages (`loresmith:api-url`).
 */
import { getImageBlob, loadKv, saveKv } from '../store/persist';
import { resolveAll, storeImages, toPersisted } from '../store/images';
import { collectStrings, idOfRef, isRef } from '../store/imageRefs';
import { resolveConflict, runSync } from './engine';

const URL_KEY = 'loresmith:api-url';
const META_KEY = 'sync-meta';

export function apiUrl() {
  try {
    const custom = localStorage.getItem(URL_KEY);
    if (custom !== null) return custom.replace(/\/$/, '');
  } catch {
    /* stockage indisponible */
  }
  return import.meta.env.DEV ? 'http://localhost:8787' : '';
}

export function setApiUrl(url) {
  try {
    if (url === null) localStorage.removeItem(URL_KEY);
    else localStorage.setItem(URL_KEY, url.trim());
  } catch {
    /* préférence gardée pour la session */
  }
}

/** Requête au serveur. Erreur réseau : `status` absent ; erreur HTTP : `status` et `body`. */
async function request(method, path, { json, raw, type } = {}) {
  let res;
  try {
    res = await fetch(apiUrl() + path, {
      method,
      credentials: 'include',
      headers: json !== undefined ? { 'Content-Type': 'application/json' } : raw ? { 'Content-Type': type } : undefined,
      body: json !== undefined ? JSON.stringify(json) : raw,
    });
  } catch {
    throw new TypeError('Serveur injoignable.');
  }
  const isJson = (res.headers.get('Content-Type') || '').includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : res;
  if (!res.ok) throw Object.assign(new Error(body?.error || body?.message || `Erreur ${res.status}`), { status: res.status, body: isJson ? body : null });
  return body;
}

/** Le serveur répond-il ? (Sur un site sans API, `/api/health` renvoie la page du site, pas du JSON.) */
export async function serverReachable() {
  try {
    return (await request('GET', '/api/health'))?.service === 'loresmith-api';
  } catch {
    return false;
  }
}

/* ——— Compte ——— */

export async function currentAccount() {
  try {
    return await request('GET', '/api/me');
  } catch (e) {
    if (e.status === 401) return null;
    throw e;
  }
}
export const signIn = (email, password) => request('POST', '/api/auth/sign-in/email', { json: { email, password } });
export const signUp = (name, email, password) => request('POST', '/api/auth/sign-up/email', { json: { name, email, password } });
export const signOut = () => request('POST', '/api/auth/sign-out', { json: {} });

/* ——— Synchronisation ——— */

const api = {
  pull: (since) => request('GET', `/api/sync?since=${since}`),
  put: (doc) => request('PUT', `/api/docs/${doc.type}/${encodeURIComponent(doc.id)}`, { json: doc }),
  remove: (type, id, version) => request('DELETE', `/api/docs/${type}/${encodeURIComponent(id)}?version=${version}`),
  uploadImage: async (universeId, id) => {
    const blob = await getImageBlob(id).catch(() => null);
    if (!blob) throw Object.assign(new Error('Image absente.'), { status: 404 });
    await request('PUT', `/api/images/${encodeURIComponent(universeId)}/${id}`, { raw: blob, type: blob.type || 'image/webp' });
  },
};

/** L'univers d'exemple créé au premier lancement, jamais modifié ni utilisé : il ne part pas sur le serveur. */
function seedSkipper(persisted) {
  const used = new Set();
  for (const c of ['characters', 'campaigns', 'npcs', 'quests', 'assets', 'libraryEntries', 'maps', 'chatThreads']) for (const v of Object.values(persisted[c] || {})) used.add(v.universeId);
  return (doc) => doc.type === 'universe' && doc.data?.name === 'The Sundered Reach' && /^A coastal frontier of drowned ruins/.test(doc.data?.lore || '') && !used.has(doc.id);
}

/** Télécharge les images reçues qui manquent ici, puis rend les documents affichables (URL `blob:`). */
async function prepareChanges(changes) {
  const missing = new Map();
  for (const u of changes.upserts) {
    if (!u.universeId) continue;
    for (const ref of collectStrings(u.data, isRef)) missing.set(idOfRef(ref), u.universeId);
  }
  const fetched = new Map();
  for (const [id, universeId] of missing) {
    if (await getImageBlob(id).catch(() => null)) continue;
    try {
      const res = await request('GET', `/api/images/${encodeURIComponent(universeId)}/${id}`);
      fetched.set(id, await res.blob());
    } catch {
      /* Image indisponible : le document arrive quand même. */
    }
  }
  await storeImages(fetched);
  const upserts = [];
  for (const u of changes.upserts) upserts.push({ ...u, data: await resolveAll(u.data) });
  return { ...changes, upserts };
}

/** Une synchronisation : le grimoire actuel est comparé à l'état connu du serveur. */
export async function syncOnce(state, userId, { confirmDeletes = false } = {}) {
  const persisted = await toPersisted(state);
  const meta = await loadKv(META_KEY).catch(() => null);
  const result = await runSync({ persisted, meta, userId, api, skip: seedSkipper(persisted), confirmDeletes });
  result.changes = await prepareChanges(result.changes);
  await saveKv(META_KEY, result.meta);
  return result;
}

/** Règle un conflit (`mine` ou `theirs`). Retourne { changes, conflict } (`conflict` : nouveau conflit éventuel). */
export async function resolveOne(conflict, choice) {
  const meta = await loadKv(META_KEY);
  // La version locale est envoyée au format de sauvegarde (images en références).
  const local = conflict.local === null ? null : (await toPersisted({ x: conflict.local })).x;
  const res = await resolveConflict({ conflict: { ...conflict, local }, choice, meta, api });
  await saveKv(META_KEY, res.meta);
  return { changes: await prepareChanges(res.changes), conflict: res.conflict };
}

/** Suppressions refusées : ces éléments seront reçus de nouveau du serveur à la synchronisation suivante. */
export async function forgetDeletions(keys) {
  const meta = await loadKv(META_KEY);
  if (!meta) return;
  for (const k of keys) delete meta.docs[k];
  meta.cursor = 0;
  await saveKv(META_KEY, meta);
}
