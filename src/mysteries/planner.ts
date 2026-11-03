/**
 * Planificateur du Fil des Mystères (kit v3, annexe B) : validation de l'arc, propositions de placement motivées,
 * couverture des verrous (prêt, à risque, bloqué, inconnu), cycle de vie des indices en séance et report d'une
 * information manquée. Fonctions pures : elles rendent un nouvel arc et ne publient jamais rien sans le MJ.
 *
 * Règles de continuité tenues ici :
 *  - un indice déjà présenté, aperçu ou pris n'est jamais déplacé : on ajoute une seconde source distincte ;
 *  - un objet unique n'est jamais dupliqué ;
 *  - aucune scène déjà jouée n'est réécrite ;
 *  - toute action porte une clé d'idempotence : rejouée, elle ne fait rien de plus.
 */
import type { ArcEvent, ClueDesign, ClueManifestation, Gate, KnowledgeAtom, ManifestationState, Medium, MysteryArc, SceneRef, SceneSlot } from './types';
import { MEDIUM_LABEL } from './types';

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

/** Manifestations encore en jeu (ni retirées, ni détruites, ni manquées). */
const ACTIVE: ManifestationState[] = ['slotted', 'presented', 'noticed', 'inspected', 'collected'];
/** Le groupe a eu l'indice sous les yeux (on ne peut plus le déplacer). */
const EXPOSED: ManifestationState[] = ['presented', 'noticed', 'inspected', 'collected'];
/** Le groupe en a tiré l'information. */
const LEARNED: ManifestationState[] = ['noticed', 'inspected', 'collected'];

export const isActive = (m: ClueManifestation) => ACTIVE.includes(m.state);
export const isExposed = (m: ClueManifestation) => EXPOSED.includes(m.state);

/** Chronologie prévue : l'ordre des scènes dans la campagne. */
export function sceneOrder(scenes: SceneRef[]) {
  return new Map(scenes.map((s, i) => [s.id, i]));
}

const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));

/** Échéance d'un fait : la première scène où un verrou qui l'exige est affronté. */
export function deadlineOf(arc: MysteryArc, atomId: string, order: Map<string, number>): number {
  let d = Infinity;
  for (const g of arc.gates) if (g.requiredAtomIds.includes(atomId) && order.has(g.targetSceneId)) d = Math.min(d, order.get(g.targetSceneId)!);
  return d;
}

/* ——— Validation (structure, références, logique de campagne) ——— */

export type Issue = { level: 'bloquant' | 'attention'; text: string };

export function validateArc(arc: MysteryArc, scenes: SceneRef[]): Issue[] {
  const out: Issue[] = [];
  const bad = (text: string) => out.push({ level: 'bloquant', text });
  const warn = (text: string) => out.push({ level: 'attention', text });
  const atoms = byId(arc.knowledgeAtoms), designs = byId(arc.clueDesigns), slots = byId(arc.sceneSlots);
  const order = sceneOrder(scenes);
  const ids = [...arc.knowledgeAtoms, ...arc.clueDesigns, ...arc.sceneSlots, ...arc.manifestations, ...arc.gates].map((x) => x.id);
  if (new Set(ids).size !== ids.length) bad('Deux éléments portent le même identifiant.');
  for (const d of arc.clueDesigns) {
    if (!d.knowledgeAtomIds.length) warn(`« ${d.title} » n’enseigne aucun fait.`);
    d.knowledgeAtomIds.filter((a) => !atoms.has(a)).forEach(() => bad(`« ${d.title} » renvoie à un fait supprimé.`));
  }
  for (const s of arc.sceneSlots) if (!order.has(s.sceneId)) bad(`L’emplacement « ${s.label} » est dans une scène qui n’existe plus.`);
  for (const m of arc.manifestations) {
    const d = designs.get(m.clueDesignId), s = slots.get(m.slotId);
    if (!d || !s) { bad('Un indice placé renvoie à un support ou un emplacement supprimé.'); continue; }
    if (isActive(m) && s.allowedMedia.length && !s.allowedMedia.includes(d.media)) bad(`« ${d.title} » (${MEDIUM_LABEL[d.media]}) ne convient pas à « ${s.label} ».`);
  }
  for (const s of arc.sceneSlots) {
    const n = arc.manifestations.filter((m) => m.slotId === s.id && isActive(m)).length;
    if (n > s.capacity) bad(`« ${s.label} » porte ${n} indices pour ${s.capacity} place${s.capacity > 1 ? 's' : ''}.`);
  }
  for (const d of arc.clueDesigns) if (d.unique && arc.manifestations.filter((m) => m.clueDesignId === d.id && isActive(m)).length > 1) bad(`« ${d.title} » est unique mais placé deux fois : fais une copie distincte (autre support).`);
  for (const g of arc.gates) {
    if (!order.has(g.targetSceneId)) bad(`Le verrou « ${g.title} » n’est rattaché à aucune scène de la campagne.`);
    g.requiredAtomIds.filter((a) => !atoms.has(a)).forEach(() => bad(`« ${g.title} » exige un fait supprimé.`));
    if (!g.requiredAtomIds.length) warn(`« ${g.title} » n’exige aucun fait : rien à semer.`);
    if (g.criticalPath && !g.bypass?.trim()) warn(`« ${g.title} » est sur le chemin principal sans contournement prévu.`);
    // Aucun fait critique seulement dans une branche facultative.
    for (const a of g.requiredAtomIds) {
      const atom = atoms.get(a);
      if (!atom || atom.criticality !== 'critical' || local(atom)) continue;
      const placed = placementsOf(arc, a).filter(({ m, slot }) => isActive(m) && (order.get(slot.sceneId) ?? Infinity) < (order.get(g.targetSceneId) ?? -1));
      if (placed.length && placed.every(({ slot }) => slot.isOptional)) bad(`Le fait critique « ${atom.statement} » ne se trouve que dans des scènes facultatives avant « ${g.title} ».`);
    }
  }
  const sources = (a: KnowledgeAtom) => new Set(placementsOf(arc, a.id).filter(({ m }) => isActive(m)).map(({ d }) => d.id)).size;
  for (const a of arc.knowledgeAtoms) if (a.criticality === 'critical' && !local(a) && sources(a) < 2) warn(`« ${a.statement} » n’a qu’${sources(a) ? 'une source' : 'aucune source'} : vise deux sources indépendantes.`);
  return out;
}

/** Le fait s'apprend au verrou même (observation ou expérience sur place). */
const local = (a: KnowledgeAtom) => a.discoverableBy.includes('local_observation') || a.discoverableBy.includes('experiment');

function placementsOf(arc: MysteryArc, atomId: string) {
  const designs = byId(arc.clueDesigns), slots = byId(arc.sceneSlots);
  return arc.manifestations.flatMap((m) => {
    const d = designs.get(m.clueDesignId), slot = slots.get(m.slotId);
    return d && slot && d.knowledgeAtomIds.includes(atomId) ? [{ m, d, slot }] : [];
  });
}

/* ——— Couverture d'un verrou ——— */

export type Readiness = 'READY' | 'AT_RISK' | 'BLOCKED' | 'UNKNOWN';
export type AtomCoverage = { atom: KnowledgeAtom; status: 'acquis' | 'sur place' | 'probable' | 'fragile' | 'introuvable'; why: string };

export function coverageOf(arc: MysteryArc, gate: Gate, scenes: SceneRef[]): { status: Readiness; atoms: AtomCoverage[]; why: string } {
  const order = sceneOrder(scenes);
  const atoms = byId(arc.knowledgeAtoms);
  const deadline = order.get(gate.targetSceneId);
  if (deadline === undefined) return { status: 'UNKNOWN', atoms: [], why: 'Le verrou n’est rattaché à aucune scène connue : impossible de garantir quoi que ce soit.' };
  const played = new Set(scenes.filter((s) => s.played).map((s) => s.id));
  const list: AtomCoverage[] = gate.requiredAtomIds.map((id) => {
    const atom = atoms.get(id) ?? { id, statement: '(fait supprimé)', criticality: 'critical' as const, discoverableBy: [] };
    const ps = placementsOf(arc, id);
    const learned = ps.find(({ m }) => LEARNED.includes(m.state));
    if (learned) return { atom, status: 'acquis', why: `Appris : ${learned.d.title}.` };
    if (local(atom)) return { atom, status: 'sur place', why: 'S’observe ou s’expérimente au verrou même.' };
    // Ce qui reste à trouver : prévu avant le verrou, dans une scène pas encore jouée (ou en cours).
    const ahead = ps.filter(({ m, slot }) => ['slotted', 'presented'].includes(m.state) && (order.get(slot.sceneId) ?? Infinity) <= deadline && !(played.has(slot.sceneId) && m.state === 'slotted'));
    if (ahead.some(({ slot }) => !slot.isOptional && !slot.isReserve)) return { atom, status: 'probable', why: `Prévu : ${ahead.filter(({ slot }) => !slot.isOptional).map(({ d }) => d.title).join(', ')}.` };
    if (ahead.length) return { atom, status: 'fragile', why: 'Seulement dans une scène facultative ou un emplacement de secours.' };
    return { atom, status: 'introuvable', why: 'Aucune source avant le verrou.' };
  });
  const missing = list.filter((x) => x.status === 'introuvable' && x.atom.criticality !== 'enrichment');
  if (missing.length) return { status: 'BLOCKED', atoms: list, why: `${missing.length} fait${missing.length > 1 ? 's' : ''} sans aucune source avant le verrou${gate.bypass ? ` (contournement prévu : ${gate.bypass})` : ''}.` };
  if (list.some((x) => x.status === 'fragile' || x.status === 'probable')) return { status: 'AT_RISK', atoms: list, why: 'Des faits ne sont encore que prévus : le groupe peut passer à côté.' };
  return { status: 'READY', atoms: list, why: 'Chaque fait est acquis ou s’apprend sur place. (Prêt ne veut pas dire compris.)' };
}

/* ——— Propositions de placement ——— */

export type Proposal = { slot: SceneSlot; scene: SceneRef; score: number; reasons: string[] };

/** Les emplacements où ce support peut aller, motivés, du meilleur au moins bon (contraintes dures d'abord). */
export function proposalsFor(arc: MysteryArc, design: ClueDesign, scenes: SceneRef[], opts: { after?: number; exclude?: string[] } = {}): Proposal[] {
  const order = sceneOrder(scenes);
  const sceneById = byId(scenes);
  const deadline = Math.min(...design.knowledgeAtomIds.map((a) => deadlineOf(arc, a, order)));
  const out: Proposal[] = [];
  const mediaOf = (atomId: string) => placementsOf(arc, atomId).filter(({ m }) => isActive(m)).map(({ d }) => d.media);
  for (const slot of arc.sceneSlots) {
    const i = order.get(slot.sceneId), scene = sceneById.get(slot.sceneId);
    if (i === undefined || !scene || opts.exclude?.includes(slot.id)) continue;
    // Contraintes dures.
    if (scene.played) continue;
    if (opts.after !== undefined && i <= opts.after) continue;
    if (Number.isFinite(deadline) && i >= deadline) continue;
    if (slot.allowedMedia.length && !slot.allowedMedia.includes(design.media)) continue;
    if (arc.manifestations.filter((m) => m.slotId === slot.id && isActive(m)).length >= slot.capacity) continue;
    // Préférences.
    const reasons: string[] = [];
    let score = 0;
    if (!slot.isOptional) { score += 4; reasons.push('scène sur le chemin prévu'); } else { score -= 4; reasons.push('scène facultative (fragile)'); }
    if (slot.isReserve) { score -= 2; reasons.push('emplacement de secours'); }
    const others = design.knowledgeAtomIds.flatMap(mediaOf);
    if (!others.includes(design.media)) { score += 2; reasons.push('varie les supports'); }
    if (Number.isFinite(deadline)) {
      const gap = deadline - i;
      score += Math.min(3, gap);
      reasons.push(gap === 1 ? 'juste avant le verrou (confirmation)' : `${gap} scènes avant le verrou (le temps de relier)`);
    } else reasons.push('aucun verrou daté');
    const load = arc.manifestations.filter((m) => isActive(m) && arc.sceneSlots.find((s) => s.id === m.slotId)?.sceneId === slot.sceneId).length;
    if (load >= 2) { score -= load; reasons.push(`scène déjà chargée (${load} indices)`); }
    out.push({ slot, scene, score, reasons });
  }
  return out.sort((a, b) => b.score - a.score);
}

/* ——— Actions (idempotentes) ——— */

const withEvent = (arc: MysteryArc, e: Omit<ArcEvent, 'id' | 'at'>): MysteryArc => ({ ...arc, events: [...arc.events, { ...e, id: uid('ev'), at: Date.now() }], updatedAt: Date.now() });
const done = (arc: MysteryArc, key: string) => arc.events.some((e) => e.key === key);

/** Place un support dans un emplacement (proposition acceptée par le MJ). */
export function place(arc: MysteryArc, designId: string, slotId: string, key: string, provenance?: string): MysteryArc {
  if (done(arc, key)) return arc;
  const m: ClueManifestation = { id: uid('manif'), clueDesignId: designId, slotId, state: 'slotted', provenance, updatedAt: Date.now() };
  return withEvent({ ...arc, manifestations: [...arc.manifestations, m] }, { key, type: 'clue.placement.approved', manifestationId: m.id });
}

/** Le MJ note ce qui s'est passé à la table : présenté, aperçu, examiné, pris, manqué, détruit. */
export function markState(arc: MysteryArc, manifestationId: string, state: ManifestationState, key: string, patch: Partial<ClueManifestation> = {}): MysteryArc {
  if (done(arc, key)) return arc;
  const m = arc.manifestations.find((x) => x.id === manifestationId);
  if (!m) return arc;
  // Ce qui a été pris reste au groupe : on ne le « dé-prend » pas par erreur.
  if (m.state === 'collected' && state !== 'destroyed') return arc;
  return withEvent({ ...arc, manifestations: arc.manifestations.map((x) => (x.id === manifestationId ? { ...x, ...patch, state, updatedAt: Date.now() } : x)) }, { key, type: `clue.${state}`, manifestationId });
}

export type DeferCandidate = Proposal & { medium: Medium; justification: string };
export type DeferPreview =
  | { kind: 'preview'; strategy: 'MOVE_UNEXPOSED' | 'NEW_DISTINCT_COPY'; manifestation: ClueManifestation; design: ClueDesign; facts: string[]; candidates: DeferCandidate[]; risk: string }
  | { kind: 'review'; manifestation: ClueManifestation; design: ClueDesign; facts: string[]; options: string[] };

/**
 * Demande de report (annexe B3) : si l'indice a été exposé (ou est un objet unique), on ne le déplace pas, on
 * prépare une seconde source distincte ; sinon on peut le déplacer. Trois emplacements motivés, ou une revue MJ.
 */
export function requestDefer(arc: MysteryArc, manifestationId: string, scenes: SceneRef[], currentSceneId?: string): DeferPreview | null {
  const m = arc.manifestations.find((x) => x.id === manifestationId);
  const design = m && arc.clueDesigns.find((d) => d.id === m.clueDesignId);
  if (!m || !design) return null;
  const order = sceneOrder(scenes);
  const facts = design.knowledgeAtomIds.map((a) => arc.knowledgeAtoms.find((x) => x.id === a)?.statement ?? a);
  const strategy = isExposed(m) || (m.state === 'missed' && design.unique) ? 'NEW_DISTINCT_COPY' : 'MOVE_UNEXPOSED';
  const here = order.get(currentSceneId ?? arc.sceneSlots.find((s) => s.id === m.slotId)?.sceneId ?? '') ?? -1;
  // Le même fait peut passer par un autre support que celui d'origine : on considère tous les médiums permis.
  const candidates: DeferCandidate[] = [];
  for (const slot of arc.sceneSlots) {
    if (slot.id === m.slotId) continue;
    const media = slot.allowedMedia.length ? slot.allowedMedia : [design.media];
    const medium = media.includes(design.media) ? design.media : media[0];
    const variant: ClueDesign = { ...design, media: medium, unique: false };
    const [p] = proposalsFor(arc, variant, scenes, { after: here }).filter((x) => x.slot.id === slot.id);
    if (!p) continue;
    const form = medium === design.media ? (strategy === 'NEW_DISTINCT_COPY' ? `dans une copie distincte (${MEDIUM_LABEL[medium].toLowerCase()})` : 'tel quel') : `sous une autre forme (${MEDIUM_LABEL[medium].toLowerCase()})`;
    candidates.push({ ...p, medium, justification: `Le fait réapparaît ${form} à « ${slot.label} », dans « ${p.scene.title ?? 'scène'} ».` });
  }
  candidates.sort((a, b) => b.score - a.score);
  const gate = arc.gates.filter((g) => design.knowledgeAtomIds.some((a) => g.requiredAtomIds.includes(a))).sort((a, b) => (order.get(a.targetSceneId) ?? 0) - (order.get(b.targetSceneId) ?? 0))[0];
  if (!candidates.length) return { kind: 'review', manifestation: m, design, facts, options: ['Créer une scène relais (une rencontre, un PNJ qui sait)', 'Ajouter un emplacement à une scène à venir', 'Permettre le contournement du verrou à coût narratif', gate?.bypass ? `Contournement prévu : ${gate.bypass}` : 'Laisser l’incertitude (si le verrou est facultatif)'] };
  return { kind: 'preview', strategy, manifestation: m, design, facts, candidates: candidates.slice(0, 3),
    risk: gate ? `Échéance : avant « ${gate.title} »${gate.criticalPath ? ' (chemin principal)' : ''}.` : 'Aucun verrou daté pour ce fait.' };
}

/**
 * Report confirmé par le MJ : un indice jamais exposé est retiré et remplacé (nouvel identifiant, provenance) ; un
 * indice déjà exposé reste où il est et une seconde source distincte est ajoutée. `keepHere` garde l'original aussi.
 */
export function approveDefer(arc: MysteryArc, preview: Extract<DeferPreview, { kind: 'preview' }>, candidate: DeferCandidate, key: string, reason: string, keepHere = false): MysteryArc {
  if (done(arc, key)) return arc;
  const { manifestation: m, design } = preview;
  let next = arc;
  let designId = design.id;
  // Autre forme, ou copie d'un objet unique : un nouveau support enseigne les mêmes faits.
  if (candidate.medium !== design.media || (preview.strategy === 'NEW_DISTINCT_COPY' && design.unique)) {
    const copy: ClueDesign = { ...design, id: uid('design'), media: candidate.medium, unique: false, title: `${design.title} (${candidate.medium === design.media ? 'copie' : MEDIUM_LABEL[candidate.medium].split(',')[0].toLowerCase()})` };
    next = { ...next, clueDesigns: [...next.clueDesigns, copy] };
    designId = copy.id;
  }
  const fresh: ClueManifestation = { id: uid('manif'), clueDesignId: designId, slotId: candidate.slot.id, state: 'slotted', from: m.id, provenance: reason || candidate.justification, updatedAt: Date.now() };
  const withdraw = preview.strategy === 'MOVE_UNEXPOSED' && !keepHere && !isExposed(m);
  next = { ...next, manifestations: [...next.manifestations.map((x) => (x.id === m.id && withdraw ? { ...x, state: 'withdrawn' as const, updatedAt: Date.now() } : x)), fresh] };
  return withEvent(next, { key, type: 'clue.defer.approved', manifestationId: fresh.id, reason, detail: `${preview.strategy} depuis ${m.id}` });
}

/** Résumé de séance pour le MJ : ce qui a été vu, pris, manqué, reporté. */
export function arcStats(arc: MysteryArc) {
  const count = (s: ManifestationState) => arc.manifestations.filter((m) => m.state === s).length;
  return { prevus: count('slotted'), vus: count('presented') + count('noticed') + count('inspected'), pris: count('collected'), manques: count('missed'), reportes: arc.events.filter((e) => e.type === 'clue.defer.approved').length };
}

export function blankArc(universeId: string, campaignId?: string): MysteryArc {
  const now = Date.now();
  return { id: uid('mystere'), universeId, campaignId, title: 'Nouveau mystère', status: 'draft', knowledgeAtoms: [], clueDesigns: [], sceneSlots: [], manifestations: [], gates: [], events: [], createdAt: now, updatedAt: now };
}
export { uid as newId };
