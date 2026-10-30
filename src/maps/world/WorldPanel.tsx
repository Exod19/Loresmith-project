/**
 * Panneau « Monde » de la visionneuse (MJ) : cités de la carte, ajout d'une cité depuis une fiche ou par ses paramètres,
 * et lieux du lore posés sur la carte (avec leurs PNJ, et les contradictions à trancher).
 */
import { useState } from 'react';
import type { AtlasData } from '../atlas/types';
import type { MapRecord } from '../mapStore';
import { SLOT_TYPES, citySpecDefaults, type Binding, type CitySpec } from './generate';
import { DISTRICT_LABEL, type LoreEntry } from './lore';
import { cityFromEntry, cityPlanId, settlementEntries, withCity, worldPlanId, type World } from './index';
import { CLIMATE_RANGES, climateOf, nearestEdge, temperatureAt } from './climate';

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
};

const uid = () => Math.random().toString(36).slice(2, 10);
const BLANK: CitySpec = { id: '', name: '', population: 1500, walls: true, castle: true, highTown: true, faubourgs: true, farms: true, river: false };
const TOGGLES: [keyof CitySpec, string][] = [['walls', 'Muraille'], ['castle', 'Château'], ['highTown', 'Haute-ville'], ['faubourgs', 'Faubourgs'], ['farms', 'Fermes'], ['river', 'Rivière'], ['port', 'Port de mer']];
const CLIMATE_LABEL = { froid: '❄ climat froid', tempere: '🌿 climat tempéré', chaud: '☀ climat chaud' } as const;
const SEA_LABEL = { N: 'au nord', S: 'au sud', E: 'à l’est', O: 'à l’ouest' } as const;

export default function WorldPanel({ rec, data, library, planId, revealed, onUpdate, onShow }: Props) {
  const world = rec.world as World;
  const [draft, setDraft] = useState<CitySpec | null>(null);
  const save = (next: World) => onUpdate({ world: next, updatedAt: Date.now() });
  const shown = new Set(revealed);
  const candidates = settlementEntries(world, library);
  const bindings = Object.values(world.bindings ?? {}) as Binding[];
  const here = world.cities.find((c) => cityPlanId(rec.id, c.id) === planId);
  const listed = here ? bindings.filter((b) => b.cityId === here.id) : bindings;
  const cityName = (id: string) => world.cities.find((c) => c.id === id)?.name ?? '?';
  const discoveredIn = (cityId: string) => bindings.some((b) => b.cityId === cityId && shown.has(b.slotId))
    || revealed.some((id) => id.startsWith(`${cityPlanId(rec.id, cityId)}:b`));

  const addCity = (spec: CitySpec) => {
    save(withCity(world, spec));
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
  const togglePort = (c: CitySpec) => save({ ...world, cities: world.cities.map((x) => (x.id === c.id ? { ...x, port: !x.port, seaDir: x.port ? undefined : (x.seaDir ?? nearestEdge(x.at ?? [0.5, 0.5])) } : x)) });
  const climate = world.climate ?? {};
  const setClimate = (patch: Partial<NonNullable<World['climate']>>) => save({ ...world, climate: { ...climate, ...patch } });
  const climateAt = (c: CitySpec) => climateOf(temperatureAt(climate, c.at?.[1] ?? 0.5));
  const setBinding = (b: Binding, patch: Partial<Binding>) => save({ ...world, bindings: { ...world.bindings, [b.entryId]: { ...b, ...patch } } });

  return (
    <div className="maps-panel-sec world-panel">
      <h4>🏰 {world.name} <button className="maps-btn" title="Renommer le monde" aria-label="Renommer le monde"
        onClick={() => { const n = window.prompt('Nom du monde ?', world.name)?.trim(); if (n) onUpdate({ world: { ...world, name: n }, title: `Monde · ${n}`, updatedAt: Date.now() }); }}>✎</button></h4>
      <p className="maps-sub">
        Une seule carte : zoome dans une cité pour y entrer, dézoome pour revenir au monde. Les lieux créés dans le lore prennent la place d’un bâtiment non découvert, avec leurs PNJ.
      </p>

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
              <div className="maps-actions">
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

      <h5>Ajouter une cité</h5>
      {candidates.length > 0 && (
        <div className="world-from">
          <p className="maps-sub">Depuis une fiche de lieu (population, muraille, château, haute-ville, faubourgs, fermes… sont lus sur la fiche) :</p>
          {candidates.slice(0, 12).map((e) => (
            <button key={e.id} className="maps-btn" onClick={() => addCity(cityFromEntry(e))}>+ {String(e.title ?? 'Sans titre')}</button>
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
