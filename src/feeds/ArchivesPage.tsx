/**
 * Archives de l'Underdark dans Loresmith : consultation en lecture seule, synchronisée depuis le fichier publié.
 * Une fiche peut être copiée dans la bibliothèque de l'univers pour être modifiée sans toucher à la source.
 */
import { useMemo, useState } from 'react';
import '../maps/maps.css';
import { FEED_TYPE_LABEL, UNDERDARK_LINK, archiveBundle, useUnderdarkFeed, type FeedEntry } from './underdark';
import { setArchivesLink } from './ArchivesLink';

type Props = {
  universe: { id: string; name: string; archives?: string } | null;
  dispatch: (a: { type: string; [k: string]: unknown }) => void;
  flash: (m: string) => void;
};


export default function ArchivesPage({ universe, dispatch, flash }: Props) {
  const { feed, error, reload } = useUnderdarkFeed();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const byId = useMemo(() => new Map((feed?.entries ?? []).map((e) => [e.id, e])), [feed]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (feed?.entries ?? []).filter((e) => !q || `${e.name} ${e.summary} ${e.tags.join(' ')}`.toLowerCase().includes(q));
    const by = new Map<string, FeedEntry[]>();
    for (const e of list) by.set(e.type, [...(by.get(e.type) ?? []), e]);
    return [...by.entries()].sort((a, b) => (FEED_TYPE_LABEL[a[0]] ?? a[0]).localeCompare(FEED_TYPE_LABEL[b[0]] ?? b[0], 'fr'));
  }, [feed, query]);

  if (!universe) return <div className="maps-page"><p>Aucun univers actif.</p></div>;
  if (universe.archives !== UNDERDARK_LINK) return (
    <div className="maps-page">
      <p className="maps-hint">Cet univers n’est pas lié aux Archives de l’Underdark.</p>
      <button className="maps-btn gold" onClick={() => { setArchivesLink(universe, dispatch, true); flash('Univers lié aux Archives'); }}>Lier cet univers</button>
    </div>
  );
  if (error && !feed) return <div className="maps-page"><p className="maps-hint">Archives indisponibles : {error}</p></div>;
  if (!feed) return <div className="maps-page"><p className="maps-hint">Chargement des Archives…</p></div>;

  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const relations = selected ? feed.relations.filter((r) => r.from === selected.id || r.to === selected.id) : [];

  const sync = async () => {
    setSyncing(true);
    await reload();
    setSyncing(false);
    flash('Archives synchronisées');
  };

  const addToLibrary = (e: FeedEntry) => {
    dispatch({ type: 'IMPORT_ARCHIVE_ENTRIES', ...archiveBundle([e], universe.id) });
    flash(`« ${e.name} » ajoutée à la bibliothèque`);
  };

  return (
    <div className="maps-page">
      <nav className="maps-crumbs"><span>{universe.name}</span> › <span>Archives</span></nav>
      <header className="maps-head">
        <h2>Archives de l’Underdark</h2>
        <button className="maps-btn" disabled={syncing} onClick={sync}>{syncing ? 'Synchronisation…' : 'Synchroniser'}</button>
        <p className="maps-sub">
          Lecture seule · niveau public · publié le {new Date(feed.generatedAt).toLocaleDateString('fr-CA')} ·
          {' '}{feed.counts.entries} fiches, {feed.counts.relations} liens, {feed.counts.atlasFeatures} repères d’Atlas
        </p>
        <input className="maps-btn archives-search" placeholder="Rechercher une fiche, un tag…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </header>

      <div className="archives-body">
        <div>
          {groups.length === 0 && <p className="maps-hint">Aucune fiche ne correspond.</p>}
          {groups.map(([type, list]) => (
            <section key={type} className="collection">
              <div className="collection-head">
                <h2>{FEED_TYPE_LABEL[type] ?? type}</h2>
                <p className="maps-sub">{list.length} fiche{list.length > 1 ? 's' : ''}</p>
              </div>
              <ul className="archives-list">
                {list.map((e) => (
                  <li key={e.id}>
                    <button className="maps-link" data-on={selectedId === e.id ? 1 : 0} onClick={() => setSelectedId(e.id)}>
                      {e.name}
                    </button>
                    <span className="maps-sub">{e.summary}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <aside className="maps-panel">
          {!selected && <p className="maps-hint">Choisis une fiche pour la lire.</p>}
          {selected && (
            <article className="maps-card">
              <h3>{selected.name}</h3>
              {selected.scientificName && <p className="maps-sub"><em>{selected.scientificName}</em></p>}
              {selected.altNames.length > 0 && <p className="maps-sub">{selected.altNames.map((a) => a.value).join(' · ')}</p>}
              <p>{selected.summary}</p>
              {selected.params.some((p) => p.value) && (
                <table className="maps-table">
                  <tbody>{selected.params.filter((p) => p.value).map((p, i) => <tr key={i}><th>{p.label}</th><td>{p.value}</td></tr>)}</tbody>
                </table>
              )}
              {selected.images.map((img) => (
                <figure key={img.id} className="archives-figure">
                  <img src={img.src} alt={img.alt ?? img.caption ?? selected.name} loading="lazy" />
                  {img.caption && <figcaption className="maps-sub">{img.caption}</figcaption>}
                </figure>
              ))}
              {selected.sections.map((s) => (
                <div key={s.id} className="maps-block">
                  <h4>{s.title}</h4>
                  <p className="archives-text">{s.body}</p>
                </div>
              ))}
              {relations.length > 0 && (
                <div className="maps-block">
                  <h4>Dans la Toile</h4>
                  <ul className="maps-list">
                    {relations.map((r) => {
                      const otherId = r.from === selected.id ? r.to : r.from;
                      const other = byId.get(otherId);
                      return other ? (
                        <li key={r.id}><button className="maps-link" onClick={() => setSelectedId(other.id)}>{other.name}</button> <span className="maps-sub">{r.kind}</span></li>
                      ) : null;
                    })}
                  </ul>
                </div>
              )}
              <div className="maps-actions">
                <button className="maps-btn gold" onClick={() => addToLibrary(selected)}>Ajouter à la bibliothèque</button>
              </div>
            </article>
          )}
        </aside>
      </div>
    </div>
  );
}
