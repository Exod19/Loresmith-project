/**
 * Liaison permanente d'un univers aux Archives. La liaison est stockée dans l'univers (champ `archives`),
 * donc elle suit l'univers dans les sauvegardes. L'univers Underdark est lié automatiquement.
 */
import { useEffect } from 'react';
import { archiveBundle, useUnderdarkFeed, UNDERDARK_LINK, type UnderdarkFeed } from './underdark';

type Universe = { id: string; name: string; archives?: string };
type Props = {
  universe: Universe;
  dispatch: (a: { type: string; [k: string]: unknown }) => void;
  flash: (m: string) => void;
  setView: (v: string) => void;
};

export function setArchivesLink(universe: Universe, dispatch: Props['dispatch'], on: boolean) {
  dispatch({ type: 'UPDATE_UNIVERSE', id: universe.id, patch: { archives: on ? UNDERDARK_LINK : undefined } });
}

/** Crée dans la bibliothèque les fiches et images des Archives absentes (jamais d'écrasement d'une fiche déjà modifiée). */
export function importArchiveLibrary(feed: UnderdarkFeed, universe: Universe, dispatch: Props['dispatch']) {
  dispatch({ type: 'IMPORT_ARCHIVE_ENTRIES', ...archiveBundle(feed.entries, universe.id) });
}

export default function ArchivesLinkPanel({ universe, dispatch, flash, setView }: Props) {
  const linked = universe.archives === UNDERDARK_LINK;
  const { feed, error, reload } = useUnderdarkFeed();
  // À chaque ouverture d'un univers lié, les fiches manquantes rejoignent la bibliothèque.
  useEffect(() => { if (linked && feed) importArchiveLibrary(feed, universe, dispatch); }, [linked, feed, universe.id]);

  if (!linked) {
    return (
      <div className="panel">
        <p>Cet univers n’est pas lié aux Archives de l’Underdark.</p>
        <button className="btn" onClick={() => { setArchivesLink(universe, dispatch, true); flash('Univers lié aux Archives'); }}>
          Lier aux Archives de l’Underdark
        </button>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3>Archives de l’Underdark</h3>
      {error && <p>Archives indisponibles : {error}</p>}
      {feed && (
        <p>
          {feed.counts.entries} fiches · {feed.counts.relations} liens · {feed.counts.atlasFeatures} repères d’Atlas · {feed.counts.images} images.
          <br />
          <span className="muted">Publiées le {new Date(feed.generatedAt).toLocaleDateString('fr-CA')} (niveau public).</span>
        </p>
      )}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn gold" onClick={() => setView('archives')}>Consulter les Archives</button>
        <button className="btn" onClick={() => setView('maps')}>Ouvrir les cartes</button>
        <button className="btn" onClick={async () => { const f = await reload(); if (f) importArchiveLibrary(f, universe, dispatch); flash('Archives synchronisées et ajoutées à la bibliothèque'); }}>Synchroniser</button>
        <button className="btn" onClick={() => { setArchivesLink(universe, dispatch, false); flash('Liaison retirée'); }}>Délier</button>
      </div>
    </div>
  );
}
