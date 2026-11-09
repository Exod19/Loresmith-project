import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Identifiant de cette version du site : le commit déployé (Cloudflare Pages), sinon l'heure de la construction.
// Il est écrit dans le code et dans /version.json : un onglet resté ouvert voit qu'une nouvelle version est en ligne.
// `process` sans les types de Node (le projet ne les installe pas) : lu sur globalThis.
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const BUILD_ID = (env.CF_PAGES_COMMIT_SHA || '').slice(0, 12) || `local-${Date.now()}`

/** Écrit /version.json à côté du site construit. */
const versionFile = (): Plugin => ({
  name: 'loresmith-version',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID, builtAt: new Date().toISOString() }) })
  },
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), versionFile()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
})
