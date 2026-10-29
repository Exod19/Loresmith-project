/**
 * Archives de sauvegarde (.zip) : fonctions pures, testées avec `node --test`.
 *
 * Contenu d'une archive :
 *  - `manifest.json` : format, version, portée (tout, un univers, une campagne), date, type de chaque image ;
 *  - `grimoire.json` : les données de la portée, images en références `lsimg:<id>` ;
 *  - `images/<id>.<ext>` : les images elles-mêmes.
 * Un ancien fichier `.json` (images en base64) se lit toujours, comme une sauvegarde complète.
 *
 * Un import ne remplace jamais rien sans le dire : `analyzeImport` compte ce qui est nouveau, identique ou
 * différent, et `applyImport` n'écrase que si l'utilisateur a choisi « remplacer ».
 */
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { collectStrings, idOfRef, isRef, mapStrings } from './imageRefs.js';

export const FORMAT = 'loresmith';
export const ARCHIVE_VERSION = 1;

/** Collections du grimoire, indexées par identifiant. */
export const COLLECTIONS = ['universes', 'characters', 'campaigns', 'npcs', 'quests', 'assets', 'libraryEntries', 'maps', 'chatThreads'];

/** Identifiants qui ne peuvent pas être renommés (l'Atlas est reconnu par son identifiant fixe). */
const FIXED_IDS = new Set(['atlas-profondeurs']);

const pick = (dict, keep) => Object.fromEntries(Object.entries(dict || {}).filter(([, v]) => keep(v)));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Données d'une portée. Seules les clés connues du grimoire sont copiées : rien d'autre ne peut fuiter
 * dans une archive (les clés d'IA, elles, ne sont jamais dans le grimoire).
 * - `all` : tout le grimoire ;
 * - `universe` : l'univers et tout ce qui lui est rattaché (`universeId`) ;
 * - `campaign` : la campagne, ses fils de discussion et quêtes, les PNJ et fiches de bibliothèque qui lui sont liés,
 *   et les images de tout cela. L'univers n'est pas inclus : la campagne s'importe dans l'univers actif.
 */
export function selectScope(state, scope) {
  const s = state || {};
  if (scope.kind === 'all') {
    const out = {};
    for (const c of COLLECTIONS) out[c] = s[c] || {};
    out.activeUniverseId = s.activeUniverseId ?? null;
    out.combat = s.combat || { combatants: [], round: 1 };
    out.log = s.log || [];
    return out;
  }
  if (scope.kind === 'universe') {
    const mine = (v) => v?.universeId === scope.id;
    const out = { universes: pick(s.universes, (u) => u.id === scope.id) };
    for (const c of COLLECTIONS.slice(1)) out[c] = pick(s[c], mine);
    out.log = (s.log || []).filter(mine);
    return out;
  }
  if (scope.kind === 'campaign') {
    const camp = s.campaigns?.[scope.id];
    if (!camp) return { campaigns: {} };
    const sceneIds = new Set((camp.scenes || []).map((sc) => sc.id));
    const npcs = pick(s.npcs, (n) => (n.campaignIds || []).includes(camp.id) || (n.linkedSceneIds || []).some((id) => sceneIds.has(id)));
    const libraryEntries = pick(s.libraryEntries, (e) => (e.linkedCampaignIds || []).includes(camp.id));
    const owners = new Set([camp.id, ...Object.keys(npcs), ...Object.keys(libraryEntries)]);
    return {
      campaigns: { [camp.id]: camp },
      chatThreads: pick(s.chatThreads, (t) => t.campaignId === camp.id),
      quests: pick(s.quests, (q) => q.campaignId === camp.id),
      npcs,
      libraryEntries,
      assets: pick(s.assets, (a) => owners.has(a.targetId)),
    };
  }
  throw new Error('Portée inconnue : ' + scope.kind);
}

/** Identifiants des images référencées par des données. */
export const imageIdsOf = (data) => collectStrings(data, isRef).map(idOfRef);

const EXT = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif' };

/** Construit l'archive. `images` : Map id → { type, bytes (Uint8Array) }. */
export function buildArchive({ data, scope, images = new Map(), label = '', exportedAt = new Date().toISOString() }) {
  const manifest = { format: FORMAT, version: ARCHIVE_VERSION, scope, label, exportedAt, images: {} };
  const files = {};
  for (const [id, img] of images) {
    const path = `images/${id}.${EXT[img.type] || 'bin'}`;
    manifest.images[id] = { path, type: img.type };
    // Images déjà compressées (WebP, JPEG…) : stockées telles quelles.
    files[path] = [img.bytes, { level: 0 }];
  }
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  files['grimoire.json'] = strToU8(JSON.stringify(data, null, 2));
  return zipSync(files, { level: 6 });
}

const isZip = (bytes) => bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b;

/**
 * Lit une archive (.zip) ou une ancienne sauvegarde (.json).
 * Retourne { manifest, data, images: Map id → { type, bytes } }.
 */
export function readArchive(bytes) {
  if (!isZip(bytes)) {
    let data;
    try {
      data = JSON.parse(strFromU8(bytes));
    } catch {
      throw new Error('Fichier illisible : ni archive .zip, ni sauvegarde .json.');
    }
    if (!data || !data.universes) throw new Error('Sauvegarde .json de structure inconnue.');
    return { manifest: { format: FORMAT, version: 0, scope: { kind: 'all' }, legacy: true }, data, images: new Map() };
  }
  let files;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('Archive .zip endommagée.');
  }
  if (!files['manifest.json'] || !files['grimoire.json']) throw new Error('Cette archive ne vient pas de Loresmith.');
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  if (manifest.format !== FORMAT) throw new Error('Cette archive ne vient pas de Loresmith.');
  if (manifest.version > ARCHIVE_VERSION) throw new Error('Archive créée par une version plus récente de Loresmith.');
  const data = JSON.parse(strFromU8(files['grimoire.json']));
  const images = new Map();
  for (const [id, img] of Object.entries(manifest.images || {})) {
    if (files[img.path]) images.set(id, { type: img.type, bytes: files[img.path] });
  }
  return { manifest, data, images };
}

/**
 * Bilan d'un import, avant de l'appliquer : pour chaque élément, nouveau, identique à l'existant, ou différent.
 * `current` et `data` doivent être comparables (images résolues de la même façon).
 */
export function analyzeImport(current, data) {
  const report = { added: 0, identical: 0, different: 0, byCollection: {} };
  for (const c of COLLECTIONS) {
    const incoming = data[c];
    if (!incoming) continue;
    const r = { added: 0, identical: 0, different: 0 };
    for (const [id, v] of Object.entries(incoming)) {
      const cur = current?.[c]?.[id];
      if (!cur) r.added++;
      else if (same(cur, v)) r.identical++;
      else r.different++;
    }
    report.byCollection[c] = r;
    report.added += r.added;
    report.identical += r.identical;
    report.different += r.different;
  }
  return report;
}

/** Nouvel identifiant, au format des identifiants existants. */
export const freshId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

/**
 * Donne de nouveaux identifiants à tous les éléments importés, et met à jour toutes les références
 * (univers d'un PNJ, cible d'une image, campagnes liées…). Les identifiants fixes ne changent pas.
 */
export function remapIds(data, newId = freshId) {
  const map = new Map();
  for (const c of COLLECTIONS) for (const id of Object.keys(data[c] || {})) if (!FIXED_IDS.has(id) && !map.has(id)) map.set(id, newId());
  const renamed = mapStrings(data, (s) => map.get(s) ?? s);
  const out = { ...renamed };
  for (const c of COLLECTIONS) if (renamed[c]) out[c] = Object.fromEntries(Object.entries(renamed[c]).map(([k, v]) => [map.get(k) ?? k, v]));
  return { data: out, map };
}

/**
 * Applique un import et retourne le nouveau grimoire, sans modifier `current`.
 * - `merge` : ajoute ce qui manque ; un élément déjà présent n'est jamais écrasé (même s'il diffère) ;
 * - `copy` : importe tout comme une copie, avec de nouveaux identifiants ; rien n'est écrasé ;
 * - `replace` : remplace ce que couvre la portée (tout le grimoire, l'univers, ou les éléments de la campagne).
 * Une campagne est rattachée à l'univers actif (`targetUniverseId`).
 * Retourne { state, kept } : `kept` liste les éléments présents des deux côtés qui ont été conservés tels quels.
 */
export function applyImport(current, data, { mode, scope, targetUniverseId, newId = freshId }) {
  let incoming = data;
  if (scope.kind === 'campaign' && scope.universeId && targetUniverseId) {
    const from = scope.universeId;
    incoming = mapStrings(incoming, (s) => (s === from ? targetUniverseId : s));
  }
  if (mode === 'copy') incoming = remapIds(incoming, newId).data;

  if (mode === 'replace' && scope.kind === 'all') {
    const state = {};
    for (const c of COLLECTIONS) state[c] = incoming[c] || {};
    state.activeUniverseId = incoming.activeUniverseId ?? Object.keys(state.universes)[0] ?? null;
    state.combat = incoming.combat || { combatants: [], round: 1 };
    state.log = incoming.log || [];
    return { state: { ...current, ...state }, kept: [] };
  }

  const state = { ...current };
  const kept = [];
  if (mode === 'replace' && scope.kind === 'universe') {
    // Ce qui appartenait à l'univers et n'est plus dans l'archive est retiré (une copie de sécurité est faite avant).
    for (const c of COLLECTIONS) state[c] = pick(state[c], (v) => v?.universeId !== scope.id && !(c === 'universes' && v?.id === scope.id));
    state.log = (state.log || []).filter((l) => l.universeId !== scope.id);
  }
  for (const c of COLLECTIONS) {
    if (!incoming[c]) continue;
    const next = { ...(state[c] || {}) };
    for (const [id, v] of Object.entries(incoming[c])) {
      if (next[id] && mode !== 'replace') {
        if (!same(next[id], v)) kept.push({ collection: c, id });
        continue;
      }
      next[id] = v;
    }
    state[c] = next;
  }
  if (incoming.log) {
    const seen = new Set((state.log || []).map((l) => l.id));
    state.log = [...(state.log || []), ...incoming.log.filter((l) => !seen.has(l.id))].slice(0, 200);
  }
  if (!state.activeUniverseId || !state.universes?.[state.activeUniverseId]) state.activeUniverseId = Object.keys(state.universes || {})[0] ?? null;
  return { state, kept };
}

/** Nom de fichier de l'archive. */
export function archiveName(label, date = new Date()) {
  const slug = String(label || 'grimoire')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `loresmith-${slug || 'grimoire'}-${date.toISOString().slice(0, 10)}.zip`;
}
