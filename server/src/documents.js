/**
 * Accès aux documents dans D1. Chaque écriture incrémente `version` et garde une copie dans `document_versions`.
 * Une mise à jour doit citer la version qu'elle modifie : sinon, conflit (409), et rien n'est écrasé.
 */

/** Taille maximale d'un document (D1 accepte 2 Mo par valeur ; on garde une marge). */
export const MAX_DOC_BYTES = 1_900_000;
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const row = (r) => r && { type: r.type, id: r.id, universeId: r.universe_id, campaignId: r.campaign_id, ownerId: r.owner_id, createdBy: r.created_by, version: r.version, updatedAt: r.updated_at, data: JSON.parse(r.data) };

function serialize(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'Le document doit être un objet JSON.');
  const json = JSON.stringify(data);
  if (new TextEncoder().encode(json).length > MAX_DOC_BYTES) throw new HttpError(413, 'Document trop volumineux.');
  return json;
}

export async function getDoc(db, type, id) {
  return row(await db.prepare('select * from documents where type = ? and id = ? and deleted_at is null').bind(type, id).first());
}

export async function listDocs(db, type, where, binds) {
  const { results } = await db.prepare(`select * from documents where type = ? and deleted_at is null and ${where} order by updated_at desc`).bind(type, ...binds).all();
  return results.map(row);
}

/**
 * Crée un document, et les rôles qui vont avec (`members` : requêtes préparées supplémentaires), en une transaction.
 * Un identifiant déjà pris (même par un document supprimé) est refusé : une création n'écrase jamais rien.
 */
export async function createDoc(db, { type, id, universeId = null, campaignId = null, ownerId = null, userId, data }, members = []) {
  if (!ID_PATTERN.test(id)) throw new HttpError(400, 'Identifiant invalide.');
  const json = serialize(data);
  const taken = await db.prepare('select 1 from documents where type = ? and id = ?').bind(type, id).first();
  if (taken) throw new HttpError(409, 'Cet identifiant existe déjà.');
  const now = Date.now();
  await db.batch([
    db.prepare('insert into documents (type, id, universe_id, campaign_id, owner_id, created_by, version, updated_by, updated_at, data) values (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)')
      .bind(type, id, universeId, campaignId, ownerId, userId, userId, now, json),
    db.prepare('insert into document_versions (type, id, version, updated_by, updated_at, data) values (?, ?, 1, ?, ?, ?)').bind(type, id, userId, now, json),
    ...members,
  ]);
  return getDoc(db, type, id);
}

/** Met à jour un document si `version` est bien la version actuelle ; sinon 409 avec la version du serveur. */
export async function updateDoc(db, current, { version, data, userId }) {
  if (!Number.isInteger(version)) throw new HttpError(400, 'La version modifiée est requise.');
  if (version !== current.version) throw new HttpError(409, 'Le document a changé depuis ta dernière lecture.', { current });
  const json = serialize(data);
  const next = version + 1;
  const now = Date.now();
  const [res] = await db.batch([
    db.prepare('update documents set data = ?, version = ?, updated_by = ?, updated_at = ? where type = ? and id = ? and version = ?')
      .bind(json, next, userId, now, current.type, current.id, version),
    // Copie de la ligne réellement écrite : rien n'est ajouté à l'historique si la mise à jour n'a pas eu lieu.
    db.prepare('insert or ignore into document_versions (type, id, version, updated_by, updated_at, data) select type, id, version, updated_by, updated_at, data from documents where type = ? and id = ? and version = ? and updated_at = ? and updated_by = ?')
      .bind(current.type, current.id, next, now, userId),
  ]);
  // Deux écritures simultanées : la seconde ne trouve plus la version attendue.
  if (!res.meta.changes) throw new HttpError(409, 'Le document a changé pendant l’écriture.', { current: await getDoc(db, current.type, current.id) });
  return getDoc(db, current.type, current.id);
}
