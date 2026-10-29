/**
 * Chargement paresseux des Chroniques du Combat (onze collections JSON, groupées dans un morceau à part du site) et
 * historique anti-répétition gardé dans ce navigateur. Fonctionne hors ligne : les données font partie du site.
 */
import { buildLibrary, emptyHistory } from './narrator.js';

const manifest = (Object.values(import.meta.glob('../../data/combatNarration/manifest.json', { eager: true }))[0] as { default?: object })?.default ?? {};

type Library = ReturnType<typeof buildLibrary>;

const files = import.meta.glob('../../data/combatNarration/data/*.json');
let pending: Promise<Library> | null = null;
let ready: Library | null = null;

/** Bibliothèque prête (chargée une seule fois). Une collection illisible est signalée, jamais bloquante. */
export function loadNarrations(): Promise<Library> {
  if (!pending) {
    pending = (async () => {
      const collections: Record<string, unknown> = {};
      await Promise.all(Object.entries(files).map(async ([path, load]) => {
        const name = path.split('/').pop()!.replace(/\.json$/, '');
        try {
          const mod = (await load()) as { default?: unknown };
          collections[name] = mod.default ?? mod;
        } catch (err) {
          console.warn(`Chroniques du Combat : collection « ${name} » illisible`, err);
          collections[name] = { entries: [] };
        }
      }));
      const lib = buildLibrary(collections, manifest);
      if (lib.invalid.length) console.warn(`Chroniques du Combat : ${lib.invalid.length} entrée(s) ignorée(s)`, lib.invalid.slice(0, 10));
      ready = lib;
      // Diagnostic (console) : collections chargées et entrées ignorées.
      (globalThis as { __chroniques?: unknown }).__chroniques = { counts: lib.counts, total: lib.entries.length, invalid: lib.invalid.length };
      return lib;
    })();
  }
  return pending;
}

/** La bibliothèque si elle est déjà chargée (sinon null : on narre avec le repli neutre). */
export const narrationsReady = () => ready;

/* ——— Réglages et historique ——— */

export type NarrationPrefs = { enabled: boolean; humor: boolean; animations: boolean; short: boolean };
const PREFS_KEY = 'loresmith:narration-prefs:v1';
const HISTORY_KEY = 'loresmith:narration-history:v1';
export const DEFAULT_PREFS: NarrationPrefs = { enabled: true, humor: true, animations: true, short: false };

export function loadPrefs(): NarrationPrefs {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return DEFAULT_PREFS; }
}
export function savePrefs(p: NarrationPrefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* réglage gardé pour la session */ }
}

type History = ReturnType<typeof emptyHistory>;
/** Historique d'une campagne : identifiants récents (jamais les phrases), séries de coups par combat. */
export function loadHistory(campaign: string): History {
  try {
    const all = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');
    return all[campaign] ?? emptyHistory();
  } catch { return emptyHistory(); }
}
export function saveHistory(campaign: string, h: History) {
  try {
    const all = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');
    all[campaign] = h;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
  } catch { /* historique gardé pour la session */ }
}
