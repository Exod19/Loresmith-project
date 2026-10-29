/**
 * Sauvegarde locale du grimoire dans IndexedDB.
 *
 * localStorage plafonne à ~5 Mo : quelques portraits en base64 suffisaient à faire échouer
 * la sauvegarde, et tout ce qui avait été créé depuis (PNJ, créatures, campagnes) disparaissait
 * à la réouverture. IndexedDB accepte des centaines de Mo. L'ancienne clé localStorage sert
 * de reprise (migration) et de secours si IndexedDB est indisponible.
 *
 * Version 2 : un second magasin, `images`, garde les images en Blob (clé : identifiant de l'image).
 * Le grimoire n'en contient plus que les références (cf. `images.js`).
 */
const DB_NAME = 'loresmith';
const STORE = 'kv';
const IMAGES = 'images';
const KEY = 'store';
/** Copie du grimoire prise avant la migration des images, retirée une fois la migration vérifiée. */
const BACKUP_KEY = 'store-backup-images';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB indisponible'));
    const req = indexedDB.open(DB_NAME, 2);
    // Création conditionnelle : en passant de la version 1 à 2, le magasin `kv` existe déjà.
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      if (!d.objectStoreNames.contains(IMAGES)) d.createObjectStore(IMAGES);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise = null;
const db = () => (dbPromise ??= openDb());

function tx(mode, run, store = STORE) {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(store, mode);
        const req = run(t.objectStore(store));
        t.oncomplete = () => resolve(req?.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

/** Demande au navigateur de ne pas effacer les données sous pression d'espace. Vrai si c'est accordé. */
export async function askPersistence() {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    /* Navigateur sans API storage : rien à faire. */
    return false;
  }
}

/** Espace utilisé et disponible pour le site, et si le stockage est protégé de l'effacement. */
export async function storageUsage() {
  try {
    const { usage = 0, quota = 0 } = (await navigator.storage?.estimate?.()) ?? {};
    const persisted = (await navigator.storage?.persisted?.()) ?? false;
    return { usage, quota, persisted };
  } catch {
    return null;
  }
}

/* ——— Images (Blob) ——— */

export const getImageBlob = (id) => tx('readonly', (s) => s.get(id), IMAGES);
export const putImageBlob = (id, blob) => tx('readwrite', (s) => s.put(blob, id), IMAGES);
export const listImageIds = () => tx('readonly', (s) => s.getAllKeys(), IMAGES);

/* ——— Copies de sécurité (avant la migration des images, avant un import) ——— */

/** Copie prise avant chaque import d'archive : la dernière seulement. */
export const IMPORT_BACKUP_KEY = 'store-backup-import';

export const saveBackup = (state, key = BACKUP_KEY) => tx('readwrite', (s) => s.put(state, key));
export const loadBackup = (key = BACKUP_KEY) => tx('readonly', (s) => s.get(key));
export const dropBackup = (key = BACKUP_KEY) => tx('readwrite', (s) => s.delete(key));

/** Lit l'état sauvegardé : IndexedDB d'abord, puis l'ancienne sauvegarde localStorage. */
export async function loadState(legacyKey) {
  try {
    const saved = await tx('readonly', (s) => s.get(KEY));
    if (saved) return saved;
  } catch {
    /* IndexedDB indisponible : on retombe sur localStorage. */
  }
  try {
    const raw = localStorage.getItem(legacyKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Écrit l'état. IndexedDB stocke l'objet tel quel (pas de JSON) ; en cas d'échec on tente localStorage.
 * Une fois IndexedDB fiable, l'ancienne copie localStorage est retirée pour libérer le quota.
 */
export async function saveState(legacyKey, state) {
  try {
    await tx('readwrite', (s) => s.put(state, KEY));
    try {
      localStorage.removeItem(legacyKey);
    } catch {
      /* Rien à libérer. */
    }
    return;
  } catch (err) {
    try {
      localStorage.setItem(legacyKey, JSON.stringify(state));
    } catch {
      throw err;
    }
  }
}
