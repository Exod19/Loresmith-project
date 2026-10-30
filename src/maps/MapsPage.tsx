/**
 * Page « Cartes » d'un univers : créer une carte vierge, importer une image, importer l'Atlas des profondeurs
 * (et le synchroniser avec les Archives), ouvrir une carte dans la visionneuse.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Hero } from './battle/CombatPanel';
import { clearMapIntent, peekMapIntent } from './intent';
import type { CombatSlot } from './battle/BattleMode';
import MapViewer from './MapViewer';
import { useUnderdarkFeed, ARCHIVES_URL_KEY } from '../feeds/underdark';
import { bestiaryEncounters } from '../feeds/bestiary';
import { setBestiary } from './atlas/encounters';
import { ATLAS_MAP_ID, imageFileToDataUrl, type MapRecord } from './mapStore';
import type { AtlasData } from './atlas/types';
import type { BestiaryRef, GuideCampaign } from './CampaignGuide';
import { cityFromEntry, newWorldRecord, settlementEntries, sourceAtlas, withCity } from './world';
import type { LoreEntry } from './world/lore';
import './maps.css';
import './atlas/atlas.css';

type Props = {
  universe: { id: string; name: string; archives?: string; activeCampaignId?: string } | null;
  maps: Record<string, MapRecord>;
  dispatch: (a: { type: string; [k: string]: unknown }) => void;
  flash: (m: string) => void;
  /** Personnages du groupe (univers courant), pour le combat. */
  heroes?: Hero[];
  /** Retour à la Table de jeu, quand la carte a été ouverte depuis elle. */
  onReturnToTable?: () => void;
  /** Module Combat de l'application, affiché sous la carte de combat. */
  renderCombat?: (slot: CombatSlot) => ReactNode;
  /** Campagnes de l'univers : l'une d'elles peut être invoquée sur la carte. */
  campaigns?: GuideCampaign[];
  /** PNJ & Créatures de l'univers. */
  bestiary?: BestiaryRef[];
  /** Illustration d'une créature par son nom, pour l'écran joueur. */
  artOf?: (name: string, id: string) => string;
  /** Fiches de la Bibliothèque de l'univers (cités et lieux de la carte du monde). */
  library?: LoreEntry[];
};

const uid = () => Math.random().toString(36).slice(2, 10);
/** Identifiants des lieux connus au dernier passage : c'est ce qui permet de compter les ajouts et retraits. */
const KNOWN_KEY = 'loresmith:atlas-known:v1';

function readKnown(): Set<string> | null {
  try {
    const raw = localStorage.getItem(KNOWN_KEY);
    return raw ? new Set<string>(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export default function MapsPage({ universe, maps, dispatch, flash, heroes = [], campaigns = [], bestiary = [], onReturnToTable, renderCombat, artOf, library = [] }: Props) {
  // La Table de jeu peut demander d'ouvrir une carte précise (et d'y lancer le combat).
  const [intent] = useState(peekMapIntent);
  useEffect(() => { clearMapIntent(); }, []);
  const [openId, setOpenId] = useState<string | null>(intent?.mapId ?? null);
  const [dm, setDm] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'rayons' | 'liste'>('rayons');
  const [sourceUrl, setSourceUrl] = useState(() => {
    try { return localStorage.getItem(ARCHIVES_URL_KEY) ?? ''; } catch { return ''; }
  });
  const { feed, error, reload } = useUnderdarkFeed();
  // Le Bestiaire des Archives alimente les rencontres de toutes les cartes.
  useEffect(() => { if (feed) setBestiary(bestiaryEncounters(feed.entries)); }, [feed]);

  if (!universe) return <div className="maps-page"><p>Aucun univers actif.</p></div>;

  const mine = Object.values(maps).filter((m) => m.universeId === universe.id).sort((a, b) => b.updatedAt - a.updatedAt);
  const atlasRec = maps[ATLAS_MAP_ID];
  const hasAtlas = mine.some((m) => m.kind === 'atlas');
  /** L'Atlas des profondeurs est le contenu de l'Underdark : il ne s'ajoute qu'à cet univers. */
  const isUnderdark = universe.archives === 'underdark';
  const open = openId ? maps[openId] : null;

  const create = (partial: Partial<MapRecord>) => {
    const now = Date.now();
    const rec: MapRecord = { id: uid(), universeId: universe.id, kind: 'custom', title: 'Nouvelle carte', createdAt: now, updatedAt: now, points: [], ...partial };
    dispatch({ type: 'ADD_MAP', map: rec });
    setOpenId(rec.id);
  };

  const newBlank = () => {
    const title = window.prompt('Nom de la carte ?', 'Carte de la cité');
    if (title && title.trim()) create({ title: title.trim(), width: 1240, height: 755 });
  };

  const importImage = async (file: File) => {
    setBusy(true);
    try {
      const img = await imageFileToDataUrl(file);
      const title = file.name.replace(/\.[^.]+$/, '') || 'Carte importée';
      create({ title, image: img.dataUrl, width: 1240, height: Math.round((1240 * img.height) / img.width) });
      flash('Carte importée');
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** Carte du monde : générée, puis tenue à jour par le lore. Les fiches de cité de l'univers y sont posées d'emblée. */
  const hasWorld = mine.some((m) => m.kind === 'monde');
  const newWorld = () => {
    const rec = newWorldRecord(universe, uid());
    let world = rec.world!;
    for (const e of settlementEntries(world, library).filter((x) => !x.sourceId).slice(0, 8)) world = withCity(world, cityFromEntry(e));
    dispatch({ type: 'ADD_MAP', map: { ...rec, world } });
    setOpenId(rec.id);
    flash(world.cities.length ? `Carte du monde créée : ${world.cities.length} cité(s) tirée(s) des fiches.` : 'Carte du monde créée : ajoute une première cité.');
  };

  const importAtlas = () => {
    const now = Date.now();
    dispatch({ type: 'ADD_MAP', map: { id: ATLAS_MAP_ID, universeId: universe.id, kind: 'atlas', title: 'Atlas des profondeurs', description: 'Grands niveaux, strates, sites, passages et rencontres.', createdAt: now, updatedAt: now, syncedAt: now } });
    flash('Atlas des profondeurs ajouté');
  };

  /**
   * Synchronise l'Atlas avec les Archives. Seule la source est remplacée : révélations, repères et combats
   * sont dans l'univers, à part, et ne sont jamais touchés. Un repère lié à une fiche disparue est signalé, pas supprimé.
   */
  const sync = async () => {
    const before = readKnown();
    setBusy(true);
    const fresh = await reload();
    setBusy(false);
    if (!fresh) { flash('Synchronisation impossible : vérifie l’adresse des Archives.'); return; }

    const now = new Set(fresh.atlas.features.map((f) => f.id));
    try { localStorage.setItem(KNOWN_KEY, JSON.stringify([...now])); } catch { /* Stockage plein : la synchronisation reste valable pour cette session. */ }
    // L'index de l'Atlas est reconstruit à partir de `updatedAt` : il doit changer après une synchronisation.
    if (atlasRec) dispatch({ type: 'UPDATE_MAP', id: ATLAS_MAP_ID, patch: { syncedAt: Date.now(), updatedAt: Date.now() } });

    const orphans = mine.reduce((n, m) => n + (m.overlay?.markers ?? []).filter((k) => k.archiveId && !now.has(k.archiveId)).length, 0);
    const suffix = orphans ? ` ${orphans} repère(s) lié(s) à une fiche disparue : signalé(s), non supprimé(s).` : '';
    if (!before) {
      flash(`Première synchronisation : ${now.size} lieux enregistrés.${suffix}`);
      return;
    }
    const added = [...now].filter((id) => !before.has(id)).length;
    const removed = [...before].filter((id) => !now.has(id)).length;
    flash(`Archives à jour : ${added} lieu(x) ajouté(s), ${removed} retiré(s). Vos repères et révélations sont conservés.${suffix}`);
  };

  const saveSource = (value: string) => {
    setSourceUrl(value);
    try {
      if (value.trim()) localStorage.setItem(ARCHIVES_URL_KEY, value.trim());
      else localStorage.removeItem(ARCHIVES_URL_KEY);
    } catch { /* Stockage indisponible : l'adresse vaut pour cette session seulement. */ }
  };

  if (open) {
    // L'Atlas vient du fichier des Archives : on attend son chargement. Les cartes personnalisées n'en ont pas besoin.
    if (open.kind === 'atlas' && !feed) return <div className="maps-page"><p className="maps-hint">{error ?? 'Chargement des Archives…'}</p></div>;
    return (
      <div className="maps-page">
        <MapViewer
          rec={open}
          atlas={sourceAtlas(open, feed?.atlas as AtlasData)}
          library={library}
          onCreateNpc={(n) => { dispatch({ type: 'ADD_NPC', n }); flash(`Fiche créée : ${n.name} (PNJ & créatures)`); }}
          dm={dm}
          onDm={setDm}
          onBack={() => setOpenId(null)}
          onUpdate={(patch) => dispatch({ type: 'UPDATE_MAP', id: open.id, patch })}
          heroes={heroes}
          startInBattle={intent?.mapId === open.id && intent.battle}
          onReturn={intent?.from === 'table' && intent.mapId === open.id ? onReturnToTable : undefined}
          renderCombat={renderCombat}
          campaigns={campaigns}
          activeCampaignId={universe.activeCampaignId}
          onCampaign={(id) => dispatch({ type: 'UPDATE_UNIVERSE', id: universe.id, patch: { activeCampaignId: id || undefined } })}
          onCampaignProgress={(id, progress) => dispatch({ type: 'UPDATE_CAMPAIGN', id, patch: { progress } })}
          bestiary={bestiary}
          artOf={artOf}
        />
      </div>
    );
  }

  return (
    <div className="maps-page">
      <nav className="maps-crumbs"><span>{universe.name}</span> › <span>Cartes</span></nav>
      <header className="maps-head">
        <h2>Cartes</h2>
        <div className="maps-seg maps-viewtoggle" role="group" aria-label="Présentation">
          <button className={view === 'rayons' ? 'on' : ''} onClick={() => setView('rayons')}>Rayons</button>
          <button className={view === 'liste' ? 'on' : ''} onClick={() => setView('liste')}>Liste</button>
        </div>
        <p className="maps-sub">Cartes interactives à projeter aux joueurs. Ce que tu révèles ou places apparaît en direct sur leur écran ; le reste reste réservé au MJ.</p>
        <div className="maps-actions">
          {!hasWorld && <button className="maps-btn gold" onClick={newWorld} title="Une carte du monde générée : cités, routes, bâtiments ; les lieux du lore y apparaissent d’eux-mêmes">+ Carte du monde</button>}
          <button className="maps-btn gold" onClick={newBlank}>+ Carte vierge</button>
          <button className="maps-btn" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Lecture…' : 'Importer une image'}</button>
          {isUnderdark && !hasAtlas && <button className="maps-btn" onClick={importAtlas}>Importer l’Atlas des profondeurs</button>}
          {hasAtlas && (
            <button className="maps-btn" disabled={busy} onClick={sync}>
              {busy ? 'Synchronisation…' : '⟳ Synchroniser les Archives'}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importImage(f); e.target.value = ''; }} />
        </div>
        {hasAtlas && (
          <details className="maps-sync">
            <summary>Synchronisation des Archives{atlasRec?.syncedAt ? ` · dernière le ${new Date(atlasRec.syncedAt).toLocaleString('fr-CA')}` : ''}</summary>
            <p className="maps-sub">
              La synchronisation met à jour les lieux de l’Atlas. Tes révélations, repères, rencontres et combats sont stockés dans l’univers : ils ne sont jamais remplacés.
            </p>
            <label className="maps-row">
              Adresse du fichier des Archives (vide : version livrée avec l’application)
              <input className="maps-btn" value={sourceUrl} placeholder="https://…/underdark.json" onChange={(e) => saveSource(e.target.value)} />
            </label>
          </details>
        )}
      </header>

      {universe.activeCampaignId && campaigns.some((c) => c.id === universe.activeCampaignId) && (
        <p className="maps-hint">📜 Campagne invoquée : <b>{campaigns.find((c) => c.id === universe.activeCampaignId)?.title}</b>. Ouvre une carte : le guide MJ indique où amener le groupe et quelles rencontres l’y attendent.</p>
      )}
      {mine.length === 0 && <p className="maps-hint">Aucune carte pour cet univers. Crée la carte du monde, une carte vierge, importe une image, ou ajoute l’Atlas des profondeurs.</p>}

      {[
        { id: 'Carte du monde', description: 'Générée à partir des fiches : cités, routes et bâtiments, tenue à jour par le lore.', docs: mine.filter((m) => m.kind === 'monde') },
        { id: 'Atlas intégré', description: 'Cartes fournies avec le projet.', docs: mine.filter((m) => m.kind === 'atlas') },
        { id: 'Cartes de l’univers', description: 'Cartes créées ou importées pour cet univers.', docs: mine.filter((m) => m.kind === 'custom') },
      ].filter((g) => g.docs.length > 0).map((g) => (
        <section key={g.id} className="collection">
          <div className="collection-head">
            <h2>{g.id}</h2>
            <p className="maps-sub">{g.description} · {g.docs.length} carte{g.docs.length > 1 ? 's' : ''}</p>
          </div>
          {view === 'rayons' ? (
            <div className="maps-grid">
              {g.docs.map((m) => (
                <article key={m.id} className="maps-card">
                  <h3>{m.title}</h3>
                  <p className="maps-sub">{m.kind === 'atlas' ? 'Atlas' : m.kind === 'monde' ? `${m.world?.cities.length ?? 0} cité(s) · ${Object.values(m.world?.bindings ?? {}).filter((b) => !b.excluded).length} lieu(x) du lore` : `${m.points?.length ?? 0} repère(s)`} · modifiée {new Date(m.updatedAt).toLocaleDateString('fr-CA')}</p>
                  {m.description && <p>{m.description}</p>}
                  <div className="maps-actions">
                    <button className="maps-btn gold" onClick={() => setOpenId(m.id)}>Ouvrir</button>
                    <button className="maps-btn" onClick={() => { if (window.confirm(`Supprimer « ${m.title} » ?`)) dispatch({ type: 'DELETE_MAP', id: m.id }); }}>Supprimer</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <table className="maps-table">
              <thead><tr><th>Titre</th><th>Repères</th><th>Modifiée</th><th></th></tr></thead>
              <tbody>{g.docs.map((m) => (
                <tr key={m.id}>
                  <td><button className="maps-link" onClick={() => setOpenId(m.id)}>{m.title}</button></td>
                  <td>{m.kind === 'atlas' ? '—' : m.kind === 'monde' ? `${m.world?.cities.length ?? 0} cité(s)` : m.points?.length ?? 0}</td>
                  <td>{new Date(m.updatedAt).toLocaleDateString('fr-CA')}</td>
                  <td><button className="maps-btn" onClick={() => { if (window.confirm(`Supprimer « ${m.title} » ?`)) dispatch({ type: 'DELETE_MAP', id: m.id }); }}>Supprimer</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  );
}
