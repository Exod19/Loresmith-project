/** Types du moteur des rencontres vivantes (src/encounters/core.js, JavaScript pur). */
/** Modèle de rencontre du kit (encounter-templates.v1.json). */
export interface Template {
  id: string; name: string; kind: string; faction: string; rarity: string; locationTags: string[]; excludedTags?: string[]; zone?: string | null;
  groupMembers: { creatureId: string | null; archetypeId?: string | null; species: string; relationToLeader: string; countDice: string; displayRole?: string }[];
  initialStance?: string; primaryGoal?: string; hook?: string; exceptionId?: string | null; groupCategory?: string; [k: string]: unknown;
}
/** Exceptions nommées approuvées par le MJ, visites étrangères autorisées. */
export interface EncounterOptions {
  seed?: string; approvedExceptions?: Record<string, { enabled: boolean; approvedBy: string; namedLeader: string; rationale: string }>; allowedForeignVisits?: string[]; allowMoriExternal?: boolean;
}
export interface EncounterPlace {
  id: string; name: string; category?: string; owner?: string | null; clan?: string | null; zone?: string; tags: string[];
  traffic?: string; currentWar?: string; scenarioOnly?: boolean; needsReview?: boolean; eligibilityStatus?: string;
  sourceStatus?: string; placementStatus?: string; [k: string]: unknown;
}
export interface EncounterMember {
  creatureId: string | null; archetypeId?: string | null; species: string; relationToLeader: string; displayRole?: string;
  countDice: string; count: number; creatureName: string | null; size: string | null;
  gridFootprint: { width: number; height: number } | null; potentialLoot: string[]; lootSource: string;
  automaticLootAward: false; unresolvedStatblock: boolean;
}
export interface GeneratedEncounter {
  status: 'generated'; locationId: string; locationName: string; seed: string; templateId: string; title: string; kind: string;
  initialStance: string; groupMembers: EncounterMember[]; goals: string; hook: string;
  branches: Record<string, string>; cargo: { name: string; owner: string; type: string; isLootByDefault: boolean }[];
  aftermath: string; enforceNoAutoLoot: true; sourceStatus: string; locationStatus?: string; warnings: string[];
}
export interface RuntimeEncounterCore {
  TEMPLATES: Template[];
  CREATURE_REFS: Template[];
  classifyFeature(feature: unknown, atlas: unknown, indexes?: unknown): EncounterPlace;
  buildInventory(atlas: unknown, cities?: unknown[]): { counts: Record<string, number>; locations: EncounterPlace[]; routes: unknown[] };
  candidateEncounters(place: EncounterPlace, templates?: Template[], options?: EncounterOptions): { template: Template; validation: { allowed: boolean; reasons: string[] }; weight: number }[];
  generateEncounter(place: EncounterPlace, templates?: Template[], options?: EncounterOptions): GeneratedEncounter | { status: 'no_eligible_encounter'; locationId: string; reason: string; eligible: 0 };
  validateComposition(template: Template, place: EncounterPlace | null, options?: EncounterOptions): { allowed: boolean; reasons: string[]; exceptionApproved: boolean };
  validateAllTemplates(templates?: Template[], options?: EncounterOptions): { ok: boolean; templates: number; errors: string[] };
  diceRoll(expr: string, rng?: () => number): number;
}
export declare function createEncounterCore(options: { policy: unknown; taxonomy: unknown; templates: unknown; creatureRefs: unknown; canonLocations: unknown; npcArchetypes: unknown }): RuntimeEncounterCore;
