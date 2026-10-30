/**
 * Panneau « Monde » de la visionneuse (MJ) : cités de la carte, ajout d'une cité depuis une fiche ou par ses paramètres,
 * et lieux du lore posés sur la carte (avec leurs PNJ, et les contradictions à trancher).
 */
import { useState } from 'react';
import type { AtlasData } from '../atlas/types';
import type { MapRecord } from '../mapStore';
import { SLOT_TYPES, citySpecDefaults, type Binding, type CitySpec, type Sea } from './generate';
import { DISTRICT_LABEL, norm, type LoreEntry } from './lore';

const entryText = (e: LoreEntry) => JSON.stringify([e.title, e.subtitle, e.shortSummary, e.body]);
import { cityFromEntry, cityPlanId, expandWorld, growSides, portChoices, portSea, replaceCity, seaName, settlementEntries, travelFrom, unmetWants, withCity, withScale, worldPatch, worldPlanId, type World } from './index';
import { CLIMATE_RANGES, nearestEdge } from './climate';
import { PACE, SCALES, atDir, cityKm, daysLabel, dirName, worldFrame } from './terrain';

type Props = {
  rec: MapRecord;
  data: AtlasData;
  /** Fiches de la Bibliothèque de l'univers. */
  library: LoreEntry[];
  planId: string;
  revealed: string[];
  onUpdate: (patch: Partial<MapRecord>) => void;
  /** Montre un plan (cité ou monde), centré sur un lieu s'il est donné. */
  onShow: (planId: string, featureId?: string) => void;
  /** Déplacer une cité : le prochain clic sur la carte du monde la pose. */
  onMoveCity?: (cityId: string) => void;
};
const DIRS = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'];

const uid = () => Math.random().toString(36).slice(2, 10);
const BLANK: CitySpec = { id: '', name: '', population: 1500, walls: true, castle: true, highTown: true, faubourgs: true, farms: true, river: false };
const TOGGLES: [keyof CitySpec, string][] = [['walls', 'Muraille'], ['castle', 'Château'], ['highTown', 'Haute-ville'], ['faubourgs', 'Faubourgs'], ['farms', 'Fermes'], ['river', 'Rivière'], ['port', 'Port de mer']];
const CLIMATE_LABEL = { froid: '❄ climat froid', tempere: '🌿 climat tempéré', chaud: '☀ climat chaud' } as const;
const SEA_LABEL = { N: 'au nord', S: 'au sud', E: 'à l’est', O: 'à l’ouest' } as const;

export default function WorldPanel({ rec, data, library, planId, revealed, onUpdate, onShow, onMoveCity }: Props) {
  const world = rec.world as World;
  const [draft, setDraft] = useState<CitySpec | null>(null);
  const [situate, setSituate] = useState<{ id: string; n: number; unit: 'jours' | 'km'; dir: string; to: string } | null>(null);
  const [from, setFrom] = useState<string>('');
  const [note, setNote] = useState<string | null>(null);
  /** Port à placer : la mer existante proposée, ou une nouvelle mer (le MJ choisit). */
  const [pending, setPending] = useState<{ spec: CitySpec; choices: ReturnType<typeof portChoices> } | null>(null);
  const frame = worldFrame(world);
  /** Enregistre le monde ; s'il s'est agrandi, les positions du groupe et des repères sont recalées, et on le dit. */
  const save = (next: World) => {
    const a = worldFrame(world), b = worldFrame(next);
    if (!a.legacy && !b.legacy && (a.x0 !== b.x0 || a.x1 !== b.x1 || a.y0 !== b.y0 || a.y1 !== b.y1)) {
      const grew = [b.y0 < a.y0 && 'le nord', b.y1 > a.y1 && 'le sud', b.x1 > a.x1 && 'l’est', b.x0 < a.x0 && 'l’ouest'].filter(Boolean).join(' et ');
      setNote(`Le monde s’est agrandi vers ${grew} : ${Math.round(b.x1 - b.x0)} × ${Math.round(b.y1 - b.y0)} km. Rien de ce qui existait n’a bougé.`);
    }
    onUpdate(worldPatch(rec, next));
  };
  const shown = new Set(revealed);
  const candidates = settlementEntries(world, library);
  const bindings = Object.values(world.bindings ?? {}) as Binding[];
  const here = world.cities.find((c) => cityPlanId(rec.id, c.id) === planId);
  const listed = here ? bindings.filter((b) => b.cityId === here.id) : bindings;
  const cityName = (id: string) => world.cities.find((c) => c.id === id)?.name ?? '?';
  const discoveredIn = (cityId: string) => bindings.some((b) => b.cityId === cityId && shown.has(b.slotId))
    || revealed.some((id) => id.startsWith(`${cityPlanId(rec.id, cityId)}:b`));

  const addCity = (spec: CitySpec, text = '') => {
    // Un port, alors qu'une mer existe déjà : la fiche la nomme-t-elle ? Sinon, on propose au MJ.
    if (!frame.legacy && spec.port && (world.seas ?? []).length) {
      const named = (world.seas ?? []).find((m) => norm(text).includes(norm(seaName(world, m))));
      const choices = portChoices(world, spec);
      if (named && choices.existing?.sea.id === named.id) { place(spec, choices.existing); return; }
      if (choices.existing || choices.fresh) { setPending({ spec, choices }); return; }
    }
    place(spec);
  };
  const place = (spec: CitySpec, choice?: { sea: Sea; km: [number, number] }) => {
    setPending(null);
    save(withCity(world, spec, choice));
    onShow(cityPlanId(rec.id, spec.id));
  };
  const regenerate = (c: CitySpec) => {
    const entry = library.find((e) => e.id === c.entryId);
    if (!entry) return;
    const fresh = cityFromEntry(entry);
    save({ ...world, cities: world.cities.map((x) => (x.id === c.id ? { ...fresh, id: c.id, seed: c.seed, at: c.at, seaDir: fresh.port ? (c.seaDir ?? nearestEdge(c.at ?? [0.5, 0.5])) : undefined } : x)) });
  };
  const removeCity = (c: CitySpec) => {
    if (!window.confirm(`Retirer « ${c.name} » de la carte ? Sa fiche n’est pas touchée ; les lieux qui y étaient posés seront replacés si une autre cité les accueille.`)) return;
    save({ ...world, cities: world.cities.filter((x) => x.id !== c.id), defaultCityId: world.defaultCityId === c.id ? world.cities.find((x) => x.id !== c.id)?.id : world.defaultCityId });
    if (planId === cityPlanId(rec.id, c.id)) onShow(worldPlanId(rec.id));
  };
  /** « à 3 jours de marche au nord de Brumeval » : situe un point par rapport à la cité la plus proche. */
  const describe = (km: [number, number]) => {
    const near = world.cities.map((c) => ({ c, k: cityKm(frame, c) })).map((x) => ({ ...x, d: Math.hypot(x.k[0] - km[0], x.k[1] - km[1]) })).sort((a, b) => a.d - b.d)[0];
    return near ? `, à environ ${daysLabel((near.d * 1.25) / PACE.normal)} ${atDir(dirName(near.k, km))} de ${near.c.name}` : '';
  };
  const togglePort = (c: CitySpec) => save({ ...world, cities: world.cities.map((x) => (x.id === c.id ? { ...x, port: !x.port, seaDir: x.port ? undefined : (x.seaDir ?? nearestEdge(x.at ?? [0.5, 0.5])) } : x)) });
  const climate = world.climate ?? {};
  const setClimate = (patch: Partial<NonNullable<World['climate']>>) => save({ ...world, climate: { ...climate, ...patch } });
  const climateAt = (c: CitySpec) => (data.maps.find((m) => m.id === cityPlanId(rec.id, c.id))?.surface?.climate ?? 'tempere') as keyof typeof CLIMATE_LABEL;
  const fromId = world.cities.some((c) => c.id === from) ? from : (here?.id ?? world.defaultCityId ?? world.cities[0]?.id ?? '');
  const trips = fromId ? travelFrom(world, data, fromId) : [];
  const setBinding = (b: Binding, patch: Partial<Binding>) => save({ ...world, bindings: { ...world.bindings, [b.entryId]: { ...b, ...patch } } });

  return (
    <div className="maps-panel-sec world-panel">
      <h4>🏰 {world.name} <button className="maps-btn" title="Renommer le monde" aria-label="Renommer le monde"
        onClick={() => { const n = window.prompt('Nom du monde ?', world.name)?.trim(); if (n) onUpdate({ world: { ...world, name: n }, title: `Monde · ${n}`, updatedAt: Date.now() }); }}>✎</button></h4>
      <p className="maps-sub">
        Une seule carte : zoome dans une cité pour y entrer, dézoome pour revenir au monde. Les lieux créés dans le lore prennent la place d’un bâtiment non découvert, avec leurs PNJ.
      </p>

      <h5>Échelle</h5>
      <label>Taille du monde
        <select className="maps-btn" value={frame.legacy ? 'ancien' : frame.scale} onChange={(e) => {
          const v = e.target.value as keyof typeof SCALES;
          if (window.confirm('Changer l’échelle redessine le relief, les forêts, les rivières et les routes. Les cités gardent leur disposition et leur plan (rien n’y bouge). Continuer ?')) save(withScale(world, v));
        }}>
          {frame.legacy && <option value="ancien">Ancienne carte (~50 km, sans relief)</option>}
          {Object.entries(SCALES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </label>
      <p className="maps-sub">{frame.legacy ? 'Carte d’avant le relief. Choisis une échelle pour avoir montagnes, côtes et distances en jours.' : `${Math.round(frame.x1 - frame.x0)} × ${Math.round(frame.y1 - frame.y0)} km · tout est à taille réelle.`}</p>

      {!frame.legacy && (
        <>
          <div className="maps-actions" role="group" aria-label="Agrandir le monde">
            {(['N', 'S', 'E', 'O'] as const).map((d) => (
              <button key={d} className="maps-btn" disabled={!growSides(world).includes(d)} onClick={() => save(expandWorld(world, d))}
                title={growSides(world).includes(d) ? `Ajouter une bande de terres ${({ N: 'au nord', S: 'au sud', E: 'à l’est', O: 'à l’ouest' })[d]} : ce qui existe ne bouge pas` : 'La mer est de ce côté : au-delà, ce sont d’autres continents'}>
                ⤢ {({ N: 'Nord', S: 'Sud', E: 'Est', O: 'Ouest' })[d]}
              </button>
            ))}
          </div>
          {note && <p className="maps-sub">🗺 {note}</p>}
          {(world.seas ?? []).length > 0 && (
            <>
              <h5>Mers</h5>
              <ul className="world-cities">
                {(world.seas ?? []).map((m) => (
                  <li key={m.id}>
                    <b>{seaName(world, m)}</b> <small>· {({ N: 'au nord', S: 'au sud', E: 'à l’est', O: 'à l’ouest' } as Record<string, string>)[m.side ?? ''] ?? ''}</small>
                    <div className="maps-sub">Ports : {world.cities.filter((c) => c.port && portSea(world, c)?.id === m.id).map((c) => c.name).join(', ') || 'aucun'}</div>
                    <button className="maps-btn" onClick={() => { const n = window.prompt('Nom de la mer ?', seaName(world, m))?.trim(); if (n) save({ ...world, seas: (world.seas ?? []).map((x) => (x.id === m.id ? { ...x, name: n } : x)) }); }}>✎ Renommer</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <h5>Climat</h5>
      <div className="maps-seg" role="group" aria-label="Hémisphère">
        <button className={climate.hemisphere !== 'sud' ? 'on' : ''} onClick={() => setClimate({ hemisphere: 'nord' })} title="Le froid en haut de la carte, la chaleur en bas">Hémisphère nord</button>
        <button className={climate.hemisphere === 'sud' ? 'on' : ''} onClick={() => setClimate({ hemisphere: 'sud' })} title="La chaleur en haut de la carte, le froid en bas">Hémisphère sud</button>
      </div>
      <label>Étendue des climats
        <select className="maps-btn" value={climate.range ?? 'complet'} onChange={(e) => setClimate({ range: e.target.value as NonNullable<World['climate']>['range'] })}>
          {Object.entries(CLIMATE_RANGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </label>
      <p className="maps-sub">Neige vers le pôle, désert vers l’équateur, grèves au bord des lacs. La mer n’apparaît que du côté des cités portuaires.</p>

      <h5>Cités ({world.cities.length})</h5>
      {world.cities.length === 0 && <p className="maps-sub">Aucune cité. Ajoute-en une depuis une fiche de lieu, ou par ses paramètres.</p>}
      <ul className="world-cities">
        {world.cities.map((c) => {
          const d = citySpecDefaults(c);
          const locked = discoveredIn(c.id);
          return (
            <li key={c.id} className={here?.id === c.id ? 'on' : ''}>
              <button className="linklike" onClick={() => onShow(cityPlanId(rec.id, c.id))}><b>{c.name}</b></button>
              <small> · {d.population.toLocaleString('fr-CA')} hab.{world.defaultCityId === c.id ? ' · cité par défaut du lore' : ''}</small>
              <div className="maps-sub">{TOGGLES.filter(([k]) => d[k as keyof typeof d]).map(([, l]) => (l === 'Port de mer' && c.seaDir ? `Port (mer ${SEA_LABEL[c.seaDir]})` : l)).join(' · ') || 'Hameau ouvert'} · {CLIMATE_LABEL[climateAt(c)]}</div>
              {unmetWants(world, c).map((w) => <div key={w} className="world-warn">⚠ Distance non respectée : {w}.</div>)}
              {!!c.near?.length && <div className="maps-sub">Voulue : {c.near.map((n) => n.label ?? `${n.km} km de ${n.to}`).join(' ; ')}</div>}
              {situate?.id === c.id && (
                <form className="world-form" onSubmit={(e) => {
                  e.preventDefault();
                  const to = world.cities.find((x) => x.id === situate.to);
                  if (!to || !situate.n) return;
                  const km = situate.unit === 'jours' ? situate.n * PACE.normal : situate.n;
                  const label = `${situate.n} ${situate.unit === 'jours' ? 'jour(s) de marche' : 'km'}${situate.dir ? ` ${atDir(situate.dir)}` : ''} de ${to.name}`;
                  const near = [...(c.near ?? []).filter((n) => !n.to.startsWith(to.name.toLowerCase())), { km, dir: situate.dir || undefined, to: to.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), label }];
                  save(replaceCity({ ...world, cities: world.cities.map((x) => (x.id === c.id ? { ...x, near } : x)) }, c.id));
                  setSituate(null);
                }}>
                  <div className="world-toggles">
                    <input className="maps-btn" type="number" min={0.5} step={0.5} value={situate.n} onChange={(e) => setSituate({ ...situate, n: Number(e.target.value) })} style={{ width: 70 }} />
                    <select className="maps-btn" value={situate.unit} onChange={(e) => setSituate({ ...situate, unit: e.target.value as 'jours' | 'km' })}><option value="jours">jours de marche</option><option value="km">km</option></select>
                    <select className="maps-btn" value={situate.dir} onChange={(e) => setSituate({ ...situate, dir: e.target.value })}><option value="">toute direction</option>{DIRS.map((d) => <option key={d} value={d}>{atDir(d)}</option>)}</select>
                    <select className="maps-btn" value={situate.to} onChange={(e) => setSituate({ ...situate, to: e.target.value })}>{world.cities.filter((x) => x.id !== c.id).map((x) => <option key={x.id} value={x.id}>de {x.name}</option>)}</select>
                  </div>
                  <div className="maps-actions">
                    <button className="maps-btn gold" type="submit">Situer et replacer</button>
                    <button className="maps-btn" type="button" onClick={() => setSituate(null)}>Annuler</button>
                  </div>
                </form>
              )}
              <div className="maps-actions">
                {!frame.legacy && world.cities.length > 1 && !situate && (
                  <button className="maps-btn" onClick={() => setSituate({ id: c.id, n: 2, unit: 'jours', dir: '', to: world.cities.find((x) => x.id !== c.id)!.id })} title="Fixer une distance par rapport à une autre cité ; la cité est replacée en conséquence">📏 Situer</button>
                )}
                {onMoveCity && <button className="maps-btn" onClick={() => onMoveCity(c.id)} title="Clique ensuite sur la carte du monde. Le plan de la cité ne change pas.">📍 Déplacer</button>}
                {c.entryId && (
                  <button className="maps-btn" disabled={locked} onClick={() => regenerate(c)}
                    title={locked ? 'Des lieux de cette cité sont déjà découverts : la régénérer les déplacerait.' : 'Relire la fiche et redessiner la cité (même graine)'}>⟳ Depuis la fiche</button>
                )}
                {world.defaultCityId !== c.id && <button className="maps-btn" onClick={() => save({ ...world, defaultCityId: c.id })} title="Les lieux du lore qui ne nomment aucune cité iront ici">Par défaut</button>}
                <button className="maps-btn" onClick={() => { const n = window.prompt('Nom de la cité ?', c.name)?.trim(); if (n) save({ ...world, cities: world.cities.map((x) => (x.id === c.id ? { ...x, name: n } : x)) }); }}>✎ Renommer</button>
                <button className="maps-btn" disabled={locked} onClick={() => togglePort(c)}
                  title={locked ? 'Des lieux de cette cité sont déjà découverts : ajouter ou retirer la mer les déplacerait.' : c.port ? 'Retirer la mer' : 'Faire de la cité un port : la mer s’étend vers le bord de carte le plus proche'}>⚓ {c.port ? 'Plus de port' : 'Port'}</button>
                <button className="maps-btn" onClick={() => removeCity(c)}>Retirer</button>
              </div>
            </li>
          );
        })}
      </ul>

      {world.cities.length > 1 && (
        <>
          <h5>Distances</h5>
          <label>Depuis
            <select className="maps-btn" value={fromId} onChange={(e) => setFrom(e.target.value)}>
              {world.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <ul className="world-cities">
            {trips.map((t) => (
              <li key={t.id}>
                <b>{t.name}</b> <small>· {atDir(t.dir)}</small>
                <div className="maps-sub">
                  {Math.round(t.km)} km {t.road ? 'par la route' : 'à vol d’oiseau (pas de route)'} · {daysLabel(t.effort / PACE.normal)}
                  {' '}<small>(lent {daysLabel(t.effort / PACE.lent).replace(' de marche', '')}, rapide {daysLabel(t.effort / PACE.rapide).replace(' de marche', '')})</small>
                </div>
              </li>
            ))}
          </ul>
          <p className="maps-sub">Rythmes de D&amp;D 5e : lent 29 km, normal 38 km, rapide 48 km par jour. Pentes, cols et forêts allongent le trajet.</p>
        </>
      )}

      <h5>Ajouter une cité</h5>
      {pending && (
        <div className="world-suggest">
          <p>⚓ <b>{pending.spec.name}</b> est un port.
            {pending.choices.existing && <> La <b>{seaName(world, pending.choices.existing.sea)}</b> existe déjà : je peux l’installer sur sa côte{describe(pending.choices.existing.km)}. D’accord ?</>}
            {!pending.choices.existing && pending.choices.fresh && <> Aucune côte connue ne convient : je propose une nouvelle mer, la <b>{seaName(world, pending.choices.fresh.sea)}</b>{describe(pending.choices.fresh.km)}.</>}
          </p>
          <div className="maps-actions">
            {pending.choices.existing && <button className="maps-btn gold" onClick={() => place(pending.spec, pending.choices.existing!)}>Oui, sur la {seaName(world, pending.choices.existing.sea)}</button>}
            {pending.choices.fresh && <button className="maps-btn" onClick={() => place(pending.spec, pending.choices.fresh!)}>{pending.choices.existing ? 'Nouvelle mer' : 'Créer cette mer'} ({({ N: 'au nord', S: 'au sud', E: 'à l’est', O: 'à l’ouest' } as Record<string, string>)[pending.choices.fresh.sea.side ?? ''] ?? ''})</button>}
            <button className="maps-btn" onClick={() => { const c = pending.choices.existing ?? pending.choices.fresh; place(pending.spec, c ?? undefined); onMoveCity?.(pending.spec.id); }} title="La cité est posée, puis tu cliques sur la carte du monde pour la placer">Je la place moi-même</button>
            <button className="maps-btn" onClick={() => setPending(null)}>Annuler</button>
          </div>
        </div>
      )}
      {candidates.length > 0 && (
        <div className="world-from">
          <p className="maps-sub">Depuis une fiche de lieu (population, muraille, château, haute-ville, faubourgs, fermes… sont lus sur la fiche) :</p>
          {candidates.slice(0, 12).map((e) => (
            <button key={e.id} className="maps-btn" onClick={() => addCity(cityFromEntry(e), entryText(e))}>+ {String(e.title ?? 'Sans titre')}</button>
          ))}
        </div>
      )}
      {!draft ? (
        <button className="maps-btn gold" onClick={() => setDraft({ ...BLANK, id: uid() })}>+ Nouvelle cité par ses paramètres</button>
      ) : (
        <form className="world-form" onSubmit={(e) => { e.preventDefault(); if (draft.name.trim()) { addCity({ ...draft, name: draft.name.trim() }); setDraft(null); } }}>
          <label>Nom<input className="maps-btn" value={draft.name} autoFocus onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Brumeval" /></label>
          <label>Habitants<input className="maps-btn" type="number" min={150} max={25000} step={50} value={draft.population} onChange={(e) => setDraft({ ...draft, population: Number(e.target.value) })} /></label>
          <div className="world-toggles">
            {TOGGLES.map(([k, l]) => (
              <label key={k}><input type="checkbox" checked={!!draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.checked })} /> {l}</label>
            ))}
          </div>
          <div className="maps-actions">
            <button className="maps-btn gold" type="submit" disabled={!draft.name.trim()}>Générer la cité</button>
            <button className="maps-btn" type="button" onClick={() => setDraft(null)}>Annuler</button>
          </div>
        </form>
      )}

      <h5>Lieux du lore {here ? `à ${here.name}` : 'sur la carte'} ({listed.filter((b) => !b.excluded).length})</h5>
      {listed.length === 0 && <p className="maps-sub">Aucun pour l’instant. Crée une fiche de lieu (« La Chope Cassée, taverne de {here?.name ?? world.cities[0]?.name ?? 'la cité'} ») : elle apparaîtra ici.</p>}
      <ul className="world-places">
        {listed.map((b) => {
          const found = shown.has(b.slotId);
          const f = data.features.find((x) => x.id === b.slotId);
          return (
            <li key={b.entryId} className={b.excluded ? 'off' : ''}>
              <button className="linklike" disabled={b.excluded || !f} onClick={() => onShow(cityPlanId(rec.id, b.cityId), b.slotId)}><b>{b.title}</b></button>
              <small> · {SLOT_TYPES[b.type]?.label}{b.district ? ` ${DISTRICT_LABEL[b.district]}` : ''}{here ? '' : ` · ${cityName(b.cityId)}`} · {found ? 'découvert' : 'non découvert'}</small>
              {!!b.npcs?.length && <div className="maps-sub">Sur place : {b.npcs.map((n) => (n.role ? `${n.name} (${n.role})` : n.name)).join(', ')}</div>}
              {b.conflict && <div className="world-warn">⚠ {b.conflict}</div>}
              {b.orphan && <div className="world-warn">⚠ La fiche de ce lieu n’existe plus : il reste sur la carte, signalé.</div>}
              <div className="maps-actions">
                {b.excluded
                  ? <button className="maps-btn" onClick={() => setBinding(b, { excluded: undefined })}>Remettre sur la carte</button>
                  : <button className="maps-btn" onClick={() => setBinding(b, { excluded: true })} title="Le bâtiment redevient anonyme ; la fiche n’est pas touchée">Retirer de la carte</button>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
