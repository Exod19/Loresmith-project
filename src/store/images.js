/**
 * Images du grimoire hors de l'état principal.
 *
 * - Sauvegarde : chaque image base64 devient un Blob du magasin `images`, et l'état sauvegardé n'en garde
 *   que la référence (`lsimg:<id>`). Écrire le grimoire ne recopie donc plus les images.
 * - Chargement : les références deviennent des URL `blob:`, affichables partout comme avant.
 * - Export : les Blob sont rangés dans l'archive .zip (cf. `backup.js`).
 *
 * La première ouverture migre les sauvegardes existantes (cf. `openGrimoire`).
 */
import { dropBackup, getImageBlob, putImageBlob, saveBackup, saveState } from './persist';
import { collectStrings, extractImages, hasDataImages, idOfRef, isDataImage, isRef, resolveRefs, toRefs } from './imageRefs';

const urlById = new Map();
const idByUrl = new Map();
/** Data URL déjà écrite en Blob : la sauvegarde suivante ne la reconvertit pas. */
const written = new Map();

async function putImage(id, blob) {
  const existing = await getImageBlob(id);
  if (!existing) await putImageBlob(id, blob);
}

function urlOf(id, blob) {
  if (!urlById.has(id)) {
    const url = URL.createObjectURL(blob);
    urlById.set(id, url);
    idByUrl.set(url, id);
  }
  return urlById.get(id);
}

/** Lit les Blob des références de l'état et les remplace par des URL affichables. */
export async function resolveAll(state) {
  for (const ref of collectStrings(state, isRef)) {
    const id = idOfRef(ref);
    if (urlById.has(id)) continue;
    try {
      const blob = await getImageBlob(id);
      if (blob) urlOf(id, blob);
    } catch {
      /* Image illisible : la référence reste, l'image ne s'affiche pas. */
    }
  }
  return resolveRefs(state, (id) => urlById.get(id));
}

/**
 * Prépare un grimoire lu sur le disque. S'il contient encore des images base64 (sauvegarde d'avant le lot 1),
 * il est migré : copie de sécurité, écriture des Blob, vérification de chaque Blob, écriture du grimoire allégé,
 * et seulement ensuite retrait de la copie. En cas d'échec, le grimoire d'origine reste tel quel.
 */
export async function openGrimoire(raw, storeKey) {
  if (!raw || !hasDataImages(raw)) return resolveAll(raw);
  try {
    await saveBackup(raw);
    const { state, ids } = await extractImages(raw, putImage, written);
    for (const id of ids) {
      const blob = await getImageBlob(id);
      if (!blob || !blob.size) throw new Error('Image non relue après écriture : ' + id);
    }
    await saveState(storeKey, state);
    await dropBackup();
    return resolveAll(state);
  } catch {
    // Migration impossible (IndexedDB indisponible, quota…) : on continue avec les images en base64, comme avant.
    return raw;
  }
}

/**
 * État à écrire sur le disque : URL `blob:` connues → références, images base64 nouvelles → Blob.
 * Une image qui ne peut pas être écrite reste en base64 dans la sauvegarde.
 */
export async function toPersisted(state) {
  const refs = toRefs(state, (url) => idByUrl.get(url));
  if (!collectStrings(refs, isDataImage).length) return refs;
  try {
    return (await extractImages(refs, putImage, written)).state;
  } catch {
    return refs;
  }
}

/** Écrit des images reçues (import d'une archive) : Map id → Blob. */
export async function storeImages(images) {
  for (const [id, blob] of images) await putImage(id, blob);
}
