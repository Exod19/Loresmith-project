/**
 * Sauvegarde locale du grimoire dans IndexedDB.
 *
 * localStorage plafonne à ~5 Mo : quelques portraits en base64 suffisaient à faire échouer
 * la sauvegarde, et tout ce qui avait été créé depuis (PNJ, créatures, campagnes) disparaissait
 * à la réouverture. IndexedDB accepte des centaines de Mo. L'ancienne clé localStorage sert
 * de reprise (migration) et de secours si IndexedDB est indisponible.
 */
const DB_NAME = 'loresmith';
const STORE = 'kv';
const KEY = 'store';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB indisponible'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise = null;
const db = () => (dbPromise ??= openDb());

function tx(mode, run) {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        t.oncomplete = () => resolve(req?.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

/** Demande au navigateur de ne pas effacer les données sous pression d'espace. */
export function askPersistence() {
  try {
    navigator.storage?.persist?.();
  } catch {
    /* Navigateur sans API storage : rien à faire. */
  }
}

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
