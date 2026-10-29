/**
 * Fenêtres d'export et d'import d'archives (.zip).
 * L'import montre toujours un bilan avant d'agir, et rien n'est remplacé sans choix explicite.
 */
import { useEffect, useState } from 'react';
import { commitImport, exportArchive, prepareImport } from './backup';

const NAMES = {
  universes: ['univers', 'univers'],
  characters: ['héros', 'héros'],
  campaigns: ['campagne', 'campagnes'],
  npcs: ['PNJ ou créature', 'PNJ et créatures'],
  quests: ['quête', 'quêtes'],
  assets: ['image', 'images'],
  libraryEntries: ['fiche de bibliothèque', 'fiches de bibliothèque'],
  maps: ['carte', 'cartes'],
  chatThreads: ['discussion', 'discussions'],
};
const plural = (n, c) => `${n} ${NAMES[c]?.[n > 1 ? 1 : 0] ?? c}`;

function Dialog({ title, onClose, children }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-h">
          <h3>{title}</h3>
          <button className="btn ghost sm" onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={{ marginTop: 14 }}>{children}</div>
      </div>
    </div>
  );
}

const Choice = ({ checked, onChange, children }) => (
  <label style={{ display: 'flex', gap: 8, alignItems: 'baseline', margin: '6px 0', cursor: 'pointer' }}>
    <input type="radio" checked={checked} onChange={onChange} />
    <span>{children}</span>
  </label>
);

export function ExportDialog({ state, onClose, flash }) {
  const universe = state.universes?.[state.activeUniverseId];
  const campaigns = Object.values(state.campaigns || {}).filter((c) => c.universeId === universe?.id);
  const [kind, setKind] = useState('all');
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id || '');
  const [busy, setBusy] = useState(false);

  async function run() {
    const scope =
      kind === 'universe' ? { kind, id: universe.id } : kind === 'campaign' ? { kind, id: campaignId, universeId: universe.id } : { kind: 'all' };
    const label = kind === 'universe' ? universe.name : kind === 'campaign' ? state.campaigns[campaignId]?.title : 'grimoire';
    setBusy(true);
    try {
      const { images } = await exportArchive(state, scope, label);
      flash(`Archive téléchargée (${images} image${images > 1 ? 's' : ''})`);
      onClose();
    } catch (e) {
      flash('Export impossible : ' + e.message);
    }
    setBusy(false);
  }

  return (
    <Dialog title="Exporter une sauvegarde (.zip)" onClose={onClose}>
      <Choice checked={kind === 'all'} onChange={() => setKind('all')}>
        Tout le grimoire (tous les univers)
      </Choice>
      {universe && (
        <Choice checked={kind === 'universe'} onChange={() => setKind('universe')}>
          L’univers « {universe.name} » et tout ce qu’il contient
        </Choice>
      )}
      {campaigns.length > 0 && (
        <Choice checked={kind === 'campaign'} onChange={() => setKind('campaign')}>
          Une campagne, avec ses PNJ et fiches liés :{' '}
          <select value={campaignId} onChange={(e) => { setCampaignId(e.target.value); setKind('campaign'); }}>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title || 'Sans titre'}
              </option>
            ))}
          </select>
        </Choice>
      )}
      <div className="faint" style={{ fontSize: 12, margin: '10px 0' }}>
        L’archive contient les données et les images. Tes clés d’IA n’y sont jamais incluses.
      </div>
      <div className="row">
        <button className="btn primary" style={{ flex: 'none' }} disabled={busy} onClick={run}>
          {busy ? 'Préparation…' : '⤓ Exporter'}
        </button>
        <button className="btn ghost" style={{ flex: 'none' }} onClick={onClose}>
          Annuler
        </button>
      </div>
    </Dialog>
  );
}

const SCOPE_LABEL = { all: 'une sauvegarde complète', universe: 'un univers', campaign: 'une campagne' };

export function ImportDialog({ file, state, onApply, onClose, flash }) {
  const [prepared, setPrepared] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    prepareImport(file, state).then(setPrepared, (e) => setError(e.message));
    // Le bilan est calculé une fois, sur le grimoire au moment du choix du fichier.
  }, [file]);

  async function run(mode) {
    setBusy(true);
    try {
      const { state: next, kept } = await commitImport(state, prepared, mode);
      onApply(next);
      flash(kept.length ? `Import terminé. ${kept.length} élément(s) déjà présent(s) gardé(s) dans ta version.` : 'Import terminé.');
      onClose();
    } catch (e) {
      setError('Import impossible : ' + e.message);
    }
    setBusy(false);
  }

  const kind = prepared?.manifest.scope.kind;
  const r = prepared?.report;
  return (
    <Dialog title="Importer une sauvegarde" onClose={onClose}>
      {error ? (
        <div style={{ color: 'var(--blood)' }}>{error}</div>
      ) : !prepared ? (
        <div className="faint">Lecture de « {file.name} »…</div>
      ) : (
        <>
          <div>
            « {file.name} » contient {SCOPE_LABEL[kind]}
            {prepared.manifest.label ? ` (${prepared.manifest.label})` : ''}
            {prepared.manifest.legacy ? ', au format .json d’avant les archives' : ''}.
          </div>
          <ul style={{ margin: '10px 0', paddingLeft: 18, fontSize: 13 }}>
            {Object.entries(r.byCollection)
              .filter(([, x]) => x.added + x.identical + x.different > 0)
              .map(([c, x]) => (
                <li key={c}>
                  {plural(x.added + x.identical + x.different, c)} :{' '}
                  {[x.added && `${x.added} nouveau(x)`, x.identical && `${x.identical} déjà identique(s)`, x.different && `${x.different} différent(s) de ta version`]
                    .filter(Boolean)
                    .join(', ')}
                </li>
              ))}
          </ul>
          {kind === 'campaign' && (
            <div className="faint" style={{ fontSize: 12, marginBottom: 8 }}>
              La campagne sera rattachée à l’univers actif : « {state.universes?.[state.activeUniverseId]?.name} ».
            </div>
          )}
          <div className="faint" style={{ fontSize: 12, marginBottom: 10 }}>
            Une copie de sécurité de ton grimoire actuel est faite avant l’import.
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <button className="btn primary" disabled={busy} onClick={() => run('merge')}>
              Ajouter ce qui manque{r.different ? ' (tes versions sont gardées)' : ''}
            </button>
            {(r.different > 0 || r.identical > 0) && (
              <button className="btn" disabled={busy} onClick={() => run('copy')}>
                Importer comme une copie (nouveaux éléments, rien n’est touché)
              </button>
            )}
            {(r.different > 0 || kind === 'all') && (
              <button
                className="btn"
                disabled={busy}
                onClick={() => {
                  const what = kind === 'all' ? 'TOUT ton grimoire' : kind === 'universe' ? 'cet univers' : 'les éléments de cette campagne';
                  if (confirm(`Remplacer ${what} par le contenu de l’archive ?`)) run('replace');
                }}
              >
                {kind === 'all' ? 'Remplacer tout le grimoire par cette sauvegarde' : 'Remplacer par la version de l’archive'}
              </button>
            )}
            <button className="btn ghost" disabled={busy} onClick={onClose}>
              Annuler
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
