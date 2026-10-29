/**
 * Rencontres vivantes Underdark : chargement paresseux du moteur et de ses données (un morceau à part du site),
 * une seule fois. Aucun appel réseau par tirage ; tout fonctionne hors ligne.
 */
import { createEncounterCore, type RuntimeEncounterCore } from './core.js';

export type { RuntimeEncounterCore, EncounterPlace, GeneratedEncounter, EncounterMember } from './core.js';

let pending: Promise<RuntimeEncounterCore> | null = null;
let ready: RuntimeEncounterCore | null = null;

const files = import.meta.glob('./data/*.json');
const load = async (name: string) => {
  const mod = (await files[`./data/${name}.v1.json`]()) as { default?: unknown };
  return mod.default ?? mod;
};

/** Moteur prêt (données chargées à la première demande). */
export function loadEncounterCore(): Promise<RuntimeEncounterCore> {
  if (!pending) {
    pending = (async () => {
      const [policy, taxonomy, templates, creatureRefs, canonLocations, npcArchetypes] = await Promise.all(
        ['association-policy', 'location-taxonomy', 'encounter-templates', 'creature-refs', 'canon-locations', 'npc-archetypes'].map(load),
      );
      ready = createEncounterCore({ policy, taxonomy, templates, creatureRefs, canonLocations, npcArchetypes });
      return ready;
    })();
  }
  return pending;
}

export const encounterCoreReady = () => ready;
