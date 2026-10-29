/**
 * Stockage des fichiers (images partagées, sauvegardes de la base) dans Workers KV.
 *
 * R2 était prévu, mais son activation exige un moyen de paiement : KV reste gratuit (1 Go, 1 000 écritures
 * par jour, 25 Mo par valeur), ce qui suffit pour quelques MJ. L'interface ci-dessous imite le peu de R2 que le
 * serveur utilise ; passer à R2 plus tard ne changera que ce fichier.
 */
export function blobStore(env) {
  const kv = env.BLOBS;
  if (!kv) throw new Error('Stockage BLOBS absent (voir wrangler.toml).');
  return {
    async put(key, bytes, { contentType } = {}) {
      await kv.put(key, bytes, { metadata: { type: contentType || 'application/octet-stream' } });
    },
    /** { bytes, type } ou null. */
    async get(key) {
      const { value, metadata } = await kv.getWithMetadata(key, 'arrayBuffer');
      return value ? { bytes: new Uint8Array(value), type: metadata?.type || 'application/octet-stream' } : null;
    },
    /** Toutes les clés qui commencent par `prefix`. */
    async keys(prefix) {
      const keys = [];
      let cursor;
      do {
        const page = await kv.list({ prefix, cursor });
        keys.push(...page.keys.map((k) => k.name));
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      return keys;
    },
    async delete(keys) {
      for (const k of keys) await kv.delete(k);
    },
  };
}
