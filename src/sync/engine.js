/**
 * Moteur de synchronisation (lot 5). Pur : le serveur est injecté (`api`), ce qui permet de le tester
 * contre le vrai Worker sans navigateur.
 *
 * Principes :
 * - le grimoire local reste la copie de travail ; rien n'est synchronisé en temps réel ;
 * - chaque document garde, dans `meta`, la version du serveur et l'empreinte du contenu au dernier échange ;
 * - ce qui a changé localement depuis est envoyé avec la version lue ; si le serveur a changé entre-temps (409),
 *   ou si les deux côtés ont changé, c'est un **conflit** : l'utilisateur choisit la version à garder ;
 * - hors ligne, rien n'est perdu : les écarts restent visibles à la synchronisation suivante, qui les rejoue.
 */
import { documentsOf } from '../shared/schema.js';
import { collectStrings, idOfRef, isRef } from '../store/imageRefs.js';

export const keyOf = (type, id) => `${type}:${id}`;
export const emptyMeta = (userId) => ({ userId, cursor: 0, docs: {}, images: {}, universes: {}, detached: {} });

/** Empreinte rapide (cyrb53) du contenu d'un document. */
export function hashOf(data) {
  const str = JSON.stringify(data ?? null);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Ordre d'envoi : un univers avant ce qu'il contient, une campagne avant ses discussions. */
const ORDER = { universe: 0, campaign: 1, userState: 9 };
const byOrder = (a, b) => (ORDER[a.type] ?? 5) - (ORDER[b.type] ?? 5);

const isNetwork = (e) => !e?.status;

/** Images référencées par un document, à envoyer avant lui (une seule fois par univers). */
async function uploadImages(doc, meta, api) {
  if (!doc.universeId) return;
  for (const ref of collectStrings(doc.data, isRef)) {
    const k = `${doc.universeId}:${idOfRef(ref)}`;
    if (meta.images[k]) continue;
    try {
      await api.uploadImage(doc.universeId, idOfRef(ref));
      meta.images[k] = true;
    } catch (e) {
      if (isNetwork(e)) throw e;
      // Image absente localement ou refusée : le document part quand même, l'image ne s'affichera pas ailleurs.
    }
  }
}

/**
 * Une synchronisation complète : réception, puis envoi.
 * - `persisted` : grimoire local au format de sauvegarde (images en références) ;
 * - `skip(doc)` : documents à ne pas envoyer (ex. l'univers d'exemple jamais modifié) ;
 * - `confirmDeletes` : au-delà de `deleteThreshold` suppressions, elles attendent la confirmation de l'utilisateur.
 * Retourne { meta, changes: { upserts, deletes }, conflicts, pendingDeletes, offline, signedOut, stats }.
 */
export async function runSync({ persisted, meta: before, userId, api, skip = () => false, confirmDeletes = false, deleteThreshold = 5 }) {
  const meta = { ...emptyMeta(userId), ...structuredClone(before?.userId === userId ? before : emptyMeta(userId)) };
  const result = { meta, changes: { upserts: [], deletes: [] }, conflicts: [], pendingDeletes: null, offline: false, signedOut: false, joined: [], lostAccess: [], stats: { pulled: 0, pushed: 0, deleted: 0 } };
  const local = new Map(documentsOf(persisted, userId).docs.map((d) => [keyOf(d.type, d.id), d]));
  const handled = new Set();

  /* ——— Réception ——— */
  let pulled;
  try {
    pulled = await api.pull(meta.cursor);
  } catch (e) {
    if (e?.status === 401) result.signedOut = true;
    else result.offline = isNetwork(e);
    if (!result.offline && !result.signedOut) throw e;
    return result;
  }

  // Univers rejoints depuis la dernière fois : tout leur contenu existant est reçu (pas seulement les changements récents).
  const known = meta.universes || {};
  const now = pulled.universes || {};
  result.joined = Object.keys(now).filter((u) => !(u in known));
  result.lostAccess = Object.keys(known).filter((u) => !(u in now));
  if (result.joined.length && meta.cursor > 0) {
    try {
      pulled = { ...(await api.pull(0)), universes: now };
    } catch (e) {
      result.offline = isNetwork(e);
      if (!result.offline) throw e;
      return result;
    }
  }
  for (const u of result.joined) delete meta.detached[u];
  // Accès perdu (retiré de l'univers) : la copie locale reste, mais elle n'est plus envoyée.
  for (const u of result.lostAccess) {
    meta.detached[u] = true;
    for (const [key, m] of Object.entries(meta.docs)) if (m.u === u) delete meta.docs[key];
  }
  meta.universes = now;

  for (const r of pulled.docs) {
    const key = keyOf(r.type, r.id);
    const m = meta.docs[key];
    if (m && r.version <= m.v) continue;
    const mine = local.get(key);
    const mineHash = mine ? hashOf(mine.data) : null;
    // Premier échange de cet appareil : l'état du compte (combat, journal) reçu l'emporte sur celui, vierge, de l'appareil.
    const untouched = m ? mineHash === m.h : !mine || r.type === 'userState';
    handled.add(key);
    if (untouched || (!r.deleted && mine && mineHash === hashOf(r.data))) {
      if (r.deleted) {
        if (mine) result.changes.deletes.push({ type: r.type, id: r.id });
        local.delete(key);
        delete meta.docs[key];
      } else {
        result.changes.upserts.push({ type: r.type, id: r.id, universeId: r.universeId, data: r.data });
        local.set(key, { ...r });
        meta.docs[key] = { v: r.version, h: hashOf(r.data), u: r.universeId };
      }
      result.stats.pulled++;
    } else if (r.deleted && !mine) {
      delete meta.docs[key];
    } else {
      result.conflicts.push({ key, type: r.type, id: r.id, universeId: r.universeId, campaignId: r.campaignId, local: mine?.data ?? null, remote: r });
    }
  }
  meta.cursor = pulled.serverTime;

  /* ——— Envoi ——— */
  try {
    for (const doc of [...local.values()].sort(byOrder)) {
      const key = keyOf(doc.type, doc.id);
      if (handled.has(key) && !meta.docs[key]) continue;
      const m = meta.docs[key];
      const h = hashOf(doc.data);
      if ((m && m.h === h) || result.conflicts.some((c) => c.key === key) || (!m && skip(doc)) || meta.detached[doc.universeId]) continue;
      await uploadImages(doc, meta, api);
      try {
        const res = await api.put({ type: doc.type, id: doc.id, universeId: doc.universeId, campaignId: doc.campaignId, version: m ? m.v : 0, data: doc.data });
        meta.docs[key] = { v: res.version, h, u: doc.universeId };
        result.stats.pushed++;
      } catch (e) {
        if (isNetwork(e)) throw e;
        if (e.status === 409) result.conflicts.push({ key, type: doc.type, id: doc.id, universeId: doc.universeId, campaignId: doc.campaignId, local: doc.data, remote: e.body?.current ?? null });
        else result.conflicts.push({ key, type: doc.type, id: doc.id, universeId: doc.universeId, campaignId: doc.campaignId, local: doc.data, remote: null, refused: e.status, message: e.body?.error });
      }
    }

    // Suppressions locales : connues du serveur, absentes du grimoire. Enfants d'abord, univers en dernier.
    const gone = Object.keys(meta.docs)
      .filter((key) => !local.has(key) && !handled.has(key))
      .map((key) => ({ key, type: key.slice(0, key.indexOf(':')), id: key.slice(key.indexOf(':') + 1) }))
      .sort((a, b) => byOrder(b, a));
    if (gone.length > deleteThreshold && !confirmDeletes) result.pendingDeletes = gone;
    else {
      for (const g of gone) {
        try {
          await api.remove(g.type, g.id, meta.docs[g.key].v);
          delete meta.docs[g.key];
          result.stats.deleted++;
        } catch (e) {
          if (isNetwork(e)) throw e;
          if (e.status === 404) delete meta.docs[g.key];
          else result.conflicts.push({ key: g.key, type: g.type, id: g.id, local: null, remote: e.body?.current ?? null, refused: e.status === 409 ? undefined : e.status, message: e.body?.error });
        }
      }
    }
  } catch (e) {
    if (!isNetwork(e)) throw e;
    // Réseau coupé en cours d'envoi : ce qui est parti est noté, le reste repartira la prochaine fois.
    result.offline = true;
  }
  return result;
}

/**
 * Règle un conflit. `mine` : la version locale est envoyée par-dessus celle du serveur (dont la version est citée) ;
 * `theirs` : la version du serveur remplace la locale. Retourne { meta, changes, conflict } (`conflict` : un nouveau
 * conflit si le serveur a encore changé entre-temps).
 */
export async function resolveConflict({ conflict, choice, meta: before, api }) {
  const meta = structuredClone(before);
  const changes = { upserts: [], deletes: [] };
  const { key, type, id, local, remote } = conflict;
  if (choice === 'theirs') {
    if (!remote || remote.deleted) {
      changes.deletes.push({ type, id });
      delete meta.docs[key];
    } else {
      changes.upserts.push({ type, id, universeId: remote.universeId, data: remote.data });
      meta.docs[key] = { v: remote.version, h: hashOf(remote.data), u: remote.universeId };
    }
    return { meta, changes, conflict: null };
  }
  try {
    if (local === null) {
      if (remote && !remote.deleted) await api.remove(type, id, remote.version);
      delete meta.docs[key];
    } else {
      const doc = { type, id, universeId: conflict.universeId ?? remote?.universeId, campaignId: conflict.campaignId ?? remote?.campaignId ?? null, data: local };
      await uploadImages(doc, meta, api);
      const res = await api.put({ ...doc, version: remote ? remote.version : 0 });
      meta.docs[key] = { v: res.version, h: hashOf(local), u: doc.universeId };
    }
    return { meta, changes, conflict: null };
  } catch (e) {
    if (e?.status === 409) return { meta, changes, conflict: { ...conflict, remote: e.body?.current ?? null } };
    throw e;
  }
}
