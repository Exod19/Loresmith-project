/**
 * Carte du monde : raccord entre le générateur (generate.js, lore.js) et l'application.
 * Une carte « monde » ne stocke que ses paramètres (graine, cités, lieux posés) ; son dessin est recalculé à la demande,
 * identique d'une fois à l'autre, puis traité comme l'Atlas des profondeurs par le reste de l'application.
 */
import { useEffect, useRef } from 'react';
import { cityPlanId, citySpecDefaults, generateWorld, worldLakes, worldRivers, hashSeed, interiorPlanId, landNameOf, placeCity, seaNameOf, wildFeatureOf, worldPlanId, type CitySpec, type Sea, type WildRecord, type WorldSpec } from './generate';
import { nookSitesIn, sightOf, spotSite, whereLabel, wildSitesIn, type WildSite } from './wilds';
import { lengthOf, project, subpath } from '../journey';
import { generateZonePlan, zoneAt, zoneBox, zoneKey, zonePlanId } from './zonePlan';
import { nearestEdge } from './climate';
import { DIR_ANGLE, PACE, atDir, SCALES, cityKm, cityRadiusKm, crossCountry, dirName, elevationAt, placeOn, reliefOf, routeOn, seaBeyond, seaSideAt, terrainAt, toAt, toKm, travelGrid, worldFrame } from './terrain';
import { norm } from './lore';
import { citySpecFromEntry, isSettlement, syncBindings, type LoreEntry } from './lore';
import type { AtlasData } from '../atlas/types';
import type { MapRecord } from '../mapStore';

export { cityPlanId, interiorPlanId, worldPlanId };
export type World = NonNullable<MapRecord['world']>;

/** L'Atlas et la carte du monde partagent la même mécanique (lieux à révéler, chemins, brouillard, combat). */
export const isAtlasLike = (rec: Pick<MapRecord, 'kind'> | null | undefined) => !!rec && rec.kind !== 'custom';

const EMPTY_WORLD: World = { seed: 1, name: 'Le Monde', cities: [], bindings: {} };
const cache = new Map<string, AtlasData>();
/** Jeu de données d'une carte du monde (mis en cache : il ne change que si ses paramètres changent). */
export function worldAtlas(rec: MapRecord): AtlasData {
  const world = rec.world ?? EMPTY_WORLD;
  // La position du personnage du MJ ne change pas le dessin : elle n'entre pas dans la clé.
  // L'horloge et la mémoire du monde ne changent pas le dessin non plus (le moment de la journée, lui, si : `time`).
  const key = `${rec.id}|${JSON.stringify({ ...world, avatar: world.avatar && { ...world.avatar, at: undefined }, clock: undefined, events: undefined, visits: undefined })}`;
  let d = cache.get(key);
  if (!d) {
    d = generateWorld(world as WorldSpec, rec.id) as AtlasData;
    if (world.zones && Object.keys(world.zones).length) d = withZones(rec, d);
    cache.set(key, d);
    if (cache.size > 6) cache.delete(cache.keys().next().value!);
  }
  return d;
}

/** Données source d'une carte : la carte du monde générée, ou l'Atlas des Archives (`feedAtlas`). */
export function sourceAtlas(rec: MapRecord, feedAtlas?: AtlasData | null): AtlasData {
  return (rec.kind === 'monde' ? worldAtlas(rec) : feedAtlas) as AtlasData;
}

/** Nouvelle carte du monde pour un univers. */
export function newWorldRecord(universe: { id: string; name: string }, id: string): MapRecord {
  const now = Date.now();
  return {
    id, universeId: universe.id, kind: 'monde', title: `Monde · ${universe.name}`,
    description: 'Carte du monde générée : cités, routes, bâtiments, et les lieux du lore à mesure qu’ils sont créés.',
    // Un nouveau monde est à l'échelle d'un royaume (~500 km) : relief, côtes, distances en jours de marche.
    world: { seed: hashSeed(`monde:${universe.id}:${id}`), name: universe.name, cities: [], bindings: {}, terrain: 2, scale: 'royaume' },
    createdAt: now, updatedAt: now,
  };
}

/** Ajoute une cité au monde, à une place qui ne bouge plus ensuite. La première cité devient la cité par défaut du lore. */
export function withCity(world: World, spec: CitySpec, choice?: { sea: Sea; km: [number, number] }): World {
  const cities = world.cities.filter((c) => c.id !== spec.id);
  const frame = worldFrame(world);
  if (!frame.legacy) return withCityKm(world, cities, spec, choice);
  const at = spec.at ?? placeCity({ seed: world.seed, cities }, spec.id);
  // Un port regarde vers le bord de carte le plus proche : la mer y restera, même si la cité est redessinée.
  const port = spec.port ? { seaDir: spec.seaDir ?? nearestEdge(at) } : { seaDir: undefined };
  return { ...world, cities: [...cities, { ...spec, ...port, at }], defaultCityId: world.defaultCityId ?? spec.id };
}

/** Distances voulues d'une cité, résolues : position (km) de la cité visée, distance, direction. */
export function wantsOf(world: World, spec: CitySpec, cities = world.cities) {
  const frame = worldFrame(world);
  const out: { km: [number, number]; dist: number; dir?: number; to: CitySpec; label?: string }[] = [];
  for (const n of spec.near ?? []) {
    const to = cities.filter((c) => c.id !== spec.id).find((c) => n.to.startsWith(norm(c.name)) || norm(c.name).startsWith(n.to));
    if (to) out.push({ km: cityKm(frame, to), dist: n.km, dir: n.dir ? DIR_ANGLE[n.dir] : undefined, to, label: n.label });
  }
  return out;
}

type Side = 'N' | 'S' | 'E' | 'O';
const SIDES: Side[] = ['N', 'S', 'E', 'O'];
/** Bornes agrandies d'une bande (30 % du monde de départ) d'un côté. */
function grown(world: World, side: Side): [number, number, number, number] {
  const f = worldFrame(world), sc = SCALES[f.scale];
  const bw = Math.round(sc.w * 0.3), bh = Math.round(sc.h * 0.3);
  return [f.x0 - (side === 'O' ? bw : 0), f.y0 - (side === 'N' ? bh : 0), f.x1 + (side === 'E' ? bw : 0), f.y1 + (side === 'S' ? bh : 0)];
}
/** Côtés où le monde peut s'agrandir : pas du côté d'une mer (au-delà, ce sont d'autres continents). */
export const growSides = (world: World): Side[] => SIDES.filter((s) => !(world.seas ?? []).some((m) => m.side === s && !m.crossed));

/**
 * Traverser une mer : le monde s'étend au-delà, jusqu'à l'autre rive et un peu plus. Ces terres lointaines (un autre
 * continent) reçoivent un nom ; on peut ensuite y fonder des cités et des ports, reliés par la mer.
 */
export function crossSea(world: World, seaId: string): World {
  const f = worldFrame(world);
  const sea = (world.seas ?? []).find((s) => s.id === seaId);
  if (f.legacy || !sea || sea.crossed || !sea.side) return world;
  const sc = SCALES[f.scale];
  const reach = sea.r * 1.15 + sc.h * 0.25;
  const b: [number, number, number, number] = [f.x0, f.y0, f.x1, f.y1];
  if (sea.side === 'S') b[3] = Math.max(b[3], sea.y + reach);
  if (sea.side === 'N') b[1] = Math.min(b[1], sea.y - reach);
  if (sea.side === 'E') b[2] = Math.max(b[2], sea.x + reach);
  if (sea.side === 'O') b[0] = Math.min(b[0], sea.x - reach);
  const off = sea.r * 1.3;
  const at = sea.side === 'S' ? [sea.x, sea.y + off] : sea.side === 'N' ? [sea.x, sea.y - off] : sea.side === 'E' ? [sea.x + off, sea.y] : [sea.x - off, sea.y];
  const id = String((world.lands ?? []).length + 1);
  return {
    ...world, bounds: b.map((v) => Math.round(v)) as [number, number, number, number], lat: f.lat,
    seas: (world.seas ?? []).map((s) => (s.id === seaId ? { ...s, crossed: true } : s)),
    lands: [...(world.lands ?? []), { id, name: landNameOf(world.seed, id), side: sea.side, x: Math.round(at[0]), y: Math.round(at[1]) }],
  };
}
/** Agrandit le monde d'une bande d'un côté. Le relief est défini partout : rien de ce qui existe ne change. */
export function expandWorld(world: World, side: Side): World {
  const f = worldFrame(world);
  if (f.legacy || !growSides(world).includes(side)) return world;
  return { ...world, bounds: grown(world, side), lat: f.lat };
}
/** Nom d'une mer : celui qu'on lui a donné, sinon celui que la carte affiche. */
export const seaName = (world: World, s: Sea) => s.name ?? seaNameOf(world.seed, s.id);

/** Où mettre un port : sur la côte d'une mer existante (la meilleure), ou près d'une nouvelle mer. */
export function portChoices(world: World, spec: CitySpec) {
  const frame = worldFrame(world);
  const cities = world.cities.filter((c) => c.id !== spec.id);
  const others = cities.map((c) => ({ ...c, km: cityKm(frame, c) }));
  const pts = others.map((o) => o.km);
  const wants = wantsOf(world, spec, cities);
  const seas = world.seas ?? [];
  const full = reliefOf(world, frame, others);
  const valid = (km: [number, number] | undefined, relief = full) => !!km && elevationAt(relief, km[0], km[1]) > 4 && !!seaSideAt(relief, km, Math.max(cityRadiusKm(spec), 0.4) * 1.5);
  let existing: { sea: Sea; km: [number, number]; score: number } | null = null;
  for (const sea of seas) {
    const p = placeOn({ ...full, seas: full.seas.filter((s) => s.x === sea.x && s.y === sea.y) }, frame, pts, spec, wants, world.seed);
    if (p && valid(p.km) && (!existing || p.score > existing.score)) existing = { sea, km: p.km, score: p.score };
  }
  const land = placeOn(full, frame, pts, { ...spec, port: false }, wants, world.seed);
  const free = growSides({ ...world, seas: [] }).filter((s) => !seas.some((m) => m.side === s));
  let fresh: { sea: Sea; km: [number, number]; score: number } | null = null;
  if (free.length) {
    const at = land?.km ?? [(frame.x0 + frame.x1) / 2, (frame.y0 + frame.y1) / 2];
    const dist: Record<Side, number> = { O: at[0] - frame.x0, E: frame.x1 - at[0], N: at[1] - frame.y0, S: frame.y1 - at[1] };
    const side = free.sort((a, b) => dist[a] - dist[b])[0];
    const id = String(seas.length + 1);
    const sea: Sea = { ...seaBeyond(frame, at, id, side), name: seaNameOf(world.seed, id) };
    const withSea = reliefOf({ ...world, seas: [...seas, sea] }, frame, others);
    const p = placeOn({ ...withSea, seas: withSea.seas.filter((s) => s.x === sea.x && s.y === sea.y) }, frame, pts, spec, wants, world.seed);
    if (p && valid(p.km, withSea)) fresh = { sea, km: p.km, score: p.score };
  }
  return { existing, fresh };
}

/**
 * Monde à l'échelle : place la cité (km) selon ses distances voulues, à l'écart des autres. Si la place manque (ou si
 * une distance voulue sort du monde), le monde s'agrandit d'une bande du bon côté. Un port va sur la côte d'une mer
 * (`choice` : une mer existante ou une nouvelle mer ; sinon la meilleure des deux).
 */
function withCityKm(world: World, cities: CitySpec[], spec: CitySpec, choice?: { sea: Sea; km: [number, number] }): World {
  let w = world;
  let km = spec.km ?? choice?.km ?? null;
  let seas = w.seas ?? [];
  if (choice && !seas.some((s) => s.id === choice.sea.id)) seas = [...seas, choice.sea];
  w = { ...w, seas };
  if (!km) {
    const attempt = (ww: World) => {
      const f = worldFrame(ww);
      const others = cities.map((c) => ({ ...c, km: cityKm(f, c) }));
      return placeOn(reliefOf(ww, f, others), f, others.map((o) => o.km), spec, wantsOf(ww, spec, cities), ww.seed);
    };
    if (spec.port) {
      const pc = portChoices(w, spec);
      const pick = pc.existing && (!pc.fresh || pc.existing.score >= pc.fresh.score - 1) ? pc.existing : pc.fresh;
      if (pick) { km = pick.km; if (!seas.some((s) => s.id === pick.sea.id)) w = { ...w, seas: [...seas, pick.sea] }; }
    }
    if (!km) {
      let best = attempt(w);
      /** Plus grand écart relatif aux distances voulues (0 = toutes tenues). */
      const err = (ww: World, km?: [number, number]) => (km ? Math.max(0, ...wantsOf(ww, spec, cities).map((x) => Math.abs(Math.hypot(km[0] - x.km[0], km[1] - x.km[1]) - x.dist) / x.dist)) : 9);
      // Trop serré, ou une distance voulue hors du monde : on essaie d'agrandir (trois bandes au plus).
      for (let n = 0; n < 3 && (!best || best.score < -4 || err(w, best.km) > 0.2); n++) {
        let better: { w: World; p: NonNullable<ReturnType<typeof attempt>>; e: number } | null = null;
        for (const side of growSides(w)) {
          const ww = expandWorld(w, side), p = attempt(ww);
          if (p && (!better || p.score > better.p.score)) better = { w: ww, p, e: err(ww, p.km) };
        }
        if (!better || (best && better.p.score < best.score + 1 && better.e > err(w, best.km) - 0.1)) break;
        w = better.w; best = better.p;
      }
      const f = worldFrame(w);
      km = best?.km ?? [(f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2];
    }
  }
  const f = worldFrame(w);
  const others = cities.map((c) => ({ ...c, km: cityKm(f, c) }));
  const seaDir = spec.port ? spec.seaDir ?? seaSideAt(reliefOf(w, f, others), km, Math.max(cityRadiusKm(spec), 0.4) * 1.5) ?? 'S' : undefined;
  const { at: _at, ...rest } = spec;
  void _at;
  return { ...w, cities: [...cities, { ...rest, km, seaDir }], defaultCityId: w.defaultCityId ?? spec.id };
}

/**
 * Patch d'enregistrement d'un monde : si ses bornes ont changé, les positions gardées sur le plan monde (groupe, repères,
 * chemins parcourus, personnage du MJ) sont recalées pour ne pas bouger sur le terrain.
 */
export function worldPatch(rec: MapRecord, next: World): Partial<MapRecord> {
  const a = worldFrame(rec.world), b = worldFrame(next);
  const same = a.legacy === b.legacy && a.x0 === b.x0 && a.y0 === b.y0 && a.x1 === b.x1 && a.y1 === b.y1;
  if (same || a.legacy || b.legacy) return { world: next, updatedAt: Date.now() };
  const wid = worldPlanId(rec.id);
  const f = ([u, v]: [number, number]): [number, number] => toAt(b, toKm(a, [u, v]));
  const world = next.avatar ? {
    ...next, avatar: {
      ...next.avatar,
      ...(next.avatar.at?.planId === wid ? { at: { ...next.avatar.at, at: f(next.avatar.at.at) } } : {}),
      ...(next.avatar.hidden?.planId === wid ? { hidden: { ...next.avatar.hidden, at: f(next.avatar.hidden.at) } } : {}),
    },
  } : next;
  return { world, overlay: rec.overlay ? remapPlan(rec.overlay, wid, f) : rec.overlay, updatedAt: Date.now() };
}
const isPt = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number';
/** Recale toutes les coordonnées (0–1) rattachées à un plan, dans une structure quelconque (calque du MJ). */
export function remapPlan<T>(value: T, planId: string, f: (p: [number, number]) => [number, number], on = false): T {
  if (Array.isArray(value)) return (on && value.every(isPt) ? value.map((p) => f(p as [number, number])) : value.map((x) => remapPlan(x, planId, f, on))) as T;
  if (!value || typeof value !== 'object') return value;
  const o = value as Record<string, unknown>;
  const here = o.planId === planId || o.mapId === planId || on;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (k === 'explored' && v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = Object.fromEntries(Object.entries(v as Record<string, [number, number][]>).map(([pid, pts]) => [pid, pid === planId ? pts.map(f) : pts]));
    } else if (here && isPt(v)) out[k] = f(v);
    else out[k] = remapPlan(v, planId, f, here && Array.isArray(v) && (v as unknown[]).every(isPt));
  }
  if (here && typeof o.x === 'number' && typeof o.y === 'number') { const [x, y] = f([o.x, o.y]); out.x = x; out.y = y; }
  return out as T;
}

/** Déplace une cité (position 0–1 sur le plan monde). Son plan ne change pas : rien n'y bouge. */
export function moveCity(world: World, id: string, at: [number, number]): World {
  const frame = worldFrame(world);
  return {
    ...world,
    cities: world.cities.map((c) => {
      if (c.id !== id) return c;
      if (frame.legacy) return { ...c, at };
      const km = toKm(frame, at);
      const others = world.cities.filter((x) => x.id !== id).map((x) => ({ ...x, km: cityKm(frame, x) }));
      const side = c.port ? seaSideAt(reliefOf(world, frame, others), km, Math.max(cityRadiusKm(c), 0.4) * 1.5) : null;
      return { ...c, km, ...(side ? { seaDir: side } : {}) };
    }),
  };
}

/** Replace une cité selon ses distances voulues (même graine : même résultat). */
export function replaceCity(world: World, id: string): World {
  const c = world.cities.find((x) => x.id === id);
  if (!c || worldFrame(world).legacy) return world;
  const { km: _km, seaDir: _s, ...spec } = c;
  void _km; void _s;
  const next = withCity({ ...world, cities: world.cities.filter((x) => x.id !== id) }, spec);
  return { ...next, cities: world.cities.map((x) => (x.id === id ? next.cities.find((y) => y.id === id)! : x)), defaultCityId: world.defaultCityId };
}

/**
 * Change l'échelle d'un monde. Un ancien monde passe au relief à l'échelle : les cités gardent leur disposition (et
 * leur plan) ; les éléments naturels sont redessinés. Les ports gardent une mer du même côté.
 */
export function withScale(world: World, scale: 'region' | 'royaume' | 'continent'): World {
  const from = worldFrame(world);
  const sc = SCALES[scale];
  const to = worldFrame({ ...world, terrain: 2, scale, bounds: undefined, lat: undefined } as World);
  const cities = world.cities.map((c) => ({ ...c, km: toKm(to, toAt(from, cityKm(from, c))), at: undefined }));
  const k = (to.x1 - to.x0) / (from.x1 - from.x0);
  let seas = from.legacy ? [] : (world.seas ?? []).map((s) => ({ ...s, x: s.x * k, y: s.y * k, r: s.r * k }));
  if (from.legacy) for (const c of cities.filter((x) => x.port)) {
    if (!seas.some((s) => s.side === c.seaDir)) seas = [...seas, { ...seaBeyond(to, c.km, String(seas.length + 1)), side: c.seaDir }];
  }
  void sc;
  return { ...world, terrain: 2, scale, bounds: undefined, lat: undefined, seas, cities };
}

export type Travel = { id: string; name: string; km: number; effort: number; road: boolean; dir: string; seaKm?: number };
/** Distances depuis une cité : par la route (le plus court chemin dans le réseau), sinon à vol d'oiseau. */
export function travelFrom(world: World, data: AtlasData, fromId: string): Travel[] {
  const frame = worldFrame(world);
  const routes = ((data as AtlasData & { routes?: { a: string; b: string; km: number; effort: number; sea?: boolean }[] }).routes) ?? [];
  const best = new Map<string, { km: number; effort: number; seaKm: number }>([[fromId, { km: 0, effort: 0, seaKm: 0 }]]);
  const todo = [fromId];
  while (todo.length) {
    const u = todo.shift()!;
    const bu = best.get(u)!;
    for (const r of routes) {
      const v = r.a === u ? r.b : r.b === u ? r.a : null;
      if (!v) continue;
      const cand = { km: bu.km + r.km, effort: bu.effort + r.effort, seaKm: bu.seaKm + (r.sea ? r.km : 0) };
      if (!best.has(v) || best.get(v)!.effort > cand.effort) { best.set(v, cand); todo.push(v); }
    }
  }
  const from = world.cities.find((c) => c.id === fromId);
  if (!from) return [];
  const a = cityKm(frame, from);
  return world.cities.filter((c) => c.id !== fromId).map((c) => {
    const b = cityKm(frame, c);
    const r = best.get(c.id);
    const straight = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return r
      ? { id: c.id, name: c.name, km: r.km, effort: r.effort, road: true, dir: dirName(a, b), seaKm: r.seaKm }
      : { id: c.id, name: c.name, km: Math.round(straight * 10) / 10, effort: straight * 1.3, road: false, dir: dirName(a, b) };
  }).sort((x, y) => x.effort - y.effort);
}
export { PACE };

/** Distances voulues non respectées (écart de plus d'un tiers, ou mauvaise direction) : pour avertir le MJ. */
export function unmetWants(world: World, c: CitySpec): string[] {
  const frame = worldFrame(world);
  const here = cityKm(frame, c);
  return wantsOf(world, c).flatMap((w) => {
    const d = Math.hypot(here[0] - w.km[0], here[1] - w.km[1]);
    const dirOk = w.dir === undefined || Math.abs(Math.atan2(Math.sin(Math.atan2(here[1] - w.km[1], here[0] - w.km[0]) - w.dir), Math.cos(Math.atan2(here[1] - w.km[1], here[0] - w.km[0]) - w.dir))) < Math.PI / 4 + 0.05;
    if (Math.abs(d - w.dist) / w.dist <= 0.34 && dirOk) return [];
    return [`voulue « ${w.label ?? `${w.dist} km de ${w.to.name}`} », elle est à ${Math.round(d)} km ${atDir(dirName(w.km, here))} de ${w.to.name}`];
  });
}

/** Cité tirée d'une fiche de lieu (paramètres lus sur la fiche). */
export const cityFromEntry = (entry: LoreEntry): CitySpec => citySpecFromEntry(entry);

/** Fiches de lieu qui décrivent une cité, pas encore sur la carte. */
export function settlementEntries(world: World, library: LoreEntry[]): LoreEntry[] {
  const used = new Set(world.cities.map((c) => c.entryId ?? c.id));
  return library.filter((e) => e.archiveType === 'place' && !used.has(e.id) && isSettlement(e));
}

/**
 * Garde la carte du monde à jour avec le lore : chaque fiche de lieu rattachée à une cité y prend un bâtiment,
 * avec les PNJ qui s'y trouvent. N'écrit que si quelque chose a changé.
 */
export function useWorldSync(rec: MapRecord, library: LoreEntry[] | undefined, people: LoreEntry[] | undefined, onUpdate: (patch: Partial<MapRecord>) => void, hidden: string[] = []) {
  const update = useRef(onUpdate);
  update.current = onUpdate;
  const revealedKey = (rec.overlay?.revealed ?? []).join('|');
  useEffect(() => {
    if (rec.kind !== 'monde' || !rec.world || !library) return;
    const places = library.filter((e) => e.archiveType === 'place');
    // Les hameaux de la carte accueillent aussi les lieux du lore qui les nomment.
    const villages = (worldAtlas(rec) as AtlasData & { villages?: CitySpec[] }).villages ?? [];
    const { bindings, changed } = syncBindings({
      world: { ...rec.world, cities: [...rec.world.cities, ...villages] }, mapRecordId: rec.id, places, people: [...(people ?? []), ...library.filter((e) => e.archiveType === 'person')],
      revealed: new Set(rec.overlay?.revealed ?? []), hidden: new Set(hidden),
    });
    if (changed) update.current({ world: { ...rec.world, bindings }, updatedAt: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.kind, rec.id, rec.world, library, people, revealedKey, hidden.join('|')]);
}

/** Mer d'un port : la plus proche de la cité. */
export function portSea(world: World, c: CitySpec): Sea | undefined {
  const f = worldFrame(world), k = cityKm(f, c);
  return (world.seas ?? []).map((s) => ({ s, d: Math.hypot(s.x - k[0], s.y - k[1]) - s.r })).sort((a, b) => a.d - b.d)[0]?.s;
}

/* ——— Lieux sauvages (wilds.js) ——— */

/** Largeur de vue (km) en dessous de laquelle les brouillons de lieux sauvages apparaissent pour le MJ. */
export const WILD_VIEW_KM = 90;
/** Largeur de vue (km) en dessous de laquelle les petits lieux (ruisseaux, sentiers, vieux chênes…) apparaissent aussi. */
export const NOOK_VIEW_KM = 14;
const reliefCache = new Map<string, ReturnType<typeof reliefOf>>();
/** Relief d'un monde à l'échelle (le même que celui du dessin), gardé en mémoire. */
function worldRelief(world: World) {
  const frame = worldFrame(world);
  const key = JSON.stringify([world.seed, world.bounds, world.scale, world.seas, world.climate, world.season, world.lat, world.cities.map((c) => [c.id, c.km, c.at, c.population, c.port])]);
  let r = reliefCache.get(key);
  if (!r) {
    const cities = world.cities.map((c) => ({ ...citySpecDefaults(c), km: cityKm(frame, c) }));
    r = reliefOf(world, frame, cities);
    reliefCache.set(key, r);
    if (reliefCache.size > 3) reliefCache.delete(reliefCache.keys().next().value!);
  }
  let lakes = lakesCache.get(r);
  if (!lakes) { lakes = worldLakes(r); lakesCache.set(r, lakes); }
  return { frame, relief: r, lakes };
}
const lakesCache = new WeakMap<object, [number, number][][]>();
const gridCache = new WeakMap<object, ReturnType<typeof travelGrid>>();

/** Enregistrement d'un lieu sauvage (pour le garder, le définir, l'écarter ou le montrer aux joueurs). */
export const wildRecordOf = (s: WildSite): WildRecord => ({
  key: s.key, km: s.km, kind: s.kind, cat: s.cat, title: s.title, teneur: s.teneur, danger: s.danger,
  text: s.text, scene: s.scene, hook: s.hook, where: whereLabel(s) || undefined, biome: s.biome, e: s.e, forest: s.forest,
});

/**
 * Brouillons de lieux sauvages dans une fenêtre du plan monde (`box` en 0–1), pour le MJ seulement. La fenêtre est
 * arrondie à des blocs de 30 km, pour ne pas tout recalculer à chaque glissement. Rien pour un ancien monde.
 */
export function wildDrafts(rec: MapRecord, data: AtlasData, box: [number, number, number, number] | null) {
  const world = rec.world;
  if (!world || !box) return null;
  const { frame, relief, lakes } = worldRelief(world);
  if (frame.legacy) return null;
  const [a0, b0] = toKm(frame, [box[0], box[1]]), [a1, b1] = toKm(frame, [box[2], box[3]]);
  if (a1 - a0 > WILD_VIEW_KM) return null;
  const B = 30, snap = (v: number, up: boolean) => (up ? Math.ceil(v / B) : Math.floor(v / B)) * B;
  const win: [number, number, number, number] = [snap(a0, false), snap(b0, false), snap(a1, true), snap(b1, true)];
  const wid = worldPlanId(rec.id);
  const roads = data.geometries
    .filter((g) => g.mapId === wid && g.type === 'polyline' && /:route|route-/.test(g.featureId))
    .map((g) => (g.coordinates as [number, number][]).map((p) => toKm(frame, p)));
  const cities = world.cities.map((c) => ({ name: c.name, km: cityKm(frame, c), r: cityRadiusKm(citySpecDefaults(c)) }));
  const ctx = { seed: world.seed, relief, cities, roads, lakes, density: world.wildDensity };
  const skip = new Set(Object.keys(world.wilds ?? {}));
  const sites = wildSitesIn(ctx, win, skip);
  // Au zoom rapproché : les petits lieux, sur une fenêtre arrondie plus finement (blocs de 4 km).
  let nookKey = '';
  if (a1 - a0 <= NOOK_VIEW_KM) {
    const S = 4, sn = (v: number, up: boolean) => (up ? Math.ceil(v / S) : Math.floor(v / S)) * S;
    const nb: [number, number, number, number] = [sn(a0, false), sn(b0, false), sn(a1, true), sn(b1, true)];
    nookKey = nb.join(',');
    sites.push(...nookSitesIn(ctx, nb, skip));
  }
  const base = { canonStatus: 'creation' as const, placementStatus: 'documented' as const };
  const features = sites.map((s) => ({ ...base, ...wildFeatureOf(wildRecordOf(s), wid), draft: true, minZoom: 0, importance: 'detail' as const, ...(s.nook ? { nook: true } : {}) }));
  const geometries = sites.map((s) => ({ id: `g-${wid}:wild-${s.key}`, mapId: wid, featureId: `${wid}:wild-${s.key}`, type: 'point' as const, coordinates: toAt(frame, s.km) }));
  return { key: `${win.join(',')}|${nookKey}`, sites, features, geometries };
}

/**
 * Entrer n'importe où en pleine nature, sans lieu particulier : un enregistrement « sous-bois » ou « en pleine nature »
 * au point `at` (0–1 du plan monde), que le MJ peut garder, nommer et visiter comme un lieu sauvage.
 */
export function spotRecord(rec: MapRecord, data: AtlasData, at: [number, number]): WildRecord | null {
  const world = rec.world;
  if (!world) return null;
  const { frame, relief, lakes } = worldRelief(world);
  if (frame.legacy) return null;
  const wid = worldPlanId(rec.id);
  const roads = data.geometries
    .filter((g) => g.mapId === wid && g.type === 'polyline' && /:route|route-/.test(g.featureId))
    .map((g) => (g.coordinates as [number, number][]).map((p) => toKm(frame, p)));
  const cities = world.cities.map((c) => ({ name: c.name, km: cityKm(frame, c), r: cityRadiusKm(citySpecDefaults(c)) }));
  const s = spotSite({ seed: world.seed, relief, cities, roads, lakes }, toKm(frame, at), wildernessLabel(rec, at));
  return s ? wildRecordOf(s) : null;
}

/** Un lieu sauvage aperçu depuis la route : où (km le long du trajet), de quel côté, et s'il faut le chercher. */
export type WildSighting = { record: WildRecord; id: string; s: number; d: number; at: [number, number]; side: 'gauche' | 'droite'; known: boolean; dc?: number; line: string };

/**
 * Lieux sauvages visibles le long d'un trajet du plan monde (`pts` en 0–1) : brouillons et lieux enregistrés (sauf
 * écartés), à portée de vue selon le terrain. Triés dans l'ordre de la marche. `s` et `d` en km.
 */
export function wildAlong(rec: MapRecord, data: AtlasData, pts: [number, number][], revealed: string[] = []): WildSighting[] {
  const world = rec.world;
  if (!world || pts.length < 2) return [];
  const { frame, relief, lakes } = worldRelief(world);
  if (frame.legacy) return [];
  const wid = worldPlanId(rec.id);
  const km = pts.map((p) => toKm(frame, p));
  const pad = 7;
  const box: [number, number, number, number] = [
    Math.min(...km.map((p) => p[0])) - pad, Math.min(...km.map((p) => p[1])) - pad, Math.max(...km.map((p) => p[0])) + pad, Math.max(...km.map((p) => p[1])) + pad,
  ];
  const kept = world.wilds ?? {};
  const roads = data.geometries.filter((g) => g.mapId === wid && g.type === 'polyline' && /:route-/.test(g.featureId)).map((g) => (g.coordinates as [number, number][]).map((p) => toKm(frame, p)));
  const cities = world.cities.map((c) => ({ name: c.name, km: cityKm(frame, c), r: cityRadiusKm(citySpecDefaults(c)) }));
  const drafts = wildSitesIn({ seed: world.seed, relief, cities, roads, lakes, density: world.wildDensity }, box, new Set(Object.keys(kept))).map(wildRecordOf);
  const records = [...drafts, ...Object.values(kept).filter((w) => w && !w.excluded && w.km && w.km[0] >= box[0] && w.km[0] <= box[2] && w.km[1] >= box[1] && w.km[1] <= box[3])];
  const out: WildSighting[] = [];
  for (const r of records) {
    const rk = r.km!;
    const pr = project(km, rk);
    const sight = sightOf(r, r.forest ?? 0);
    if (pr.d > sight.km) continue;
    // Côté, dans le sens de la marche (y vers le bas : produit vectoriel positif = à droite).
    const ahead = subpath(km, pr.s, Math.min(lengthOf(km), pr.s + 0.5));
    const b = ahead[ahead.length - 1], a = ahead[0];
    const cross = (b[0] - a[0]) * (rk[1] - pr.at[1]) - (b[1] - a[1]) * (rk[0] - pr.at[0]);
    const id = `${wid}:wild-${r.key}`;
    out.push({ record: r, id, s: pr.s, d: pr.d, at: toAt(frame, rk), side: cross > 0 ? 'droite' : 'gauche', known: revealed.includes(id), dc: sight.dc, line: sight.line });
  }
  return out.sort((x, y) => x.s - y.s);
}

/** Le début d'un trajet du plan monde (0–1), jusqu'à `sKm` km de marche. */
export function cutWalk(rec: MapRecord, pts: [number, number][], sKm: number): [number, number][] {
  const frame = worldFrame(rec.world);
  const km = pts.map((p) => toKm(frame, p));
  return subpath(km, 0, sKm).map((p) => toAt(frame, p));
}
/** Longueur (km) d'un trajet du plan monde. */
export const walkKm = (rec: MapRecord, pts: [number, number][]) => { const f = worldFrame(rec.world); return lengthOf(pts.map((p) => toKm(f, p))); };

/* ——— Hors route (lot 25) ——— */

/** Trajet à travers la campagne : points (0–1), km parcourus, effort (km équivalents), heures de marche, terrain traversé. */
export type CrossPath = { pts: [number, number][]; km: number; effort: number; hours: number; forest: number; mountain: number; snow: number; maxE: number };

/**
 * Chemin le moins pénible d'un point à un autre du plan monde (0–1), à travers champs : il suit les vallées et les cols,
 * contourne la mer et les lacs. L'effort compte pleinement la pente, la forêt, la neige et la haute montagne ; une heure
 * de marche couvre 4,8 km d'effort. `null` si c'est infranchissable (île, autre rive) ou un ancien monde.
 */
export function crossPath(rec: MapRecord, from: [number, number], to: [number, number]): CrossPath | null {
  const world = rec.world;
  if (!world) return null;
  const { frame, relief, lakes } = worldRelief(world);
  if (frame.legacy) return null;
  let grid = gridCache.get(relief);
  if (!grid) { grid = travelGrid(relief, lakes); gridCache.set(relief, grid); }
  const a = toKm(frame, from), b = toKm(frame, to);
  const r = routeOn(grid, a, b);
  if (!r) return null;
  let effort = 0, forest = 0, mountain = 0, snow = 0, maxE = 0, total = 0;
  for (let i = 1; i < r.pts.length; i++) {
    const p = r.pts[i - 1], q = r.pts[i];
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    effort += crossCountry(grid, p, q).effort;
    const t = terrainAt(relief, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    total += d;
    if (t.forest > 0.5) forest += d;
    if (t.e > 900) mountain += d;
    if (t.biome === 'neige') snow += d;
    maxE = Math.max(maxE, t.e);
  }
  const share = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  return {
    pts: r.pts.map((p) => toAt(frame, p as [number, number])), km: Math.round(r.km * 10) / 10, effort: Math.round(effort * 10) / 10,
    hours: effort / 4.8, forest: share(forest), mountain: share(mountain), snow: share(snow), maxE: Math.round(maxE),
  };
}

/** Nom d'un point en pleine nature (destination hors route) : « Cœur de la forêt », « Flanc de montagne »… */
export function wildernessLabel(rec: MapRecord, at: [number, number]): string {
  const world = rec.world;
  if (!world) return 'En pleine nature';
  const { frame, relief } = worldRelief(world);
  const t = terrainAt(relief, ...toKm(frame, at));
  if (t.e > 1800) return 'Haute montagne';
  if (t.e > 900) return 'Flanc de montagne';
  if (t.biome === 'neige') return 'Étendue enneigée';
  if (t.forest > 0.75) return 'Cœur de la forêt';
  if (t.forest > 0.4) return 'Lisière de forêt';
  if (t.biome === 'desert') return 'En plein désert';
  if (t.biome === 'steppe') return 'Steppe';
  if (t.biome === 'taiga') return 'Taïga';
  return t.e > 500 ? 'Collines' : 'Campagne';
}

/* ——— Les environs, à pied (zonePlan.js) ——— */

/** Contexte des lieux sauvages d'un monde (relief, cités, routes, lacs), pour un tirage hors de la vue. */
function wildCtx(rec: MapRecord, data: AtlasData) {
  const world = rec.world!;
  const { frame, relief, lakes } = worldRelief(world);
  const wid = worldPlanId(rec.id);
  const roads = data.geometries
    .filter((g) => g.mapId === wid && g.type === 'polyline' && /:route|route-/.test(g.featureId))
    .map((g) => (g.coordinates as [number, number][]).map((p) => toKm(frame, p)));
  const cities = world.cities.map((c) => ({ name: c.name, km: cityKm(frame, c), r: cityRadiusKm(citySpecDefaults(c)) }));
  return { frame, relief, lakes, roads, cities, ctx: { seed: world.seed, relief, cities, roads, lakes, density: world.wildDensity } };
}

/** Plans des environs visités : le terrain, et une entrée sur la carte du monde pour y revenir (zoom ou bouton). */
function withZones(rec: MapRecord, d: AtlasData): AtlasData {
  const world = rec.world!;
  const { frame, relief, lakes, roads, ctx } = wildCtx(rec, d);
  if (frame.legacy) return d;
  const wid = worldPlanId(rec.id);
  const rivers = worldRivers(relief);
  const out = { ...d, maps: [...d.maps], features: [...d.features], geometries: [...d.geometries], spaces: [...d.spaces] };
  const inLake = (x: number, y: number) => lakes.some((poly) => { let ins = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) { const [xa, ya] = poly[a], [xb, yb] = poly[b]; if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) ins = !ins; } return ins; });
  for (const z of Object.values(world.zones ?? {})) {
    const pid = zonePlanId(wid, z.key);
    const box = zoneBox(z.km);
    const kept = Object.values(world.wilds ?? {}).filter((w) => w.km && !w.excluded && w.km[0] > box[0] && w.km[0] < box[2] && w.km[1] > box[1] && w.km[1] < box[3]);
    const skip = new Set(Object.keys(world.wilds ?? {}));
    const sites = [...kept.map((w) => ({ key: w.key, km: w.km!, kind: w.kind })), ...wildSitesIn(ctx, box, skip), ...nookSitesIn(ctx, box, skip)];
    const map = generateZonePlan(z, pid, {
      seed: world.seed, rivers, roads, lakes, sites,
      sample: (x, y) => { const t = terrainAt(relief, x, y); return { forest: t.forest, e: t.e, biome: t.biome, moist: t.moist, water: !!t.sea || inLake(x, y) }; },
    });
    out.maps.push(map);
    out.spaces.push({ id: map.scope.id, kind: 'site', name: z.title, levelId: 'monde', stratumIds: [], mapId: pid } as AtlasData['spaces'][number]);
    // Sur la carte du monde : un repère discret qui rouvre les environs.
    const fid = `${wid}:zone-${z.key}`;
    out.features.push({ id: fid, title: z.title, summary: 'Les environs, à pied : bosquets, sentiers, ruisseaux et petits lieux.', category: 'vivant', importance: 'detail', minZoom: 2,
      canonStatus: 'creation', placementStatus: 'documented', opens: { kind: 'site', id: map.scope.id } } as AtlasData['features'][number]);
    out.geometries.push({ id: `g-${fid}`, mapId: wid, featureId: fid, type: 'point', coordinates: toAt(frame, z.km) });
    // Les lieux sauvages enregistrés de la zone y sont aussi (même lieu, une position de plus).
    for (const w of kept) out.geometries.push({ id: `g-${pid}-${w.key}`, mapId: pid, featureId: `${wid}:wild-${w.key}`, type: 'point', coordinates: zoneAt(z.km, w.km!) });
  }
  return out;
}

/** Les environs d'un point du plan monde (0–1) : la zone existante la plus proche (moins de 1,5 km), ou une nouvelle. */
export function zoneFor(rec: MapRecord, data: AtlasData, at: [number, number]): { key: string; km: [number, number]; title: string } | null {
  const world = rec.world;
  if (!world) return null;
  const { frame, relief, lakes } = worldRelief(world);
  if (frame.legacy) return null;
  const km = toKm(frame, at);
  const near = Object.values(world.zones ?? {}).map((z) => ({ z, d: Math.hypot(z.km[0] - km[0], z.km[1] - km[1]) })).sort((a, b) => a.d - b.d)[0];
  if (near && near.d < 1.5) return near.z;
  const t = terrainAt(relief, km[0], km[1]);
  if (t.sea || lakes.some((poly) => { let ins = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) { const [xa, ya] = poly[a], [xb, yb] = poly[b]; if ((ya > km[1]) !== (yb > km[1]) && km[0] < ((xb - xa) * (km[1] - ya)) / (yb - ya) + xa) ins = !ins; } return ins; })) return null;
  // Son nom : la forêt ou les monts dont on est au cœur, sinon le terrain (« Lisière de forêt »…).
  const wid = worldPlanId(rec.id);
  const landmark = data.features
    .filter((f) => f.area && /:(foret|monts)-/.test(f.id))
    .map((f) => ({ f, g: data.geometries.find((g) => g.featureId === f.id && g.mapId === wid) }))
    .filter((x) => x.g)
    .map((x) => ({ f: x.f, d: Math.hypot(...(toKm(frame, x.g!.coordinates as [number, number]).map((v, i) => v - km[i]) as [number, number])) }))
    .sort((a, b) => a.d - b.d)[0];
  const label = wildernessLabel(rec, at);
  const title = landmark && landmark.d < 25 && (t.forest > 0.4 || /monts/.test(landmark.f.id)) ? `${landmark.f.title} · environs` : `${label} · environs`;
  return { key: zoneKey(km), km: [Math.round(km[0] * 1000) / 1000, Math.round(km[1] * 1000) / 1000], title };
}

/** Zone d'un plan (`…:zone-<clé>:plan`), si c'en est un. */
export function zoneOfPlan(rec: MapRecord, planId: string) {
  const m = planId.match(/:zone-([^:]+):plan$/);
  return m ? rec.world?.zones?.[m[1]] ?? null : null;
}

/**
 * Brouillons des lieux sauvages d'une zone (petits et grands), posés sur son plan, pour le MJ seulement (comme ceux
 * de la carte du monde, wildDrafts) : il les garde, les définit ou y entre.
 */
export function zoneDrafts(rec: MapRecord, data: AtlasData, planId: string) {
  const z = zoneOfPlan(rec, planId);
  if (!z || !rec.world) return null;
  const { ctx } = wildCtx(rec, data);
  const box = zoneBox(z.km);
  const skip = new Set(Object.keys(rec.world.wilds ?? {}));
  const sites = [...wildSitesIn(ctx, box, skip), ...nookSitesIn(ctx, box, skip)].filter((s) => s.km[0] > box[0] && s.km[0] < box[2] && s.km[1] > box[1] && s.km[1] < box[3]);
  const wid = worldPlanId(rec.id);
  const base = { canonStatus: 'creation' as const, placementStatus: 'documented' as const };
  const features = sites.map((s) => ({ ...base, ...wildFeatureOf(wildRecordOf(s), wid), draft: true, minZoom: 0, importance: 'local' as const }));
  const geometries = sites.map((s) => ({ id: `g-${planId}-${s.key}`, mapId: planId, featureId: `${wid}:wild-${s.key}`, type: 'point' as const, coordinates: zoneAt(z.km, s.km) }));
  return { key: planId, sites, features, geometries };
}
