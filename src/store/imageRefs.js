/**
 * Références d'images du grimoire : fonctions pures, sans navigateur (testées avec `node --test`).
 *
 * Dans la sauvegarde, une image n'est plus une data URL en base64 mais une référence `lsimg:<id>`,
 * l'image elle-même étant un Blob du magasin IndexedDB `images`. En mémoire, la référence est remplacée
 * par une URL `blob:` : le reste de l'application continue de manipuler une simple chaîne affichable.
 *
 * Le parcours est générique (toutes les chaînes de l'état) plutôt qu'une liste de champs : aucune image
 * oubliée (portraits, jetons, cartes, combattants, héros séparés…), et les chemins publics ou les URL
 * https ne sont jamais touchés.
 */
export const REF_PREFIX = 'lsimg:';

export const isDataImage = (v) => typeof v === 'string' && v.startsWith('data:image/');
export const isRef = (v) => typeof v === 'string' && v.startsWith(REF_PREFIX);
export const refOf = (id) => REF_PREFIX + id;
export const idOfRef = (ref) => ref.slice(REF_PREFIX.length);

const isPlain = (v) => v !== null && typeof v === 'object' && (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype);

/**
 * Applique `fn` à chaque chaîne de l'état. Ce qui ne change pas est réutilisé tel quel (même objet),
 * ce qui garde le partage de structure et évite de recopier tout le grimoire.
 */
export function mapStrings(value, fn) {
  if (typeof value === 'string') return fn(value);
  if (!isPlain(value)) return value;
  if (Array.isArray(value)) {
    let out = null;
    for (let i = 0; i < value.length; i++) {
      const next = mapStrings(value[i], fn);
      if (next !== value[i]) (out ??= value.slice())[i] = next;
    }
    return out ?? value;
  }
  let out = null;
  for (const k of Object.keys(value)) {
    const next = mapStrings(value[k], fn);
    if (next !== value[k]) (out ??= { ...value })[k] = next;
  }
  return out ?? value;
}

/** Toutes les chaînes de l'état qui vérifient `test`, sans doublon. */
export function collectStrings(value, test) {
  const found = new Set();
  mapStrings(value, (s) => {
    if (test(s)) found.add(s);
    return s;
  });
  return [...found];
}

export const hasDataImages = (state) => collectStrings(state, isDataImage).length > 0;

/** Data URL en Blob (base64 ou texte encodé, comme une image SVG). */
export function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('Data URL illisible.');
  const head = dataUrl.slice(5, comma);
  const body = dataUrl.slice(comma + 1);
  const type = head.split(';')[0] || 'application/octet-stream';
  if (/;base64$/i.test(head)) {
    const bin = atob(body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type });
  }
  return new Blob([decodeURIComponent(body)], { type });
}

/** Blob en data URL base64 (export, retour arrière). Fonctionne aussi hors navigateur. */
export async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}

/** Identifiant d'image : empreinte SHA-256 du contenu. Une même image n'est stockée qu'une fois. */
export async function imageIdOf(blob) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
  return Array.from(digest.subarray(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sort les images base64 de l'état. `put(id, blob)` les écrit (magasin `images`).
 * Retourne l'état avec des références, et la liste des identifiants écrits.
 * Une image qui ne peut pas être écrite reste en base64 : rien n'est perdu.
 * `cache` (facultatif) évite de convertir deux fois la même chaîne d'une sauvegarde à l'autre.
 */
export async function extractImages(state, put, cache = new Map()) {
  const ids = new Map();
  for (const dataUrl of collectStrings(state, isDataImage)) {
    let id = cache.get(dataUrl);
    if (!id) {
      try {
        const blob = dataUrlToBlob(dataUrl);
        id = await imageIdOf(blob);
        await put(id, blob);
        cache.set(dataUrl, id);
      } catch {
        continue;
      }
    }
    ids.set(dataUrl, id);
  }
  return { state: mapStrings(state, (s) => (ids.has(s) ? refOf(ids.get(s)) : s)), ids: [...new Set(ids.values())] };
}

/** Références en URL affichables (`urlOf(id)`). Une référence sans image connue reste telle quelle. */
export function resolveRefs(state, urlOf) {
  return mapStrings(state, (s) => (isRef(s) ? urlOf(idOfRef(s)) ?? s : s));
}

/** URL affichables (`blob:`) en références, pour la sauvegarde. `idOfUrl` renvoie l'identifiant connu. */
export function toRefs(state, idOfUrl) {
  return mapStrings(state, (s) => {
    if (!s.startsWith('blob:')) return s;
    const id = idOfUrl(s);
    return id ? refOf(id) : s;
  });
}

/**
 * Retour au format d'origine : chaque référence redevient une data URL base64.
 * Sert à l'export JSON et rend la migration réversible. `get(id)` lit le Blob.
 */
export async function inlineRefs(state, get) {
  const urls = new Map();
  for (const ref of collectStrings(state, isRef)) {
    const blob = await get(idOfRef(ref));
    if (blob) urls.set(ref, await blobToDataUrl(blob));
  }
  return mapStrings(state, (s) => urls.get(s) ?? s);
}

/** Dimensions réduites pour que le plus grand côté tienne dans `max` (jamais agrandies). */
export function fitWithin(width, height, max) {
  const scale = Math.min(1, max / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Plus grand côté selon l'usage : portraits et jetons ≈ 512 px, cartes ≈ 1600 px, illustrations 1024 px. */
export const IMAGE_MAX = { portrait: 512, illustration: 1024, carte: 1600 };
