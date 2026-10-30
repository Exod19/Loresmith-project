/**
 * Carte du monde : raccord entre le générateur (generate.js, lore.js) et l'application.
 * Une carte « monde » ne stocke que ses paramètres (graine, cités, lieux posés) ; son dessin est recalculé à la demande,
 * identique d'une fois à l'autre, puis traité comme l'Atlas des profondeurs par le reste de l'application.
 */
import { useEffect, useRef } from 'react';
import { cityPlanId, generateWorld, hashSeed, interiorPlanId, placeCity, seaNameOf, worldPlanId, type CitySpec, type Sea, type WorldSpec } from './generate';
import { nearestEdge } from './climate';
import { DIR_ANGLE, PACE, atDir, SCALES, cityKm, cityRadiusKm, dirName, elevationAt, placeOn, reliefOf, seaBeyond, seaSideAt, toAt, toKm, worldFrame } from './terrain';
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
  const key = `${rec.id}|${JSON.stringify({ ...world, avatar: world.avatar && { ...world.avatar, at: undefined } })}`;
  let d = cache.get(key);
  if (!d) {
    d = generateWorld(world as WorldSpec, rec.id) as AtlasData;
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
export const growSides = (world: World): Side[] => SIDES.filter((s) => !(world.seas ?? []).some((m) => m.side === s));
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
    const p = placeOn({ ...withSea, seas: [{ x: sea.x, y: sea.y, r: sea.r }] }, frame, pts, spec, wants, world.seed);
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

export type Travel = { id: string; name: string; km: number; effort: number; road: boolean; dir: string };
/** Distances depuis une cité : par la route (le plus court chemin dans le réseau), sinon à vol d'oiseau. */
export function travelFrom(world: World, data: AtlasData, fromId: string): Travel[] {
  const frame = worldFrame(world);
  const routes = ((data as AtlasData & { routes?: { a: string; b: string; km: number; effort: number }[] }).routes) ?? [];
  const best = new Map<string, { km: number; effort: number }>([[fromId, { km: 0, effort: 0 }]]);
  const todo = [fromId];
  while (todo.length) {
    const u = todo.shift()!;
    const bu = best.get(u)!;
    for (const r of routes) {
      const v = r.a === u ? r.b : r.b === u ? r.a : null;
      if (!v) continue;
      const cand = { km: bu.km + r.km, effort: bu.effort + r.effort };
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
      ? { id: c.id, name: c.name, km: r.km, effort: r.effort, road: true, dir: dirName(a, b) }
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
export function useWorldSync(rec: MapRecord, library: LoreEntry[] | undefined, people: LoreEntry[] | undefined, onUpdate: (patch: Partial<MapRecord>) => void) {
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
      revealed: new Set(rec.overlay?.revealed ?? []),
    });
    if (changed) update.current({ world: { ...rec.world, bindings }, updatedAt: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.kind, rec.id, rec.world, library, people, revealedKey]);
}

/** Mer d'un port : la plus proche de la cité. */
export function portSea(world: World, c: CitySpec): Sea | undefined {
  const f = worldFrame(world), k = cityKm(f, c);
  return (world.seas ?? []).map((s) => ({ s, d: Math.hypot(s.x - k[0], s.y - k[1]) - s.r })).sort((a, b) => a.d - b.d)[0]?.s;
}
