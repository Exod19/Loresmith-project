/**
 * Instantanés envoyés à l'écran joueur. Ce module est le seul à décider de ce que voient les joueurs :
 * il part de la vue joueurs (sans notes, repères secrets ni jetons cachés) et ne garde que le plan montré.
 */
import type { AtlasData } from './atlas/types';
import { mapDataFor, placeCoords, restrictToPlan, DEFAULT_BATTLE, type MapRecord, type PartyPlace } from './mapStore';
import { effectiveGrid } from './battle/terrain';
import { cellIn } from './battle/local';
import { tokenImage } from './battle/vignettes';
import { applyBuild, PROP_BY_KEY, propUrl } from './battle/build';
import { CREATURE_LORE, KIND_LORE } from './battle/lore';
import { isSearchable } from './battle/search';
import { describeLite } from './atlas/lore';
import { STATS } from './atlas/statblocks';
import type { PlayerBoard, PlayerElement, PlayerToken, PlayerTurn } from '../present/stage';
import { initiativeOrder } from './battle/combat';
import { inSight, partyVision } from './battle/fog';
import { exitsOf } from './battle/trailRules';
import type { BattleToken } from './mapStore';

/** Durée pendant laquelle un dégât reste écrit sur le plateau. */
export const HIT_SHOW_MS = 4000;

/** État d'une créature en mots, comme le perçoivent les héros (jamais ses PV). */
export function woundState(t: Pick<BattleToken, 'hp' | 'maxHp'>): string | undefined {
  if (t.hp === undefined || !t.maxHp) return undefined;
  const r = t.hp / t.maxHp;
  return r <= 0 ? 'Hors de combat' : r >= 1 ? 'Indemne' : r > 0.5 ? 'Blessé' : r > 0.25 ? 'En sang' : 'À l’agonie';
}

/** Carte telle que les joueurs la voient, sur le plan choisi, centrée sur `focus` si le MJ l'a demandé. */
export function mapBoard(rec: MapRecord, atlas: AtlasData, planId: string, focus?: { kind: 'anchor' | 'point'; id: string; tick: number }): PlayerBoard {
  const data = restrictToPlan(mapDataFor(rec, atlas, false), planId);
  const view = rec.overlay?.playerView ?? {};
  const party = rec.overlay?.party;
  // Positions : calculées sur la carte complète du MJ, mais seules les coordonnées partent chez les joueurs.
  const full = view.party || view.heroes || view.fog ? mapDataFor(rec, atlas, true) : null;
  const at = (p?: PartyPlace) => (p && full && p.planId === planId ? placeCoords(full, rec, p) : null);
  const marks: NonNullable<Extract<PlayerBoard, { mode: 'map' }>['marks']> = [];
  const groupAt = at(party?.at);
  if (view.party && groupAt) marks.push({ id: 'party', x: groupAt[0], y: groupAt[1], label: 'Groupe', tone: 'party' });
  if (view.heroes) {
    const byPlace = new Map<string, string[]>();
    for (const h of party?.apart ?? []) byPlace.set(h.at.id, [...(byPlace.get(h.at.id) ?? []), h.name]);
    for (const [id, names] of byPlace) {
      const h = party!.apart!.find((x) => x.at.id === id)!;
      const c = at(h.at);
      if (c) marks.push({ id: `hero-${id}`, x: c[0], y: c[1], label: names.join(', '), tone: 'hero' });
    }
  }
  // Brouillard de guerre : se dévoile autour des lieux révélés, du groupe, de son parcours et des héros partis devant.
  let fog: { holes: [number, number][]; r: number } | undefined;
  if (view.fog) {
    const holes: [number, number][] = [];
    for (const g of data.geometries) {
      if (g.mapId !== planId) continue;
      if (g.type === 'point') holes.push(g.coordinates as [number, number]);
      else (g.coordinates as [number, number][]).forEach((c, i, all) => { if (i % 3 === 0 || i === all.length - 1) holes.push(c); });
    }
    for (const p of [party?.at, ...(party?.trail ?? []), ...(party?.apart ?? []).map((h) => h.at)]) { const c = at(p); if (c) holes.push(c); }
    for (const m of rec.overlay?.markers ?? []) if (m.revealed && m.planId === planId) holes.push([m.x, m.y]);
    fog = { holes, r: 0.045 };
  }
  return { mode: 'map', title: rec.title, planId, data, focus, marks: marks.length ? marks : undefined, fog };
}

/** Combat tel que les joueurs le voient : jetons visibles seulement, sans points de vie ni CA. */
/** `artOf` : illustration d'une créature par son nom (fiches des Archives), montrée en grand aux joueurs. */
export function battleBoard(rec: MapRecord, artOf?: (name: string, id: string) => string): PlayerBoard {
  const b = rec.battle ?? DEFAULT_BATTLE;
  const tokens: PlayerToken[] = b.tokens
    .filter((t) => t.visible)
    .map(({ id, name, kind, x, y, size, icon, image, statId, hp, maxHp, move, reach }) => {
      const portrait = tokenImage({ kind, statId, image });
      return {
        id, name, kind, x, y, size, icon, image: portrait, statId,
        active: id === b.turn || undefined,
        ...(kind === 'pc' ? { hp, maxHp, move, reach } : { state: woundState({ hp, maxHp }) }),
        info: { subtitle: (statId && STATS[statId]?.meta) || undefined, text: (statId && CREATURE_LORE[statId]) || KIND_LORE[kind], image: artOf?.(name, id) || portrait },
      };
    });
  const local = b.local;
  const revealed = rec.overlay?.revealed ?? [];
  // Les joueurs ne voient que les éléments visibles : un objet n'apparaît que lorsque le MJ le révèle. Les passages
  // (galeries) ne sont pas surlignés sur l'écran de combat : le terrain les montre, et les sorties au bord suffisent.
  // Lieux de l'Atlas : visibles une fois révélés sur la carte de navigation, comme les autres repères de l'Atlas.
  const places: PlayerElement[] = (local?.elements ?? [])
    .filter((e) => e.kind === 'point' && e.cell !== undefined && revealed.includes(e.id) && isSearchable(e.title))
    .map((e) => ({ id: e.id, kind: 'point', title: e.title, category: e.category, cell: e.cell, info: { subtitle: e.subtitle, text: describeLite(e) } }));
  const objects: PlayerElement[] = local?.window
    ? (rec.overlay?.markers ?? [])
      .filter((m) => m.revealed && (m.kind === 'objet' || m.kind === 'repere') && m.planId === local.planId)
      .flatMap((m) => {
        const cell = cellIn(local.window, b.cols, b.rows, m.x, m.y);
        const text = [m.reading, m.summary].filter(Boolean).join('\n\n');
        return cell === undefined ? [] : [{ id: `mk-${m.id}`, kind: 'point' as const, title: m.title, category: 'indetermine', cell, info: { text } }];
      })
    : [];
  // Objets déposés à la main par le MJ : seuls les visibles sont envoyés.
  const props: PlayerElement[] = (b.build?.props ?? [])
    .filter((p) => p.visible)
    .map((p) => ({
      id: `pr-${p.id}`, kind: 'point', title: PROP_BY_KEY[p.key]?.label ?? p.key, category: 'indetermine', cell: p.cell, image: propUrl(p.key),
      info: { subtitle: 'Objet', text: PROP_BY_KEY[p.key]?.text, image: propUrl(p.key) },
    }));
  const elements: PlayerElement[] = [...places, ...objects, ...props];
  const terrain = b.terrain
    ? applyBuild(effectiveGrid(b.terrain.grid, local?.elements ?? [], revealed, (local?.elements ?? []).map((e) => e.id)), b.build)
    : undefined;
  // Brouillard de guerre : seuls les héros et ce qu'ils voient ; le reste du plateau est noir, ou assombri s'il a été exploré.
  let fog: { visible: number[]; explored: number[] } | undefined;
  if (b.fog?.on) {
    const seen = partyVision({ ...b, tokens: b.tokens }, terrain);
    const explored = new Set([...(b.fog.source === (b.terrain?.source ?? 'plateau') ? b.fog.explored : []), ...seen]);
    fog = { visible: [...seen], explored: [...explored] };
    const byId = new Map(b.tokens.map((t) => [t.id, t]));
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = byId.get(tokens[i].id);
      if (t && t.kind !== 'pc' && !inSight(b, seen, t)) tokens.splice(i, 1);
    }
    for (let i = elements.length - 1; i >= 0; i--) {
      const e = elements[i];
      const cells = e.cells ?? (e.cell !== undefined ? [e.cell] : []);
      if (!cells.some((c) => explored.has(c))) elements.splice(i, 1);
    }
  }
  // Sorties au bord : la destination n'est nommée que si les héros connaissent ce lieu (révélé sur la carte).
  const withFound = b.local ? { ...b, local: { ...b.local, discovered: revealed } } : b;
  // Seules les galeries qui mènent quelque part sont des sorties, une par destination (comme dans la liste du MJ).
  const linkOf = (id: string) => rec.overlay?.passageLinks?.[id] ?? local?.elements.find((e) => e.id === id)?.auto;
  const seenDest = new Set<string>();
  let exits = exitsOf(withFound, (p) => {
    const link = linkOf(p.id);
    return link && revealed.includes(link.id) ? link.label.split(' · ')[0] : null;
  }).filter((e) => {
    const link = linkOf(e.id);
    if (!link || seenDest.has(link.id)) return false;
    seenDest.add(link.id);
    return true;
  }).map(({ cell, dir, label, known }) => ({ cell, dir, label: known ? label : '', known }));
  if (fog) { const ex = new Set(fog.explored); exits = exits.filter((e) => ex.has(e.cell)); }
  // Ordre d'initiative : les combattants cachés n'y figurent pas, et leur tour ne désigne personne.
  const shown = new Map(tokens.map((t) => [t.id, t]));
  const ordered = initiativeOrder(b.tokens.filter((t) => t.init !== undefined));
  const turn: PlayerTurn | undefined = ordered.length && b.turn
    ? {
      active: shown.has(b.turn) ? b.turn : null,
      // Rangé à partir de celui qui joue (ou, s'il est caché, du prochain visible) : « ensuite » suit le vrai ordre.
      order: [...ordered.slice(Math.max(0, ordered.findIndex((t) => t.id === b.turn))), ...ordered.slice(0, Math.max(0, ordered.findIndex((t) => t.id === b.turn)))].filter((t) => shown.has(t.id)).map((t) => {
        const p = shown.get(t.id)!;
        return { id: t.id, name: t.name, kind: t.kind, image: p.info?.image || p.image, state: t.kind === 'pc' ? undefined : p.state };
      }),
    }
    : undefined;
  return {
    mode: 'battle', title: local?.place ?? rec.title, backdrop: rec.image, cols: b.cols, rows: b.rows,
    feetPerCell: b.feetPerCell, round: b.round, tokens, terrain, elements, turn, fog, exits: exits.length ? exits : undefined,
    // Trait d'attaque : seulement si les joueurs voient l'attaquant et la cible.
    aim: b.aim && tokens.some((t) => t.id === b.aim!.from) && tokens.some((t) => t.id === b.aim!.to)
      ? { from: b.aim.from, to: b.aim.to, text: b.aim.text, tone: b.aim.tone, at: b.aim.at, verdict: b.aim.verdict, roll: b.aim.roll, line: b.aim.line, damage: b.aim.damage, weapon: b.aim.weapon }
      : undefined,
    // Dégâts et soins récents, sur les jetons que les joueurs voient.
    hits: (b.hits ?? []).filter((h) => tokens.some((t) => t.id === h.to) && Date.now() - h.at < HIT_SHOW_MS),
  };
}
