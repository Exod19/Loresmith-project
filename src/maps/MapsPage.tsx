/**
 * Page « Cartes » d'un univers : créer une carte vierge, importer une image, importer l'Atlas des profondeurs,
 * ouvrir une carte dans la visionneuse (MJ ou joueurs).
 */
import { useRef, useState } from 'react';
import MapViewer from './MapViewer';
import { ATLAS_MAP_ID, imageFileToDataUrl, type MapRecord } from './mapStore';
import './maps.css';
import './atlas/atlas.css';

type Props = {
  universe: { id: string; name: string } | null;
  maps: Record<string, MapRecord>;
  dispatch: (a: { type: string; [k: string]: unknown }) => void;
  flash: (m: string) => void;
};

const uid = () => Math.random().toString(36).slice(2, 10);

export default function MapsPage({ universe, maps, dispatch, flash }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [dm, setDm] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'rayons' | 'liste'>('rayons');

  if (!universe) return <div className="maps-page"><p>Aucun univers actif.</p></div>;

  const mine = Object.values(maps).filter((m) => m.universeId === universe.id).sort((a, b) => b.updatedAt - a.updatedAt);
  const hasAtlas = mine.some((m) => m.kind === 'atlas');
  /** L'Atlas des profondeurs est le contenu de l'Underdark : il ne s'ajoute qu'à cet univers. */
  const isUnderdark = /underdark/i.test(universe.name);
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

  const importAtlas = () => {
    const now = Date.now();
    dispatch({ type: 'ADD_MAP', map: { id: ATLAS_MAP_ID, universeId: universe.id, kind: 'atlas', title: 'Atlas des profondeurs', description: 'Grands niveaux, strates, sites, passages et rencontres.', createdAt: now, updatedAt: now } });
    flash('Atlas des profondeurs ajouté');
  };

  if (open) {
    return (
      <div className="maps-page">
        <MapViewer
          rec={open}
          dm={dm}
          onDm={setDm}
          onBack={() => setOpenId(null)}
          onUpdate={(patch) => dispatch({ type: 'UPDATE_MAP', id: open.id, patch })}
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
        <p className="maps-sub">Cartes interactives à montrer aux joueurs. Les repères, les conseils et les rencontres aléatoires restent réservés au mode MJ.</p>
        <div className="maps-actions">
          <button className="maps-btn gold" onClick={newBlank}>+ Carte vierge</button>
          <button className="maps-btn" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Lecture…' : 'Importer une image'}</button>
          {isUnderdark && !hasAtlas && <button className="maps-btn" onClick={importAtlas}>Importer l’Atlas des profondeurs</button>}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importImage(f); e.target.value = ''; }} />
        </div>
      </header>

      {mine.length === 0 && <p className="maps-hint">Aucune carte pour cet univers. Crée une carte vierge, importe une image, ou ajoute l’Atlas des profondeurs.</p>}

      {[
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
                  <p className="maps-sub">{m.kind === 'atlas' ? 'Atlas' : `${m.points?.length ?? 0} repère(s)`} · modifiée {new Date(m.updatedAt).toLocaleDateString('fr-CA')}</p>
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
                  <td>{m.kind === 'atlas' ? '—' : m.points?.length ?? 0}</td>
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
