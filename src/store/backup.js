/**
 * Export et import d'archives dans le navigateur : lien entre `archive.js` (pur), les images et le disque.
 */
import { IMPORT_BACKUP_KEY, getImageBlob, saveBackup } from './persist';
import { resolveAll, storeImages, toPersisted } from './images';
import { analyzeImport, applyImport, archiveName, buildArchive, imageIdsOf, readArchive, selectScope } from './archive';

/** Télécharge l'archive d'une portée (`all`, `universe`, `campaign`). */
export async function exportArchive(state, scope, label) {
  const data = selectScope(await toPersisted(state), scope);
  const images = new Map();
  for (const id of imageIdsOf(data)) {
    const blob = await getImageBlob(id).catch(() => null);
    if (blob) images.set(id, { type: blob.type, bytes: new Uint8Array(await blob.arrayBuffer()) });
  }
  const zip = buildArchive({ data, scope, images, label });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
  a.download = archiveName(label);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return { images: images.size };
}

/**
 * Lit un fichier choisi par l'utilisateur et prépare l'import, sans rien changer au grimoire :
 * les images reçues sont rangées (jamais par-dessus une image existante), les données sont rendues
 * comparables au grimoire en mémoire, et le bilan est calculé.
 */
export async function prepareImport(file, current) {
  const { manifest, data, images } = readArchive(new Uint8Array(await file.arrayBuffer()));
  await storeImages(new Map([...images].map(([id, img]) => [id, new Blob([img.bytes], { type: img.type })])));
  // Ancienne sauvegarde .json : ses images base64 sont rangées comme les autres.
  const live = await resolveAll(await toPersisted(data));
  return { manifest, data: live, report: analyzeImport(current, live) };
}

/** Applique l'import choisi. Le grimoire actuel est d'abord copié (clé `store-backup-import`). */
export async function commitImport(current, prepared, mode) {
  await saveBackup(await toPersisted(current), IMPORT_BACKUP_KEY);
  return applyImport(current, prepared.data, { mode, scope: prepared.manifest.scope, targetUniverseId: current.activeUniverseId });
}
