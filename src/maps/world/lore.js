/**
 * Ancrage du lore sur la carte du monde.
 *
 *  - Une fiche de lieu qui décrit une cité (population, quartiers, « ville », « village »…) donne les paramètres
 *    de la cité à générer : on part de la fiche, sans rien recopier.
 *  - Une fiche de lieu qui décrit un bâtiment (auberge, forge, temple…) rattaché à une cité de la carte prend la
 *    place d'un bâtiment non découvert du bon type, dans le bon quartier. Les PNJ qui y sont mentionnés y sont posés.
 *  - Une fiche modifiée peut déplacer un lieu encore non découvert ; un lieu déjà découvert ne bouge plus : la
 *    contradiction est signalée au MJ. Une fiche supprimée laisse son lieu en place, signalé (jamais effacé).
 *
 * JavaScript pur : testé par lore.test.mjs.
 */
import { SLOT_TYPES, citySlots, cityPlanId, hashSeed } from './generate.js';

export const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ');
const txt = (v) => (v == null ? '' : typeof v === 'string' ? v : Array.isArray(v) ? v.map(txt).join(' ') : typeof v === 'object' ? Object.values(v).map(txt).join(' ') : String(v));
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWord = (text, word) => !!word && new RegExp(`(^|[^a-z0-9])${escape(word)}($|[^a-z0-9])`).test(text);

/** Mots qui désignent un type de bâtiment, du plus précis au plus général. */
const TYPE_WORDS = [
  ['chateau', /\b(chateau|donjon|citadelle|forteresse|palais royal|cour royale|salle du trone)\b/],
  ['temple', /\b(temple|eglise|chapelle|sanctuaire|cathedrale|monastere|abbaye|oratoire|prieure)\b/],
  ['guilde', /\b(guilde|hotel de ville|mairie|conseil|tribunal|bourse|banque|comptoir|confrerie|academie|ecole|bibliotheque)\b/],
  ['caserne', /\b(caserne|corps de garde|poste de garde|guet|prison|geole|cachot|milice)\b/],
  ['auberge', /\b(auberge|hostellerie|relais|gite|hotellerie)\b/],
  ['taverne', /\b(taverne|chope|choppe|cabaret|estaminet|buvette|brasserie|bouge|tripot|beuverie)\b/],
  ['forge', /\b(forge|forgeron|armurier|armurerie|ferronn\w*|marechal[- ]ferrant)\b/],
  ['ecurie', /\b(ecurie|ecuries|haras|palefreni\w*)\b/],
  ['entrepot', /\b(entrepot|grenier|halle|docks?)\b/],
  ['atelier', /\b(atelier|tannerie|tanneur|teinturer\w*|moulin|scierie|charpenti\w*|menuisi\w*|tisserand\w*|verrerie)\b/],
  ['ferme', /\b(ferme|metairie|grange|bergerie|verger|vignoble|moulin a vent)\b/],
  ['manoir', /\b(manoir|hotel particulier|demeure|residence|villa|palais)\b/],
  ['echoppe', /\b(echoppe|boutique|magasin|marchand\w*|apothicai\w*|herbori\w*|tailleur|boulang\w*|boucher\w*|orfevre\w*|joailli\w*|librai\w*|cordonni\w*|potier|etal|alchimi\w*|bijouti\w*|epicer\w*|parfum\w*|chapeli\w*)\b/],
  ['maison', /\b(maison|logis|chaumiere|masure|taudis|repaire|planque|refuge)\b/],
];

/** Quartier demandé par la fiche. */
const DISTRICT_WORDS = [
  ['chateau', /\b(dans le chateau|au chateau|enceinte du chateau|cour du chateau|citadelle|pied du donjon)\b/],
  ['haute', /\b(haute[- ]ville|quartier noble|quartier des nobles|quartier bourgeois|beaux quartiers|nobles?|bourgeois\w*)\b/],
  ['marche', /\b(place du marche|pres du marche|sur le marche|au marche|grand[- ]place|place centrale)\b/],
  ['faubourg', /\b(faubourgs?|hors des murs|hors les murs|hors de l enceinte|banlieue|bas[- ]quartiers?)\b/],
  ['ferme', /\b(campagne|dans les champs|aux champs|en dehors de la ville|aux abords de la ville)\b/],
  ['ville', /\b(basse[- ]ville|centre[- ]ville|vieille ville|intra[- ]muros)\b/],
];

const NATURAL = /\b(foret|bois|riviere|fleuve|lac|montagne|mont|monts|colline|marais|grotte|caverne|mine|mines|ruines?|col|vallee|plaine|desert|ile|mer|ocean|crypte|tombeau|gouffre|abime|lande|source)\b/;
const SETTLEMENT = /\b(cite|ville|village|bourg|bourgade|hameau|capitale|metropole|cite[- ]etat|port)\b/;

/** Une fiche décrit-elle une cité (et non un bâtiment) ? */
export function isSettlement(entry) {
  if (!entry || (entry.archiveType && entry.archiveType !== 'place')) return false;
  const head = norm(`${entry.title} ${entry.subtitle ?? ''}`);
  if (TYPE_WORDS.slice(0, -1).some(([, re]) => re.test(norm(entry.title)))) return false;
  if (SETTLEMENT.test(head)) return true;
  const pop = parsePopulation(entry);
  return (pop ?? 0) >= 80 || (Array.isArray(entry.districts) && entry.districts.length > 0);
}

/** Population lue sur la fiche (« environ 1 500 habitants », « 1500 âmes »…). */
export function parsePopulation(entry) {
  const direct = txt(entry.population).replace(/[\s .,](?=\d{3}\b)/g, '');
  const m = direct.match(/\d{2,6}/);
  if (m) return Number(m[0]);
  const all = norm([entry.shortSummary, entry.subtitle, entry.body, txt(entry.sections)].map(txt).join(' ')).replace(/(\d)[\s.,](?=\d{3}\b)/g, '$1');
  const h = all.match(/(\d{2,6})\s*(habitants|ames|hab\b|citoyens|ames vivantes)/);
  return h ? Number(h[1]) : null;
}

/** Tout le texte d'une fiche, normalisé. */
const fullText = (e) => norm([e.title, e.subtitle, e.shortSummary, e.body, e.currentLocation, e.region, e.owner, txt(e.districts), txt(e.pointsOfInterest), txt(e.tags), txt(e.sections), e.campaignUse].map(txt).join(' '));

/** Paramètres de cité tirés d'une fiche de lieu. Ce que la fiche ne dit pas prend les valeurs par défaut. */
export function citySpecFromEntry(entry) {
  const t = fullText(entry);
  const yes = (re, no) => (no && no.test(t) ? false : re.test(t) ? true : undefined);
  const people = ['humain', 'elfe', 'nain', 'halfelin', 'gnome', 'orque', 'drow'].find((p) => new RegExp(`\\b${p}s?\\b`).test(t));
  return {
    id: entry.id, name: entry.title || 'Cité sans nom', entryId: entry.id,
    population: parsePopulation(entry) ?? undefined,
    people: people ? `${people}s` : undefined,
    walls: yes(/\b(muraille|murailles|rempart|remparts|enceinte|fortifi\w*|murs de la ville)\b/, /\b(sans (muraille|rempart|enceinte)|pas de (muraille|rempart)|ville ouverte)\b/),
    castle: yes(/\b(chateau|citadelle|donjon|palais royal|forteresse|royaute|famille royale|le roi|la reine|seigneur)\b/, /\bsans chateau\b/),
    highTown: yes(/\b(haute[- ]ville|quartier noble|quartier des nobles|nobles|bourgeois\w*|patriciens?)\b/),
    faubourgs: yes(/\b(faubourgs?|banlieue|hors les murs|echoppes)\b/),
    farms: yes(/\b(fermes?|champs|campagne|agricole|cultures|paysans?|metairies?)\b/),
    river: yes(/\b(riviere|fleuve|pont de pierre|rive)\b/),
    // Cité portuaire : la mer s'étendra du côté du bord de carte le plus proche (voir withCity).
    port: yes(/\b(port|portuaire|quais?|docks?|havre|rade|sur la cote|ville cotiere|cotiere|bord de mer|littoral|maritime|baie|chantier naval|armateurs?)\b/, /\b(sans port|loin de la mer|pas de port)\b/),
  };
}

/** Type de bâtiment et quartier demandés par une fiche de lieu (null : ce n'est pas un bâtiment). */
export function classifyPlace(entry) {
  const title = norm(entry.title);
  const head = norm(`${entry.subtitle ?? ''} ${entry.shortSummary ?? ''}`);
  const body = fullText(entry);
  const typeIn = (s) => TYPE_WORDS.find(([, re]) => re.test(s))?.[0] ?? null;
  // Un site naturel ou hors les murs (forêt, grotte, ruines…) n'est pas un bâtiment de cité, même si son texte en cite un.
  if (!typeIn(title) && NATURAL.test(title)) return null;
  const fromBody = typeIn(body);
  const type = typeIn(title) ?? typeIn(head) ?? (fromBody === 'maison' ? null : fromBody);
  if (!type) return null;
  const where = norm([entry.currentLocation, entry.subtitle, entry.shortSummary, entry.region].map(txt).join(' '));
  const districtIn = (s) => DISTRICT_WORDS.find(([, re]) => re.test(s))?.[0] ?? null;
  return { type, district: districtIn(where) ?? districtIn(body) };
}

/** Nom sans article (« La Chope Cassée » → « chope cassee ») : sert à reconnaître le lieu dans le texte d'un PNJ. */
export function coreName(title) {
  return norm(title).replace(/^(la|le|les|l|au|aux|du|des|a la|a l)\s+/, '').trim();
}

/** PNJ présents dans un lieu : leur fiche nomme le lieu, ou la fiche du lieu les nomme. */
export function npcsOf(place, people) {
  const core = coreName(place.title);
  const placeText = fullText(place);
  const out = [];
  for (const p of people) {
    const name = p.name ?? p.title;
    if (!name) continue;
    const n = norm(name);
    const theirs = norm([p.currentLocation, p.occupation, p.role, p.function, p.shortDescription, p.shortSummary, p.description, p.body, p.backstory].map(txt).join(' '));
    const here = (core.length >= 4 && theirs.includes(core)) || (n.length >= 4 && hasWord(placeText, n));
    const desc = (p.shortDescription || p.shortSummary || '').toString().trim().slice(0, 300) || undefined;
    if (here) out.push({ id: p.id, name, role: (p.occupation || p.role || p.function || '').toString().trim() || undefined, desc });
  }
  return out;
}

/** Résumé montré sur la carte : le résumé court de la fiche (jamais ses secrets). */
const summaryOf = (e) => (e.shortSummary || e.subtitle || '').toString().trim().slice(0, 400) || undefined;

/** Types de repli quand la cité n'a plus d'emplacement libre du type voulu. */
const FALLBACK = {
  taverne: ['auberge', 'echoppe'], auberge: ['taverne', 'echoppe'], forge: ['atelier', 'echoppe'], echoppe: ['atelier'],
  guilde: ['echoppe'], temple: ['guilde'], caserne: ['guilde'], ecurie: ['entrepot', 'ferme'], entrepot: ['atelier'],
  atelier: ['echoppe'], manoir: [], chateau: ['manoir'], ferme: [], maison: [],
};
const NEAR = { ville: ['ville', 'marche'], marche: ['marche', 'ville'], haute: ['haute'], chateau: ['chateau', 'haute'], faubourg: ['faubourg'], ferme: ['ferme', 'faubourg'] };
export const DISTRICT_LABEL = { chateau: 'au château', haute: 'en haute-ville', marche: 'près du marché', ville: 'en basse-ville', faubourg: 'dans un faubourg', ferme: 'à la campagne' };

/** Emplacement libre pour un lieu : bon type et bon quartier d'abord, puis types de repli, puis n'importe quelle maison. */
export function pickSlot(slots, cls, entryId, taken) {
  const chain = [cls.type, ...(FALLBACK[cls.type] ?? []), 'maison'];
  const order = (list) => list.map((s) => ({ s, k: hashSeed(`${entryId}:${s.id}`) })).sort((a, b) => a.k - b.k).map((x) => x.s);
  const passes = cls.district ? [NEAR[cls.district] ?? [cls.district], null] : [null];
  for (const districts of passes) {
    for (const t of chain) {
      const cand = slots.filter((s) => s.type === t && !taken.has(s.id) && (!districts || districts.includes(s.district)));
      if (cand.length) return order(cand)[0];
    }
    // Aucun bâtiment de ce type dans le quartier demandé : on convertit un bâtiment ordinaire du quartier.
    if (districts) {
      for (const t of ['maison', 'manoir', 'ferme', 'atelier', 'echoppe']) {
        const cand = slots.filter((s) => s.type === t && !taken.has(s.id) && districts.includes(s.district));
        if (cand.length) return order(cand)[0];
      }
    }
  }
  return null;
}

/** La cité d'un lieu : celle que sa fiche nomme (lieu actuel d'abord), sinon la cité par défaut du monde. */
export function cityOf(place, cities, defaultCityId) {
  const where = norm([place.currentLocation, place.region].map(txt).join(' '));
  const all = fullText(place);
  const names = cities.map((c) => ({ c, n: norm(c.name) })).filter((x) => x.n.length >= 3);
  return names.find((x) => hasWord(where, x.n))?.c
    ?? names.find((x) => hasWord(all, x.n))?.c
    // Fiches importées des Archives : seulement si elles nomment la cité.
    ?? (place.sourceId ? null : cities.find((c) => c.id === defaultCityId) ?? null);
}

/**
 * Met les lieux du lore en place sur les cités du monde.
 * `places` : fiches de lieu de l'univers ; `people` : PNJ et fiches de personnages ; `revealed` : lieux déjà découverts.
 * Renvoie les nouvelles assignations, et `changed` si elles diffèrent des précédentes.
 */
export function syncBindings({ world, mapRecordId, places, people = [], revealed = new Set() }) {
  const cities = world.cities ?? [];
  const before = world.bindings ?? {};
  const out = {};
  const cityIds = new Set(cities.map((c) => c.id));
  const cityEntryIds = new Set(cities.map((c) => c.entryId).filter(Boolean));
  const slotsOf = new Map(cities.map((c) => [c.id, citySlots(c, cityPlanId(mapRecordId, c.id))]));
  const taken = new Set();
  // Les lieux déjà découverts gardent leur emplacement en priorité.
  const keep = Object.values(before).filter((b) => b && cityIds.has(b.cityId) && slotsOf.get(b.cityId)?.some((s) => s.id === b.slotId));
  for (const b of keep) if (revealed.has(b.slotId) || b.orphan || b.excluded || b.pinned) { out[b.entryId] = b; if (!b.excluded) taken.add(b.slotId); }

  const byId = new Map(places.map((p) => [p.id, p]));
  // Fiche supprimée : le lieu reste où il est, signalé.
  for (const b of keep) if (!byId.has(b.entryId)) { out[b.entryId] = { ...(out[b.entryId] ?? b), orphan: true }; taken.add(b.slotId); }

  const ordered = [...places].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || String(a.id).localeCompare(String(b.id)));
  for (const p of ordered) {
    if (cityEntryIds.has(p.id) || isSettlement(p)) continue;
    const cls = classifyPlace(p);
    if (!cls) continue;
    const city = cityOf(p, cities, world.defaultCityId ?? cities[0]?.id);
    if (!city) continue;
    const hint = `${cls.type}|${cls.district ?? ''}`;
    const snap = { entryId: p.id, title: p.title || SLOT_TYPES[cls.type].label, summary: summaryOf(p), npcs: npcsOf(p, people) };
    const prev = before[p.id];
    const kept = out[p.id];
    if (kept?.excluded) { out[p.id] = { ...kept, ...snap }; continue; }
    if (kept && (!kept.orphan || revealed.has(kept.slotId))) {
      // Découvert : il reste où il est. Si la fiche demande désormais autre chose, on le signale.
      // Un lieu épinglé par le MJ ne bouge jamais, et ne signale rien : c'est lui qui l'a posé là.
      const moved = !kept.pinned && (kept.hint !== hint || kept.cityId !== city.id);
      const conflict = moved && (kept.cityId !== city.id || (cls.district && kept.district && !(NEAR[cls.district] ?? []).includes(kept.district)))
        ? `La fiche place désormais ce lieu ${kept.cityId !== city.id ? `à ${city.name}` : DISTRICT_LABEL[cls.district] ?? 'ailleurs'} ; déjà découvert, il reste où il est.`
        : undefined;
      out[p.id] = { ...kept, ...snap, type: kept.type, conflict, orphan: undefined };
      continue;
    }
    if (kept?.orphan) { delete out[p.id]; taken.delete(kept.slotId); }
    // Non découvert : on garde l'emplacement si la demande n'a pas changé, sinon on en cherche un autre.
    const slots = slotsOf.get(city.id) ?? [];
    if (prev && prev.cityId === city.id && prev.hint === hint && !prev.orphan && !taken.has(prev.slotId) && slots.some((s) => s.id === prev.slotId)) {
      out[p.id] = { ...prev, ...snap, conflict: undefined };
      taken.add(prev.slotId);
      continue;
    }
    const slot = pickSlot(slots, cls, p.id, taken);
    if (!slot) continue;
    taken.add(slot.id);
    out[p.id] = { ...snap, cityId: city.id, slotId: slot.id, type: cls.type, district: slot.district, hint };
  }
  const clean = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, Object.entries(o[k]).filter(([, v]) => v !== undefined).sort()]));
  return { bindings: out, changed: clean(out) !== clean(before) };
}
