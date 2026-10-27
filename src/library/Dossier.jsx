/**
 * Fiche de bibliothèque : une seule mise en page pour tous les types d'archives.
 * Ordre de lecture pour le MJ : titre → passage à lire → résumé → texte → fiche d'identité, images,
 * savoir du MJ (réservé), liens « Dans la Toile », campagnes.
 */
import './dossier.css';

const CANON = {
  confirme: 'Confirmé', recit: 'Récit', oral: 'Tradition orale', hypothese: 'Hypothèse', conteste: 'Contesté',
  nonconfirme: 'Non confirmé', brouillon: 'Brouillon', creation: 'Création originale',
};
const GLYPH = { artifact: '◇', person: '✦', place: '⌂', event: '◷', faction: '▣', mystery: '?', document: '❦' };

/** Découpe en paragraphes et retire le balisage markdown de la source (gras, italique, titres). */
const paras = (text) => String(text || '')
  .replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/(^|\s)\*(\S.*?)\*(?=\s|$)/g, '$1$2').replace(/^#+\s*/gm, '')
  .split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
const filled = (rows) => rows.filter(([, v]) => v && String(v).trim());

/** Carte de grille : même hauteur, même cadrage d'image, même ordre de lecture pour tous les types. */
export function LibraryCard({ entry, img, typeLabel, selected, onClick }) {
  return (
    <button type="button" className="lib-card" data-on={selected ? 1 : 0} onClick={onClick}>
      <span className="lib-card-media">
        {img?.dataUrl ? <img src={img.dataUrl} alt="" loading="lazy" /> : <span className="lib-card-ph">{GLYPH[entry.archiveType] || '❦'}</span>}
      </span>
      <span className="lib-card-body">
        <span className="lib-card-type">{typeLabel}</span>
        <span className="lib-card-title">{entry.title}</span>
        {entry.shortSummary && <span className="lib-card-sum">{entry.shortSummary}</span>}
      </span>
    </button>
  );
}

function ReadAloud({ entry, onWrite, busy }) {
  if (entry.readAloud) {
    return (
      <div className="dossier-readaloud">
        {paras(entry.readAloud).map((p, i) => <p key={i}>{p}</p>)}
      </div>
    );
  }
  return (
    <div className="dossier-readaloud empty">
      <p>Pas encore de passage à lire aux aventuriers.</p>
      {onWrite && <button type="button" className="dossier-btn" disabled={busy} onClick={onWrite}>{busy ? 'Rédaction…' : 'Rédiger avec l’IA'}</button>}
    </div>
  );
}

export default function Dossier({
  entry, typeLabel, img, gallery = [], campaigns = [], related = [], hasEntry = () => false,
  onOpenEntry, onPolish, onUploadImage, onWriteReadAloud, busy,
}) {
  const sections = entry.sections?.length ? entry.sections : filled([['', entry.body]]).map(([, body]) => ({ id: 'corps', title: 'Texte', body }));
  const identity = filled([
    ...(entry.params || []).map((p) => [p.label, p.value]),
    ['Époque', entry.era || entry.date],
    ['Lieu actuel', entry.currentLocation],
    ['Gardien', entry.owner],
    ['Classification', entry.classification],
    ['Source', entry.sourceId ? `Archives de l’Underdark · fiche ${entry.sourceId}` : entry.origin],
  ]);
  const mj = filled([
    ['Secrets', entry.secrets],
    ['Usage en campagne', entry.campaignUse],
    ['Contexte historique', entry.historicalContext],
    ['Notes libres', entry.roughNotes],
  ]);
  const linked = campaigns.filter((c) => (entry.linkedCampaignIds || []).includes(c.id));

  return (
    <article className={`dossier dossier-${entry.archiveType || 'document'}`}>
      <header className="dossier-head">
        <div className="dossier-kicker">
          <span>{typeLabel}</span>
          {entry.canon && CANON[entry.canon] && <span className="dossier-canon">{CANON[entry.canon]}</span>}
        </div>
        <h1>{entry.title}</h1>
        {entry.subtitle && <p className="dossier-sub">{entry.subtitle}</p>}
        {entry.altNames?.length > 0 && <p className="dossier-alt">Aussi appelé : {entry.altNames.join(' · ')}</p>}
        <div className="dossier-actions">
          {onPolish && <button type="button" className="dossier-btn" disabled={busy} onClick={() => onPolish(entry)}>Reformuler (IA)</button>}
          {onUploadImage && (
            <label className="dossier-btn">
              Changer l’image
              <input hidden type="file" accept="image/*" onChange={(e) => onUploadImage(entry, e.target.files?.[0])} />
            </label>
          )}
        </div>
      </header>

      <div className="dossier-grid">
        <div className="dossier-main">
          <ReadAloud entry={entry} onWrite={onWriteReadAloud} busy={busy} />
          {entry.shortSummary && <p className="dossier-lead">{entry.shortSummary}</p>}
          {sections.map((s) => (
            <section key={s.id} className="dossier-section">
              <h2>{s.title}</h2>
              {paras(s.body).map((p, i) => <p key={i}>{p}</p>)}
            </section>
          ))}
        </div>

        <aside className="dossier-side">
          <figure className="dossier-hero">
            {img?.dataUrl ? <img src={img.dataUrl} alt={entry.title} /> : <div className="dossier-ph">{GLYPH[entry.archiveType] || '❦'}</div>}
          </figure>

          {identity.length > 0 && (
            <dl className="dossier-id">
              {identity.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          )}

          {gallery.length > 1 && (
            <div className="dossier-gallery">
              {gallery.map((a) => <img key={a.id} src={a.dataUrl} alt={a.name || ''} loading="lazy" />)}
            </div>
          )}

          <section className="dossier-mj">
            <h3>Savoir du MJ</h3>
            <p className="dossier-mj-note">Réservé au MJ : ne pas lire à voix haute.</p>
            {mj.length === 0 && <p className="muted">Aucune note.</p>}
            {mj.map(([k, v]) => <div key={k} className="dossier-mj-row"><b>{k}</b><p>{v}</p></div>)}
          </section>

          {related.length > 0 && (
            <section className="dossier-rel">
              <h3>Dans la Toile</h3>
              <ul>
                {related.map((r) => (
                  <li key={r.id}>
                    {hasEntry(r.id)
                      ? <button type="button" onClick={() => onOpenEntry?.(r.id)}>{r.name}</button>
                      : <span>{r.name}</span>}
                    <small>{r.kind.replace(/_/g, ' ')}</small>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {linked.length > 0 && (
            <section className="dossier-rel">
              <h3>Campagnes</h3>
              <ul>{linked.map((c) => <li key={c.id}><span>{c.title || c.name}</span></li>)}</ul>
            </section>
          )}

          {entry.updatedAt && <p className="dossier-foot">Dernière modification : {new Date(entry.updatedAt).toLocaleDateString('fr-CA')}</p>}
        </aside>
      </div>
    </article>
  );
}
